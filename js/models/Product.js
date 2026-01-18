// Product Model - Handles all product-related operations

/**
 * Create a new product (Manufacturers only)
 * @param {Object} productData - Product information
 * @returns {Promise<Object>} Result with product ID or error
 */
async function createProduct(productData) {
    try {
        // Get the REAL Firebase authenticated user
        const authUser = firebase.auth().currentUser;
        
        if (!authUser) {
            console.error('❌ createProduct: No authenticated user');
            return {
                success: false,
                error: 'You must be logged in to create products'
            };
        }

        console.log('📝 createProduct called - User UID:', authUser.uid);
        console.log('📝 Product data:', productData);
        console.log('📝 currentUserData:', currentUserData);

        // Verify user is a manufacturer using currentUserData (for role check only)
        if (!currentUserData) {
            console.error('❌ createProduct: currentUserData is null/undefined');
            return {
                success: false,
                error: 'User data not loaded. Please refresh the page.'
            };
        }

        if (currentUserData.role !== ROLES.MANUFACTURER) {
            console.error('❌ createProduct: User is not manufacturer. Role:', currentUserData.role);
            return {
                success: false,
                error: ERROR_MESSAGES.UNAUTHORIZED + ': Only manufacturers can create products'
            };
        }

        // Validate required fields
        if (!productData.name || !productData.unit) {
            return {
                success: false,
                error: 'Product name and unit are required'
            };
        }

        // Validate VAT rate
        const vatRate = productData.vatRate !== undefined ? productData.vatRate : 0;
        if (vatRate < 0 || vatRate > 100) {
            return {
                success: false,
                error: 'VAT rate must be between 0 and 100'
            };
        }

        // Validate product name length
        if (productData.name.length > VALIDATION.MAX_PRODUCT_NAME_LENGTH) {
            return {
                success: false,
                error: `Product name must be less than ${VALIDATION.MAX_PRODUCT_NAME_LENGTH} characters`
            };
        }

        // Validate description if provided
        if (productData.description && productData.description.length > VALIDATION.MAX_DESCRIPTION_LENGTH) {
            return {
                success: false,
                error: `Description must be less than ${VALIDATION.MAX_DESCRIPTION_LENGTH} characters`
            };
        }

        // Generate unique SKU if not provided
        const sku = productData.sku || generateSKU(productData.name);
        console.log('📝 Generated SKU:', sku);

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
            vatRate: vatRate, // VAT percentage (e.g., 18 for 18%)
            manufacturerId: authUser.uid, // USE REAL FIREBASE UID
            manufacturerName: currentUserData.name,
            createdAt: getTimestamp(),
            createdBy: authUser.uid, // USE REAL FIREBASE UID
            updatedAt: getTimestamp()
        };

        console.log('📝 Saving product to Firestore:', product);

        await productRef.set(product);

        // Verify the product was saved
        const verifyDoc = await productRef.get();
        console.log('✅ Product created successfully!');
        console.log('✅ Product ID:', product.id);
        console.log('✅ Manufacturer UID:', authUser.uid);
        console.log('✅ Saved document exists:', verifyDoc.exists);
        console.log('✅ Actual saved data:', verifyDoc.data());

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
 * Get product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Product data or null
 */
async function getProduct(productId) {
    try {
        const productDoc = await db.collection(COLLECTIONS.PRODUCTS).doc(productId).get();
        
        if (!productDoc.exists) {
            console.log(`Product ${productId} not found`);
            return null;
        }

        return {
            id: productDoc.id,
            ...productDoc.data()
        };
    } catch (error) {
        console.error('Error getting product:', error);
        return null;
    }
}

/**
 * Get all products (optionally filter by manufacturer)
 * @param {string} manufacturerId - Optional manufacturer ID filter
 * @returns {Promise<Array>} Array of products
 */
async function getAllProducts(manufacturerId = null) {
    try {
        let query = db.collection(COLLECTIONS.PRODUCTS);
        console.log(`🔄 getAllProducts called - manufacturerId filter: ${manufacturerId}`);

        // Filter by manufacturer if provided
        if (manufacturerId) {
            query = query.where('manufacturerId', '==', manufacturerId);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').get();
        
        const products = [];
        snapshot.forEach(doc => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`✅ getAllProducts found ${products.length} products`);
        return products;
    } catch (error) {
        console.error('❌ Error getting products:', error);
        return [];
    }
}

/**
 * Get products created by current user (manufacturers only)
 * @returns {Promise<Array>} Array of user's products
 */
async function getMyProducts() {
    console.log('=== getMyProducts() called ===');
    
    // Get the REAL Firebase authenticated user
    const authUser = firebase.auth().currentUser;
    
    console.log('📊 Firebase Auth User:', {
        exists: !!authUser,
        uid: authUser?.uid,
        email: authUser?.email
    });
    
    if (!authUser) {
        console.warn('❌ No authenticated user found in getMyProducts()');
        return [];
    }

    console.log('📊 currentUserData:', {
        exists: !!currentUserData,
        id: currentUserData?.id,
        uid: currentUserData?.uid,
        role: currentUserData?.role,
        name: currentUserData?.name
    });

    if (!currentUserData) {
        console.warn('❌ No user data loaded');
        return [];
    }

    if (currentUserData.role !== ROLES.MANUFACTURER) {
        console.warn('❌ User is not manufacturer. Role:', currentUserData.role);
        return [];
    }

    console.log('✅ Loading products for manufacturer UID:', authUser.uid);
    
    // Try to get products using getAllProducts
    try {
        const products = await getAllProducts(authUser.uid);
        console.log('✅ Found products:', products.length);
        
        // Log each product to verify manufacturerId
        products.forEach((product, index) => {
            console.log(`📦 Product ${index + 1}:`, {
                id: product.id,
                name: product.name,
                manufacturerId: product.manufacturerId,
                matchesCurrentUser: product.manufacturerId === authUser.uid
            });
        });
        
        return products;
    } catch (error) {
        console.error('❌ Error in getMyProducts:', error);
        
        // Try fallback method
        console.log('🔄 Trying fallback query...');
        return await getMyProductsDirect();
    }
}

/**
 * Direct query for user's products (fallback method)
 */
async function getMyProductsDirect() {
    const authUser = firebase.auth().currentUser;
    if (!authUser) {
        console.warn('No auth user for direct query');
        return [];
    }
    
    try {
        console.log('🔄 Running direct Firestore query for UID:', authUser.uid);
        const snapshot = await db.collection(COLLECTIONS.PRODUCTS)
            .where('manufacturerId', '==', authUser.uid)
            .get();
        
        console.log(`✅ Direct query found ${snapshot.size} products`);
        
        const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            // Sort by createdAt descending
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
        
        return products;
    } catch (error) {
        console.error('❌ Direct query error:', error);
        return [];
    }
}

/**
 * Update product information (only by creator)
 * @param {string} productId - Product ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Result
 */
async function updateProduct(productId, updates) {
    try {
        // Get the REAL Firebase authenticated user
        const authUser = firebase.auth().currentUser;
        
        if (!authUser) {
            return {
                success: false,
                error: 'You must be logged in'
            };
        }

        // Get product to verify ownership
        const product = await getProduct(productId);
        
        if (!product) {
            return {
                success: false,
                error: ERROR_MESSAGES.PRODUCT_NOT_FOUND
            };
        }

        // Verify user is the creator using REAL UID
        if (product.manufacturerId !== authUser.uid) {
            return {
                success: false,
                error: ERROR_MESSAGES.UNAUTHORIZED + ': You can only update your own products'
            };
        }

        // Prepare allowed updates
        const allowedUpdates = {};
        
        if (updates.name) {
            if (updates.name.length > VALIDATION.MAX_PRODUCT_NAME_LENGTH) {
                return {
                    success: false,
                    error: `Product name must be less than ${VALIDATION.MAX_PRODUCT_NAME_LENGTH} characters`
                };
            }
            allowedUpdates.name = updates.name.trim();
        }

        if (updates.description !== undefined) {
            if (updates.description.length > VALIDATION.MAX_DESCRIPTION_LENGTH) {
                return {
                    success: false,
                    error: `Description must be less than ${VALIDATION.MAX_DESCRIPTION_LENGTH} characters`
                };
            }
            allowedUpdates.description = updates.description.trim();
        }

        if (updates.unit) {
            allowedUpdates.unit = updates.unit;
        }

        if (updates.vatRate !== undefined) {
            if (updates.vatRate < 0 || updates.vatRate > 100) {
                return {
                    success: false,
                    error: 'VAT rate must be between 0 and 100'
                };
            }
            allowedUpdates.vatRate = updates.vatRate;
        }

        // Add timestamp
        allowedUpdates.updatedAt = getTimestamp();

        // Update product
        await db.collection(COLLECTIONS.PRODUCTS).doc(productId).update(allowedUpdates);

        console.log('✅ Product updated successfully:', productId);
        return {
            success: true,
            productId: productId
        };

    } catch (error) {
        console.error('Error updating product:', error);
        return {
            success: false,
            error: error.message || 'Failed to update product'
        };
    }
}

/**
 * Delete product (only if no stock exists anywhere)
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Result
 */
async function deleteProduct(productId) {
    try {
        // Get the REAL Firebase authenticated user
        const authUser = firebase.auth().currentUser;
        
        if (!authUser) {
            return {
                success: false,
                error: 'You must be logged in'
            };
        }

        // Get product to verify ownership
        const product = await getProduct(productId);
        
        if (!product) {
            return {
                success: false,
                error: ERROR_MESSAGES.PRODUCT_NOT_FOUND
            };
        }

        // Verify user is the creator using REAL UID
        if (product.manufacturerId !== authUser.uid) {
            return {
                success: false,
                error: ERROR_MESSAGES.UNAUTHORIZED + ': You can only delete your own products'
            };
        }

        // Check if any stock exists for this product
        const stockSnapshot = await db.collection(COLLECTIONS.STOCK)
            .where('productId', '==', productId)
            .limit(1)
            .get();

        if (!stockSnapshot.empty) {
            return {
                success: false,
                error: 'Cannot delete product: Stock exists in the system. Please remove all stock first.'
            };
        }

        // Delete product
        await db.collection(COLLECTIONS.PRODUCTS).doc(productId).delete();

        console.log('✅ Product deleted successfully:', productId);
        return {
            success: true,
            productId: productId
        };

    } catch (error) {
        console.error('Error deleting product:', error);
        return {
            success: false,
            error: error.message || 'Failed to delete product'
        };
    }
}

/**
 * Search products by name or SKU
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} Matching products
 */
async function searchProducts(searchTerm) {
    try {
        if (!searchTerm || searchTerm.trim().length === 0) {
            return await getAllProducts();
        }

        const term = searchTerm.trim().toLowerCase();
        const allProducts = await getAllProducts();

        // Filter products by name or SKU
        return allProducts.filter(product => 
            product.name.toLowerCase().includes(term) ||
            product.sku.toLowerCase().includes(term)
        );

    } catch (error) {
        console.error('Error searching products:', error);
        return [];
    }
}

/**
 * Generate SKU from product name
 * @param {string} productName - Product name
 * @returns {string} Generated SKU
 */
function generateSKU(productName) {
    const prefix = productName
        .trim()
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Debug function to test product retrieval
 */
window.debugProducts = async function() {
    console.clear();
    console.log('=== DEBUG PRODUCTS ===');
    
    const authUser = firebase.auth().currentUser;
    console.log('1. Firebase User:', authUser?.uid);
    console.log('2. currentUserData:', currentUserData);
    
    if (authUser) {
        console.log('3. Direct Firestore query for products...');
        const snapshot = await db.collection(COLLECTIONS.PRODUCTS).get();
        console.log(`   Total products in database: ${snapshot.size}`);
        
        console.log('4. Products for current user:');
        const mySnapshot = await db.collection(COLLECTIONS.PRODUCTS)
            .where('manufacturerId', '==', authUser.uid)
            .get();
        console.log(`   Found ${mySnapshot.size} products for UID: ${authUser.uid}`);
        
        mySnapshot.forEach(doc => {
            console.log('   -', doc.data());
        });
        
        console.log('5. Testing getMyProducts()...');
        const products = await getMyProducts();
        console.log(`   getMyProducts() returned: ${products.length} products`);
    }
};

console.log('✅ Product model loaded');

    
