// ========================================
// EXPORT.JS (Updated with Custom Toast)
// Export History Table to Excel
// ========================================

function exportToExcel() {
    // dashboard.html-ൽ നമ്മൾ ഉപയോഗിക്കുന്ന table-ന്റെ ID 'historyTable' ആണെന്ന് ഉറപ്പാക്കുക
    const table = document.getElementById("historyTable");

    if (!table) {
        // alert()-ന് പകരം showToast ഉപയോഗിക്കുന്നു
        if (typeof showToast === "function") {
            showToast("History table not found.", "error");
        } else {
            alert("History table not found.");
        }
        return;
    }

    // Create workbook
    const workbook = XLSX.utils.table_to_book(table, {
        sheet: "Transactions"
    });

    // File Name (Date formatted)
    const today = new Date();
    const filename =
        "Munambam_Transactions_" +
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0") +
        ".xlsx";

    // Export file
    XLSX.writeFile(workbook, filename);
    
    // ടോസ്റ്റ് നോട്ടിഫിക്കേഷൻ[cite: 12]
    if (typeof showToast === "function") {
        showToast("Excel file exported successfully!");
    }
}
