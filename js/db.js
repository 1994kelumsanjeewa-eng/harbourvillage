const DB_NAME = "EmployeeAppDB";
const VERSION = 1;
const EMP_STORE = "employees";
const ATT_STORE = "attendance";
const META_STORE = "meta";

// ⚠️ IMPORTANT: Change this to your GitHub username and repo name
const GITHUB_USERNAME = "1994kelumsanjeewa-eng";  // Change this!
const REPO_NAME = "HV-Data";          // Change this!
const GITHUB_BASE = `https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/data/`;
const EMPLOYEES_CSV_URL = GITHUB_BASE + "employees.csv";
const ATTENDANCE_CSV_URL = GITHUB_BASE + "attendance.csv";

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    
    req.onupgradeneeded = function(event) {
      let db = event.target.result;
      
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(EMP_STORE)) {
        db.createObjectStore(EMP_STORE, {keyPath: "Reg. NO", autoIncrement: false});
      }
      if (!db.objectStoreNames.contains(ATT_STORE)) {
        db.createObjectStore(ATT_STORE, {autoIncrement: true});
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Replace all data in a store
async function replaceStore(store, data) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([store, META_STORE], "readwrite");
    
    // Clear old data
    tx.objectStore(store).clear();
    
    // Add new data
    data.forEach(d => {
      try {
        tx.objectStore(store).add(d);
      } catch(e) {
        console.log("Skip invalid row", d);
      }
    });
    
    // Update timestamp
    tx.objectStore(META_STORE).put(new Date().toLocaleString(), store + "_lastupdate");
    
    tx.oncomplete = resolve;
    tx.onerror = (e) => console.error("Transaction error:", e);
  });
}

// Get all data from a store
async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });
}

// Get last update timestamp
async function getLast(store) {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = db.transaction(META_STORE, "readonly").objectStore(META_STORE).get(store + "_lastupdate");
    req.onsuccess = () => resolve(req.result || "Never");
    req.onerror = () => resolve("Never");
  });
}

// Sync data from GitHub CSV
async function syncFromGitHub(csvUrl, storeName) {
  try {
    console.log("🔄 Syncing from:", csvUrl);
    
    // Fetch CSV with cache-busting
    const response = await fetch(csvUrl + "?t=" + Date.now());
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV using PapaParse
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async function(results) {
          if (results.data && results.data.length > 0) {
            await replaceStore(storeName, results.data);
            console.log("✅ Synced:", storeName, "-", results.data.length, "records");
            resolve(true);
          } else {
            console.log("⚠️ No data found in CSV");
            resolve(false);
          }
        },
        error: function(err) {
          console.error("❌ CSV Parse error:", err);
          resolve(false);
        }
      });
    });
  } catch(error) {
    console.error("❌ Sync error:", error);
    return false;
  }
}

// Auto-sync both datasets
async function autoSync() {
  if (!navigator.onLine) {
    console.log("📴 Offline - using cached data");
    return false;
  }
  
  console.log("🌐 Online - syncing data...");
  
  try {
    const empSuccess = await syncFromGitHub(EMPLOYEES_CSV_URL, EMP_STORE);
    const attSuccess = await syncFromGitHub(ATTENDANCE_CSV_URL, ATT_STORE);
    
    if (empSuccess || attSuccess) {
      console.log("✅ Auto-sync completed");
      return true;
    } else {
      console.log("⚠️ No updates available");
      return false;
    }
  } catch(error) {
    console.error("❌ Auto-sync failed:", error);
    return false;
  }
}
