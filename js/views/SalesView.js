// Sales View - Order Management (Approve/Reject Orders)

/**
 * Show Sales/Orders Page - Central hub for managing all incoming orders
 */
async function showSalesPage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    // Check if user can sell (has orders to manage)
    const capabilities = ROLE_CAPABILITIES[currentUserData.role];
    if (!capabilities || capabilities.canSellTo.length === 0) {
        mainContent.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center;">
                <h2 style="color: #f44336;">No Orders to Manage</h2>
                <p>Your role cannot receive orders.</p>
                <button class="btn-primary" onclick="loadDashboard('${currentUserData.role}')">Back to Dashboard</button>
            </div>
        `;
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">📋 Orders Management</h2>
                <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
            </div>

            <!-- Order Status Tabs -->
            <div style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.5rem; flex-wrap: wrap;">
                <button id="tabPending" class="tab-button active" onclick="filterSalesOrdersByStatus('pending')">
                    ⏳ Pending (<span id="pendingCount">0</span>)
                </button>
                <button id="tabConfirmed" class="tab-button" onclick="filterSalesOrdersByStatus('confirmed')">
                    ✅ Approved (<span id="confirmedCount">0</span>)
                </button>
                <button id="tabRejected" class="tab-button" onclick="filterSalesOrdersByStatus('rejected')">
                    ❌ Rejected (<span id="rejectedCount">0</span>)
                </button>
                <button id="tabAll" class="tab-button" onclick="filterSalesOrdersByStatus('all')">
                    📋 All Orders
                </button>
            </div>

            <!-- Order Summary Cards -->
            <div id="orderSummary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <!-- Summary will be loaded here -->
            </div>

            <!-- Orders List -->
            <div id="salesOrdersList">
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner"></div>
                    <p>Loading orders...</p>
                </div>
            </div>
        </div>
    `;

    // Load orders
    await loadSalesOrders('pending');
}

let allSalesOrders = [];
let currentSalesOrderStatusFilter = 'pending';

/**
 * Load seller's orders for sales management
 */
async function loadSalesOrders(statusFilter = 'all') {
    const ordersListDiv = document.getElementById('salesOrdersList');
    const summaryDiv = document.getElementById('orderSummary');
    
    if (!ordersListDiv) return;

    try {
        // Get all orders where current user is the seller
        const allOrdersSnapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('sellerId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        allSalesOrders = [];
        allOrdersSnapshot.forEach(doc => {
            allSalesOrders.push({ id: doc.id, ...doc.data() });
        });

        currentSalesOrderStatusFilter = statusFilter;

        // Filter orders
        let filteredOrders = allSalesOrders;
        if (statusFilter === 'pending') {
            filteredOrders = allSalesOrders.filter(o => o.status === ORDER_STATUS.PENDING);
        } else if (statusFilter === 'confirmed') {
            filteredOrders = allSalesOrders.filter(o => o.status === ORDER_STATUS.CONFIRMED);
        } else if (statusFilter === 'rejected') {
            filteredOrders = allSalesOrders.filter(o => o.status === ORDER_STATUS.REJECTED);
        }

        // Calculate summary
        const pendingCount = allSalesOrders.filter(o => o.status === ORDER_STATUS.PENDING).length;
        const confirmedCount = allSalesOrders.filter(o => o.status === ORDER_STATUS.CONFIRMED).length;
        const rejectedCount = allSalesOrders.filter(o => o.status === ORDER_STATUS.REJECTED).length;
        const totalRevenue = allSalesOrders
            .filter(o => o.status === ORDER_STATUS.CONFIRMED)
            .reduce((sum, o) => sum + o.totalAmount, 0);

        // Update counts in tabs
        document.getElementById('pendingCount').textContent = pendingCount;
        document.getElementById('confirmedCount').textContent = confirmedCount;
        document.getElementById('rejectedCount').textContent = rejectedCount;

        summaryDiv.innerHTML = `
            <div class="card" style="padding: 1rem; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                <h4 style="color: white; margin-bottom: 0.5rem;">${pendingCount}</h4>
                <p style="color: white; font-size: 0.9rem;">⏳ Pending Orders</p>
            </div>
            <div class="card" style="padding: 1rem; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                <h4 style="color: white; margin-bottom: 0.5rem;">${confirmedCount}</h4>
                <p style="color: white; font-size: 0.9rem;">✅ Approved Orders</p>
            </div>
            <div class="card" style="padding: 1rem; background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
                <h4 style="color: white; margin-bottom: 0.5rem;">${rejectedCount}</h4>
                <p style="color: white; font-size: 0.9rem;">❌ Rejected Orders</p>
            </div>
            <div class="card" style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <h4 style="color: white; margin-bottom: 0.5rem;">${totalRevenue.toFixed(2)}</h4>
                <p style="color: white; font-size: 0.9rem;">💰 Total Revenue</p>
            </div>
        `;

        if (filteredOrders.length === 0) {
            ordersListDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999;">
                    <p style="font-size: 1.2rem;">No ${statusFilter === 'all' ? '' : statusFilter} orders</p>
                    ${statusFilter === 'pending' ? '<p style="font-size: 0.9rem; margin-top: 0.5rem;">New orders from buyers will appear here</p>' : ''}
                </div>
            `;
            return;
        }

        let html = `
            <div style="overflow-x: auto;">
            <table style="min-width: 100%;">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Buyer</th>
                        <th>Items</th>
                        <th>Subtotal</th>
                        <th>VAT</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filteredOrders.forEach(order => {
            const date = order.createdAt?.toDate?.() || new Date();
            const statusColor = order.status === ORDER_STATUS.CONFIRMED ? '#4caf50' :
                                order.status === ORDER_STATUS.PENDING ? '#f093fb' : '#f44336';

            html += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 1rem;"><strong>${order.orderNumber}</strong></td>
                    <td style="padding: 1rem;">${date.toLocaleDateString()}<br><small style="color: #999;">${date.toLocaleTimeString()}</small></td>
                    <td style="padding: 1rem;">
                        <strong>${order.buyerName}</strong><br>
                        <small style="color: #999;">${order.buyerRole}</small>
                    </td>
                    <td style="padding: 1rem;">${order.items.length} item(s)</td>
                    <td style="padding: 1rem;">${order.subtotal.toFixed(2)}</td>
                    <td style="padding: 1rem;">${order.totalVAT.toFixed(2)}</td>
                    <td style="padding: 1rem;"><strong style="font-size: 1.1rem;">${order.totalAmount.toFixed(2)}</strong></td>
                    <td style="padding: 1rem;">
                        <span style="background: ${statusColor}; color: white; padding: 0.4rem 0.8rem; border-radius: 12px; font-size: 0.85rem; white-space: nowrap;">
                            ${order.status}
                        </span>
                    </td>
                    <td style="padding: 1rem; white-space: nowrap;">
                        <button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.9rem; margin-bottom: 0.25rem;" 
                                onclick="showSalesOrderDetail('${order.id}')">
                            👁️ View
                        </button>
                        ${order.status === ORDER_STATUS.PENDING ? `
                            <button class="btn-success" style="padding: 0.5rem 1rem; font-size: 0.9rem; margin-bottom: 0.25rem;" 
                                    onclick="approveOrderQuick('${order.id}')">
                                ✅ Approve
                            </button>
                            <button class="btn-danger" style="padding: 0.5rem 1rem; font-size: 0.9rem;" 
                                    onclick="rejectSalesOrder('${order.id}')">
                                ❌ Reject
                            </button>
                        ` : ''}
                        ${order.status === ORDER_STATUS.CONFIRMED && order.invoiceId ? `
                            <button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.9rem;" 
                                    onclick="viewInvoice('${order.invoiceId}')">
                                📄 Invoice
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            </div>
        `;

        ordersListDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading orders:', error);
        ordersListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading orders. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Filter orders by status
 */
function filterSalesOrdersByStatus(status) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    
    const tabMap = {
        'pending': 'tabPending',
        'confirmed': 'tabConfirmed',
        'rejected': 'tabRejected',
        'all': 'tabAll'
    };
    
    document.getElementById(tabMap[status]).classList.add('active');
    loadSalesOrders(status);
}

/**
 * Show order detail
 */
async function showSalesOrderDetail(orderId) {
    const order = await getOrder(orderId);
    
    if (!order) {
        showError('Order not found');
        return;
    }

    const date = order.createdAt?.toDate?.() || new Date();
    const statusColor = order.status === ORDER_STATUS.CONFIRMED ? '#4caf50' :
                        order.status === ORDER_STATUS.PENDING ? '#f093fb' : '#f44336';

    let itemsHTML = '';
    order.items.forEach(item => {
        itemsHTML += `
            <tr>
                <td style="padding: 0.75rem;">${item.productName}</td>
                <td style="padding: 0.75rem;">${item.productSKU}</td>
                <td style="padding: 0.75rem;">${item.quantity} ${item.productUnit}</td>
                <td style="padding: 0.75rem;">${item.pricePerUnit.toFixed(2)}</td>
                <td style="padding: 0.75rem;">${item.vatRate}%</td>
                <td style="padding: 0.75rem;">${item.itemVAT.toFixed(2)}</td>
                <td style="padding: 0.75rem;"><strong>${item.itemTotal.toFixed(2)}</strong></td>
            </tr>
        `;
    });

    const modalHTML = `
        <div id="salesOrderDetailModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; overflow-y: auto;">
            <div style="background: white; padding: 2.5rem; border-radius: 12px; max-width: 900px; width: 90%; margin: 2rem; max-height: 90vh; overflow-y: auto;">
                
                <div style="text-align: center; margin-bottom: 2rem; border-bottom: 3px solid #667eea; padding-bottom: 1rem;">
                    <h1 style="color: #667eea; margin-bottom: 0.5rem;">ORDER DETAILS</h1>
                    <p style="font-size: 1.2rem; color: #666;">${order.orderNumber}</p>
                    <p>
                        <span style="background: ${statusColor}; color: white; padding: 0.5rem 1rem; border-radius: 12px; font-size: 1rem;">
                            ${order.status.toUpperCase()}
                        </span>
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <h3 style="color: #667eea; margin-bottom: 0.5rem;">Buyer:</h3>
                        <p><strong>${order.buyerName}</strong></p>
                        <p style="color: #666;">${order.buyerRole}</p>
                    </div>
                    <div>
                        <h3 style="color: #667eea; margin-bottom: 0.5rem;">Seller (You):</h3>
                        <p><strong>${order.sellerName}</strong></p>
                        <p style="color: #666;">${order.sellerRole}</p>
                    </div>
                </div>

                <div style="margin-bottom: 2rem;">
                    <p style="color: #666;">Order Date: <strong>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</strong></p>
                    ${order.confirmedAt ? `<p style="color: #666;">Approved: <strong>${order.confirmedAt.toDate().toLocaleDateString()}</strong></p>` : ''}
                    ${order.rejectedAt ? `<p style="color: #666;">Rejected: <strong>${order.rejectedAt.toDate().toLocaleDateString()}</strong></p>` : ''}
                </div>

                <table style="width: 100%; margin: 2rem 0; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #667eea;">
                            <th style="color: white; padding: 1rem; text-align: left;">Product</th>
                            <th style="color: white; padding: 1rem; text-align: left;">SKU</th>
                            <th style="color: white; padding: 1rem; text-align: left;">Quantity</th>
                            <th style="color: white; padding: 1rem; text-align: left;">Price/Unit</th>
                            <th style="color: white; padding: 1rem; text-align: left;">VAT Rate</th>
                            <th style="color: white; padding: 1rem; text-align: left;">VAT</th>
                            <th style="color: white; padding: 1rem; text-align: left;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <div style="text-align: right; border-top: 2px solid #e0e0e0; padding-top: 1rem; margin-top: 1rem;">
                    <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">
                        Subtotal: ${order.subtotal.toFixed(2)}
                    </p>
                    <p style="font-size: 1.2rem; margin-bottom: 0.5rem; color: #f093fb;">
                        <strong>VAT: ${order.totalVAT.toFixed(2)}</strong>
                    </p>
                    <p style="font-size: 1.5rem; color: #667eea;">
                        <strong>Total Amount: ${order.totalAmount.toFixed(2)}</strong>
                    </p>
                </div>

                ${order.rejectionReason ? `
                <div style="margin-top: 2rem; padding: 1rem; background: #ffe0e0; border-radius: 8px;">
                    <p style="color: #f44336;"><strong>Rejection Reason:</strong></p>
                    <p>${order.rejectionReason}</p>
                </div>
                ` : ''}

                <div style="display: flex; gap: 1rem; margin-top: 2rem; justify-content: center; flex-wrap: wrap;">
                    ${order.status === ORDER_STATUS.PENDING ? `
                        <button class="btn-success" style="padding: 0.75rem 1.5rem;" onclick="approveOrderFromModal('${order.id}')">
                            ✅ Approve Order
                        </button>
                        <button class="btn-danger" style="padding: 0.75rem 1.5rem;" onclick="rejectOrderFromModal('${order.id}')">
                            ❌ Reject Order
                        </button>
                    ` : ''}
                    ${order.status === ORDER_STATUS.CONFIRMED && order.invoiceId ? `
                        <button class="btn-primary" style="padding: 0.75rem 1.5rem;" onclick="closeSalesOrderDetail(); viewInvoice('${order.invoiceId}')">
                            📄 View Invoice
                        </button>
                    ` : ''}
                    <button class="btn-secondary" style="padding: 0.75rem 1.5rem;" onclick="closeSalesOrderDetail()">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeSalesOrderDetail() {
    const modal = document.getElementById('salesOrderDetailModal');
    if (modal) modal.remove();
}

async function approveOrderQuick(orderId) {
    if (!confirm('Approve this order? Stock will be transferred and invoice will be generated instantly.')) {
        return;
    }

    showLoading();
    const result = await confirmOrder(orderId);
    hideLoading();

    if (result.success) {
        showSuccess('✅ Order approved! Stock transferred and invoice generated.');
        await loadSalesOrders(currentSalesOrderStatusFilter);
    } else {
        showError(result.error);
    }
}

async function approveOrderFromModal(orderId) {
    closeSalesOrderDetail();
    await approveOrderQuick(orderId);
}

async function rejectSalesOrder(orderId) {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return;

    showLoading();
    const result = await rejectOrder(orderId, reason);
    hideLoading();

    if (result.success) {
        showSuccess('Order rejected');
        await loadSalesOrders(currentSalesOrderStatusFilter);
    } else {
        showError(result.error);
    }
}

async function rejectOrderFromModal(orderId) {
    closeSalesOrderDetail();
    await rejectSalesOrder(orderId);
}

console.log('Sales/Orders view loaded');

        
