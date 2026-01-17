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
            } else {
                console.warn('User document not found in Firestore');
                // User authenticated but no Firestore document - this shouldn't happen
                // Try to create it if we have the user's email
                currentUserData = null;
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
 * FIXED: Proper error handling and document creation
 */
async function registerUser(email, password, userData) {
    try {
        // Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Create user document in Firestore using SET (not update)
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
        
        // Provide user-friendly error messages
        let errorMessage = error.message;
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please login instead.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        }
        
        return { success: false, error: errorMessage };
    }
}

/**
 * Login user
 * FIXED: Use SET with merge instead of UPDATE to avoid "no document" error
 */
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        // Use SET with merge option instead of UPDATE
        // This creates the document if it doesn't exist
        await db.collection(COLLECTIONS.USERS).doc(userCredential.user.uid).set({
            metadata: {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true }); // CRITICAL: merge option prevents overwriting existing data

        console.log('User logged in:', userCredential.user.email);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Login error:', error);
        
        // Provide user-friendly error messages
        let errorMessage = error.message;
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please register first.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed login attempts. Please try again later.';
        }
        
        return { success: false, error: errorMessage };
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

console.log('Firebase initialized successfully');
    
