// Invoice View - Invoice Display and Management Interface

/**
 * Show Invoices Page
 */
async function showInvoicesPage() {
    if (!currentUserData) {
        showError('User not authenticated');
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">📄 My Invoices</h2>
                <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
            </div>

            <!-- Filter Tabs -->
            <div style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.5rem;">
                <button id="tabAll" class="tab-button active" onclick="filterInvoices('all')">
                    All Invoices
                </button>
                <button id="tabSent" class="tab-button" onclick="filterInvoices('sent')">
                    Sent (Sales)
                </button>
                <button id="tabReceived" class="tab-button" onclick="filterInvoices('received')">
                    Received (Purchases)
                </button>
            </div>

            <!-- Search Bar -->
            <div class="form-group" style="margin-bottom: 1.5rem;">
                <input type="text" id="invoiceSearch" placeholder="Search by invoice number, buyer, or seller..." 
                       onkeyup="searchInvoices()" style="width: 100%;">
            </div>

            <!-- Invoice Summary Cards -->
            <div id="invoiceSummary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <!-- Summary will be loaded here -->
            </div>

            <!-- Invoices List -->
            <div id="invoicesList">
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner"></div>
                    <p>Loading invoices...</p>
                </div>
            </div>
        </div>

        <!-- Invoice Detail Modal (hidden by default) -->
        <div id="invoiceModal" style="display: none;"></div>
    `;

    // Add tab styling
    const style = document.createElement('style');
    style.textContent = `
        .tab-button {
            background: none;
            border: none;
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            font-size: 1rem;
            color: #666;
            transition: all 0.3s;
        }
        .tab-button:hover {
            color: #667eea;
        }
        .tab-button.active {
            color: #667eea;
            font-weight: bold;
            border-bottom: 3px solid #667eea;
        }
    `;
    document.head.appendChild(style);

    // Load invoices
    await loadInvoicesList('all');
}

let currentInvoiceFilter = 'all';
let allInvoices = [];

/**
 * Load and display invoices
 */
async function loadInvoicesList(filter = 'all') {
    const invoicesListDiv = document.getElementById('invoicesList');
    const summaryDiv = document.getElementById('invoiceSummary');
    
    if (!invoicesListDiv) return;

    try {
        // Get all invoices
        allInvoices = await getMyInvoices('all');
        currentInvoiceFilter = filter;

        // Filter invoices based on tab
        let filteredInvoices = allInvoices;
        if (filter === 'sent') {
            filteredInvoices = allInvoices.filter(inv => inv.sellerId === currentUser.uid);
        } else if (filter === 'received') {
            filteredInvoices = allInvoices.filter(inv => inv.buyerId === currentUser.uid);
        }

        // Calculate summary
        const totalInvoices = allInvoices.length;
        const sentCount = allInvoices.filter(inv => inv.sellerId === currentUser.uid).length;
        const receivedCount = allInvoices.filter(inv => inv.buyerId === currentUser.uid).length;
        const totalValue = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const paidCount = filteredInvoices.filter(inv => inv.paymentStatus === 'paid').length;

        summaryDiv.innerHTML = `
            <div class="card" style="padding: 1rem;">
                <h4 style="color: #667eea; margin-bottom: 0.5rem;">${totalInvoices}</h4>
                <p style="color: #666; font-size: 0.9rem;">Total Invoices</p>
            </div>
            <div class="card" style="padding: 1rem;">
                <h4 style="color: #4caf50; margin-bottom: 0.5rem;">${sentCount}</h4>
                <p style="color: #666; font-size: 0.9rem;">Sent (Sales)</p>
            </div>
            <div class="card" style="padding: 1rem;">
                <h4 style="color: #f093fb; margin-bottom: 0.5rem;">${receivedCount}</h4>
                <p style="color: #666; font-size: 0.9rem;">Received (Purchases)</p>
            </div>
            <div class="card" style="padding: 1rem;">
                <h4 style="color: #667eea; margin-bottom: 0.5rem;">${totalValue.toFixed(2)}</h4>
                <p style="color: #666; font-size: 0.9rem;">Total Value (Filtered)</p>
            </div>
            <div class="card" style="padding: 1rem;">
                <h4 style="color: #4caf50; margin-bottom: 0.5rem;">${paidCount}</h4>
                <p style="color: #666; font-size: 0.9rem;">Paid Invoices</p>
            </div>
        `;

        if (filteredInvoices.length === 0) {
            invoicesListDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #999;">
                    <p style="font-size: 1.2rem;">No invoices found</p>
                </div>
            `;
            return;
        }

        let html = `
            <table id="invoicesTable">
                <thead>
                    <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Products</th>
                        <th>Subtotal</th>
                        <th>VAT</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filteredInvoices.forEach(invoice => {
            const date = invoice.generatedAt?.toDate?.() || new Date();
            const isSeller = invoice.sellerId === currentUser.uid;
            const statusColor = invoice.paymentStatus === 'paid' ? '#4caf50' : '#f44336';
            const subtotal = invoice.subtotal || 0;
            const totalVAT = invoice.totalVAT || 0;
            
            html += `
                <tr data-invoice-number="${invoice.invoiceNumber.toLowerCase()}"
                    data-seller="${invoice.sellerName.toLowerCase()}"
                    data-buyer="${invoice.buyerName.toLowerCase()}">
                    <td><strong>${invoice.invoiceNumber}</strong></td>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${invoice.sellerName}<br><small style="color: #999;">${invoice.sellerRole}</small></td>
                    <td>${invoice.buyerName}<br><small style="color: #999;">${invoice.buyerRole}</small></td>
                    <td>${invoice.items.length} item(s)</td>
                    <td>${subtotal.toFixed(2)}</td>
                    <td>${totalVAT.toFixed(2)}</td>
                    <td><strong>${invoice.totalAmount.toFixed(2)}</strong></td>
                    <td>
                        <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                            ${invoice.paymentStatus}
                        </span>
                    </td>
                    <td>
                        <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" 
                                onclick="showInvoiceDetail('${invoice.id}')">View</button>
                        ${invoice.paymentStatus !== 'paid' ? 
                            `<button class="btn-success" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" 
                                    onclick="markAsPaid('${invoice.id}')">Mark Paid</button>` : ''}
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        invoicesListDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading invoices:', error);
        invoicesListDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <p>Error loading invoices. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Filter invoices by tab
 */
function filterInvoices(filter) {
    // Update active tab
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab' + filter.charAt(0).toUpperCase() + filter.slice(1)).classList.add('active');
    
    // Reload list with filter
    loadInvoicesList(filter);
}

/**
 * Search invoices
 */
function searchInvoices() {
    const searchTerm = document.getElementById('invoiceSearch').value.toLowerCase();
    const table = document.getElementById('invoicesTable');
    
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const invoiceNumber = row.getAttribute('data-invoice-number');
        const seller = row.getAttribute('data-seller');
        const buyer = row.getAttribute('data-buyer');
        
        if (invoiceNumber.includes(searchTerm) || seller.includes(searchTerm) || buyer.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

/**
 * Show invoice detail modal
 */
async function showInvoiceDetail(invoiceId) {
    const invoice = await getInvoice(invoiceId);
    
    if (!invoice) {
        showError('Invoice not found');
        return;
    }

    const date = invoice.generatedAt?.toDate?.() || new Date();
    const dueDate = invoice.dueDate?.toDate?.() || new Date();

    let itemsHTML = '';
    invoice.items.forEach(item => {
        const itemVATRate = item.vatRate || 0;
        const itemVAT = item.itemVAT || 0;
        
        itemsHTML += `
            <tr>
                <td>${item.productName}</td>
                <td>${item.productSKU}</td>
                <td>${item.quantity} ${item.unit}</td>
                <td>${item.pricePerUnit.toFixed(2)}</td>
                <td>${itemVATRate}% (${itemVAT.toFixed(2)})</td>
                <td><strong>${item.totalPrice ? item.totalPrice.toFixed(2) : (item.itemTotal || (item.quantity * item.pricePerUnit)).toFixed(2)}</strong></td>
            </tr>
        `;
    });

    const modalHTML = `
        <div id="invoiceModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; overflow-y: auto;">
            <div style="background: white; padding: 2.5rem; border-radius: 12px; max-width: 800px; width: 90%; margin: 2rem; max-height: 90vh; overflow-y: auto;">
                
                <!-- Invoice Header -->
                <div style="text-align: center; margin-bottom: 2rem; border-bottom: 3px solid #667eea; padding-bottom: 1rem;">
                    <h1 style="color: #667eea; margin-bottom: 0.5rem;">INVOICE</h1>
                    <p style="font-size: 1.2rem; color: #666;">${invoice.invoiceNumber}</p>
                </div>

                <!-- Invoice Details -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <h3 style="color: #667eea; margin-bottom: 0.5rem;">From:</h3>
                        <p><strong>${invoice.sellerName}</strong></p>
                        <p style="color: #666;">${invoice.sellerRole}</p>
                    </div>
                    <div>
                        <h3 style="color: #667eea; margin-bottom: 0.5rem;">To:</h3>
                        <p><strong>${invoice.buyerName}</strong></p>
                        <p style="color: #666;">${invoice.buyerRole}</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <p style="color: #666;">Invoice Date:</p>
                        <p><strong>${date.toLocaleDateString()}</strong></p>
                    </div>
                    <div>
                        <p style="color: #666;">Due Date:</p>
                        <p><strong>${dueDate.toLocaleDateString()}</strong></p>
                    </div>
                </div>

                <!-- Items Table -->
                <table style="width: 100%; margin: 2rem 0;">
                    <thead>
                        <tr style="background: #667eea;">
                            <th style="color: white; padding: 1rem; text-align: left;">Product</th>
                            <th style="color: white; padding: 1rem; text-align: left;">SKU</th>
                            <th style="color: white; padding: 1rem; text-align: left;">Quantity</th>
                            <th style="color: white; padding: 1rem; text-align: left;">Price/Unit</th>
                            <th style="color: white; padding: 1rem; text-align: left;">VAT</th>
                            <th style="color: white; padding: 1rem; text-align: left;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <!-- Total -->
                <div style="text-align: right; border-top: 2px solid #e0e0e0; padding-top: 1rem; margin-top: 1rem;">
                    <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">
                        Subtotal: ${(invoice.subtotal || 0).toFixed(2)}
                    </p>
                    <p style="font-size: 1.2rem; margin-bottom: 0.5rem; color: #f093fb;">
                        <strong>VAT: ${(invoice.totalVAT || 0).toFixed(2)}</strong>
                    </p>
                    <p style="font-size: 1.5rem; color: #667eea;">
                        <strong>Total Amount: ${invoice.totalAmount.toFixed(2)}</strong>
                    </p>
                    <p style="margin-top: 0.5rem;">
                        Status: <span style="background: ${invoice.paymentStatus === 'paid' ? '#4caf50' : '#f44336'}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px;">
                            ${invoice.paymentStatus}
                        </span>
                    </p>
                </div>

                ${invoice.notes ? `
                <div style="margin-top: 2rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                    <p style="color: #666;"><strong>Notes:</strong></p>
                    <p>${invoice.notes}</p>
                </div>
                ` : ''}

                <!-- Actions -->
                <div style="display: flex; gap: 1rem; margin-top: 2rem; justify-content: center;">
                    <button class="btn-primary" onclick="printInvoice('${invoice.id}')">🖨️ Print Invoice</button>
                    ${invoice.paymentStatus !== 'paid' ? 
                        `<button class="btn-success" onclick="markAsPaidFromModal('${invoice.id}')">Mark as Paid</button>` : ''}
                    <button class="btn-secondary" onclick="closeInvoiceModal()">Close</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('invoiceModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Close invoice modal
 */
function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Mark invoice as paid
 */
async function markAsPaid(invoiceId) {
    if (!confirm('Mark this invoice as paid?')) {
        return;
    }

    showLoading();
    const result = await markInvoiceAsPaid(invoiceId);
    hideLoading();

    if (result.success) {
        showSuccess('Invoice marked as paid');
        await loadInvoicesList(currentInvoiceFilter);
    } else {
        showError(result.error);
    }
}

/**
 * Mark invoice as paid from modal
 */
async function markAsPaidFromModal(invoiceId) {
    await markAsPaid(invoiceId);
    closeInvoiceModal();
}

/**
 * Print invoice
 */
async function printInvoice(invoiceId) {
    showLoading();
    const html = await generatePrintableInvoice(invoiceId);
    hideLoading();

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
}

console.log('Invoice view loaded');
                           
