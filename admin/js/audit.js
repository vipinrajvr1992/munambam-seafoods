// ========================================
// AUDIT.JS (Updated)
// Audit Trail + Logs
// ========================================

// Browser Information
function getBrowserInfo() {
    return navigator.userAgent;
}

// Current Date Time
function getCurrentDateTime() {
    return new Date().toLocaleString();
}

// Save Audit Log
async function saveAudit(action, details) {
    // CONFIG.SCRIPT_URL ഉപയോഗിക്കുന്നു[cite: 6]
    const auditData = {
        action: "Audit",
        sheetName: "Logs",
        values: [
            getCurrentDateTime(),     
            action,                   
            details,                  
            getBrowserInfo()          
        ]
    };

    try {
        await fetch(CONFIG.SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(auditData)
        });
        console.log("Audit Log Saved Successfully");
    } catch (err) {
        console.error("Audit Error:", err);
    }
}

// Log Functions
function auditAdd(item) { saveAudit("Add", "Added Transaction: " + item); }
function auditEdit(item) { saveAudit("Edit", "Edited Transaction: " + item); }
function auditDelete(item) { saveAudit("Delete", "Deleted Transaction: " + item); }
function auditLogin() { saveAudit("Login", "Admin Login"); }
function auditLogout() { saveAudit("Logout", "Admin Logout"); }
