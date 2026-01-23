// Raw Materials View - For Manufacturers Only

/**
 * Show Raw Materials Page
 */
async function showRawMaterialsPage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    // Only manufacturers should access this
    if (currentUserData.role !== ROLES.MANUFACTURER) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h2 style="color: #f44336;">Access Denied</h2>
                <p>Only manufacturers can access raw materials.</p>
                <button class="btn-primary" onclick="loadDashboard('${currentUserData.role}')">Back to Dashboard</button>
            </div>
        `;
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">🏭 Raw Materials Inventory</h2>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-secondary" onclick="loadRawMaterialsList()">🔄 Refresh</button>
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div id="rawMaterialsSummary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 1.5rem; border-radius: 8px; color: white;">
                    <h4 style="margin: 0 0 0.5rem 0; opacity: 0.9;">Total Items</h4>
                    <p style="font-size: 2rem; font-weight: bold; margin: 0;" id="totalRawItems">0</p>
                </div>
                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 1.5rem; border-radius: 8px; color: white;">
                    <h4 style="margin: 0 0 0.5rem 0; opacity: 0.9;">Total Value</h4>
                    <p style="font-size: 2rem; font-weight: bold; margin: 0;" id="totalRawValue">0.00</p>
                </div>
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 1.5rem; border-radius: 8px; color: white;">
                    <h4 style="margin: 0 0 0.5rem 0; opacity: 0.9;">Low Stock Items</h4>
                    <p style="font-size: 2rem; font-weight: bold; margin: 0;" id="lowStockRawItems">0</p>
                </div>
            </div>

            <!-- Search Bar -->
            <div style="margin-bottom: 1.5rem;">
                <input type="text" 
                       id="rawMaterialSearch" 
                       placeholder="🔍 Search raw materials by name or SKU..." 
                       onkeyup="filterRawMaterials()" 
                       style="width: 100%; padding: 0.8rem; border: 2px solid #eee; border-radius: 8px; font-size: 1rem;">
            </div>

            <!-- Raw Materials List -->
            <div id="rawMaterialsListContainer" class="table-responsive">
                <div style="text-align: center; padding: 3rem;">
                    <div class="spinner"></div>
                    <p>Loading raw materials...</p>
                </div>
            </div>
        </div>
    `;

    await loadRawMaterialsList();
}

/**
 * Load and display raw materials list
 */
async function loadRawMaterialsList() {
    const container = document.getElementById('rawMaterialsListContainer');
    
    try {
        // Get raw materials stock (type: 'rawMaterial')
        const rawMaterials = await getMyStock(STOCK_TYPES.RAW_MATERIAL);

        // Update summary cards
        updateRawMaterialsSummary(rawMaterials);

        if (!rawMaterials || rawMaterials.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999;">
                    <p style="font-size: 1.2rem; margin-bottom: 1rem;">📦 No raw materials in stock</p>
                    <p>Purchase raw materials from the Purchase page to see them here.</p>
                    <button class="btn-primary" onclick="loadPurchasePage()" style="margin-top: 1rem;">
                        Go to Purchase
                    </button>
                </div>
            `;
            return;
        }

        let html = `
            <table class="table" id="rawMaterialsTable">
                <thead>
                    <tr>
                        <th>Material Name</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Purchase Price</th>
                        <th>Total Value</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        rawMaterials.forEach(material => {
            const totalValue = material.quantity * material.sellingPrice;
            const isLowStock = material.quantity < 10; // Low stock threshold
            const statusColor = isLowStock ? '#f44336' : '#4caf50';
            const statusText = isLowStock ? 'Low Stock' : 'In Stock';

            html += `
                <tr data-product-name="${material.productName.toLowerCase()}" 
                    data-product-sku="${material.productSKU.toLowerCase()}"
                    style="background: ${isLowStock ? '#fff3f3' : 'white'};">
                    <td>
                        <strong>${material.productName}</strong>
                        ${isLowStock ? '<span style="color: #f44336; font-size: 0.85rem;"> ⚠️</span>' : ''}
                    </td>
                    <td><code>${material.productSKU}</code></td>
                    <td><strong>${material.quantity}</strong> ${material.productUnit}</td>
                    <td>${material.sellingPrice.toFixed(2)}</td>
                    <td><strong>${totalValue.toFixed(2)}</strong></td>
                    <td>
                        <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        <button class="btn-primary" 
                                style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" 
                                onclick="showRawMaterialDetails('${material.id}')">
                            View Details
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading raw materials:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading raw materials. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Update summary cards
 */
function updateRawMaterialsSummary(rawMaterials) {
    const totalItems = rawMaterials.length;
    let totalValue = 0;
    let lowStockCount = 0;

    rawMaterials.forEach(material => {
        totalValue += material.quantity * material.sellingPrice;
        if (material.quantity < 10) {
            lowStockCount++;
        }
    });

    document.getElementById('totalRawItems').textContent = totalItems;
    document.getElementById('totalRawValue').textContent = totalValue.toFixed(2);
    document.getElementById('lowStockRawItems').textContent = lowStockCount;
}

/**
 * Filter raw materials by search term
 */
function filterRawMaterials() {
    const searchTerm = document.getElementById('rawMaterialSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#rawMaterialsTable tbody tr');
    
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

/**
 * Show raw material details modal
 */
async function showRawMaterialDetails(stockId) {
    const rawMaterials = await getMyStock(STOCK_TYPES.RAW_MATERIAL);
    const material = rawMaterials.find(m => m.id === stockId);
    
    if (!material) {
        showError('Material not found');
        return;
    }

    const totalValue = material.quantity * material.sellingPrice;
    const createdDate = material.createdAt?.toDate?.() || new Date();
    const updatedDate = material.updatedAt?.toDate?.() || new Date();

    const modalHtml = `
        <div id="rawMaterialModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
             background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; overflow-y: auto;">
            <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 600px; width: 90%; margin: 2rem;">
                <h2 style="color: #667eea; margin-bottom: 1.5rem;">📦 Raw Material Details</h2>
                
                <div style="background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h3 style="color: #667eea; margin-bottom: 1rem;">${material.productName}</h3>
                    
                    <div style="display: grid; gap: 0.75rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #666;">SKU:</span>
                            <strong><code>${material.productSKU}</code></strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #666;">Quantity:</span>
                            <strong>${material.quantity} ${material.productUnit}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #666;">Purchase Price per Unit:</span>
                            <strong>${material.sellingPrice.toFixed(2)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 2px solid #ddd;">
                            <span style="color: #666; font-weight: bold;">Total Value:</span>
                            <strong style="color: #667eea; font-size: 1.2rem;">${totalValue.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>

                <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h4 style="color: #667eea; margin-bottom: 0.5rem;">Timeline</h4>
                    <p style="color: #666; margin: 0.25rem 0;">
                        <strong>Received:</strong> ${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}
                    </p>
                    <p style="color: #666; margin: 0.25rem 0;">
                        <strong>Last Updated:</strong> ${updatedDate.toLocaleDateString()} ${updatedDate.toLocaleTimeString()}
                    </p>
                </div>

                <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <p style="margin: 0; color: #856404;">
                        💡 <strong>Tip:</strong> Use these raw materials in your manufacturing process. 
                        When you create finished products, add them to your Inventory instead.
                    </p>
                </div>

                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn-secondary" onclick="closeRawMaterialModal()">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Close raw material details modal
 */
function closeRawMaterialModal() {
    const modal = document.getElementById('rawMaterialModal');
    if (modal) {
        modal.remove();
    }
}

console.log('✅ Raw Materials View loaded');
