/**
 * db.js — IndexedDB wrapper for image persistence
 * Stores images as base64 data URLs keyed by a unique slot ID.
 */

const DB_NAME    = 'bingo-generator-db';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let dbInstance = null;

/** Open (or create) the IndexedDB database */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    req.onerror = () => reject(req.error);
  });
}

/** Save or update an image record { id, dataUrl, order } */
export async function saveImage(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Delete an image record by id */
export async function deleteImage(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** Load all image records, sorted by order */
export async function loadAllImages() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      records.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Clear all images from the store */
export async function clearAllImages() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
