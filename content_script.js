(function () {
  "use strict";

  function getStorageEntries(storage) {
    const entries = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const key   = storage.key(i);
        const value = storage.getItem(key) || "";
        entries.push({
          key:     key,
          size:    key.length + value.length,
          preview: value.length > 60 ? value.substring(0, 60) + "…" : value
        });
      }
    } catch (e) {

    }
    return entries;
  }

  async function getIndexedDBList() {
    try {
      if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
        const dbs = await indexedDB.databases();
        return dbs
          .filter(db => db && db.name)
          .map(db => ({ name: db.name, version: db.version }));
      }
    } catch (e) {}
    return [];
  }

  async function reportStorage() {
    const indexedDBList = await getIndexedDBList();

    try {
      await browser.runtime.sendMessage({
        type:           "STORAGE_DATA",
        origin:         window.location.origin,
        frameUrl:       window.location.href,
        localStorage:   getStorageEntries(window.localStorage),
        sessionStorage: getStorageEntries(window.sessionStorage),
        indexedDB:      indexedDBList
      });
    } catch (e) {

    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reportStorage);
  } else {
    reportStorage();
  }

  window.addEventListener("load", function () {
    reportStorage();
    setTimeout(reportStorage, 2000);
  });

  window.addEventListener("storage", reportStorage);
})();

(function injectFingerprintHooks() {
  try {
    const url = browser.runtime.getURL("injected.js");
    fetch(url)
      .then(r => r.text())
      .then(code => {
        const script = document.createElement("script");
        script.textContent = code;
        (document.head || document.documentElement).prepend(script);
        script.remove();
      })
      .catch(() => {});
  } catch (e) {}
})();

window.addEventListener("message", function (event) {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.__privacyMonitor !== true) return;

  browser.runtime.sendMessage({
    type:     "FINGERPRINT_EVENT",
    origin:   window.location.origin,
    frameUrl: window.location.href,
    api:      data.api,
    method:   data.method,
    extra:    data.extra,
    stack:    data.stack
  }).catch(() => {});
});