let allData = [];
let categories = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Page loaded - initializing...");
  
  // Try auto-sync first
  const synced = await autoSync();
  
  // Load data (from sync or from DB)
  await loadData();
  
  // Manual CSV upload handler
  const csvFileInput = document.getElementById("csvFile");
  if (csvFileInput) {
    csvFileInput.addEventListener("change", async function(e) {
      const file = e.target.files[0];
      if (!file) {
        console.log("No file selected");
        return;
      }
      
      console.log("File selected:", file.name);
      document.getElementById("lastUpload").textContent = "Uploading...";
      
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async function(results) {
          console.log("CSV parsed:", results.data.length, "rows");
          
          if (results.data && results.data.length > 0) {
            await replaceStore(EMP_STORE, results.data);
            await loadData();
            alert("✅ Data uploaded successfully! " + results.data.length + " records loaded.");
          } else {
            alert("⚠️ No data found in CSV file!");
          }
        },
        error: function(err) {
          console.error("CSV Parse error:", err);
          alert("❌ Error parsing CSV file: " + err.message);
        }
      });
    });
  }
});

async function loadData() {
  console.log("Loading data from IndexedDB...");
  allData = await getAll(EMP_STORE);
  console.log("Loaded", allData.length, "records");
  
  const lastUpdate = await getLast(EMP_STORE);
  document.getElementById("lastUpload").textContent = lastUpdate;
  
  // Update stats
  document.getElementById("totalEmployees").textContent = allData.length;
  
  // Extract unique categories
  categories.clear();
  allData.forEach(emp => {
    if (emp.CATEGORY) categories.add(emp.CATEGORY);
  });
  document.getElementById("totalCategories").textContent = categories.size;
  
  // Populate category dropdown
  const categorySelect = document.getElementById("filterCategory");
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">All Categories</option>';
    Array.from(categories).sort().forEach(cat => {
      categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  }
  
  display(allData);
}

function display(rows) {
  const tbl = document.getElementById("results");
  
  if (!rows || rows.length === 0) {
    tbl.innerHTML = "<tbody><tr><td colspan='5' style='text-align:center; padding:40px; color:#999;'>📭 No data available. Please upload a CSV file or refresh data from GitHub.</td></tr></tbody>";
    return;
  }
  
  // Column order based on your CSV
  const columnOrder = ["No", "Reg. NO", "CATEGORY", "RP NO", "Name"];
  
  let html = "<thead><tr>";
  columnOrder.forEach(col => {
    html += `<th>${col}</th>`;
  });
  html += "</tr></thead><tbody>";
  
  rows.forEach(row => {
    html += "<tr>";
    columnOrder.forEach(col => {
      html += `<td>${row[col] !== undefined && row[col] !== null ? row[col] : ""}</td>`;
    });
    html += "</tr>";
  });
  
  html += "</tbody>";
  tbl.innerHTML = html;
}

async function searchData() {
  const nameVal = document.getElementById("searchName").value.trim().toLowerCase();
  const regVal = document.getElementById("searchReg").value.trim().toLowerCase();
  const categoryVal = document.getElementById("filterCategory").value;
  const rpVal = document.getElementById("searchRP").value.trim().toLowerCase();
  
  const filtered = allData.filter(row => {
    const matchName = !nameVal || (row.Name && String(row.Name).toLowerCase().includes(nameVal));
    const matchReg = !regVal || (row["Reg. NO"] && String(row["Reg. NO"]).toLowerCase().includes(regVal));
    const matchCategory = !categoryVal || (row.CATEGORY === categoryVal);
    const matchRP = !rpVal || (row["RP NO"] && String(row["RP NO"]).toLowerCase().includes(rpVal));
    
    return matchName && matchReg && matchCategory && matchRP;
  });
  
  display(filtered);
}

function showAll() {
  document.getElementById("searchName").value = "";
  document.getElementById("searchReg").value = "";
  document.getElementById("filterCategory").value = "";
  document.getElementById("searchRP").value = "";
  display(allData);
}

function exportCSV() {
  if (!allData || allData.length === 0) {
    alert("⚠️ No data to export");
    return;
  }
  
  const csv = Papa.unparse(allData);
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employees_" + new Date().toISOString().split('T')[0] + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function manualSync() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = "🔄 Syncing...";
  
  const success = await autoSync();
  await loadData();
  
  btn.disabled = false;
  btn.textContent = "🔄 Refresh Data";
  
  if (success) {
    alert("✅ Data refreshed successfully from GitHub!");
  } else {
    alert("⚠️ Could not refresh data from GitHub. Using cached version or upload CSV manually.");
  }
}