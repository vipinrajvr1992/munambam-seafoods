// ========================================
// AUDIT.JS
// Audit Trail + Logs
// ========================================

// Browser Information
function getBrowserInfo() {

    return navigator.userAgent;

}

// Current Date Time
function getCurrentDateTime() {

    const now = new Date();

    return now.toLocaleString();

}

// Save Audit Log
async function saveAudit(action, details) {

    const auditData = {

        action: "Audit",

        sheetName: "Logs",

        values: [

            getCurrentDateTime(),     // Date

            action,                   // Add/Edit/Delete/Login

            details,                  // Details

            getBrowserInfo()          // Browser

        ]

    };

    try {

        await fetch(API_URL, {

            method: "POST",

            mode: "no-cors",

            body: JSON.stringify(auditData)

        });

        console.log("Audit Saved");

    } catch (err) {

        console.error("Audit Error", err);

    }

}

// Log Add
function auditAdd(item) {

    saveAudit(

        "Add",

        "Added Transaction : " + item

    );

}

// Log Edit
function auditEdit(item) {

    saveAudit(

        "Edit",

        "Edited Transaction : " + item

    );

}

// Log Delete
function auditDelete(item) {

    saveAudit(

        "Delete",

        "Deleted Transaction : " + item

    );

}

// Login Log
function auditLogin() {

    saveAudit(

        "Login",

        "Admin Login"

    );

}

// Logout Log
function auditLogout() {

    saveAudit(

        "Logout",

        "Admin Logout"

    );

}
