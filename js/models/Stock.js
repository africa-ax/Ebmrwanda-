// Stock Model Updates

/**
 * Get all stock owned by a specific seller (e.g., Manufacturer)
 * Used by Buyers/Distributors during purchase
 */
async function getOwnerStock(ownerId, type = null) {
    try {
        if (!ownerId) {
            console.error("getOwnerStock: ownerId is missing");
            return [];
        }

        // Base query: get stock for this specific owner
        let query = db.collection(COLLECTIONS.STOCK).where('ownerId', '==', ownerId);

        // Filter by type (usually 'inventory' for purchases)
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

        // 🛠️ SORT LOCALLY: This prevents the app from crashing if 
        // the composite index isn't finished building yet.
        return stockItems.sort((a, b) => {
            const dateA = a.updatedAt?.seconds || 0;
            const dateB = b.updatedAt?.seconds || 0;
            return dateB - dateA;
        });

    } catch (error) {
        console.error('❌ Error in getOwnerStock:', error);
        
        // Detailed logging for debugging
        if (error.message.includes('index')) {
            console.warn('⚠️ MISSING INDEX: Copy the link from the browser console error above to create the required Firestore index.');
        }
        return [];
    }
}

/**
 * Check specifically if a seller has enough stock for an order
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
