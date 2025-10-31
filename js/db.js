const DB_NAME = "EmployeeAppDB";
const VERSION = 1;
const EMP_STORE = "employees";
const ATT_STORE = "attendance";
const META_STORE = "meta";

const GITHUB_USERNAME = "1994keumsanjeewa-eng";  // ඔබගේ username
const REPO_NAME = "HV-Data";

const GITHUB_BASE = `https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/data/`;
const EMPLOYEES_CSV_URL = GITHUB_BASE + "employees.csv";
const ATTENDANCE_CSV_URL = GITHUB_BASE + "attendance.csv";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = function(event) {
      let db = event.target.result;
      if (!db.objectStoreNames.contains(EMP_STORE)) 
        db.createObjectStore(EMP_STORE, {autoIncrement: true});
      if (!db.objectStoreNames.contains(ATT_STORE)) 
        db.createObjectStore(ATT_STORE, {autoIncrement: true});
      if (!db.objectStoreNames.contains(META_STORE)) 
        db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function replaceStore(store, data) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([store, META_STORE], "readwrite");
    tx.objectStore(store).clear();
    data.forEach(d => {
      try { tx.objectStore(store).add(d); } 
      catch(e) { console.log("Skip row", d); }
    });
    tx.objectStore(META_STORE).put(new Date().toLocaleString(), store + "_lastupdate");
    tx.oncomplete = resolve;
  });
}

async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });
}

async function getLast(store) {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = db.transaction(META_STORE, "readonly").objectStore(META_STORE).get(store + "_lastupdate");
    req.onsuccess = () => resolve(req.result || "Never");
  });
}

async function syncFromGitHub(csvUrl, storeName) {
  try {
    const response = await fetch(csvUrl + "?t=" + Date.now());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async function(results) {
          if (results.data && results.data.length > 0) {
            await replaceStore(storeName, results.data);
            resolve(true);
          } else resolve(false);
        },
        error: () => resolve(false)
      });
    });
  } catch(error) {
    console.error("Sync error:", error);
    return false;
  }
}

async function autoSync() {
  if (!navigator.onLine) return false;
  try {
    await syncFromGitHub(EMPLOYEES_CSV_URL, EMP_STORE);
    await syncFromGitHub(ATTENDANCE_CSV_URL, ATT_STORE);
    return true;
  } catch(error) {
    return false;
  }
}
