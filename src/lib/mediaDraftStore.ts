const DB_NAME = "app-motoristas-media-drafts";
const STORE_NAME = "drafts";
const RECORD_KEY = "finalize-assets";
const MAX_BYTES = 25 * 1024 * 1024;
const EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

type StoredDraft<T> = { key: string; savedAt: number; expiresAt: number; payload: T };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB indisponível."));
  });
}

export async function loadMediaDraft<T>(): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(RECORD_KEY);
    request.onsuccess = () => {
      const record = request.result as StoredDraft<T> | undefined;
      if (!record || record.expiresAt <= Date.now()) {
        if (record) store.delete(RECORD_KEY);
        resolve(null);
      } else resolve(record.payload);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function saveMediaDraft<T>(payload: T): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const serializedSize = new Blob([JSON.stringify(payload)]).size;
  if (serializedSize > MAX_BYTES) throw new Error("[MEDIA_STORAGE_LIMIT] Rascunhos de mídia excederam 25 MB. Remova fotos antigas.");
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ key: RECORD_KEY, savedAt: Date.now(), expiresAt: Date.now() + EXPIRES_MS, payload } satisfies StoredDraft<T>);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function clearMediaDraft(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
