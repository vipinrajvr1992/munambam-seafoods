// ==========================================
// Munambam Seafoods Dashboard
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
        // GET request for loading dashboard
        const response = await fetch(CONFIG.SCRIPT_URL + "?action=getDashboard");
        const data = await response.json();
        
        settingsData = data.settings || [];
        transactionData = data.transactions || [];
        
        renderHistory();
        updateSummaryCards();
        updateRecordCount();
    } catch (e) {
        console.error(e);
        showToast("Unable to load dashboard", "error");
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

function renderHistory() {
    const tbody = document.getElementById("historyBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    transactionData.forEach((row, index) => {
        if (index === 0) return; // Skip header
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(row[0])}</td>
            <td>${row[1]}</td>
            <td>${row[2]}</td>
            <td>${row[3]}</td>
            <td>${row[4]}</td>
            <td>
                <button onclick="editTransaction(${index})">Edit</button>
                <button onclick="deleteTransaction(${index})">Delete</button>
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

    const elInc = document.getElementById("totalIncome");
    const elExp = document.getElementById("totalExpense");
    const elNet = document.getElementById("netProfit");

    if (elInc) elInc.innerText = "₹ " + income.toFixed(2);
    if (elExp) elExp.innerText = "₹ " + expense.toFixed(2);
    if (elNet) elNet.innerText = "₹ " + (income - expense).toFixed(2);
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
