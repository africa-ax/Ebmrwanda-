// Invoice Model - Automatic invoice generation from stock and product data

/**
 * Generate invoice from transaction
 * NO RETYPING - All data comes from transaction, stock, and product
 * 
 * @param {Object} transaction - Transaction object
 * @returns {Promise<Object>} Result with invoice
 */
async function generateInvoice(transaction) {
    try {
        if (!transaction || !transaction.id) {
            return {
                success: false,
                error: 'Invalid transaction data'
            };
        }

        // Get product details for complete information
        const product = await getProduct(transaction.productId);
        if (!product) {
            return {
                success: false,
                error: ERROR_MESSAGES.PRODUCT_NOT_FOUND
            };
        }

        // Create invoice document
        const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc();
        const invoice = {
            id: invoiceRef.id,
            invoiceNumber: generateInvoiceNumber(),
            transactionId: transaction.id,
            
            // Seller information
            sellerId: transaction.sellerId,
            sellerName: transaction.sellerName,
            sellerRole: transaction.sellerRole,
            
            // Buyer information
            buyerId: transaction.buyerId,
            buyerName: transaction.buyerName,
            buyerRole: transaction.buyerRole,
            
            // Invoice items - All data from product and transaction (NO RETYPING)
            items: [{
                productId: product.id,
                productName: product.name, // From product
                productSKU: product.sku, // From product
                unit: product.unit, // From product
                quantity: transaction.quantity, // From transaction
                pricePerUnit: transaction.pricePerUnit, // From transaction
                totalPrice: transaction.totalAmount // Calculated from transaction
            }],
            
            // Totals
            subtotal: transaction.totalAmount,
            tax: 0, // Can be calculated based on business rules
            totalAmount: transaction.totalAmount,
            
            // Status and timestamps
            status: INVOICE_STATUS.GENERATED,
            generatedAt: getTimestamp(),
            dueDate: calculateDueDate(30), // 30 days default
            
            // Additional info
            notes: '',
            paymentStatus: 'pending'
        };

        await invoiceRef.set(invoice);

        // Update transaction with invoice ID
        await db.collection(COLLECTIONS.TRANSACTIONS).doc(transaction.id).update({
            invoiceId: invoice.id
        });

        console.log('Invoice generated successfully:', invoice.id);
        return {
            success: true,
            invoice: invoice,
            message: SUCCESS_MESSAGES.INVOICE_GENERATED
        };

    } catch (error) {
        console.error('Error generating invoice:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate invoice'
        };
    }
}

/**
 * Generate invoice for multiple products in one transaction
 * @param {Object} transactionData - Contains multiple items
 * @returns {Promise<Object>} Result with invoice
 */
async function generateMultiItemInvoice(transactionData) {
    try {
        const {
            sellerId,
            sellerName,
            sellerRole,
            buyerId,
            buyerName,
            buyerRole,
            items, // Array of { productId, quantity, pricePerUnit }
            notes
        } = transactionData;

        if (!items || items.length === 0) {
            return {
                success: false,
                error: 'No items provided'
            };
        }

        // Process each item and get product details
        const invoiceItems = [];
        let subtotal = 0;

        for (const item of items) {
            const product = await getProduct(item.productId);
            if (!product) {
                return {
                    success: false,
                    error: `Product not found: ${item.productId}`
                };
            }

            const totalPrice = item.quantity * item.pricePerUnit;
            subtotal += totalPrice;

            invoiceItems.push({
                productId: product.id,
                productName: product.name,
                productSKU: product.sku,
                unit: product.unit,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit,
                totalPrice: totalPrice
            });
        }

        // Create invoice
        const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc();
        const invoice = {
            id: invoiceRef.id,
            invoiceNumber: generateInvoiceNumber(),
            
            sellerId,
            sellerName,
            sellerRole,
            buyerId,
            buyerName,
            buyerRole,
            
            items: invoiceItems,
            
            subtotal: subtotal,
            tax: 0,
            totalAmount: subtotal,
            
            status: INVOICE_STATUS.GENERATED,
            generatedAt: getTimestamp(),
            dueDate: calculateDueDate(30),
            
            notes: notes || '',
            paymentStatus: 'pending'
        };

        await invoiceRef.set(invoice);

        console.log('Multi-item invoice generated:', invoice.id);
        return {
            success: true,
            invoice: invoice
        };

    } catch (error) {
        console.error('Error generating multi-item invoice:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate invoice'
        };
    }
}

/**
 * Get invoice by ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object|null>} Invoice data or null
 */
async function getInvoice(invoiceId) {
    try {
        const invoiceDoc = await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).get();
        
        if (!invoiceDoc.exists) {
            return null;
        }

        return {
            id: invoiceDoc.id,
            ...invoiceDoc.data()
        };
    } catch (error) {
        console.error('Error getting invoice:', error);
        return null;
    }
}

/**
 * Get all invoices for a user (as seller or buyer)
 * @param {string} userId - User ID
 * @param {string} role - 'seller', 'buyer', or 'all'
 * @returns {Promise<Array>} Array of invoices
 */
async function getUserInvoices(userId, role = 'all') {
    try {
        let invoices = [];

        if (role === 'seller' || role === 'all') {
            const sellerSnapshot = await db.collection(COLLECTIONS.INVOICES)
                .where('sellerId', '==', userId)
                .orderBy('generatedAt', 'desc')
                .get();
            
            sellerSnapshot.forEach(doc => {
                invoices.push({
                    id: doc.id,
                    ...doc.data(),
                    userRole: 'seller'
                });
            });
        }

        if (role === 'buyer' || role === 'all') {
            const buyerSnapshot = await db.collection(COLLECTIONS.INVOICES)
                .where('buyerId', '==', userId)
                .orderBy('generatedAt', 'desc')
                .get();
            
            buyerSnapshot.forEach(doc => {
                invoices.push({
                    id: doc.id,
                    ...doc.data(),
                    userRole: 'buyer'
                });
            });
        }

        // Sort by date if getting both
        if (role === 'all') {
            invoices.sort((a, b) => {
                const aTime = a.generatedAt?.toDate?.() || new Date(0);
                const bTime = b.generatedAt?.toDate?.() || new Date(0);
                return bTime - aTime;
            });
        }

        return invoices;

    } catch (error) {
        console.error('Error getting user invoices:', error);
        return [];
    }
}

/**
 * Get current user's invoices
 * @param {string} role - 'seller', 'buyer', or 'all'
 * @returns {Promise<Array>} Array of invoices
 */
async function getMyInvoices(role = 'all') {
    if (!currentUser) {
        return [];
    }

    return await getUserInvoices(currentUser.uid, role);
}

/**
 * Update invoice status
 * @param {string} invoiceId - Invoice ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Result
 */
async function updateInvoiceStatus(invoiceId, status) {
    try {
        // Verify status is valid
        if (!Object.values(INVOICE_STATUS).includes(status)) {
            return {
                success: false,
                error: 'Invalid invoice status'
            };
        }

        await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).update({
            status: status,
            updatedAt: getTimestamp()
        });

        console.log('Invoice status updated:', invoiceId, status);
        return {
            success: true,
            message: 'Invoice status updated'
        };

    } catch (error) {
        console.error('Error updating invoice status:', error);
        return {
            success: false,
            error: error.message || 'Failed to update invoice status'
        };
    }
}

/**
 * Mark invoice as paid
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Result
 */
async function markInvoiceAsPaid(invoiceId) {
    try {
        const invoice = await getInvoice(invoiceId);
        
        if (!invoice) {
            return {
                success: false,
                error: 'Invoice not found'
            };
        }

        // Only seller or buyer can mark as paid
        if (invoice.sellerId !== currentUser.uid && invoice.buyerId !== currentUser.uid) {
            return {
                success: false,
                error: ERROR_MESSAGES.UNAUTHORIZED
            };
        }

        await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).update({
            paymentStatus: 'paid',
            status: INVOICE_STATUS.PAID,
            paidAt: getTimestamp(),
            updatedAt: getTimestamp()
        });

        console.log('Invoice marked as paid:', invoiceId);
        return {
            success: true,
            message: 'Invoice marked as paid'
        };

    } catch (error) {
        console.error('Error marking invoice as paid:', error);
        return {
            success: false,
            error: error.message || 'Failed to mark invoice as paid'
        };
    }
}

/**
 * Generate invoice number (format: INV-YYYYMMDD-XXXXX)
 * @returns {string} Invoice number
 */
function generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    
    return `INV-${year}${month}${day}-${random}`;
}

/**
 * Calculate due date
 * @param {number} daysFromNow - Number of days from today
 * @returns {Timestamp} Firestore timestamp
 */
function calculateDueDate(daysFromNow) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysFromNow);
    return firebase.firestore.Timestamp.fromDate(dueDate);
}

/**
 * Generate printable invoice HTML
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<string>} HTML string
 */
async function generatePrintableInvoice(invoiceId) {
    const invoice = await getInvoice(invoiceId);
    
    if (!invoice) {
        return '<p>Invoice not found</p>';
    }

    const generatedDate = invoice.generatedAt?.toDate?.() || new Date();
    const dueDate = invoice.dueDate?.toDate?.() || new Date();

    let itemsHTML = '';
    invoice.items.forEach(item => {
        itemsHTML += `
            <tr>
                <td>${item.productName}</td>
                <td>${item.productSKU}</td>
                <td>${item.quantity} ${item.unit}</td>
                <td>${item.pricePerUnit.toFixed(2)}</td>
                <td>${item.totalPrice.toFixed(2)}</td>
            </tr>
        `;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice ${invoice.invoiceNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .invoice-header { text-align: center; margin-bottom: 30px; }
                .invoice-details { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #667eea; color: white; }
                .total { text-align: right; font-size: 1.2em; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="invoice-header">
                <h1>INVOICE</h1>
                <p>${invoice.invoiceNumber}</p>
            </div>
            <div class="invoice-details">
                <p><strong>From:</strong> ${invoice.sellerName} (${invoice.sellerRole})</p>
                <p><strong>To:</strong> ${invoice.buyerName} (${invoice.buyerRole})</p>
                <p><strong>Date:</strong> ${generatedDate.toLocaleDateString()}</p>
                <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Price/Unit</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>
            <p class="total">Total Amount: ${invoice.totalAmount.toFixed(2)}</p>
            <p><strong>Status:</strong> ${invoice.status}</p>
            ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
        </body>
        </html>
    `;
}

console.log('Invoice model loaded');
          
