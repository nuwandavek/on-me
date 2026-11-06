let database;

export function openDb() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('clothes-but-me', 2);
    request.onupgradeneeded = () => {
      for (const name of ['generations', 'references', 'ledger', 'jobs']) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close();database = null; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
  return database;
}

async function transaction(storeNames, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage operation was interrupted.'));
    result = work(tx);
  });
}

export const getAll = name => transaction([name], 'readonly', tx => tx.objectStore(name).getAll());
export const get = (name, id) => transaction([name], 'readonly', tx => tx.objectStore(name).get(id));
export const put = (name, value) => transaction([name], 'readwrite', tx => tx.objectStore(name).put(value));
export const remove = (name, id) => transaction([name], 'readwrite', tx => tx.objectStore(name).delete(id));

export function updateGeneration(record) {
  return transaction(['generations'],'readwrite',tx => {
    const store = tx.objectStore('generations');
    const request = store.get(record.id);
    request.onsuccess = () => { if (request.result) store.put(record); };
    return request;
  });
}

// Read and update in one transaction so liking cannot overwrite a newer record.
export async function toggleLike(id) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(['generations'],'readwrite');
    const store = tx.objectStore('generations');
    const request = store.get(id);
    let result;
    request.onsuccess = () => {
      const record = request.result;
      if (!record || record.status !== 'completed') { tx.abort();return; }
      record.liked = !record.liked;
      record.likedAt = record.liked ? Date.now() : null;
      store.put(record);
      result = { id:record.id, liked:record.liked };
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('This try-on is no longer available.'));
  });
}

export function finishGeneration(record, ledgerEntry) {
  return transaction(['generations', 'ledger', 'jobs'], 'readwrite', tx => {
    const store = tx.objectStore('generations');
    const existing = store.get(record.id);
    // A user may delete a pending preview while the API is running. Keep its
    // billing entry, but do not bring the deleted images back into history.
    existing.onsuccess = () => { if (existing.result) store.put(record); };
    if (ledgerEntry) tx.objectStore('ledger').put(ledgerEntry);
    tx.objectStore('jobs').delete(record.id);
  });
}

export function enqueueGeneration(record,job) {
  return transaction(['generations','jobs'],'readwrite',tx => {
    tx.objectStore('generations').put(record);
    tx.objectStore('jobs').put(job);
  });
}
