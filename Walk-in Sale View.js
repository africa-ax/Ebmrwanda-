// Walk-in Sale View - For Retailers to help customers without smartphones

let walkInCart = [];

/**
 * Show Walk-in Sale Page (Retailers Only)
 */
async function showWalkInSalePage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    // Only retailers should access this
    if (currentUserData.role !== ROLES.RETAILER) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h2 style="color: #f44336;">Access Denied</h2>
                <p>Only retailers can access walk-in customer sales.</p>
                <button class="btn-primary" onclick="loadDashboard('${currentUserData.role}')">Back to Dashboard</button>
            </div>
        `;
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">🛍️ Walk-in Customer Sale</h2>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-success" onclick="viewWalkInCart()" id="walkInCartBtn">
                        🛒 Cart (<span id="walkInCartCount">0</span>)
                    </button>
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <!-- Customer Info Section -->
            <div style="background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                <h3 style="color: #667eea; margin-bottom: 1rem;">Customer Information (Optional)</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label>Customer Name</label>
                        <input type="text" id="walkInCustomerName" placeholder="Enter customer name (optional)" 
                               style="width: 100%; padding: 0.8rem; border: 2px solid #e0e0e0; border-radius: 6px;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label>Customer Phone</label>
                        <input type="tel" id="walkInCustomerPhone" placeholder="Enter phone number (optional)" 
                               style="width: 100%; padding: 0.8rem; border: 2px solid #e0e0e0; border-radius: 6px;">
                    </div>
                </div>
                <small style="color: #666; display: block; margin-top: 0.5rem;">
                    💡 Customer info is optional but helps with record keeping
                </small>
            </div>

            <!-- Search Products -->
            <div style="margin-bottom: 1.5rem;">
                <input type="text" 
                       id="walkInProductSearch" 
                       placeholder="🔍 Search your inventory by product name or SKU..." 
                       onkeyup="filterWalkInProducts()" 
                       style="width: 100%; padding: 0.8rem; border: 2px solid #eee; border-radius: 8px; font-size: 1rem;">
            </div>

            <!-- Available Products from Inventory -->
            <div id="walkInProductsList">
                <div style="text-align: center; padding: 3rem;">
                    <div class="spinner"></div>
                    <p>Loading your inventory...</p>
                </div>
            </div>
        </div>
    `;

    // Load retailer's inventory
    await loadWalkInProducts();
    updateWalkInCartCount();
}

/**
 * Load retailer's inventory for walk-in sale
 */
async function loadWalkInProducts() {
    const productsListDiv = document.getElementById('walkInProductsList');
    
    try {
        // Get retailer's inventory stock
        const stockItems = await getMyStock(STOCK_TYPES.INVENTORY);

        if (stockItems.length === 0) {
            productsListDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999;">
                    <p style="font-size: 1.2rem; margin-bottom: 1rem;">📦 No products in inventory</p>
                    <p>Purchase products from suppliers to add to your inventory.</p>
                    <button class="btn-primary" onclick="loadPurchasePage()" style="margin-top: 1rem;">
                        Go to Purchase
                    </button>
                </div>
            `;
            return;
        }

        let html = `
            <h3 style="color: #667eea; margin-bottom: 1rem;">Your Available Products</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;" id="walkInProductsGrid">
        `;

        for (const stock of stockItems) {
            const product = await getProduct(stock.productId);
            const vatRate = product.vatRate || 0;
            const priceWithVAT = stock.sellingPrice * (1 + vatRate / 100);

            html += `
                <div class="card" style="padding: 1.5rem;" 
                     data-product-name="${stock.productName.toLowerCase()}" 
                     data-product-sku="${stock.productSKU.toLowerCase()}">
                    <h3 style="color: #667eea; margin-bottom: 0.5rem;">${stock.productName}</h3>
                    <p style="color: #999; font-size: 0.9rem; margin-bottom: 0.5rem;">SKU: ${stock.productSKU}</p>
                    <p style="color: #666; margin-bottom: 0.5rem;">Available: <strong>${stock.quantity} ${stock.productUnit}</strong></p>
                    <p style="color: #666; margin-bottom: 0.5rem;">Price: <strong>${stock.sellingPrice.toFixed(2)} per ${stock.productUnit}</strong></p>
                    ${vatRate > 0 ? `<p style="color: #666; margin-bottom: 0.5rem;">VAT: ${vatRate}%</p>` : ''}
                    ${vatRate > 0 ? `<p style="color: #4caf50; font-weight: bold; margin-bottom: 1rem;">Total: ${priceWithVAT.toFixed(2)} (incl. VAT)</p>` : ''}
                    
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem;">
                        <input type="number" 
                               id="walkInQty_${stock.id}" 
                               min="0.01" 
                               step="0.01" 
                               max="${stock.quantity}"
                               placeholder="Qty"
                               style="flex: 1; padding: 0.5rem; border: 2px solid #e0e0e0; border-radius: 6px;">
                        <button class="btn-success" 
                                onclick="addToWalkInCart('${stock.id}', '${stock.productId}', '${stock.productName}', '${stock.productSKU}', '${stock.productUnit}', ${stock.quantity}, ${stock.sellingPrice}, ${vatRate})"
                                style="padding: 0.5rem 1rem;">
                            Add to Cart
                        </button>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        productsListDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading walk-in products:', error);
        productsListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading products. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Add item to walk-in cart
 */
function addToWalkInCart(stockId, productId, productName, productSKU, productUnit, maxQuantity, pricePerUnit, vatRate) {
    const qtyInput = document.getElementById(`walkInQty_${stockId}`);
    const quantity = parseFloat(qtyInput.value);

    if (!quantity || quantity <= 0) {
        showError('Please enter a valid quantity');
        return;
    }

    if (quantity > maxQuantity) {
        showError(`Maximum available: ${maxQuantity} ${productUnit}`);
        return;
    }

    // Check if item already in cart
    const existingIndex = walkInCart.findIndex(item => item.stockId === stockId);
    
    if (existingIndex >= 0) {
        // Update quantity
        walkInCart[existingIndex].quantity += quantity;
    } else {
        // Add new item
        walkInCart.push({
            stockId,
            productId,
            productName,
            productSKU,
            productUnit,
            quantity,
            pricePerUnit,
            vatRate
        });
    }

    // Clear input
    qtyInput.value = '';

    // Update cart count
    updateWalkInCartCount();

    showSuccess(`Added ${quantity} ${productUnit} of ${productName} to cart`);
}

/**
 * Update walk-in cart count badge
 */
function updateWalkInCartCount() {
    const cartCountElement = document.getElementById('walkInCartCount');
    if (!cartCountElement) return;

    cartCountElement.textContent = walkInCart.length;
}

/**
 * View walk-in cart
 */
function viewWalkInCart() {
    if (walkInCart.length === 0) {
        showError('Cart is empty');
        return;
    }

    let subtotal = 0;
    let totalVAT = 0;

    let modalHTML = `
        <div id="walkInCartModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; overflow-y: auto;">
            <div style="background: white; padding: 2.5rem; border-radius: 12px; max-width: 800px; width: 90%; margin: 2rem; max-height: 90vh; overflow-y: auto;">
                <h2 style="color: #667eea; margin-bottom: 2rem;">🛍️ Walk-in Sale Cart</h2>
                
                <table style="width: 100%; margin-bottom: 1rem;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 0.75rem; text-align: left;">Product</th>
                            <th style="padding: 0.75rem; text-align: right;">Qty</th>
                            <th style="padding: 0.75rem; text-align: right;">Price</th>
                            <th style="padding: 0.75rem; text-align: right;">VAT</th>
                            <th style="padding: 0.75rem; text-align: right;">Total</th>
                            <th style="padding: 0.75rem; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    walkInCart.forEach((item, index) => {
        const itemSubtotal = item.quantity * item.pricePerUnit;
        const itemVAT = itemSubtotal * (item.vatRate / 100);
        const itemTotal = itemSubtotal + itemVAT;
        
        subtotal += itemSubtotal;
        totalVAT += itemVAT;

        modalHTML += `
            <tr>
                <td style="padding: 0.75rem;">
                    <strong>${item.productName}</strong><br>
                    <small style="color: #999;">${item.productSKU}</small>
                </td>
                <td style="padding: 0.75rem; text-align: right;">${item.quantity} ${item.productUnit}</td>
                <td style="padding: 0.75rem; text-align: right;">${item.pricePerUnit.toFixed(2)}</td>
                <td style="padding: 0.75rem; text-align: right;">${item.vatRate}% (${itemVAT.toFixed(2)})</td>
                <td style="padding: 0.75rem; text-align: right;"><strong>${itemTotal.toFixed(2)}</strong></td>
                <td style="padding: 0.75rem; text-align: center;">
                    <button onclick="removeFromWalkInCart(${index})" 
                            class="btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">Remove</button>
                </td>
            </tr>
        `;
    });

    const grandTotal = subtotal + totalVAT;

    modalHTML += `
                    </tbody>
                    <tfoot>
                        <tr style="background: #f5f5f5; font-weight: bold;">
                            <td colspan="4" style="padding: 0.75rem; text-align: right;">Subtotal:</td>
                            <td style="padding: 0.75rem; text-align: right;">${subtotal.toFixed(2)}</td>
                            <td></td>
                        </tr>
                        <tr style="background: #f5f5f5; font-weight: bold;">
                            <td colspan="4" style="padding: 0.75rem; text-align: right;">VAT:</td>
                            <td style="padding: 0.75rem; text-align: right;">${totalVAT.toFixed(2)}</td>
                            <td></td>
                        </tr>
                        <tr style="background: #667eea; color: white; font-weight: bold;">
                            <td colspan="4" style="padding: 0.75rem; text-align: right;">Total:</td>
                            <td style="padding: 0.75rem; text-align: right;">${grandTotal.toFixed(2)}</td>
                            <td style="padding: 0.75rem; text-align: center;">
                                <button onclick="completeWalkInSale()" class="btn-success" style="padding: 0.5rem 1rem;">Complete Sale</button>
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
                    <button class="btn-danger" onclick="clearWalkInCart()">Clear Cart</button>
                    <button class="btn-secondary" onclick="closeWalkInCartModal()">Continue Shopping</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Remove item from walk-in cart
 */
function removeFromWalkInCart(itemIndex) {
    walkInCart.splice(itemIndex, 1);
    updateWalkInCartCount();
    closeWalkInCartModal();
    
    if (walkInCart.length > 0) {
        viewWalkInCart();
    }
}

/**
 * Clear walk-in cart
 */
function clearWalkInCart() {
    if (!confirm('Clear entire cart?')) return;
    
    walkInCart = [];
    updateWalkInCartCount();
    closeWalkInCartModal();
}

/**
 * Close walk-in cart modal
 */
function closeWalkInCartModal() {
    const modal = document.getElementById('walkInCartModal');
    if (modal) modal.remove();
}

/**
 * Complete walk-in sale
 */
async function completeWalkInSale() {
    if (walkInCart.length === 0) {
        showError('Cart is empty');
        return;
    }

    // Get customer info (optional)
    const customerName = document.getElementById('walkInCustomerName')?.value.trim() || 'Walk-in Customer';
    const customerPhone = document.getElementById('walkInCustomerPhone')?.value.trim() || 'N/A';

    // Confirm sale
    if (!confirm(`Complete sale for ${customerName}?\nTotal items: ${walkInCart.length}`)) {
        return;
    }

    showLoading();

    try {
        // Process the walk-in sale
        const result = await processWalkInSale(walkInCart, customerName, customerPhone);

        hideLoading();

        if (result.success) {
            showSuccess(`Sale completed! Invoice #${result.invoice.invoiceNumber}`);
            
            // Clear cart
            walkInCart = [];
            updateWalkInCartCount();
            closeWalkInCartModal();
            
            // Clear customer info
            if (document.getElementById('walkInCustomerName')) {
                document.getElementById('walkInCustomerName').value = '';
            }
            if (document.getElementById('walkInCustomerPhone')) {
                document.getElementById('walkInCustomerPhone').value = '';
            }
            
            // Reload products to show updated stock
            await loadWalkInProducts();
            
            // Ask if they want to print/view invoice
            if (confirm('View invoice?')) {
                viewInvoiceDetail(result.invoice.id);
            }
        } else {
            showError(result.error);
        }
    } catch (error) {
        hideLoading();
        console.error('Error completing walk-in sale:', error);
        showError('Failed to complete sale. Please try again.');
    }
}

/**
 * Process walk-in sale (deduct stock and generate invoice)
 */
async function processWalkInSale(items, customerName, customerPhone) {
    try {
        const authUser = firebase.auth().currentUser;
        if (!authUser) {
            return { success: false, error: 'Not authenticated' };
        }

        // Calculate totals
        let subtotal = 0;
        let totalVAT = 0;
        const invoiceItems = [];

        // Deduct stock for each item
        for (const item of items) {
            const product = await getProduct(item.productId);
            if (!product) {
                return { success: false, error: `Product not found: ${item.productId}` };
            }

            const itemSubtotal = item.quantity * item.pricePerUnit;
            const itemVAT = itemSubtotal * (item.vatRate / 100);
            
            subtotal += itemSubtotal;
            totalVAT += itemVAT;

            // Deduct from retailer's stock
            const deductResult = await addOrUpdateStock(
                authUser.uid,
                item.productId,
                -item.quantity, // Negative quantity to deduct
                item.pricePerUnit,
                STOCK_TYPES.INVENTORY
            );

            if (!deductResult.success) {
                return { 
                    success: false, 
                    error: `Failed to deduct stock for ${item.productName}: ${deductResult.error}` 
                };
            }

            invoiceItems.push({
                productId: item.productId,
                productName: item.productName,
                productSKU: item.productSKU,
                productUnit: item.productUnit,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit,
                vatRate: item.vatRate,
                itemSubtotal: itemSubtotal,
                itemVAT: itemVAT,
                itemTotal: itemSubtotal + itemVAT
            });
        }

        const totalAmount = subtotal + totalVAT;

        // Create transaction record
        const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
        const transaction = {
            id: transactionRef.id,
            sellerId: authUser.uid,
            sellerName: currentUserData.name,
            sellerRole: currentUserData.role,
            buyerId: authUser.uid, // Retailer is both seller and buyer for walk-in
            buyerName: customerName,
            buyerRole: 'walk-in-customer',
            items: invoiceItems,
            subtotal: subtotal,
            totalVAT: totalVAT,
            totalAmount: totalAmount,
            type: TRANSACTION_TYPES.SALE,
            timestamp: getTimestamp(),
            status: 'completed',
            customerPhone: customerPhone,
            isWalkIn: true
        };
        await transactionRef.set(transaction);

        // Generate invoice
        const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc();
        const invoice = {
            id: invoiceRef.id,
            invoiceNumber: generateInvoiceNumber(),
            transactionId: transaction.id,
            
            sellerId: authUser.uid,
            sellerName: currentUserData.name,
            sellerRole: currentUserData.role,
            
            buyerId: authUser.uid,
            buyerName: customerName,
            buyerRole: 'walk-in-customer',
            
            items: invoiceItems,
            
            subtotal: subtotal,
            totalVAT: totalVAT,
            totalAmount: totalAmount,
            
            status: INVOICE_STATUS.GENERATED,
            generatedAt: getTimestamp(),
            dueDate: getTimestamp(), // Immediate payment for walk-in
            
            notes: `Walk-in customer sale. Phone: ${customerPhone}`,
            paymentStatus: 'paid', // Walk-in sales are cash on delivery
            isWalkIn: true,
            customerPhone: customerPhone
        };

        await invoiceRef.set(invoice);

        console.log('✅ Walk-in sale completed:', invoice.id);
        return {
            success: true,
            invoice: invoice,
            transaction: transaction
        };

    } catch (error) {
        console.error('Error processing walk-in sale:', error);
        return {
            success: false,
            error: error.message || 'Failed to process walk-in sale'
        };
    }
}

/**
 * Filter walk-in products by search term
 */
function filterWalkInProducts() {
    const searchTerm = document.getElementById('walkInProductSearch').value.toLowerCase();
    const grid = document.getElementById('walkInProductsGrid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.card');
    cards.forEach(card => {
        const name = card.getAttribute('data-product-name');
        const sku = card.getAttribute('data-product-sku');
        
        if (name.includes(searchTerm) || sku.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

console.log('✅ Walk-in Sale View loaded');