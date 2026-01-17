// AuthController.js
import { ROLES } from "../utils/constants.js";

class AuthController {
    constructor(auth, db) {
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.currentUserData = null;
    }

    // 🔑 Auth state listener (CORE)
    initAuthObserver(onLogin, onLogout) {
        this.auth.onAuthStateChanged(async (user) => {
            if (!user) {
                this.currentUser = null;
                this.currentUserData = null;
                onLogout();
                return;
            }

            this.currentUser = user;
            const uid = user.uid;
            const userRef = this.db.collection("users").doc(uid);

            try {
                const snap = await userRef.get();

                // ✅ Guarantee user document exists
                if (!snap.exists) {
                    await userRef.set({
                        email: user.email,
                        role: ROLES.BUYER, // default role
                        name: user.displayName || "User",
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                this.currentUserData = (await userRef.get()).data();
                onLogin(this.currentUserData);

            } catch (err) {
                console.error("Auth initialization failed:", err);
                onLogout();
            }
        });
    }

    // Login
    async login(email, password) {
        try {
            await this.auth.signInWithEmailAndPassword(email, password);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Register
    async register(email, password, profileData) {
        try {
            const cred = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = cred.user;

            await this.db.collection("users").doc(user.uid).set({
                ...profileData,
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Logout
    async logout() {
        try {
            await this.auth.signOut();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    getUser() {
        return this.currentUserData;
    }
}

export default AuthController;
                                     
