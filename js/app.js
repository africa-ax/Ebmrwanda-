// ===============================
// Main Application Logic (FIXED)
// ===============================

// DOM Elements
let loadingScreen, loginScreen, registerBox, appContainer, mainContent, navbar;
let loginForm, registerForm, logoutBtn, userInfo;

// App state
let currentUserData = null;

// Firebase shortcuts
const auth = firebase.auth();
const db = firebase.firestore();

// ===============================
// INIT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Smart Commerce System...');
    initializeDOM();
    setupEventListeners();
    initAuthObserver(); // 🔑 CRITICAL FIX
    hideLoading();
});

// ===============================
// AUTH STATE OBSERVER (CORE FIX)
// ===============================
function initAuthObserver() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            currentUserData = null;
            showLogin();
            return;
        }

        const uid = user.uid;
        const userRef = db.collection("users").doc(uid);

        try {
            const snap = await userRef.get();

            // ✅ GUARANTEE USER DOCUMENT EXISTS
            if (!snap.exists) {
                await userRef.set({
                    email: user.email,
                    name: user.displayName || "User",
                    role: ROLES.BUYER, // default
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            currentUserData = (await userRef.get()).data();
            showApp();

        } catch (err) {
            console.error("Auth observer error:", err);
            showLogin();
        }
    });
}

// ===============================
// DOM SETUP
// ===============================
function initializeDOM() {
    loadingScreen = document.getElementById('loading');
    loginScreen = document.getElementById('loginScreen');
    registerBox = document.getElementById('registerBox');
    appContainer = document.getElementById('app');
    mainContent = document.getElementById('mainContent');
    navbar = document.getElementById('navbar');

    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');

    logoutBtn = document.getElementById('logoutBtn');
    userInfo = document.getElementById('userInfo');
}

function setupEventListeners() {
    loginForm?.addEventListener('submit', handleLogin);
    registerForm?.addEventListener('submit', handleRegister);
    logoutBtn?.addEventListener('click', handleLogout);

    document.getElementById('showRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.login-box:first-of-type').style.display = 'none';
        registerBox.style.display = 'block';
    });

    document.getElementById('showLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        registerBox.style.display = 'none';
        document.querySelector('.login-box:first-of-type').style.display = 'block';
    });
}

// ===============================
// AUTH ACTIONS
// ===============================
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';

    if (!email || !password) {
        errorElement.textContent = 'Please enter email and password';
        return;
    }

    showLoading();
    try {
        await auth.signInWithEmailAndPassword(email, password);
        loginForm.reset();
    } catch (err) {
        errorElement.textContent = err.message;
    }
    hideLoading();
}

async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const businessName = document.getElementById('regBusiness').value.trim();
    const errorElement = document.getElementById('registerError');
    errorElement.textContent = '';

    if (!name || !email || !password || !role) {
        errorElement.textContent = 'Please fill in all required fields';
        return;
    }

    showLoading();
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection("users").doc(cred.user.uid).set({
            name,
            email,
            role,
            businessName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        registerForm.reset();
    } catch (err) {
        errorElement.textContent = err.message;
    }
    hideLoading();
}

async function handleLogout() {
    showLoading();
    await auth.signOut();
    hideLoading();
}

// ===============================
// UI
// ===============================
function showApp() {
    if (!currentUserData) return showLogin();

    loginScreen.style.display = 'none';
    appContainer.style.display = 'block';

    const roleBadge = getRoleBadge(currentUserData.role);
    userInfo.innerHTML = `
        <strong>${currentUserData.name}</strong>
        <span style="background:${roleBadge.color};color:#fff;padding:4px 10px;border-radius:10px;">
            ${roleBadge.label}
        </span>
    `;

    loadDashboard(currentUserData.role);
}

function showLogin() {
    loginScreen.style.display = 'block';
    appContainer.style.display = 'none';
    registerBox.style.display = 'none';
    document.querySelector('.login-box:first-of-type').style.display = 'block';
}

// ===============================
// HELPERS
// ===============================
function showLoading() {
    loadingScreen && (loadingScreen.style.display = 'flex');
}

function hideLoading() {
    loadingScreen && (loadingScreen.style.display = 'none');
}

console.log('✅ App.js loaded and FIXED');
