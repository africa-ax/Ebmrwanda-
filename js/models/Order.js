// Order Model - Manages buyer orders and seller confirmations

/**
 * Create order from cart
 * @param {string} sellerId - Seller ID
 * @param {Array} items - Array of {productId, stockId, quantity, pricePerUnit, vatRate}
 * @returns {Promise<Object>} Result with order info
 */
async function createOrder(sellerId, items) {
    try {
        if (!currentUser || !currentUserData) {
            return {
                success: false,
                error: 'User not authenticated'
            };
        }

        if (!items || items.length === 0) {
            return {
                success: false,
                error: 'No items in order'
            };
        }

        // Get seller info
        const sellerDoc = await db.collection(COLLECTIONS.USERS).doc(sellerId).get();
        if (!sellerDoc.exists) {
            return {
                success: false,
                error: 'Seller not found'
            };
        }
        const sellerData = sellerDoc.data();

        // Verify buyer can buy from seller
        const buyerCapabilities = ROLE_CAPABILITIES[currentUserData.role];
        if (!buyerCapabilities.canBuyFrom.includes(sellerData.role)) {
            return {
                success: false,
                error: `${currentUserData.role} cannot buy from ${sellerData.role}`
            };
        }

        // Calculate totals
        let subtotal = 0;
        let totalVAT = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await getProduct(item.productId);
            if (!product) {
                return {
                    success: false,
                    error: `Product not found: ${item.productId}`
                };
            }

            // Check stock availability
            const availability = await checkStockAvailability(sellerId, item.productId, item.quantity);
            if (!availability.sufficient) {
                return {
                    success: false,
                    error: `Insufficient stock for ${product.name}. Available: ${availability.available}`
                };
            }

            const itemSubtotal = item.quantity * item.pricePerUnit;
            const itemVAT = itemSubtotal * (item.vatRate / 100);
            
            subtotal += itemSubtotal;
            totalVAT += itemVAT;

            orderItems.push({
                productId: item.productId,
                stockId: item.stockId,
                productName: product.name,
                productSKU: product.sku,
                productUnit: product.unit,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit,
                vatRate: item.vatRate,
                itemSubtotal: itemSubtotal,
                itemVAT: itemVAT,
                itemTotal: itemSubtotal + itemVAT
            });
        }

        const totalAmount = subtotal + totalVAT;

        // Create order
        const orderRef = db.collection(COLLECTIONS.ORDERS).doc();
        const order = {
            id: orderRef.id,
            orderNumber: generateOrderNumber(),
            
            // Seller info
            sellerId: sellerId,
            sellerName: sellerData.name,
            sellerRole: sellerData.role,
            
            // Buyer info
            buyerId: currentUser.uid,
            buyerName: currentUserData.name,
            buyerRole: currentUserData.role,
            
            // Order items
            items: orderItems,
            
            // Totals
            subtotal: subtotal,
            totalVAT: totalVAT,
            totalAmount: totalAmount,
            
            // Status
            status: ORDER_STATUS.PENDING,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp(),
            
            // Additional
            buyerNotes: '',
            sellerNotes: ''
        };

        await orderRef.set(order);

        console.log('Order created:', order.id);
        return {
            success: true,
            order: order,
            message: 'Order placed successfully. Awaiting seller confirmation.'
        };

    } catch (error) {
        console.error('Error creating order:', error);
        return {
            success: false,
            error: error.message || 'Failed to create order'
        };
    }
}

/**
 * Get order by ID
 */
async function getOrder(orderId) {
    try {
        const orderDoc = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get();
        if (!orderDoc.exists) return null;
        return { id: orderDoc.id, ...orderDoc.data() };
    } catch (error) {
        console.error('Error getting order:', error);
        return null;
    }
}

/**
 * Get pending orders for seller
 */
async function getPendingOrdersForSeller(sellerId) {
    try {
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('sellerId', '==', sellerId)
            .where('status', '==', ORDER_STATUS.PENDING)
            .orderBy('createdAt', 'desc')
            .get();

        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        return orders;
    } catch (error) {
        console.error('Error getting pending orders:', error);
        return [];
    }
}

/**
 * Get my pending orders (as seller)
 */
async function getMyPendingOrders() {
    if (!currentUser) return [];
    return await getPendingOrdersForSeller(currentUser.uid);
}

/**
 * Get orders for buyer
 */
async function getOrdersForBuyer(buyerId, status = null) {
    try {
        let query = db.collection(COLLECTIONS.ORDERS).where('buyerId', '==', buyerId);
        if (status) {
            query = query.where('status', '==', status);
        }
        const snapshot = await query.orderBy('createdAt', 'desc').get();

        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        return orders;
    } catch (error) {
        console.error('Error getting buyer orders:', error);
        return [];
    }
}

/**
 * Get my orders (as buyer)
 */
async function getMyOrders(status = null) {
    if (!currentUser) return [];
    return await getOrdersForBuyer(currentUser.uid, status);
}

/**
 * Confirm order (seller only)
 * This triggers stock transfer and invoice generation
 * ⭐ UPDATED: Routes stock to Raw Materials for manufacturers
 */
async function confirmOrder(orderId, buyerSellingPrice = null) {
    try {
        const order = await getOrder(orderId);
        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        // Verify seller
        if (order.sellerId !== currentUser.uid) {
            return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
        }

        // Verify status
        if (order.status !== ORDER_STATUS.PENDING) {
            return { success: false, error: 'Order is not pending' };
        }

        // Process each item and transfer stock
        for (const item of order.items) {
            // Use provided resale price or default to the price they paid
            const finalBuyerPrice = buyerSellingPrice || item.pricePerUnit;
            
            // ⭐ CRITICAL: Determine stock type based on buyer role
            // If buyer is a manufacturer, stock goes to RAW_MATERIAL
            // Otherwise, stock goes to INVENTORY
            const stockType = order.buyerRole === ROLES.MANUFACTURER 
                ? STOCK_TYPES.RAW_MATERIAL 
                : STOCK_TYPES.INVENTORY;
            
            console.log(`🔄 Transferring stock for ${item.productName}:`);
            console.log(`   Buyer Role: ${order.buyerRole}`);
            console.log(`   Stock Type: ${stockType}`);
            
            const transferResult = await transferStockWithType(
                order.sellerId,
                order.buyerId,
                item.productId,
                item.quantity,
                finalBuyerPrice,
                stockType
            );

            if (!transferResult.success) {
                return {
                    success: false,
                    error: `Failed to transfer stock for ${item.productName}: ${transferResult.error}`
                };
            }
        }

        // Create transaction record
        const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
        const transaction = {
            id: transactionRef.id,
            orderId: order.id,
            sellerId: order.sellerId,
            sellerName: order.sellerName,
            sellerRole: order.sellerRole,
            buyerId: order.buyerId,
            buyerName: order.buyerName,
            buyerRole: order.buyerRole,
            items: order.items,
            subtotal: order.subtotal,
            totalVAT: order.totalVAT,
            totalAmount: order.totalAmount,
            type: TRANSACTION_TYPES.SALE,
            timestamp: getTimestamp(),
            status: 'completed'
        };
        await transactionRef.set(transaction);

        // Generate invoice
        const invoiceResult = await generateInvoiceFromOrder(order, transaction.id);

        // Update order status
        await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
            status: ORDER_STATUS.CONFIRMED,
            confirmedAt: getTimestamp(),
            transactionId: transaction.id,
            invoiceId: invoiceResult.success ? invoiceResult.invoice.id : null,
            updatedAt: getTimestamp()
        });

        console.log('✅ Order confirmed:', orderId);
        console.log(`   Stock routed to: ${order.buyerRole === ROLES.MANUFACTURER ? 'Raw Materials' : 'Inventory'}`);
        
        return {
            success: true,
            transaction: transaction,
            invoice: invoiceResult.success ? invoiceResult.invoice : null,
            message: 'Order confirmed successfully'
        };

    } catch (error) {
        console.error('Error confirming order:', error);
        return {
            success: false,
            error: error.message || 'Failed to confirm order'
        };
    }
}

/**
 * Reject order (seller only)
 */
async function rejectOrder(orderId, reason = '') {
    try {
        const order = await getOrder(orderId);
        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        if (order.sellerId !== currentUser.uid) {
            return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
        }

        if (order.status !== ORDER_STATUS.PENDING) {
            return { success: false, error: 'Order is not pending' };
        }

        await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
            status: ORDER_STATUS.REJECTED,
            rejectedAt: getTimestamp(),
            rejectionReason: reason,
            updatedAt: getTimestamp()
        });

        console.log('Order rejected:', orderId);
        return {
            success: true,
            message: 'Order rejected'
        };

    } catch (error) {
        console.error('Error rejecting order:', error);
        return {
            success: false,
            error: error.message || 'Failed to reject order'
        };
    }
}

/**
 * Cancel order (buyer only, if still pending)
 */
async function cancelOrder(orderId) {
    try {
        const order = await getOrder(orderId);
        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        if (order.buyerId !== currentUser.uid) {
            return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
        }

        if (order.status !== ORDER_STATUS.PENDING) {
            return { success: false, error: 'Can only cancel pending orders' };
        }

        await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
            status: ORDER_STATUS.CANCELLED,
            cancelledAt: getTimestamp(),
            updatedAt: getTimestamp()
        });

        return { success: true, message: 'Order cancelled' };

    } catch (error) {
        console.error('Error cancelling order:', error);
        return { success: false, error: error.message || 'Failed to cancel order' };
    }
}

/**
 * Generate invoice from order
 */
async function generateInvoiceFromOrder(order, transactionId) {
    try {
        const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc();
        const invoice = {
            id: invoiceRef.id,
            invoiceNumber: generateInvoiceNumber(), // Ensure this helper exists in Invoice.js
            orderId: order.id,
            transactionId: transactionId,
            
            sellerId: order.sellerId,
            sellerName: order.sellerName,
            sellerRole: order.sellerRole,
            
            buyerId: order.buyerId,
            buyerName: order.buyerName,
            buyerRole: order.buyerRole,
            
            items: order.items,
            
            subtotal: order.subtotal,
            totalVAT: order.totalVAT,
            totalAmount: order.totalAmount,
            
            status: INVOICE_STATUS.GENERATED,
            generatedAt: getTimestamp(),
            dueDate: calculateDueDate(30),
            
            notes: '',
            paymentStatus: 'pending'
        };

        await invoiceRef.set(invoice);

        console.log('Invoice generated from order:', invoice.id);
        return { success: true, invoice: invoice };

    } catch (error) {
        console.error('Error generating invoice from order:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate order number
 */
function generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    return `ORD-${year}${month}${day}-${random}`;
}

console.log('✅ Order model loaded - with Raw Materials support');
