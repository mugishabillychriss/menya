// ==================== DATABASE INITIALIZATION ====================
let db = {
    organizations: [],
    currentOrg: null,
    currentUser: null,
    products: [],
    categories: [
        { id: 1, name: 'Food', description: 'Food items', icon: '🍚', count: 0 },
        { id: 2, name: 'Beverages', description: 'Drinks', icon: '🥤', count: 0 },
        { id: 3, name: 'Cleaning', description: 'Cleaning supplies', icon: '🧹', count: 0 },
        { id: 4, name: 'Electronics', description: 'Electronic items', icon: '📱', count: 0 },
        { id: 5, name: 'Stationery', description: 'Office supplies', icon: '📝', count: 0 },
        { id: 6, name: 'Hardware', description: 'Tools & hardware', icon: '🔧', count: 0 }
    ],
    sales: [],
    purchases: [],
    transfers: [],
    returns: [],
    adjustments: [],
    users: [],
    auditLog: [],
    pendingSubscriptions: [],
    settings: {
        darkMode: false,
        autoBackup: true,
        currency: 'RWF',
        taxRate: 18,
        themeColor: '#1a237e',
        notifications: true,
        twoFA: false,
        lowStockThreshold: 5,
        companyName: '',
        companyLogo: '',
        dateFormat: 'DD/MM/YYYY'
    }
};

// Load database from localStorage
function loadDB() {
    try {
        const saved = localStorage.getItem('bsms_titan_database_v8');
        if (saved) {
            db = JSON.parse(saved);
            console.log('✅ BSMS TITAN loaded successfully!');
        } else {
            initializeSampleData();
        }
    } catch (error) {
        console.error('Error loading database:', error);
        initializeSampleData();
    }
    updateUI();
}

// Initialize with sample data
function initializeSampleData() {
    db.products = [
        { id: Date.now() + 1, name: 'Indomyi', category: 'Food', price: 2500, quantity: 45, originalQuantity: 45, barcode: '123456', expiry: '2025-12-31', description: 'Popular snack', measurement: 'pieces' },
        { id: Date.now() + 2, name: 'Fanta', category: 'Beverages', price: 800, quantity: 12, originalQuantity: 12, barcode: '789012', expiry: '2025-06-30', description: 'Orange soda', measurement: 'pieces' },
        { id: Date.now() + 3, name: 'Rice 5kg', category: 'Food', price: 7500, quantity: 8, originalQuantity: 8, barcode: '345678', expiry: '2026-01-15', description: 'Premium rice', measurement: 'kilograms' },
        { id: Date.now() + 4, name: 'Soap', category: 'Cleaning', price: 1200, quantity: 3, originalQuantity: 3, barcode: '901234', expiry: '2025-04-20', description: 'Bath soap', measurement: 'pieces' },
        { id: Date.now() + 5, name: 'Milk', category: 'Dairy', price: 1500, quantity: 2, originalQuantity: 2, barcode: '567890', expiry: '2024-12-01', description: 'Fresh milk', measurement: 'liters' }
    ];
    updateCategoryCounts();
    saveDB();
}

// Save database to localStorage
function saveDB() {
    localStorage.setItem('bsms_titan_database_v8', JSON.stringify(db));
}

// ==================== SECURITY FUNCTIONS ====================
function secureHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(16);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

const ADMIN_PASSWORD_HASH = secureHash('BILLAN2026');

// ==================== STRONG UDC GENERATION ====================
function generateUDC() {
    const symbols = '!@#$%&*?';
    const numbers = '0123456789';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';

    let result = '';
    result += symbols.charAt(Math.floor(Math.random() * symbols.length));
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    result += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    result += lowercase.charAt(Math.floor(Math.random() * lowercase.length));

    const allChars = symbols + numbers + uppercase + lowercase;
    for (let i = 0; i < 2; i++) {
        result += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    return result.split('').sort(() => Math.random() - 0.5).join('');
}

// ==================== ADMIN PANEL ====================
function showAdminPanel() {
    const modalHtml = `
        <div id="adminPasswordModal" style="
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: flex; justify-content: center;
            align-items: center; z-index: 100000; backdrop-filter: blur(5px);">
            <div style="background: white; padding: 40px; border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 400px; width: 90%;
                border: 5px solid #1a237e;">
                <h2 style="color: #1a237e; margin-bottom: 20px; text-align: center;">👑 ADMIN ONLY ACCESS</h2>
                <div style="margin-bottom: 25px; text-align: center; color: #666;">Enter your admin password to continue</div>
                <div style="position: relative; margin-bottom: 25px;">
                    <input type="password" id="adminPasswordInput" placeholder="Enter password"
                        style="width: 100%; padding: 15px 45px 15px 15px; border: 2px solid #e0e0e0;
                        border-radius: 10px; font-size: 16px; outline: none; box-sizing: border-box;"
                        onfocus="this.style.borderColor='#1a237e'"
                        onblur="this.style.borderColor='#e0e0e0'"
                        onkeydown="if(event.key==='Enter') submitAdminPassword()">
                    <span onclick="togglePasswordVisibility()" style="position: absolute; right: 15px;
                        top: 50%; transform: translateY(-50%); cursor: pointer; color: #1a237e; font-size: 18px;">
                        <i class="fas fa-eye" id="passwordEyeIcon"></i>
                    </span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="submitAdminPassword()" style="flex: 2; padding: 15px;
                        background: linear-gradient(135deg, #1a237e, #0d1757); color: white;
                        border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer;">
                        ACCESS
                    </button>
                    <button onclick="closeAdminPasswordModal()" style="flex: 1; padding: 15px;
                        background: #f44336; color: white; border: none; border-radius: 10px;
                        font-size: 16px; font-weight: bold; cursor: pointer;">
                        CANCEL
                    </button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('adminPasswordInput')?.focus(), 100);
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('adminPasswordInput');
    const eyeIcon = document.getElementById('passwordEyeIcon');
    if (passwordInput && eyeIcon) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            eyeIcon.className = 'fas fa-eye';
        }
    }
}

// ==================== FIX 1 & 3: submitAdminPassword calls renderAdminPanel ====================
function submitAdminPassword() {
    const password = document.getElementById('adminPasswordInput')?.value;

    if (secureHash(password || '') === ADMIN_PASSWORD_HASH) {
        closeAdminPasswordModal();
        renderAdminPanel();
        showAlert('✅ Access granted to Admin Panel!', 'success');
        logAudit('Admin panel accessed');
    } else {
        showAlert('❌ Access denied!', 'danger');
        const input = document.getElementById('adminPasswordInput');
        if (input) { input.value = ''; input.focus(); }
    }
}

// ==================== FIX 1 & 3: renderAdminPanel — no password, fresh db read ====================
function renderAdminPanel() {
    closeAdminPanel();

    // Always reload fresh db from localStorage
    try {
        const saved = localStorage.getItem('bsms_titan_database_v8');
        if (saved) db = JSON.parse(saved);
    } catch (e) { /* use current db */ }

    let adminInbox = JSON.parse(localStorage.getItem('bsms_admin_inbox') || '[]');

    let html = `
        <div class="admin-panel" id="adminPanel" style="
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: white; padding: 30px; border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3); z-index: 100001;
            max-width: 800px; width: 95%; max-height: 85vh; overflow-y: auto;
            border: 5px solid #1a237e;">
            <h2 style="color: #1a237e; margin-bottom: 20px;">👑 ADMIN PANEL (AOA)</h2>
            <p style="margin-bottom: 20px;">📧 Secure Admin Access</p>

            <div style="background: #f0f2f5; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="color: #1a237e;">📊 System Statistics</h3>
                <p>Total Organizations: ${db.organizations?.length || 0}</p>
                <p>Total Products: ${db.products?.length || 0}</p>
                <p>Total Categories: ${db.categories?.length || 0}</p>
            </div>

            <h3 style="color: #1a237e; margin-bottom: 15px;">📋 Recent Registrations (UDC Inbox)</h3>`;

    const udcEntries = adminInbox.filter(item => item.type !== 'subscription_request');
    if (udcEntries.length === 0) {
        html += '<p style="text-align:center;padding:30px;background:#f5f5f5;border-radius:10px;">📭 No registrations yet.</p>';
    } else {
        udcEntries.forEach((item, index) => {
            html += `
                <div style="background:${item.read ? '#f5f5f5' : '#e8eaf6'};padding:20px;margin-bottom:15px;border-radius:10px;border-left:5px solid #1a237e;">
                    <p><strong>🏢 ${item.organization}</strong> (${item.orgCode})</p>
                    <div style="font-size:26px;font-weight:bold;color:#1a237e;text-align:center;letter-spacing:3px;
                        background:white;padding:15px;border-radius:10px;margin:10px 0;font-family:monospace;">
                        ${item.udc}
                    </div>
                    <p>📅 ${new Date(item.date).toLocaleString()}</p>
                    <div style="display:flex;gap:10px;margin-top:10px;">
                        <button onclick="markUDCAsRead(${index})" style="padding:5px 15px;background:#4caf50;color:white;border:none;border-radius:5px;cursor:pointer;">✓ Mark Read</button>
                        <button onclick="deleteUDC(${index})" style="padding:5px 15px;background:#c62828;color:white;border:none;border-radius:5px;cursor:pointer;">🗑️ Delete</button>
                    </div>
                </div>`;
        });
    }

    // Pending Subscriptions
    const pendingSubs = (db.pendingSubscriptions || []).filter(r => r.status === 'pending');

    html += `<h3 style="color:#1a237e;margin:30px 0 15px;">📋 Pending Subscription Approvals
        <span style="background:#f44336;color:white;padding:2px 10px;border-radius:20px;font-size:14px;margin-left:8px;">
            ${pendingSubs.length}
        </span>
    </h3>`;

    if (pendingSubs.length === 0) {
        html += '<p style="text-align:center;padding:30px;background:#f5f5f5;border-radius:10px;">✅ No pending subscription requests.</p>';
    } else {
        pendingSubs.forEach(req => {
            html += `
                <div style="background:#fff3e0;padding:20px;margin-bottom:15px;border-radius:10px;border-left:5px solid #ff9800;">
                    <p><strong>🏢 ${req.orgName}</strong> (${req.orgCode})</p>
                    <p><strong>Owner:</strong> ${req.owner}</p>
                    <p><strong>Plan:</strong> ${req.planMonths === 0 ? '7-day trial' : req.planMonths + ' months'}</p>
                    <p><strong>Requested:</strong> ${new Date(req.requestDate).toLocaleString()}</p>
                    <div style="display:flex;gap:10px;margin-top:10px;">
                        <button onclick="approveSubscription(${req.id})" style="padding:8px 20px;background:#4caf50;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✅ Approve</button>
                        <button onclick="rejectSubscription(${req.id})" style="padding:8px 20px;background:#f44336;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">❌ Reject</button>
                    </div>
                </div>`;
        });
    }

    html += `
        <button onclick="closeAdminPanel()" style="width:100%;padding:15px;background:#1a237e;color:white;
            border:none;border-radius:5px;margin-top:20px;cursor:pointer;font-size:16px;font-weight:bold;">
            CLOSE
        </button>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
}

function closeAdminPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    if (modal) modal.remove();
}

// ==================== FIX 3: markUDCAsRead & deleteUDC use renderAdminPanel ====================
function markUDCAsRead(index) {
    let adminInbox = JSON.parse(localStorage.getItem('bsms_admin_inbox') || '[]');
    const udcEntries = adminInbox.filter(item => item.type !== 'subscription_request');
    if (udcEntries[index]) {
        udcEntries[index].read = true;
        // Merge back
        let i = 0;
        adminInbox = adminInbox.map(item => item.type !== 'subscription_request' ? udcEntries[i++] : item);
        localStorage.setItem('bsms_admin_inbox', JSON.stringify(adminInbox));
    }
    closeAdminPanel();
    renderAdminPanel();
}

function deleteUDC(index) {
    let adminInbox = JSON.parse(localStorage.getItem('bsms_admin_inbox') || '[]');
    const udcEntries = adminInbox.filter(item => item.type !== 'subscription_request');
    udcEntries.splice(index, 1);
    const subEntries = adminInbox.filter(item => item.type === 'subscription_request');
    localStorage.setItem('bsms_admin_inbox', JSON.stringify([...udcEntries, ...subEntries]));
    closeAdminPanel();
    renderAdminPanel();
    showAlert('✅ UDC deleted', 'success');
}

function closeAdminPanel() {
    const panel = document.getElementById('adminPanel');
    if (panel) panel.remove();
}

// ==================== FIX 3: approveSubscription uses renderAdminPanel ====================
function approveSubscription(requestId) {
    const requestIndex = (db.pendingSubscriptions || []).findIndex(r => r.id === requestId);
    if (requestIndex === -1) { showAlert('❌ Request not found!', 'danger'); return; }

    const request = db.pendingSubscriptions[requestIndex];

    const org = db.organizations.find(o => o.id === request.orgId)
             || db.organizations.find(o => o.code === request.orgCode);

    if (!org) { showAlert('❌ Organization not found!', 'danger'); return; }

    const days = request.planMonths === 0 ? 7 : request.planMonths * 30;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    org.subscription = {
        active: true,
        startDate: new Date().toISOString(),
        endDate: endDate.toISOString(),
        tier: request.planMonths === 0 ? 'trial' : request.planMonths + ' months'
    };

    db.pendingSubscriptions.splice(requestIndex, 1);
    saveDB();

    let adminInbox = JSON.parse(localStorage.getItem('bsms_admin_inbox') || '[]');
    adminInbox = adminInbox.filter(item => !(item.type === 'subscription_request' && item.requestId === requestId));
    localStorage.setItem('bsms_admin_inbox', JSON.stringify(adminInbox));

    showAlert(`✅ ${org.name} is now ACTIVE! (${days} days)`, 'success');
    logAudit(`Subscription approved: ${org.name}`);

    closeAdminPanel();
    renderAdminPanel();
}

// ==================== FIX 3: rejectSubscription uses renderAdminPanel ====================
function rejectSubscription(requestId) {
    const request = (db.pendingSubscriptions || []).find(r => r.id === requestId);
    if (!request) { showAlert('❌ Request not found!', 'danger'); return; }

    request.status = 'rejected';
    saveDB();

    let adminInbox = JSON.parse(localStorage.getItem('bsms_admin_inbox') || '[]');
    adminInbox = adminInbox.filter(item => !(item.type === 'subscription_request' && item.requestId === requestId));
    localStorage.setItem('bsms_admin_inbox', JSON.stringify(adminInbox));

    showAlert(`❌ Subscription rejected for ${request.orgName}`, 'info');
    logAudit(`Subscription rejected: ${request.orgName}`);

    closeAdminPanel();
    renderAdminPanel();
}

// ==================== PAGE NAVIGATION ====================
function showLogin() {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('aboutPage').style.display = 'none';
    document.getElementById('paymentPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    const waiting = document.getElementById('waitingPage');
    if (waiting) waiting.remove();
}

function showRegister() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').style.display = 'block';
    document.getElementById('aboutPage').style.display = 'none';
    document.getElementById('paymentPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
}

function showAbout() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('aboutPage').style.display = 'block';
    document.getElementById('paymentPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
}

function hideAllPages() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('aboutPage').style.display = 'none';
    document.getElementById('paymentPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    const waiting = document.getElementById('waitingPage');
    if (waiting) waiting.remove();
}

// ==================== REGISTER ====================
function register() {
    const orgName = document.getElementById('regOrgName')?.value;
    const orgCode = document.getElementById('regOrgCode')?.value;
    const owner   = document.getElementById('regOwner')?.value;
    const type    = document.getElementById('regType')?.value;
    const phone   = document.getElementById('regPhone')?.value;
    const email   = document.getElementById('regEmail')?.value;
    const location = document.getElementById('regLocation')?.value;

    if (!orgName || !orgCode || !owner || !phone) {
        showAlert('❌ Please fill all required fields!', 'warning');
        return;
    }

    const udc = generateUDC();

    const organization = {
        id: Date.now(),
        name: orgName,
        code: orgCode,
        owner: owner,
        type: type,
        phone: phone,
        email: email || 'Not provided',
        location: location || 'Not specified',
        udc: udc,
        registeredDate: new Date().toISOString(),
        subscription: { active: false, startDate: null, endDate: null, tier: null }
    };

    if (!db.organizations) db.organizations = [];
    db.organizations.push(organization);
    saveDB();

    let adminInbox = JSON.parse(localStorage.getItem('bsms_admin_inbox') || '[]');
    adminInbox.push({
        organization: orgName,
        orgCode: orgCode,
        udc: udc,
        date: new Date().toISOString(),
        read: false
    });
    localStorage.setItem('bsms_admin_inbox', JSON.stringify(adminInbox));

    showAlert('✅ Registration complete! An administrator will provide your UDC.', 'success');

    document.getElementById('regOrgName').value = '';
    document.getElementById('regOrgCode').value = '';
    document.getElementById('regOwner').value = '';
    document.getElementById('regPhone').value = '';
    if (document.getElementById('regEmail')) document.getElementById('regEmail').value = '';
    if (document.getElementById('regLocation')) document.getElementById('regLocation').value = '';

    showLogin();
}

// ==================== FIX 2: LOGIN — fresh db read + expiry check ====================
function login() {
    const orgCode = document.getElementById('orgCode')?.value?.trim();
    const orgName = document.getElementById('orgName')?.value?.trim();
    const udc     = document.getElementById('udcCode')?.value?.trim();

    if (!orgCode || !orgName || !udc) {
        showAlert('❌ Please fill all fields!', 'warning');
        return;
    }

    // Always reload fresh db to get the latest approval state
    try {
        const saved = localStorage.getItem('bsms_titan_database_v8');
        if (saved) db = JSON.parse(saved);
    } catch (e) { /* use current db */ }

    const organization = (db.organizations || []).find(org =>
        org.code === orgCode && org.name === orgName && org.udc === udc
    );

    if (!organization) {
        showAlert('❌ Login failed. Please check your credentials.', 'danger');
        logAudit('Failed login attempt');
        return;
    }

    db.currentOrg = organization;
    db.currentUser = { name: organization.owner, role: 'admin' };
    saveDB();

    hideAllPages();

    // SECURITY: Re-read from authoritative organizations array
    const freshOrg = db.organizations.find(o => o.id === organization.id);
    const isActive = freshOrg?.subscription?.active === true;

    if (isActive) {
        const now = new Date();
        const endDate = new Date(freshOrg.subscription.endDate);
        if (endDate > now) {
            document.getElementById('dashboard').style.display = 'block';
            loadDashboardData();
            showAlert('✅ Login successful!', 'success');
        } else {
            // Subscription expired
            freshOrg.subscription.active = false;
            db.currentOrg.subscription.active = false;
            saveDB();
            document.getElementById('paymentPage').style.display = 'block';
            showAlert('⚠️ Your subscription has expired. Please renew.', 'warning');
        }
    } else {
        const hasPending = (db.pendingSubscriptions || []).some(
            r => r.orgId === organization.id && r.status === 'pending'
        );
        if (hasPending) {
            showWaitingApproval();
        } else {
            document.getElementById('paymentPage').style.display = 'block';
        }
        showAlert('✅ Login successful!', 'success');
    }

    logAudit(`Login: ${orgName}`);
}

function loadDashboardData() {
    document.getElementById('dashboardOrgName').textContent = db.currentOrg.name;
    document.getElementById('dashboardOrgCode').textContent = 'Code: ' + db.currentOrg.code;
    document.getElementById('settingsOrgName').textContent = db.currentOrg.name;
    document.getElementById('settingsOrgCode').textContent = db.currentOrg.code;
    document.getElementById('settingsUDC').textContent = db.currentOrg.udc;
    loadCategories();
    loadProducts();
    startSubscriptionTimer();
    updateStats();
    showWelcomeCelebration();
}

// ==================== PAYMENT ====================
let selectedTier = null;
let selectedPrice = null;

function selectTier(months, price) {
    selectedTier = months;
    selectedPrice = price;

    ['tier3','tier6','tier9','tier12','tier0'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.border = 'none';
    });

    event.currentTarget.style.border = '3px solid #1a237e';
}

// ==================== FIX 2: requestSubscription — hardened security ====================
function requestSubscription() {
    if (selectedTier === null) {
        showAlert('❌ Please select a subscription tier!', 'warning');
        return;
    }

    const organization = db.currentOrg;
    if (!organization) {
        showAlert('❌ No organization selected!', 'danger');
        return;
    }

    // SECURITY: Force subscription to inactive on BOTH references
    const subscriptionOff = { active: false, startDate: null, endDate: null, tier: null };
    organization.subscription = { ...subscriptionOff };

    const orgInList = db.organizations.find(o => o.id === organization.id);
    if (orgInList) orgInList.subscription = { ...subscriptionOff };

    // Remove any old rejected requests for this org
    if (!db.pendingSubscriptions) db.pendingSubscriptions = [];
    db.pendingSubscriptions = db.pendingSubscriptions.filter(
        r => !(r.orgId === organization.id && r.status === 'rejected')
    );

    const request = {
        id: Date.now(),
        orgId: organization.id,
        orgName: organization.name,
        orgCode: organization.code,
        owner: organization.owner,
        planMonths: selectedTier,
        requestDate: new Date().toISOString(),
        status: 'pending'
    };

    db.pendingSubscriptions.push(request);
    saveDB();

    let adminInbox = JSON.parse(localStorage.getItem('bsms_admin_inbox') || '[]');
    adminInbox.push({
        type: 'subscription_request',
        organization: organization.name,
        orgCode: organization.code,
        plan: selectedTier === 0 ? '7-day trial' : selectedTier + ' months',
        requestId: request.id,
        date: new Date().toISOString(),
        read: false
    });
    localStorage.setItem('bsms_admin_inbox', JSON.stringify(adminInbox));

    hideAllPages();
    showWaitingApproval();
    showAlert('💳 Request sent! Waiting for Admin Approval.', 'info');
    logAudit(`Subscription request: ${organization.name} - ${selectedTier} months`);
}

// FIX 2: processPayment DISABLED — prevents bypass of approval system
function processPayment() {
    showAlert('⚠️ Direct payment is disabled. Please use the subscription request flow.', 'warning');
}

function startSubscription(days) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    db.currentOrg.subscription = {
        active: true,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        tier: days === 7 ? 'trial' : selectedTier + 'months'
    };
    saveDB();
}

function showWaitingApproval() {
    const waitingHtml = `
        <div id="waitingPage" style="text-align: center; padding: 60px; background: white;
            border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            max-width: 500px; margin: 50px auto;">
            <h2 style="color: #1a237e; margin-bottom: 20px;">⏳ Pending Approval</h2>
            <p style="font-size: 18px; margin-bottom: 30px;">Your subscription request has been sent to the administrator. You will be notified once approved.</p>
            <p style="color: #666;">Please check back later or contact support.</p>
            <button onclick="checkApprovalStatus()" style="margin-top: 20px; margin-right: 10px; padding: 12px 30px;
                background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer;">
                🔄 Check Status
            </button>
            <button onclick="logout()" style="margin-top: 20px; padding: 12px 30px;
                background: #1a237e; color: white; border: none; border-radius: 8px; cursor: pointer;">
                Logout
            </button>
        </div>`;
    hideAllPages();
    document.body.insertAdjacentHTML('beforeend', waitingHtml);
}

// Allow user to check if they've been approved without re-logging in
function checkApprovalStatus() {
    try {
        const saved = localStorage.getItem('bsms_titan_database_v8');
        if (saved) db = JSON.parse(saved);
    } catch (e) { /* use current */ }

    if (!db.currentOrg) { showLogin(); return; }

    const freshOrg = db.organizations.find(o => o.id === db.currentOrg.id);
    const isActive = freshOrg?.subscription?.active === true;

    if (isActive) {
        const now = new Date();
        const endDate = new Date(freshOrg.subscription.endDate);
        if (endDate > now) {
            db.currentOrg = freshOrg;
            saveDB();
            hideAllPages();
            document.getElementById('dashboard').style.display = 'block';
            loadDashboardData();
            showAlert('🎉 Your subscription has been approved!', 'success');
        } else {
            showAlert('⚠️ Subscription expired.', 'warning');
        }
    } else {
        const hasPending = (db.pendingSubscriptions || []).some(
            r => r.orgId === db.currentOrg.id && r.status === 'pending'
        );
        if (hasPending) {
            showAlert('⏳ Still pending approval. Please wait.', 'info');
        } else {
            showAlert('❌ Request was rejected. Please contact admin.', 'danger');
        }
    }
}

// ==================== SUBSCRIPTION TIMER ====================
let timerInterval;

function startSubscriptionTimer() {
    if (timerInterval) clearInterval(timerInterval);
    checkAndShowDailyReminder();
    timerInterval = setInterval(() => {
        if (!db.currentOrg?.subscription?.active) return;
        const now = new Date();
        const end = new Date(db.currentOrg.subscription.endDate);
        const diff = end - now;
        if (diff <= 0) { clearInterval(timerInterval); lockSystem(); return; }
        const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const timerEl = document.getElementById('subscriptionTimer');
        if (timerEl) timerEl.textContent =
            `${days.toString().padStart(3,'0')}:${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
        const counterEl = document.getElementById('settingsCounter');
        if (counterEl) counterEl.textContent =
            `${Math.floor(days/365)}y ${Math.floor((days%365)/30)}m ${days%30}d ${hours}h ${minutes}m`;
    }, 1000);
}

function checkAndShowDailyReminder() {
    if (!db.currentOrg?.subscription?.active) return;
    const now  = new Date();
    const end  = new Date(db.currentOrg.subscription.endDate);
    const diff = end - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 7 && days > 0) {
        const lastReminder = localStorage.getItem('bsms_last_reminder_date');
        const today = new Date().toDateString();
        if (lastReminder !== today) {
            showAlert(`⚠️ Your subscription expires in ${days} days! Please renew.`, 'warning');
            localStorage.setItem('bsms_last_reminder_date', today);
        }
    }
}

function resetDailyReminder() {
    localStorage.removeItem('bsms_last_reminder_date');
    showAlert('✅ Daily reminder reset', 'success');
}

function lockSystem() {
    document.getElementById('mainContent').innerHTML = `
        <div style="text-align: center; padding: 100px;">
            <h2 style="color: #c62828;">🔒 SUBSCRIPTION EXPIRED</h2>
            <p>Please renew to continue using BSMS TITAN.</p>
            <button onclick="showRenewal()" style="margin-top: 20px; padding: 15px 30px;
                background: #1a237e; color: white; border: none; border-radius: 10px; cursor: pointer;">
                RENEW NOW
            </button>
        </div>`;
}

function showRenewal() {
    hideAllPages();
    document.getElementById('paymentPage').style.display = 'block';
}

function showWelcomeCelebration() {
    showAlert('🎉 WELCOME TO BSMS TITAN!', 'success');
}

// ==================== CATEGORY MANAGEMENT ====================
function loadCategories() {
    const categoryButtons = document.getElementById('categoryButtons');
    const categorySelect = document.getElementById('productCategorySelect');
    const editCategorySelect = document.getElementById('editProductCategorySelect');
    if (!categoryButtons) return;
    updateCategoryCounts();

    let buttonsHtml = '<button class="category-btn active" onclick="filterByCategory(\'all\')">📋 All Categories</button>';
    db.categories.forEach(cat => {
        buttonsHtml += `<button class="category-btn" onclick="filterByCategory('${cat.name}')">${cat.icon || '📁'} ${cat.name} (${cat.count || 0})</button>`;
    });
    categoryButtons.innerHTML = buttonsHtml;

    if (categorySelect) {
        let options = '<option value="">Select Category</option>';
        db.categories.forEach(cat => { options += `<option value="${cat.name}">${cat.name}</option>`; });
        categorySelect.innerHTML = options;
    }
    if (editCategorySelect) {
        let options = '<option value="">Select Category</option>';
        db.categories.forEach(cat => { options += `<option value="${cat.name}">${cat.name}</option>`; });
        editCategorySelect.innerHTML = options;
    }

    const totalCat = document.getElementById('totalCategories');
    if (totalCat) totalCat.textContent = db.categories.length;
}

function updateCategoryCounts() {
    db.categories.forEach(cat => cat.count = 0);
    db.products.forEach(product => {
        const category = db.categories.find(c => c.name === product.category);
        if (category) category.count = (category.count || 0) + 1;
    });
}

function filterByCategory(category) {
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    if (category === 'all') {
        loadProducts();
    } else {
        const filtered = db.products.filter(p => p.category === category);
        displayProducts(filtered);
    }
    showAlert(`📁 Showing ${category === 'all' ? 'all' : category} items`, 'info');
}

function showAddCategoryModal() {
    document.getElementById('addCategoryModal').style.display = 'flex';
}

function addCategory() {
    const name = document.getElementById('categoryName').value;
    const desc = document.getElementById('categoryDescription').value;
    const icon = document.getElementById('categoryIcon').value || '📁';
    if (!name) { showAlert('❌ Please enter category name', 'warning'); return; }
    if (db.categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
        showAlert('❌ Category already exists!', 'danger'); return;
    }
    db.categories.push({ id: Date.now(), name, description: desc || 'No description', icon, count: 0 });
    saveDB();
    loadCategories();
    hideModal('addCategoryModal');
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryDescription').value = '';
    document.getElementById('categoryIcon').value = '';
    showAlert('✅ Category added successfully!', 'success');
    logAudit(`Added category: ${name}`);
}

// ==================== QUANTITY MEASUREMENTS ====================
const quantityMeasurements = [
    { value: 'pieces',      label: 'Pieces (pcs)',       symbol: 'pcs' },
    { value: 'kilograms',   label: 'Kilograms (kg)',     symbol: 'kg'  },
    { value: 'grams',       label: 'Grams (g)',          symbol: 'g'   },
    { value: 'liters',      label: 'Liters (L)',         symbol: 'L'   },
    { value: 'milliliters', label: 'Milliliters (mL)',   symbol: 'mL'  },
    { value: 'boxes',       label: 'Boxes (box)',        symbol: 'box' },
    { value: 'cartons',     label: 'Cartons (ctn)',      symbol: 'ctn' },
    { value: 'dozens',      label: 'Dozens (dz)',        symbol: 'dz'  },
    { value: 'meters',      label: 'Meters (m)',         symbol: 'm'   },
    { value: 'centimeters', label: 'Centimeters (cm)',   symbol: 'cm'  }
];

function getMeasurementSymbol(measurement) {
    const found = quantityMeasurements.find(m => m.value === measurement);
    return found ? found.symbol : 'pcs';
}

// ==================== LOW STOCK CHECK ====================
function isLowStock(product) {
    if (!product || product.quantity === undefined || product.quantity === null) return false;
    if (product.quantity <= 0) return false;
    const originalQty = product.originalQuantity || product.quantity;
    const threshold = Math.ceil(originalQty * 0.2);
    return product.quantity <= threshold;
}

function getLowStockStatus(product) {
    if (!product) return { isLow: false, message: '' };
    const originalQty = product.originalQuantity || product.quantity;
    const threshold = Math.ceil(originalQty * 0.2);
    const isLow = product.quantity <= threshold && product.quantity > 0;
    const measurement = product.measurement || 'pieces';
    const measurementObj = quantityMeasurements.find(m => m.value === measurement) || quantityMeasurements[0];
    let message = '';
    if (isLow) {
        message = `⚠️ Low Stock! Only ${product.quantity} ${measurementObj.symbol} left (Threshold: ${threshold} ${measurementObj.symbol})`;
    } else if (product.quantity === 0) {
        message = `❌ Out of Stock!`;
    } else {
        message = `✅ In Stock: ${product.quantity} ${measurementObj.symbol}`;
    }
    return { isLow, threshold, measurement: measurementObj.symbol, message };
}

// ==================== PRODUCT MANAGEMENT ====================
function loadProducts(filter = 'all') {
    let products = db.products || [];
    if (filter === 'low') products = products.filter(p => isLowStock(p));
    else if (filter === 'out') products = products.filter(p => p.quantity === 0);
    displayProducts(products);
    updateStats();
}

function displayProducts(products) {
    const tbody = document.getElementById('productsBody');
    if (!products || products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 50px;">
            <p style="font-size: 24px; color: #666;">📭 No products found</p>
            <p style="color: #999; margin-top: 10px;">Click "Add Product" to start adding items</p>
        </td></tr>`;
        return;
    }
    let html = '';
    products.forEach(product => {
        let statusClass = 'status-good';
        let statusText  = 'In Stock';
        let titleText   = '';
        if (product.quantity === 0) {
            statusClass = 'status-danger';
            statusText  = 'Out of Stock';
            titleText   = 'No items left';
        } else {
            const originalQty = product.originalQuantity || product.quantity;
            const threshold   = Math.ceil(originalQty * 0.2);
            if (product.quantity <= threshold) {
                statusClass = 'status-warning';
                statusText  = `⚠️ Low Stock (${product.quantity}/${threshold})`;
                titleText   = `Original: ${originalQty}, Threshold: ${threshold} (20%)`;
            } else {
                const percent = Math.round((product.quantity / originalQty) * 100);
                statusText  = `✅ ${percent}% remaining`;
                titleText   = `Original: ${originalQty}, Current: ${product.quantity}`;
            }
        }
        const measurement       = product.measurement || 'pieces';
        const measurementSymbol = getMeasurementSymbol(measurement);
        html += `<tr class="${statusClass === 'status-warning' ? 'low-stock' : ''}">
            <td><strong>${product.name}</strong><br><small>${product.description || ''}</small></td>
            <td>${product.category}</td>
            <td>${product.price.toLocaleString()} RWF</td>
            <td>${product.quantity} ${measurementSymbol}</td>
            <td><span class="status-badge ${statusClass}" title="${titleText}">${statusText}</span></td>
            <td class="action-cell">
                <button onclick="editProduct(${product.id})" class="btn-small btn-edit" title="Edit">✏️</button>
                <button onclick="sellProductFromList(${product.id})" class="btn-small btn-sell" title="Sell">💰</button>
                <button onclick="viewProductDetails(${product.id})" class="btn-small btn-view" title="View">👁️</button>
                <button onclick="deleteProduct(${product.id})" class="btn-small btn-delete" title="Delete">🗑️</button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
    updateStats();
}

function updateStats() {
    const products = db.products || [];
    const totalProducts = products.length;
    let lowStock = 0;
    products.forEach(product => {
        if (product.quantity <= 0) return;
        const originalQty = product.originalQuantity || product.quantity;
        const threshold   = Math.ceil(originalQty * 0.2);
        if (product.quantity <= threshold) lowStock++;
    });
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const today      = new Date().toDateString();
    const todaySales = (db.sales || []).filter(s => new Date(s.date).toDateString() === today);
    const todayCount  = todaySales.length;
    const todayAmount = todaySales.reduce((sum, s) => sum + s.total, 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('totalProducts',     totalProducts);
    set('lowStockCount',     lowStock);
    set('lowStockBadge',     lowStock);
    set('todaySales',        todayCount);
    set('todaySalesAmount',  todayAmount.toLocaleString() + ' RWF');
    set('totalValue',        totalValue.toLocaleString() + ' RWF');
}

function showAddProductModal() {
    const select = document.getElementById('productCategorySelect');
    let options = '<option value="">Select Category</option>';
    db.categories.forEach(cat => { options += `<option value="${cat.name}">${cat.name}</option>`; });
    select.innerHTML = options;
    document.getElementById('addProductModal').style.display = 'flex';
}

function updateCategoryInput() {
    const select = document.getElementById('productCategorySelect');
    document.getElementById('productCategory').value = select.value;
}

function addProduct() {
    const category    = document.getElementById('productCategory').value;
    const name        = document.getElementById('productName').value;
    const price       = parseFloat(document.getElementById('productPrice').value);
    const quantity    = parseInt(document.getElementById('productQuantity').value);
    const measurement = document.getElementById('productMeasurement')?.value || 'pieces';
    const barcode     = document.getElementById('productBarcode').value;
    const expiry      = document.getElementById('productExpiry').value;
    const description = document.getElementById('productDescription').value;

    if (!name || !category || !price || !quantity) {
        showAlert('❌ Please fill all required fields!', 'warning'); return;
    }
    if (!db.categories.find(c => c.name === category)) {
        db.categories.push({ id: Date.now(), name: category, description: 'Auto-added', icon: '📁', count: 0 });
    }
    const newProduct = {
        id: Date.now(), name, category, price, quantity,
        originalQuantity: quantity, measurement,
        barcode: barcode || 'N/A', expiry: expiry || null,
        description: description || '', created: new Date().toISOString()
    };
    db.products.push(newProduct);
    saveDB();
    hideModal('addProductModal');
    clearProductForm();
    loadCategories();
    loadProducts();
    const threshold = Math.ceil(quantity * 0.2);
    showAlert(`✅ Product added! Low stock at ${threshold} ${getMeasurementSymbol(measurement)}`, 'success');
    logAudit(`Added product: ${name}`);
}

function clearProductForm() {
    ['productCategory','productName','productPrice','productQuantity','productBarcode','productExpiry','productDescription']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function editProduct(id) {
    const product = db.products.find(p => p.id === id);
    if (!product) return;
    const select = document.getElementById('editProductCategorySelect');
    let options = '<option value="">Select Category</option>';
    db.categories.forEach(cat => {
        options += `<option value="${cat.name}" ${cat.name === product.category ? 'selected' : ''}>${cat.name}</option>`;
    });
    select.innerHTML = options;
    document.getElementById('editProductId').value          = product.id;
    document.getElementById('editProductCategory').value    = product.category;
    document.getElementById('editProductName').value        = product.name;
    document.getElementById('editProductPrice').value       = product.price;
    document.getElementById('editProductQuantity').value    = product.quantity;
    document.getElementById('editProductBarcode').value     = product.barcode || '';
    document.getElementById('editProductExpiry').value      = product.expiry || '';
    document.getElementById('editProductDescription').value = product.description || '';
    document.getElementById('editProductModal').style.display = 'flex';
}

function updateProduct() {
    const id      = parseInt(document.getElementById('editProductId').value);
    const product = db.products.find(p => p.id === id);
    if (product) {
        product.category    = document.getElementById('editProductCategory').value;
        product.name        = document.getElementById('editProductName').value;
        product.price       = parseFloat(document.getElementById('editProductPrice').value);
        const newQuantity   = parseInt(document.getElementById('editProductQuantity').value);
        product.quantity    = newQuantity;
        if (!product.originalQuantity || confirm('Update original quantity for threshold calculation?')) {
            product.originalQuantity = newQuantity;
        }
        const measurement = document.getElementById('editProductMeasurement')?.value;
        if (measurement) product.measurement = measurement;
        product.barcode     = document.getElementById('editProductBarcode').value;
        product.expiry      = document.getElementById('editProductExpiry').value;
        product.description = document.getElementById('editProductDescription').value;
        saveDB();
        hideModal('editProductModal');
        loadCategories();
        loadProducts();
        showAlert('✅ Product updated successfully!', 'success');
        logAudit(`Updated product: ${product.name}`);
    }
}

function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        const product = db.products.find(p => p.id === id);
        db.products = db.products.filter(p => p.id !== id);
        saveDB();
        loadCategories();
        loadProducts();
        showAlert('🗑️ Product deleted', 'info');
        logAudit(`Deleted product: ${product.name}`);
    }
}

function deleteProductFromEdit() {
    const id = parseInt(document.getElementById('editProductId').value);
    hideModal('editProductModal');
    deleteProduct(id);
}

function viewProductDetails(id) {
    const product = db.products.find(p => p.id === id);
    if (!product) return;
    const html = `
        <h3>📦 ${product.name}</h3>
        <p><strong>Category:</strong> ${product.category}</p>
        <p><strong>Price:</strong> ${product.price.toLocaleString()} RWF</p>
        <p><strong>Quantity:</strong> ${product.quantity} ${getMeasurementSymbol(product.measurement)}</p>
        <p><strong>Original Quantity:</strong> ${product.originalQuantity || product.quantity} ${getMeasurementSymbol(product.measurement)}</p>
        <p><strong>Low Stock Threshold:</strong> ${Math.ceil((product.originalQuantity || product.quantity) * 0.2)} ${getMeasurementSymbol(product.measurement)}</p>
        <p><strong>Barcode:</strong> ${product.barcode}</p>
        <p><strong>Expiry:</strong> ${product.expiry || 'N/A'}</p>
        <p><strong>Description:</strong> ${product.description || 'N/A'}</p>
        <p><strong>Added:</strong> ${new Date(product.created).toLocaleString()}</p>`;
    document.getElementById('reportTitle').textContent = '📦 Product Details';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

// ==================== SALES MANAGEMENT ====================
function showSales() { showSellProductModal(); }

function showSellProductModal() {
    const select = document.getElementById('sellProductSelect');
    select.innerHTML = '<option value="">Select Product</option>';
    db.products.forEach(p => {
        if (p.quantity > 0) {
            select.innerHTML += `<option value="${p.id}">${p.name} (${p.quantity} left @ ${p.price} RWF)</option>`;
        }
    });
    document.getElementById('sellProductModal').style.display = 'flex';
}

function sellProductFromList(id) {
    const product = db.products.find(p => p.id === id);
    if (!product) return;
    const select = document.getElementById('sellProductSelect');
    select.innerHTML = `<option value="${product.id}">${product.name} (${product.quantity} available)</option>`;
    document.getElementById('sellProductModal').style.display = 'flex';
}

function sellProduct() {
    recordSaleWithBatch();
}

// ==================== PURCHASE MANAGEMENT ====================
function showPurchases() {
    const select = document.getElementById('purchaseProductSelect');
    select.innerHTML = '<option value="">Select Product</option>';
    db.products.forEach(p => { select.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseDate').value = today;
    document.getElementById('purchaseModal').style.display = 'flex';
}

function recordPurchase() {
    const productId = parseInt(document.getElementById('purchaseProductSelect').value);
    const quantity  = parseInt(document.getElementById('purchaseQuantity').value);
    const price     = parseFloat(document.getElementById('purchasePrice').value);
    const supplier  = document.getElementById('purchaseSupplier').value;
    const invoice   = document.getElementById('purchaseInvoice').value;
    const date      = document.getElementById('purchaseDate').value;
    const notes     = document.getElementById('purchaseNotes').value;

    if (!productId || !quantity || !price) {
        showAlert('❌ Please fill all required fields!', 'warning'); return;
    }
    const product = db.products.find(p => p.id === productId);
    if (product) {
        product.quantity += quantity;
        product.price = price;
        if (!db.purchases) db.purchases = [];
        db.purchases.push({
            id: Date.now(), productId, productName: product.name,
            quantity, price, total: price * quantity,
            supplier: supplier || 'Unknown', invoice: invoice || 'N/A',
            date: date || new Date().toISOString(), notes: notes || '',
            recordedAt: new Date().toISOString()
        });
        saveDB();
        hideModal('purchaseModal');
        ['purchaseQuantity','purchasePrice','purchaseSupplier','purchaseInvoice','purchaseNotes']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        loadProducts();
        showAlert(`📥 Purchase recorded: ${quantity} x ${product.name}`, 'success');
        logAudit(`Purchase: ${quantity} x ${product.name}`);
    }
}

// ==================== TRANSFER MANAGEMENT ====================
function showTransfers() {
    const select = document.getElementById('transferProductSelect');
    select.innerHTML = '<option value="">Select Product</option>';
    db.products.forEach(p => {
        if (p.quantity > 0) select.innerHTML += `<option value="${p.id}">${p.name} (${p.quantity} available)</option>`;
    });
    document.getElementById('transferModal').style.display = 'flex';
}

function transferStock() {
    const productId = parseInt(document.getElementById('transferProductSelect').value);
    const quantity  = parseInt(document.getElementById('transferQuantity').value);
    const from      = document.getElementById('transferFrom').value;
    const to        = document.getElementById('transferTo').value;
    const reference = document.getElementById('transferReference').value;
    const reason    = document.getElementById('transferReason').value;
    if (!productId || !quantity || !from || !to) {
        showAlert('❌ Please fill all fields!', 'warning'); return;
    }
    const product = db.products.find(p => p.id === productId);
    if (quantity > product.quantity) { showAlert(`❌ Only ${product.quantity} available!`, 'danger'); return; }
    product.quantity -= quantity;
    if (!db.transfers) db.transfers = [];
    db.transfers.push({
        id: Date.now(), productId, productName: product.name,
        quantity, from, to, reference: reference || 'N/A',
        reason: reason || 'Stock transfer', date: new Date().toISOString()
    });
    saveDB();
    hideModal('transferModal');
    ['transferQuantity','transferFrom','transferTo','transferReference','transferReason']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadProducts();
    showAlert(`🔄 Transfer completed: ${quantity} x ${product.name} from ${from} to ${to}`, 'success');
    logAudit(`Transfer: ${quantity} x ${product.name}`);
}

// ==================== RETURN MANAGEMENT ====================
function showReturns() {
    const select = document.getElementById('returnProductSelect');
    select.innerHTML = '<option value="">Select Product</option>';
    db.products.forEach(p => { select.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
    document.getElementById('returnModal').style.display = 'flex';
}

function returnStock() {
    const productId = parseInt(document.getElementById('returnProductSelect').value);
    const quantity  = parseInt(document.getElementById('returnQuantity').value);
    const type      = document.getElementById('returnType').value;
    const reason    = document.getElementById('returnReason').value;
    const reference = document.getElementById('returnReference').value;
    const notes     = document.getElementById('returnNotes').value;
    if (!productId || !quantity) { showAlert('❌ Please fill all fields!', 'warning'); return; }
    const product = db.products.find(p => p.id === productId);
    product.quantity += quantity;
    if (!db.returns) db.returns = [];
    db.returns.push({
        id: Date.now(), productId, productName: product.name,
        quantity, type, reason: reason || 'Return',
        reference: reference || 'N/A', notes: notes || '', date: new Date().toISOString()
    });
    saveDB();
    hideModal('returnModal');
    ['returnQuantity','returnReason','returnReference','returnNotes']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadProducts();
    showAlert(`↩️ Return processed: ${quantity} x ${product.name}`, 'success');
    logAudit(`Return: ${quantity} x ${product.name}`);
}

// ==================== ADJUSTMENT MANAGEMENT ====================
function showAdjustments() {
    const select = document.getElementById('adjustmentProductSelect');
    select.innerHTML = '<option value="">Select Product</option>';
    db.products.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name} (Current: ${p.quantity})</option>`;
    });
    document.getElementById('adjustmentModal').style.display = 'flex';
}

function updateAdjustmentCurrent() {
    const productId = parseInt(document.getElementById('adjustmentProductSelect').value);
    const product   = db.products.find(p => p.id === productId);
    if (product) document.getElementById('adjustmentCurrentQuantity').value = product.quantity;
}

function makeAdjustment() {
    const productId   = parseInt(document.getElementById('adjustmentProductSelect').value);
    const newQuantity = parseInt(document.getElementById('adjustmentNewQuantity').value);
    const type        = document.getElementById('adjustmentType').value;
    const reason      = document.getElementById('adjustmentReason').value;
    const notes       = document.getElementById('adjustmentNotes').value;
    if (!productId || !newQuantity) { showAlert('❌ Please fill all fields!', 'warning'); return; }
    const product    = db.products.find(p => p.id === productId);
    const oldQuantity = product.quantity;
    if (type === 'increase') {
        product.quantity += newQuantity;
    } else if (type === 'decrease') {
        if (newQuantity > product.quantity) {
            showAlert('❌ Cannot decrease more than current stock!', 'danger'); return;
        }
        product.quantity -= newQuantity;
    } else {
        product.quantity = newQuantity;
    }
    if (!db.adjustments) db.adjustments = [];
    db.adjustments.push({
        id: Date.now(), productId, productName: product.name,
        oldQuantity, newQuantity: product.quantity, type,
        reason: reason || 'Manual adjustment', notes: notes || '', date: new Date().toISOString()
    });
    saveDB();
    hideModal('adjustmentModal');
    ['adjustmentNewQuantity','adjustmentReason','adjustmentNotes']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadProducts();
    showAlert(`⚖️ Adjustment applied: ${product.name} ${oldQuantity} → ${product.quantity}`, 'success');
    logAudit(`Adjustment: ${product.name}`);
}

// ==================== BARCODE SCANNER ====================
function showBarcodeScanner() {
    document.getElementById('barcodeModal').style.display = 'flex';
}

function processBarcode() {
    const barcode = document.getElementById('barcodeInput').value;
    if (!barcode) { showAlert('❌ Please enter barcode', 'warning'); return; }
    const product = db.products.find(p => p.barcode === barcode);
    if (product) {
        showAlert(`📦 Found: ${product.name} (${product.quantity} in stock)`, 'success');
        const html = `
            <h3>📦 Product Found</h3>
            <p><strong>Name:</strong> ${product.name}</p>
            <p><strong>Category:</strong> ${product.category}</p>
            <p><strong>Price:</strong> ${product.price} RWF</p>
            <p><strong>Quantity:</strong> ${product.quantity}</p>
            <p><strong>Barcode:</strong> ${product.barcode}</p>
            <button onclick="quickSell(${product.id})" style="margin-top: 10px; padding: 10px;
                background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Quick Sell
            </button>`;
        document.getElementById('reportTitle').textContent = '📦 Scan Result';
        document.getElementById('reportContent').innerHTML = html;
        document.getElementById('reportModal').style.display = 'flex';
    } else {
        showAlert('❌ Product not found', 'warning');
        if (confirm('Product not found. Add it now?')) {
            hideModal('barcodeModal');
            showAddProductModal();
        }
    }
    document.getElementById('barcodeInput').value = '';
    hideModal('barcodeModal');
}

function quickSell(productId) {
    hideModal('reportModal');
    const product = db.products.find(p => p.id === productId);
    if (product) {
        const quantity = prompt(`How many ${product.name} to sell? (Max: ${product.quantity})`, '1');
        if (quantity) {
            const qty = parseInt(quantity);
            if (qty > 0 && qty <= product.quantity) {
                product.quantity -= qty;
                if (!db.sales) db.sales = [];
                db.sales.push({
                    id: Date.now(), productId, productName: product.name,
                    quantity: qty, price: product.price, total: product.price * qty,
                    date: new Date().toISOString()
                });
                saveDB();
                loadProducts();
                showAlert(`💰 Sold ${qty} x ${product.name}`, 'success');
            } else {
                showAlert('❌ Invalid quantity', 'danger');
            }
        }
    }
}

// ==================== REPORTS ====================
function showStockLevels() {
    let html = '<h3>📊 Current Stock Levels</h3>';
    html += '<table style="width:100%; border-collapse: collapse;">';
    html += '<tr style="background: #1a237e; color: white;"><th>Product</th><th>Category</th><th>Quantity</th><th>Price</th><th>Value</th></tr>';
    db.products.forEach(p => {
        html += `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.name}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.category}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.quantity} ${getMeasurementSymbol(p.measurement)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.price.toLocaleString()} RWF</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${(p.price * p.quantity).toLocaleString()} RWF</td>
        </tr>`;
    });
    html += '</table>';
    document.getElementById('reportTitle').textContent = '📊 Stock Levels Report';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed stock levels report');
}

function showStockReports() {
    const totalValue = db.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const lowStock   = db.products.filter(p => isLowStock(p)).length;
    const outOfStock = db.products.filter(p => p.quantity === 0).length;
    let html = '<h3>📋 Complete Stock Report</h3>';
    html += `<p><strong>Total Products:</strong> ${db.products.length}</p>`;
    html += `<p><strong>Total Categories:</strong> ${db.categories.length}</p>`;
    html += `<p><strong>Total Value:</strong> ${totalValue.toLocaleString()} RWF</p>`;
    html += `<p><strong>Low Stock Items (20% rule):</strong> ${lowStock}</p>`;
    html += `<p><strong>Out of Stock:</strong> ${outOfStock}</p>`;
    html += `<p><strong>Healthy Stock:</strong> ${db.products.length - lowStock - outOfStock}</p>`;
    document.getElementById('reportTitle').textContent = '📋 Stock Report';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed stock report');
}

function showIssueReports() {
    let html = '<h3>👥 Issue to Students/Staff Report</h3>';
    if (!db.sales || db.sales.length === 0) {
        html += '<p>No sales recorded yet.</p>';
    } else {
        html += '<table style="width:100%; border-collapse: collapse;">';
        html += '<tr style="background: #1a237e; color: white;"><th>Date</th><th>Product</th><th>Quantity</th><th>Customer</th><th>Total</th></tr>';
        db.sales.slice(-50).reverse().forEach(s => {
            html += `<tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(s.date).toLocaleDateString()}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${s.productName}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${s.quantity}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${s.customer || 'N/A'}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${s.total.toLocaleString()} RWF</td>
            </tr>`;
        });
        html += '</table>';
    }
    document.getElementById('reportTitle').textContent = '👥 Issue Report';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed issue report');
}

function showExpiryReport() {
    const today     = new Date();
    const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);
    let html = '<h3>📅 Expiry Report</h3>';
    const productsWithExpiry = db.products.filter(p => p.expiry);
    if (productsWithExpiry.length === 0) {
        html += '<p>No products with expiry dates.</p>';
    } else {
        html += '<table style="width:100%; border-collapse: collapse;">';
        html += '<tr style="background: #1a237e; color: white;"><th>Product</th><th>Expiry Date</th><th>Status</th></tr>';
        productsWithExpiry.forEach(p => {
            const expiry = new Date(p.expiry);
            let status = '✅ Good', color = '#4caf50';
            if (expiry < today)      { status = '❌ EXPIRED';       color = '#f44336'; }
            else if (expiry < thirtyDays) { status = '⚠️ Expiring soon'; color = '#ff9800'; }
            html += `<tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.name}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.expiry}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;color:${color};">${status}</td>
            </tr>`;
        });
        html += '</table>';
    }
    document.getElementById('reportTitle').textContent = '📅 Expiry Report';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed expiry report');
}

function showProcurement() {
    let html = '<h3>📦 Procurement History</h3>';
    if (!db.purchases || db.purchases.length === 0) {
        html += '<p>No purchases recorded yet.</p>';
    } else {
        html += '<table style="width:100%; border-collapse: collapse;">';
        html += '<tr style="background: #1a237e; color: white;"><th>Date</th><th>Product</th><th>Quantity</th><th>Supplier</th><th>Total</th></tr>';
        db.purchases.slice(-50).reverse().forEach(p => {
            html += `<tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(p.date).toLocaleDateString()}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.productName}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.quantity}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.supplier}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.total.toLocaleString()} RWF</td>
            </tr>`;
        });
        html += '</table>';
    }
    document.getElementById('reportTitle').textContent = '📦 Procurement Report';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed procurement report');
}

function showPurchaseOrders() {
    let html = '<h3>📑 Purchase Orders</h3>';
    if (!db.purchases || db.purchases.length === 0) {
        html += '<p>No purchase orders yet.</p>';
    } else {
        html += '<table style="width:100%; border-collapse: collapse;">';
        html += '<tr style="background: #1a237e; color: white;"><th>Order #</th><th>Date</th><th>Product</th><th>Supplier</th><th>Status</th></tr>';
        db.purchases.slice(-20).reverse().forEach((p, index) => {
            html += `<tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;">PO-${String(index+1).padStart(4,'0')}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(p.date).toLocaleDateString()}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.productName} (${p.quantity})</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.supplier}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;"><span style="color:#4caf50;">✓ Completed</span></td>
            </tr>`;
        });
        html += '</table>';
    }
    document.getElementById('reportTitle').textContent = '📑 Purchase Orders';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed purchase orders');
}

function showUsageReports() {
    const totalSales     = db.sales ? db.sales.length : 0;
    const totalRevenue   = db.sales ? db.sales.reduce((sum, s) => sum + s.total, 0) : 0;
    const totalPurchases = db.purchases ? db.purchases.length : 0;
    const totalTransfers = db.transfers ? db.transfers.length : 0;
    let html = '<h3>📈 Internal Usage Report</h3>';
    html += `<p><strong>Total Sales:</strong> ${totalSales}</p>`;
    html += `<p><strong>Total Revenue:</strong> ${totalRevenue.toLocaleString()} RWF</p>`;
    html += `<p><strong>Total Purchases:</strong> ${totalPurchases}</p>`;
    html += `<p><strong>Total Transfers:</strong> ${totalTransfers}</p>`;
    html += `<p><strong>Total Returns:</strong> ${db.returns ? db.returns.length : 0}</p>`;
    html += `<p><strong>Total Adjustments:</strong> ${db.adjustments ? db.adjustments.length : 0}</p>`;
    document.getElementById('reportTitle').textContent = '📈 Usage Report';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed usage report');
}

// ==================== ASSET MANAGEMENT ====================
function showGoodsReceiving() { showPurchases(); }

function showAssetManagement() {
    const totalInventoryValue = db.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    let html = '<h3>🏢 Asset Management</h3>';
    html += '<table style="width:100%; border-collapse: collapse;">';
    html += '<tr style="background: #1a237e; color: white;"><th>Asset Type</th><th>Value</th><th>Status</th><th>Last Updated</th></tr>';
    db.categories.slice(0, 5).forEach(cat => {
        const categoryProducts = db.products.filter(p => p.category === cat.name);
        const categoryValue    = categoryProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        html += `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${cat.icon} ${cat.name} Inventory</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${categoryValue.toLocaleString()} RWF</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;"><span style="color:#4caf50;">✅ Active</span></td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date().toLocaleDateString()}</td>
        </tr>`;
    });
    html += `<tr style="background:#f0f2f5;font-weight:bold;">
        <td style="padding:8px;">TOTAL ASSETS</td>
        <td style="padding:8px;">${totalInventoryValue.toLocaleString()} RWF</td>
        <td style="padding:8px;" colspan="2"></td>
    </tr>`;
    html += '</table>';
    document.getElementById('reportTitle').textContent = '🏢 Asset Management';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed asset management');
}

function showStockTransfers() { showTransfers(); }

function showUserRoles() {
    document.getElementById('userRoleModal').style.display = 'flex';
}

function addUser() {
    const name       = document.getElementById('userName').value;
    const email      = document.getElementById('userEmail').value;
    const role       = document.getElementById('userRole').value;
    const department = document.getElementById('userDepartment').value;
    const password   = document.getElementById('userPassword').value;
    if (!name || !email || !password) { showAlert('❌ Please fill all fields!', 'warning'); return; }
    if (!db.users) db.users = [];
    db.users.push({
        id: Date.now(), name, email, role,
        department: department || 'General',
        password: secureHash(password),
        created: new Date().toISOString(), lastLogin: null
    });
    saveDB();
    hideModal('userRoleModal');
    ['userName','userEmail','userDepartment','userPassword']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    showAlert('✅ User added successfully!', 'success');
    logAudit(`Added user: ${name} (${role})`);
}

function showRolePermissions() {
    let html = '<h3>🔑 Role Permissions</h3>';
    html += '<table style="width:100%"><tr><th>Role</th><th>Permissions</th></tr>';
    html += '<tr><td><strong>Admin</strong></td><td>Full access</td></tr>';
    html += '<tr><td><strong>Manager</strong></td><td>Add/edit products, view reports, cannot delete</td></tr>';
    html += '<tr><td><strong>Staff</strong></td><td>Can sell, view products, cannot edit</td></tr>';
    html += '<tr><td><strong>Viewer</strong></td><td>View only</td></tr>';
    html += '</table>';
    document.getElementById('reportTitle').textContent = '🔑 Permissions';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function showAuditLog() {
    let html = '<h3>📋 Audit Log</h3>';
    if (!db.auditLog || db.auditLog.length === 0) {
        html += '<p>No audit records yet.</p>';
    } else {
        html += '<table style="width:100%; border-collapse: collapse;">';
        html += '<tr style="background: #1a237e; color: white;"><th>Time</th><th>User</th><th>Action</th></tr>';
        db.auditLog.slice(-100).reverse().forEach(log => {
            html += `<tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(log.timestamp).toLocaleString()}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${log.user}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${log.action}</td>
            </tr>`;
        });
        html += '</table>';
    }
    document.getElementById('reportTitle').textContent = '📋 Audit Log';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

// ==================== SETTINGS ====================
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
        document.getElementById('settingsOrgName').textContent  = db.currentOrg?.name || 'N/A';
        document.getElementById('settingsOrgCode').textContent  = db.currentOrg?.code || 'N/A';
        document.getElementById('settingsUDC').textContent      = db.currentOrg?.udc  || 'N/A';
        document.getElementById('twoFAStatus').textContent      = db.settings.twoFA         ? 'Enabled' : 'Disabled';
        document.getElementById('notifStatus').textContent      = db.settings.notifications ? 'Enabled' : 'Disabled';
        document.getElementById('lastBackup').textContent       = localStorage.getItem('lastBackupTime') || 'Never';
    }
}

function showGeneralSettings() { toggleSettings(); }

// ==================== APPEARANCE ====================
function isLightColor(color) {
    let r, g, b;
    if (color.startsWith('#')) {
        const hex = color.substring(1);
        if (hex.length === 3) {
            r = parseInt(hex[0]+hex[0],16); g = parseInt(hex[1]+hex[1],16); b = parseInt(hex[2]+hex[2],16);
        } else {
            r = parseInt(hex.substring(0,2),16); g = parseInt(hex.substring(2,4),16); b = parseInt(hex.substring(4,6),16);
        }
    } else if (color.startsWith('rgb')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) { r=parseInt(matches[0]); g=parseInt(matches[1]); b=parseInt(matches[2]); }
        else return false;
    } else return false;
    return ((r*299+g*587+b*114)/1000) > 128;
}

function showAppearance() {
    const colors = [
        {name:'Professional Blue',value:'#1a237e'},{name:'Ocean Blue',value:'#1976d2'},
        {name:'Sky Blue',value:'#42a5f5'},{name:'Dark Blue',value:'#0d47a1'},
        {name:'Navy Blue',value:'#001f3f'},{name:'Turquoise',value:'#00bcd4'},
        {name:'Teal',value:'#00796b'},{name:'Forest Green',value:'#2e7d32'},
        {name:'Emerald',value:'#008000'},{name:'Royal Purple',value:'#4a148c'},
        {name:'Hot Pink',value:'#e91e63'},{name:'Magenta',value:'#c2185b'},
        {name:'Lavender',value:'#9c27b0'},{name:'Violet',value:'#673ab7'},
        {name:'Red',value:'#8c1414'},{name:'Crimson',value:'#b71c1c'},
        {name:'Orange',value:'#ff9800'},{name:'Amber',value:'#ffc107'},
        {name:'Dark Mode',value:'#263238'},{name:'Charcoal Grey',value:'#424242'},
        {name:'Slate Grey',value:'#607d8b'},{name:'Brown',value:'#795548'},
        {name:'Gold',value:'#ffd700'},{name:'Indigo',value:'#3f51b5'}
    ];
    let html = '<h3>🎨 Theme Customization</h3><p>Choose your preferred theme color:</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:20px 0;max-height:400px;overflow-y:auto;padding:10px;background:#f5f5f5;border-radius:10px;">';
    colors.forEach(color => {
        const isLight   = isLightColor(color.value);
        const textColor = isLight ? '#000' : '#fff';
        html += `<button onclick="setThemeColor('${color.value}')" style="
            padding:15px 20px;background:${color.value};color:${textColor};
            border:2px solid ${color.value==='#ffffff'?'#000':'rgba(255,255,255,0.3)'};
            border-radius:30px;cursor:pointer;font-weight:bold;flex:1 0 auto;min-width:150px;
            transition:all 0.3s;box-shadow:0 4px 8px rgba(0,0,0,0.1);"
            onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            ${color.name}
        </button>`;
    });
    html += `</div><p><strong>Current Theme:</strong> <span style="color:${db.settings.themeColor};">●</span> ${db.settings.themeColor}</p>`;
    document.getElementById('reportTitle').textContent = '🎨 Appearance Settings';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function setThemeColor(color) {
    db.settings.themeColor = color;
    saveDB();
    document.documentElement.style.setProperty('--primary', color);
    showAlert(`🎨 Theme changed to ${color}!`, 'success');
    hideModal('reportModal');
    logAudit(`Theme changed to ${color}`);
}

function showBackground() {
    const backgrounds = [
        {name:'Professional Purple',value:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'},
        {name:'Deep Ocean',value:'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)'},
        {name:'Forest Mist',value:'linear-gradient(135deg, #134e5e 0%, #71b280 100%)'},
        {name:'Sunset',value:'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)'},
        {name:'Night Sky',value:'linear-gradient(135deg, #232526 0%, #414345 100%)'},
        {name:'Lavender Dream',value:'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)'},
        {name:'Mint Fresh',value:'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'},
        {name:'Aurora',value:'linear-gradient(135deg, #74ebd5 0%, #acb6e5 100%)'},
        {name:'Bloody Mary',value:'linear-gradient(135deg, #ff512f 0%, #dd2476 100%)'},
        {name:'Sunny Morning',value:'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'},
        {name:'Emerald Water',value:'linear-gradient(135deg, #348f50 0%, #56b4d3 100%)'},
        {name:'Dark Knight',value:'linear-gradient(135deg, #232526 0%, #414345 100%)'},
        {name:'Grey Scale',value:'linear-gradient(135deg, #757f9a 0%, #d7dde8 100%)'},
        {name:'Purple Love',value:'linear-gradient(135deg, #cc2b5e 0%, #753a88 100%)'},
        {name:'Peach Smoothie',value:'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'},
        {name:'Cool Blues',value:'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)'}
    ];
    let html = '<h3>🖼️ Background Settings</h3><p>Choose your preferred background:</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:20px 0;max-height:400px;overflow-y:auto;padding:10px;background:#f5f5f5;border-radius:10px;">';
    backgrounds.forEach(bg => {
        html += `<button onclick="setBackground('${bg.value}')" style="
            padding:25px 30px;background:${bg.value};color:white;border:none;border-radius:15px;
            cursor:pointer;font-weight:bold;flex:1 0 auto;min-width:200px;transition:all 0.3s;
            text-shadow:1px 1px 3px rgba(0,0,0,0.5);box-shadow:0 4px 8px rgba(0,0,0,0.2);"
            onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            ${bg.name}
        </button>`;
    });
    html += '</div>';
    document.getElementById('reportTitle').textContent = '🖼️ Background';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function setBackground(gradient) {
    document.body.style.background = gradient;
    localStorage.setItem('bsms_background', gradient);
    showAlert('✅ Background updated!', 'success');
    hideModal('reportModal');
    logAudit('Background changed');
}

function showModules() {
    const modules = [
        {name:'Inventory Management',status:'✅ Active',desc:'Manage products and categories'},
        {name:'Sales Processing',status:'✅ Active',desc:'Record and track sales'},
        {name:'Purchase Management',status:'✅ Active',desc:'Manage purchases and suppliers'},
        {name:'Reports & Analytics',status:'✅ Active',desc:'Generate business reports'},
        {name:'User Management',status:'✅ Active',desc:'Manage system users'},
        {name:'Asset Tracking',status:'✅ Active',desc:'Track business assets'},
        {name:'Batch Tracking',status:'✅ Active',desc:'Track products by batch'},
        {name:'POS System',status:'✅ Active',desc:'Point of sale interface'}
    ];
    let html = '<h3>🧩 System Modules</h3><table style="width:100%;border-collapse:collapse;">';
    html += '<tr style="background:#1a237e;color:white;"><th>Module</th><th>Status</th><th>Description</th></tr>';
    modules.forEach(m => {
        html += `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${m.name}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${m.status}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${m.desc}</td></tr>`;
    });
    html += '</table>';
    document.getElementById('reportTitle').textContent = '🧩 System Modules';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed modules');
}

function showSecurity()      { db.settings.twoFA = !db.settings.twoFA; saveDB(); showAlert(`🔒 2FA ${db.settings.twoFA?'enabled':'disabled'}`, 'success'); }
function showNotifications() { db.settings.notifications = !db.settings.notifications; saveDB(); showAlert(`🔔 Notifications ${db.settings.notifications?'enabled':'disabled'}`, 'success'); }
function showAutoBackup()    { db.settings.autoBackup = !db.settings.autoBackup; saveDB(); showAlert(`💾 Auto backup ${db.settings.autoBackup?'enabled':'disabled'}`, 'success'); }
function showThemeColors()   { showAppearance(); }
function showTwoFA()         { showSecurity(); }
function showUserRoleSettings() { showUserRoles(); }

function showOrgInfo() {
    const org = db.currentOrg;
    if (!org) return;
    let html = '<h3>🏢 Organization Information</h3>';
    html += `<p><strong>Name:</strong> ${org.name}</p>`;
    html += `<p><strong>Code:</strong> ${org.code}</p>`;
    html += `<p><strong>Owner:</strong> ${org.owner}</p>`;
    html += `<p><strong>Type:</strong> ${org.type}</p>`;
    html += `<p><strong>Phone:</strong> ${org.phone}</p>`;
    html += `<p><strong>Email:</strong> ${org.email}</p>`;
    html += `<p><strong>Location:</strong> ${org.location}</p>`;
    html += `<p><strong>UDC:</strong> ${org.udc}</p>`;
    html += `<p><strong>Registered:</strong> ${new Date(org.registeredDate).toLocaleString()}</p>`;
    html += `<p><strong>Subscription:</strong> ${org.subscription.active ? 'Active' : 'Inactive'}</p>`;
    document.getElementById('reportTitle').textContent = '🏢 Organization Info';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function showAlertsReminders() {
    let html = '<h3>⏰ Alerts & Reminders</h3>';
    html += '<p><strong>Low Stock Alert:</strong> When quantity reaches 20% of original</p>';
    html += '<p><strong>Expiry Alert:</strong> 30 days before expiry</p>';
    html += '<p><strong>Subscription Alert:</strong> 7 days before expiry (once daily)</p>';
    html += `<button onclick="resetDailyReminder()" style="margin-top:10px;padding:10px;background:#4caf50;color:white;border:none;border-radius:5px;cursor:pointer;">🔄 Reset Today's Reminder</button>`;
    document.getElementById('reportTitle').textContent = '⏰ Alerts';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function showCurrencyTaxes() {
    let html = '<h3>💰 Currency & Taxes</h3>';
    html += `<p><strong>Currency:</strong> ${db.settings.currency}</p>`;
    html += `<p><strong>Tax Rate:</strong> ${db.settings.taxRate}%</p>`;
    document.getElementById('reportTitle').textContent = '💰 Currency';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function enableFeatures() {
    let html = '<h3>✨ Feature Management</h3><p>All core features are enabled.</p>';
    html += '<table style="width:100%"><tr><th>Feature</th><th>Status</th></tr>';
    ['Inventory Management','Sales Processing','Purchase Management','Reports','User Management','Batch Tracking','POS System']
        .forEach(f => { html += `<tr><td>${f}</td><td>✅ Enabled</td></tr>`; });
    html += '</table>';
    document.getElementById('reportTitle').textContent = '✨ Features';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

// ==================== DASHBOARD VIEWS ====================
function showDashboardOverview() { loadProducts('all'); updateActiveMenu('menuOverview'); }
function showLowStockItems()     { loadProducts('low'); updateActiveMenu('menuLowStock'); }
function showPendingItems()      { showAlert('⏳ No pending items at the moment', 'info'); }
function showInventoryOverview() { showStockLevels(); }
function showAllItems()          { loadProducts('all'); updateActiveTab('tabAll'); }
function showLowStockView()      { loadProducts('low'); updateActiveTab('tabLow'); }
function showOutOfStockView()    { loadProducts('out'); updateActiveTab('tabOut'); }
function showOverview()          { showDashboardOverview(); }
function showLowStock()          { showLowStockItems(); }
function showPending()           { showPendingItems(); }
function showIssues()            { showIssueReports(); }

function showCategories() {
    let html = '<h3>📁 Categories & Items</h3>';
    html += '<table style="width:100%"><tr><th>Category</th><th>Items</th><th>Description</th></tr>';
    db.categories.forEach(c => {
        const count = db.products.filter(p => p.category === c.name).length;
        html += `<tr><td>${c.icon||'📁'} ${c.name}</td><td>${count}</td><td>${c.description||''}</td></tr>`;
    });
    html += '</table>';
    document.getElementById('reportTitle').textContent = '📁 Categories';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function showAlerts() {
    const lowStock  = db.products.filter(p => isLowStock(p));
    const expired   = db.products.filter(p => p.expiry && new Date(p.expiry) < new Date());
    const expiring  = db.products.filter(p => {
        if (!p.expiry) return false;
        const expiry = new Date(p.expiry); const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate()+30);
        return expiry > new Date() && expiry < thirtyDays;
    });
    let html = '<h3>🔔 System Alerts</h3>';
    if (lowStock.length > 0) {
        html += '<h4>⚠️ Low Stock Alerts</h4><ul>';
        lowStock.forEach(p => { const t = Math.ceil((p.originalQuantity||p.quantity)*0.2); html += `<li>${p.name} - Only ${p.quantity} left! (Threshold: ${t})</li>`; });
        html += '</ul>';
    }
    if (expired.length > 0) {
        html += '<h4>❌ Expired Products</h4><ul>';
        expired.forEach(p => { html += `<li>${p.name} - Expired on ${p.expiry}</li>`; });
        html += '</ul>';
    }
    if (expiring.length > 0) {
        html += '<h4>⚠️ Expiring Soon</h4><ul>';
        expiring.forEach(p => { html += `<li>${p.name} - Expires on ${p.expiry}</li>`; });
        html += '</ul>';
    }
    if (!lowStock.length && !expired.length && !expiring.length) html += '<p>✅ No alerts at this time</p>';
    document.getElementById('reportTitle').textContent = '🔔 Alerts';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function showApprovals() { showAlert('✓ No pending approvals', 'info'); }

function showBatchTracking() {
    let html = '<h3>🔢 Batch & Serial Tracking</h3>';
    const batches = {};
    db.products.forEach(p => { if (!batches[p.category]) batches[p.category] = []; batches[p.category].push(p); });
    for (const [category, products] of Object.entries(batches)) {
        html += `<h4>📦 ${category} (${products.length} items)</h4><ul>`;
        products.forEach(p => {
            const batchId = 'BATCH-' + String(p.id).slice(-6);
            html += `<li>${batchId}: ${p.name} - ${p.quantity} ${getMeasurementSymbol(p.measurement)} (Added: ${new Date(p.created).toLocaleDateString()})</li>`;
        });
        html += '</ul>';
    }
    if (!Object.keys(batches).length) html += '<p>No batches available.</p>';
    document.getElementById('reportTitle').textContent = '🔢 Batch Tracking';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed batch tracking');
}

// ==================== POS SYSTEM ====================
let posCart = [];
let posDiscount = 0;
let posTax = 0;

function initializePOS() {
    posCart = [];
    posDiscount = 0;
    posTax = db.settings?.taxRate || 18;
    updatePOSDisplay();
}

function showPOS() {
    initializePOS();
    const availableProducts = db.products.filter(p => p.quantity > 0);
    let html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div style="background:#f5f5f5;padding:20px;border-radius:10px;">
                <h3>📦 Products</h3>
                <input type="text" id="posSearch" placeholder="🔍 Search products..."
                    style="width:100%;padding:10px;margin-bottom:15px;border:2px solid #ddd;border-radius:5px;box-sizing:border-box;"
                    onkeyup="searchPOSProducts(this.value)">
                <div id="posProductGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;max-height:400px;overflow-y:auto;">`;
    if (!availableProducts.length) {
        html += '<p>❌ No products available.</p>';
    } else {
        availableProducts.slice(0,20).forEach(p => {
            html += `<div onclick="addToPOSCart(${p.id})" style="background:white;padding:15px;border-radius:8px;cursor:pointer;
                border:2px solid transparent;transition:all 0.3s;box-shadow:0 2px 5px rgba(0,0,0,0.1);text-align:center;"
                onmouseover="this.style.borderColor='#1a237e'" onmouseout="this.style.borderColor='transparent'">
                <strong>${p.name}</strong><br>
                <span style="color:#1a237e;font-size:18px;">${p.price.toLocaleString()} RWF</span><br>
                <small>Stock: ${p.quantity} ${getMeasurementSymbol(p.measurement)}</small>
            </div>`;
        });
    }
    html += `</div></div>
        <div style="background:white;padding:20px;border-radius:10px;border:2px solid #1a237e;">
            <h3>🛒 Current Sale</h3>
            <div id="posCartItems" style="max-height:250px;overflow-y:auto;margin-bottom:15px;"></div>
            <div id="posSummary" style="background:#f5f5f5;padding:15px;border-radius:8px;margin-bottom:15px;"></div>
            <input type="text" id="posCustomer" placeholder="Customer Name"
                style="width:100%;padding:10px;margin-bottom:10px;border:2px solid #ddd;border-radius:5px;box-sizing:border-box;">
            <select id="posPaymentMethod" style="width:100%;padding:10px;margin-bottom:10px;border:2px solid #ddd;border-radius:5px;">
                <option value="cash">💰 Cash</option>
                <option value="mobile">📱 Mobile Money</option>
                <option value="card">💳 Card</option>
                <option value="credit">📝 Credit</option>
            </select>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <button onclick="processPOSPayment()" style="padding:15px;background:#4caf50;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">✅ Complete Sale</button>
                <button onclick="clearPOSCart()" style="padding:15px;background:#f44336;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🗑️ Clear Cart</button>
            </div>
            <div style="margin-top:10px;">
                <button onclick="applyDiscount()" style="padding:10px;background:#ff9800;color:white;border:none;border-radius:5px;cursor:pointer;width:48%;margin-right:2%;">🔖 Apply Discount</button>
                <button onclick="printReceipt()" style="padding:10px;background:#2196f3;color:white;border:none;border-radius:5px;cursor:pointer;width:48%;">🖨️ Print Receipt</button>
            </div>
        </div></div>`;
    document.getElementById('reportTitle').textContent = '🛒 Point of Sale';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    updatePOSDisplay();
    logAudit('Opened POS system');
}

function searchPOSProducts(query) {
    const grid = document.getElementById('posProductGrid');
    if (!grid) return;
    const products = db.products.filter(p =>
        p.quantity > 0 &&
        (p.name.toLowerCase().includes(query.toLowerCase()) ||
         p.category.toLowerCase().includes(query.toLowerCase()))
    );
    let html = '';
    products.slice(0,20).forEach(p => {
        html += `<div onclick="addToPOSCart(${p.id})" style="background:white;padding:15px;border-radius:8px;cursor:pointer;
            border:2px solid transparent;transition:all 0.3s;box-shadow:0 2px 5px rgba(0,0,0,0.1);text-align:center;">
            <strong>${p.name}</strong><br>
            <span style="color:#1a237e;font-size:18px;">${p.price.toLocaleString()} RWF</span><br>
            <small>Stock: ${p.quantity}</small>
        </div>`;
    });
    grid.innerHTML = html || '<p>No products found</p>';
}

function addToPOSCart(productId) {
    const product = db.products.find(p => p.id === productId);
    if (!product || product.quantity <= 0) { showAlert('❌ Product out of stock!', 'warning'); return; }
    const existing = posCart.find(item => item.productId === productId);
    if (existing) {
        if (existing.quantity < product.quantity) existing.quantity++;
        else { showAlert(`❌ Only ${product.quantity} available!`, 'warning'); return; }
    } else {
        posCart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1, maxQuantity: product.quantity, measurement: product.measurement || 'pieces' });
    }
    updatePOSDisplay();
    showAlert(`➕ Added ${product.name} to cart`, 'success');
}

function removeFromPOSCart(index) { posCart.splice(index,1); updatePOSDisplay(); showAlert('🗑️ Item removed','info'); }

function updateCartQuantity(index, newQuantity) {
    const item = posCart[index]; if (!item) return;
    if (newQuantity <= 0) { removeFromPOSCart(index); return; }
    if (newQuantity > item.maxQuantity) { showAlert(`❌ Only ${item.maxQuantity} available!`,'warning'); return; }
    item.quantity = newQuantity;
    updatePOSDisplay();
}

function updatePOSDisplay() {
    const cartDiv    = document.getElementById('posCartItems');
    const summaryDiv = document.getElementById('posSummary');
    if (!cartDiv || !summaryDiv) return;
    if (!posCart.length) {
        cartDiv.innerHTML = '<p style="text-align:center;color:#999;">Cart is empty</p>';
    } else {
        let cartHtml = '';
        posCart.forEach((item,index) => {
            cartHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #eee;">
                <div style="flex:2;"><strong>${item.name}</strong><br><small>${item.price.toLocaleString()} RWF</small></div>
                <div style="flex:1;display:flex;align-items:center;gap:5px;">
                    <button onclick="updateCartQuantity(${index},${item.quantity-1})" style="width:25px;height:25px;background:#f0f2f5;border:none;border-radius:3px;cursor:pointer;">−</button>
                    <span style="width:30px;text-align:center;">${item.quantity}</span>
                    <button onclick="updateCartQuantity(${index},${item.quantity+1})" style="width:25px;height:25px;background:#f0f2f5;border:none;border-radius:3px;cursor:pointer;">+</button>
                </div>
                <div style="flex:1;text-align:right;">${(item.price*item.quantity).toLocaleString()} RWF</div>
                <button onclick="removeFromPOSCart(${index})" style="background:none;border:none;color:#f44336;cursor:pointer;font-size:16px;">🗑️</button>
            </div>`;
        });
        cartDiv.innerHTML = cartHtml;
    }
    const subtotal       = posCart.reduce((sum,item) => sum + (item.price*item.quantity), 0);
    const discountAmount = (subtotal * posDiscount) / 100;
    const taxAmount      = ((subtotal - discountAmount) * posTax) / 100;
    const total          = subtotal - discountAmount + taxAmount;
    summaryDiv.innerHTML = `
        <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>${subtotal.toLocaleString()} RWF</span></div>
        ${posDiscount>0?`<div style="display:flex;justify-content:space-between;color:#f44336;"><span>Discount (${posDiscount}%):</span><span>-${discountAmount.toLocaleString()} RWF</span></div>`:''}
        <div style="display:flex;justify-content:space-between;"><span>Tax (${posTax}%):</span><span>${taxAmount.toLocaleString()} RWF</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px;margin-top:5px;padding-top:5px;border-top:2px solid #1a237e;">
            <span>TOTAL:</span><span style="color:#1a237e;">${total.toLocaleString()} RWF</span>
        </div>`;
}

function applyDiscount() {
    const discount = prompt('Enter discount percentage (%):', '0');
    if (discount !== null) {
        posDiscount = Math.max(0, Math.min(100, parseFloat(discount) || 0));
        updatePOSDisplay();
        showAlert(`🔖 Discount applied: ${posDiscount}%`, 'success');
    }
}

function clearPOSCart() {
    if (posCart.length > 0 && confirm('Clear all items from cart?')) {
        posCart = []; posDiscount = 0; updatePOSDisplay(); showAlert('🗑️ Cart cleared', 'info');
    }
}

function processPOSPayment() {
    if (!posCart.length) { showAlert('❌ Cart is empty!', 'warning'); return; }
    const customer       = document.getElementById('posCustomer')?.value || 'Walk-in';
    const paymentMethod  = document.getElementById('posPaymentMethod')?.value || 'cash';
    const subtotal       = posCart.reduce((sum,item) => sum + (item.price*item.quantity), 0);
    const discountAmount = (subtotal * posDiscount) / 100;
    const taxAmount      = ((subtotal - discountAmount) * posTax) / 100;
    const total          = subtotal - discountAmount + taxAmount;
    posCart.forEach(item => {
        const product = db.products.find(p => p.id === item.productId);
        if (product) product.quantity -= item.quantity;
    });
    if (!db.sales) db.sales = [];
    const sale = {
        id: Date.now(), items: posCart, subtotal,
        discount: posDiscount, discountAmount, tax: posTax, taxAmount,
        total, customer, paymentMethod, date: new Date().toISOString()
    };
    db.sales.push(sale);
    saveDB();
    showReceipt(sale);
    posCart = []; posDiscount = 0; updatePOSDisplay();
    showAlert(`✅ Sale completed! Total: ${total.toLocaleString()} RWF`, 'success');
    logAudit(`POS sale: ${total} RWF - ${customer}`);
    loadProducts();
}

function showReceipt(sale) {
    let receipt = `
        <div style="text-align:center;margin-bottom:20px;">
            <h2>BILLAN STOCK SYSTEM</h2>
            <p>Tel: +250 784 680 801</p>
            <p>${new Date().toLocaleString()}</p>
            <p>Receipt #: ${sale.id}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:2px solid #000;"><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>`;
    sale.items.forEach(item => {
        receipt += `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.price.toLocaleString()}</td><td>${(item.price*item.quantity).toLocaleString()}</td></tr>`;
    });
    receipt += `
        <tr style="border-top:2px solid #000;"><td colspan="3" style="text-align:right;">Subtotal:</td><td>${sale.subtotal.toLocaleString()} RWF</td></tr>
        ${sale.discount>0?`<tr><td colspan="3" style="text-align:right;">Discount (${sale.discount}%):</td><td>-${sale.discountAmount.toLocaleString()} RWF</td></tr>`:''}
        <tr><td colspan="3" style="text-align:right;">Tax (${sale.tax}%):</td><td>${sale.taxAmount.toLocaleString()} RWF</td></tr>
        <tr style="font-weight:bold;"><td colspan="3" style="text-align:right;">TOTAL:</td><td>${sale.total.toLocaleString()} RWF</td></tr>
        <tr><td colspan="4" style="text-align:center;padding-top:20px;">
            Payment Method: ${sale.paymentMethod}<br>Customer: ${sale.customer}<br>Thank you for your business!
        </td></tr>`;
    receipt += '</table>';
    document.getElementById('reportTitle').textContent = '🧾 Sale Receipt';
    document.getElementById('reportContent').innerHTML = receipt;
    document.getElementById('reportModal').style.display = 'flex';
}

function printReceipt() {
    const content = document.getElementById('reportContent').innerHTML;
    const title   = document.getElementById('reportTitle').textContent;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>${title}</title>
        <style>body{font-family:'Courier New',monospace;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{padding:5px;}</style>
        </head><body>${content}<p style="text-align:center;margin-top:30px;">Powered by BSMS TITAN</p></body></html>`);
    printWindow.document.close();
    printWindow.print();
}

function printReport() {
    const content = document.getElementById('reportContent').innerHTML;
    const title   = document.getElementById('reportTitle').textContent;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>${title}</title>
        <style>body{font-family:Arial;padding:20px;}table{border-collapse:collapse;width:100%;}
        th{background:#1a237e;color:white;padding:10px;}td{padding:8px;border-bottom:1px solid #ddd;}</style>
        </head><body><h2>${title}</h2>${content}<p><em>Generated on ${new Date().toLocaleString()}</em></p></body></html>`);
    printWindow.document.close();
    printWindow.print();
}

// ==================== DATA MANAGEMENT ====================
function exportData() { performBackup(); }

function performBackup() {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `bsms_titan_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    localStorage.setItem('lastBackupTime', new Date().toLocaleString());
    const lastBackup = document.getElementById('lastBackup');
    if (lastBackup) lastBackup.textContent = new Date().toLocaleString();
    showAlert('💾 Backup created successfully!', 'success');
    logAudit('Manual backup created');
}

function restoreBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file   = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const restored = JSON.parse(event.target.result);
                db = restored;
                saveDB();
                showAlert('✅ Backup restored! Refreshing...', 'success');
                logAudit('Backup restored');
                setTimeout(() => location.reload(), 2000);
            } catch (error) { showAlert('❌ Invalid backup file', 'danger'); }
        };
        reader.readAsText(file);
    };
    input.click();
}

function resetSystem() {
    if (confirm('⚠️ ARE YOU SURE? This will delete ALL data and reset the system!')) {
        ['bsms_titan_database_v8','bsms_admin_inbox','bsms_last_reminder_date','bsms_background']
            .forEach(key => localStorage.removeItem(key));
        showAlert('System reset! Reloading...', 'warning');
        setTimeout(() => location.reload(), 2000);
    }
}

// ==================== LOGOUT ====================
function logout() {
    if (timerInterval) clearInterval(timerInterval);
    logAudit(`Logout: ${db.currentOrg?.name}`);
    db.currentOrg  = null;
    db.currentUser = null;
    saveDB();
    showLogin();
    showAlert('👋 Logged out successfully', 'info');
}

// ==================== UTILITIES ====================
function logAudit(action) {
    if (!db.auditLog) db.auditLog = [];
    db.auditLog.push({ id: Date.now(), action, user: db.currentUser?.name || 'system', timestamp: new Date().toISOString() });
    if (db.auditLog.length > 1000) db.auditLog.shift();
    saveDB();
}

function hideModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
}

function showAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.style.cssText = `
        position:fixed;top:20px;right:20px;padding:15px 25px;border-radius:10px;
        color:white;font-weight:bold;z-index:20000;
        background:${type==='success'?'#4caf50':type==='warning'?'#ff9800':type==='danger'?'#f44336':'#2196f3'};
        box-shadow:0 5px 15px rgba(0,0,0,0.3);`;
    alert.textContent = message;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
}

function updateUI() {
    if (db.currentOrg) { loadCategories(); loadProducts(); updateStats(); }
    const savedBg = localStorage.getItem('bsms_background');
    if (savedBg) document.body.style.background = savedBg;
}

function updateActiveMenu(activeId) {
    document.querySelectorAll('.sidebar-menu a').forEach(item => item.classList.remove('active'));
    const el = document.getElementById(activeId);
    if (el) el.classList.add('active');
}

function updateActiveTab(activeId) {
    ['tabAll','tabLow','tabOut'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('active'); });
    const el = document.getElementById(activeId);
    if (el) el.classList.add('active');
}

function searchProducts(query) {
    const products = db.products || [];
    if (!query.trim()) { loadProducts(); return; }
    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.category    && p.category.toLowerCase().includes(query.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(query.toLowerCase())) ||
        (p.barcode     && p.barcode.toLowerCase().includes(query.toLowerCase()))
    );
    if (!filtered.length) {
        document.getElementById('productsBody').innerHTML = `
            <tr><td colspan="6" style="text-align:center;padding:50px;">
                <p style="font-size:18px;color:#666;">🔍 No products found matching "${query}"</p>
            </td></tr>`;
    } else {
        displayProducts(filtered);
    }
}

// ==================== AUTO BACKUP ====================
setInterval(() => {
    if (db.settings?.autoBackup) localStorage.setItem('bsms_titan_auto_backup', JSON.stringify(db));
}, 300000);

// ==================== BATCH TRACKING ====================
let batches = [];

function loadBatches() {
    try { const saved = localStorage.getItem('bsms_batches'); batches = saved ? JSON.parse(saved) : []; }
    catch (e) { batches = []; }
    return batches;
}

function saveBatches() {
    try { localStorage.setItem('bsms_batches', JSON.stringify(batches)); }
    catch (e) { console.log('Error saving batches:', e); }
}

function sellFromBatch(productId, quantity) {
    loadBatches();
    const productBatches = batches
        .filter(b => b.productId === productId && b.remainingQuantity > 0 && b.status === 'active')
        .sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
    let remainingToSell = quantity;
    const soldFromBatches = [];
    for (const batch of productBatches) {
        if (remainingToSell <= 0) break;
        const sellFromThisBatch = Math.min(batch.remainingQuantity, remainingToSell);
        batch.remainingQuantity -= sellFromThisBatch;
        remainingToSell -= sellFromThisBatch;
        soldFromBatches.push({ batchNumber: batch.batchNumber, quantity: sellFromThisBatch, expiryDate: batch.expiryDate });
        if (batch.remainingQuantity === 0) { batch.status = 'depleted'; batch.depletedDate = new Date().toISOString(); }
    }
    saveBatches();
    return soldFromBatches;
}

function recordSaleWithBatch() {
    const productId     = parseInt(document.getElementById('sellProductSelect')?.value);
    const quantity      = parseInt(document.getElementById('sellQuantity')?.value);
    const customer      = document.getElementById('sellCustomer')?.value;
    const paymentMethod = document.getElementById('sellPaymentMethod')?.value;
    const reference     = document.getElementById('sellReference')?.value;
    const notes         = document.getElementById('sellNotes')?.value;

    if (!productId)            { showAlert('❌ Please select a product!', 'warning'); return; }
    if (!quantity || quantity <= 0) { showAlert('❌ Please enter a valid quantity!', 'warning'); return; }

    const product = db.products.find(p => p.id === productId);
    if (!product)              { showAlert('❌ Product not found!', 'danger'); return; }
    if (quantity > product.quantity) { showAlert(`❌ Only ${product.quantity} available!`, 'danger'); return; }

    let soldBatches = [];
    try { soldBatches = sellFromBatch(productId, quantity); }
    catch (e) { console.log('Batch tracking error (non-critical):', e); }

    product.quantity -= quantity;
    if (!db.sales) db.sales = [];
    const sale = {
        id: Date.now(), productId, productName: product.name, quantity,
        price: product.price, total: product.price * quantity,
        customer: customer || 'Walk-in', paymentMethod: paymentMethod || 'cash',
        reference: reference || 'N/A', notes: notes || '',
        batches: soldBatches, date: new Date().toISOString()
    };
    db.sales.push(sale);
    saveDB();

    ['sellQuantity','sellCustomer','sellReference','sellNotes']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    hideModal('sellProductModal');
    loadProducts();

    if (soldBatches.length > 0) {
        const batchInfo = soldBatches.map(b => `${b.batchNumber} (${b.quantity})`).join(', ');
        showAlert(`💰 Sale recorded from batches: ${batchInfo}`, 'success');
    } else {
        showAlert(`💰 Sale recorded: ${quantity} x ${product.name}`, 'success');
    }
    logAudit(`Sale: ${quantity} x ${product.name}`);
}

// ==================== INITIALIZE ====================
loadDB();
showLogin();

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'h') { e.preventDefault(); showAdminPanel(); }
});

console.log('✅ BSMS TITAN v8.0 - FIXED VERSION loaded!');
console.log('🔒 Security: Subscription bypass patched');
console.log('👑 Admin: Approve/Reject buttons fixed');
console.log('📋 Pending subscriptions: Now showing correctly');