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

// Enable offline persistence
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
        
        try {
            // Load user data from Firestore
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
            if (userDoc.exists) {
                // FIX: Ensure both .id and .uid exist to satisfy different parts of the code
                currentUserData = { 
                    id: user.uid, 
                    uid: user.uid, 
                    ...userDoc.data() 
                };
                console.log('User data synced:', currentUserData.role);
            } else {
                console.warn('User document not found in Firestore for UID:', user.uid);
                currentUserData = null;
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        
        // Trigger UI Update
        if (typeof showApp === 'function') {
            showApp();
        }
    } else {
        currentUser = null;
        currentUserData = null;
        console.log('User logged out');
        
        if (typeof showLogin === 'function') {
            showLogin();
        }
    }
});

// Helper Functions

function getCurrentUser() {
    return currentUser;
}

function getCurrentUserData() {
    return currentUserData;
}

function hasRole(role) {
    return currentUserData && currentUserData.role === role;
}

/**
 * Register new user
 */
async function registerUser(email, password, userData) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const profile = {
            email: email,
            name: userData.name,
            role: userData.role,
            businessName: userData.businessName || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            metadata: {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }
        };

        await db.collection(COLLECTIONS.USERS).doc(user.uid).set(profile);
        
        // Pre-populate currentUserData to speed up UI response
        currentUserData = { id: user.uid, uid: user.uid, ...profile };

        console.log('User registered successfully:', user.uid);
        return { success: true, user };
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = error.message;
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered.';
        }
        return { success: false, error: errorMessage };
    }
}

/**
 * Login user
 */
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        await db.collection(COLLECTIONS.USERS).doc(userCredential.user.uid).set({
            metadata: {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

async function logoutUser() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function createBatch() { return db.batch(); }
function getTimestamp() { return firebase.firestore.FieldValue.serverTimestamp(); }

console.log('Firebase initialized successfully');
