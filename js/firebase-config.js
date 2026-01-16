// Firebase Configuration and Initialization

const firebaseConfig = {
    apiKey: "AIzaSyAyBXSDWakPZYLTbnD-EtINzx1ylybtKMk",
    authDomain: "ebmrwanda-492ea.firebaseapp.com",
    projectId: "ebmrwanda-492ea",
    storageBucket: "ebmrwanda-492ea.firebasestorage.app",
    messagingSenderId: "231667451559",
    appId: "1:231667451559:web:a6501ff0f39f6e938f3d82"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence (optional but recommended)
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('Persistence not available in this browser');
        }
    });

// Auth State Observer
let currentUser = null;
let currentUserData = null;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        console.log('User authenticated:', user.email);
        
        // Load user data from Firestore
        try {
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
            if (userDoc.exists) {
                currentUserData = { id: user.uid, ...userDoc.data() };
                console.log('User role:', currentUserData.role);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        
        // Show main app
        if (typeof showApp === 'function') {
            showApp();
        }
    } else {
        currentUser = null;
        currentUserData = null;
        console.log('User logged out');
        
        // Show login screen
        if (typeof showLogin === 'function') {
            showLogin();
        }
    }
});

// Helper Functions

/**
 * Get current authenticated user
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Get current user data including role
 */
function getCurrentUserData() {
    return currentUserData;
}

/**
 * Check if user has specific role
 */
function hasRole(role) {
    return currentUserData && currentUserData.role === role;
}

/**
 * Check if user can create products
 */
function canCreateProducts() {
    if (!currentUserData) return false;
    return ROLE_CAPABILITIES[currentUserData.role]?.canCreateProducts || false;
}

/**
 * Check if user can manage raw materials
 */
function canManageRawMaterials() {
    if (!currentUserData) return false;
    return ROLE_CAPABILITIES[currentUserData.role]?.canManageRawMaterials || false;
}

/**
 * Check if user can sell to a specific role
 */
function canSellTo(buyerRole) {
    if (!currentUserData) return false;
    const capabilities = ROLE_CAPABILITIES[currentUserData.role];
    return capabilities?.canSellTo.includes(buyerRole) || false;
}

/**
 * Check if user can buy from a specific role
 */
function canBuyFrom(sellerRole) {
    if (!currentUserData) return false;
    const capabilities = ROLE_CAPABILITIES[currentUserData.role];
    return capabilities?.canBuyFrom.includes(sellerRole) || false;
}

/**
 * Register new user
 */
async function registerUser(email, password, userData) {
    try {
        // Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Create user document in Firestore
        await db.collection(COLLECTIONS.USERS).doc(user.uid).set({
            email: email,
            name: userData.name,
            role: userData.role,
            businessName: userData.businessName || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            metadata: {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }
        });

        console.log('User registered successfully:', user.uid);
        return { success: true, user };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Login user
 */
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        // Update last login
        await db.collection(COLLECTIONS.USERS).doc(userCredential.user.uid).update({
            'metadata.lastLogin': firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('User logged in:', userCredential.user.email);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Logout user
 */
async function logoutUser() {
    try {
        await auth.signOut();
        console.log('User logged out successfully');
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Firestore batch transaction helper
 */
function createBatch() {
    return db.batch();
}

/**
 * Get Firestore timestamp
 */
function getTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}

/**
 * Generate unique ID
 */
function generateId() {
    return db.collection('_dummy').doc().id;
}

console.log('Firebase initialized succussfully');
  
