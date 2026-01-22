// Stock Model - LEGACY SAFE VERSION
// Handles both 'inventory' and 'rawMaterial' without requiring new complex indexes

/**
 * 🔒 GOLDEN RULE ENFORCER
 * Add or update stock for a product
 */
async function addOrUpdateStock(ownerId, productId, quantity, sellingPrice, type = STOCK_TYPES.INVENTORY) {
    try {
        if (!ownerId || !productId) {
            return { success: false, error: 'Owner ID and Product ID are required' };
        }

        const product = await getProduct(productId);
        if (!product) {
            return { success: false, error: 'Product not found' };
        }

        // We query by Owner and Product only to remain compatible with existing indexes
        const stockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', ownerId)
            .where('productId', '==', productId)
            .get();

        // Look for a document that matches the type (or has no type if looking for inventory)
        const stockDoc = stockQuery.docs.find(doc => {
            const data = doc.data();
            if (type === STOCK_TYPES.INVENTORY) {
                return data.type === STOCK_TYPES.INVENTORY || !data.type;
            }
            return data.type === type;
        });

        if (stockDoc) {
            const updateData = {
                quantity: stockDoc.data().quantity + quantity,
                updatedAt: getTimestamp()
            };
            if (sellingPrice !== undefined) {
                updateData.sellingPrice = sellingPrice;
            }
            await db.collection(COLLECTIONS.STOCK).doc(stockDoc.id).update(updateData);
            return { success: true, id: stockDoc.id };
        } else {
            const newStockRef = db.collection(COLLECTIONS.STOCK).doc();
            const stockData = {
                id: newStockRef.id,
                ownerId: ownerId,
                productId: productId,
                productName: product.name,
                productSKU: product.sku,
                productUnit: product.unit,
                quantity: quantity,
                sellingPrice: sellingPrice || 0,
                type: type, // New items get the explicit type
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            };
            await newStockRef.set(stockData);
            return { success: true, id: newStockRef.id };
        }
    } catch (error) {
        console.error('Error in addOrUpdateStock:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Transfer stock from a seller to a buyer
 * Logic: If buyer is Manufacturer, store as rawMaterial. Otherwise, inventory.
 */
async function transferStock(sellerId, buyerId, productId, quantity, buyerPrice) {
    const batch = db.batch();
    
    try {
        // 1. Get Seller's Stock (Find inventory or untyped items)
        const sellerSnapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .get();

        const sellerStockDoc = sellerSnapshot.docs.find(doc => {
            const d = doc.data();
            return d.type === STOCK_TYPES.INVENTORY || !d.type;
        });

        if (!sellerStockDoc) throw new Error('Seller stock not found');
        const sellerStockData = sellerStockDoc.data();

        // 2. Determine Buyer's Target Type
        const buyerDoc = await db.collection(COLLECTIONS.USERS).doc(buyerId).get();
        const buyerData = buyerDoc.data();
        const targetType = (buyerData && buyerData.role === ROLES.MANUFACTURER) 
            ? STOCK_TYPES.RAW_MATERIAL 
            : STOCK_TYPES.INVENTORY;

        // 3. Get Buyer's existing stock for that specific target type
        const buyerSnapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', buyerId)
            .where('productId', '==', productId)
            .get();

        const buyerStockDoc = buyerSnapshot.docs.find(doc => doc.data().type === targetType);

        // 4. Update Seller
        const newSellerQty = sellerStockData.quantity - quantity;
        if (newSellerQty <= 0) {
            batch.delete(sellerStockDoc.ref);
        } else {
            batch.update(sellerStockDoc.ref, {
                quantity: newSellerQty,
                updatedAt: getTimestamp()
            });
        }

        // 5. Update or Create Buyer Stock
        if (buyerStockDoc) {
            batch.update(buyerStockDoc.ref, {
                quantity: buyerStockDoc.data().quantity + quantity,
                updatedAt: getTimestamp()
            });
        } else {
            const newRef = db.collection(COLLECTIONS.STOCK).doc();
            batch.set(newRef, {
                id: newRef.id,
                ownerId: buyerId,
                productId,
                productName: sellerStockData.productName,
                productSKU: sellerStockData.productSKU,
                productUnit: sellerStockData.productUnit,
                quantity,
                sellingPrice: buyerPrice || 0,
                type: targetType,
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            });
        }

        await batch.commit();
        return { success: true };

    } catch (error) {
        console.error('Transfer Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if a seller has enough stock
 */
async function checkStockAvailability(sellerId, productId, requestedQty) {
    try {
        const snapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .get();

        const stockDoc = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.type === STOCK_TYPES.INVENTORY || !data.type;
        });

        if (!stockDoc) return { sufficient: false, available: 0 };

        const stockData = stockDoc.data();
        return {
            sufficient: stockData.quantity >= requestedQty,
            available: stockData.quantity
        };
    } catch (error) {
        return { sufficient: false, available: 0 };
    }
}

/**
 * Get stock for current user by type
 */
async function getMyStock(type = STOCK_TYPES.INVENTORY) {
    try {
        const snapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', firebase.auth().currentUser.uid)
            .get();

        // Filter by type in JS to avoid index issues
        return snapshot.docs
            .map(doc => doc.data())
            .filter(data => {
                if (type === STOCK_TYPES.INVENTORY) {
                    return data.type === STOCK_TYPES.INVENTORY || !data.type;
                }
                return data.type === type;
            });
    } catch (error) {
        return [];
    }
    }
