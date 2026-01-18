// Product Model - Handles all product-related operations

/**
 * Create a new product (Manufacturers only)
 * @param {Object} productData - Product information
 * @returns {Promise<Object>} Result with product ID or error
 */
async function createProduct(productData) {
    try {
        // Get the REAL Firebase authenticated user directly from the source
        const authUser = firebase.auth().currentUser;
        
        if (!authUser) {
            console.error('❌ createProduct: No authenticated user');
            return {
                success: false,
                error: 'You must be logged in to create products'
            };
        }

        // Verify user data is loaded and role is correct
        if (!currentUserData) {
            return {
                success: false,
                error: 'User profile syncing. Please try again in a moment.'
            };
        }

        if (currentUserData.role !== ROLES.MANUFACTURER) {
            return {
                success: false,
                error: 'Unauthorized: Only manufacturers can create products'
            };
        }

        // Validate required fields
        if (!productData.name || !productData.unit) {
            return {
                success: false,
                error: 'Product name and unit are required'
            };
        }

        // Generate or validate SKU
        const sku = productData.sku || generateSKU(productData.name);

        // Check if SKU already exists
        const existingSKU = await db.collection(COLLECTIONS.PRODUCTS)
            .where('sku', '==', sku)
            .limit(1)
            .get();

        if (!existingSKU.empty) {
            return {
                success: false,
                error: 'Product SKU already exists. Please use a different SKU.'
            };
        }

        // Create product document
        const productRef = db.collection(COLLECTIONS.PRODUCTS).doc();
        const product = {
            id: productRef.id,
            name: productData.name.trim(),
            sku: sku,
            unit: productData.unit,
            description: productData.description?.trim() || '',
            vatRate: productData.vatRate || 0,
            manufacturerId: authUser.uid, // Use direct Auth UID
            manufacturerName: currentUserData.name,
            createdAt: getTimestamp(),
            createdBy: authUser.uid,
            updatedAt: getTimestamp()
        };

        await productRef.set(product);

        return {
            success: true,
            productId: product.id,
            product: product
        };

    } catch (error) {
        console.error('❌ Error creating product:', error);
        return {
            success: false,
            error: error.message || 'Failed to create product'
        };
    }
}

/**
 * Get products created by current user
 * UPDATED: Uses direct UID and reliable query logic
 * @returns {Promise<Array>} Array of user's products
 */
async function getMyProducts() {
    const authUser = firebase.auth().currentUser;
    
    if (!authUser) {
        console.warn('❌ getMyProducts: No auth user');
        return [];
    }

    try {
        // Query products where manufacturerId matches the current user's UID
        const snapshot = await db.collection(COLLECTIONS.PRODUCTS)
            .where('manufacturerId', '==', authUser.uid)
            .get();
        
        const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort by date locally to avoid index errors if not yet created
        return products.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error('❌ Error in getMyProducts:', error);
        return [];
    }
}

/**
 * Get product by ID
 */
async function getProduct(productId) {
    try {
        const productDoc = await db.collection(COLLECTIONS.PRODUCTS).doc(productId).get();
        return productDoc.exists ? { id: productDoc.id, ...productDoc.data() } : null;
    } catch (error) {
        console.error('Error getting product:', error);
        return null;
    }
}

/**
 * Update product information
 */
async function updateProduct(productId, updates) {
    try {
        const authUser = firebase.auth().currentUser;
        if (!authUser) return { success: false, error: 'Not logged in' };

        const product = await getProduct(productId);
        if (!product || product.manufacturerId !== authUser.uid) {
            return { success: false, error: 'Unauthorized' };
        }

        const allowedUpdates = {
            name: updates.name.trim(),
            unit: updates.unit,
            description: updates.description?.trim() || '',
            vatRate: updates.vatRate || 0,
            updatedAt: getTimestamp()
        };

        await db.collection(COLLECTIONS.PRODUCTS).doc(productId).update(allowedUpdates);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete product (if no stock exists)
 */
async function deleteProduct(productId) {
    try {
        const authUser = firebase.auth().currentUser;
        const product = await getProduct(productId);
        
        if (!product || product.manufacturerId !== authUser.uid) {
            return { success: false, error: 'Unauthorized' };
        }

        const stockSnapshot = await db.collection(COLLECTIONS.STOCK)
            .where('productId', '==', productId)
            .limit(1)
            .get();

        if (!stockSnapshot.empty) {
            return { success: false, error: 'Cannot delete: Stock exists in system.' };
        }

        await db.collection(COLLECTIONS.PRODUCTS).doc(productId).delete();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function generateSKU(productName) {
    const prefix = productName.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${prefix}-${Date.now().toString().slice(-6)}`;
}

console.log('✅ Product model loaded');
