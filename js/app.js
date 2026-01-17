// Main Application Logic

// DOM Elements
let loadingScreen, loginScreen, registerBox, appContainer, mainContent, navbar;
let loginForm, registerForm, logoutBtn, userInfo;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Smart Commerce System...');
    initializeDOM();
    setupEventListeners();
    hideLoading();
});

/**
 * Initialize DOM element references
 */
function initializeDOM() {
    // Screens
    loadingScreen = document.getElementById('loading');
    loginScreen = document.getElementById('loginScreen');
    registerBox = document.getElementById('registerBox');
    appContainer = document.getElementById('app');
    mainContent = document.getElementById('mainContent');
    navbar = document.getElementById('navbar');

    // Forms
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    
    // Buttons and elements
    logoutBtn = document.getElementById('logoutBtn');
    userInfo = document.getElementById('userInfo');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Register form
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Show register form
    document.getElementById('showRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.login-box:first-of-type').style.display = 'none';
        registerBox.style.display = 'block';
    });

    // Show login form
    document.getElementById('showLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        registerBox.style.display = 'none';
        document.querySelector('.login-box:first-of-type').style.display = 'block';
    });

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

/**
 * Handle user login
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('loginError');

    // Clear previous errors
    errorElement.textContent = '';

    // Validate inputs
    if (!email || !password) {
        errorElement.textContent = 'Please enter email and password';
        return;
    }

    // Show loading
    showLoading();

    // Attempt login
    const result = await loginUser(email, password);

    hideLoading();

    if (result.success) {
        console.log('Login successful');
        loginForm.reset();
        // Auth state observer will handle showing the app
    } else {
        errorElement.textContent = result.error || 'Login failed. Please try again.';
    }
}

/**
 * Handle user registration
 */
async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const businessName = document.getElementById('regBusiness').value.trim();
    const errorElement = document.getElementById('registerError');

    // Clear previous errors
    errorElement.textContent = '';

    // Validate inputs
    if (!name || !email || !password || !role) {
        errorElement.textContent = 'Please fill in all required fields';
        return;
    }

    if (password.length < VALIDATION.MIN_PASSWORD_LENGTH) {
        errorElement.textContent = `Password must be at least ${VALIDATION.MIN_PASSWORD_LENGTH} characters`;
        return;
    }

    // Show loading
    showLoading();

    // Attempt registration
    const result = await registerUser(email, password, {
        name,
        role,
        businessName
    });

    hideLoading();

    if (result.success) {
        console.log('Registration successful');
        registerForm.reset();
        // Auth state observer will handle showing the app
    } else {
        errorElement.textContent = result.error || 'Registration failed. Please try again.';
    }
}

/**
 * Handle user logout
 */
async function handleLogout() {
    showLoading();
    const result = await logoutUser();
    hideLoading();

    if (result.success) {
        console.log('Logout successful');
        // Auth state observer will handle showing login screen
    } else {
        alert('Logout failed: ' + result.error);
    }
}

/**
 * Show main app interface (called by auth observer)
 */
function showApp() {
    if (!currentUserData) {
        console.error('No user data available');
        showLogin();
        return;
    }

    // Hide login, show app
    loginScreen.style.display = 'none';
    appContainer.style.display = 'block';

    // Update user info in navbar
    const roleBadge = getRoleBadge(currentUserData.role);
    userInfo.innerHTML = `
        <span style="font-weight: 600;">${currentUserData.name}</span>
        <span style="background: ${roleBadge.color}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
            ${roleBadge.label}
        </span>
    `;

    // Load role-based dashboard
    loadDashboard(currentUserData.role);
}

/**
 * Show login screen (called by auth observer)
 */
function showLogin() {
    loginScreen.style.display = 'block';
    appContainer.style.display = 'none';
    registerBox.style.display = 'none';
    document.querySelector('.login-box:first-of-type').style.display = 'block';
}

/**
 * Load dashboard based on user role
 */
function loadDashboard(role) {
    const capabilities = ROLE_CAPABILITIES[role];
    
    let dashboardHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h1 style="color: #667eea; margin-bottom: 0.5rem;">Welcome, ${currentUserData.name}!</h1>
            <p style="color: #666; font-size: 1.1rem;">Role: <strong>${getRoleDisplayName(role)}</strong></p>
        </div>

        <div class="dashboard">
    `;

    // Manufacturer Dashboard
    if (role === ROLES.MANUFACTURER) {
        dashboardHTML += `
            <div class="card">
                <h3>📦 Products</h3>
                <p>Create and manage your products</p>
                <button class="btn-primary" onclick="loadProductsPage()">Manage Products</button>
            </div>
            <div class="card">
                <h3>🏭 Raw Materials</h3>
                <p>Track your raw materials inventory</p>
                <button class="btn-primary" onclick="loadRawMaterialsPage()">View Raw Materials</button>
            </div>
            <div class="card">
                <h3>🛒 Purchase Raw Materials</h3>
                <p>Buy raw materials from suppliers</p>
                <button class="btn-primary" onclick="loadPurchasePage()">Make Purchase</button>
            </div>
            <div class="card">
                <h3>📊 Inventory</h3>
                <p>Monitor finished goods stock</p>
                <button class="btn-primary" onclick="loadInventoryPage()">View Inventory</button>
            </div>
            <div class="card">
                <h3>📋 Orders</h3>
                <p>Manage incoming orders from buyers</p>
                <button class="btn-success" onclick="loadOrderManagementPage()">Manage Orders</button>
            </div>
            <div class="card">
                <h3>🤝 Sales</h3>
                <p>Sell to distributors, retailers, or buyers</p>
                <button class="btn-success" onclick="loadSalesPage()">Create Sale</button>
            </div>
            <div class="card">
                <h3>📄 Invoices</h3>
                <p>View all invoices (sales & purchases)</p>
                <button class="btn-primary" onclick="loadInvoicesPage()">View Invoices</button>
            </div>
        `;
    }

    // Distributor Dashboard
    if (role === ROLES.DISTRIBUTOR) {
        dashboardHTML += `
            <div class="card">
                <h3>📦 Inventory</h3>
                <p>View and manage your stock</p>
                <button class="btn-primary" onclick="loadInventoryPage()">View Inventory</button>
            </div>
            <div class="card">
                <h3>🛒 Purchase</h3>
                <p>Search and buy from sellers</p>
                <button class="btn-primary" onclick="loadPurchasePage()">Purchase</button>
            </div>
            <div class="card">
                <h3>📋 Orders (Sales)</h3>
                <p>Approve/reject incoming orders</p>
                <button class="btn-success" onclick="loadSalesPage()">Manage Orders</button>
            </div>
            <div class="card">
                <h3>📄 Invoices</h3>
                <p>View generated invoices</p>
                <button class="btn-primary" onclick="loadInvoicesPage()">View Invoices</button>
            </div>
        `;
    }

    // Retailer Dashboard
    if (role === ROLES.RETAILER) {
        dashboardHTML += `
            <div class="card">
                <h3>📦 Inventory</h3>
                <p>View and manage your stock</p>
                <button class="btn-primary" onclick="loadInventoryPage()">View Inventory</button>
            </div>
            <div class="card">
                <h3>🛒 Purchase</h3>
                <p>Search and buy products</p>
                <button class="btn-primary" onclick="loadPurchasePage()">Purchase</button>
            </div>
            <div class="card">
                <h3>📋 Orders (Sales)</h3>
                <p>Approve/reject incoming orders</p>
                <button class="btn-success" onclick="loadSalesPage()">Manage Orders</button>
            </div>
            <div class="card">
                <h3>🛍️ Walk-in Customer</h3>
                <p>Help customers without smartphone</p>
                <button class="btn-success" onclick="loadWalkInSalePage()">Quick Sale</button>
            </div>
            <div class="card">
                <h3>📄 Invoices</h3>
                <p>View generated invoices</p>
                <button class="btn-primary" onclick="loadInvoicesPage()">View Invoices</button>
            </div>
        `;
    }

    // Buyer Dashboard
    if (role === ROLES.BUYER) {
        dashboardHTML += `
            <div class="card">
                <h3>🛒 Make Purchase</h3>
                <p>Buy products from sellers</p>
                <button class="btn-success" onclick="loadPurchasePage()">Browse Products</button>
            </div>
            <div class="card">
                <h3>📄 My Invoices</h3>
                <p>View your purchase invoices</p>
                <button class="btn-primary" onclick="loadInvoicesPage()">View Invoices</button>
            </div>
            <div class="card">
                <h3>📊 Purchase History</h3>
                <p>Track all your purchases</p>
                <button class="btn-primary" onclick="loadTransactionHistoryPage()">View History</button>
            </div>
        `;
    }

    dashboardHTML += `</div>`;

    mainContent.innerHTML = dashboardHTML;
}

// ========================================
// PAGE NAVIGATION FUNCTIONS
// ========================================

/**
 * Load Products Management Page
 */
function loadProductsPage() {
    console.log('Loading Products Page...');
    if (typeof showProductsPage === 'function') {
        showProductsPage();
    } else {
        showComingSoon('Products Management');
    }
}

/**
 * Load Raw Materials Page
 */
function loadRawMaterialsPage() {
    console.log('Loading Raw Materials Page...');
    if (typeof showRawMaterialsPage === 'function') {
        showRawMaterialsPage();
    } else {
        showComingSoon('Raw Materials Management');
    }
}

/**
 * Load Inventory Page
 */
function loadInventoryPage() {
    console.log('Loading Inventory Page...');
    if (typeof showInventoryPage === 'function') {
        showInventoryPage();
    } else {
        showComingSoon('Inventory Management');
    }
}

/**
 * Load Order Management Page
 */
function loadOrderManagementPage() {
    console.log('Loading Order Management Page...');
    if (typeof showOrderManagementPage === 'function') {
        showOrderManagementPage();
    } else {
        showComingSoon('Order Management');
    }
}

/**
 * Load Purchase Page
 */
function loadPurchasePage() {
    console.log('Loading Purchase Page...');
    if (typeof showPurchasePage === 'function') {
        showPurchasePage();
    } else {
        showComingSoon('Purchase System');
    }
}

/**
 * Load Sales Page
 */
function loadSalesPage() {
    console.log('Loading Sales Page...');
    if (typeof showSalesPage === 'function') {
        showSalesPage();
    } else {
        showComingSoon('Sales System');
    }
}

/**
 * Load Walk-in Sale Page
 */
function loadWalkInSalePage() {
    console.log('Loading Walk-in Sale Page...');
    if (typeof showWalkInSalePage === 'function') {
        showWalkInSalePage();
    } else {
        showComingSoon('Walk-in Customer Sale');
    }
}

/**
 * Load Invoices Page
 */
function loadInvoicesPage() {
    console.log('Loading Invoices Page...');
    if (typeof showInvoicesPage === 'function') {
        showInvoicesPage();
    } else {
        showComingSoon('Invoice Management');
    }
}

/**
 * Load Transaction History Page
 */
function loadTransactionHistoryPage() {
    console.log('Loading Transaction History Page...');
    if (typeof showTransactionHistoryPage === 'function') {
        showTransactionHistoryPage();
    } else {
        showComingSoon('Transaction History');
    }
}

/**
 * Show coming soon message with back to dashboard option
 */
function showComingSoon(featureName) {
    mainContent.innerHTML = `
        <div style="background: white; padding: 3rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center;">
            <h2 style="color: #667eea; margin-bottom: 1rem;">🚧 ${featureName}</h2>
            <p style="color: #666; font-size: 1.1rem; margin-bottom: 2rem;">This feature is coming soon!</p>
            <button class="btn-primary" onclick="loadDashboard('${currentUserData.role}')">Back to Dashboard</button>
        </div>
    `;
}

/**
 * Get role display name
 */
function getRoleDisplayName(role) {
    const roleNames = {
        [ROLES.MANUFACTURER]: 'Manufacturer',
        [ROLES.DISTRIBUTOR]: 'Distributor',
        [ROLES.RETAILER]: 'Retailer',
        [ROLES.BUYER]: 'Buyer'
    };
    return roleNames[role] || role;
}

/**
 * Get role badge styling
 */
function getRoleBadge(role) {
    const badges = {
        [ROLES.MANUFACTURER]: { label: 'Manufacturer', color: '#667eea' },
        [ROLES.DISTRIBUTOR]: { label: 'Distributor', color: '#f093fb' },
        [ROLES.RETAILER]: { label: 'Retailer', color: '#4facfe' },
        [ROLES.BUYER]: { label: 'Buyer', color: '#43e97b' }
    };
    return badges[role] || { label: role, color: '#999' };
}

/**
 * Show loading screen
 */
function showLoading() {
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
    }
}

/**
 * Hide loading screen
 */
function hideLoading() {
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
}

/**
 * Display error message
 */
function showError(message) {
    alert('Error: ' + message);
}

/**
 * Display success message
 */
function showSuccess(message) {
    alert('Success: ' + message);
}

console.log('App.js loaded successfully');
