// Stock Model - ENFORCES THE GOLDEN RULE
// ONE ownerId + ONE productId = ONE stock document ONLY

/**
 * 🔒 GOLDEN RULE ENFORCER
 * Add or update stock for a product
 * This function ensures: One ownerId + one productId = ONE stock document
 * * @param {string} ownerId - User ID who owns the stock
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to add (can be 0 if only updating price)
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

        // New logic: Allow quantity to be 0 if a sellingPrice is provided (Price Update)
        if (typeof quantity !== 'number' || (quantity === 0 && sellingPrice === undefined)) {
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

        // 🔒 Check if stock already exists for this ownerId + productId
        const existingStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', ownerId)
            .where('productId', '==', productId)
            .where('type', '==', type)
            .limit(1)
            .get();

        if (!existingStockQuery.empty) {
            const stockDoc = existingStockQuery.docs[0];
            const existingStock = stockDoc.data();
            
            // Calculate new quantity
            const newQuantity = existingStock.quantity + quantity;

            // If quantity becomes 0 or less, delete the stock entry
            if (newQuantity <= 0) {
                await db.collection(COLLECTIONS.STOCK).doc(stockDoc.id).delete();
                return {
                    success: true,
                    action: 'deleted',
                    finalQuantity: 0
                };
            }

            // Prepare updates
            const updates = {
                quantity: newQuantity,
                updatedAt: getTimestamp(),
                // Sync product info in case it changed in the master list
                productName: product.name,
                productSKU: product.sku,
                productUnit: product.unit
            };

            // Update price if provided (Enables Resale Price Feature)
            if (sellingPrice !== undefined) {
                updates.sellingPrice = sellingPrice;
            }

            await db.collection(COLLECTIONS.STOCK).doc(stockDoc.id).update(updates);

            return {
                success: true,
                action: 'updated',
                stockId: stockDoc.id,
                finalQuantity: newQuantity,
                price: sellingPrice || existingStock.sellingPrice
            };

        } else {
            // Create NEW stock entry
            if (quantity <= 0) {
                return {
                    success: false,
                    error: 'Cannot create new stock with zero or negative quantity'
                };
            }

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
                productName: product.name,
                productSKU: product.sku,
                productUnit: product.unit,
                quantity: quantity,
                sellingPrice: sellingPrice,
                type: type,
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            };

            await stockRef.set(newStock);

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
            error: error.message || 'Failed to update stock'
        };
    }
}

/**
 * Get current user's stock
 */
async function getMyStock(type = null) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) return [];

    try {
        let query = db.collection(COLLECTIONS.STOCK).where('ownerId', '==', authUser.uid);
        
        if (type) {
            query = query.where('type', '==', type);
        }

        const snapshot = await query.get();
        const stockItems = [];
        
        snapshot.forEach(doc => {
            stockItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Local sort to prevent errors if composite index isn't ready
        return stockItems.sort((a, b) => {
            const timeA = a.updatedAt?.seconds || 0;
            const timeB = b.updatedAt?.seconds || 0;
            return timeB - timeA;
        });

    } catch (error) {
        console.error('Error getting my stock:', error);
        return [];
    }
}

/**
 * Get all stock owned by a specific seller
 */
async function getOwnerStock(ownerId, type = null) {
    try {
        if (!ownerId) return [];

        let query = db.collection(COLLECTIONS.STOCK).where('ownerId', '==', ownerId);
        
        if (type) {
            query = query.where('type', '==', type);
        }

        const snapshot = await query.get();
        const stockItems = [];
        
        snapshot.forEach(doc => {
            stockItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return stockItems;

    } catch (error) {
        console.error('Error in getOwnerStock:', error);
        return [];
    }
}

/**
 * Transfer stock from a seller to a buyer
 * Maintains the seller's price as the default buyer price upon receipt
 */
async function transferStock(sellerId, buyerId, productId, quantity, buyerPrice) {
    const batch = db.batch();
    
    try {
        // 1. Get Seller's Stock
        const sellerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .limit(1)
            .get();

        if (sellerStockQuery.empty) {
            throw new Error('Seller does not have this product in stock');
        }

        const sellerStockDoc = sellerStockQuery.docs[0];
        const sellerStockData = sellerStockDoc.data();

        if (sellerStockData.quantity < quantity) {
            throw new Error('Insufficient seller stock');
        }

        // 2. Get Buyer's Stock
        const buyerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', buyerId)
            .where('productId', '==', productId)
            .limit(1)
            .get();

        // 3. Update Seller (Decrease)
        const newSellerQuantity = sellerStockData.quantity - quantity;
        
        if (newSellerQuantity === 0) {
            batch.delete(sellerStockDoc.ref);
        } else {
            batch.update(sellerStockDoc.ref, {
                quantity: newSellerQuantity,
                updatedAt: getTimestamp()
            });
        }

        // 4. Update or Create Buyer Stock (Increase)
        if (!buyerStockQuery.empty) {
            const buyerStockDoc = buyerStockQuery.docs[0];
            batch.update(buyerStockDoc.ref, {
                quantity: buyerStockDoc.data().quantity + quantity,
                updatedAt: getTimestamp()
                // Note: We don't overwrite buyer's existing resale price here
            });
        } else {
            const newBuyerStockRef = db.collection(COLLECTIONS.STOCK).doc();
            batch.set(newBuyerStockRef, {
                id: newBuyerStockRef.id,
                ownerId: buyerId,
                productId: productId,
                productName: sellerStockData.productName,
                productSKU: sellerStockData.productSKU,
                productUnit: sellerStockData.productUnit,
                quantity: quantity,
                sellingPrice: buyerPrice, // Initial resale price matches purchase price
                type: STOCK_TYPES.INVENTORY,
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            });
        }

        await batch.commit();
        return { success: true };

    } catch (error) {
        console.error('Error transferring stock:', error);
        return { success: false, error: error.message };
    }
}

console.log('Stock model loaded - GOLDEN RULE enforced with resale support');
