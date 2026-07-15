// ===========================================
// Logout (Updated with Custom Modal)
// ===========================================

function logout() {
    // ബ്രൗസർ കൺഫർമേഷൻ ഒഴിവാക്കി കസ്റ്റം മോഡലിലേക്ക് മാറ്റി
    if (typeof showConfirm === "function") {
        showConfirm("Are you sure you want to logout?", () => {
            performLogout();
        });
    } else {
        // ഒരുപക്ഷേ മോഡൽ ലഭ്യമല്ലെങ്കിൽ മാത്രം പഴയ രീതിയിൽ
        if (confirm("Are you sure you want to logout?")) {
            performLogout();
        }
    }
}

// യഥാർത്ഥ ലോഗൗട്ട് പ്രക്രിയ ഇവിടെ ചെയ്യുന്നു
function performLogout() {
    if (typeof auditLogout === "function") {
        auditLogout();
    }
    localStorage.removeItem(SESSION_NAME);
    window.location.href = "login.html";
}
