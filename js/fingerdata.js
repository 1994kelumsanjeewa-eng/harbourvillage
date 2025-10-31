let allFingerData = [];
let departments = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Finger data page loaded");
  
  // Try auto-sync
  await autoSync();
  
  // Load data
  await loadFingerData();
  
  // Manual CSV upload handler
  const csvFingerInput = document.getElementById("csvFinger");
  if (csvFingerInput) {
    csvFingerInput.addEventListener("change", async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      console.log("Attendance file selected:", file.name);
      document.getElementById("fingerLastUpload").textContent = "Uploading...";
      
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async function(results) {
          console.log("Attendance CSV parsed:", results.data.length, "rows");
          
          if (results.data && results.data.length > 0) {
            await replaceStore(ATT_STORE, results.data);
            await loadFingerData();
            alert("✅ Attendance data uploaded! " + results.data.length + " records loaded.");
          } else {
            alert("⚠️ No data found in CSV file!");
          }
        },
        error: function(err) {
          console.error("CSV Parse error:", err);
          alert("❌ Error parsing CSV: " + err.message);
        }
      });
    });
  }
});

async function loadFingerData() {
  console.log("Loading attendance data...");
  allFingerData = await getAll(ATT_STORE);
  console.log("Loaded", allFingerData.length, "attendance records");
  
  const lastUpdate = await getLast(ATT_STORE);
  document.getElementById("fingerLastUpload").textContent = lastUpdate;
  
  // Update stats
  document.getElementById("totalRecords").textContent = allFingerData.length;
  
  // Extract departments
  departments.clear();
  allFingerData.forEach(att => {
    if (att.Dept) departments.add(att.Dept);
  });
  document.getElementById("totalDepts").textContent = departments.size;
  
  // Populate department dropdown
  const deptSelect = document.getElementById("filterDept");
  if (deptSelect) {
    deptSelect.innerHTML = '<option value="">All Departments</option>';
    Array.from(departments).sort().forEach(dept => {
      deptSelect.innerHTML += `<option value="${dept}">${dept}</option>`;
    });
  }
  
  displayFinger(allFingerData);
}

function displayFinger(rows) {
  const tbl = document.getElementById("fingerResults");
  
  if (!rows || rows.length === 0) {
    tbl.innerHTML = "<tbody><tr><td colspan='9' style='text-align:center; padding:40px; color:#999;'>📭 No attendance data. Please upload CSV file.</td></tr></tbody>";
    return;
  }
  
  const columnOrder = ["Dept", "User ID", "Name", "Enroll ID", "Date", "1", "2", "3", "4"];
  
  let html = "<thead><tr>";
  columnOrder.forEach(col => {
    html += `<th>${col}</th>`;
  });
  html += "</tr></thead><tbody>";
  
  rows.forEach(row => {
    html += "<tr>";
    columnOrder.forEach(col => {
      let value = row[col];
      html += `<td>${value !== undefined && value !== null ? value : ""}</td>`;
    });
    html += "</tr>";
  });
  
  html += "</tbody>";
  tbl.innerHTML = html;
}

async function searchFinger() {
  const enrollVal = document.getElementById("searchEnroll").value.trim().toLowerCase();
  const nameVal = document.getElementById("searchName").value.trim().toLowerCase();
  const deptVal = document.getElementById("filterDept").value;
  const dateVal = document.getElementById("searchDate").value;
  
  const filtered = allFingerData.filter(row => {
    const matchEnroll = !enrollVal || (row["Enroll ID"] && String(row["Enroll ID"]).toLowerCase().includes(enrollVal));
    const matchName = !nameVal || (row.Name && String(row.Name).toLowerCase().includes(nameVal));
    const matchDept = !deptVal || (row.Dept === deptVal);
    
    let matchDate = true;
    if (dateVal && row.Date) {
      const searchDate = new Date(dateVal);
      const rowDate = parseDate(row.Date);
      matchDate = rowDate && (rowDate.toDateString() === searchDate.toDateString());
    }
    
    return matchEnroll && matchName && matchDept && matchDate;
  });
  
  displayFinger(filtered);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split(/[\/\-]/);
  if (parts.length === 3) {
    const month = parseInt(parts[0]) - 1;
    const day = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

function showAllFinger() {
  document.getElementById("searchEnroll").value = "";
  document.getElementById("searchName").value = "";
  document.getElementById("filterDept").value = "";
  document.getElementById("searchDate").value = "";
  displayFinger(allFingerData);
}

async function manualSync() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = "🔄 Syncing...";
  
  const success = await autoSync();
  await loadFingerData();
  
  btn.disabled = false;
  btn.textContent = "🔄 Refresh Data";
  
  if (success) {
    alert("✅ Attendance data refreshed from GitHub!");
  } else {
    alert("⚠️ Could not refresh from GitHub. Using cached version.");
  }
}