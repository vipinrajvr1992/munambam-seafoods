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
        
        // ഡ്രോപ്പ്‌ഡൗൺ ലോഡ് ചെയ്യുന്നു (ഹെഡർ ഒഴിവാക്കി)
        loadCategories(); 
    } catch (e) {
        console.error(e);
        showToast("Unable to load dashboard", "error");
    }
    showLoader(false);
}

// ഡ്രോപ്പ്‌ഡൗൺ ലോജിക് - ഹെഡർ ഒഴിവാക്കി
function loadCategories() {
    const categorySelect = document.getElementById("categorySelect");
    const itemSelect = document.getElementById("itemSelect");
    
    if (!categorySelect || !itemSelect) return;

    // settingsData-യിൽ നിന്ന് ഒന്നാമത്തെ റോ (Header) ഒഴിവാക്കുന്നു
    const dataRows = settingsData.slice(1);
    
    // Unique കാറ്റഗറികൾ മാത്രം എടുക്കുന്നു
    const categories = [...new Set(dataRows.map(r => r[0]))];
    
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(cat => {
        if (cat) { // ശൂന്യമായ കാറ്റഗറികൾ ഒഴിവാക്കാൻ
            categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        }
    });

    categorySelect.addEventListener("change", function() {
        const selectedCat = this.value;
        itemSelect.innerHTML = '<option value="">Select Item</option>';
        
        // സെലക്ട് ചെയ്ത കാറ്റഗറിക്ക് അനുസരിച്ചുള്ള ഐറ്റം ഫിൽട്ടർ ചെയ്യുന്നു
        dataRows.filter(r => r[0] === selectedCat).forEach(r => {
            if (r[1]) {
                itemSelect.innerHTML += `<option value="${r[1]}">${r[1]}</option>`;
            }
        });
        itemSelect.classList.add('fade-in');
    });
}

// ... ബാക്കി ഫങ്ഷനുകൾ അതേപടി നിലനിർത്തുക ...

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
        if (index === 0) return;
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
