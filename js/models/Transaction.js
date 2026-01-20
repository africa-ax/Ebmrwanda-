// Transaction Model - Handles all buy/sell transactions

/**
 * Create a transaction (Sale or Purchase)
 * This is the core function that handles all business transactions
 * 
 * @param {Object} transactionData - Transaction details
 * @returns {Promise<Object>} Result with transaction and invoice info
 */
async function createTransaction(transactionData) {
    try {
        const {
            sellerId,
            buyerId,
            productId,
            quantity,
            pricePerUnit,
            buyerSellingPrice, // Price at which buyer will sell (buyer sets their own price)
            type // 'sale' or 'purchase'
        } = transactionData;

        // Validate required fields
        if (!sellerId || !buyerId || !productId || !quantity || !pricePerUnit) {
            return {
                success: false,
                error: 'Missing required transaction fields'
            };
        }

        // Validate quantity
        if (quantity <= VALIDATION.MIN_QUANTITY) {
            return {
                success: false,
                error: ERROR_MESSAGES.INVALID_QUANTITY
            };
        }

        // Validate price
        if (pricePerUnit < VALIDATION.MIN_PRICE) {
            return {
                success: false,
                error: 'Invalid price per unit'
            };
        }

        // Get seller and buyer data
        const [sellerDoc, buyerDoc] = await Promise.all([
            db.collection(COLLECTIONS.USERS).doc(sellerId).get(),
            db.collection(COLLECTIONS.USERS).doc(buyerId).get()
        ]);

        if (!sellerDoc.exists || !buyerDoc.exists) {
            return {
                success: false,
                error: 'Seller or buyer not found'
            };
        }

        const sellerData = sellerDoc.data();
        const buyerData = buyerDoc.data();

        // Verify business rules (who can sell to whom)
        if (!canSellTo(sellerData.role, buyerData.role)) {
            return {
                success: false,
                error: `${sellerData.role} cannot sell to ${buyerData.role}`
            };
        }

        // Check if seller has sufficient stock
        const availability = await checkStockAvailability(sellerId, productId, quantity);
        if (!availability.sufficient) {
            return {
                success: false,
                error: `${ERROR_MESSAGES.INSUFFICIENT_STOCK}. Available: ${availability.available}`
            };
        }

        // Get product details
        const product = await getProduct(productId);
        if (!product) {
            return {
                success: false,
                error: ERROR_MESSAGES.PRODUCT_NOT_FOUND
            };
        }

        // Calculate total amount
        const totalAmount = quantity * pricePerUnit;

        // Transfer stock from seller to buyer
        // Buyer sets their own selling price (or uses seller's price if not specified)
        const finalBuyerPrice = buyerSellingPrice !== undefined ? buyerSellingPrice : pricePerUnit;
        
        const stockTransferResult = await transferStock(
            sellerId,
            buyerId,
            productId,
            quantity,
            finalBuyerPrice
        );

        if (!stockTransferResult.success) {
            return {
                success: false,
                error: stockTransferResult.error
            };
        }

        // Create transaction record
        const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
        const transaction = {
            id: transactionRef.id,
            sellerId: sellerId,
            sellerName: sellerData.name,
            sellerRole: sellerData.role,
            buyerId: buyerId,
            buyerName: buyerData.name,
            buyerRole: buyerData.role,
            productId: productId,
            productName: product.name,
            productSKU: product.sku,
            productUnit: product.unit,
            quantity: quantity,
            pricePerUnit: pricePerUnit,
            totalAmount: totalAmount,
            type: type || TRANSACTION_TYPES.SALE,
            timestamp: getTimestamp(),
            status: 'completed'
        };

        await transactionRef.set(transaction);

        console.log('Transaction created successfully:', transaction.id);

        // Generate invoice automatically
        const invoiceResult = await generateInvoice(transaction);

        return {
            success: true,
            transaction: transaction,
            invoice: invoiceResult.success ? invoiceResult.invoice : null,
            message: SUCCESS_MESSAGES.TRANSACTION_COMPLETED
        };

    } catch (error) {
        console.error('Error creating transaction:', error);
        return {
            success: false,
            error: error.message || 'Failed to create transaction'
        };
    }
}

/**
 * Helper function to verify business rules
 */
function canSellTo(sellerRole, buyerRole) {
    const capabilities = ROLE_CAPABILITIES[sellerRole];
    if (!capabilities) return false;
    return capabilities.canSellTo.includes(buyerRole);
}

/**
 * Get transaction by ID
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object|null>} Transaction data or null
 */
async function getTransaction(transactionId) {
    try {
        const transactionDoc = await db.collection(COLLECTIONS.TRANSACTIONS).doc(transactionId).get();
        
        if (!transactionDoc.exists) {
            return null;
        }

        return {
            id: transactionDoc.id,
            ...transactionDoc.data()
        };
    } catch (error) {
        console.error('Error getting transaction:', error);
        return null;
    }
}

/**
 * Get all transactions for a user (as seller or buyer)
 * @param {string} userId - User ID
 * @param {string} role - 'seller', 'buyer', or 'all'
 * @returns {Promise<Array>} Array of transactions
 */
async function getUserTransactions(userId, role = 'all') {
    try {
        let query = db.collection(COLLECTIONS.TRANSACTIONS);

        if (role === 'seller') {
            query = query.where('sellerId', '==', userId);
        } else if (role === 'buyer') {
            query = query.where('buyerId', '==', userId);
        } else {
            // Get both seller and buyer transactions
            const [sellerTransactions, buyerTransactions] = await Promise.all([
                db.collection(COLLECTIONS.TRANSACTIONS)
                    .where('sellerId', '==', userId)
                    .orderBy('timestamp', 'desc')
                    .get(),
                db.collection(COLLECTIONS.TRANSACTIONS)
                    .where('buyerId', '==', userId)
                    .orderBy('timestamp', 'desc')
                    .get()
            ]);

            const transactions = [];
            
            sellerTransactions.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data(), userRole: 'seller' });
            });
            
            buyerTransactions.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data(), userRole: 'buyer' });
            });

            // Sort by timestamp
            transactions.sort((a, b) => {
                const aTime = a.timestamp?.toDate?.() || new Date(0);
                const bTime = b.timestamp?.toDate?.() || new Date(0);
                return bTime - aTime;
            });

            return transactions;
        }

        const snapshot = await query.orderBy('timestamp', 'desc').get();
        
        const transactions = [];
        snapshot.forEach(doc => {
            transactions.push({
                id: doc.id,
                ...doc.data(),
                userRole: role
            });
        });

        return transactions;

    } catch (error) {
        console.error('Error getting user transactions:', error);
        return [];
    }
}

/**
 * Get current user's transactions
 * @param {string} role - 'seller', 'buyer', or 'all'
 * @returns {Promise<Array>} Array of transactions
 */
async function getMyTransactions(role = 'all') {
    // Get the REAL Firebase authenticated user
    const authUser = firebase.auth().currentUser;
    
    if (!authUser) {
        console.warn('No authenticated user for transactions');
        return [];
    }

    return await getUserTransactions(authUser.uid, role); // USE REAL FIREBASE UID
}

/**
 * Get transactions for a specific product
 * @param {string} productId - Product ID
 * @returns {Promise<Array>} Array of transactions
 */
async function getProductTransactions(productId) {
    try {
        const snapshot = await db.collection(COLLECTIONS.TRANSACTIONS)
            .where('productId', '==', productId)
            .orderBy('timestamp', 'desc')
            .get();

        const transactions = [];
        snapshot.forEach(doc => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return transactions;

    } catch (error) {
        console.error('Error getting product transactions:', error);
        return [];
    }
}

/**
 * Get transaction statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Statistics
 */
async function getUserTransactionStats(userId) {
    try {
        const transactions = await getUserTransactions(userId, 'all');

        let totalSales = 0;
        let totalPurchases = 0;
        let salesCount = 0;
        let purchasesCount = 0;
        let salesRevenue = 0;
        let purchasesExpense = 0;

        transactions.forEach(t => {
            if (t.sellerId === userId) {
                salesCount++;
                salesRevenue += t.totalAmount;
                totalSales += t.quantity;
            }
            if (t.buyerId === userId) {
                purchasesCount++;
                purchasesExpense += t.totalAmount;
                totalPurchases += t.quantity;
            }
        });

        return {
            totalTransactions: transactions.length,
            salesCount,
            purchasesCount,
            totalSales,
            totalPurchases,
            salesRevenue,
            purchasesExpense,
            netRevenue: salesRevenue - purchasesExpense
        };

    } catch (error) {
        console.error('Error getting transaction stats:', error);
        return {
            totalTransactions: 0,
            salesCount: 0,
            purchasesCount: 0,
            totalSales: 0,
            totalPurchases: 0,
            salesRevenue: 0,
            purchasesExpense: 0,
            netRevenue: 0
        };
    }
}

/**
 * Cancel a transaction (if needed - complex operation)
 * WARNING: This reverses stock movements and should be used carefully
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Result
 */
async function cancelTransaction(transactionId) {
    try {
        // Get the REAL Firebase authenticated user
        const authUser = firebase.auth().currentUser;
        
        if (!authUser) {
            return {
                success: false,
                error: 'You must be logged in'
            };
        }

        const transaction = await getTransaction(transactionId);
        
        if (!transaction) {
            return {
                success: false,
                error: 'Transaction not found'
            };
        }

        if (transaction.status === 'cancelled') {
            return {
                success: false,
                error: 'Transaction already cancelled'
            };
        }

        // Only allow seller to cancel using REAL UID
        if (transaction.sellerId !== authUser.uid) {
            return {
                success: false,
                error: ERROR_MESSAGES.UNAUTHORIZED
            };
        }

        // Reverse stock transfer
        const reverseResult = await transferStock(
            transaction.buyerId, // Now buyer becomes seller
            transaction.sellerId, // And seller becomes buyer
            transaction.productId,
            transaction.quantity,
            transaction.pricePerUnit
        );

        if (!reverseResult.success) {
            return {
                success: false,
                error: 'Failed to reverse stock transfer: ' + reverseResult.error
            };
        }

        // Update transaction status
        await db.collection(COLLECTIONS.TRANSACTIONS).doc(transactionId).update({
            status: 'cancelled',
            cancelledAt: getTimestamp(),
            cancelledBy: currentUser.uid
        });

        console.log('Transaction cancelled:', transactionId);
        return {
            success: true,
            message: 'Transaction cancelled successfully'
        };

    } catch (error) {
        console.error('Error cancelling transaction:', error);
        return {
            success: false,
            error: error.message || 'Failed to cancel transaction'
        };
    }
}

console.log('Transaction model loaded');
