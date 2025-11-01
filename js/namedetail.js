// namedetail.js - Force reload after sync + robust upload

let allData = [];
let categories = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  console.log("[EMP] Page loaded - initializing...");

  // Initial auto-sync (will silently fail if offline)
  try {
    await autoSync();
  } catch(e) {
    console.warn("[EMP] autoSync error (ignored on load):", e);
  }

  // Load local data into UI
  await loadData();

  // Manual CSV upload
  const csvFileInput = document.getElementById("csvFile");
  if (csvFileInput) {
    csvFileInput.addEventListener("change", async function (e) {
      const file = e.target.files?.[0];
      if (!file) return;

      document.getElementById("lastUpload").textContent = "Uploading...";
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async function (results) {
          try {
            const rows = (results.data || []).filter(r => Object.keys(r).length);
            console.log("[EMP] CSV parsed rows:", rows.length);
            await replaceStore(EMP_STORE, rows);
            await loadData();
            alert("✅ Data uploaded successfully! " + rows.length + " records.");
          } catch (err) {
            console.error("[EMP] Upload error:", err);
            alert("❌ Upload failed: " + err.message);
          }
        },
        error: function (err) {
          console.error("[EMP] CSV parse error:", err);
          alert("❌ CSV parse error: " + err.message);
        }
      });
    });
  }
});

async function loadData() {
  try {
    allData = await getAll(EMP_STORE);
    const lastUpdate = await getLast(EMP_STORE);

    // Stats
    setText("lastUpload", lastUpdate || "Never");
    setText("totalEmployees", allData.length.toString());

    // Categories
    categories.clear();
    allData.forEach(emp => {
      if (emp.CATEGORY) categories.add(String(emp.CATEGORY));
    });
    setText("totalCategories", String(categories.size));

    // Fill category dropdown
    const categorySelect = document.getElementById("filterCategory");
    if (categorySelect) {
      const current = categorySelect.value;
      categorySelect.innerHTML = '<option value="">All Categories</option>';
      Array.from(categories).sort().forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
      });
      // keep previous selection if still exists
      if (current && categories.has(current)) categorySelect.value = current;
    }

    display(allData);
  } catch (err) {
    console.error("[EMP] loadData error:", err);
    alert("❌ Error loading data: " + err.message);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "";
}

function display(rows) {
  const tbl = document.getElementById("results");
  if (!tbl) return;

  if (!rows || rows.length === 0) {
    tbl.innerHTML = "<tbody><tr><td style='text-align:center; padding:40px; color:#999;'>📭 No data. Refresh or upload a CSV.</td></tr></tbody>";
    return;
  }

  // Expected order as per your CSV
  const columnOrder = ["No", "Reg. NO", "CATEGORY", "RP NO", "Name"];

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

async function searchData() {
  const nameVal = (document.getElementById("searchName")?.value || "").trim().toLowerCase();
  const regVal  = (document.getElementById("searchReg")?.value  || "").trim().toLowerCase();
  const rpVal   = (document.getElementById("searchRP")?.value   || "").trim().toLowerCase();
  const categoryVal = document.getElementById("filterCategory")?.value || "";

  const filtered = allData.filter(row => {
    const matchName = !nameVal || (row.Name && String(row.Name).toLowerCase().includes(nameVal));
    const matchReg  = !regVal  || (row["Reg. NO"] && String(row["Reg. NO"]).toLowerCase().includes(regVal));
    const matchRP   = !rpVal   || (row["RP NO"] && String(row["RP NO"]).toLowerCase().includes(rpVal));
    const matchCat  = !categoryVal || (row.CATEGORY && String(row.CATEGORY) === categoryVal);
    return matchName && matchReg && matchRP && matchCat;
  });

  display(filtered);
}

function showAll() {
  const ids = ["searchName","searchReg","searchRP","filterCategory"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  display(allData);
}

function exportCSV() {
  if (!allData || allData.length === 0) {
    alert("⚠️ No data to export");
    return;
  }
  const csv = Papa.unparse(allData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employees_" + new Date().toISOString().split('T')[0] + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

// NEW: Force Reload After Sync
async function manualSync() {
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "🔄 Syncing...";
  }

  try {
    // 1) Clear existing local store to avoid stale merge
    const db = await openDB();
    const tx = db.transaction([EMP_STORE, META_STORE], "readwrite");
    await tx.objectStore(EMP_STORE).clear();
    await tx.objectStore(META_STORE).delete(EMP_STORE + "_lastupdate");

    // 2) Sync fresh data from GitHub (db.js handles cache-busting)
    const success = await autoSync();

    // 3) Small wait to ensure IDB transactions settle
    await waitMs(400);

    // 4) Reload UI from IDB
    await loadData();

    // 5) Force full page reload in WebView/APK to break old caches
    if (success) {
      // First try to bypass SW/browser cache if any
      window.location.replace(window.location.href.split('#')[0] + "?ts=" + Date.now());
      // As a fallback:
      setTimeout(() => location.reload(), 600);
    } else {
      alert("⚠️ Could not fetch updated data (check internet). Showing local data.");
    }
  } catch (err) {
    console.error("[EMP] manualSync error:", err);
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
