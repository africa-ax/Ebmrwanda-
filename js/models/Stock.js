// Stock Model - ENFORCES THE GOLDEN RULE
// ONE ownerId + ONE productId = ONE stock document ONLY

/**
 * 🔒 GOLDEN RULE ENFORCER
 * Add or update stock for a product
 */
async function addOrUpdateStock(ownerId, productId, quantity, sellingPrice, type = STOCK_TYPES.INVENTORY) {
    try {
        if (!ownerId || !productId) {
            return { success: false, error: 'Owner ID and Product ID are required' };
        }

        if (typeof quantity !== 'number' || (quantity === 0 && sellingPrice === undefined)) {
            return { success: false, error: ERROR_MESSAGES.INVALID_QUANTITY };
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
            return { success: true, action: 'updated', stockId: stockDoc.id, finalQuantity: newQuantity };
        } else {
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
 * Transfer stock from a seller to a buyer
 * UPDATED: Automatically categorizes as Raw Material if the buyer is a Manufacturer
 */
async function transferStock(sellerId, buyerId, productId, quantity, buyerPrice) {
    const batch = db.batch();
    try {
        const sellerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .limit(1).get();

        if (sellerStockQuery.empty) throw new Error('Seller does not have this product in stock');
        const sellerStockDoc = sellerStockQuery.docs[0];
        const sellerStockData = sellerStockDoc.data();

        // Check buyer role to determine target stock type
        const buyerDoc = await db.collection(COLLECTIONS.USERS).doc(buyerId).get();
        const targetStockType = (buyerDoc.data().role === ROLES.MANUFACTURER) 
            ? STOCK_TYPES.RAW_MATERIAL : STOCK_TYPES.INVENTORY;

        const buyerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', buyerId)
            .where('productId', '==', productId)
            .where('type', '==', targetStockType)
            .limit(1).get();

        // Update Seller (Decrease)
        const newSellerQty = sellerStockData.quantity - quantity;
        if (newSellerQty === 0) batch.delete(sellerStockDoc.ref);
        else batch.update(sellerStockDoc.ref, { quantity: newSellerQty, updatedAt: getTimestamp() });

        // Update or Create Buyer Stock (Increase)
        if (!buyerStockQuery.empty) {
            batch.update(buyerStockQuery.docs[0].ref, {
                quantity: buyerStockQuery.docs[0].data().quantity + quantity,
                updatedAt: getTimestamp()
            });
        } else {
            const newRef = db.collection(COLLECTIONS.STOCK).doc();
            batch.set(newRef, {
                id: newRef.id, ownerId: buyerId, productId: productId,
                productName: sellerStockData.productName, productSKU: sellerStockData.productSKU,
                productUnit: sellerStockData.productUnit, quantity: quantity,
                sellingPrice: buyerPrice, type: targetStockType,
                createdAt: getTimestamp(), updatedAt: getTimestamp()
            });
        }
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error('Transfer stock error:', error);
        return { success: false, error: error.message };
    }
}

async function checkStockAvailability(sellerId, productId, requestedQty) {
    try {
        const snapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .where('type', '==', STOCK_TYPES.INVENTORY)
            .limit(1).get();

        if (snapshot.empty) return { sufficient: false, available: 0 };
        const stockData = snapshot.docs[0].data();
        return { sufficient: stockData.quantity >= requestedQty, available: stockData.quantity };
    } catch (error) {
        return { sufficient: false, available: 0 };
    }
}

async function getMyStock(type = null) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) return [];
    try {
        let query = db.collection(COLLECTIONS.STOCK).where('ownerId', '==', authUser.uid);
        if (type) query = query.where('type', '==', type);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { return []; }
        }
