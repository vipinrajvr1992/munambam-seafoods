// ===========================================
// Munambam Seafoods Admin Authentication
// auth.js
// ===========================================

const SESSION_NAME = CONFIG.SESSION_KEY || "munambam_admin";

// -----------------------------
// Save Session
// -----------------------------
function saveSession(user) {

    const session = {
        loggedIn: true,
        username: user,
        loginTime: new Date().getTime()
    };

    localStorage.setItem(SESSION_NAME, JSON.stringify(session));

}


// -----------------------------
// Get Session
// -----------------------------
function getSession() {

    const data = localStorage.getItem(SESSION_NAME);

    if (!data) return null;

    try {
        return JSON.parse(data);
    } catch (e) {
        return null;
    }

}


// -----------------------------
// Check Login
// -----------------------------
function isLoggedIn() {

    const session = getSession();

    if (!session) return false;

    return session.loggedIn === true;

}


// -----------------------------
// Logout
// -----------------------------
function logout() {

    if (!confirm("Logout now?")) return;

    localStorage.removeItem(SESSION_NAME);

    window.location.href = "login.html";

}


// -----------------------------
// Redirect if already logged
// -----------------------------
function redirectIfLoggedIn() {

    if (isLoggedIn()) {

        window.location.href = "dashboard.html";

    }

}


// -----------------------------
// Protect Dashboard
// -----------------------------
function protectPage() {

    if (!isLoggedIn()) {

        window.location.href = "login.html";

    }

}


// -----------------------------
// Login
// -----------------------------
async function login(password) {

    showLoading(true);

    try {

        const response = await fetch(CONFIG.SCRIPT_URL, {

            method: "POST",

            body: JSON.stringify({

                action: "login",

                password: password

            })

        });

        const result = await response.json();

        showLoading(false);

        if (result.success) {

            saveSession(result.username);

            window.location.href = "dashboard.html";

        } else {

            alert(result.message || "Invalid Password");

        }

    }

    catch (err) {

        showLoading(false);

        alert("Unable to connect.");

        console.error(err);

    }

}



// -----------------------------
// Loading
// -----------------------------
function showLoading(status) {

    const btn = document.getElementById("loginBtn");

    if (!btn) return;

    if (status) {

        btn.disabled = true;

        btn.innerHTML = "Logging in...";

    } else {

        btn.disabled = false;

        btn.innerHTML = "Login";

    }

}



// -----------------------------
// Auto Logout after 30 min
// -----------------------------
function checkSessionTimeout() {

    const session = getSession();

    if (!session) return;

    const now = new Date().getTime();

    const diff = now - session.loginTime;

    const LIMIT = 30 * 60 * 1000;

    if (diff > LIMIT) {

        alert("Session expired.");

        logout();

    }

}



// -----------------------------
// Update Login Time
// -----------------------------
function refreshSession() {

    const session = getSession();

    if (!session) return;

    session.loginTime = new Date().getTime();

    localStorage.setItem(SESSION_NAME, JSON.stringify(session));

}



// -----------------------------
// Page Init
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {

    checkSessionTimeout();

});
