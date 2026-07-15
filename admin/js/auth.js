// ===========================================
// Munambam Seafoods Admin Authentication
// ===========================================

const SESSION_NAME = CONFIG.SESSION_KEY || "munambam_admin";

// ===========================================
// Save Session
// ===========================================
function saveSession(username) {
    const session = {
        loggedIn: true,
        username: username,
        loginTime: Date.now()
    };
    localStorage.setItem(SESSION_NAME, JSON.stringify(session));
}

// ===========================================
// Get Session
// ===========================================
function getSession() {
    const session = localStorage.getItem(SESSION_NAME);
    if (!session) return null;
    try { return JSON.parse(session); } catch { return null; }
}

// ===========================================
// Check Login
// ===========================================
function isLoggedIn() {
    const session = getSession();
    return session && session.loggedIn === true;
}

// ===========================================
// Logout (Updated with Custom Modal)
// ===========================================
function logout() {
    // ബ്രൗസർ കൺഫർമേഷൻ ഒഴിവാക്കി കസ്റ്റം മോഡലിലേക്ക് മാറ്റി[cite: 2, 10]
    if (typeof showConfirm === "function") {
        showConfirm("Are you sure you want to logout?", () => {
            performLogout();
        });
    } else {
        if (confirm("Are you sure you want to logout?")) {
            performLogout();
        }
    }
}

function performLogout() {
    if (typeof auditLogout === "function") {
        auditLogout();
    }
    localStorage.removeItem(SESSION_NAME);
    window.location.href = "login.html";
}

// ===========================================
// Redirect/Protect
// ===========================================
function redirectIfLoggedIn() {
    if (isLoggedIn()) { window.location.href = "dashboard.html"; }
}

function protectPage() {
    if (!isLoggedIn()) { window.location.href = "login.html"; }
}

// ===========================================
// Login
// ===========================================
async function login(password) {
    showLoading(true);
    try {
        const response = await fetch(CONFIG.SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ action: "login", password: password })
        });
        const result = await response.json();
        showLoading(false);
        if (result.success) {
            saveSession(result.username);
            if (typeof auditLogin === "function") { auditLogin(); }
            window.location.href = "dashboard.html";
        } else {
            showMessage(result.message || "Invalid Password", false);
        }
    } catch (err) {
        console.error(err);
        showLoading(false);
        showMessage("Unable to connect to server.", false);
    }
}

// ===========================================
// Login Form Initialization
// ===========================================
document.addEventListener("DOMContentLoaded", () => {
    checkSessionTimeout();
    const form = document.getElementById("loginForm");
    if (form) {
        redirectIfLoggedIn();
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            const password = document.getElementById("password").value.trim();
            if (password === "") { showMessage("Enter Password", false); return; }
            login(password);
        });
    }
});

// ===========================================
// Utility Functions
// ===========================================
function showLoading(status) {
    const btn = document.getElementById("loginBtn");
    if (!btn) return;
    if (status) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Logging in...';
    } else {
        btn.disabled = false;
        btn.innerHTML = "Login";
    }
}

function showMessage(text, success = false) {
    const box = document.getElementById("loginMessage");
    if (!box) { alert(text); return; }
    box.innerHTML = text;
    box.style.color = success ? "green" : "red";
}

function checkSessionTimeout() {
    const session = getSession();
    if (!session) return;
    const LIMIT = 30 * 60 * 1000;
    if (Date.now() - session.loginTime > LIMIT) {
        alert("Session Expired");
        performLogout();
    }
}

function refreshSession() {
    const session = getSession();
    if (!session) return;
    session.loginTime = Date.now();
    localStorage.setItem(SESSION_NAME, JSON.stringify(session));
}

setInterval(() => {
    if (isLoggedIn()) { refreshSession(); }
}, 60000);
