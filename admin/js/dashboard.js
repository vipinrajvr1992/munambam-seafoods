// ==========================================
// Munambam Seafoods Dashboard - Fully Updated
// dashboard.js
// ==========================================

let settingsData = [];
let transactionData = [];

document.addEventListener("DOMContentLoaded", () => {
    if (typeof protectPage === "function") protectPage();
    initDashboard();
});

async function initDashboard() {
    await loadDashboard();
}

async function loadDashboard() {
    showLoader(true);
    try {
        const response = await fetch(CONFIG.SCRIPT_URL + "?action=getDashboard");
        const data = await response.json();
        
        settingsData = data.settings || [];
        transactionData = data.transactions || [];
        
        renderHistory();
        updateSummaryCards();
        updateRecordCount();
        loadCategories(); 
    } catch (e) {
        console.error(e);
        showToast("Unable to load dashboard", "error");
    }
    showLoader(false);
}

// DELETE TRANSACTION (Updated)
async function deleteTransaction(rowIndex) {
    showConfirm("Are you sure you want to delete this entry?", async () => {
        showLoader(true);
        try {
            await api({
                action: "Delete",
                sheetName: "Sheet1",
                index: rowIndex
            });
            showToast("Transaction Deleted Successfully");
            loadDashboard(); 
            if (typeof auditDelete === "function") auditDelete("Row " + rowIndex);
        } catch (e) {
            showToast("Failed to delete", "error");
        }
        showLoader(false);
    });
}

// EDIT TRANSACTION (Updated with Custom Prompt Logic)
async function editTransaction(rowIndex) {
    let row = transactionData[rowIndex];
    
    // Prompt-ന് പകരം പുതിയൊരു ഇൻപുട്ട് മോഡൽ വേണമെങ്കിൽ html-ൽ മാറ്റങ്ങൾ വരുത്തണം
    // നിലവിൽ ലളിതമാക്കാൻ prompt ഉപയോഗിക്കാം അല്ലെങ്കിൽ custom modal ലോജിക് ചേർക്കാം
    let newAmount = prompt("Enter New Amount:", row[4]); 
    
    if (newAmount == null || newAmount === "") return;

    row[4] = newAmount;

    showLoader(true);
    try {
        await api({
            action: "Edit",
            sheetName: "Sheet1",
            index: rowIndex,
            values: row
        });
        showToast("Transaction Updated");
        loadDashboard();
        if (typeof auditEdit === "function") auditEdit("Row " + rowIndex);
    } catch (e) {
        showToast("Update failed", "error");
    }
    showLoader(false);
}

async function api(data) {
    const response = await fetch(CONFIG.SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    return await response.json();
}

// RENDER HISTORY WITH COLORS (Income Green, Expense Red)
function renderHistory() {
    const tbody = document.getElementById("historyBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    transactionData.forEach((row, index) => {
        if (index === 0) return;
        
        const tr = document.createElement("tr");
        const typeColor = row[1] === "Income" ? "green" : "red";
        
        tr.innerHTML = `
            <td>${formatDate(row[0])}</td>
            <td style="color: ${typeColor}; font-weight: bold;">${row[1]}</td>
            <td>${row[2]}</td>
            <td>${row[3]}</td>
            <td style="font-weight: bold;">₹ ${row[4]}</td>
            <td>
                <button onclick="editTransaction(${index})" class="btn-edit">Edit</button>
                <button onclick="deleteTransaction(${index})" class="btn-delete">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateSummaryCards() {
    let income = 0, expense = 0;
    transactionData.forEach((r, i) => {
        if (i === 0) return;
        if (r[1] === "Income") income += Number(r[4]) || 0;
        else expense += Number(r[4]) || 0;
    });

    document.getElementById("totalIncome").innerText = "₹ " + income.toFixed(2);
    document.getElementById("totalExpense").innerText = "₹ " + expense.toFixed(2);
    document.getElementById("netProfit").innerText = "₹ " + (income - expense).toFixed(2);
}

function updateRecordCount() {
    const el = document.getElementById("recordCount");
    if (el) el.innerText = Math.max(0, transactionData.length - 1);
}

function showLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "block" : "none";
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = message;
    toast.className = "toast " + type;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 3000);
}

function formatDate(date) {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-GB");
}

function refreshDashboard() {
    loadDashboard();
}

// category & item dropdown logic (Empty shells to prevent errors)
function loadCategories() {
    // നിങ്ങളുടെ API ഉപയോഗിച്ച് ഡ്രോപ്പ്‌ഡൗൺ ഫിൽ ചെയ്യാൻ ഇവിടെ കോഡ് നൽകുക
}
