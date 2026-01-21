/**
 * Show Raw Materials Management Page
 */
async function showRawMaterialsPage() {
    if (!currentUserData || currentUserData.role !== ROLES.MANUFACTURER) {
        showError("Access Denied: Manufacturers only.");
        return;
    }

    mainContent.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #667eea;">🏭 Raw Materials Inventory</h2>
                <button class="btn-secondary" onclick="loadDashboard('${currentUserData.role}')">Back</button>
            </div>

            <div id="rawMaterialsList" class="table-responsive">
                <div style="text-align: center; padding: 3rem;">
                    <div class="spinner"></div>
                    <p>Loading raw materials...</p>
                </div>
            </div>
        </div>
    `;

    await loadRawMaterialsList();
}

/**
 * Fetch and display the list of raw materials
 */
async function loadRawMaterialsList() {
    const container = document.getElementById('rawMaterialsList');
    try {
        // Query the 'stock' collection but filter by type: 'rawMaterial'
        const snapshot = await db.collection(COLLECTIONS.STOCK)
            .where('ownerId', '==', currentUser.uid)
            .where('type', '==', STOCK_TYPES.RAW_MATERIAL)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `<p style="text-align: center; color: #999;">No raw materials found.</p>`;
            return;
        }

        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Material Name</th>
                        <th>SKU</th>
                        <th>Current Quantity</th>
                        <th>Unit</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
        `;

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.updatedAt?.toDate?.() || new Date();
            html += `
                <tr>
                    <td><strong>${data.productName}</strong></td>
                    <td><code>${data.productSKU}</code></td>
                    <td><strong>${data.quantity}</strong></td>
                    <td>${data.productUnit}</td>
                    <td>${date.toLocaleDateString()}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
    }
}
