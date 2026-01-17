// Application Constants

// User Roles
const ROLES = {
    MANUFACTURER: 'manufacturer',
    DISTRIBUTOR: 'distributor',
    RETAILER: 'retailer',
    BUYER: 'buyer'
};

// Stock Types
const STOCK_TYPES = {
    INVENTORY: 'inventory',
    RAW_MATERIAL: 'rawMaterial'
};

// Transaction Types
const TRANSACTION_TYPES = {
    SALE: 'sale',
    PURCHASE: 'purchase'
};

// Invoice Status
const INVOICE_STATUS = {
    GENERATED: 'generated',
    SENT: 'sent',
    PAID: 'paid',
    CANCELLED: 'cancelled'
};

// Common Units
const UNITS = [
    'piece',
    'kg',
    'gram',
    'liter',
    'ml',
    'meter',
    'cm',
    'box',
    'carton',
    'dozen',
    'set',
    'pack'
];

// Role Capabilities
const ROLE_CAPABILITIES = {
    [ROLES.MANUFACTURER]: {
        canCreateProducts: true,
        canManageRawMaterials: true,
        canSellTo: [ROLES.DISTRIBUTOR, ROLES.RETAILER, ROLES.BUYER],
        canBuyFrom: [ROLES.MANUFACTURER, ROLES.DISTRIBUTOR], // Can buy raw materials from other manufacturers or distributors
        hasInventory: true,
        hasRawMaterials: true
    },
    [ROLES.DISTRIBUTOR]: {
        canCreateProducts: false,
        canManageRawMaterials: false,
        canSellTo: [ROLES.RETAILER, ROLES.BUYER],
        canBuyFrom: [ROLES.MANUFACTURER],
        hasInventory: true,
        hasRawMaterials: false
    },
    [ROLES.RETAILER]: {
        canCreateProducts: false,
        canManageRawMaterials: false,
        canSellTo: [ROLES.BUYER],
        canBuyFrom: [ROLES.MANUFACTURER, ROLES.DISTRIBUTOR],
        hasInventory: true,
        hasRawMaterials: false
    },
    [ROLES.BUYER]: {
        canCreateProducts: false,
        canManageRawMaterials: false,
        canSellTo: [],
        canBuyFrom: [ROLES.MANUFACTURER, ROLES.DISTRIBUTOR, ROLES.RETAILER],
        hasInventory: false, // Buyers don't manage stock
        hasRawMaterials: false
    }
};

// Firestore Collection Names
const COLLECTIONS = {
    USERS: 'users',
    PRODUCTS: 'products',
    STOCK: 'stock',
    RAW_MATERIALS: 'rawMaterials',
    TRANSACTIONS: 'transactions',
    INVOICES: 'invoices'
};

// Error Messages
const ERROR_MESSAGES = {
    INSUFFICIENT_STOCK: 'Insufficient stock available',
    INVALID_QUANTITY: 'Invalid quantity specified',
    PRODUCT_NOT_FOUND: 'Product not found',
    UNAUTHORIZED: 'You are not authorized to perform this action',
    DUPLICATE_STOCK: 'Stock entry already exists for this product',
    INVALID_BUYER: 'Invalid buyer selected',
    INVALID_SELLER: 'Invalid seller selected',
    NETWORK_ERROR: 'Network error. Please check your connection',
    AUTH_FAILED: 'Authentication failed'
};

// Success Messages
const SUCCESS_MESSAGES = {
    PRODUCT_CREATED: 'Product created successfully',
    STOCK_UPDATED: 'Stock updated successfully',
    TRANSACTION_COMPLETED: 'Transaction completed successfully',
    INVOICE_GENERATED: 'Invoice generated successfully',
    USER_REGISTERED: 'User registered successfully'
};

// Validation Rules
const VALIDATION = {
    MIN_QUANTITY: 0.01,
    MIN_PRICE: 0.01,
    MAX_PRODUCT_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    MIN_PASSWORD_LENGTH: 6
};

// Export all constants
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ROLES,
        STOCK_TYPES,
        TRANSACTION_TYPES,
        INVOICE_STATUS,
        UNITS,
        ROLE_CAPABILITIES,
        COLLECTIONS,
        ERROR_MESSAGES,
        SUCCESS_MESSAGES,
        VALIDATION
    };
    }
    
