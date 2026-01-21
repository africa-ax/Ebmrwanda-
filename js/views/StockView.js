// Inventory View - Stock Management Interface

/**
 * Show Inventory Page
 */
async function showInventoryPage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    // Check if user has inventory capabilities based on role constants
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
                        '<button class="btn-primary" onclick="showAddStockForm()">+ Add New Product Stock</button>' : ''}
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; margin-bottom: 1.5rem;">
                <input type="text" id="inventorySearch" placeholder="🔍 Search by product name or SKU..." onkeyup="filterInventory()" style="padding: 0.8rem; border: 2px solid #eee; border-radius: 8px;">
                <button class="btn-secondary" onclick="loadInventoryList()">🔄 Refresh</button>
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
 * Load and display inventory list
 */
async function loadInventoryList() {
    const container = document.getElementById('inventoryListContainer');
    
    try {
        // Fetch stock items for the current user
        const stockItems = await getMyStock(STOCK_TYPES.INVENTORY);

        if (stockItems.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999; border: 2px dashed #eee; border-radius: 8px;">
                    <p>Your inventory is currently empty.</p>
                </div>
            `;
            return;
        }

        let html = `
            <table class="table" id="inventoryTable">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Current Price</th>
                        <th>Total Value</th>
                        <th>Last Updated</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        stockItems.forEach(stock => {
            const totalValue = stock.quantity * stock.sellingPrice;
            const updatedDate = stock.updatedAt?.toDate ? stock.updatedAt.toDate() : new Date();

            html += `
                <tr data-product-name="${stock.productName.toLowerCase()}" data-product-sku="${stock.productSKU.toLowerCase()}">
                    <td><strong>${stock.productName}</strong></td>
                    <td><code>${stock.productSKU}</code></td>
                    <td><strong>${stock.quantity}</strong></td>
                    <td>${stock.productUnit}</td>
                    <td>${stock.sellingPrice.toFixed(2)}</td>
                    <td>${totalValue.toFixed(2)}</td>
                    <td>${updatedDate.toLocaleDateString()}</td>
                    <td>
                        <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" 
                                onclick="showUpdateStockModal('${stock.id}', '${stock.productName}', ${stock.quantity}, ${stock.sellingPrice})">
                            Set Resale Price
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading inventory:', error);
        container.innerHTML = `<p class="error-message">Error loading inventory. Please try again.</p>`;
    }
}

/**
 * Show modal to update price or quantity
 */
function showUpdateStockModal(stockId, productName, currentQty, currentPrice) {
    const modalHtml = `
        <div id="updateStockModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px;">
                <h3 style="margin-bottom: 1.5rem;">Update Resale Details</h3>
                <p style="margin-bottom: 1rem;">Product: <strong>${productName}</strong></p>
                
                <form id="updateStockForm" onsubmit="handleUpdateStock(event, '${stockId}')">
                    <div class="form-group">
                        <label>Current Quantity: ${currentQty}</label>
                        <input type="number" id="updateQuantity" step="0.01" placeholder="Add/Subtract quantity (optional)">
                        <small style="color: #666;">Enter positive to add, negative to subtract.</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Resale Unit Price *</label>
                        <input type="number" id="updatePrice" step="0.01" value="${currentPrice}" required>
                        <small style="color: #666;">Set the price others will pay you.</small>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="submit" class="btn-primary" style="flex: 1;">Update Stock</button>
                        <button type="button" class="btn-secondary" onclick="closeUpdateStockModal()" style="flex: 1;">Cancel</button>
                    </div>
                    <p id="updateStockError" class="error-message"></p>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Handle stock/price update
 */
async function handleUpdateStock(event, stockId) {
    event.preventDefault();
    const errorElement = document.getElementById('updateStockError');
    
    // Quantity change is optional; Price update is primary for non-manufacturers
    const quantityChange = parseFloat(document.getElementById('updateQuantity').value) || 0;
    const newPrice = parseFloat(document.getElementById('updatePrice').value);

    // Find the stock item in the local list to get the productId
    const myStock = await getMyStock(STOCK_TYPES.INVENTORY);
    const stockItem = myStock.find(s => s.id === stockId);

    if (!stockItem) {
        errorElement.textContent = "Stock item not found.";
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Updating...';
    submitBtn.disabled = true;

    // Use the core model function to apply changes
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
        showSuccess(`Stock details updated successfully!`);
    } else {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        errorElement.textContent = result.error;
    }
}

function closeUpdateStockModal() {
    const modal = document.getElementById('updateStockModal');
    if (modal) modal.remove();
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
        row.style.display = (name.includes(searchTerm) || sku.includes(searchTerm)) ? '' : 'none';
    });
}

console.log('Inventory view loaded with resale price features');
