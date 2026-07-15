// ==========================================
// Munambam Seafoods Dashboard
// dashboard.js
// Part 1
// ==========================================

let settingsData = [];
let transactionData = [];

const categorySelect = document.getElementById("categorySelect");
const itemSelect = document.getElementById("itemSelect");

// ------------------------------------
// API Helper
// ------------------------------------

async function api(data) {

    const response = await fetch(CONFIG.SCRIPT_URL, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(data)

    });

    return await response.json();

}

// ------------------------------------
// Dashboard Init
// ------------------------------------

async function initDashboard() {

    protectPage();

    await loadDashboard();

}

// ------------------------------------
// Load Dashboard
// ------------------------------------

async function loadDashboard() {

    showLoader(true);

    try {

        const data = await api({

            action: "getDashboard"

        });

        settingsData = data.settings || [];

        transactionData = data.transactions || [];

        loadCategories();

        renderHistory();

        updateSummaryCards();

    }

    catch (e) {

        console.log(e);

        alert("Unable to load dashboard");

    }

    showLoader(false);

}

// ------------------------------------
// Categories
// ------------------------------------

function loadCategories() {

    categorySelect.innerHTML = "";

    const categories = [...new Set(

        settingsData.map(r => r[0])

    )];

    categories.forEach(cat => {

        categorySelect.innerHTML +=

            `<option value="${cat}">${cat}</option>`;

    });

    loadItems();

}

// ------------------------------------
// Items
// ------------------------------------

function loadItems() {

    itemSelect.innerHTML = "";

    const category = categorySelect.value;

    settingsData

    .filter(r => r[0] === category)

    .forEach(r => {

        itemSelect.innerHTML +=

        `<option value="${r[1]}">${r[1]}</option>`;

    });

}

categorySelect.addEventListener("change", loadItems);

// ------------------------------------
// History Table
// ------------------------------------

function renderHistory() {

    const table = document.getElementById("historyTable");

    table.innerHTML = "";

    transactionData.forEach((row,index)=>{

        table.innerHTML += `

<tr>

<td>${formatDate(row[0])}</td>

<td>${row[1]}</td>

<td>${row[2]}</td>

<td>${row[3]}</td>

<td>${row[4]}</td>

<td>

<button onclick="editTransaction(${index})">

Edit

</button>

<button onclick="deleteTransaction(${index})">

Delete

</button>

</td>

</tr>

`;

    });

}

// ------------------------------------
// Summary Cards
// ------------------------------------

function updateSummaryCards(){

    let income=0;

    let expense=0;

    transactionData.forEach(r=>{

        if(r[1]=="Income")

            income+=Number(r[4]);

        else

            expense+=Number(r[4]);

    });

    document.getElementById("totalIncome").innerHTML=

    "₹ "+income.toFixed(2);

    document.getElementById("totalExpense").innerHTML=

    "₹ "+expense.toFixed(2);

    document.getElementById("netProfit").innerHTML=

    "₹ "+(income-expense).toFixed(2);

}

// ------------------------------------
// Loader
// ------------------------------------

function showLoader(status){

    const loader=document.getElementById("loader");

    if(!loader)return;

    loader.style.display=status?"block":"none";

}

// ------------------------------------
// Format Date
// ------------------------------------

function formatDate(date){

    if(!date) return "";

    return new Date(date)

    .toLocaleDateString("en-GB");

}

// ------------------------------------
// Refresh Dashboard
// ------------------------------------

function refreshDashboard(){

    loadDashboard();

}

// ------------------------------------
// Page Ready
// ------------------------------------

document.addEventListener(

"DOMContentLoaded",

initDashboard

);
// ==========================================
// SAVE TRANSACTION
// ==========================================

async function saveTransaction() {

    const date = document.getElementById("date").value;
    const type = document.getElementById("type").value;
    const category = categorySelect.value;
    const item = itemSelect.value;
    const amount = document.getElementById("amount").value;
    const notes = document.getElementById("notes")
        ? document.getElementById("notes").value
        : "";

    // Validation
    if (!validateForm(date, amount)) return;

    const btn = document.getElementById("saveBtn");

    setButtonLoading(btn, true);

    try {

        const result = await api({

            action: "addTransaction",

            values: [

                date,

                type,

                category,

                item,

                amount,

                notes

            ]

        });

        if (result.success) {

            showToast("Transaction Saved", "success");

            resetForm();

            await loadDashboard();

        } else {

            showToast(result.message || "Save Failed", "error");

        }

    }

    catch (e) {

        console.log(e);

        showToast("Connection Error", "error");

    }

    setButtonLoading(btn, false);

}

//
// VALIDATION
//

function validateForm(date, amount) {

    if (!date) {

        showToast("Select Date", "warning");

        return false;

    }

    if (!amount || Number(amount) <= 0) {

        showToast("Enter Valid Amount", "warning");

        return false;

    }

    return true;

}

//
// RESET FORM
//

function resetForm() {

    document.getElementById("date").value = "";

    document.getElementById("amount").value = "";

    if (document.getElementById("notes"))

        document.getElementById("notes").value = "";

    document.getElementById("type").selectedIndex = 0;

    categorySelect.selectedIndex = 0;

    loadItems();

}

//
// BUTTON LOADING
//

function setButtonLoading(button, loading) {

    if (!button) return;

    if (loading) {

        button.disabled = true;

        button.dataset.oldText = button.innerHTML;

        button.innerHTML = "Saving...";

    }

    else {

        button.disabled = false;

        button.innerHTML =

            button.dataset.oldText || "Save";

    }

}

//
// TOAST
//

function showToast(message, type = "success") {

    let toast = document.getElementById("toast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "toast";

        document.body.appendChild(toast);

    }

    toast.innerHTML = message;

    toast.className = "toast " + type;

    toast.style.display = "block";

    setTimeout(() => {

        toast.style.display = "none";

    }, 3000);

}

//
// SAVE BUTTON EVENT
//

const saveBtn = document.getElementById("saveBtn");

if (saveBtn)

    saveBtn.addEventListener(

        "click",

        saveTransaction

    );
// ==========================================
// EDIT / UPDATE / DELETE / UNDO
// ==========================================

let editingIndex = -1;
let deletedTransaction = null;
let undoTimer = null;

// ------------------------------------------
// OPEN EDIT MODAL
// ------------------------------------------

function editTransaction(index) {

    editingIndex = index;

    const row = transactionData[index];

    document.getElementById("editDate").value = row[0];
    document.getElementById("editType").value = row[1];
    document.getElementById("editCategory").value = row[2];

    loadEditItems(row[2]);

    document.getElementById("editItem").value = row[3];
    document.getElementById("editAmount").value = row[4];

    if(document.getElementById("editNotes"))
        document.getElementById("editNotes").value = row[5] || "";

    document.getElementById("editModal").style.display = "flex";

}

// ------------------------------------------
// LOAD EDIT ITEMS
// ------------------------------------------

function loadEditItems(category){

    const item = document.getElementById("editItem");

    item.innerHTML = "";

    settingsData

    .filter(r => r[0] === category)

    .forEach(r=>{

        item.innerHTML +=
        `<option value="${r[1]}">${r[1]}</option>`;

    });

}

// ------------------------------------------
// CATEGORY CHANGE
// ------------------------------------------

const editCategory = document.getElementById("editCategory");

if(editCategory){

    editCategory.addEventListener("change",()=>{

        loadEditItems(editCategory.value);

    });

}

// ------------------------------------------
// CLOSE MODAL
// ------------------------------------------

function closeEditModal(){

    document.getElementById("editModal").style.display="none";

    editingIndex=-1;

}

// ------------------------------------------
// UPDATE
// ------------------------------------------

async function updateTransaction(){

    if(editingIndex==-1) return;

    const values=[

        document.getElementById("editDate").value,

        document.getElementById("editType").value,

        document.getElementById("editCategory").value,

        document.getElementById("editItem").value,

        document.getElementById("editAmount").value,

        document.getElementById("editNotes")
        ? document.getElementById("editNotes").value
        : ""

    ];

    try{

        const result=await api({

            action:"updateTransaction",

            index:editingIndex,

            values:values

        });

        if(result.success){

            showToast("Transaction Updated","success");

            closeEditModal();

            await loadDashboard();

        }

        else{

            showToast(result.message,"error");

        }

    }

    catch(e){

        console.log(e);

        showToast("Update Failed","error");

    }

}

// ------------------------------------------
// DELETE
// ------------------------------------------

async function deleteTransaction(index){

    if(!confirm("Delete this transaction?"))
        return;

    deletedTransaction=transactionData[index];

    try{

        const result=await api({

            action:"deleteTransaction",

            index:index

        });

        if(result.success){

            showUndoToast();

            await loadDashboard();

        }

    }

    catch(e){

        console.log(e);

        showToast("Delete Failed","error");

    }

}

// ------------------------------------------
// UNDO TOAST
// ------------------------------------------

function showUndoToast(){

    const toast=document.getElementById("toast");

    toast.innerHTML=`
        Transaction Deleted
        <br><br>
        <button onclick="undoDelete()">
            Undo
        </button>
    `;

    toast.className="toast warning";

    toast.style.display="block";

    clearTimeout(undoTimer);

    undoTimer=setTimeout(()=>{

        toast.style.display="none";

        deletedTransaction=null;

    },10000);

}

// ------------------------------------------
// UNDO DELETE
// ------------------------------------------

async function undoDelete(){

    if(!deletedTransaction) return;

    try{

        const result=await api({

            action:"undoDelete",

            values:deletedTransaction

        });

        if(result.success){

            showToast("Restored","success");

            await loadDashboard();

        }

    }

    catch(e){

        console.log(e);

    }

}

// ------------------------------------------
// UPDATE BUTTON
// ------------------------------------------

const updateBtn=document.getElementById("updateBtn");

if(updateBtn){

    updateBtn.addEventListener(

        "click",

        updateTransaction

    );

}
// ==========================================
// SEARCH / FILTER / SORT / AUTO REFRESH
// ==========================================

let filteredTransactions = [];
let autoRefreshTimer = null;

// ------------------------------------------
// SEARCH
// ------------------------------------------

function searchTransactions() {

    const keyword = document
        .getElementById("searchInput")
        .value
        .toLowerCase()
        .trim();

    filteredTransactions = transactionData.filter(row => {

        return row.join(" ")
            .toLowerCase()
            .includes(keyword);

    });

    renderFilteredHistory();

}

// ------------------------------------------
// FILTER
// ------------------------------------------

function filterTransactions() {

    const type = document.getElementById("filterType").value;
    const category = document.getElementById("filterCategory").value;

    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;

    filteredTransactions = transactionData.filter(row => {

        let ok = true;

        if (type && row[1] !== type)
            ok = false;

        if (category && row[2] !== category)
            ok = false;

        if (fromDate) {

            if (new Date(row[0]) < new Date(fromDate))
                ok = false;

        }

        if (toDate) {

            if (new Date(row[0]) > new Date(toDate))
                ok = false;

        }

        return ok;

    });

    renderFilteredHistory();

}

// ------------------------------------------
// RESET FILTER
// ------------------------------------------

function resetFilters() {

    document.getElementById("searchInput").value = "";

    document.getElementById("filterType").selectedIndex = 0;

    document.getElementById("filterCategory").selectedIndex = 0;

    document.getElementById("fromDate").value = "";

    document.getElementById("toDate").value = "";

    renderHistory();

}

// ------------------------------------------
// SORT
// ------------------------------------------

function sortTransactions(order = "newest") {

    let data = filteredTransactions.length
        ? filteredTransactions
        : [...transactionData];

    data.sort((a, b) => {

        const d1 = new Date(a[0]);

        const d2 = new Date(b[0]);

        return order === "newest"
            ? d2 - d1
            : d1 - d2;

    });

    renderFilteredHistory(data);

}

// ------------------------------------------
// RENDER FILTERED TABLE
// ------------------------------------------

function renderFilteredHistory(data = filteredTransactions) {

    const table = document.getElementById("historyTable");

    table.innerHTML = "";

    data.forEach((row, index) => {

        table.innerHTML += `

<tr>

<td>${formatDate(row[0])}</td>

<td>${row[1]}</td>

<td>${row[2]}</td>

<td>${row[3]}</td>

<td>₹ ${row[4]}</td>

<td>

<button onclick="editTransaction(${index})">

Edit

</button>

<button onclick="deleteTransaction(${index})">

Delete

</button>

</td>

</tr>

`;

    });

}

// ------------------------------------------
// AUTO REFRESH
// ------------------------------------------

function startAutoRefresh() {

    stopAutoRefresh();

    autoRefreshTimer = setInterval(() => {

        loadDashboard();

    }, 30000);

}

// ------------------------------------------
// STOP REFRESH
// ------------------------------------------

function stopAutoRefresh() {

    if (autoRefreshTimer)

        clearInterval(autoRefreshTimer);

}

// ------------------------------------------
// EXPORT PLACEHOLDER
// ------------------------------------------

function exportExcel() {

    if (typeof exportToExcel === "function") {

        exportToExcel(

            filteredTransactions.length
                ? filteredTransactions
                : transactionData

        );

    }

}

// ------------------------------------------
// REFRESH BUTTON
// ------------------------------------------

function refreshNow() {

    loadDashboard();

    showToast("Dashboard Refreshed");

}

// ------------------------------------------
// TOTAL ROW COUNT
// ------------------------------------------

function updateRecordCount() {

    const el = document.getElementById("recordCount");

    if (!el) return;

    const total = filteredTransactions.length
        ? filteredTransactions.length
        : transactionData.length;

    el.innerHTML = total;

}

// ------------------------------------------
// PAGE EVENTS
// ------------------------------------------

window.addEventListener("focus", () => {

    loadDashboard();

});

window.addEventListener("beforeunload", () => {

    stopAutoRefresh();

});

document.addEventListener("DOMContentLoaded", () => {

    startAutoRefresh();

});
