// Product View - Product Management Interface

/**
 * Show Products Management Page
 */
async function showProductsPage() {
    console.log('=== showProductsPage() called ===');
    
    // Check if user is manufacturer
    if (!currentUserData) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h3 style="color: #ff9800;">⏳ Loading User Data...</h3>
                <div class="spinner" style="margin: 1rem auto;"></div>
                <p>Please wait while we load your information...</p>
                <button class="btn-primary" onclick="showProductsPage()" style="margin-top: 1rem;">Try Again</button>
            </div>
        `;
        return;
    }

    if (currentUserData.role !== ROLES.MANUFACTURER) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h2 style="color: #f44336;">🚫 Access Denied</h2>
                <p>Your Role: <strong>${currentUserData.role}</strong></p>
                <p>Only <strong>${ROLES.MANUFACTURER}</strong> can manage products.</p>
                <button class="btn-primary" onclick="loadDashboard('${currentUserData.role}')">Back to Dashboard</button>
            </div>
        `;
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="color: #667eea; margin: 0;">📦 My Products</h2>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn-primary" onclick="showCreateProductForm()">+ Create Product</button>
                    <button class="btn-secondary" onclick="loadProductsList()">🔄 Refresh</button>
                    <button class="btn-secondary" onclick="showDebugPanel()">🐛 Debug</button>
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <!-- Status Panel -->
            <div id="statusPanel" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: none;">
                <h4 style="margin: 0 0 0.5rem 0; color: #666;">Status Information</h4>
                <div id="statusContent" style="font-size: 0.9rem; color: #666;"></div>
            </div>

            <!-- Debug Panel -->
            <div id="debugPanel" style="background: #fff3cd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #ffeaa7; display: none;">
                <h4 style="margin: 0 0 0.5rem 0; color: #856404;">🐛 Debug Information</h4>
                <div id="debugContent" style="font-family: monospace; font-size: 0.85rem; color: #856404;"></div>
                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                    <button class="btn-secondary" onclick="runDiagnostics()" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Run Diagnostics</button>
                    <button class="btn-secondary" onclick="clearDebugPanel()" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Clear</button>
                </div>
            </div>

            <!-- Create Product Form (hidden by default) -->
            <div id="createProductForm" style="display: none; background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">➕ Create New Product</h3>
                <form id="productForm" onsubmit="handleCreateProduct(event)">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label for="productName">Product Name *</label>
                            <input type="text" id="productName" required maxlength="100" placeholder="e.g., Banana Flour">
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
                            <label for="productSKU">SKU (Auto-generated if empty)</label>
                            <input type="text" id="productSKU" placeholder="e.g., BAN-001">
                        </div>
                        <div class="form-group">
                            <label for="productVAT">VAT Rate (%) *</label>
                            <input type="number" id="productVAT" min="0" max="100" step="0.01" value="0" required placeholder="e.g., 18">
                            <small style="color: #999;">This VAT rate will apply across all transactions</small>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="productDescription">Description (Optional)</label>
                        <textarea id="productDescription" rows="3" maxlength="500" placeholder="Product description..."></textarea>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-success">✅ Create Product</button>
                        <button type="button" class="btn-secondary" onclick="hideCreateProductForm()">❌ Cancel</button>
                    </div>
                    <p id="productFormError" class="error-message" style="margin-top: 0.5rem;"></p>
                    <p id="productFormSuccess" class="success-message" style="margin-top: 0.5rem;"></p>
                </form>
            </div>

            <!-- Search Bar -->
            <div class="form-group" style="margin-bottom: 1rem;">
                <input type="text" id="productSearch" placeholder="🔍 Search products by name or SKU..." 
                       onkeyup="filterProducts()" style="width: 100%;">
            </div>

            <!-- Products List -->
            <div id="productsList">
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner"></div>
                    <p>Loading your products...</p>
                </div>
            </div>

            <!-- No Products Message (hidden by default) -->
            <div id="noProductsMessage" style="display: none; text-align: center; padding: 3rem; color: #999;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                <p style="font-size: 1.2rem; font-weight: bold;">No Products Yet</p>
                <p>You haven't created any products yet.</p>
                <button class="btn-primary" onclick="showCreateProductForm()" style="margin-top: 1rem;">Create Your First Product</button>
            </div>
        </div>
    `;

    // Load products
    await loadProductsList();
}

/**
 * Show debug panel
 */
function showDebugPanel() {
    const debugPanel = document.getElementById('debugPanel');
    debugPanel.style.display = 'block';
    runDiagnostics();
}

/**
 * Hide debug panel
 */
function hideDebugPanel() {
    document.getElementById('debugPanel').style.display = 'none';
}

/**
 * Clear debug panel
 */
function clearDebugPanel() {
    document.getElementById('debugContent').innerHTML = '';
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    const statusPanel = document.getElementById('statusPanel');
    const statusContent = document.getElementById('statusContent');
    
    const colors = {
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336'
    };
    
    statusContent.innerHTML = `<span style="color: ${colors[type] || colors.info}">${message}</span>`;
    statusPanel.style.display = 'block';
    
    // Auto-hide info messages after 5 seconds
    if (type === 'info') {
        setTimeout(() => {
            statusPanel.style.display = 'none';
        }, 5000);
    }
}

/**
 * Run diagnostics
 */
async function runDiagnostics() {
    const debugContent = document.getElementById('debugContent');
    debugContent.innerHTML = '<div style="margin-bottom: 0.5rem;">🔍 Running diagnostics...</div>';
    
    let html = '';
    
    // 1. Check authentication
    const authUser = firebase.auth().currentUser;
    html += `<div style="margin-bottom: 0.5rem;"><strong>1. Authentication:</strong> ${authUser ? '✅ Logged in' : '❌ Not logged in'}</div>`;
    if (authUser) {
        html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem;">UID: ${authUser.uid}</div>`;
        html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem;">Email: ${authUser.email}</div>`;
    }
    
    // 2. Check currentUserData
    html += `<div style="margin-bottom: 0.5rem;"><strong>2. User Data:</strong> ${currentUserData ? '✅ Loaded' : '❌ Not loaded'}</div>`;
    if (currentUserData) {
        html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem;">Role: ${currentUserData.role}</div>`;
        html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem;">Name: ${currentUserData.name || 'N/A'}</div>`;
        html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem;">ID: ${currentUserData.id || currentUserData.uid || 'N/A'}</div>`;
        
        // Check if user is manufacturer
        const isManufacturer = currentUserData.role === ROLES.MANUFACTURER;
        html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem;">Manufacturer: ${isManufacturer ? '✅ Yes' : '❌ No'}</div>`;
    }
    
    // 3. Check Firestore connection
    html += `<div style="margin-bottom: 0.5rem;"><strong>3. Firestore Connection:</strong> ${db ? '✅ Connected' : '❌ Not connected'}</div>`;
    
    // 4. Test getMyProducts
    html += `<div style="margin-bottom: 0.5rem;"><strong>4. Testing getMyProducts()...</strong></div>`;
    
    try {
        const products = await getMyProducts();
        html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem;">Found: ${products.length} product(s)</div>`;
        
        if (products.length > 0) {
            products.forEach((product, index) => {
                html += `<div style="margin-left: 2rem; margin-bottom: 0.25rem; font-size: 0.8rem;">
                    ${index + 1}. ${product.name} (ID: ${product.id})
                </div>`;
            });
        }
    } catch (error) {
        html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem; color: #dc3545;">Error: ${error.message}</div>`;
    }
    
    // 5. Direct database check
    if (authUser && currentUserData?.role === ROLES.MANUFACTURER) {
        html += `<div style="margin-bottom: 0.5rem;"><strong>5. Direct Database Check:</strong></div>`;
        
        try {
            const querySnapshot = await db.collection(COLLECTIONS.PRODUCTS)
                .where('manufacturerId', '==', authUser.uid)
                .get();
            
            html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem;">
                Products in database with your UID: ${querySnapshot.size}
            </div>`;
            
            if (querySnapshot.size > 0) {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    html += `<div style="margin-left: 2rem; margin-bottom: 0.25rem; font-size: 0.8rem;">
                        - ${data.name} (Manufacturer ID: ${data.manufacturerId})
                    </div>`;
                });
            }
        } catch (error) {
            html += `<div style="margin-left: 1rem; margin-bottom: 0.5rem; color: #dc3545;">Database error: ${error.message}</div>`;
        }
    }
    
    debugContent.innerHTML += html;
    showStatus('Diagnostics completed', 'success');
}

/**
 * Load and display products list
 */
async function loadProductsList() {
    const productsListDiv = document.getElementById('productsList');
    const noProductsMessage = document.getElementById('noProductsMessage');
    
    // Show loading spinner
    productsListDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div class="spinner"></div>
            <p>Loading your products...</p>
        </div>
    `;
    
    if (noProductsMessage) {
        noProductsMessage.style.display = 'none';
    }
    
    try {
        // Show status
        showStatus('Fetching your products...', 'info');
        
        console.log('=== loadProductsList() called ===');
        const products = await getMyProducts();
        console.log('Products returned:', products);

        if (products.length === 0) {
            // Hide products list
            productsListDiv.innerHTML = '';
            
            // Show no products message
            if (noProductsMessage) {
                noProductsMessage.style.display = 'block';
            } else {
                // Fallback if element doesn't exist
                productsListDiv.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #999;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                        <p style="font-size: 1.2rem; font-weight: bold;">No Products Yet</p>
                        <p>You haven't created any products yet.</p>
                        <button class="btn-primary" onclick="showCreateProductForm()" style="margin-top: 1rem;">Create Your First Product</button>
                    </div>
                `;
            }
            
            showStatus(`No products found. Create your first product!`, 'warning');
            return;
        }

        let html = `
            <div style="margin-bottom: 1rem; color: #666; font-size: 0.9rem;">
                Showing ${products.length} product(s)
            </div>
            <table id="productsTable" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa; text-align: left;">
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">Product Name</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">SKU</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">Unit</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">VAT Rate</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">Description</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">Created</th>
                        <th style="padding: 0.75rem; border-bottom: 2px solid #dee2e6;">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        products.forEach(product => {
            const createdDate = product.createdAt?.toDate?.() || new Date();
            const vatRate = product.vatRate || 0;
            html += `
                <tr data-product-name="${product.name.toLowerCase()}" data-product-sku="${product.sku.toLowerCase()}" style="border-bottom: 1px solid #eee;">
                    <td style="padding: 0.75rem;"><strong>${product.name}</strong></td>
                    <td style="padding: 0.75rem;"><code style="background: #f1f1f1; padding: 2px 5px; border-radius: 3px;">${product.sku}</code></td>
                    <td style="padding: 0.75rem;">${product.unit}</td>
                    <td style="padding: 0.75rem;">${vatRate}%</td>
                    <td style="padding: 0.75rem;">${product.description || '-'}</td>
                    <td style="padding: 0.75rem; font-size: 0.9em;">${createdDate.toLocaleDateString()}</td>
                    <td style="padding: 0.75rem;">
                        <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem; margin-right: 0.25rem;" 
                                onclick="showEditProductForm('${product.id}')">✏️ Edit</button>
                        <button class="btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" 
                                onclick="handleDeleteProduct('${product.id}', '${product.name}')">🗑️ Delete</button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        productsListDiv.innerHTML = html;
        
        showStatus(`✅ Loaded ${products.length} product(s) successfully`, 'success');
        console.log(`Loaded ${products.length} products successfully`);

    } catch (error) {
        console.error('Error loading products:', error);
        productsListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                <p style="font-weight: bold;">Error loading products</p>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="loadProductsList()" style="margin-top: 1rem;">Try Again</button>
                <button class="btn-secondary" onclick="showDebugPanel()" style="margin-top: 0.5rem;">Show Debug Info</button>
            </div>
        `;
        
        showStatus(`❌ Error: ${error.message}`, 'error');
    }
}

/**
 * Show create product form
 */
function showCreateProductForm() {
    document.getElementById('createProductForm').style.display = 'block';
    document.getElementById('productName').focus();
    showStatus('Ready to create new product', 'info');
}

/**
 * Hide create product form
 */
function hideCreateProductForm() {
    document.getElementById('createProductForm').style.display = 'none';
    document.getElementById('productForm').reset();
    document.getElementById('productFormError').textContent = '';
    document.getElementById('productFormSuccess').textContent = '';
}

/**
 * Handle create product form submission
 */
async function handleCreateProduct(event) {
    event.preventDefault();

    const errorElement = document.getElementById('productFormError');
    const successElement = document.getElementById('productFormSuccess');
    errorElement.textContent = '';
    successElement.textContent = '';
    errorElement.style.display = 'none';
    successElement.style.display = 'none';

    const productData = {
        name: document.getElementById('productName').value.trim(),
        unit: document.getElementById('productUnit').value,
        sku: document.getElementById('productSKU').value.trim() || undefined,
        description: document.getElementById('productDescription').value.trim(),
        vatRate: parseFloat(document.getElementById('productVAT').value) || 0
    };

    // Show loading
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Creating...';
    submitBtn.disabled = true;

    showStatus('Creating product...', 'info');

    const result = await createProduct(productData);

    if (result.success) {
        successElement.textContent = '✅ Product created successfully!';
        successElement.style.display = 'block';
        successElement.style.color = '#4CAF50';
        
        showStatus('✅ Product created! Reloading list...', 'success');
        
        // Reset form
        document.getElementById('productForm').reset();
        
        // Reload products list
        await loadProductsList();
        
        // Hide form after success
        setTimeout(() => {
            hideCreateProductForm();
        }, 1500);
    } else {
        errorElement.textContent = '❌ ' + result.error;
        errorElement.style.display = 'block';
        errorElement.style.color = '#F44336';
        
        showStatus(`❌ Failed: ${result.error}`, 'error');
    }

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
}

/**
 * Show edit product form
 */
async function showEditProductForm(productId) {
    showStatus('Loading product details...', 'info');
    
    const product = await getProduct(productId);
    
    if (!product) {
        showStatus('❌ Product not found', 'error');
        alert('Product not found');
        return;
    }

    const modalHTML = `
        <div id="editProductModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
            <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">✏️ Edit Product</h3>
                    <button onclick="closeEditProductModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">×</button>
                </div>
                <form id="editProductForm" onsubmit="handleEditProduct(event, '${productId}')">
                    <div class="form-group">
                        <label for="editProductName">Product Name *</label>
                        <input type="text" id="editProductName" value="${product.name}" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="editProductUnit">Unit *</label>
                        <select id="editProductUnit" required>
                            ${UNITS.map(unit => `<option value="${unit}" ${unit === product.unit ? 'selected' : ''}>${unit}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editProductVAT">VAT Rate (%) *</label>
                        <input type="number" id="editProductVAT" value="${product.vatRate || 0}" min="0" max="100" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label for="editProductDescription">Description</label>
                        <textarea id="editProductDescription" rows="3" maxlength="500">${product.description || ''}</textarea>
                    </div>
                    <p style="color: #999; font-size: 0.9rem; margin-bottom: 1rem; background: #f5f5f5; padding: 0.5rem; border-radius: 4px;">
                        <strong>SKU:</strong> ${product.sku} (cannot be changed)
                    </p>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-success">✅ Update Product</button>
                        <button type="button" class="btn-secondary" onclick="closeEditProductModal()">❌ Cancel</button>
                    </div>
                    <p id="editProductError" class="error-message" style="margin-top: 1rem;"></p>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    showStatus('Ready to edit product', 'info');
}

/**
 * Handle edit product form submission
 */
async function handleEditProduct(event, productId) {
    event.preventDefault();

    const errorElement = document.getElementById('editProductError');
    errorElement.textContent = '';

    const updates = {
        name: document.getElementById('editProductName').value.trim(),
        unit: document.getElementById('editProductUnit').value,
        description: document.getElementById('editProductDescription').value.trim(),
        vatRate: parseFloat(document.getElementById('editProductVAT').value) || 0
    };

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Updating...';
    submitBtn.disabled = true;

    showStatus('Updating product...', 'info');

    const result = await updateProduct(productId, updates);

    if (result.success) {
        closeEditProductModal();
        await loadProductsList();
        showStatus('✅ Product updated successfully!', 'success');
    } else {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        errorElement.textContent = result.error;
        showStatus(`❌ Update failed: ${result.error}`, 'error');
    }
}

/**
 * Close edit product modal
 */
function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Handle delete product
 */
async function handleDeleteProduct(productId, productName) {
    if (!confirm(`⚠️ Are you sure you want to delete "${productName}"?\n\nThis cannot be undone and will fail if stock exists for this product.`)) {
        return;
    }

    showStatus('Deleting product...', 'info');
    showLoading();
    
    const result = await deleteProduct(productId);
    
    hideLoading();

    if (result.success) {
        showStatus('✅ Product deleted successfully', 'success');
        await loadProductsList();
    } else {
        showStatus(`❌ Delete failed: ${result.error}`, 'error');
    }
}

/**
 * Filter products by search term
 */
function filterProducts() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();
    const table = document.getElementById('productsTable');
    
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const name = row.getAttribute('data-product-name');
        const sku = row.getAttribute('data-product-sku');
        
        if (name.includes(searchTerm) || sku.includes(searchTerm)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Show filtering status
    if (searchTerm) {
        const statusPanel = document.getElementById('statusPanel');
        const statusContent = document.getElementById('statusContent');
        if (statusPanel && statusContent) {
            statusContent.innerHTML = `Showing ${visibleCount} product(s) matching "${searchTerm}"`;
            statusPanel.style.display = 'block';
        }
    }
}

/**
 * Show success notification
 */
function showSuccess(message) {
    showStatus(`✅ ${message}`, 'success');
}

/**
 * Show error notification
 */
function showError(message) {
    showStatus(`❌ ${message}`, 'error');
}

/**
 * Show loading overlay
 */
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'globalLoading';
    loadingDiv.style.position = 'fixed';
    loadingDiv.style.top = '0';
    loadingDiv.style.left = '0';
    loadingDiv.style.width = '100%';
    loadingDiv.style.height = '100%';
    loadingDiv.style.backgroundColor = 'rgba(255,255,255,0.7)';
    loadingDiv.style.display = 'flex';
    loadingDiv.style.justifyContent = 'center';
    loadingDiv.style.alignItems = 'center';
    loadingDiv.style.zIndex = '9999';
    loadingDiv.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align: center;">
            <div class="spinner" style="margin: 0 auto 1rem;"></div>
            <p>Processing...</p>
        </div>
    `;
    document.body.appendChild(loadingDiv);
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const loadingDiv = document.getElementById('globalLoading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

console.log('✅ Product view loaded');