// Inventory View - Stock Management Interface

/**
 * Show Inventory Page
 */
async function showInventoryPage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    // Check if user has inventory capabilities based on role
    const capabilities = ROLE_CAPABILITIES[currentUserData.role];
    if (!capabilities || !capabilities.hasInventory) {
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
                        '<button class="btn-primary" onclick="showAddStockForm()">+ Add to Stock</button>' : ''}
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; margin-bottom: 1.5rem;">
                <input type="text" id="inventorySearch" placeholder="🔍 Search by product name or SKU..." onkeyup="filterInventory()" style="padding: 0.8rem; border: 2px solid #eee; border-radius: 8px;">
                <button class="btn-secondary" onclick="loadInventoryList()">🔄 Refresh List</button>
            </div>

            <div id="inventoryListContainer" class="table-responsive">
                <div style="text-align: center; padding: 3rem;">
                    <div class="spinner"></div>
                    <p>Loading inventory...</p>
                </div>
            </div>
        </div>
    `;

    await loadInventoryList();
}

/**
 * Show Modal for Manufacturer to Add New Stock
 */
window.showAddStockForm = async function() {
    const products = await getMyProducts(); // Fetch manufacturer's products
    
    const modalHtml = `
        <div id="addStockModal" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
            <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;">
                <h3 style="margin-bottom: 1.5rem; color: #667eea;">Add Product to Stock</h3>
                <form id="stockForm" onsubmit="handleAddStock(event)">
                    <div class="form-group">
                        <label>Select Product *</label>
                        <select id="stockProduct" required style="width: 100%; padding: 0.8rem; margin-bottom: 1rem;">
                            <option value="">-- Choose Product --</option>
                            ${products.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Initial Quantity *</label>
                        <input type="number" id="stockQuantity" step="0.01" min="0.01" required style="width: 100%; padding: 0.8rem; margin-bottom: 1rem;">
                    </div>
                    <div class="form-group">
                        <label>Unit Selling Price *</label>
                        <input type="number" id="stockPrice" step="0.01" min="0.01" required style="width: 100%; padding: 0.8rem; margin-bottom: 1rem;">
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                        <button type="submit" class="btn-primary" style="flex: 1;">Save to Stock</button>
                        <button type="button" class="btn-secondary" onclick="document.getElementById('addStockModal').remove()" style="flex: 1;">Cancel</button>
                    </div>
                    <p id="stockFormError" class="error-message" style="color: red; margin-top: 10px;"></p>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/**
 * Handle Add Stock Submission
 */
async function handleAddStock(event) {
    event.preventDefault();
    const productId = document.getElementById('stockProduct').value;
    const quantity = parseFloat(document.getElementById('stockQuantity').value);
    const price = parseFloat(document.getElementById('stockPrice').value);
    const errorElem = document.getElementById('stockFormError');

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    // Call Stock Model logic
    const result = await addOrUpdateStock(
        firebase.auth().currentUser.uid,
        productId,
        quantity,
        price,
        STOCK_TYPES.INVENTORY
    );

    if (result.success) {
        document.getElementById('addStockModal').remove();
        await loadInventoryList();
        if (typeof showSuccess === 'function') showSuccess("Stock added successfully!");
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save to Stock';
        errorElem.textContent = result.error;
    }
}

/**
 * Load and display inventory list
 */
async function loadInventoryList() {
    const container = document.getElementById('inventoryListContainer');
    try {
        const stockItems = await getMyStock(STOCK_TYPES.INVENTORY);

        if (!stockItems || stockItems.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #999;">No inventory found.</p>`;
            return;
        }

        let html = `
            <table class="table" id="inventoryTable">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total Value</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        stockItems.forEach(stock => {
            html += `
                <tr data-product-name="${stock.productName.toLowerCase()}" data-product-sku="${stock.productSKU.toLowerCase()}">
                    <td>${stock.productName}</td>
                    <td><code>${stock.productSKU}</code></td>
                    <td>${stock.quantity} ${stock.productUnit}</td>
                    <td>${stock.sellingPrice.toFixed(2)}</td>
                    <td>${(stock.quantity * stock.sellingPrice).toFixed(2)}</td>
                    <td>
                        <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" 
                                onclick="showUpdateStockModal('${stock.id}', '${stock.productName}', ${stock.quantity}, ${stock.sellingPrice})">
                            Set Reselling Price
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
    }
}

/**
 * Modal to update Reselling Price (Distributors/Retailers)
 */
window.showUpdateStockModal = function(stockId, productName, currentQty, currentPrice) {
    const modalHtml = `
        <div id="updateStockModal" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
            <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 90%;">
                <h3 style="margin-bottom: 1.5rem; color: #667eea;">Set Reselling Price</h3>
                <p>Product: <strong>${productName}</strong></p>
                <form onsubmit="handleUpdatePrice(event, '${stockId}')">
                    <div class="form-group" style="margin-top: 1rem;">
                        <label>New Unit Price *</label>
                        <input type="number" id="updatePrice" step="0.01" value="${currentPrice}" required style="width: 100%; padding: 0.8rem; border: 2px solid #eee; border-radius: 8px;">
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="submit" class="btn-primary" style="flex: 1;">Update Price</button>
                        <button type="button" class="btn-secondary" onclick="document.getElementById('updateStockModal').remove()" style="flex: 1;">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

async function handleUpdatePrice(event, stockId) {
    event.preventDefault();
    const newPrice = parseFloat(document.getElementById('updatePrice').value);
    const stockItems = await getMyStock(STOCK_TYPES.INVENTORY);
    const stockItem = stockItems.find(s => s.id === stockId);

    const result = await addOrUpdateStock(firebase.auth().currentUser.uid, stockItem.productId, 0, newPrice);

    if (result.success) {
        document.getElementById('updateStockModal').remove();
        await loadInventoryList();
    }
}

function filterInventory() {
    const searchTerm = document.getElementById('inventorySearch').value.toLowerCase();
    const rows = document.querySelectorAll('#inventoryTable tbody tr');
    rows.forEach(row => {
        const name = row.getAttribute('data-product-name');
        const sku = row.getAttribute('data-product-sku');
        row.style.display = (name.includes(searchTerm) || sku.includes(searchTerm)) ? '' : 'none';
    });
        }
