// Product View - Product Management Interface

/**
 * Show Products Management Page
 */
async function showProductsPage() {
    // FIX: Retry mechanism if currentUserData isn't synced yet
    if (!currentUserData) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h3 style="color: #ff9800;">⏳ Syncing User Profile...</h3>
                <div class="spinner" style="margin: 1rem auto;"></div>
                <p>Please wait while we verify your permissions.</p>
            </div>
        `;
        // Check again in 500ms
        setTimeout(showProductsPage, 500);
        return;
    }

    if (currentUserData.role !== ROLES.MANUFACTURER) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h2 style="color: #f44336;">🚫 Access Denied</h2>
                <p>Only Manufacturers can manage the product master list.</p>
                <button class="btn-primary" onclick="loadDashboard('${currentUserData.role}')">Back to Dashboard</button>
            </div>
        `;
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="color: #667eea; margin: 0;">📦 My Products</h2>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-primary" onclick="showCreateProductForm()">+ Create Product</button>
                    <button class="btn-secondary" onclick="loadProductsList()">🔄 Refresh</button>
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <div id="createProductForm" style="display: none; background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">➕ Create New Product</h3>
                <form id="productForm" onsubmit="handleCreateProduct(event)">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label for="productName">Product Name *</label>
                            <input type="text" id="productName" required placeholder="e.g., Banana Flour">
                        </div>
                        <div class="form-group">
                            <label for="productUnit">Unit *</label>
                            <select id="productUnit" required>
                                <option value="">Select Unit</option>
                                ${UNITS.map(unit => `<option value="${unit}">${unit}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label for="productSKU">SKU (Optional)</label>
                            <input type="text" id="productSKU" placeholder="e.g., BAN-001">
                        </div>
                        <div class="form-group">
                            <label for="productVAT">VAT Rate (%) *</label>
                            <input type="number" id="productVAT" min="0" max="100" step="0.01" value="0" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="productDescription">Description</label>
                        <textarea id="productDescription" rows="2" placeholder="Brief description..."></textarea>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-success">Save Product</button>
                        <button type="button" class="btn-secondary" onclick="hideCreateProductForm()">Cancel</button>
                    </div>
                    <p id="productFormError" class="error-message"></p>
                </form>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
                <input type="text" id="productSearch" placeholder="🔍 Search products..." onkeyup="filterProducts()" style="width: 100%;">
            </div>

            <div id="productsList">
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner"></div>
                    <p>Loading your products...</p>
                </div>
            </div>
        </div>
    `;

    await loadProductsList();
}

/**
 * Load and display products list
 */
async function loadProductsList() {
    const productsListDiv = document.getElementById('productsList');
    
    try {
        const products = await getMyProducts();

        if (products.length === 0) {
            productsListDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999; border: 2px dashed #eee; border-radius: 8px;">
                    <p style="font-size: 1.2rem;">No products found.</p>
                    <button class="btn-primary" onclick="showCreateProductForm()" style="margin-top: 1rem;">Create Your First Product</button>
                </div>
            `;
            return;
        }

        let html = `
            <table id="productsTable" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa; text-align: left;">
                        <th style="padding: 12px; border-bottom: 2px solid #eee;">Name</th>
                        <th style="padding: 12px; border-bottom: 2px solid #eee;">SKU</th>
                        <th style="padding: 12px; border-bottom: 2px solid #eee;">Unit</th>
                        <th style="padding: 12px; border-bottom: 2px solid #eee;">VAT</th>
                        <th style="padding: 12px; border-bottom: 2px solid #eee;">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        products.forEach(product => {
            html += `
                <tr data-name="${product.name.toLowerCase()}" data-sku="${product.sku.toLowerCase()}" style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px;"><strong>${product.name}</strong></td>
                    <td style="padding: 12px;"><code>${product.sku}</code></td>
                    <td style="padding: 12px;">${product.unit}</td>
                    <td style="padding: 12px;">${product.vatRate || 0}%</td>
                    <td style="padding: 12px;">
                        <button class="btn-secondary" style="padding: 5px 10px;" onclick="showEditProductForm('${product.id}')">Edit</button>
                        <button class="btn-danger" style="padding: 5px 10px;" onclick="handleDeleteProduct('${product.id}', '${product.name}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        productsListDiv.innerHTML = html;

    } catch (error) {
        productsListDiv.innerHTML = `<p class="error-message">Error loading products: ${error.message}</p>`;
    }
}

async function handleCreateProduct(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const productData = {
        name: document.getElementById('productName').value,
        unit: document.getElementById('productUnit').value,
        sku: document.getElementById('productSKU').value,
        description: document.getElementById('productDescription').value,
        vatRate: parseFloat(document.getElementById('productVAT').value) || 0
    };

    const result = await createProduct(productData);

    if (result.success) {
        hideCreateProductForm();
        await loadProductsList();
    } else {
        document.getElementById('productFormError').textContent = result.error;
        btn.disabled = false;
        btn.textContent = 'Save Product';
    }
}

function showCreateProductForm() { document.getElementById('createProductForm').style.display = 'block'; }
function hideCreateProductForm() { 
    document.getElementById('createProductForm').style.display = 'none';
    document.getElementById('productForm').reset();
}

function filterProducts() {
    const term = document.getElementById('productSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#productsTable tbody tr');
    rows.forEach(row => {
        const match = row.dataset.name.includes(term) || row.dataset.sku.includes(term);
        row.style.display = match ? '' : 'none';
    });
}

async function handleDeleteProduct(id, name) {
    if (confirm(`Delete "${name}"?`)) {
        const result = await deleteProduct(id);
        if (result.success) await loadProductsList();
        else alert(result.error);
    }
}

console.log('✅ Product View Loaded');
