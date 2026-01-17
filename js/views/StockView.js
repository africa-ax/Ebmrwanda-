// Inventory View - Stock Management Interface

/**
 * Show Inventory Page
 */
async function showInventoryPage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    // Check if user has inventory
    const capabilities = ROLE_CAPABILITIES[currentUserData.role];
    if (!capabilities.hasInventory) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h2 style="color: #f44336;">No Inventory Access</h2>
                <p>Your role does not manage inventory.</p>
                <button class="btn-primary" onclick="loadDashboard('${currentUserData.role}')">Back to Dashboard</button>
            </div>
        `;
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">📊 My Inventory</h2>
                <div>
                    ${currentUserData.role === ROLES.MANUFACTURER ? 
                        '<button class="btn-primary" onclick="showAddStockForm()">+ Add Stock</button>' : ''}
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <!-- Add Stock Form (Manufacturers only, hidden by default) -->
            ${currentUserData.role === ROLES.MANUFACTURER ? `
            <div id="addStockForm" style="display: none; background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">Add Inventory Stock</h3>
                <form id="stockForm" onsubmit="handleAddStock(event)">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label for="stockProduct">Product *</label>
                            <select id="stockProduct" required>
                                <option value="">Select Product</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="stockQuantity">Quantity *</label>
                            <input type="number" id="stockQuantity" step="0.01" min="0.01" required placeholder="e.g., 100">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="stockPrice">Selling Price Per Unit *</label>
                        <input type="number" id="stockPrice" step="0.01" min="0.01" required placeholder="e.g., 50.00">
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-success">Add Stock</button>
                        <button type="button" class="btn-secondary" onclick="hideAddStockForm()">Cancel</button>
                    </div>
                    <p id="stockFormError" class="error-message"></p>
                    <p id="stockFormSuccess" class="success-message"></p>
                </form>
            </div>
            ` : ''}

            <!-- Search Bar -->
            <div class="form-group" style="margin-bottom: 1.5rem;">
                <input type="text" id="inventorySearch" placeholder="Search inventory by product name or SKU..." 
                       onkeyup="filterInventory()" style="width: 100%;">
            </div>

            <!-- Stock Summary -->
            <div id="stockSummary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <!-- Summary cards will be inserted here -->
            </div>

            <!-- Inventory List -->
            <div id="inventoryList">
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner"></div>
                    <p>Loading inventory...</p>
                </div>
            </div>
        </div>
    `;

    // Load inventory
    await loadInventoryList();
    
    // Load products for stock form (manufacturers only)
    if (currentUserData.role === ROLES.MANUFACTURER) {
        await loadProductsForStockForm();
    }
}

/**
 * Load and display inventory list
 */
async function loadInventoryList() {
    const inventoryListDiv = document.getElementById('inventoryList');
    const summaryDiv = document.getElementById('stockSummary');
    
    try {
        const stockItems = await getMyStock(STOCK_TYPES.INVENTORY);

        // Calculate summary
        const totalItems = stockItems.length;
        const totalValue = stockItems.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0);
        const lowStockItems = stockItems.filter(item => item.quantity < 10).length;

        summaryDiv.innerHTML = `
            <div class="card" style="padding: 1rem;">
                <h4 style="color: #667eea; margin-bottom: 0.5rem;">${totalItems}</h4>
                <p style="color: #666; font-size: 0.9rem;">Total Products</p>
            </div>
            <div class="card" style="padding: 1rem;">
                <h4 style="color: #4caf50; margin-bottom: 0.5rem;">${totalValue.toFixed(2)}</h4>
                <p style="color: #666; font-size: 0.9rem;">Total Value</p>
            </div>
            <div class="card" style="padding: 1rem;">
                <h4 style="color: #f44336; margin-bottom: 0.5rem;">${lowStockItems}</h4>
                <p style="color: #666; font-size: 0.9rem;">Low Stock Items</p>
            </div>
        `;

        if (stockItems.length === 0) {
            inventoryListDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999;">
                    <p style="font-size: 1.2rem;">No inventory yet</p>
                    <p>${currentUserData.role === ROLES.MANUFACTURER ? 
                        'Click "Add Stock" to add your first inventory item' : 
                        'Purchase products to see them here'}</p>
                </div>
            `;
            return;
        }

        let html = `
            <table id="inventoryTable">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Price/Unit</th>
                        <th>Total Value</th>
                        <th>Last Updated</th>
                        ${currentUserData.role === ROLES.MANUFACTURER ? '<th>Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;

        stockItems.forEach(stock => {
            const totalValue = stock.quantity * stock.sellingPrice;
            const updatedDate = stock.updatedAt?.toDate?.() || new Date();
            const lowStock = stock.quantity < 10;

            html += `
                <tr data-product-name="${stock.productName.toLowerCase()}" 
                    data-product-sku="${stock.productSKU.toLowerCase()}"
                    style="${lowStock ? 'background-color: #fff3cd;' : ''}">
                    <td>
                        <strong>${stock.productName}</strong>
                        ${lowStock ? '<span style="color: #f44336; font-size: 0.8rem;"> ⚠️ Low Stock</span>' : ''}
                    </td>
                    <td>${stock.productSKU}</td>
                    <td><strong>${stock.quantity}</strong></td>
                    <td>${stock.productUnit}</td>
                    <td>${stock.sellingPrice.toFixed(2)}</td>
                    <td><strong>${totalValue.toFixed(2)}</strong></td>
                    <td>${updatedDate.toLocaleDateString()} ${updatedDate.toLocaleTimeString()}</td>
                    ${currentUserData.role === ROLES.MANUFACTURER ? `
                    <td>
                        <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" 
                                onclick="showUpdateStockModal('${stock.id}', '${stock.productName}', ${stock.quantity}, ${stock.sellingPrice})">
                            Update
                        </button>
                    </td>
                    ` : ''}
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        inventoryListDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading inventory:', error);
        inventoryListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading inventory. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Load products for stock form dropdown
 */
async function loadProductsForStockForm() {
    const products = await getMyProducts();
    const selectElement = document.getElementById('stockProduct');
    
    if (!selectElement) return;

    selectElement.innerHTML = '<option value="">Select Product</option>';
    
    products.forEach(product => {
        selectElement.innerHTML += `<option value="${product.id}">${product.name} (${product.sku})</option>`;
    });
}

/**
 * Show add stock form
 */
function showAddStockForm() {
    document.getElementById('addStockForm').style.display = 'block';
    document.getElementById('stockProduct').focus();
}

/**
 * Hide add stock form
 */
function hideAddStockForm() {
    document.getElementById('addStockForm').style.display = 'none';
    document.getElementById('stockForm').reset();
    document.getElementById('stockFormError').textContent = '';
    document.getElementById('stockFormSuccess').textContent = '';
}

/**
 * Handle add stock form submission
 */
async function handleAddStock(event) {
    event.preventDefault();

    const errorElement = document.getElementById('stockFormError');
    const successElement = document.getElementById('stockFormSuccess');
    errorElement.textContent = '';
    successElement.textContent = '';

    const productId = document.getElementById('stockProduct').value;
    const quantity = parseFloat(document.getElementById('stockQuantity').value);
    const sellingPrice = parseFloat(document.getElementById('stockPrice').value);

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;

    const result = await addOrUpdateStock(
        currentUser.uid,
        productId,
        quantity,
        sellingPrice,
        STOCK_TYPES.INVENTORY
    );

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    if (result.success) {
        successElement.textContent = `Stock ${result.action} successfully!`;
        document.getElementById('stockForm').reset();
        
        await loadInventoryList();
        
        setTimeout(() => {
            hideAddStockForm();
        }, 2000);
    } else {
        errorElement.textContent = result.error;
    }
}

/**
 * Show update stock modal
 */
function showUpdateStockModal(stockId, productName, currentQuantity, currentPrice) {
    const modalHTML = `
        <div id="updateStockModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
            <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;">
                <h3 style="margin-bottom: 1rem;">Update Stock: ${productName}</h3>
                <p style="color: #666; margin-bottom: 1rem;">Current Quantity: <strong>${currentQuantity}</strong></p>
                <form id="updateStockForm" onsubmit="handleUpdateStock(event, '${stockId}')">
                    <div class="form-group">
                        <label for="updateQuantity">Add/Remove Quantity *</label>
                        <input type="number" id="updateQuantity" step="0.01" required 
                               placeholder="Use negative to remove (e.g., -10)">
                        <small style="color: #999;">Enter positive number to add, negative to remove</small>
                    </div>
                    <div class="form-group">
                        <label for="updatePrice">Update Selling Price *</label>
                        <input type="number" id="updatePrice" step="0.01" min="0.01" 
                               value="${currentPrice}" required>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-success">Update Stock</button>
                        <button type="button" class="btn-secondary" onclick="closeUpdateStockModal()">Cancel</button>
                    </div>
                    <p id="updateStockError" class="error-message"></p>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Handle update stock
 */
async function handleUpdateStock(event, stockId) {
    event.preventDefault();

    const errorElement = document.getElementById('updateStockError');
    errorElement.textContent = '';

    const quantityChange = parseFloat(document.getElementById('updateQuantity').value);
    const newPrice = parseFloat(document.getElementById('updatePrice').value);

    // Get the stock item to find productId
    const stockItems = await getMyStock(STOCK_TYPES.INVENTORY);
    const stockItem = stockItems.find(s => s.id === stockId);

    if (!stockItem) {
        errorElement.textContent = 'Stock item not found';
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Updating...';
    submitBtn.disabled = true;

    const result = await addOrUpdateStock(
        currentUser.uid,
        stockItem.productId,
        quantityChange,
        newPrice,
        STOCK_TYPES.INVENTORY
    );

    if (result.success) {
        closeUpdateStockModal();
        await loadInventoryList();
        showSuccess(`Stock ${result.action} successfully!`);
    } else {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        errorElement.textContent = result.error;
    }
}

/**
 * Close update stock modal
 */
function closeUpdateStockModal() {
    const modal = document.getElementById('updateStockModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Filter inventory by search term
 */
function filterInventory() {
    const searchTerm = document.getElementById('inventorySearch').value.toLowerCase();
    const table = document.getElementById('inventoryTable');
    
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const name = row.getAttribute('data-product-name');
        const sku = row.getAttribute('data-product-sku');
        
        if (name.includes(searchTerm) || sku.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

console.log('Inventory view loaded');




