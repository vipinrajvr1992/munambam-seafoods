// ========================================
// EXPORT.JS
// Export History Table to Excel
// ========================================

// SheetJS Required
// https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js

function exportToExcel() {

    const table = document.getElementById("historyTable");

    if (!table) {
        alert("History table not found.");
        return;
    }

    // Create workbook
    const workbook = XLSX.utils.table_to_book(table, {
        sheet: "Transactions"
    });

    // File Name

    const today = new Date();

    const filename =
        "Munambam_Transactions_" +
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0") +
        ".xlsx";

    XLSX.writeFile(workbook, filename);

}
