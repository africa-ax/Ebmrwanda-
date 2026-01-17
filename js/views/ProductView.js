// Product View - Product Management Interface

/**
 * Show Products Management Page
 */
async function showProductsPage() {
    // Check if user is manufacturer
    if (!currentUserData || currentUserData.role !== ROLES.MANUFACTURER) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h2 style="color: #f44336;">Access Denied</h2>
                <p>Only manufacturers can manage products.</p>
                <button class="btn-primary" onclick="loadDashboard('${currentUserData?.role}')">Back to Dashboard</button>
            </div>
        `;
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">📦 My Products</h2>
                <div>
                    <button class="btn-primary" onclick="showCreateProductForm()">+ Create Product</button>
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <!-- Create Product Form (hidden by default) -->
            <div id="createProductForm" style="display: none; background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">Create New Product</h3>
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
                    <div class="form-group">
                        <label for="productSKU">SKU (Optional - Auto-generated if empty)</label>
                        <input type="text" id="productSKU" placeholder="e.g., BAN-001">
                    </div>
                    <div class="form-group">
                        <label for="productDescription">Description (Optional)</label>
                        <textarea id="productDescription" rows="3" maxlength="500" placeholder="Product description..."></textarea>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-success">Create Product</button>
                        <button type="button" class="btn-secondary" onclick="hideCreateProductForm()">Cancel</button>
                    </div>
                    <p id="productFormError" class="error-message"></p>
                    <p id="productFormSuccess" class="success-message"></p>
                </form>
            </div>

            <!-- Search Bar -->
            <div class="form-group" style="margin-bottom: 1.5rem;">
                <input type="text" id="productSearch" placeholder="Search products by name or SKU..." 
                       onkeyup="filterProducts()" style="width: 100%;">
            </div>

            <!-- Products List -->
            <div id="productsList">
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner"></div>
                    <p>Loading products...</p>
                </div>
            </div>
        </div>
    `;

    // Load products
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
                <div style="text-align: center; padding: 3rem; color: #999;">
                    <p style="font-size: 1.2rem;">No products yet</p>
                    <p>Click "Create Product" to add your first product</p>
                </div>
            `;
            return;
        }

        let html = `
            <table id="productsTable">
                <thead>
                    <tr>
                        <th>Product Name</th>
                        <th>SKU</th>
                        <th>Unit</th>
                        <th>Description</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        products.forEach(product => {
            const createdDate = product.createdAt?.toDate?.() || new Date();
            html += `
                <tr data-product-name="${product.name.toLowerCase()}" data-product-sku="${product.sku.toLowerCase()}">
                    <td><strong>${product.name}</strong></td>
                    <td>${product.sku}</td>
                    <td>${product.unit}</td>
                    <td>${product.description || '-'}</td>
                    <td>${createdDate.toLocaleDateString()}</td>
                    <td>
                        <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" 
                                onclick="showEditProductForm('${product.id}')">Edit</button>
                        <button class="btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" 
                                onclick="handleDeleteProduct('${product.id}', '${product.name}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        productsListDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading products:', error);
        productsListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading products. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Show create product form
 */
function showCreateProductForm() {
    document.getElementById('createProductForm').style.display = 'block';
    document.getElementById('productName').focus();
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

    const productData = {
        name: document.getElementById('productName').value.trim(),
        unit: document.getElementById('productUnit').value,
        sku: document.getElementById('productSKU').value.trim() || undefined,
        description: document.getElementById('productDescription').value.trim()
    };

    // Show loading
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;

    const result = await createProduct(productData);

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    if (result.success) {
        successElement.textContent = 'Product created successfully!';
        document.getElementById('productForm').reset();
        
        // Reload products list
        await loadProductsList();
        
        // Hide form after 2 seconds
        setTimeout(() => {
            hideCreateProductForm();
        }, 2000);
    } else {
        errorElement.textContent = result.error;
    }
}

/**
 * Show edit product form
 */
async function showEditProductForm(productId) {
    const product = await getProduct(productId);
    
    if (!product) {
        alert('Product not found');
        return;
    }

    const modalHTML = `
        <div id="editProductModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
            <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;">
                <h3 style="margin-bottom: 1rem;">Edit Product</h3>
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
                        <label for="editProductDescription">Description</label>
                        <textarea id="editProductDescription" rows="3" maxlength="500">${product.description || ''}</textarea>
                    </div>
                    <p style="color: #999; font-size: 0.9rem; margin-bottom: 1rem;">SKU: ${product.sku} (cannot be changed)</p>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-success">Update Product</button>
                        <button type="button" class="btn-secondary" onclick="closeEditProductModal()">Cancel</button>
                    </div>
                    <p id="editProductError" class="error-message"></p>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
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
        description: document.getElementById('editProductDescription').value.trim()
    };

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Updating...';
    submitBtn.disabled = true;

    const result = await updateProduct(productId, updates);

    if (result.success) {
        closeEditProductModal();
        await loadProductsList();
        showSuccess('Product updated successfully!');
    } else {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        errorElement.textContent = result.error;
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
    if (!confirm(`Are you sure you want to delete "${productName}"?\n\nThis cannot be undone and will fail if stock exists for this product.`)) {
        return;
    }

    showLoading();
    const result = await deleteProduct(productId);
    hideLoading();

    if (result.success) {
        showSuccess('Product deleted successfully');
        await loadProductsList();
    } else {
        showError(result.error);
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

console.log('Product view loaded');
        
