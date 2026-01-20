// Stock Model - ENFORCES THE GOLDEN RULE
// ONE ownerId + ONE productId = ONE stock document ONLY

/**
 * 🔒 GOLDEN RULE ENFORCER
 */
async function addOrUpdateStock(ownerId, productId, quantity, sellingPrice, type = STOCK_TYPES.INVENTORY) {
    try {
        if (!ownerId || !productId) {
            return { success: false, error: 'Owner ID and Product ID are required' };
        }

        const product = await getProduct(productId);
        if (!product) {
            return { success: false, error: ERROR_MESSAGES.PRODUCT_NOT_FOUND };
        }

        const existingStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', ownerId)
            .where('productId', '==', productId)
            .where('type', '==', type)
            .limit(1)
            .get();

        if (!existingStockQuery.empty) {
            const stockDoc = existingStockQuery.docs[0];
            const existingStock = stockDoc.data();
            const newQuantity = existingStock.quantity + quantity;

            if (newQuantity <= 0) {
                await db.collection(COLLECTIONS.STOCK).doc(stockDoc.id).delete();
                return { success: true, action: 'deleted', finalQuantity: 0 };
            }

            const updates = {
                quantity: newQuantity,
                updatedAt: getTimestamp(),
                productName: product.name,
                productSKU: product.sku,
                productUnit: product.unit
            };

            if (sellingPrice !== undefined) updates.sellingPrice = sellingPrice;

            await db.collection(COLLECTIONS.STOCK).doc(stockDoc.id).update(updates);

            return {
                success: true,
                action: 'updated',
                stockId: stockDoc.id,
                finalQuantity: newQuantity
            };

        } else {
            if (quantity < 0) return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_STOCK };
            if (sellingPrice === undefined) return { success: false, error: 'Selling price is required' };

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
            return { success: true, action: 'created', stockId: stockRef.id, finalQuantity: quantity };
        }
    } catch (error) {
        console.error('Error in addOrUpdateStock:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current user's stock (Used by Manufacturer)
 */
async function getMyStock(type = null) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) return [];

    try {
        let query = db.collection(COLLECTIONS.STOCK).where('ownerId', '==', authUser.uid);
        if (type) query = query.where('type', '==', type);

        const snapshot = await query.get();
        const stockItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort locally to prevent "Error loading products" if index is missing
        return stockItems.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    } catch (error) {
        console.error('Error getting my stock:', error);
        return [];
    }
}

/**
 * Get all stock owned by a specific seller (Used by Buyers/Distributors/Retailers)
 * FIX: This function was missing in the previous files, causing the purchase view error.
 */
async function getOwnerStock(ownerId, type = null) {
    try {
        if (!ownerId) return [];

        let query = db.collection(COLLECTIONS.STOCK).where('ownerId', '==', ownerId);
        if (type) query = query.where('type', '==', type);

        const snapshot = await query.get();
        const stockItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Local sort to avoid requiring a composite index immediately
        return stockItems.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    } catch (error) {
        console.error('Error in getOwnerStock:', error);
        return [];
    }
}

/**
 * Check stock availability before ordering
 */
async function checkStockAvailability(sellerId, productId, requestedQty) {
    try {
        const snapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .where('type', '==', STOCK_TYPES.INVENTORY)
            .limit(1)
            .get();

        if (snapshot.empty) return { sufficient: false, available: 0 };

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

/**
 * Transfer stock from a seller to a buyer
 * This is used during order confirmation to move inventory
 */
async function transferStock(sellerId, buyerId, productId, quantity, buyerPrice) {
    const batch = db.batch();
    
    try {
        // 1. Find Seller's Stock
        const sellerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .limit(1)
            .get();

        if (sellerStockQuery.empty) {
            return { success: false, error: 'Seller does not have this product in stock' };
        }

        const sellerStockDoc = sellerStockQuery.docs[0];
        const sellerStockData = sellerStockDoc.data();

        if (sellerStockData.quantity < quantity) {
            return { success: false, error: 'Insufficient seller stock' };
        }

        // 2. Find or Prepare Buyer's Stock
        const buyerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', buyerId)
            .where('productId', '==', productId)
            .limit(1)
            .get();

        // 3. Update Seller (Decrease)
        const newSellerQty = sellerStockData.quantity - quantity;
        if (newSellerQty === 0) {
            batch.delete(sellerStockDoc.ref);
        } else {
            batch.update(sellerStockDoc.ref, {
                quantity: newSellerQty,
                updatedAt: getTimestamp()
            });
        }

        // 4. Update or Create Buyer Stock (Increase)
        if (!buyerStockQuery.empty) {
            const buyerStockDoc = buyerStockQuery.docs[0];
            batch.update(buyerStockDoc.ref, {
                quantity: buyerStockDoc.data().quantity + quantity,
                sellingPrice: buyerPrice, // Update to price they just paid
                updatedAt: getTimestamp()
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
                sellingPrice: buyerPrice,
                type: STOCK_TYPES.INVENTORY,
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            });
        }

        // Execute all changes at once
        await batch.commit();
        return { success: true };

    } catch (error) {
        console.error('Transfer stock error:', error);
        return { success: false, error: error.message };
    }
    }
        
