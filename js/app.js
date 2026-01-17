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
                <button class="btn-primary" onclick="alert('Products feature coming next!')">Manage Products</button>
            </div>
            <div class="card">
                <h3>🏭 Raw Materials</h3>
                <p>Track your raw materials inventory</p>
                <button class="btn-primary" onclick="alert('Raw Materials feature coming next!')">View Raw Materials</button>
            </div>
            <div class="card">
                <h3>🛒 Purchase Raw Materials</h3>
                <p>Buy raw materials from suppliers</p>
                <button class="btn-primary" onclick="alert('Purchase feature coming next!')">Make Purchase</button>
            </div>
            <div class="card">
                <h3>📊 Inventory</h3>
                <p>Monitor finished goods stock</p>
                <button class="btn-primary" onclick="alert('Inventory feature coming next!')">View Inventory</button>
            </div>
            <div class="card">
                <h3>🤝 Sales</h3>
                <p>Sell to distributors, retailers, or buyers</p>
                <button class="btn-success" onclick="alert('Sales feature coming next!')">Create Sale</button>
            </div>
            <div class="card">
                <h3>📄 Invoices</h3>
                <p>View all invoices (sales & purchases)</p>
                <button class="btn-primary" onclick="alert('Invoices feature coming next!')">View Invoices</button>
            </div>
        `;
    }

    // Distributor Dashboard
    if (role === ROLES.DISTRIBUTOR) {
        dashboardHTML += `
            <div class="card">
                <h3>📦 Inventory</h3>
                <p>View and manage your stock</p>
                <button class="btn-primary" onclick="alert('Inventory feature coming next!')">View Inventory</button>
            </div>
            <div class="card">
                <h3>🛒 Purchase</h3>
                <p>Buy from manufacturers</p>
                <button class="btn-primary" onclick="alert('Purchase feature coming next!')">Make Purchase</button>
            </div>
            <div class="card">
                <h3>🤝 Sales</h3>
                <p>Sell to retailers or buyers</p>
                <button class="btn-success" onclick="alert('Sales feature coming next!')">Create Sale</button>
            </div>
            <div class="card">
                <h3>📄 Invoices</h3>
                <p>View generated invoices</p>
                <button class="btn-primary" onclick="alert('Invoices feature coming next!')">View Invoices</button>
            </div>
        `;
    }

    // Retailer Dashboard
    if (role === ROLES.RETAILER) {
        dashboardHTML += `
            <div class="card">
                <h3>📦 Inventory</h3>
                <p>View and manage your stock</p>
                <button class="btn-primary" onclick="alert('Inventory feature coming next!')">View Inventory</button>
            </div>
            <div class="card">
                <h3>🛒 Purchase</h3>
                <p>Buy from manufacturers or distributors</p>
                <button class="btn-primary" onclick="alert('Purchase feature coming next!')">Make Purchase</button>
            </div>
            <div class="card">
                <h3>🤝 Sales</h3>
                <p>Sell to buyers</p>
                <button class="btn-success" onclick="alert('Sales feature coming next!')">Create Sale</button>
            </div>
            <div class="card">
                <h3>🛍️ Sell to Walk-in Customer</h3>
                <p>Help customers without smartphone</p>
                <button class="btn-success" onclick="alert('Walk-in Sale feature coming next!')">Quick Sale</button>
            </div>
            <div class="card">
                <h3>📄 Invoices</h3>
                <p>View generated invoices</p>
                <button class="btn-primary" onclick="alert('Invoices feature coming next!')">View Invoices</button>
            </div>
        `;
    }

    // Buyer Dashboard
    if (role === ROLES.BUYER) {
        dashboardHTML += `
            <div class="card">
                <h3>🛒 Make Purchase</h3>
                <p>Buy products from sellers</p>
                <button class="btn-success" onclick="alert('Purchase feature coming next!')">Browse Products</button>
            </div>
            <div class="card">
                <h3>📄 My Invoices</h3>
                <p>View your purchase invoices</p>
                <button class="btn-primary" onclick="alert('Invoices feature coming next!')">View Invoices</button>
            </div>
            <div class="card">
                <h3>📊 Purchase History</h3>
                <p>Track all your purchases</p>
                <button class="btn-primary" onclick="alert('History feature coming next!')">View History</button>
            </div>
        `;
    }

    dashboardHTML += `</div>`;

    mainContent.innerHTML = dashboardHTML;
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

    
