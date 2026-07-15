// ========================================
// HISTORY.JS
// Transaction History + Filter + Edit/Delete
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
        alert("Unable to load history.");

    }

}

function renderHistory(data) {

    const tbody = document.getElementById("historyBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (data.length <= 1) {

        tbody.innerHTML =
        `<tr>
            <td colspan="6" style="text-align:center">
                No Transactions Found
            </td>
        </tr>`;

        return;

    }

    data.slice(1).forEach((row,index)=>{

        tbody.innerHTML += `

        <tr>

            <td>${row[0]}</td>

            <td>${row[1]}</td>

            <td>${row[2]}</td>

            <td>${row[3]}</td>

            <td>${row[4]}</td>

            <td>

                <button class="edit-btn"
                    onclick="editTransaction(${index+2})">

                    Edit

                </button>

                <button class="delete-btn"
                    onclick="deleteTransaction(${index+2})">

                    Delete

                </button>

            </td>

        </tr>

        `;

    });

}

function filterHistory(){

    const month=document.getElementById("filterMonth").value;
    const type=document.getElementById("filterType").value;

    let filtered=transactions.slice(1);

    if(month!=""){

        filtered=filtered.filter(r=>{

            return r[0].startsWith(month);

        });

    }

    if(type!=""){

        filtered=filtered.filter(r=>r[1]==type);

    }

    renderHistory([transactions[0],...filtered]);

}

async function deleteTransaction(rowIndex){

    if(!confirm("Delete Transaction?"))
        return;

    await fetch(API_URL,{

        method:"POST",

        mode:"no-cors",

        body:JSON.stringify({

            action:"Delete",

            sheetName:"Sheet1",

            index:rowIndex

        })

    });

    alert("Deleted");

    loadHistory();

}

async function editTransaction(rowIndex){

    let row=transactions[rowIndex-1];

    let amount=prompt("New Amount",row[4]);

    if(amount==null)
        return;

    row[4]=amount;

    await fetch(API_URL,{

        method:"POST",

        mode:"no-cors",

        body:JSON.stringify({

            action:"Edit",

            sheetName:"Sheet1",

            index:rowIndex,

            values:row

        })

    });

    alert("Updated");

    loadHistory();

}

function refreshHistory(){

    loadHistory();

}
