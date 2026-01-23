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
 * ⭐ NEW: Transfer stock with specific type (inventory or rawMaterial)
 * @param {string} sellerId - Seller UID
 * @param {string} buyerId - Buyer UID  
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to transfer
 * @param {number} buyerPrice - Price for buyer's stock
 * @param {string} stockType - Type of stock ('inventory' or 'rawMaterial')
 */
async function transferStockWithType(sellerId, buyerId, productId, quantity, buyerPrice, stockType = STOCK_TYPES.INVENTORY) {
    const batch = db.batch();
    
    try {
        console.log(`🔄 transferStockWithType called:`);
        console.log(`   Seller: ${sellerId}`);
        console.log(`   Buyer: ${buyerId}`);
        console.log(`   Product: ${productId}`);
        console.log(`   Quantity: ${quantity}`);
        console.log(`   Stock Type: ${stockType}`);

        // 1. Get Seller's Stock (always from inventory)
        const sellerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .where('type', '==', STOCK_TYPES.INVENTORY)
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

        // 2. Get Buyer's Stock (check for specified type)
        const buyerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', buyerId)
            .where('productId', '==', productId)
            .where('type', '==', stockType)
            .limit(1)
            .get();

        // 3. Update Seller (Decrease from inventory)
        const newSellerQuantity = sellerStockData.quantity - quantity;
        
        if (newSellerQuantity === 0) {
            batch.delete(sellerStockDoc.ref);
            console.log(`   ✅ Seller stock deleted (reached 0)`);
        } else {
            batch.update(sellerStockDoc.ref, {
                quantity: newSellerQuantity,
                updatedAt: getTimestamp()
            });
            console.log(`   ✅ Seller stock decreased to ${newSellerQuantity}`);
        }

        // 4. Update or Create Buyer Stock (with specified type)
        if (!buyerStockQuery.empty) {
            const buyerStockDoc = buyerStockQuery.docs[0];
            const newBuyerQuantity = buyerStockDoc.data().quantity + quantity;
            batch.update(buyerStockDoc.ref, {
                quantity: newBuyerQuantity,
                updatedAt: getTimestamp()
            });
            console.log(`   ✅ Buyer ${stockType} stock increased to ${newBuyerQuantity}`);
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
                sellingPrice: buyerPrice,
                type: stockType, // ⭐ Use specified type (inventory or rawMaterial)
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            });
            console.log(`   ✅ Buyer ${stockType} stock created with quantity ${quantity}`);
        }

        await batch.commit();
        console.log(`✅ Stock transfer complete!`);
        return { success: true };

    } catch (error) {
        console.error('❌ Error transferring stock:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Transfer stock from a seller to a buyer (DEFAULT: goes to inventory)
 * Maintains backward compatibility with existing code
 */
async function transferStock(sellerId, buyerId, productId, quantity, buyerPrice) {
    // Default to INVENTORY type for backward compatibility
    return await transferStockWithType(sellerId, buyerId, productId, quantity, buyerPrice, STOCK_TYPES.INVENTORY);
}

/**
 * Check specifically if a seller has enough stock for an order
 * @param {string} sellerId - Seller UID
 * @param {string} productId - Product ID
 * @param {number} requestedQty - Quantity buyer wants
 * @returns {Promise<Object>} Object with sufficient flag and available amount
 */
async function checkStockAvailability(sellerId, productId, requestedQty) {
    try {
        const snapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .where('type', '==', STOCK_TYPES.INVENTORY)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { sufficient: false, available: 0 };
        }

        const stockData = snapshot.docs[0].data();
        return {
            sufficient: stockData.quantity >= requestedQty,
            available: stockData.quantity
        };
    } catch (error) {
        console.error('Error checking availability:', error);
        return { sufficient: false, available: 0 };
    }
}

console.log('✅ Stock model loaded - GOLDEN RULE enforced with Raw Materials support');
