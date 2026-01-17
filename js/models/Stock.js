// Stock Model - ENFORCES THE GOLDEN RULE
// ONE ownerId + ONE productId = ONE stock document ONLY

/**
 * 🔒 GOLDEN RULE ENFORCER
 * Add or update stock for a product
 * This function ensures: One ownerId + one productId = ONE stock document
 * 
 * @param {string} ownerId - User ID who owns the stock
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to add (can be negative to reduce)
 * @param {number} sellingPrice - Price per unit (owner sets their own price)
 * @param {string} type - 'inventory' or 'rawMaterial'
 * @returns {Promise<Object>} Result with stock info or error
 */
async function addOrUpdateStock(ownerId, productId, quantity, sellingPrice, type = STOCK_TYPES.INVENTORY) {
    try {
        // Validate inputs
        if (!ownerId || !productId) {
            return {
                success: false,
                error: 'Owner ID and Product ID are required'
            };
        }

        if (typeof quantity !== 'number' || quantity === 0) {
            return {
                success: false,
                error: ERROR_MESSAGES.INVALID_QUANTITY
            };
        }

        if (sellingPrice !== undefined && (typeof sellingPrice !== 'number' || sellingPrice < VALIDATION.MIN_PRICE)) {
            return {
                success: false,
                error: 'Invalid selling price'
            };
        }

        // Verify product exists
        const product = await getProduct(productId);
        if (!product) {
            return {
                success: false,
                error: ERROR_MESSAGES.PRODUCT_NOT_FOUND
            };
        }

        // 🔒 GOLDEN RULE: Check if stock already exists for this ownerId + productId
        const existingStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', ownerId)
            .where('productId', '==', productId)
            .where('type', '==', type)
            .limit(1)
            .get();

        if (!existingStockQuery.empty) {
            // STOCK EXISTS - UPDATE IT
            const stockDoc = existingStockQuery.docs[0];
            const existingStock = stockDoc.data();
            const newQuantity = existingStock.quantity + quantity;

            // Check if quantity will become zero or negative
            if (newQuantity <= 0) {
                // AUTO DELETE when quantity reaches zero
                await db.collection(COLLECTIONS.STOCK).doc(stockDoc.id).delete();
                console.log('Stock auto-deleted (quantity reached zero):', stockDoc.id);
                
                return {
                    success: true,
                    action: 'deleted',
                    stockId: stockDoc.id,
                    finalQuantity: 0
                };
            }

            // Update existing stock
            const updates = {
                quantity: newQuantity,
                updatedAt: getTimestamp()
            };

            // Update selling price if provided
            if (sellingPrice !== undefined) {
                updates.sellingPrice = sellingPrice;
            }

            await db.collection(COLLECTIONS.STOCK).doc(stockDoc.id).update(updates);

            console.log('Stock updated:', stockDoc.id, 'New quantity:', newQuantity);
            return {
                success: true,
                action: 'updated',
                stockId: stockDoc.id,
                previousQuantity: existingStock.quantity,
                addedQuantity: quantity,
                finalQuantity: newQuantity
            };

        } else {
            // STOCK DOESN'T EXIST - CREATE NEW ONE
            
            // Prevent creating stock with negative quantity
            if (quantity < 0) {
                return {
                    success: false,
                    error: ERROR_MESSAGES.INSUFFICIENT_STOCK
                };
            }

            // Require selling price for new stock
            if (sellingPrice === undefined) {
                return {
                    success: false,
                    error: 'Selling price is required for new stock'
                };
            }

            const stockRef = db.collection(COLLECTIONS.STOCK).doc();
            const newStock = {
                id: stockRef.id,
                ownerId: ownerId,
                productId: productId,
                productName: product.name, // Cached for quick display
                productSKU: product.sku,
                productUnit: product.unit,
                quantity: quantity,
                sellingPrice: sellingPrice,
                type: type,
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            };

            await stockRef.set(newStock);

            console.log('New stock created:', stockRef.id);
            return {
                success: true,
                action: 'created',
                stockId: stockRef.id,
                finalQuantity: quantity
            };
        }

    } catch (error) {
        console.error('Error in addOrUpdateStock:', error);
        return {
            success: false,
            error: error.message || 'Failed to manage stock'
        };
    }
}

/**
 * Get stock for a specific owner and product
 * @param {string} ownerId - Owner ID
 * @param {string} productId - Product ID
 * @param {string} type - Stock type
 * @returns {Promise<Object|null>} Stock document or null
 */
async function getStock(ownerId, productId, type = STOCK_TYPES.INVENTORY) {
    try {
        const stockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', ownerId)
            .where('productId', '==', productId)
            .where('type', '==', type)
            .limit(1)
            .get();

        if (stockQuery.empty) {
            return null;
        }

        const stockDoc = stockQuery.docs[0];
        return {
            id: stockDoc.id,
            ...stockDoc.data()
        };

    } catch (error) {
        console.error('Error getting stock:', error);
        return null;
    }
}

/**
 * Get all stock owned by a user
 * @param {string} ownerId - Owner ID
 * @param {string} type - Optional: filter by type
 * @returns {Promise<Array>} Array of stock items
 */
async function getOwnerStock(ownerId, type = null) {
    try {
        let query = db.collection(COLLECTIONS.STOCK).where('ownerId', '==', ownerId);

        if (type) {
            query = query.where('type', '==', type);
        }

        const snapshot = await query.orderBy('updatedAt', 'desc').get();
        
        const stockItems = [];
        snapshot.forEach(doc => {
            stockItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return stockItems;

    } catch (error) {
        console.error('Error getting owner stock:', error);
        return [];
    }
}

/**
 * Get current user's stock
 * @param {string} type - Optional: 'inventory' or 'rawMaterial'
 * @returns {Promise<Array>} Array of stock items
 */
async function getMyStock(type = null) {
    if (!currentUser) {
        return [];
    }

    return await getOwnerStock(currentUser.uid, type);
}

/**
 * Check if user has sufficient stock for a sale
 * @param {string} ownerId - Owner ID
 * @param {string} productId - Product ID
 * @param {number} requiredQuantity - Quantity needed
 * @param {string} type - Stock type
 * @returns {Promise<Object>} { sufficient: boolean, available: number }
 */
async function checkStockAvailability(ownerId, productId, requiredQuantity, type = STOCK_TYPES.INVENTORY) {
    const stock = await getStock(ownerId, productId, type);

    if (!stock) {
        return {
            sufficient: false,
            available: 0
        };
    }

    return {
        sufficient: stock.quantity >= requiredQuantity,
        available: stock.quantity
    };
}

/**
 * Transfer stock from seller to buyer (used in transactions)
 * This is the core function for sales/purchases
 * 
 * @param {string} sellerId - Seller's user ID
 * @param {string} buyerId - Buyer's user ID
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to transfer
 * @param {number} buyerPrice - Price buyer will sell at (buyer sets their own price)
 * @returns {Promise<Object>} Result
 */
async function transferStock(sellerId, buyerId, productId, quantity, buyerPrice) {
    try {
        // Validate inputs
        if (quantity <= 0) {
            return {
                success: false,
                error: ERROR_MESSAGES.INVALID_QUANTITY
            };
        }

        // Check seller has enough stock
        const availability = await checkStockAvailability(sellerId, productId, quantity);
        if (!availability.sufficient) {
            return {
                success: false,
                error: `${ERROR_MESSAGES.INSUFFICIENT_STOCK}. Available: ${availability.available}`
            };
        }

        // Use Firestore batch for atomic operation
        const batch = createBatch();

        // 1. Reduce seller's stock (might auto-delete if reaches zero)
        const sellerStock = await getStock(sellerId, productId);
        const newSellerQuantity = sellerStock.quantity - quantity;

        if (newSellerQuantity <= 0) {
            // Delete seller's stock
            batch.delete(db.collection(COLLECTIONS.STOCK).doc(sellerStock.id));
        } else {
            // Update seller's stock
            batch.update(db.collection(COLLECTIONS.STOCK).doc(sellerStock.id), {
                quantity: newSellerQuantity,
                updatedAt: getTimestamp()
            });
        }

        // 2. Add to buyer's stock (or create new if doesn't exist)
        const buyerStock = await getStock(buyerId, productId);
        
        if (buyerStock) {
            // Update existing buyer stock
            batch.update(db.collection(COLLECTIONS.STOCK).doc(buyerStock.id), {
                quantity: buyerStock.quantity + quantity,
                sellingPrice: buyerPrice, // Buyer sets their own price
                updatedAt: getTimestamp()
            });
        } else {
            // Create new stock for buyer
            const product = await getProduct(productId);
            const newBuyerStockRef = db.collection(COLLECTIONS.STOCK).doc();
            batch.set(newBuyerStockRef, {
                id: newBuyerStockRef.id,
                ownerId: buyerId,
                productId: productId,
                productName: product.name,
                productSKU: product.sku,
                productUnit: product.unit,
                quantity: quantity,
                sellingPrice: buyerPrice,
                type: STOCK_TYPES.INVENTORY,
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            });
        }

        // Commit batch
        await batch.commit();

        console.log('Stock transferred successfully');
        return {
            success: true,
            sellerFinalQuantity: newSellerQuantity,
            transferredQuantity: quantity
        };

    } catch (error) {
        console.error('Error transferring stock:', error);
        return {
            success: false,
            error: error.message || 'Failed to transfer stock'
        };
    }
}

/**
 * Get all stock items for a specific product (across all owners)
 * @param {string} productId - Product ID
 * @returns {Promise<Array>} Array of stock items
 */
async function getProductStockAcrossOwners(productId) {
    try {
        const snapshot = await db.collection(COLLECTIONS.STOCK)
            .where('productId', '==', productId)
            .get();

        const stockItems = [];
        snapshot.forEach(doc => {
            stockItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return stockItems;

    } catch (error) {
        console.error('Error getting product stock:', error);
        return [];
    }
}

console.log('Stock model loaded - GOLDEN RULE enforced');
              
