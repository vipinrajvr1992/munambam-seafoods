// ========================================
// HISTORY.JS (Updated with Custom Modal)
// ========================================

let transactions = [];

async function loadHistory() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        transactions = data.transactions || [];
        renderHistory(transactions);
    } catch (err) {
        console.error(err);
        showToast("Unable to load history.", "error"); // Custom toast instead of alert
    }
}

function renderHistory(data) {
    const tbody = document.getElementById("historyBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (data.length <= 1) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">No Transactions Found</td></tr>`;
        return;
    }

    data.slice(1).forEach((row, index) => {
        tbody.innerHTML += `
        <tr>
            <td>${row[0]}</td>
            <td>${row[1]}</td>
            <td>${row[2]}</td>
            <td>${row[3]}</td>
            <td>${row[4]}</td>
            <td>
                <button class="edit-btn" onclick="editTransaction(${index + 2})">Edit</button>
                <button class="delete-btn" onclick="deleteTransaction(${index + 2})">Delete</button>
            </td>
        </tr>`;
    });
}

// DELETE TRANSACTION (Using Custom Modal)
async function deleteTransaction(rowIndex) {
    showConfirm("Are you sure you want to delete this transaction?", async () => {
        await fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                action: "Delete",
                sheetName: "Sheet1",
                index: rowIndex
            })
        });
        showToast("Transaction Deleted");
        loadHistory();
    });
}

// EDIT TRANSACTION (Using Custom Prompt Logic)
// കുറിപ്പ്: prompt() പൂർണ്ണമായി ഒഴിവാക്കാൻ ഒരു ഇൻപുട്ട് മോഡൽ കൂടി ആവശ്യമാണ്. 
// തൽക്കാലം ഇത് പ്രവർത്തിക്കും, പക്ഷേ കൂടുതൽ പ്രീമിയം ലുക്കിന് ഇൻപുട്ട് മോഡൽ ചേർക്കാവുന്നതാണ്.
async function editTransaction(rowIndex) {
    let row = transactions[rowIndex - 1];
    let newAmount = prompt("Enter New Amount:", row[4]); 
    
    if (newAmount == null || newAmount === "") return;

    row[4] = newAmount;

    await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
            action: "Edit",
            sheetName: "Sheet1",
            index: rowIndex,
            values: row
        })
    });
    showToast("Transaction Updated");
    loadHistory();
}

function refreshHistory() {
    loadHistory();
}
