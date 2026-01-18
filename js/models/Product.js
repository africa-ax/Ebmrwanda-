window.getAllProducts = getAllProducts;

// Product Model - Handles all product-related operations

async function createProduct(productData) {
    try {
        const authUser = firebase.auth().currentUser;

        if (!authUser || !currentUserData || currentUserData.role !== ROLES.MANUFACTURER) {
            return {
                success: false,
                error: ERROR_MESSAGES.UNAUTHORIZED + ': Only manufacturers can create products'
            };
        }

        if (!productData.name || !productData.unit) {
            return {
                success: false,
                error: 'Product name and unit are required'
            };
        }

        const vatRate = productData.vatRate !== undefined ? productData.vatRate : 0;
        if (vatRate < 0 || vatRate > 100) {
            return {
                success: false,
                error: 'VAT rate must be between 0 and 100'
            };
        }

        if (productData.name.length > VALIDATION.MAX_PRODUCT_NAME_LENGTH) {
            return {
                success: false,
                error: `Product name must be less than ${VALIDATION.MAX_PRODUCT_NAME_LENGTH} characters`
            };
        }

        if (productData.description && productData.description.length > VALIDATION.MAX_DESCRIPTION_LENGTH) {
            return {
                success: false,
                error: `Description must be less than ${VALIDATION.MAX_DESCRIPTION_LENGTH} characters`
            };
        }

        const sku = productData.sku || generateSKU(productData.name);

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

        const productRef = db.collection(COLLECTIONS.PRODUCTS).doc();
        const product = {
            id: productRef.id,
            name: productData.name.trim(),
            sku,
            unit: productData.unit,
            description: productData.description?.trim() || '',
            vatRate,
            manufacturerId: authUser.uid,
            manufacturerName: currentUserData.name,
            createdAt: getTimestamp(),
            createdBy: authUser.uid,
            updatedAt: getTimestamp()
        };

        await productRef.set(product);

        return { success: true, productId: product.id, product };

    } catch (error) {
        console.error('Error creating product:', error);
        return { success: false, error: error.message };
    }
}

async function getMyProducts() {
    const authUser = firebase.auth().currentUser;

    if (!authUser || !currentUserData) return [];

    if (currentUserData.role !== ROLES.MANUFACTURER) return [];

    return await getAllProducts(authUser.uid);
}

async function updateProduct(productId, updates) {
    try {
        const authUser = firebase.auth().currentUser;

        if (!authUser) {
            return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
        }

        const product = await getProduct(productId);

        if (!product) {
            return { success: false, error: ERROR_MESSAGES.PRODUCT_NOT_FOUND };
        }

        if (product.manufacturerId !== authUser.uid) {
            return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
        }

        const allowedUpdates = {};

        if (updates.name) {
            if (updates.name.length > VALIDATION.MAX_PRODUCT_NAME_LENGTH) {
                return { success: false, error: 'Product name too long' };
            }
            allowedUpdates.name = updates.name.trim();
        }

        if (updates.description !== undefined) {
            if (updates.description.length > VALIDATION.MAX_DESCRIPTION_LENGTH) {
                return { success: false, error: 'Description too long' };
            }
            allowedUpdates.description = updates.description.trim();
        }

        if (updates.unit) allowedUpdates.unit = updates.unit;

        if (updates.vatRate !== undefined) {
            if (updates.vatRate < 0 || updates.vatRate > 100) {
                return { success: false, error: 'Invalid VAT rate' };
            }
            allowedUpdates.vatRate = updates.vatRate;
        }

        allowedUpdates.updatedAt = getTimestamp();

        await db.collection(COLLECTIONS.PRODUCTS).doc(productId).update(allowedUpdates);

        return { success: true, productId };

    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
}

async function deleteProduct(productId) {
    try {
        const authUser = firebase.auth().currentUser;

        if (!authUser) {
            return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
        }

        const product = await getProduct(productId);

        if (!product) {
            return { success: false, error: ERROR_MESSAGES.PRODUCT_NOT_FOUND };
        }

        if (product.manufacturerId !== authUser.uid) {
            return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
        }

        const stockSnapshot = await db.collection(COLLECTIONS.STOCK)
            .where('productId', '==', productId)
            .limit(1)
            .get();

        if (!stockSnapshot.empty) {
            return { success: false, error: 'Stock exists for this product' };
        }

        await db.collection(COLLECTIONS.PRODUCTS).doc(productId).delete();

        return { success: true, productId };

    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
}

console.log('Product model loaded');
