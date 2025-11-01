// fingerdata.js - Force reload after sync + robust upload

let allFingerData = [];
let departments = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  console.log("[ATT] Page loaded - initializing...");

  try {
    await autoSync();
  } catch(e) {
    console.warn("[ATT] autoSync error (ignored on load):", e);
  }

  await loadFingerData();

  const csvFingerInput = document.getElementById("csvFinger");
  if (csvFingerInput) {
    csvFingerInput.addEventListener("change", async function (e) {
      const file = e.target.files?.[0];
      if (!file) return;

      document.getElementById("fingerLastUpload").textContent = "Uploading...";
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async function (results) {
          try {
            const rows = (results.data || []).filter(r => Object.keys(r).length);
            console.log("[ATT] CSV parsed rows:", rows.length);
            await replaceStore(ATT_STORE, rows);
            await loadFingerData();
            alert("✅ Attendance data uploaded! " + rows.length + " records.");
          } catch (err) {
            console.error("[ATT] Upload error:", err);
            alert("❌ Upload failed: " + err.message);
          }
        },
        error: function (err) {
          console.error("[ATT] CSV parse error:", err);
          alert("❌ CSV parse error: " + err.message);
        }
      });
    });
  }
});

async function loadFingerData() {
  try {
    allFingerData = await getAll(ATT_STORE);
    const lastUpdate = await getLast(ATT_STORE);

    setText("fingerLastUpload", lastUpdate || "Never");
    setText("totalRecords", allFingerData.length.toString());

    departments.clear();
    allFingerData.forEach(att => {
      if (att.Dept) departments.add(String(att.Dept));
    });
    setText("totalDepts", String(departments.size));

    // Fill department dropdown
    const deptSelect = document.getElementById("filterDept");
    if (deptSelect) {
      const current = deptSelect.value;
      deptSelect.innerHTML = '<option value="">All Departments</option>';
      Array.from(departments).sort().forEach(dep => {
        const opt = document.createElement("option");
        opt.value = dep;
        opt.textContent = dep;
        deptSelect.appendChild(opt);
      });
      if (current && departments.has(current)) deptSelect.value = current;
    }

    displayFinger(allFingerData);
  } catch (err) {
    console.error("[ATT] loadFingerData error:", err);
    alert("❌ Error loading attendance: " + err.message);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "";
}

function displayFinger(rows) {
  const tbl = document.getElementById("fingerResults");
  if (!tbl) return;

  if (!rows || rows.length === 0) {
    tbl.innerHTML = "<tbody><tr><td style='text-align:center; padding:40px; color:#999;'>📭 No attendance data. Refresh or upload CSV.</td></tr></tbody>";
    return;
  }

  const columnOrder = ["Dept", "User ID", "Name", "Enroll ID", "Date", "1", "2", "3", "4"];

  let html = "<thead><tr>";
  columnOrder.forEach(col => html += `<th>${col}</th>`);
  html += "</tr></thead><tbody>";

  rows.forEach(row => {
    html += "<tr>";
    columnOrder.forEach(col => html += `<td>${sanitize(row[col])}</td>`);
    html += "</tr>";
  });

  html += "</tbody>";
  tbl.innerHTML = html;
}

function sanitize(v) {
  if (v === undefined || v === null) return "";
  return String(v);
}

async function searchFinger() {
  const enrollVal = (document.getElementById("searchEnroll")?.value || "").trim().toLowerCase();
  const nameVal   = (document.getElementById("searchName")?.value   || "").trim().toLowerCase();
  const deptVal   = document.getElementById("filterDept")?.value || "";
  const dateVal   = (document.getElementById("searchDate")?.value || "").trim();

  const filtered = allFingerData.filter(row => {
    const matchEnroll = !enrollVal || (row["Enroll ID"] && String(row["Enroll ID"]).toLowerCase().includes(enrollVal));
    const matchName   = !nameVal   || (row.Name && String(row.Name).toLowerCase().includes(nameVal));
    const matchDept   = !deptVal   || (row.Dept && String(row.Dept) === deptVal);

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
    const m = parseInt(parts[0], 10) - 1;
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? null : dt;
}

function showAllFinger() {
  ["searchEnroll","searchName","filterDept","searchDate"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  displayFinger(allFingerData);
}

// NEW: Force Reload After Sync
async function manualSync() {
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "🔄 Syncing...";
  }

  try {
    // 1) Clear existing store to avoid stale data
    const db = await openDB();
    const tx = db.transaction([ATT_STORE, META_STORE], "readwrite");
    await tx.objectStore(ATT_STORE).clear();
    await tx.objectStore(META_STORE).delete(ATT_STORE + "_lastupdate");

    // 2) Sync from GitHub with cache-busting (handled by db.js)
    const success = await autoSync();

    // 3) Wait & reload local data
    await waitMs(400);
    await loadFingerData();

    // 4) Force full reload so WebView breaks any cache layers
    if (success) {
      window.location.replace(window.location.href.split('#')[0] + "?ts=" + Date.now());
      setTimeout(() => location.reload(), 600);
    } else {
      alert("⚠️ Could not fetch updated data. Using local cache.");
    }
  } catch (err) {
    console.error("[ATT] manualSync error:", err);
    alert("❌ Refresh failed: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🔄 Refresh Data";
    }
  }
}

function waitMs(ms) {
  return new Promise(res => setTimeout(res, ms));
}
