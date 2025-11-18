// db.js

const DB_NAME = 'PatientDB';
const DB_VERSION = 2;
const PATIENT_STORE = 'patients';
const VISIT_STORE = 'visits';
const USER_STORE = 'users';
const SETTINGS_STORE = 'settings';

let db;

function openDb() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject('Database error: ' + event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(PATIENT_STORE)) {
                const patientStore = db.createObjectStore(PATIENT_STORE, { keyPath: 'id', autoIncrement: true });
                patientStore.createIndex('registrationNumber', 'registrationNumber', { unique: true });
            }
            if (!db.objectStoreNames.contains(VISIT_STORE)) {
                const visitStore = db.createObjectStore(VISIT_STORE, { keyPath: 'id', autoIncrement: true });
                visitStore.createIndex('patientId', 'patientId', { unique: false });
            }
            if (!db.objectStoreNames.contains(USER_STORE)) {
                const userStore = db.createObjectStore(USER_STORE, { keyPath: 'id', autoIncrement: true });
                userStore.createIndex('username', 'username', { unique: true });
            }
            if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                // Simple key-value store
                db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
    });
}

function addPatient(patient) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([PATIENT_STORE], 'readwrite');
            const store = transaction.objectStore(PATIENT_STORE);
            const request = store.add(patient);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error adding patient: ' + event.target.error);
        });
    });
}

function getPatientById(id) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([PATIENT_STORE], 'readonly');
            const store = transaction.objectStore(PATIENT_STORE);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error getting patient: ' + event.target.error);
        });
    });
}

function updatePatient(patient) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([PATIENT_STORE], 'readwrite');
            const store = transaction.objectStore(PATIENT_STORE);
            const request = store.put(patient); // .put() updates if key exists, adds if not.

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error updating patient: ' + event.target.error);
        });
    });
}

// --- User Management Functions ---

function addUser(user) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([USER_STORE], 'readwrite');
            const store = transaction.objectStore(USER_STORE);
            const request = store.add(user);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error adding user: ' + event.target.error);
        });
    });
}

function deleteUser(userId) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([USER_STORE], 'readwrite');
            const store = transaction.objectStore(USER_STORE);
            // Can't delete the admin user with ID 1 for safety
            if (userId === 1) return reject('Cannot delete the primary admin user.');
            const request = store.delete(userId);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error deleting user: ' + event.target.error);
        });
    });
}

function getAllUsers() {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([USER_STORE], 'readonly');
            const store = transaction.objectStore(USER_STORE);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error getting users: ' + event.target.error);
        });
    });
}

function authenticateUser(username, password) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([USER_STORE], 'readonly');
            const store = transaction.objectStore(USER_STORE);
            const index = store.index('username');
            const request = index.get(username);

            request.onsuccess = () => {
                const user = request.result;
                if (user && user.password === password) {
                    resolve(user);
                } else {
                    resolve(null); // Authentication failed
                }
            };
            request.onerror = (event) => reject('Error authenticating user: ' + event.target.error);
        });
    });
}

async function ensureAdminExists() {
    const users = await getAllUsers();
    const adminExists = users.some(u => u.role === 'admin');
    if (!adminExists) {
        console.log('No admin found. Creating default admin user (admin/admin)...');
        await addUser({ username: 'admin', password: 'admin', role: 'admin' });
    }
}

// --- Settings Functions ---

function saveSetting(key, value) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([SETTINGS_STORE], 'readwrite');
            const store = transaction.objectStore(SETTINGS_STORE);
            const request = store.put({ key, value });

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error saving setting: ' + event.target.error);
        });
    });
}

function getSetting(key) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([SETTINGS_STORE], 'readonly');
            const store = transaction.objectStore(SETTINGS_STORE);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = (event) => reject('Error getting setting: ' + event.target.error);
        });
    });
}

// --- Data Portability Functions ---

function exportAllData() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDb();
            const exportObject = {};
            const storeNames = Array.from(db.objectStoreNames);

            const transaction = db.transaction(storeNames, 'readonly');
            
            for (const storeName of storeNames) {
                const store = transaction.objectStore(storeName);
                const data = await new Promise((res, rej) => {
                    const request = store.getAll();
                    request.onsuccess = () => res(request.result);
                    request.onerror = () => rej(request.error);
                });
                exportObject[storeName] = data;
            }
            resolve(exportObject);
        } catch (error) {
            reject(error);
        }
    });
}

function importAllData(data) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDb();
            const storeNames = Array.from(db.objectStoreNames);
            const transaction = db.transaction(storeNames, 'readwrite');

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);

            for (const storeName of storeNames) {
                const store = transaction.objectStore(storeName);
                // Clear existing data in the store
                store.clear();
                // Add new data if it exists in the import file
                if (data[storeName]) {
                    data[storeName].forEach(item => {
                        // The 'users' store has a unique index on username.
                        // If we re-insert an admin with the same username but a different auto-incremented ID,
                        // it can cause issues. We'll skip adding users with existing usernames.
                        // A more robust solution might involve updating records.
                        // For now, we just add. The clear() above handles duplicates from the same file.
                        store.add(item);
                    });
                }
            }
        } catch (error) {
            reject(error);
        }
    });
}

function getAllPatients() {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([PATIENT_STORE], 'readonly');
            const store = transaction.objectStore(PATIENT_STORE);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error getting patients: ' + event.target.error);
        });
    });
}

function addVisit(visit) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([VISIT_STORE], 'readwrite');
            const store = transaction.objectStore(VISIT_STORE);
            const request = store.add(visit);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error adding visit: ' + event.target.error);
        });
    });
}

function getVisitsForPatient(patientId) {
    return new Promise((resolve, reject) => {
        openDb().then(db => {
            const transaction = db.transaction([VISIT_STORE], 'readonly');
            const store = transaction.objectStore(VISIT_STORE);
            const index = store.index('patientId');
            const request = index.getAll(patientId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error getting visits: ' + event.target.error);
        });
    });
}
