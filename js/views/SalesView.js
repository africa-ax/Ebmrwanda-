// Sales View - Create Sales/Transactions Interface

/**
 * Show Sales Page
 */
async function showSalesPage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    // Check if user can sell
    const capabilities = ROLE_CAPABILITIES[currentUserData.role];
    if (!capabilities || capabilities.canSellTo.length === 0) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h2 style="color: #f44336;">Cannot Sell</h2>
                <p>Your role cannot sell products.</p>
                <button class="btn-primary" onclick="loadDashboard('${currentUserData.role}')">Back to Dashboard</button>
            </div>
        `;
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">🤝 Create Sale</h2>
                <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
            </div>

            <!-- Sale Form -->
            <div style="background: #f5f5f5; padding: 2rem; border-radius: 8px;">
                <form id="saleForm" onsubmit="handleCreateSale(event)">
                    
                    <!-- Step 1: Select Buyer -->
                    <div class="form-group">
                        <label for="buyerSelect">1. Select Buyer *</label>
                        <select id="buyerSelect" required onchange="updateBuyerInfo()">
                            <option value="">Select Buyer</option>
                        </select>
                        <div id="buyerInfo" style="margin-top: 0.5rem; color: #666; font-size: 0.9rem;"></div>
                    </div>

                    <!-- Step 2: Select Product from Your Stock -->
                    <div class="form-group">
                        <label for="productSelect">2. Select Product from Your Stock *</label>
                        <select id="productSelect" required onchange="updateProductInfo()">
                            <option value="">Select Product</option>
                        </select>
                        <div id="productInfo" style="margin-top: 0.5rem; color: #666; font-size: 0.9rem;"></div>
                    </div>

                    <!-- Step 3: Quantity -->
                    <div class="form-group">
                        <label for="saleQuantity">3. Quantity *</label>
                        <input type="number" id="saleQuantity" step="0.01" min="0.01" required 
                               placeholder="Enter quantity" onchange="calculateSaleTotal()">
                        <small id="availableStock" style="color: #666;"></small>
                    </div>

                    <!-- Step 4: Price Per Unit -->
                    <div class="form-group">
                        <label for="salePricePerUnit">4. Price Per Unit *</label>
                        <input type="number" id="salePricePerUnit" step="0.01" min="0.01" required 
                               placeholder="Your selling price" onchange="calculateSaleTotal()">
                        <small style="color: #666;">This is what you're charging the buyer</small>
                    </div>

                    <!-- Step 5: Buyer's Selling Price (Optional) -->
                    <div class="form-group">
                        <label for="buyerSellingPrice">5. Buyer's Selling Price (Optional)</label>
                        <input type="number" id="buyerSellingPrice" step="0.01" min="0.01" 
                               placeholder="Price buyer will sell at (leave empty to use your price)">
                        <small style="color: #666;">The buyer can set their own markup. If empty, uses your price.</small>
                    </div>

                    <!-- Sale Summary -->
                    <div id="saleSummary" style="background: white; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0; display: none;">
                        <h3 style="color: #667eea; margin-bottom: 1rem;">Sale Summary</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <p style="color: #666;">Product:</p>
                                <p id="summaryProduct" style="font-weight: bold;"></p>
                            </div>
                            <div>
                                <p style="color: #666;">Buyer:</p>
                                <p id="summaryBuyer" style="font-weight: bold;"></p>
                            </div>
                            <div>
                                <p style="color: #666;">Quantity:</p>
                                <p id="summaryQuantity" style="font-weight: bold;"></p>
                            </div>
                            <div>
                                <p style="color: #666;">Price/Unit:</p>
                                <p id="summaryPrice" style="font-weight: bold;"></p>
                            </div>
                        </div>
                        <hr style="margin: 1rem 0;">
                        <div style="text-align: right;">
                            <p style="font-size: 1.2rem; color: #667eea;">
                                <strong>Total Amount: <span id="summaryTotal">0.00</span></strong>
                            </p>
                        </div>
                    </div>

                    <!-- Submit Button -->
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-success">Complete Sale & Generate Invoice</button>
                        <button type="button" class="btn-secondary" onclick="document.getElementById('saleForm').reset(); hideSaleSummary()">Reset</button>
                    </div>

                    <p id="saleFormError" class="error-message"></p>
                    <p id="saleFormSuccess" class="success-message"></p>
                </form>
            </div>

            <!-- Recent Sales -->
            <div style="margin-top: 3rem;">
                <h3 style="color: #667eea; margin-bottom: 1rem;">Recent Sales</h3>
                <div id="recentSalesList">
                    <div style="text-align: center; padding: 2rem;">
                        <div class="spinner"></div>
                        <p>Loading recent sales...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load data
    await Promise.all([
        loadBuyersForSale(),
        loadProductsForSale(),
        loadRecentSales()
    ]);
}

/**
 * Load potential buyers based on current user role
 */
async function loadBuyersForSale() {
    const buyerSelect = document.getElementById('buyerSelect');
    if (!buyerSelect) return;

    try {
        const capabilities = ROLE_CAPABILITIES[currentUserData.role];
        const allowedRoles = capabilities.canSellTo;

        // Get all users with allowed roles
        const usersSnapshot = await db.collection(COLLECTIONS.USERS)
            .where('role', 'in', allowedRoles)
            .get();

        buyerSelect.innerHTML = '<option value="">Select Buyer</option>';

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            // Don't show self as buyer
            if (doc.id !== currentUser.uid) {
                buyerSelect.innerHTML += `
                    <option value="${doc.id}" data-name="${userData.name}" data-role="${userData.role}">
                        ${userData.name} (${userData.role})
                    </option>
                `;
            }
        });

    } catch (error) {
        console.error('Error loading buyers:', error);
        showError('Failed to load buyers');
    }
}

/**
 * Load user's stock products for sale
 */
async function loadProductsForSale() {
    const productSelect = document.getElementById('productSelect');
    if (!productSelect) return;

    try {
        const stockItems = await getMyStock(STOCK_TYPES.INVENTORY);

        productSelect.innerHTML = '<option value="">Select Product</option>';

        stockItems.forEach(stock => {
            productSelect.innerHTML += `
                <option value="${stock.productId}" 
                        data-stock-id="${stock.id}"
                        data-name="${stock.productName}"
                        data-sku="${stock.productSKU}"
                        data-unit="${stock.productUnit}"
                        data-quantity="${stock.quantity}"
                        data-price="${stock.sellingPrice}">
                    ${stock.productName} (${stock.productSKU}) - Available: ${stock.quantity} ${stock.productUnit}
                </option>
            `;
        });

        if (stockItems.length === 0) {
            productSelect.innerHTML = '<option value="">No products in stock</option>';
        }

    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products');
    }
}

/**
 * Update buyer info display
 */
function updateBuyerInfo() {
    const buyerSelect = document.getElementById('buyerSelect');
    const buyerInfo = document.getElementById('buyerInfo');
    const selectedOption = buyerSelect.options[buyerSelect.selectedIndex];

    if (selectedOption.value) {
        const buyerName = selectedOption.getAttribute('data-name');
        const buyerRole = selectedOption.getAttribute('data-role');
        buyerInfo.innerHTML = `✓ Selected: <strong>${buyerName}</strong> (${buyerRole})`;
    } else {
        buyerInfo.innerHTML = '';
    }

    calculateSaleTotal();
}

/**
 * Update product info display
 */
function updateProductInfo() {
    const productSelect = document.getElementById('productSelect');
    const productInfo = document.getElementById('productInfo');
    const availableStock = document.getElementById('availableStock');
    const salePriceInput = document.getElementById('salePricePerUnit');
    const selectedOption = productSelect.options[productSelect.selectedIndex];

    if (selectedOption.value) {
        const productName = selectedOption.getAttribute('data-name');
        const quantity = selectedOption.getAttribute('data-quantity');
        const unit = selectedOption.getAttribute('data-unit');
        const price = selectedOption.getAttribute('data-price');

        productInfo.innerHTML = `✓ Selected: <strong>${productName}</strong>`;
        availableStock.textContent = `Available: ${quantity} ${unit}`;
        
        // Pre-fill with current selling price
        salePriceInput.value = price;
    } else {
        productInfo.innerHTML = '';
        availableStock.textContent = '';
        salePriceInput.value = '';
    }

    calculateSaleTotal();
}

/**
 * Calculate and display sale total
 */
function calculateSaleTotal() {
    const productSelect = document.getElementById('productSelect');
    const buyerSelect = document.getElementById('buyerSelect');
    const quantity = parseFloat(document.getElementById('saleQuantity').value) || 0;
    const pricePerUnit = parseFloat(document.getElementById('salePricePerUnit').value) || 0;

    if (productSelect.value && buyerSelect.value && quantity > 0 && pricePerUnit > 0) {
        const selectedProduct = productSelect.options[productSelect.selectedIndex];
        const selectedBuyer = buyerSelect.options[buyerSelect.selectedIndex];
        
        const total = quantity * pricePerUnit;

        document.getElementById('saleSummary').style.display = 'block';
        document.getElementById('summaryProduct').textContent = selectedProduct.getAttribute('data-name');
        document.getElementById('summaryBuyer').textContent = selectedBuyer.getAttribute('data-name');
        document.getElementById('summaryQuantity').textContent = `${quantity} ${selectedProduct.getAttribute('data-unit')}`;
        document.getElementById('summaryPrice').textContent = pricePerUnit.toFixed(2);
        document.getElementById('summaryTotal').textContent = total.toFixed(2);
    } else {
        hideSaleSummary();
    }
}

/**
 * Hide sale summary
 */
function hideSaleSummary() {
    document.getElementById('saleSummary').style.display = 'none';
}

/**
 * Handle create sale form submission
 */
async function handleCreateSale(event) {
    event.preventDefault();

    const errorElement = document.getElementById('saleFormError');
    const successElement = document.getElementById('saleFormSuccess');
    errorElement.textContent = '';
    successElement.textContent = '';

    const buyerId = document.getElementById('buyerSelect').value;
    const productId = document.getElementById('productSelect').value;
    const quantity = parseFloat(document.getElementById('saleQuantity').value);
    const pricePerUnit = parseFloat(document.getElementById('salePricePerUnit').value);
    const buyerSellingPrice = document.getElementById('buyerSellingPrice').value 
        ? parseFloat(document.getElementById('buyerSellingPrice').value) 
        : pricePerUnit; // Use seller price if buyer price not specified

    // Validate quantity against available stock
    const productSelect = document.getElementById('productSelect');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const availableQuantity = parseFloat(selectedOption.getAttribute('data-quantity'));

    if (quantity > availableQuantity) {
        errorElement.textContent = `Insufficient stock. Available: ${availableQuantity}`;
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Processing Sale...';
    submitBtn.disabled = true;

    const result = await createTransaction({
        sellerId: currentUser.uid,
        buyerId: buyerId,
        productId: productId,
        quantity: quantity,
        pricePerUnit: pricePerUnit,
        buyerSellingPrice: buyerSellingPrice,
        type: TRANSACTION_TYPES.SALE
    });

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    if (result.success) {
        successElement.textContent = '✓ Sale completed successfully! Invoice generated.';
        
        // Show invoice option
        if (result.invoice) {
            successElement.innerHTML += `<br><button class="btn-primary" style="margin-top: 1rem;" onclick="viewInvoice('${result.invoice.id}')">View Invoice</button>`;
        }

        // Reset form
        document.getElementById('saleForm').reset();
        hideSaleSummary();

        // Reload products and recent sales
        await Promise.all([
            loadProductsForSale(),
            loadRecentSales()
        ]);

    } else {
        errorElement.textContent = result.error;
    }
}

/**
 * Load recent sales
 */
async function loadRecentSales() {
    const recentSalesDiv = document.getElementById('recentSalesList');
    if (!recentSalesDiv) return;

    try {
        const transactions = await getMyTransactions('seller');
        const recentSales = transactions.slice(0, 10); // Last 10 sales

        if (recentSales.length === 0) {
            recentSalesDiv.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #999;">
                    <p>No sales yet</p>
                </div>
            `;
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Buyer</th>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Price/Unit</th>
                        <th>Total</th>
                        <th>Invoice</th>
                    </tr>
                </thead>
                <tbody>
        `;

        recentSales.forEach(sale => {
            const date = sale.timestamp?.toDate?.() || new Date();
            html += `
                <tr>
                    <td>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</td>
                    <td>${sale.buyerName}</td>
                    <td>${sale.productName}</td>
                    <td>${sale.quantity} ${sale.productUnit}</td>
                    <td>${sale.pricePerUnit.toFixed(2)}</td>
                    <td><strong>${sale.totalAmount.toFixed(2)}</strong></td>
                    <td>
                        ${sale.invoiceId ? 
                            `<button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" onclick="viewInvoice('${sale.invoiceId}')">View</button>` : 
                            '-'}
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        recentSalesDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading recent sales:', error);
        recentSalesDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading sales history</p>
            </div>
        `;
    }
}

/**
 * View invoice (placeholder - will
  
  
      
      
          be implemented in InvoiceView)
 */
function viewInvoice(invoiceId) {
    console.log('View invoice:', invoiceId);
    // This will be implemented in InvoiceView.js
    if (typeof showInvoiceDetail === 'function') {
        showInvoiceDetail(invoiceId);
    } else {
        alert('Invoice viewer coming next! Invoice ID: ' + invoiceId);
    }
}

console.log('Sales view loaded');

      
