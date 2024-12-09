// service worker for updating the app

const clientMsg = (msg) => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(msg);
    });
  });
}

/**
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database connection.
 */
const getDB = () => {
  return new Promise((res, rej) => {
    const req = indexedDB.open("void-db", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}


const getRemoteCommit = async () => {
  try {
    const res = await fetch('/api/version');
    const json = await res.json();
    return String(json.commit);
  } catch (e) {}
  return "unknown";
}

/**
 * @returns {Promise<string || null>}
 */
const getLocalCommit = () => {
  return getDB().then((db) => {
    return new Promise((res, rej) => {
      const tx = db.transaction("meta", "readonly");
      const store = tx.objectStore("meta");
      const req = store.get("commit");
      req.onsuccess = () => res(req.result?.value || null);
      req.onerror = () => rej(req.error);
    });
  });
}

/**
 * @param hash {string}
 * @returns {Promise<void>}
 */
const setLocalCommit = (hash) => {
  return getDB().then((db) => {
    return new Promise((res, rej) => {
      const tx = db.transaction("meta", "readwrite");
      const store = tx.objectStore("meta");
      const req = store.put({ key: "commit", value: hash });
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    })
  });
}

const cacheResources = async (resources) => {
  const cache = await caches.open("void-cache");
  await cache.addAll(resources);
}

// const updateCache = async (resources) => {
//
// }

const cachableResources = [
  "/",
  "/index.html",
  "/index.js",
  "/m.html",
  "/m.js",
  "/particles.js",
  "/proxy_sw.js",
  "/pwa.js",
];

const checkAndUpdateCache = async () => {
  console.log("check and update cache");
  try {
    const localCommit = await getLocalCommit();
    const remoteCommit = await getRemoteCommit();

    if (localCommit !== remoteCommit) {
      await cacheResources(cachableResources);
      await setLocalCommit(remoteCommit);
    }

    clientMsg({
      type: "updateRequired"
    });
  } catch (e) {
    console.error("checking for updates failed", e);

  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
      cacheResources(cachableResources)
  );
  console.log("installed");
});

self.addEventListener("activate", (e) => {
  console.log("activating");
  e.waitUntil(Promise.all([
    self.clients.claim(),
    async () => {
      console.log("checkpoint");
      clientMsg({
        type: "status",
        localCommit: await getLocalCommit(),
        remoteCommit: await getRemoteCommit(),
      });
    }
    // checkAndUpdateCache()
  ]));
  console.log("activated");
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.waitUntil(checkAndUpdateCache());
  }
  e.respondWith(
      caches.match(e.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(e.request);
      })
  );
});

self.addEventListener("message", async (e) => {
  console.log("sw recieved message", e.data);
  if (e.data.type === "wakeUp") {
    clientMsg({
      type: "status",
      localCommit: await getLocalCommit(),
      remoteCommit: await getRemoteCommit(),
    });
    await checkAndUpdateCache();
  }
});