// Purchase View - Browse products, add to cart, place orders

let shoppingCart = {}; // Format: { sellerId: { items: [], sellerName: '', sellerRole: '' } }

/**
 * Show Purchase/Browse Page
 */
async function showPurchasePage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">🛒 Purchase Products</h2>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-success" onclick="viewCart()" id="cartButton">
                        🛒 Cart (<span id="cartCount">0</span>)
                    </button>
                    <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
                </div>
            </div>

            <!-- Search for Seller -->
            <div style="background: #f5f5f5; padding: 2rem; border-radius: 8px; margin-bottom: 2rem;">
                <h3 style="color: #667eea; margin-bottom: 1rem;">Search for Seller</h3>
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <input type="text" id="sellerSearch" placeholder="Search by Business Name or TIN number..." 
                               style="width: 100%; font-size: 1rem;">
                    </div>
                    <button class="btn-primary" onclick="searchSellers()" style="padding: 0.75rem 2rem;">
                        🔍 Search
                    </button>
                </div>
                <small style="color: #666; margin-top: 0.5rem; display: block;">
                    Enter business name or TIN to find sellers
                </small>
            </div>

            <!-- Search Results -->
            <div id="searchResults" style="display: none; margin-bottom: 2rem;">
                <h3 style="color: #667eea; margin-bottom: 1rem;">Search Results</h3>
                <div id="sellersList"></div>
            </div>

            <!-- Selected Seller's Products -->
            <div id="sellerProductsSection" style="display: none;">
                <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <h3 style="color: #667eea; margin-bottom: 0.5rem;" id="selectedSellerName"></h3>
                    <p style="color: #666; margin: 0;" id="selectedSellerInfo"></p>
                </div>

                <!-- Search Products -->
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <input type="text" id="productSearch" placeholder="Search products by name or SKU..." 
                           onkeyup="filterAvailableProducts()" style="width: 100%;">
                </div>

                <!-- Products List -->
                <div id="productsList">
                    <div style="text-align: center; padding: 2rem;">
                        <div class="spinner"></div>
                        <p>Loading products...</p>
                    </div>
                </div>
            </div>

            <!-- My Orders Section -->
            <div id="myOrdersSection" style="margin-top: 3rem; display: none;">
                <hr style="margin: 2rem 0;">
                <h3 style="color: #667eea; margin-bottom: 1rem;">My Orders</h3>
                <div id="ordersList">
                    <div style="text-align: center; padding: 2rem;">
                        <div class="spinner"></div>
                        <p>Loading orders...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    updateCartCount();
    loadMyOrdersList(); // Always show orders at bottom
}

let currentSelectedSeller = null;

/**
 * Search for sellers by business name or TIN
 */
async function searchSellers() {
    const searchTerm = document.getElementById('sellerSearch').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    const sellersListDiv = document.getElementById('sellersList');

    if (!searchTerm) {
        showError('Please enter a business name or TIN');
        return;
    }

    sellersListDiv.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div><p>Searching...</p></div>';
    resultsDiv.style.display = 'block';

    try {
        const capabilities = ROLE_CAPABILITIES[currentUserData.role];
        const allowedRoles = capabilities.canBuyFrom;

        // Get all users with allowed roles
        const usersSnapshot = await db.collection(COLLECTIONS.USERS)
            .where('role', 'in', allowedRoles)
            .get();

        const matchedSellers = [];
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (doc.id !== currentUser.uid) {
                const businessName = (userData.businessName || '').toLowerCase();
                const userName = (userData.name || '').toLowerCase();
                const tin = (userData.tin || '').toLowerCase();

                if (businessName.includes(searchTerm) || 
                    userName.includes(searchTerm) || 
                    tin.includes(searchTerm)) {
                    matchedSellers.push({
                        id: doc.id,
                        ...userData
                    });
                }
            }
        });

        if (matchedSellers.length === 0) {
            sellersListDiv.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #999;">
                    <p>No sellers found matching "${searchTerm}"</p>
                    <p style="font-size: 0.9rem;">Try searching with a different term</p>
                </div>
            `;
            return;
        }

        let html = `
            <div style="display: grid; gap: 1rem;">
        `;

        matchedSellers.forEach(seller => {
            html += `
                <div class="card" style="padding: 1.5rem; cursor: pointer; transition: all 0.3s;" 
                     onclick="selectSeller('${seller.id}')"
                     onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.15)';"
                     onmouseout="this.style.transform=''; this.style.boxShadow='';">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="color: #667eea; margin-bottom: 0.5rem;">
                                ${seller.businessName || seller.name}
                            </h4>
                            <p style="color: #666; margin-bottom: 0.25rem;">
                                <strong>Contact:</strong> ${seller.name}
                            </p>
                            <p style="color: #666; margin-bottom: 0.25rem;">
                                <strong>Role:</strong> ${seller.role}
                            </p>
                            ${seller.tin ? `<p style="color: #666; margin-bottom: 0.25rem;"><strong>TIN:</strong> ${seller.tin}</p>` : ''}
                            <p style="color: #666;">
                                <strong>Email:</strong> ${seller.email}
                            </p>
                        </div>
                        <div>
                            <button class="btn-primary" onclick="event.stopPropagation(); selectSeller('${seller.id}')">
                                View Stock →
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        sellersListDiv.innerHTML = html;

    } catch (error) {
        console.error('Error searching sellers:', error);
        sellersListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error searching sellers. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Select a seller and load their products
 */
async function selectSeller(sellerId) {
    currentSelectedSeller = sellerId;

    // Get seller info
    const sellerDoc = await db.collection(COLLECTIONS.USERS).doc(sellerId).get();
    if (!sellerDoc.exists) {
        showError('Seller not found');
        return;
    }

    const sellerData = sellerDoc.data();

    // Update UI
    document.getElementById('selectedSellerName').textContent = sellerData.businessName || sellerData.name;
    document.getElementById('selectedSellerInfo').innerHTML = `
        <strong>Contact:</strong> ${sellerData.name} | 
        <strong>Role:</strong> ${sellerData.role} | 
        ${sellerData.tin ? `<strong>TIN:</strong> ${sellerData.tin} | ` : ''}
        <strong>Email:</strong> ${sellerData.email}
    `;

    document.getElementById('sellerProductsSection').style.display = 'block';
    document.getElementById('myOrdersSection').style.display = 'block';

    // Scroll to products
    document.getElementById('sellerProductsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Load products
    await loadSellerProducts(sellerId);
}

/**
 * Load products for selected seller
 */
async function loadSellerProducts(sellerId) {
    const productsListDiv = document.getElementById('productsList');
    
    if (!sellerId) {
        sellerId = currentSelectedSeller;
    }

    productsListDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div class="spinner"></div>
            <p>Loading products...</p>
        </div>
    `;

    try {
        // Get seller's stock
        const stockItems = await getOwnerStock(sellerId, STOCK_TYPES.INVENTORY);

        if (stockItems.length === 0) {
            productsListDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999;">
                    <p>This seller has no products in stock</p>
                </div>
            `;
            return;
        }

        let html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;" id="productsGrid">
        `;

        for (const stock of stockItems) {
            const product = await getProduct(stock.productId);
            const vatRate = product.vatRate || 0;
            const priceWithVAT = stock.sellingPrice * (1 + vatRate / 100);

            html += `
                <div class="card" style="padding: 1.5rem;" data-product-name="${stock.productName.toLowerCase()}" data-product-sku="${stock.productSKU.toLowerCase()}">
                    <h3 style="color: #667eea; margin-bottom: 0.5rem;">${stock.productName}</h3>
                    <p style="color: #999; font-size: 0.9rem; margin-bottom: 0.5rem;">SKU: ${stock.productSKU}</p>
                    <p style="color: #666; margin-bottom: 0.5rem;">Available: <strong>${stock.quantity} ${stock.productUnit}</strong></p>
                    <p style="color: #666; margin-bottom: 0.5rem;">Price: <strong>${stock.sellingPrice.toFixed(2)} per ${stock.productUnit}</strong></p>
                    ${vatRate > 0 ? `<p style="color: #666; margin-bottom: 0.5rem;">VAT: ${vatRate}%</p>` : ''}
                    ${vatRate > 0 ? `<p style="color: #4caf50; font-weight: bold; margin-bottom: 1rem;">Total: ${priceWithVAT.toFixed(2)} (incl. VAT)</p>` : ''}
                    
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem;">
                        <input type="number" 
                               id="qty_${stock.id}" 
                               min="0.01" 
                               step="0.01" 
                               max="${stock.quantity}"
                               placeholder="Qty"
                               style="flex: 1; padding: 0.5rem; border: 2px solid #e0e0e0; border-radius: 6px;">
                        <button class="btn-success" 
                                onclick="addToCart('${sellerId}', '${stock.id}', '${stock.productId}', '${stock.productName}', '${stock.productSKU}', '${stock.productUnit}', ${stock.quantity}, ${stock.sellingPrice}, ${vatRate})"
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
        console.error('Error loading seller products:', error);
        productsListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading products. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Add item to cart
 */
function addToCart(sellerId, stockId, productId, productName, productSKU, productUnit, maxQuantity, pricePerUnit, vatRate) {
    const qtyInput = document.getElementById(`qty_${stockId}`);
    const quantity = parseFloat(qtyInput.value);

    if (!quantity || quantity <= 0) {
        showError('Please enter a valid quantity');
        return;
    }

    if (quantity > maxQuantity) {
        showError(`Maximum available: ${maxQuantity} ${productUnit}`);
        return;
    }

    // Get seller info from current selection
    const sellerName = document.getElementById('selectedSellerName').textContent;
    const sellerInfo = document.getElementById('selectedSellerInfo').textContent;
    
    // Extract role from seller info
    const roleMatch = sellerInfo.match(/Role:\s*(\w+)/);
    const sellerRole = roleMatch ? roleMatch[1] : 'seller';

    // Initialize cart for this seller if doesn't exist
    if (!shoppingCart[sellerId]) {
        shoppingCart[sellerId] = {
            sellerName: sellerName,
            sellerRole: sellerRole,
            items: []
        };
    }

    // Check if item already in cart
    const existingIndex = shoppingCart[sellerId].items.findIndex(item => item.stockId === stockId);
    
    if (existingIndex >= 0) {
        // Update quantity
        shoppingCart[sellerId].items[existingIndex].quantity += quantity;
    } else {
        // Add new item
        shoppingCart[sellerId].items.push({
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
    updateCartCount();

    showSuccess(`Added ${quantity} ${productUnit} of ${productName} to cart`);
}

/**
 * Update cart count badge
 */
function updateCartCount() {
    const cartCountElement = document.getElementById('cartCount');
    if (!cartCountElement) return;

    let totalItems = 0;
    Object.values(shoppingCart).forEach(cart => {
        totalItems += cart.items.length;
    });

    cartCountElement.textContent = totalItems;
}

/**
 * View cart
 */
function viewCart() {
    if (Object.keys(shoppingCart).length === 0) {
        showError('Your cart is empty');
        return;
    }

    let modalHTML = `
        <div id="cartModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; overflow-y: auto;">
            <div style="background: white; padding: 2.5rem; border-radius: 12px; max-width: 900px; width: 90%; margin: 2rem; max-height: 90vh; overflow-y: auto;">
                <h2 style="color: #667eea; margin-bottom: 2rem;">🛒 Shopping Cart</h2>
    `;

    // Group by seller
    Object.entries(shoppingCart).forEach(([sellerId, cart]) => {
        let sellerSubtotal = 0;
        let sellerVAT = 0;

        modalHTML += `
            <div style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h3 style="color: #667eea; margin-bottom: 1rem;">Seller: ${cart.sellerName} (${cart.sellerRole})</h3>
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

        cart.items.forEach((item, index) => {
            const itemSubtotal = item.quantity * item.pricePerUnit;
            const itemVAT = itemSubtotal * (item.vatRate / 100);
            const itemTotal = itemSubtotal + itemVAT;
            
            sellerSubtotal += itemSubtotal;
            sellerVAT += itemVAT;

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
                        <button onclick="removeFromCart('${sellerId}', ${index})" 
                                class="btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">Remove</button>
                    </td>
                </tr>
            `;
        });

        const sellerTotal = sellerSubtotal + sellerVAT;

        modalHTML += `
                    </tbody>
                    <tfoot>
                        <tr style="background: #f5f5f5; font-weight: bold;">
                            <td colspan="4" style="padding: 0.75rem; text-align: right;">Subtotal:</td>
                            <td style="padding: 0.75rem; text-align: right;">${sellerSubtotal.toFixed(2)}</td>
                            <td></td>
                        </tr>
                        <tr style="background: #f5f5f5; font-weight: bold;">
                            <td colspan="4" style="padding: 0.75rem; text-align: right;">VAT:</td>
                            <td style="padding: 0.75rem; text-align: right;">${sellerVAT.toFixed(2)}</td>
                            <td></td>
                        </tr>
                        <tr style="background: #667eea; color: white; font-weight: bold;">
                            <td colspan="4" style="padding: 0.75rem; text-align: right;">Total:</td>
                            <td style="padding: 0.75rem; text-align: right;">${sellerTotal.toFixed(2)}</td>
                            <td style="padding: 0.75rem; text-align: center;">
                                <button onclick="placeOrder('${sellerId}')" class="btn-success" style="padding: 0.5rem 1rem;">Place Order</button>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    modalHTML += `
                <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
                    <button class="btn-danger" onclick="clearCart()">Clear All</button>
                    <button class="btn-secondary" onclick="closeCartModal()">Continue Shopping</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Remove item from cart
 */
function removeFromCart(sellerId, itemIndex) {
    shoppingCart[sellerId].items.splice(itemIndex, 1);
    
    // Remove seller if no items left
    if (shoppingCart[sellerId].items.length === 0) {
        delete shoppingCart[sellerId];
    }

    updateCartCount();
    closeCartModal();
    
    if (Object.keys(shoppingCart).length > 0) {
        viewCart();
    }
}

/**
 * Clear entire cart
 */
function clearCart() {
    if (!confirm('Clear entire cart?')) return;
    
    shoppingCart = {};
    updateCartCount();
    closeCartModal();
}

/**
 * Close cart modal
 */
function closeCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) modal.remove();
}

/**
 * Place order for a seller
 */
async function placeOrder(sellerId) {
    if (!shoppingCart[sellerId] || shoppingCart[sellerId].items.length === 0) {
        showError('No items to order');
        return;
    }

    showLoading();
    const result = await createOrder(sellerId, shoppingCart[sellerId].items);
    hideLoading();

    if (result.success) {
        showSuccess(`Order placed successfully! Order #${result.order.orderNumber}`);
        
        // Remove from cart
        delete shoppingCart[sellerId];
        updateCartCount();
        closeCartModal();
        
        // Show order if cart still has items
        if (Object.keys(shoppingCart).length > 0) {
            viewCart();
        }
    } else {
        showError(result.error);
    }
}

/**
 * Show browse tab
 */
function showBrowseTab() {
    // Not needed anymore - removed tabs
}

/**
 * Show orders tab
 */
async function showOrdersTab() {
    // Not needed anymore - orders always visible at bottom
}

/**
 * Load buyer's orders
 */
async function loadMyOrdersList() {
    const ordersListDiv = document.getElementById('ordersList');
    if (!ordersListDiv) return;

    try {
        const orders = await getMyOrders();

        if (orders.length === 0) {
            ordersListDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999;">
                    <p>You haven't placed any orders yet</p>
                </div>
            `;
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Seller</th>
                        <th>Items</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        orders.forEach(order => {
            const date = order.createdAt?.toDate?.() || new Date();
            const statusColor = order.status === ORDER_STATUS.CONFIRMED ? '#4caf50' : 
                                order.status === ORDER_STATUS.PENDING ? '#f093fb' : '#f44336';

            html += `
                <tr>
                    <td><strong>${order.orderNumber}</strong></td>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${order.sellerName}</td>
                    <td>${order.items.length} item(s)</td>
                    <td><strong>${order.totalAmount.toFixed(2)}</strong></td>
                    <td>
                        <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                            ${order.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" 
                                onclick="viewOrderDetail('${order.id}')">View</button>
                        ${order.status === ORDER_STATUS.PENDING ? 
                            `<button class="btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" 
                                    onclick="cancelMyOrder('${order.id}')">Cancel</button>` : ''}
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        ordersListDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading orders:', error);
        ordersListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading orders</p>
            </div>
        `;
    }
}

/**
 * View order detail
 */
async function viewOrderDetail(orderId) {
    const order = await getOrder(orderId);
    if (!order) {
        showError('Order not found');
        return;
    }

    // This will be implemented with order detail modal
    alert(`Order Detail for ${order.orderNumber}\nStatus: ${order.status}\nTotal: ${order.totalAmount.toFixed(2)}`);
}

/**
 * Cancel order
 */
async function cancelMyOrder(orderId) {
    if (!confirm('Cancel this order?')) return;

    showLoading();
    const result = await cancelOrder(orderId);
    hideLoading();

    if (result.success) {
        showSuccess('Order cancelled');
        await loadMyOrdersList();
    } else {
        showError(result.error);
    }
}

/**
 * Filter available products
 */
function filterAvailableProducts() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();
    const grid = document.getElementById('productsGrid');
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

console.log('Purchase view loaded');