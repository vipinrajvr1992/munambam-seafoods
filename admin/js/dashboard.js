// ==========================================
// Munambam Seafoods Dashboard
// dashboard.js
// ==========================================

let settingsData = [];
let transactionData = [];
let filteredTransactions = [];
let editingIndex = -1;
let deletedTransaction = null;
let undoTimer = null;
let autoRefreshTimer = null;

document.addEventListener("DOMContentLoaded", () => {
    if (typeof protectPage === "function") protectPage();
    initDashboard();
    startAutoRefresh();
});

window.addEventListener("focus", loadDashboard);
window.addEventListener("beforeunload", stopAutoRefresh);

async function initDashboard() {
    await loadDashboard();
    setupEventListeners();
}

async function api(data) {
    try {
        const response = await fetch(CONFIG.SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
        throw error;
    }
}

async function loadDashboard() {
    showLoader(true);
    try {
        const data = await api({ action: "getDashboard" });
        settingsData = data.settings || [];
        transactionData = (data.transactions || []).slice(1);
        
        loadCategories();
        renderHistory();
        updateSummaryCards();
        updateRecordCount();
    } catch (error) {
        console.error(error);
        showToast("Unable to load dashboard", "error");
    }
    showLoader(false);
}

function loadCategories() {
    const categorySelect = document.getElementById("categorySelect");
    const editCategory = document.getElementById("editCategory");
    
    const categories = [...new Set(settingsData.slice(1).map(r => r[0]))];
    
    const populate = (el) => {
        if (!el) return;
        el.innerHTML = "";
        categories.forEach(cat => el.innerHTML += `<option value="${cat}">${cat}</option>`);
        el.dispatchEvent(new Event('change'));
    };
    
    populate(categorySelect);
    populate(editCategory);
}

function loadItems(category, itemEl) {
    if (!itemEl) return;
    itemEl.innerHTML = "";
    settingsData.slice(1).filter(r => r[0] === category).forEach(r => {
        itemEl.innerHTML += `<option value="${r[1]}">${r[1]}</option>`;
    });
}

function setupEventListeners() {
    const categorySelect = document.getElementById("categorySelect");
    const itemSelect = document.getElementById("itemSelect");
    const editCategory = document.getElementById("editCategory");
    const editItem = document.getElementById("editItem");
    const saveBtn = document.getElementById("saveBtn");
    const updateBtn = document.getElementById("updateBtn");

    if (categorySelect && itemSelect) {
        categorySelect.addEventListener("change", () => loadItems(categorySelect.value, itemSelect));
    }
    if (editCategory && editItem) {
        editCategory.addEventListener("change", () => loadItems(editCategory.value, editItem));
    }
    if (saveBtn) saveBtn.addEventListener("click", saveTransaction);
    if (updateBtn) updateBtn.addEventListener("click", updateTransaction);
}

function renderHistory(data = transactionData) {
    const tbody = document.getElementById("historyBody");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    data.forEach((row, index) => {
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
    const totalIncome = document.getElementById("totalIncome");
    const totalExpense = document.getElementById("totalExpense");
    const netProfit = document.getElementById("netProfit");

    let inc = 0, exp = 0;
    transactionData.forEach(r => {
        const amt = Number(r[4]) || 0;
        r[1] === "Income" ? inc += amt : exp += amt;
    });

    if (totalIncome) totalIncome.innerText = `₹ ${inc.toFixed(2)}`;
    if (totalExpense) totalExpense.innerText = `₹ ${exp.toFixed(2)}`;
    if (netProfit) netProfit.innerText = `₹ ${(inc - exp).toFixed(2)}`;
}

async function saveTransaction() {
    const date = document.getElementById("date")?.value;
    const type = document.getElementById("type")?.value;
    const cat = document.getElementById("categorySelect")?.value;
    const item = document.getElementById("itemSelect")?.value;
    const amt = document.getElementById("amount")?.value;
    const notes = document.getElementById("notes")?.value || "";

    if (!date || Number(amt) <= 0) {
        showToast("Invalid date or amount", "warning");
        return;
    }

    const result = await api({
        action: "addTransaction",
        values: [date, type, cat, item, amt, notes]
    });

    if (result.success) {
        showToast("Saved successfully", "success");
        loadDashboard();
    }
}

function editTransaction(index) {
    const row = transactionData[index];
    editingIndex = index;

    const modal = document.getElementById("editModal");
    if (modal) {
        document.getElementById("editDate").value = row[0];
        document.getElementById("editType").value = row[1];
        document.getElementById("editCategory").value = row[2];
        loadItems(row[2], document.getElementById("editItem"));
        document.getElementById("editItem").value = row[3];
        document.getElementById("editAmount").value = row[4];
        if (document.getElementById("editNotes")) document.getElementById("editNotes").value = row[5] || "";
        modal.style.display = "flex";
    } else {
        const newVal = prompt("Edit amount:", row[4]);
        if (newVal) updateTransactionManual(index, newVal);
    }
}

async function updateTransaction() {
    const values = [
        document.getElementById("editDate").value,
        document.getElementById("editType").value,
        document.getElementById("editCategory").value,
        document.getElementById("editItem").value,
        document.getElementById("editAmount").value,
        document.getElementById("editNotes")?.value || ""
    ];

    const result = await api({ action: "updateTransaction", index: editingIndex + 1, values });
    if (result.success) {
        document.getElementById("editModal").style.display = "none";
        loadDashboard();
    }
}

async function deleteTransaction(index) {
    if (!confirm("Are you sure?")) return;
    deletedTransaction = transactionData[index];
    const result = await api({ action: "deleteTransaction", index: index + 1 });
    if (result.success) {
        showToast("Deleted", "warning");
        loadDashboard();
    }
}

function undoDelete() {
    if (!deletedTransaction) return;
    api({ action: "undoDelete", values: deletedTransaction }).then(() => {
        showToast("Restored", "success");
        loadDashboard();
    });
}

function showToast(message, type) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = message;
    toast.className = `toast ${type}`;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 3000);
}

function showLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "block" : "none";
}

function formatDate(d) {
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleDateString("en-GB");
}

function updateRecordCount() {
    const el = document.getElementById("recordCount");
    if (el) el.innerText = transactionData.length;
}

function startAutoRefresh() {
    autoRefreshTimer = setInterval(loadDashboard, 30000);
}

function stopAutoRefresh() {
    clearInterval(autoRefreshTimer);
}
