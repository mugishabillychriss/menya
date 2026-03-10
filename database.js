// ==================================================================================
// BSMS TITAN v9.0 — PER-USER ISOLATED STORAGE
// ==================================================================================
// Each organization's data is stored in its own private localStorage namespace.
// The namespace key is derived from the UDC — so two different orgs can NEVER
// access each other's products, sales, categories, settings, or audit log.
//
// Storage layout:
//   bsms_user_{HASHED_UDC}         → org's private data (products, sales, etc.)
//   bsms_global_orgs                → registered org profiles (name, code, udc, subscription)
//   bsms_admin_inbox                → admin notifications
//   bsms_session                    → current logged-in session (no sensitive data)
//   bsms_last_reminder_{HASHED_UDC} → per-user subscription expiry reminder flag
// ==================================================================================

// ==================== KEY HELPERS ====================

/**
 * Derives a storage key from the UDC.
 * We hash the UDC so the raw credential never appears as a localStorage key.
 */
function getUDCStorageKey(udc) {
    return `bsms_user_${secureHash(udc)}`;
}

function getReminderKey(udc) {
    return `bsms_last_reminder_${secureHash(udc)}`;
}

const GLOBAL_ORGS_KEY = 'bsms_global_orgs';
const ADMIN_INBOX_KEY = 'bsms_admin_inbox';
const SESSION_KEY     = 'bsms_session';

// ==================== FRESH USER DATABASE TEMPLATE ====================

function createFreshUserDB(udc) {
    return {
        _udcHash: secureHash(udc),   // stored for integrity check, never the raw UDC
        products: [],
        categories: [
            { id: 1, name: 'Food',        description: 'Food items',        icon: '🍚', count: 0 },
            { id: 2, name: 'Beverages',   description: 'Drinks',            icon: '🥤', count: 0 },
            { id: 3, name: 'Cleaning',    description: 'Cleaning supplies', icon: '🧹', count: 0 },
            { id: 4, name: 'Electronics', description: 'Electronic items',  icon: '📱', count: 0 },
            { id: 5, name: 'Stationery',  description: 'Office supplies',   icon: '📝', count: 0 },
            { id: 6, name: 'Hardware',    description: 'Tools & hardware',  icon: '🔧', count: 0 }
        ],
        sales:       [],
        purchases:   [],
        transfers:   [],
        returns:     [],
        adjustments: [],
        users:       [],
        auditLog:    [],
        settings: {
            darkMode:          false,
            autoBackup:        true,
            currency:          'RWF',
            taxRate:           18,
            themeColor:        '#1a237e',
            notifications:     true,
            twoFA:             false,
            lowStockThreshold: 5,
            companyName:       '',
            companyLogo:       '',
            dateFormat:        'DD/MM/YYYY'
        }
    };
}

// ==================== GLOBAL STATE ====================
// db.userData  — the active user's private isolated store
// db.currentOrg / db.currentUser — session identity (from global orgs)
// All arrays (products, sales, etc.) are proxied into db.userData

let db = {
    userData:    null,
    currentOrg:  null,
    currentUser: null,

    // Convenience proxies — all reads/writes go to userData
    get products()    { return this.userData?.products    || []; },
    get categories()  { return this.userData?.categories  || []; },
    get sales()       { return this.userData?.sales       || []; },
    get purchases()   { return this.userData?.purchases   || []; },
    get transfers()   { return this.userData?.transfers   || []; },
    get returns()     { return this.userData?.returns     || []; },
    get adjustments() { return this.userData?.adjustments || []; },
    get users()       { return this.userData?.users       || []; },
    get auditLog()    { return this.userData?.auditLog    || []; },
    get settings()    { return this.userData?.settings    || {}; },

    set products(v)    { if (this.userData) this.userData.products    = v; },
    set categories(v)  { if (this.userData) this.userData.categories  = v; },
    set sales(v)       { if (this.userData) this.userData.sales       = v; },
    set purchases(v)   { if (this.userData) this.userData.purchases   = v; },
    set transfers(v)   { if (this.userData) this.userData.transfers   = v; },
    set returns(v)     { if (this.userData) this.userData.returns     = v; },
    set adjustments(v) { if (this.userData) this.userData.adjustments = v; },
    set users(v)       { if (this.userData) this.userData.users       = v; },
    set auditLog(v)    { if (this.userData) this.userData.auditLog    = v; },
    set settings(v)    { if (this.userData) this.userData.settings    = v; },

    // organizations: always read/write global store directly
    get organizations()  { return loadGlobalOrgs(); },
    set organizations(v) { saveGlobalOrgs(v); },

    // pendingSubscriptions are embedded in each org in global orgs
    get pendingSubscriptions() {
        const orgs = loadGlobalOrgs();
        const subs = [];
        orgs.forEach(o => { if (o.pendingSubscriptions) subs.push(...o.pendingSubscriptions); });
        return subs;
    }
};

// ==================== GLOBAL ORGS STORE ====================
// Stores only identity/subscription data — never per-user inventory.

function loadGlobalOrgs() {
    try {
        const saved = localStorage.getItem(GLOBAL_ORGS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
}

function saveGlobalOrgs(orgs) {
    localStorage.setItem(GLOBAL_ORGS_KEY, JSON.stringify(orgs));
}

// ==================== PER-USER DATA LOAD / SAVE ====================

function loadUserData(udc) {
    try {
        const key   = getUDCStorageKey(udc);
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            console.log(`✅ Loaded private data for user (hash: ${secureHash(udc)})`);
            return parsed;
        }
    } catch (e) {
        console.error('Error loading user data:', e);
    }
    // First login — create a fresh private database for this user
    console.log(`🆕 First login — creating isolated database for this UDC`);
    const fresh = createFreshUserDB(udc);
    initializeSampleData(fresh);
    saveUserDataRaw(udc, fresh);
    return fresh;
}

function saveUserDataRaw(udc, data) {
    try {
        const key = getUDCStorageKey(udc);
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) { console.error('Error saving user data:', e); }
}

/**
 * Main save function used throughout the app.
 * Saves the active user's private data AND syncs currentOrg changes
 * (e.g. subscription updates) back to the global orgs list.
 */
function saveDB() {
    if (!db.currentOrg || !db.userData) return;

    // Save user's private isolated data
    saveUserDataRaw(db.currentOrg.udc, db.userData);

    // Sync currentOrg profile back to global orgs (subscription, etc.)
    const orgs = loadGlobalOrgs();
    const idx  = orgs.findIndex(o => o.id === db.currentOrg.id);
    if (idx !== -1) {
        // Merge — don't overwrite with stale data, only update mutable fields
        orgs[idx].subscription        = db.currentOrg.subscription;
        orgs[idx].pendingSubscriptions = db.currentOrg.pendingSubscriptions || [];
        saveGlobalOrgs(orgs);
    }
}

// ==================== SESSION MANAGEMENT ====================

function saveSession(org, user) {
    // Only store non-sensitive identity — NOT the UDC
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        orgId:    org.id,
        orgName:  org.name,
        orgCode:  org.code,
        userName: user.name,
        userRole: user.role
    }));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// ==================== SAMPLE DATA ====================

function initializeSampleData(userData) {
    userData.products = [
        { id: Date.now()+1, name: 'Indomyi',  category: 'Food',      price: 2500, quantity: 45, originalQuantity: 45, barcode: '123456', expiry: '2025-12-31', description: 'Popular snack', measurement: 'pieces'    },
        { id: Date.now()+2, name: 'Fanta',    category: 'Beverages', price: 800,  quantity: 12, originalQuantity: 12, barcode: '789012', expiry: '2025-06-30', description: 'Orange soda',   measurement: 'pieces'    },
        { id: Date.now()+3, name: 'Rice 5kg', category: 'Food',      price: 7500, quantity: 8,  originalQuantity: 8,  barcode: '345678', expiry: '2026-01-15', description: 'Premium rice',  measurement: 'kilograms' },
        { id: Date.now()+4, name: 'Soap',     category: 'Cleaning',  price: 1200, quantity: 3,  originalQuantity: 3,  barcode: '901234', expiry: '2025-04-20', description: 'Bath soap',     measurement: 'pieces'    },
        { id: Date.now()+5, name: 'Milk',     category: 'Dairy',     price: 1500, quantity: 2,  originalQuantity: 2,  barcode: '567890', expiry: '2024-12-01', description: 'Fresh milk',    measurement: 'liters'    }
    ];
    updateCategoryCounts(userData);
}

// ==================== APP INITIALISE ====================

function loadDB() {
    // Attempt to restore a previous session (no UDC stored — user must re-login)
    try {
        const sessionStr = localStorage.getItem(SESSION_KEY);
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            const orgs    = loadGlobalOrgs();
            const org     = orgs.find(o => o.id === session.orgId);
            if (org) {
                // Session found but UDC is not stored — show login with org fields pre-filled
                document.getElementById('orgCode').value = org.code;
                document.getElementById('orgName').value = org.name;
                document.getElementById('orgCode').dispatchEvent(new Event('input'));
                showAlert(`👋 Welcome back, ${org.name}! Please enter your UDC to continue.`, 'info');
            }
        }
    } catch (e) { /* silent — just show clean login */ }
    showLogin();
}

// ==================== SECURITY ====================

function secureHash(str) {
    let hash = 0;
    if (!str || str.length === 0) return '0';
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

const ADMIN_PASSWORD_HASH = secureHash('BILLAN2026');

// ==================== UDC GENERATION ====================

function generateUDC() {
    const symbols   = '!@#$%&*?';
    const numbers   = '0123456789';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    result += symbols.charAt(Math.floor(Math.random() * symbols.length));
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    result += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    result += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    const allChars = symbols + numbers + uppercase + lowercase;
    for (let i = 0; i < 2; i++) result += allChars.charAt(Math.floor(Math.random() * allChars.length));
    return result.split('').sort(() => Math.random() - 0.5).join('');
}

// ==================== ADMIN PANEL ====================

function showAdminPanel() {
    const modalHtml = `
        <div id="adminPasswordModal" style="position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;
            z-index:100000;backdrop-filter:blur(5px);">
            <div style="background:white;padding:40px;border-radius:20px;
                box-shadow:0 20px 60px rgba(0,0,0,0.5);max-width:400px;width:90%;border:5px solid #1a237e;">
                <h2 style="color:#1a237e;margin-bottom:20px;text-align:center;">👑 ADMIN ONLY ACCESS</h2>
                <p style="text-align:center;color:#666;margin-bottom:25px;">Enter admin password to continue</p>
                <div style="position:relative;margin-bottom:25px;">
                    <input type="password" id="adminPasswordInput" placeholder="Enter password"
                        style="width:100%;padding:15px 45px 15px 15px;border:2px solid #e0e0e0;
                        border-radius:10px;font-size:16px;outline:none;box-sizing:border-box;"
                        onfocus="this.style.borderColor='#1a237e'" onblur="this.style.borderColor='#e0e0e0'"
                        onkeydown="if(event.key==='Enter') submitAdminPassword()">
                    <span onclick="togglePasswordVisibility()" style="position:absolute;right:15px;
                        top:50%;transform:translateY(-50%);cursor:pointer;color:#1a237e;font-size:18px;">
                        <i class="fas fa-eye" id="passwordEyeIcon"></i>
                    </span>
                </div>
                <div style="display:flex;gap:10px;">
                    <button onclick="submitAdminPassword()" style="flex:2;padding:15px;
                        background:linear-gradient(135deg,#1a237e,#0d1757);color:white;border:none;
                        border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;">ACCESS</button>
                    <button onclick="closeAdminPasswordModal()" style="flex:1;padding:15px;
                        background:#f44336;color:white;border:none;border-radius:10px;
                        font-size:16px;font-weight:bold;cursor:pointer;">CANCEL</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('adminPasswordInput')?.focus(), 100);
}

function togglePasswordVisibility() {
    const input   = document.getElementById('adminPasswordInput');
    const icon    = document.getElementById('passwordEyeIcon');
    if (!input || !icon) return;
    if (input.type === 'password') { input.type = 'text';     icon.className = 'fas fa-eye-slash'; }
    else                           { input.type = 'password'; icon.className = 'fas fa-eye'; }
}

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

function renderAdminPanel() {
    closeAdminPanel();
    const orgs       = loadGlobalOrgs();
    const adminInbox = JSON.parse(localStorage.getItem(ADMIN_INBOX_KEY) || '[]');

    // Gather all pending subscriptions across all orgs
    const allPending = [];
    orgs.forEach(o => (o.pendingSubscriptions || [])
        .filter(s => s.status === 'pending')
        .forEach(s => allPending.push(s))
    );

    // Count per-user data sizes for the table
    const getDataSize = (udc) => {
        try {
            const raw = localStorage.getItem(getUDCStorageKey(udc));
            if (!raw) return '—';
            const kb = (raw.length / 1024).toFixed(1);
            const data = JSON.parse(raw);
            return `${data.products?.length || 0} products, ${data.sales?.length || 0} sales (${kb} KB)`;
        } catch (e) { return '—'; }
    };

    let html = `
        <div id="adminPanel" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
            background:white;padding:30px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);
            z-index:100001;max-width:900px;width:95%;max-height:85vh;overflow-y:auto;border:5px solid #1a237e;">
            <h2 style="color:#1a237e;margin-bottom:5px;">👑 ADMIN PANEL (AOA)</h2>
            <p style="color:#999;font-size:12px;margin-bottom:20px;">
                Storage: Each user's data is isolated under <code>bsms_user_{hash(UDC)}</code>
            </p>

            <!-- STATS -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:25px;">
                <div style="background:#e8eaf6;padding:15px;border-radius:10px;text-align:center;">
                    <div style="font-size:28px;font-weight:bold;color:#1a237e;">${orgs.length}</div>
                    <div style="color:#666;font-size:13px;">Total Organizations</div>
                </div>
                <div style="background:#e8f5e9;padding:15px;border-radius:10px;text-align:center;">
                    <div style="font-size:28px;font-weight:bold;color:#2e7d32;">${orgs.filter(o => o.subscription?.active).length}</div>
                    <div style="color:#666;font-size:13px;">Active Subscriptions</div>
                </div>
                <div style="background:#fff3e0;padding:15px;border-radius:10px;text-align:center;">
                    <div style="font-size:28px;font-weight:bold;color:#e65100;">${allPending.length}</div>
                    <div style="color:#666;font-size:13px;">Pending Approvals</div>
                </div>
            </div>

            <!-- UDC INBOX -->
            <h3 style="color:#1a237e;margin-bottom:15px;">📋 New Registration UDCs</h3>`;

    const udcEntries = adminInbox.filter(i => i.type !== 'subscription_request');
    if (!udcEntries.length) {
        html += '<p style="text-align:center;padding:20px;background:#f5f5f5;border-radius:10px;color:#999;">📭 No new registrations.</p>';
    } else {
        udcEntries.forEach((item, index) => {
            html += `
                <div style="background:${item.read ? '#f5f5f5' : '#e8eaf6'};padding:20px;margin-bottom:12px;
                    border-radius:10px;border-left:5px solid #1a237e;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                        <div>
                            <strong>🏢 ${item.organization}</strong>
                            <span style="color:#666;margin-left:10px;">(${item.orgCode})</span>
                            <div style="font-size:12px;color:#999;margin-top:3px;">📅 ${new Date(item.date).toLocaleString()}</div>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button onclick="markUDCAsRead(${index})" style="padding:6px 14px;background:#4caf50;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;">✓ Mark Read</button>
                            <button onclick="deleteUDC(${index})"    style="padding:6px 14px;background:#c62828;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;">🗑️ Delete</button>
                        </div>
                    </div>
                    <div style="font-size:24px;font-weight:bold;color:#1a237e;text-align:center;
                        letter-spacing:4px;background:white;padding:12px;border-radius:8px;
                        margin-top:12px;font-family:monospace;border:2px dashed #c5cae9;">
                        ${item.udc}
                    </div>
                    <div style="font-size:11px;color:#aaa;text-align:center;margin-top:6px;">
                        Stored under key: <code>bsms_user_${secureHash(item.udc)}</code>
                    </div>
                </div>`;
        });
    }

    // PENDING SUBSCRIPTIONS
    html += `<h3 style="color:#1a237e;margin:25px 0 15px;">💳 Pending Subscription Approvals
        <span style="background:#f44336;color:white;padding:2px 10px;border-radius:20px;font-size:13px;margin-left:8px;">${allPending.length}</span>
    </h3>`;

    if (!allPending.length) {
        html += '<p style="text-align:center;padding:20px;background:#f5f5f5;border-radius:10px;color:#999;">✅ No pending requests.</p>';
    } else {
        allPending.forEach(req => {
            html += `
                <div style="background:#fff3e0;padding:20px;margin-bottom:12px;border-radius:10px;border-left:5px solid #ff9800;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                        <div>
                            <strong>🏢 ${req.orgName}</strong> <span style="color:#666;">(${req.orgCode})</span><br>
                            <span style="font-size:13px;">Owner: ${req.owner} &nbsp;|&nbsp; Plan: ${req.planMonths === 0 ? '7-day FREE trial' : req.planMonths + ' months'}</span><br>
                            <span style="font-size:12px;color:#999;">Requested: ${new Date(req.requestDate).toLocaleString()}</span>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button onclick="approveSubscription(${req.id})" style="padding:8px 18px;background:#4caf50;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Approve</button>
                            <button onclick="rejectSubscription(${req.id})"  style="padding:8px 18px;background:#f44336;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">❌ Reject</button>
                        </div>
                    </div>
                </div>`;
        });
    }

    // ALL ORGANIZATIONS TABLE
    html += `<h3 style="color:#1a237e;margin:25px 0 15px;">🏢 All Organizations & Their Storage</h3>`;
    if (!orgs.length) {
        html += '<p style="color:#999;">No organizations registered yet.</p>';
    } else {
        html += `<div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                    <tr style="background:#1a237e;color:white;">
                        <th style="padding:10px;text-align:left;">Organization</th>
                        <th style="padding:10px;text-align:left;">Code</th>
                        <th style="padding:10px;text-align:left;">Owner</th>
                        <th style="padding:10px;text-align:left;">Subscription</th>
                        <th style="padding:10px;text-align:left;">Private Data</th>
                    </tr>
                </thead>
                <tbody>`;
        orgs.forEach(o => {
            const subStatus = o.subscription?.active
                ? `<span style="color:#2e7d32;">✅ Active until ${new Date(o.subscription.endDate).toLocaleDateString()}</span>`
                : `<span style="color:#c62828;">❌ Inactive</span>`;
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px;">${o.name}</td>
                    <td style="padding:10px;font-family:monospace;">${o.code}</td>
                    <td style="padding:10px;">${o.owner}</td>
                    <td style="padding:10px;">${subStatus}</td>
                    <td style="padding:10px;color:#666;">${getDataSize(o.udc)}</td>
                </tr>`;
        });
        html += '</tbody></table></div>';
    }

    html += `
        <button onclick="closeAdminPanel()" style="width:100%;padding:15px;background:#1a237e;color:white;
            border:none;border-radius:8px;margin-top:25px;cursor:pointer;font-size:16px;font-weight:bold;">
            ✕ CLOSE
        </button></div>`;

    document.body.insertAdjacentHTML('beforeend', html);
}

function closeAdminPasswordModal() {
    document.getElementById('adminPasswordModal')?.remove();
}

function closeAdminPanel() {
    document.getElementById('adminPanel')?.remove();
}

function markUDCAsRead(index) {
    let inbox = JSON.parse(localStorage.getItem(ADMIN_INBOX_KEY) || '[]');
    const udcEntries = inbox.filter(i => i.type !== 'subscription_request');
    if (udcEntries[index]) udcEntries[index].read = true;
    let ui = 0;
    inbox = inbox.map(i => i.type !== 'subscription_request' ? udcEntries[ui++] : i);
    localStorage.setItem(ADMIN_INBOX_KEY, JSON.stringify(inbox));
    closeAdminPanel(); renderAdminPanel();
}

function deleteUDC(index) {
    let inbox = JSON.parse(localStorage.getItem(ADMIN_INBOX_KEY) || '[]');
    const udcEntries = inbox.filter(i => i.type !== 'subscription_request');
    const subEntries = inbox.filter(i => i.type === 'subscription_request');
    udcEntries.splice(index, 1);
    localStorage.setItem(ADMIN_INBOX_KEY, JSON.stringify([...udcEntries, ...subEntries]));
    closeAdminPanel(); renderAdminPanel();
    showAlert('✅ Entry deleted', 'success');
}

function approveSubscription(requestId) {
    const orgs = loadGlobalOrgs();
    let foundOrg = null, foundReq = null;
    orgs.forEach(o => {
        const req = (o.pendingSubscriptions || []).find(r => r.id === requestId);
        if (req) { foundOrg = o; foundReq = req; }
    });
    if (!foundOrg || !foundReq) { showAlert('❌ Request not found!', 'danger'); return; }

    const days    = foundReq.planMonths === 0 ? 7 : foundReq.planMonths * 30;
    const endDate = new Date(); endDate.setDate(endDate.getDate() + days);
    foundOrg.subscription = { active: true, startDate: new Date().toISOString(), endDate: endDate.toISOString(), tier: foundReq.planMonths === 0 ? 'trial' : foundReq.planMonths + ' months' };
    foundReq.status = 'approved';
    saveGlobalOrgs(orgs);

    let inbox = JSON.parse(localStorage.getItem(ADMIN_INBOX_KEY) || '[]');
    inbox = inbox.filter(i => !(i.type === 'subscription_request' && i.requestId === requestId));
    localStorage.setItem(ADMIN_INBOX_KEY, JSON.stringify(inbox));

    showAlert(`✅ ${foundOrg.name} approved! (${days} days)`, 'success');
    logAudit(`Subscription approved: ${foundOrg.name}`);
    closeAdminPanel(); renderAdminPanel();
}

function rejectSubscription(requestId) {
    const orgs = loadGlobalOrgs();
    let foundOrg = null, foundReq = null;
    orgs.forEach(o => {
        const req = (o.pendingSubscriptions || []).find(r => r.id === requestId);
        if (req) { foundOrg = o; foundReq = req; }
    });
    if (!foundOrg || !foundReq) { showAlert('❌ Request not found!', 'danger'); return; }

    foundReq.status = 'rejected';
    saveGlobalOrgs(orgs);

    let inbox = JSON.parse(localStorage.getItem(ADMIN_INBOX_KEY) || '[]');
    inbox = inbox.filter(i => !(i.type === 'subscription_request' && i.requestId === requestId));
    localStorage.setItem(ADMIN_INBOX_KEY, JSON.stringify(inbox));

    showAlert(`❌ Subscription rejected for ${foundOrg.name}`, 'info');
    logAudit(`Subscription rejected: ${foundOrg.name}`);
    closeAdminPanel(); renderAdminPanel();
}

// ==================== PAGE NAVIGATION ====================

function showLogin() {
    document.getElementById('loginPage').style.display    = 'block';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('aboutPage').style.display    = 'none';
    document.getElementById('paymentPage').style.display  = 'none';
    document.getElementById('dashboard').style.display    = 'none';
    document.getElementById('waitingPage')?.remove();
}

function showRegister() {
    document.getElementById('loginPage').style.display    = 'none';
    document.getElementById('registerPage').style.display = 'block';
    document.getElementById('aboutPage').style.display    = 'none';
    document.getElementById('paymentPage').style.display  = 'none';
    document.getElementById('dashboard').style.display    = 'none';
}

function showAbout() {
    document.getElementById('loginPage').style.display    = 'none';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('aboutPage').style.display    = 'block';
    document.getElementById('paymentPage').style.display  = 'none';
    document.getElementById('dashboard').style.display    = 'none';
}

function hideAllPages() {
    ['loginPage','registerPage','aboutPage','paymentPage','dashboard'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById('waitingPage')?.remove();
}

// ==================== REGISTER ====================

function register() {
    const orgName  = document.getElementById('regOrgName')?.value?.trim();
    const orgCode  = document.getElementById('regOrgCode')?.value?.trim().toUpperCase();
    const owner    = document.getElementById('regOwner')?.value?.trim();
    const type     = document.getElementById('regType')?.value;
    const phone    = document.getElementById('regPhone')?.value?.trim();
    const email    = document.getElementById('regEmail')?.value?.trim();
    const location = document.getElementById('regLocation')?.value?.trim();

    if (!orgName || !orgCode || !owner || !phone) { showAlert('❌ Please fill all required fields!', 'warning'); return; }

    const orgs = loadGlobalOrgs();
    if (orgs.find(o => o.code === orgCode)) { showAlert('❌ Organization code already taken!', 'danger'); return; }

    const udc = generateUDC();
    const organization = {
        id: Date.now(), name: orgName, code: orgCode, owner, type, phone,
        email: email || 'Not provided', location: location || 'Not specified',
        udc, registeredDate: new Date().toISOString(),
        subscription: { active: false, startDate: null, endDate: null, tier: null },
        pendingSubscriptions: []
    };

    orgs.push(organization);
    saveGlobalOrgs(orgs);

    // Notify admin inbox
    let inbox = JSON.parse(localStorage.getItem(ADMIN_INBOX_KEY) || '[]');
    inbox.push({ organization: orgName, orgCode, udc, date: new Date().toISOString(), read: false });
    localStorage.setItem(ADMIN_INBOX_KEY, JSON.stringify(inbox));

    showAlert('✅ Registered! An admin will send you your UDC to log in.', 'success');
    ['regOrgName','regOrgCode','regOwner','regPhone','regEmail','regLocation'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    showLogin();
}

// ==================== LOGIN ====================

function login() {
    const orgCode = document.getElementById('orgCode')?.value?.trim().toUpperCase();
    const orgName = document.getElementById('orgName')?.value?.trim();
    const udc     = document.getElementById('udcCode')?.value?.trim();

    if (!orgCode || !orgName || !udc) { showAlert('❌ Please fill all fields!', 'warning'); return; }

    // Always read fresh global orgs for latest subscription state
    const orgs = loadGlobalOrgs();
    const org  = orgs.find(o => o.code === orgCode && o.name === orgName && o.udc === udc);

    if (!org) {
        showAlert('❌ Invalid credentials. Please check your Organization Code, Name and UDC.', 'danger');
        logAudit('Failed login attempt');
        return;
    }

    // Set session identity (UDC is NOT saved to session storage)
    db.currentOrg  = org;
    db.currentUser = { name: org.owner, role: 'admin' };

    // Load THIS user's private isolated data using their UDC as namespace key
    db.userData = loadUserData(udc);

    saveSession(org, db.currentUser);
    hideAllPages();

    // Check subscription
    const isActive = org.subscription?.active === true;
    if (isActive) {
        const now = new Date(), end = new Date(org.subscription.endDate);
        if (end > now) {
            document.getElementById('dashboard').style.display = 'block';
            loadDashboardData();
            showAlert(`✅ Welcome back, ${org.owner}! Your private workspace is loaded.`, 'success');
        } else {
            org.subscription.active = false;
            saveDB();
            document.getElementById('paymentPage').style.display = 'block';
            showAlert('⚠️ Subscription expired. Please renew.', 'warning');
        }
    } else {
        const hasPending = (org.pendingSubscriptions || []).some(r => r.status === 'pending');
        hasPending ? showWaitingApproval() : (document.getElementById('paymentPage').style.display = 'block');
        showAlert('✅ Login successful!', 'success');
    }

    logAudit(`Login: ${orgName}`);
}

function loadDashboardData() {
    document.getElementById('dashboardOrgName').textContent = db.currentOrg.name;
    document.getElementById('dashboardOrgCode').textContent = 'Code: ' + db.currentOrg.code;
    document.getElementById('settingsOrgName').textContent  = db.currentOrg.name;
    document.getElementById('settingsOrgCode').textContent  = db.currentOrg.code;
    document.getElementById('settingsUDC').textContent      = '••••••'; // Never display raw UDC
    loadCategories();
    loadProducts();
    startSubscriptionTimer();
    updateStats();
    showWelcomeCelebration();
}

// ==================== PAYMENT ====================

let selectedTier = null, selectedPrice = null;

function selectTier(months, price) {
    selectedTier = months; selectedPrice = price;
    ['tier3','tier6','tier9','tier12','tier0'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.border = 'none';
    });
    event.currentTarget.style.border = '3px solid #1a237e';
}

function requestSubscription() {
    if (selectedTier === null) { showAlert('❌ Please select a plan!', 'warning'); return; }
    const org = db.currentOrg;
    if (!org) { showAlert('❌ No organization selected!', 'danger'); return; }

    org.subscription = { active: false, startDate: null, endDate: null, tier: null };
    if (!org.pendingSubscriptions) org.pendingSubscriptions = [];
    // Remove old rejected requests
    org.pendingSubscriptions = org.pendingSubscriptions.filter(r => r.status !== 'rejected');

    const request = {
        id: Date.now(), orgId: org.id, orgName: org.name, orgCode: org.code,
        owner: org.owner, planMonths: selectedTier, requestDate: new Date().toISOString(), status: 'pending'
    };
    org.pendingSubscriptions.push(request);
    saveDB();

    let inbox = JSON.parse(localStorage.getItem(ADMIN_INBOX_KEY) || '[]');
    inbox.push({ type: 'subscription_request', organization: org.name, orgCode: org.code,
        plan: selectedTier === 0 ? '7-day trial' : selectedTier + ' months',
        requestId: request.id, date: new Date().toISOString(), read: false });
    localStorage.setItem(ADMIN_INBOX_KEY, JSON.stringify(inbox));

    hideAllPages(); showWaitingApproval();
    showAlert('💳 Request sent! Awaiting admin approval.', 'info');
    logAudit(`Subscription request: ${org.name} — ${selectedTier === 0 ? '7-day trial' : selectedTier + ' months'}`);
}

function processPayment() {
    showAlert('⚠️ Direct payment is disabled. Please use the subscription request flow.', 'warning');
}

function showWaitingApproval() {
    hideAllPages();
    document.body.insertAdjacentHTML('beforeend', `
        <div id="waitingPage" style="text-align:center;padding:60px;background:white;
            border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.2);max-width:500px;margin:50px auto;">
            <h2 style="color:#1a237e;margin-bottom:20px;">⏳ Awaiting Approval</h2>
            <p style="font-size:18px;margin-bottom:20px;">Your subscription request has been sent to the administrator.</p>
            <p style="color:#888;">Contact support if you need faster assistance.</p>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:25px;">
                <button onclick="checkApprovalStatus()" style="padding:12px 28px;background:#4caf50;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">🔄 Check Status</button>
                <button onclick="logout()"              style="padding:12px 28px;background:#1a237e;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Logout</button>
            </div>
        </div>`);
}

function checkApprovalStatus() {
    if (!db.currentOrg) { showLogin(); return; }
    const orgs     = loadGlobalOrgs();
    const freshOrg = orgs.find(o => o.id === db.currentOrg.id);
    if (!freshOrg) { showLogin(); return; }
    db.currentOrg = freshOrg;
    saveSession(freshOrg, db.currentUser);

    if (freshOrg.subscription?.active && new Date(freshOrg.subscription.endDate) > new Date()) {
        hideAllPages();
        document.getElementById('dashboard').style.display = 'block';
        loadDashboardData();
        showAlert('🎉 Subscription approved! Welcome in.', 'success');
    } else {
        const hasPending = (freshOrg.pendingSubscriptions || []).some(r => r.status === 'pending');
        showAlert(hasPending ? '⏳ Still pending. Please wait.' : '❌ Request rejected. Contact admin.', hasPending ? 'info' : 'danger');
    }
}

// ==================== SUBSCRIPTION TIMER ====================

let timerInterval;

function startSubscriptionTimer() {
    if (timerInterval) clearInterval(timerInterval);
    checkAndShowDailyReminder();
    timerInterval = setInterval(() => {
        if (!db.currentOrg?.subscription?.active) return;
        const diff    = new Date(db.currentOrg.subscription.endDate) - new Date();
        if (diff <= 0) { clearInterval(timerInterval); lockSystem(); return; }
        const days    = Math.floor(diff / 86400000);
        const hours   = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const el = document.getElementById('subscriptionTimer');
        if (el) el.textContent = `${String(days).padStart(3,'0')}:${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
        const cel = document.getElementById('settingsCounter');
        if (cel) cel.textContent = `${Math.floor(days/365)}y ${Math.floor((days%365)/30)}m ${days%30}d ${hours}h ${minutes}m`;
    }, 1000);
}

function checkAndShowDailyReminder() {
    if (!db.currentOrg?.subscription?.active) return;
    const days = Math.floor((new Date(db.currentOrg.subscription.endDate) - new Date()) / 86400000);
    if (days <= 7 && days > 0) {
        const reminderKey = getReminderKey(db.currentOrg.udc);
        const today       = new Date().toDateString();
        if (localStorage.getItem(reminderKey) !== today) {
            showAlert(`⚠️ Subscription expires in ${days} day${days > 1 ? 's' : ''}! Please renew.`, 'warning');
            localStorage.setItem(reminderKey, today);
        }
    }
}

function resetDailyReminder() {
    if (db.currentOrg?.udc) localStorage.removeItem(getReminderKey(db.currentOrg.udc));
    showAlert('✅ Daily reminder reset', 'success');
}

function lockSystem() {
    document.getElementById('mainContent').innerHTML = `
        <div style="text-align:center;padding:100px;">
            <h2 style="color:#c62828;">🔒 SUBSCRIPTION EXPIRED</h2>
            <p>Please renew to continue using BSMS TITAN.</p>
            <button onclick="showRenewal()" style="margin-top:20px;padding:15px 30px;
                background:#1a237e;color:white;border:none;border-radius:10px;cursor:pointer;">RENEW NOW</button>
        </div>`;
}

function showRenewal() {
    hideAllPages(); document.getElementById('paymentPage').style.display = 'block';
}

function showWelcomeCelebration() {
    showAlert(`🎉 WELCOME, ${db.currentOrg.name}! Your private data is ready.`, 'success');
}

// ==================== CATEGORY MANAGEMENT ====================

function loadCategories() {
    const catBtns = document.getElementById('categoryButtons');
    if (!catBtns) return;
    updateCategoryCounts();

    let btns = '<button class="category-btn active" onclick="filterByCategory(\'all\')">📋 All Categories</button>';
    db.categories.forEach(c => {
        btns += `<button class="category-btn" onclick="filterByCategory('${c.name}')">${c.icon || '📁'} ${c.name} (${c.count || 0})</button>`;
    });
    catBtns.innerHTML = btns;

    const makeOpts = () => '<option value="">Select Category</option>' + db.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const sel1 = document.getElementById('productCategorySelect');
    const sel2 = document.getElementById('editProductCategorySelect');
    if (sel1) sel1.innerHTML = makeOpts();
    if (sel2) sel2.innerHTML = makeOpts();
    const tc = document.getElementById('totalCategories');
    if (tc) tc.textContent = db.categories.length;
}

function updateCategoryCounts(data) {
    const d = data || db.userData;
    if (!d) return;
    d.categories.forEach(c => c.count = 0);
    d.products.forEach(p => {
        const cat = d.categories.find(c => c.name === p.category);
        if (cat) cat.count = (cat.count || 0) + 1;
    });
}

function filterByCategory(category) {
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    const products = category === 'all' ? db.products : db.products.filter(p => p.category === category);
    displayProducts(products);
}

function showAddCategoryModal() { document.getElementById('addCategoryModal').style.display = 'flex'; }

function addCategory() {
    const name = document.getElementById('categoryName').value?.trim();
    const desc = document.getElementById('categoryDescription').value;
    const icon = document.getElementById('categoryIcon').value || '📁';
    if (!name) { showAlert('❌ Please enter a category name', 'warning'); return; }
    if (db.categories.find(c => c.name.toLowerCase() === name.toLowerCase())) { showAlert('❌ Category already exists!', 'danger'); return; }
    db.userData.categories.push({ id: Date.now(), name, description: desc || '', icon, count: 0 });
    saveDB(); loadCategories(); hideModal('addCategoryModal');
    ['categoryName','categoryDescription','categoryIcon'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    showAlert('✅ Category added!', 'success'); logAudit(`Added category: ${name}`);
}

// ==================== MEASUREMENTS ====================

const quantityMeasurements = [
    { value: 'pieces',      label: 'Pieces (pcs)',     symbol: 'pcs' },
    { value: 'kilograms',   label: 'Kilograms (kg)',   symbol: 'kg'  },
    { value: 'grams',       label: 'Grams (g)',        symbol: 'g'   },
    { value: 'liters',      label: 'Liters (L)',       symbol: 'L'   },
    { value: 'milliliters', label: 'Milliliters (mL)', symbol: 'mL'  },
    { value: 'boxes',       label: 'Boxes (box)',      symbol: 'box' },
    { value: 'cartons',     label: 'Cartons (ctn)',    symbol: 'ctn' },
    { value: 'dozens',      label: 'Dozens (dz)',      symbol: 'dz'  },
    { value: 'meters',      label: 'Meters (m)',       symbol: 'm'   },
    { value: 'centimeters', label: 'Centimeters (cm)', symbol: 'cm'  }
];

function getMeasurementSymbol(measurement) {
    return (quantityMeasurements.find(m => m.value === measurement) || quantityMeasurements[0]).symbol;
}

// ==================== LOW STOCK ====================

function isLowStock(p) {
    if (!p || p.quantity <= 0) return false;
    return p.quantity <= Math.ceil((p.originalQuantity || p.quantity) * 0.2);
}

// ==================== PRODUCT MANAGEMENT ====================

function loadProducts(filter = 'all') {
    let products = db.products;
    if      (filter === 'low') products = products.filter(p => isLowStock(p));
    else if (filter === 'out') products = products.filter(p => p.quantity === 0);
    displayProducts(products); updateStats();
}

function displayProducts(products) {
    const tbody = document.getElementById('productsBody');
    if (!products?.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:50px;">
            <p style="font-size:24px;color:#666;">📭 No products found</p>
            <p style="color:#999;margin-top:10px;">Click "Add Product" to get started</p></td></tr>`;
        return;
    }
    tbody.innerHTML = products.map(p => {
        let cls = 'status-good', txt = 'In Stock', title = '';
        if (p.quantity === 0) { cls = 'status-danger'; txt = 'Out of Stock'; title = 'No items left'; }
        else {
            const orig  = p.originalQuantity || p.quantity;
            const thresh = Math.ceil(orig * 0.2);
            if (p.quantity <= thresh) { cls = 'status-warning'; txt = `⚠️ Low (${p.quantity}/${thresh})`; title = `Threshold: ${thresh}`; }
            else { txt = `✅ ${Math.round((p.quantity/orig)*100)}% remaining`; title = `Orig: ${orig}`; }
        }
        const sym = getMeasurementSymbol(p.measurement || 'pieces');
        return `<tr class="${cls === 'status-warning' ? 'low-stock' : ''}">
            <td><strong>${p.name}</strong><br><small>${p.description || ''}</small></td>
            <td>${p.category}</td>
            <td>${p.price.toLocaleString()} RWF</td>
            <td>${p.quantity} ${sym}</td>
            <td><span class="status-badge ${cls}" title="${title}">${txt}</span></td>
            <td class="action-cell">
                <button onclick="editProduct(${p.id})"         class="btn-small btn-edit"   title="Edit">✏️</button>
                <button onclick="sellProductFromList(${p.id})" class="btn-small btn-sell"   title="Sell">💰</button>
                <button onclick="viewProductDetails(${p.id})"  class="btn-small btn-view"   title="View">👁️</button>
                <button onclick="deleteProduct(${p.id})"       class="btn-small btn-delete" title="Delete">🗑️</button>
            </td></tr>`;
    }).join('');
    updateStats();
}

function updateStats() {
    const ps    = db.products;
    const low   = ps.filter(p => p.quantity > 0 && p.quantity <= Math.ceil((p.originalQuantity || p.quantity) * 0.2)).length;
    const val   = ps.reduce((s, p) => s + p.price * p.quantity, 0);
    const today = new Date().toDateString();
    const ts    = db.sales.filter(s => new Date(s.date).toDateString() === today);
    const set   = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('totalProducts',   ps.length);
    set('totalCategories', db.categories.length);
    set('lowStockCount',   low);
    set('lowStockBadge',   low);
    set('todaySales',      ts.length);
    set('todaySalesAmount', ts.reduce((s, t) => s + t.total, 0).toLocaleString() + ' RWF');
    set('totalValue',      val.toLocaleString() + ' RWF');
}

function showAddProductModal() {
    document.getElementById('productCategorySelect').innerHTML =
        '<option value="">Select Category</option>' + db.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    document.getElementById('addProductModal').style.display = 'flex';
}

function updateCategoryInput() {
    document.getElementById('productCategory').value = document.getElementById('productCategorySelect').value;
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
    if (!name || !category || !price || !quantity) { showAlert('❌ Please fill all required fields!', 'warning'); return; }
    if (!db.userData.categories.find(c => c.name === category))
        db.userData.categories.push({ id: Date.now(), name: category, description: 'Auto-added', icon: '📁', count: 0 });
    db.userData.products.push({ id: Date.now(), name, category, price, quantity, originalQuantity: quantity, measurement, barcode: barcode || 'N/A', expiry: expiry || null, description: description || '', created: new Date().toISOString() });
    saveDB(); hideModal('addProductModal'); clearProductForm(); loadCategories(); loadProducts();
    showAlert(`✅ Product added! Low stock threshold: ${Math.ceil(quantity * 0.2)} ${getMeasurementSymbol(measurement)}`, 'success');
    logAudit(`Added product: ${name}`);
}

function clearProductForm() {
    ['productCategory','productName','productPrice','productQuantity','productBarcode','productExpiry','productDescription']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function editProduct(id) {
    const p = db.products.find(p => p.id === id); if (!p) return;
    document.getElementById('editProductCategorySelect').innerHTML =
        '<option value="">Select Category</option>' + db.categories.map(c => `<option value="${c.name}"${c.name === p.category ? ' selected' : ''}>${c.name}</option>`).join('');
    document.getElementById('editProductId').value          = p.id;
    document.getElementById('editProductCategory').value    = p.category;
    document.getElementById('editProductName').value        = p.name;
    document.getElementById('editProductPrice').value       = p.price;
    document.getElementById('editProductQuantity').value    = p.quantity;
    document.getElementById('editProductBarcode').value     = p.barcode || '';
    document.getElementById('editProductExpiry').value      = p.expiry  || '';
    document.getElementById('editProductDescription').value = p.description || '';
    document.getElementById('editProductModal').style.display = 'flex';
}

function updateProduct() {
    const id  = parseInt(document.getElementById('editProductId').value);
    const p   = db.userData.products.find(p => p.id === id); if (!p) return;
    p.category    = document.getElementById('editProductCategory').value;
    p.name        = document.getElementById('editProductName').value;
    p.price       = parseFloat(document.getElementById('editProductPrice').value);
    const newQty  = parseInt(document.getElementById('editProductQuantity').value);
    p.quantity    = newQty;
    if (!p.originalQuantity || confirm('Update original quantity for threshold calculation?')) p.originalQuantity = newQty;
    const msmt = document.getElementById('editProductMeasurement')?.value;
    if (msmt) p.measurement = msmt;
    p.barcode     = document.getElementById('editProductBarcode').value;
    p.expiry      = document.getElementById('editProductExpiry').value;
    p.description = document.getElementById('editProductDescription').value;
    saveDB(); hideModal('editProductModal'); loadCategories(); loadProducts();
    showAlert('✅ Product updated!', 'success'); logAudit(`Updated product: ${p.name}`);
}

function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    const p = db.userData.products.find(p => p.id === id);
    db.userData.products = db.userData.products.filter(p => p.id !== id);
    saveDB(); loadCategories(); loadProducts();
    showAlert('🗑️ Product deleted', 'info'); logAudit(`Deleted product: ${p?.name}`);
}

function deleteProductFromEdit() {
    const id = parseInt(document.getElementById('editProductId').value);
    hideModal('editProductModal'); deleteProduct(id);
}

function viewProductDetails(id) {
    const p = db.products.find(p => p.id === id); if (!p) return;
    const sym = getMeasurementSymbol(p.measurement);
    document.getElementById('reportTitle').textContent = '📦 Product Details';
    document.getElementById('reportContent').innerHTML = `
        <h3>📦 ${p.name}</h3>
        <p><strong>Category:</strong> ${p.category}</p>
        <p><strong>Price:</strong> ${p.price.toLocaleString()} RWF</p>
        <p><strong>Quantity:</strong> ${p.quantity} ${sym}</p>
        <p><strong>Original Quantity:</strong> ${p.originalQuantity || p.quantity} ${sym}</p>
        <p><strong>Low Stock Threshold:</strong> ${Math.ceil((p.originalQuantity || p.quantity) * 0.2)} ${sym}</p>
        <p><strong>Barcode:</strong> ${p.barcode}</p>
        <p><strong>Expiry:</strong> ${p.expiry || 'N/A'}</p>
        <p><strong>Description:</strong> ${p.description || 'N/A'}</p>
        <p><strong>Added:</strong> ${new Date(p.created).toLocaleString()}</p>`;
    document.getElementById('reportModal').style.display = 'flex';
}

// ==================== SALES ====================

function showSales() { showSellProductModal(); }

function showSellProductModal() {
    const sel = document.getElementById('sellProductSelect');
    sel.innerHTML = '<option value="">Select Product</option>' +
        db.products.filter(p => p.quantity > 0).map(p => `<option value="${p.id}">${p.name} (${p.quantity} left @ ${p.price} RWF)</option>`).join('');
    document.getElementById('sellProductModal').style.display = 'flex';
}

function sellProductFromList(id) {
    const p = db.products.find(p => p.id === id); if (!p) return;
    document.getElementById('sellProductSelect').innerHTML = `<option value="${p.id}">${p.name} (${p.quantity} available)</option>`;
    document.getElementById('sellProductModal').style.display = 'flex';
}

function sellProduct() { recordSaleWithBatch(); }

// ==================== PURCHASES ====================

function showPurchases() {
    document.getElementById('purchaseProductSelect').innerHTML =
        '<option value="">Select Product</option>' + db.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseModal').style.display = 'flex';
}

function recordPurchase() {
    const pid = parseInt(document.getElementById('purchaseProductSelect').value);
    const qty = parseInt(document.getElementById('purchaseQuantity').value);
    const prc = parseFloat(document.getElementById('purchasePrice').value);
    const sup = document.getElementById('purchaseSupplier').value;
    const inv = document.getElementById('purchaseInvoice').value;
    const dt  = document.getElementById('purchaseDate').value;
    const nt  = document.getElementById('purchaseNotes').value;
    if (!pid || !qty || !prc) { showAlert('❌ Please fill required fields!', 'warning'); return; }
    const p = db.userData.products.find(p => p.id === pid);
    if (!p) return;
    p.quantity += qty; p.price = prc;
    db.userData.purchases.push({ id: Date.now(), productId: pid, productName: p.name, quantity: qty, price: prc, total: prc * qty, supplier: sup || 'Unknown', invoice: inv || 'N/A', date: dt || new Date().toISOString(), notes: nt || '', recordedAt: new Date().toISOString() });
    saveDB(); hideModal('purchaseModal');
    ['purchaseQuantity','purchasePrice','purchaseSupplier','purchaseInvoice','purchaseNotes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadProducts(); showAlert(`📥 Purchase recorded: ${qty} x ${p.name}`, 'success'); logAudit(`Purchase: ${qty} x ${p.name}`);
}

// ==================== TRANSFERS ====================

function showTransfers() {
    document.getElementById('transferProductSelect').innerHTML =
        '<option value="">Select Product</option>' + db.products.filter(p => p.quantity > 0).map(p => `<option value="${p.id}">${p.name} (${p.quantity} available)</option>`).join('');
    document.getElementById('transferModal').style.display = 'flex';
}

function transferStock() {
    const pid = parseInt(document.getElementById('transferProductSelect').value);
    const qty = parseInt(document.getElementById('transferQuantity').value);
    const frm = document.getElementById('transferFrom').value;
    const to  = document.getElementById('transferTo').value;
    const ref = document.getElementById('transferReference').value;
    const rsn = document.getElementById('transferReason').value;
    if (!pid || !qty || !frm || !to) { showAlert('❌ Please fill all fields!', 'warning'); return; }
    const p = db.userData.products.find(p => p.id === pid);
    if (qty > p.quantity) { showAlert(`❌ Only ${p.quantity} available!`, 'danger'); return; }
    p.quantity -= qty;
    db.userData.transfers.push({ id: Date.now(), productId: pid, productName: p.name, quantity: qty, from: frm, to, reference: ref || 'N/A', reason: rsn || 'Stock transfer', date: new Date().toISOString() });
    saveDB(); hideModal('transferModal');
    ['transferQuantity','transferFrom','transferTo','transferReference','transferReason'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadProducts(); showAlert(`🔄 Transferred: ${qty} x ${p.name}`, 'success'); logAudit(`Transfer: ${qty} x ${p.name}`);
}

// ==================== RETURNS ====================

function showReturns() {
    document.getElementById('returnProductSelect').innerHTML =
        '<option value="">Select Product</option>' + db.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    document.getElementById('returnModal').style.display = 'flex';
}

function returnStock() {
    const pid = parseInt(document.getElementById('returnProductSelect').value);
    const qty = parseInt(document.getElementById('returnQuantity').value);
    const typ = document.getElementById('returnType').value;
    const rsn = document.getElementById('returnReason').value;
    const ref = document.getElementById('returnReference').value;
    const nt  = document.getElementById('returnNotes').value;
    if (!pid || !qty) { showAlert('❌ Please fill all fields!', 'warning'); return; }
    const p = db.userData.products.find(p => p.id === pid);
    p.quantity += qty;
    db.userData.returns.push({ id: Date.now(), productId: pid, productName: p.name, quantity: qty, type: typ, reason: rsn || 'Return', reference: ref || 'N/A', notes: nt || '', date: new Date().toISOString() });
    saveDB(); hideModal('returnModal');
    ['returnQuantity','returnReason','returnReference','returnNotes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadProducts(); showAlert(`↩️ Return processed: ${qty} x ${p.name}`, 'success'); logAudit(`Return: ${qty} x ${p.name}`);
}

// ==================== ADJUSTMENTS ====================

function showAdjustments() {
    document.getElementById('adjustmentProductSelect').innerHTML =
        '<option value="">Select Product</option>' + db.products.map(p => `<option value="${p.id}">${p.name} (Current: ${p.quantity})</option>`).join('');
    document.getElementById('adjustmentModal').style.display = 'flex';
}

function updateAdjustmentCurrent() {
    const p = db.products.find(p => p.id === parseInt(document.getElementById('adjustmentProductSelect').value));
    if (p) document.getElementById('adjustmentCurrentQuantity').value = p.quantity;
}

function makeAdjustment() {
    const pid  = parseInt(document.getElementById('adjustmentProductSelect').value);
    const newQ = parseInt(document.getElementById('adjustmentNewQuantity').value);
    const typ  = document.getElementById('adjustmentType').value;
    const rsn  = document.getElementById('adjustmentReason').value;
    const nt   = document.getElementById('adjustmentNotes').value;
    if (!pid || !newQ) { showAlert('❌ Please fill all fields!', 'warning'); return; }
    const p = db.userData.products.find(p => p.id === pid);
    const old = p.quantity;
    if (typ === 'increase') p.quantity += newQ;
    else if (typ === 'decrease') {
        if (newQ > p.quantity) { showAlert('❌ Cannot decrease beyond current stock!', 'danger'); return; }
        p.quantity -= newQ;
    } else p.quantity = newQ;
    db.userData.adjustments.push({ id: Date.now(), productId: pid, productName: p.name, oldQuantity: old, newQuantity: p.quantity, type: typ, reason: rsn || 'Manual adjustment', notes: nt || '', date: new Date().toISOString() });
    saveDB(); hideModal('adjustmentModal');
    ['adjustmentNewQuantity','adjustmentReason','adjustmentNotes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadProducts(); showAlert(`⚖️ Adjusted: ${p.name} ${old} → ${p.quantity}`, 'success'); logAudit(`Adjustment: ${p.name}`);
}

// ==================== BARCODE ====================

function showBarcodeScanner() { document.getElementById('barcodeModal').style.display = 'flex'; }

function processBarcode() {
    const barcode = document.getElementById('barcodeInput').value;
    if (!barcode) { showAlert('❌ Please enter a barcode', 'warning'); return; }
    const p = db.products.find(p => p.barcode === barcode);
    if (p) {
        document.getElementById('reportTitle').textContent = '📦 Scan Result';
        document.getElementById('reportContent').innerHTML = `
            <h3>📦 ${p.name}</h3>
            <p><strong>Category:</strong> ${p.category}</p>
            <p><strong>Price:</strong> ${p.price.toLocaleString()} RWF</p>
            <p><strong>Quantity:</strong> ${p.quantity}</p>
            <button onclick="quickSell(${p.id})" style="margin-top:10px;padding:10px;background:#4caf50;color:white;border:none;border-radius:5px;cursor:pointer;">Quick Sell</button>`;
        document.getElementById('reportModal').style.display = 'flex';
    } else {
        showAlert('❌ Product not found', 'warning');
        if (confirm('Add this product now?')) { hideModal('barcodeModal'); showAddProductModal(); }
    }
    document.getElementById('barcodeInput').value = '';
    hideModal('barcodeModal');
}

function quickSell(productId) {
    hideModal('reportModal');
    const p = db.userData.products.find(p => p.id === productId); if (!p) return;
    const qty = parseInt(prompt(`How many ${p.name} to sell? (Max: ${p.quantity})`, '1'));
    if (qty > 0 && qty <= p.quantity) {
        p.quantity -= qty;
        db.userData.sales.push({ id: Date.now(), productId, productName: p.name, quantity: qty, price: p.price, total: p.price * qty, date: new Date().toISOString() });
        saveDB(); loadProducts(); showAlert(`💰 Sold ${qty} x ${p.name}`, 'success');
    } else showAlert('❌ Invalid quantity', 'danger');
}

// ==================== REPORTS ====================

function showStockLevels() {
    document.getElementById('reportTitle').textContent = '📊 Stock Levels Report';
    document.getElementById('reportContent').innerHTML = `<h3>📊 Current Stock Levels</h3>
        <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#1a237e;color:white;"><th>Product</th><th>Category</th><th>Quantity</th><th>Price</th><th>Value</th></tr>
        ${db.products.map(p => `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.name}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.category}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.quantity} ${getMeasurementSymbol(p.measurement)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.price.toLocaleString()} RWF</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${(p.price*p.quantity).toLocaleString()} RWF</td>
        </tr>`).join('')}</table>`;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed stock levels');
}

function showStockReports() {
    const tv = db.products.reduce((s, p) => s + p.price * p.quantity, 0);
    document.getElementById('reportTitle').textContent = '📋 Stock Report';
    document.getElementById('reportContent').innerHTML = `<h3>📋 Stock Report</h3>
        <p><strong>Total Products:</strong> ${db.products.length}</p>
        <p><strong>Total Categories:</strong> ${db.categories.length}</p>
        <p><strong>Total Value:</strong> ${tv.toLocaleString()} RWF</p>
        <p><strong>Low Stock Items:</strong> ${db.products.filter(p => isLowStock(p)).length}</p>
        <p><strong>Out of Stock:</strong> ${db.products.filter(p => p.quantity === 0).length}</p>`;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed stock report');
}

function showIssueReports() {
    document.getElementById('reportTitle').textContent = '👥 Issue Report';
    document.getElementById('reportContent').innerHTML = !db.sales.length ? '<p>No sales yet.</p>' :
        `<h3>👥 Sales Report</h3><table style="width:100%;border-collapse:collapse;">
        <tr style="background:#1a237e;color:white;"><th>Date</th><th>Product</th><th>Qty</th><th>Customer</th><th>Total</th></tr>
        ${db.sales.slice(-50).reverse().map(s => `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(s.date).toLocaleDateString()}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${s.productName}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${s.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${s.customer || 'N/A'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${s.total.toLocaleString()} RWF</td>
        </tr>`).join('')}</table>`;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed issue report');
}

function showExpiryReport() {
    const now = new Date(), soon = new Date(); soon.setDate(soon.getDate() + 30);
    const withExpiry = db.products.filter(p => p.expiry);
    document.getElementById('reportTitle').textContent = '📅 Expiry Report';
    document.getElementById('reportContent').innerHTML = !withExpiry.length ? '<p>No products with expiry dates.</p>' :
        `<h3>📅 Expiry Report</h3><table style="width:100%;border-collapse:collapse;">
        <tr style="background:#1a237e;color:white;"><th>Product</th><th>Expiry Date</th><th>Status</th></tr>
        ${withExpiry.map(p => {
            const exp = new Date(p.expiry);
            const [st, col] = exp < now ? ['❌ EXPIRED', '#f44336'] : exp < soon ? ['⚠️ Expiring soon', '#ff9800'] : ['✅ Good', '#4caf50'];
            return `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${p.name}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${p.expiry}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;color:${col};">${st}</td></tr>`;
        }).join('')}</table>`;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed expiry report');
}

function showProcurement() {
    document.getElementById('reportTitle').textContent = '📦 Procurement Report';
    document.getElementById('reportContent').innerHTML = !db.purchases.length ? '<p>No purchases yet.</p>' :
        `<h3>📦 Procurement History</h3><table style="width:100%;border-collapse:collapse;">
        <tr style="background:#1a237e;color:white;"><th>Date</th><th>Product</th><th>Qty</th><th>Supplier</th><th>Total</th></tr>
        ${db.purchases.slice(-50).reverse().map(p => `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(p.date).toLocaleDateString()}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.productName}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.supplier}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.total.toLocaleString()} RWF</td>
        </tr>`).join('')}</table>`;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed procurement');
}

function showPurchaseOrders() {
    document.getElementById('reportTitle').textContent = '📑 Purchase Orders';
    document.getElementById('reportContent').innerHTML = !db.purchases.length ? '<p>No orders yet.</p>' :
        `<h3>📑 Purchase Orders</h3><table style="width:100%;border-collapse:collapse;">
        <tr style="background:#1a237e;color:white;"><th>Order #</th><th>Date</th><th>Product</th><th>Supplier</th><th>Status</th></tr>
        ${db.purchases.slice(-20).reverse().map((p, i) => `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">PO-${String(i+1).padStart(4,'0')}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(p.date).toLocaleDateString()}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.productName} (${p.quantity})</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${p.supplier}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;color:#4caf50;">✓ Completed</td>
        </tr>`).join('')}</table>`;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed purchase orders');
}

function showUsageReports() {
    document.getElementById('reportTitle').textContent = '📈 Usage Report';
    document.getElementById('reportContent').innerHTML = `<h3>📈 Internal Usage Report</h3>
        <p><strong>Total Sales:</strong> ${db.sales.length}</p>
        <p><strong>Total Revenue:</strong> ${db.sales.reduce((s,t)=>s+t.total,0).toLocaleString()} RWF</p>
        <p><strong>Total Purchases:</strong> ${db.purchases.length}</p>
        <p><strong>Total Transfers:</strong> ${db.transfers.length}</p>
        <p><strong>Total Returns:</strong> ${db.returns.length}</p>
        <p><strong>Total Adjustments:</strong> ${db.adjustments.length}</p>`;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed usage report');
}

// ==================== ASSETS ====================

function showGoodsReceiving() { showPurchases(); }

function showAssetManagement() {
    const totalVal = db.products.reduce((s, p) => s + p.price * p.quantity, 0);
    document.getElementById('reportTitle').textContent = '🏢 Asset Management';
    document.getElementById('reportContent').innerHTML = `<h3>🏢 Asset Management</h3>
        <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#1a237e;color:white;"><th>Asset Type</th><th>Value</th><th>Status</th><th>Updated</th></tr>
        ${db.categories.slice(0,5).map(cat => {
            const cv = db.products.filter(p => p.category === cat.name).reduce((s,p) => s+p.price*p.quantity, 0);
            return `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${cat.icon} ${cat.name}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${cv.toLocaleString()} RWF</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;color:#4caf50;">✅ Active</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date().toLocaleDateString()}</td></tr>`;
        }).join('')}
        <tr style="background:#f0f2f5;font-weight:bold;">
            <td style="padding:8px;">TOTAL</td><td style="padding:8px;">${totalVal.toLocaleString()} RWF</td>
            <td colspan="2"></td></tr></table>`;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed assets');
}

function showStockTransfers() { showTransfers(); }

function showUserRoles() { document.getElementById('userRoleModal').style.display = 'flex'; }

function addUser() {
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const role  = document.getElementById('userRole').value;
    const dept  = document.getElementById('userDepartment').value;
    const pass  = document.getElementById('userPassword').value;
    if (!name || !email || !pass) { showAlert('❌ Please fill all fields!', 'warning'); return; }
    db.userData.users.push({ id: Date.now(), name, email, role, department: dept || 'General', password: secureHash(pass), created: new Date().toISOString(), lastLogin: null });
    saveDB(); hideModal('userRoleModal');
    ['userName','userEmail','userDepartment','userPassword'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    showAlert('✅ User added!', 'success'); logAudit(`Added user: ${name} (${role})`);
}

function showRolePermissions() {
    document.getElementById('reportTitle').textContent = '🔑 Role Permissions';
    document.getElementById('reportContent').innerHTML = `<h3>🔑 Role Permissions</h3>
        <table style="width:100%"><tr><th>Role</th><th>Permissions</th></tr>
        <tr><td><strong>Admin</strong></td><td>Full access</td></tr>
        <tr><td><strong>Manager</strong></td><td>Add/edit products, view reports</td></tr>
        <tr><td><strong>Staff</strong></td><td>Can sell, view products</td></tr>
        <tr><td><strong>Viewer</strong></td><td>View only</td></tr></table>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function showAuditLog() {
    document.getElementById('reportTitle').textContent = '📋 Audit Log';
    document.getElementById('reportContent').innerHTML = !db.auditLog.length ? '<p>No audit records yet.</p>' :
        `<h3>📋 Audit Log</h3><table style="width:100%;border-collapse:collapse;">
        <tr style="background:#1a237e;color:white;"><th>Time</th><th>User</th><th>Action</th></tr>
        ${db.auditLog.slice(-100).reverse().map(l => `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(l.timestamp).toLocaleString()}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${l.user}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${l.action}</td>
        </tr>`).join('')}</table>`;
    document.getElementById('reportModal').style.display = 'flex';
}

// ==================== SETTINGS ====================

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
        document.getElementById('settingsOrgName').textContent = db.currentOrg?.name || 'N/A';
        document.getElementById('settingsOrgCode').textContent = db.currentOrg?.code || 'N/A';
        document.getElementById('settingsUDC').textContent     = '••••••';
        document.getElementById('twoFAStatus').textContent     = db.settings.twoFA ? 'Enabled' : 'Disabled';
        document.getElementById('notifStatus').textContent     = db.settings.notifications ? 'Enabled' : 'Disabled';
        document.getElementById('lastBackup').textContent      = localStorage.getItem('bsms_last_backup') || 'Never';
    }
}

function showGeneralSettings() { toggleSettings(); }

// ==================== APPEARANCE ====================

function isLightColor(color) {
    let r, g, b;
    if (color.startsWith('#')) {
        const hex = color.substring(1);
        if (hex.length === 3) { r = parseInt(hex[0]+hex[0],16); g = parseInt(hex[1]+hex[1],16); b = parseInt(hex[2]+hex[2],16); }
        else { r = parseInt(hex.substring(0,2),16); g = parseInt(hex.substring(2,4),16); b = parseInt(hex.substring(4,6),16); }
    } else return false;
    return ((r*299+g*587+b*114)/1000) > 128;
}

function showAppearance() {
    const colors = [
        {name:'Professional Blue',value:'#1a237e'},{name:'Ocean Blue',value:'#1976d2'},{name:'Sky Blue',value:'#42a5f5'},
        {name:'Dark Blue',value:'#0d47a1'},{name:'Navy Blue',value:'#001f3f'},{name:'Turquoise',value:'#00bcd4'},
        {name:'Teal',value:'#00796b'},{name:'Forest Green',value:'#2e7d32'},{name:'Royal Purple',value:'#4a148c'},
        {name:'Hot Pink',value:'#e91e63'},{name:'Red',value:'#8c1414'},{name:'Orange',value:'#ff9800'},
        {name:'Dark Mode',value:'#263238'},{name:'Charcoal',value:'#424242'},{name:'Gold',value:'#ffd700'}
    ];
    document.getElementById('reportTitle').textContent = '🎨 Appearance';
    document.getElementById('reportContent').innerHTML = `<h3>🎨 Theme Customization</h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin:20px 0;">
        ${colors.map(c => `<button onclick="setThemeColor('${c.value}')" style="padding:12px 20px;background:${c.value};
            color:${isLightColor(c.value)?'#000':'#fff'};border:none;border-radius:20px;cursor:pointer;font-weight:bold;
            flex:1 0 auto;min-width:130px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${c.name}</button>`).join('')}
        </div><p><strong>Current:</strong> <span style="color:${db.settings.themeColor};">●</span> ${db.settings.themeColor}</p>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function setThemeColor(color) {
    db.userData.settings.themeColor = color;
    saveDB();
    document.documentElement.style.setProperty('--primary', color);
    showAlert(`🎨 Theme changed!`, 'success'); hideModal('reportModal'); logAudit(`Theme: ${color}`);
}

function showBackground() {
    const bgs = [
        {name:'Professional Purple',value:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)'},
        {name:'Deep Ocean',value:'linear-gradient(135deg,#2193b0 0%,#6dd5ed 100%)'},
        {name:'Forest Mist',value:'linear-gradient(135deg,#134e5e 0%,#71b280 100%)'},
        {name:'Sunset',value:'linear-gradient(135deg,#ff6b6b 0%,#feca57 100%)'},
        {name:'Night Sky',value:'linear-gradient(135deg,#232526 0%,#414345 100%)'},
        {name:'Lavender',value:'linear-gradient(135deg,#8e2de2 0%,#4a00e0 100%)'},
        {name:'Mint Fresh',value:'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)'},
        {name:'Bloody Mary',value:'linear-gradient(135deg,#ff512f 0%,#dd2476 100%)'},
        {name:'Sunny Morning',value:'linear-gradient(135deg,#f6d365 0%,#fda085 100%)'},
        {name:'Purple Love',value:'linear-gradient(135deg,#cc2b5e 0%,#753a88 100%)'}
    ];
    document.getElementById('reportTitle').textContent = '🖼️ Background';
    document.getElementById('reportContent').innerHTML = `<h3>🖼️ Background Settings</h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin:20px 0;">
        ${bgs.map(b => `<button onclick="setBackground('${b.value}')" style="padding:20px 25px;background:${b.value};
            color:white;border:none;border-radius:12px;cursor:pointer;font-weight:bold;flex:1 0 auto;min-width:180px;
            text-shadow:1px 1px 3px rgba(0,0,0,0.5);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${b.name}</button>`).join('')}
        </div>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function setBackground(gradient) {
    document.body.style.background = gradient;
    // Save per-user background preference
    if (db.currentOrg?.udc) localStorage.setItem(`bsms_bg_${secureHash(db.currentOrg.udc)}`, gradient);
    showAlert('✅ Background updated!', 'success'); hideModal('reportModal'); logAudit('Background changed');
}

function showModules() {
    const modules = ['Inventory Management','Sales Processing','Purchase Management','Reports & Analytics','User Management','Asset Tracking','Batch Tracking','POS System'];
    document.getElementById('reportTitle').textContent = '🧩 Modules';
    document.getElementById('reportContent').innerHTML = `<h3>🧩 System Modules</h3>
        <table style="width:100%;border-collapse:collapse;"><tr style="background:#1a237e;color:white;"><th>Module</th><th>Status</th></tr>
        ${modules.map(m => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${m}</td><td style="padding:8px;border-bottom:1px solid #ddd;color:#4caf50;">✅ Active</td></tr>`).join('')}</table>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function showSecurity()      { db.userData.settings.twoFA = !db.userData.settings.twoFA; saveDB(); showAlert(`🔒 2FA ${db.userData.settings.twoFA?'enabled':'disabled'}`, 'success'); }
function showNotifications() { db.userData.settings.notifications = !db.userData.settings.notifications; saveDB(); showAlert(`🔔 Notifications ${db.userData.settings.notifications?'enabled':'disabled'}`, 'success'); }
function showAutoBackup()    { db.userData.settings.autoBackup = !db.userData.settings.autoBackup; saveDB(); showAlert(`💾 Auto backup ${db.userData.settings.autoBackup?'enabled':'disabled'}`, 'success'); }
function showThemeColors()   { showAppearance(); }
function showTwoFA()         { showSecurity(); }
function showUserRoleSettings() { showUserRoles(); }

function showOrgInfo() {
    const o = db.currentOrg; if (!o) return;
    document.getElementById('reportTitle').textContent = '🏢 Organization Info';
    document.getElementById('reportContent').innerHTML = `<h3>🏢 ${o.name}</h3>
        <p><strong>Code:</strong> ${o.code}</p>
        <p><strong>Owner:</strong> ${o.owner}</p>
        <p><strong>Type:</strong> ${o.type}</p>
        <p><strong>Phone:</strong> ${o.phone}</p>
        <p><strong>Email:</strong> ${o.email}</p>
        <p><strong>Location:</strong> ${o.location}</p>
        <p><strong>Registered:</strong> ${new Date(o.registeredDate).toLocaleString()}</p>
        <p><strong>Subscription:</strong> ${o.subscription.active ? '✅ Active' : '❌ Inactive'}</p>
        <p><strong>Private Storage Key:</strong> <code style="font-size:12px;">bsms_user_${secureHash(o.udc)}</code></p>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function showAlertsReminders() {
    document.getElementById('reportTitle').textContent = '⏰ Alerts & Reminders';
    document.getElementById('reportContent').innerHTML = `<h3>⏰ Alerts</h3>
        <p><strong>Low Stock:</strong> When quantity reaches 20% of original</p>
        <p><strong>Expiry:</strong> 30 days before expiry date</p>
        <p><strong>Subscription:</strong> 7 days before expiry (once per day, per user)</p>
        <button onclick="resetDailyReminder()" style="margin-top:10px;padding:10px;background:#4caf50;color:white;border:none;border-radius:5px;cursor:pointer;">🔄 Reset Today's Reminder</button>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function showCurrencyTaxes() {
    document.getElementById('reportTitle').textContent = '💰 Currency & Taxes';
    document.getElementById('reportContent').innerHTML = `<h3>💰 Currency & Taxes</h3>
        <p><strong>Currency:</strong> ${db.settings.currency}</p>
        <p><strong>Tax Rate:</strong> ${db.settings.taxRate}%</p>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function enableFeatures() {
    const features = ['Inventory Management','Sales Processing','Purchase Management','Reports','User Management','Batch Tracking','POS System'];
    document.getElementById('reportTitle').textContent = '✨ Features';
    document.getElementById('reportContent').innerHTML = `<h3>✨ Feature Management</h3>
        <table style="width:100%"><tr><th>Feature</th><th>Status</th></tr>
        ${features.map(f => `<tr><td>${f}</td><td>✅ Enabled</td></tr>`).join('')}</table>`;
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
    document.getElementById('reportTitle').textContent = '📁 Categories';
    document.getElementById('reportContent').innerHTML = `<h3>📁 Categories & Items</h3>
        <table style="width:100%"><tr><th>Category</th><th>Items</th><th>Description</th></tr>
        ${db.categories.map(c => `<tr><td>${c.icon||'📁'} ${c.name}</td>
            <td>${db.products.filter(p => p.category === c.name).length}</td>
            <td>${c.description||''}</td></tr>`).join('')}</table>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function showAlerts() {
    const lowStock = db.products.filter(p => isLowStock(p));
    const now      = new Date(), soon = new Date(); soon.setDate(soon.getDate() + 30);
    const expired  = db.products.filter(p => p.expiry && new Date(p.expiry) < now);
    const expiring = db.products.filter(p => p.expiry && new Date(p.expiry) > now && new Date(p.expiry) < soon);
    let html = '<h3>🔔 System Alerts</h3>';
    if (lowStock.length) html += '<h4>⚠️ Low Stock</h4><ul>' + lowStock.map(p => `<li>${p.name} — ${p.quantity} left</li>`).join('') + '</ul>';
    if (expired.length)  html += '<h4>❌ Expired</h4><ul>' + expired.map(p => `<li>${p.name} — ${p.expiry}</li>`).join('') + '</ul>';
    if (expiring.length) html += '<h4>⚠️ Expiring Soon</h4><ul>' + expiring.map(p => `<li>${p.name} — ${p.expiry}</li>`).join('') + '</ul>';
    if (!lowStock.length && !expired.length && !expiring.length) html += '<p>✅ No alerts at this time</p>';
    document.getElementById('reportTitle').textContent = '🔔 Alerts';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
}

function showApprovals() { showAlert('✓ No pending approvals', 'info'); }

function showBatchTracking() {
    const batches = {};
    db.products.forEach(p => { if (!batches[p.category]) batches[p.category] = []; batches[p.category].push(p); });
    let html = '<h3>🔢 Batch & Serial Tracking</h3>';
    for (const [cat, prods] of Object.entries(batches)) {
        html += `<h4>📦 ${cat} (${prods.length} items)</h4><ul>`;
        prods.forEach(p => { html += `<li>BATCH-${String(p.id).slice(-6)}: ${p.name} — ${p.quantity} ${getMeasurementSymbol(p.measurement)} (${new Date(p.created).toLocaleDateString()})</li>`; });
        html += '</ul>';
    }
    if (!Object.keys(batches).length) html += '<p>No batches available.</p>';
    document.getElementById('reportTitle').textContent = '🔢 Batch Tracking';
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';
    logAudit('Viewed batch tracking');
}

// ==================== POS SYSTEM ====================

let posCart = [], posDiscount = 0, posTax = 0;

function initializePOS() { posCart = []; posDiscount = 0; posTax = db.settings?.taxRate || 18; updatePOSDisplay(); }

function showPOS() {
    initializePOS();
    const avail = db.products.filter(p => p.quantity > 0);
    document.getElementById('reportTitle').textContent = '🛒 Point of Sale';
    document.getElementById('reportContent').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div style="background:#f5f5f5;padding:20px;border-radius:10px;">
                <h3>📦 Products</h3>
                <input type="text" id="posSearch" placeholder="🔍 Search products..."
                    style="width:100%;padding:10px;margin-bottom:15px;border:2px solid #ddd;border-radius:5px;box-sizing:border-box;"
                    onkeyup="searchPOSProducts(this.value)">
                <div id="posProductGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;max-height:400px;overflow-y:auto;">
                    ${avail.slice(0,20).map(p => `<div onclick="addToPOSCart(${p.id})" style="background:white;padding:15px;border-radius:8px;cursor:pointer;
                        border:2px solid transparent;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.1);"
                        onmouseover="this.style.borderColor='#1a237e'" onmouseout="this.style.borderColor='transparent'">
                        <strong>${p.name}</strong><br>
                        <span style="color:#1a237e;font-size:18px;">${p.price.toLocaleString()} RWF</span><br>
                        <small>Stock: ${p.quantity} ${getMeasurementSymbol(p.measurement)}</small>
                    </div>`).join('') || '<p>❌ No products available.</p>'}
                </div>
            </div>
            <div style="background:white;padding:20px;border-radius:10px;border:2px solid #1a237e;">
                <h3>🛒 Current Sale</h3>
                <div id="posCartItems" style="max-height:250px;overflow-y:auto;margin-bottom:15px;"></div>
                <div id="posSummary" style="background:#f5f5f5;padding:15px;border-radius:8px;margin-bottom:15px;"></div>
                <input type="text" id="posCustomer" placeholder="Customer Name"
                    style="width:100%;padding:10px;margin-bottom:10px;border:2px solid #ddd;border-radius:5px;box-sizing:border-box;">
                <select id="posPaymentMethod" style="width:100%;padding:10px;margin-bottom:10px;border:2px solid #ddd;border-radius:5px;">
                    <option value="cash">💰 Cash</option><option value="mobile">📱 Mobile Money</option>
                    <option value="card">💳 Card</option><option value="credit">📝 Credit</option>
                </select>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <button onclick="processPOSPayment()" style="padding:15px;background:#4caf50;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">✅ Complete Sale</button>
                    <button onclick="clearPOSCart()"       style="padding:15px;background:#f44336;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🗑️ Clear</button>
                </div>
                <div style="margin-top:10px;display:flex;gap:10px;">
                    <button onclick="applyDiscount()" style="padding:10px;background:#ff9800;color:white;border:none;border-radius:5px;cursor:pointer;flex:1;">🔖 Discount</button>
                    <button onclick="printReceipt()"  style="padding:10px;background:#2196f3;color:white;border:none;border-radius:5px;cursor:pointer;flex:1;">🖨️ Receipt</button>
                </div>
            </div>
        </div>`;
    document.getElementById('reportModal').style.display = 'flex';
    updatePOSDisplay(); logAudit('Opened POS');
}

function searchPOSProducts(query) {
    const grid = document.getElementById('posProductGrid'); if (!grid) return;
    const products = db.products.filter(p => p.quantity > 0 && (p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase())));
    grid.innerHTML = products.slice(0,20).map(p => `<div onclick="addToPOSCart(${p.id})" style="background:white;padding:15px;border-radius:8px;cursor:pointer;
        border:2px solid transparent;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.1);"
        onmouseover="this.style.borderColor='#1a237e'" onmouseout="this.style.borderColor='transparent'">
        <strong>${p.name}</strong><br><span style="color:#1a237e;">${p.price.toLocaleString()} RWF</span><br><small>Stock: ${p.quantity}</small>
    </div>`).join('') || '<p>No products found</p>';
}

function addToPOSCart(productId) {
    const p = db.products.find(p => p.id === productId);
    if (!p || p.quantity <= 0) { showAlert('❌ Out of stock!', 'warning'); return; }
    const existing = posCart.find(i => i.productId === productId);
    if (existing) {
        if (existing.quantity < p.quantity) existing.quantity++;
        else { showAlert(`❌ Only ${p.quantity} available!`, 'warning'); return; }
    } else posCart.push({ productId: p.id, name: p.name, price: p.price, quantity: 1, maxQuantity: p.quantity, measurement: p.measurement || 'pieces' });
    updatePOSDisplay(); showAlert(`➕ ${p.name} added`, 'success');
}

function removeFromPOSCart(index) { posCart.splice(index, 1); updatePOSDisplay(); }

function updateCartQuantity(index, qty) {
    const item = posCart[index]; if (!item) return;
    if (qty <= 0) { removeFromPOSCart(index); return; }
    if (qty > item.maxQuantity) { showAlert(`❌ Only ${item.maxQuantity} available!`, 'warning'); return; }
    item.quantity = qty; updatePOSDisplay();
}

function updatePOSDisplay() {
    const cartDiv = document.getElementById('posCartItems');
    const sumDiv  = document.getElementById('posSummary');
    if (!cartDiv || !sumDiv) return;
    cartDiv.innerHTML = !posCart.length ? '<p style="text-align:center;color:#999;">Cart is empty</p>' :
        posCart.map((item, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #eee;">
            <div style="flex:2;"><strong>${item.name}</strong><br><small>${item.price.toLocaleString()} RWF</small></div>
            <div style="flex:1;display:flex;align-items:center;gap:5px;">
                <button onclick="updateCartQuantity(${i},${item.quantity-1})" style="width:25px;height:25px;background:#f0f2f5;border:none;border-radius:3px;cursor:pointer;">−</button>
                <span style="width:30px;text-align:center;">${item.quantity}</span>
                <button onclick="updateCartQuantity(${i},${item.quantity+1})" style="width:25px;height:25px;background:#f0f2f5;border:none;border-radius:3px;cursor:pointer;">+</button>
            </div>
            <div style="flex:1;text-align:right;">${(item.price*item.quantity).toLocaleString()} RWF</div>
            <button onclick="removeFromPOSCart(${i})" style="background:none;border:none;color:#f44336;cursor:pointer;">🗑️</button>
        </div>`).join('');
    const sub  = posCart.reduce((s, i) => s + i.price * i.quantity, 0);
    const disc = (sub * posDiscount) / 100;
    const tax  = ((sub - disc) * posTax) / 100;
    const tot  = sub - disc + tax;
    sumDiv.innerHTML = `
        <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>${sub.toLocaleString()} RWF</span></div>
        ${posDiscount>0?`<div style="display:flex;justify-content:space-between;color:#f44336;"><span>Discount (${posDiscount}%):</span><span>-${disc.toLocaleString()} RWF</span></div>`:''}
        <div style="display:flex;justify-content:space-between;"><span>Tax (${posTax}%):</span><span>${tax.toLocaleString()} RWF</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px;margin-top:5px;padding-top:5px;border-top:2px solid #1a237e;">
            <span>TOTAL:</span><span style="color:#1a237e;">${tot.toLocaleString()} RWF</span></div>`;
}

function applyDiscount() {
    const d = prompt('Enter discount %:', '0');
    if (d !== null) { posDiscount = Math.max(0, Math.min(100, parseFloat(d) || 0)); updatePOSDisplay(); showAlert(`🔖 Discount: ${posDiscount}%`, 'success'); }
}

function clearPOSCart() {
    if (posCart.length && confirm('Clear all items?')) { posCart = []; posDiscount = 0; updatePOSDisplay(); showAlert('🗑️ Cart cleared', 'info'); }
}

function processPOSPayment() {
    if (!posCart.length) { showAlert('❌ Cart is empty!', 'warning'); return; }
    const customer = document.getElementById('posCustomer')?.value || 'Walk-in';
    const method   = document.getElementById('posPaymentMethod')?.value || 'cash';
    const sub      = posCart.reduce((s, i) => s + i.price * i.quantity, 0);
    const disc     = (sub * posDiscount) / 100;
    const tax      = ((sub - disc) * posTax) / 100;
    const tot      = sub - disc + tax;
    posCart.forEach(item => {
        const p = db.userData.products.find(p => p.id === item.productId);
        if (p) p.quantity -= item.quantity;
    });
    const sale = { id: Date.now(), items: posCart, subtotal: sub, discount: posDiscount, discountAmount: disc, tax: posTax, taxAmount: tax, total: tot, customer, paymentMethod: method, date: new Date().toISOString() };
    db.userData.sales.push(sale);
    saveDB();
    showReceipt(sale);
    posCart = []; posDiscount = 0; updatePOSDisplay();
    showAlert(`✅ Sale complete! Total: ${tot.toLocaleString()} RWF`, 'success');
    logAudit(`POS sale: ${tot} RWF — ${customer}`);
    loadProducts();
}

function showReceipt(sale) {
    document.getElementById('reportTitle').textContent = '🧾 Receipt';
    document.getElementById('reportContent').innerHTML = `
        <div style="text-align:center;margin-bottom:20px;">
            <h2>${db.currentOrg?.name || 'BILLAN STOCK SYSTEM'}</h2>
            <p>Tel: ${db.currentOrg?.phone || '+250 784 680 801'}</p>
            <p>${new Date().toLocaleString()} &nbsp;|&nbsp; Receipt #${sale.id}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:2px solid #000;"><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            ${sale.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.price.toLocaleString()}</td><td>${(i.price*i.quantity).toLocaleString()}</td></tr>`).join('')}
            <tr style="border-top:2px solid #000;"><td colspan="3" style="text-align:right;">Subtotal:</td><td>${sale.subtotal.toLocaleString()} RWF</td></tr>
            ${sale.discount>0?`<tr><td colspan="3" style="text-align:right;">Discount (${sale.discount}%):</td><td>-${sale.discountAmount.toLocaleString()} RWF</td></tr>`:''}
            <tr><td colspan="3" style="text-align:right;">Tax (${sale.tax}%):</td><td>${sale.taxAmount.toLocaleString()} RWF</td></tr>
            <tr style="font-weight:bold;"><td colspan="3" style="text-align:right;">TOTAL:</td><td>${sale.total.toLocaleString()} RWF</td></tr>
            <tr><td colspan="4" style="text-align:center;padding-top:20px;">Payment: ${sale.paymentMethod} &nbsp;|&nbsp; Customer: ${sale.customer}<br>Thank you!</td></tr>
        </table>`;
    document.getElementById('reportModal').style.display = 'flex';
}

function printReceipt() {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Receipt</title><style>body{font-family:'Courier New',monospace;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{padding:5px;}</style></head><body>${document.getElementById('reportContent').innerHTML}<p style="text-align:center;margin-top:30px;">Powered by BSMS TITAN</p></body></html>`);
    w.document.close(); w.print();
}

function printReport() {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Report</title><style>body{font-family:Arial;padding:20px;}table{border-collapse:collapse;width:100%;}th{background:#1a237e;color:white;padding:10px;}td{padding:8px;border-bottom:1px solid #ddd;}</style></head><body><h2>${document.getElementById('reportTitle').textContent}</h2>${document.getElementById('reportContent').innerHTML}<p><em>Generated on ${new Date().toLocaleString()}</em></p></body></html>`);
    w.document.close(); w.print();
}

function exportReport() { performBackup(); }

// ==================== BACKUP & DATA MANAGEMENT ====================

function exportData() { performBackup(); }

function performBackup() {
    // Export only THIS user's private data
    const backupData = {
        organization: {
            name:  db.currentOrg.name,
            code:  db.currentOrg.code,
            owner: db.currentOrg.owner
            // UDC intentionally excluded from backup for security
        },
        data:      db.userData,
        exportedAt: new Date().toISOString(),
        version:   'BSMS_TITAN_v9'
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `bsms_${db.currentOrg.code}_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    localStorage.setItem('bsms_last_backup', new Date().toLocaleString());
    const lb = document.getElementById('lastBackup'); if (lb) lb.textContent = new Date().toLocaleString();
    showAlert('💾 Backup created!', 'success'); logAudit('Manual backup');
}

function restoreBackup() {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const restored = JSON.parse(ev.target.result);
                // Support both old format (direct db) and new format (with wrapper)
                const data = restored.data || restored;
                if (!data.products) { showAlert('❌ Invalid backup file', 'danger'); return; }
                db.userData = data;
                saveDB();
                showAlert('✅ Backup restored! Reloading...', 'success');
                logAudit('Backup restored');
                setTimeout(() => location.reload(), 2000);
            } catch (e) { showAlert('❌ Invalid backup file', 'danger'); }
        };
        reader.readAsText(e.target.files[0]);
    };
    input.click();
}

function resetSystem() {
    if (!confirm('⚠️ This will DELETE ALL your data. Are you sure?')) return;
    if (!confirm('⚠️ FINAL WARNING — this cannot be undone. Continue?')) return;
    // Only clear THIS user's private data, not other users
    if (db.currentOrg?.udc) {
        localStorage.removeItem(getUDCStorageKey(db.currentOrg.udc));
        localStorage.removeItem(getReminderKey(db.currentOrg.udc));
        localStorage.removeItem(`bsms_bg_${secureHash(db.currentOrg.udc)}`);
    }
    clearSession();
    showAlert('System reset. Redirecting to login...', 'warning');
    setTimeout(() => location.reload(), 2000);
}

// ==================== LOGOUT ====================

function logout() {
    if (timerInterval) clearInterval(timerInterval);
    logAudit(`Logout: ${db.currentOrg?.name}`);
    // Save data before clearing session
    if (db.userData && db.currentOrg) saveDB();
    db.currentOrg  = null;
    db.currentUser = null;
    db.userData    = null;
    clearSession();
    showLogin();
    showAlert('👋 Logged out successfully', 'info');
}

// ==================== UTILITIES ====================

function logAudit(action) {
    if (!db.userData) return;
    if (!db.userData.auditLog) db.userData.auditLog = [];
    db.userData.auditLog.push({ id: Date.now(), action, user: db.currentUser?.name || 'system', timestamp: new Date().toISOString() });
    if (db.userData.auditLog.length > 1000) db.userData.auditLog.shift();
    saveDB();
}

function hideModal(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function showAlert(message, type = 'info') {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:20px;right:20px;padding:15px 25px;border-radius:10px;color:white;font-weight:bold;z-index:20000;
        background:${type==='success'?'#4caf50':type==='warning'?'#ff9800':type==='danger'?'#f44336':'#2196f3'};box-shadow:0 5px 15px rgba(0,0,0,0.3);`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function updateUI() {
    if (db.currentOrg && db.userData) {
        loadCategories(); loadProducts(); updateStats();
        // Restore per-user background
        const bg = localStorage.getItem(`bsms_bg_${secureHash(db.currentOrg.udc)}`);
        if (bg) document.body.style.background = bg;
        // Restore per-user theme color
        if (db.userData.settings?.themeColor) document.documentElement.style.setProperty('--primary', db.userData.settings.themeColor);
        document.getElementById('dashboard').style.display = 'block';
        loadDashboardData();
    }
}

function updateActiveMenu(activeId) {
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    document.getElementById(activeId)?.classList.add('active');
}

function updateActiveTab(activeId) {
    ['tabAll','tabLow','tabOut'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    document.getElementById(activeId)?.classList.add('active');
}

function searchProducts(query) {
    if (!query.trim()) { loadProducts(); return; }
    const filtered = db.products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.category    && p.category.toLowerCase().includes(query.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(query.toLowerCase())) ||
        (p.barcode     && p.barcode.toLowerCase().includes(query.toLowerCase()))
    );
    filtered.length
        ? displayProducts(filtered)
        : (document.getElementById('productsBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:50px;"><p style="font-size:18px;color:#666;">🔍 No results for "${query}"</p></td></tr>`);
}

// ==================== BATCH TRACKING ====================

let batches = [];

function loadBatches() {
    if (!db.currentOrg) return [];
    try { batches = JSON.parse(localStorage.getItem(`bsms_batches_${secureHash(db.currentOrg.udc)}`) || '[]'); }
    catch (e) { batches = []; }
    return batches;
}

function saveBatches() {
    if (!db.currentOrg) return;
    try { localStorage.setItem(`bsms_batches_${secureHash(db.currentOrg.udc)}`, JSON.stringify(batches)); }
    catch (e) { console.log('Batch save error:', e); }
}

function sellFromBatch(productId, quantity) {
    loadBatches();
    const productBatches = batches
        .filter(b => b.productId === productId && b.remainingQuantity > 0 && b.status === 'active')
        .sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
    let remaining = quantity;
    const soldFrom = [];
    for (const batch of productBatches) {
        if (remaining <= 0) break;
        const qty = Math.min(batch.remainingQuantity, remaining);
        batch.remainingQuantity -= qty; remaining -= qty;
        soldFrom.push({ batchNumber: batch.batchNumber, quantity: qty, expiryDate: batch.expiryDate });
        if (batch.remainingQuantity === 0) { batch.status = 'depleted'; batch.depletedDate = new Date().toISOString(); }
    }
    saveBatches();
    return soldFrom;
}

function recordSaleWithBatch() {
    const productId = parseInt(document.getElementById('sellProductSelect')?.value);
    const quantity  = parseInt(document.getElementById('sellQuantity')?.value);
    const customer  = document.getElementById('sellCustomer')?.value;
    const method    = document.getElementById('sellPaymentMethod')?.value;
    const reference = document.getElementById('sellReference')?.value;
    const notes     = document.getElementById('sellNotes')?.value;
    if (!productId)          { showAlert('❌ Please select a product!', 'warning'); return; }
    if (!quantity || quantity <= 0) { showAlert('❌ Enter a valid quantity!', 'warning'); return; }
    const p = db.userData.products.find(p => p.id === productId);
    if (!p)                  { showAlert('❌ Product not found!', 'danger'); return; }
    if (quantity > p.quantity) { showAlert(`❌ Only ${p.quantity} available!`, 'danger'); return; }
    let soldBatches = [];
    try { soldBatches = sellFromBatch(productId, quantity); } catch (e) {}
    p.quantity -= quantity;
    const sale = { id: Date.now(), productId, productName: p.name, quantity, price: p.price, total: p.price * quantity,
        customer: customer || 'Walk-in', paymentMethod: method || 'cash', reference: reference || 'N/A',
        notes: notes || '', batches: soldBatches, date: new Date().toISOString() };
    db.userData.sales.push(sale);
    saveDB();
    ['sellQuantity','sellCustomer','sellReference','sellNotes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    hideModal('sellProductModal'); loadProducts();
    showAlert(`💰 Sold: ${quantity} x ${p.name}`, 'success'); logAudit(`Sale: ${quantity} x ${p.name}`);
}

// ==================== AUTO BACKUP ====================

setInterval(() => {
    if (db.userData && db.currentOrg && db.userData.settings?.autoBackup) saveDB();
}, 300000); // every 5 minutes

// ==================== INIT ====================

loadDB();

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'h') { e.preventDefault(); showAdminPanel(); }
});

console.log('✅ BSMS TITAN v9.0 — Per-User Isolated Storage');
console.log('🔑 Each user\'s data stored under: bsms_user_{hash(UDC)}');
console.log('🔒 UDC never stored in session or as plain localStorage key');
