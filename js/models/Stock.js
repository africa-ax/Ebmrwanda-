// Stock Model - ENFORCES THE GOLDEN RULE
// ONE ownerId + ONE productId + ONE type = ONE stock document ONLY

/**
 * 🔒 GOLDEN RULE ENFORCER
 * Add or update stock for a product
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

        const product = await getProduct(productId);
        if (!product) {
            return { success: false, error: 'Product not found' };
        }

        // Search for existing stock by Owner, Product, AND Type
        const stockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', ownerId)
            .where('productId', '==', productId)
            .where('type', '==', type)
            .limit(1)
            .get();

        if (!stockQuery.empty) {
            const stockDoc = stockQuery.docs[0];
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
                type: type,
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
 * UPDATED: Automatically detects if buyer is a Manufacturer to store as Raw Material
 */
async function transferStock(sellerId, buyerId, productId, quantity, buyerPrice) {
    const batch = db.batch();
    
    try {
        // 1. Get Seller's Stock (Must be from their inventory)
        const sellerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', sellerId)
            .where('productId', '==', productId)
            .where('type', '==', STOCK_TYPES.INVENTORY)
            .limit(1)
            .get();

        if (sellerStockQuery.empty) {
            throw new Error('Seller does not have this product in inventory');
        }

        const sellerStockDoc = sellerStockQuery.docs[0];
        const sellerStockData = sellerStockDoc.data();

        if (sellerStockData.quantity < quantity) {
            throw new Error('Insufficient stock for transfer');
        }

        // 2. Determine Buyer's Stock Type based on their Role
        const buyerDoc = await db.collection(COLLECTIONS.USERS).doc(buyerId).get();
        const buyerData = buyerDoc.data();
        
        // If buyer is a Manufacturer, the incoming product is a Raw Material
        const targetType = (buyerData && buyerData.role === ROLES.MANUFACTURER) 
            ? STOCK_TYPES.RAW_MATERIAL 
            : STOCK_TYPES.INVENTORY;

        // 3. Get Buyer's existing stock of that specific type
        const buyerStockQuery = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', buyerId)
            .where('productId', '==', productId)
            .where('type', '==', targetType)
            .limit(1)
            .get();

        // 4. Update Seller (Decrease Inventory)
        const newSellerQuantity = sellerStockData.quantity - quantity;
        if (newSellerQuantity === 0) {
            batch.delete(sellerStockDoc.ref);
        } else {
            batch.update(sellerStockDoc.ref, {
                quantity: newSellerQuantity,
                updatedAt: getTimestamp()
            });
        }

        // 5. Update or Create Buyer Stock
        if (!buyerStockQuery.empty) {
            const buyerStockDoc = buyerStockQuery.docs[0];
            batch.update(buyerStockDoc.ref, {
                quantity: buyerStockDoc.data().quantity + quantity,
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
                sellingPrice: buyerPrice || 0,
                type: targetType, // Correctly categorized
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

/**
 * Check if a seller has enough stock for an order
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

/**
 * Get stock for current user by type
 */
async function getMyStock(type = STOCK_TYPES.INVENTORY) {
    try {
        const snapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', firebase.auth().currentUser.uid)
            .where('type', '==', type)
            .get();

        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error getting stock:', error);
        return [];
    }
}

console.log('Stock model loaded - Manufacturer purchases now routed to Raw Materials');
