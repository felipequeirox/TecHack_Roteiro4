const tabData = {};

function getRootDomain(hostname) {
  if (!hostname) return "";

  const parts = hostname.split(".");
  const lastTwo = parts.slice(-2).join(".");
  const twoPartSuffixes = ["com.br", "org.br", "net.br", "gov.br", "co.uk", "com.au"];

  if (twoPartSuffixes.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

function isThirdParty(requestUrl, pageUrl) {
  try {
    const requestDomain = getRootDomain(new URL(requestUrl).hostname);
    const pageDomain = getRootDomain(new URL(pageUrl).hostname);

    return requestDomain !== pageDomain && requestDomain !== "";
  } catch (e) {
    return false;
  }
}

function isFirstPartyOrigin(origin, pageUrl) {
  try {
    const originDomain = getRootDomain(new URL(origin).hostname);
    const pageDomain = getRootDomain(new URL(pageUrl).hostname);
    return originDomain === pageDomain;
  } catch (e) {
    return false;
  }
}

function initTab(tabId, url) {
  tabData[tabId] = {
    url: url,
    thirdParties: [],
    cookies: [],
    supercookies: [],
    storage: [],
    fingerprinting: [],
    hijacking: []
  };
}

function uniqueCount(items, keyFn) {
  return new Set((items || []).map(keyFn)).size;
}

function computePrivacyScore(data) {
  const thirdParties   = data.thirdParties || [];
  const cookies        = data.cookies || [];
  const supercookies   = data.supercookies || [];
  const storage        = data.storage || [];
  const fingerprinting = data.fingerprinting || [];
  const hijacking      = data.hijacking || [];

  let risk = 0;
  const breakdown = {};

  // 1) Third-parties
  const thirdDomains = uniqueCount(thirdParties, item => item.domain);
  const thirdScripts  = thirdParties.filter(item => item.type === "script").length;
  const thirdFrames   = thirdParties.filter(item => item.type === "sub_frame").length;

  breakdown.thirdParties = Math.min(25, thirdDomains * 3 + thirdScripts * 1 + thirdFrames * 2);
  risk += breakdown.thirdParties;

  // 2) Cookies / supercookies
  const thirdPartyCookies = cookies.filter(c => !c.firstParty).length;
  const persistentCookies = cookies.filter(c => !c.session).length;

  breakdown.cookies = Math.min(
    15,
    thirdPartyCookies * 1.5 + persistentCookies * 0.5 + supercookies.length * 4
  );
  risk += breakdown.cookies;

  // 3) Storage
  const storageOrigins = storage.length;
  let storageItems = 0;

  storage.forEach(s => {
    storageItems += (s.localStorage || []).length;
    storageItems += (s.sessionStorage || []).length;
    storageItems += (s.indexedDB || []).length;
  });

  breakdown.storage = Math.min(15, storageOrigins * 2 + storageItems * 0.25);
  risk += breakdown.storage;

  // 4) Fingerprinting
  const fpApis = new Set(fingerprinting.map(f => f.api));
  const hasCanvas = fpApis.has("Canvas");
  const hasWebGL  = fpApis.has("WebGL") || fpApis.has("WebGL2");
  const hasAudio  = fpApis.has("AudioContext") || fpApis.has("OfflineAudioContext");
  const hasDebug  = fingerprinting.some(f => f.debugRenderer);

  breakdown.fingerprinting = Math.min(
    35,
    (hasCanvas ? 10 : 0) +
    (hasWebGL  ? 12 : 0) +
    (hasAudio  ? 10 : 0) +
    (hasDebug  ? 3  : 0) +
    Math.min(5, Math.floor(Math.max(0, fingerprinting.length - 3) / 2))
  );
  risk += breakdown.fingerprinting;

  // 5) Hijacking / hooking
  const externalScripts = hijacking.filter(h => h.type === "external_script").length;
  const redirects       = hijacking.filter(h => h.type === "redirect").length;
  const hookings        = hijacking.filter(h => h.type === "hooking" || h.type === "tamper").length;

  breakdown.hijacking = Math.min(10, externalScripts * 1 + redirects * 2 + hookings * 4);
  risk += breakdown.hijacking;

  const score = Math.max(0, Math.round(100 - risk));

  let label = "Bom";
  if (score < 40) label = "Crítico";
  else if (score < 60) label = "Ruim";
  else if (score < 80) label = "Moderado";

  return {
    score,
    label,
    risk: Math.round(risk),
    breakdown
  };
}

function classifyCookies(cookies, pageUrl) {
  let pageDomain;

  try {
    pageDomain = getRootDomain(new URL(pageUrl).hostname);
  } catch (e) {
    return [];
  }

  return cookies.map(function (cookie) {
    const cookieDomain = getRootDomain(cookie.domain.replace(/^\./, ""));
    const isFirstParty = cookieDomain === pageDomain;
    const isSession = !cookie.expirationDate;
    const expiresDate = cookie.expirationDate
      ? new Date(cookie.expirationDate * 1000).toLocaleDateString("pt-BR")
      : "sessão";

    return {
      name: cookie.name,
      domain: cookie.domain,
      firstParty: isFirstParty,
      session: isSession,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      size: cookie.name.length + (cookie.value ? cookie.value.length : 0),
      expires: expiresDate
    };
  });
}

function scanCookies(tabId) {
  const tab = tabData[tabId];
  if (!tab || !tab.url) return;

  browser.cookies.getAll({ url: tab.url }).then(function (cookies) {
    tabData[tabId].cookies = classifyCookies(cookies, tab.url);
  }).catch(function () {});
}

function addHijacking(tabId, item) {
  if (!tabData[tabId]) return;
  tabData[tabId].hijacking = tabData[tabId].hijacking || [];
  tabData[tabId].hijacking.push(item);
}

browser.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (!tab.url) return;

  const isHttp = tab.url.startsWith("http://") || tab.url.startsWith("https://");
  if (!isHttp) return;

  if (changeInfo.status === "loading") {
    initTab(tabId, tab.url);
  }

  if (changeInfo.status === "complete") {
    scanCookies(tabId);
  }
});

browser.tabs.onRemoved.addListener(function (tabId) {
  delete tabData[tabId];
});

browser.webRequest.onBeforeRequest.addListener(
  function (details) {
    const tabId = details.tabId;

    if (tabId < 0) return;
    if (details.type === "main_frame") return;
    if (!tabData[tabId]) return;

    const pageUrl = tabData[tabId].url;
    if (!isThirdParty(details.url, pageUrl)) return;

    let requestDomain;
    try {
      requestDomain = new URL(details.url).hostname;
    } catch (e) {
      return;
    }

    const existing = tabData[tabId].thirdParties.find(function (tp) {
      return tp.domain === requestDomain && tp.type === details.type;
    });

    if (existing) {
      existing.count++;
    } else {
      tabData[tabId].thirdParties.push({
        domain: requestDomain,
        type: details.type,
        url: details.url,
        count: 1
      });
    }

    if (details.type === "script") {
      addHijacking(tabId, {
        type: "external_script",
        domain: requestDomain,
        url: details.url
      });
    }
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onBeforeRedirect.addListener(
  function (details) {
    const tabId = details.tabId;

    if (tabId < 0) return;
    if (!tabData[tabId]) return;

    const pageUrl = tabData[tabId].url;
    if (!isThirdParty(details.url, pageUrl) && !isThirdParty(details.redirectUrl || "", pageUrl)) {
      return;
    }

    addHijacking(tabId, {
      type: "redirect",
      from: details.url || "",
      to: details.redirectUrl || "",
      statusCode: details.statusCode || 0
    });
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onHeadersReceived.addListener(
  function (details) {
    const tabId = details.tabId;

    if (tabId < 0) return;
    if (!tabData[tabId]) return;

    const pageUrl = tabData[tabId].url;
    if (!isThirdParty(details.url, pageUrl)) return;

    let requestDomain;
    try {
      requestDomain = new URL(details.url).hostname;
    } catch (e) {
      return;
    }

    const headers = details.responseHeaders || [];
    const hasHSTS = headers.some(function (h) {
      return h.name.toLowerCase() === "strict-transport-security";
    });
    const hasEtag = headers.some(function (h) {
      return h.name.toLowerCase() === "etag";
    });

    if (!hasHSTS && !hasEtag) return;

    const alreadyDetected = tabData[tabId].supercookies.find(function (s) {
      return s.domain === requestDomain;
    });

    if (!alreadyDetected) {
      tabData[tabId].supercookies.push({
        domain: requestDomain,
        hsts: hasHSTS,
        etag: hasEtag
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "GET_DATA") {
    const data = tabData[message.tabId] || {
      url: "",
      thirdParties: [],
      cookies: [],
      supercookies: [],
      storage: [],
      fingerprinting: [],
      hijacking: []
    };

    const privacyScore = computePrivacyScore(data);

    sendResponse({
      url: data.url,
      thirdParties: data.thirdParties,
      cookies: data.cookies,
      supercookies: data.supercookies,
      storage: data.storage,
      fingerprinting: data.fingerprinting,
      hijacking: data.hijacking || [],
      privacyScore: privacyScore
    });

    return;
  }

  if (message.type === "STORAGE_DATA") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null || !tabData[tabId]) return;

    const frameId = sender.frameId != null ? sender.frameId : 0;

    tabData[tabId].storage = tabData[tabId].storage.filter(function (s) {
      return !(s.origin === message.origin && s.frameId === frameId);
    });

    tabData[tabId].storage.push({
      origin: message.origin,
      frameUrl: message.frameUrl,
      frameId: frameId,
      isFirstParty: isFirstPartyOrigin(message.origin, tabData[tabId].url),
      localStorage: message.localStorage || [],
      sessionStorage: message.sessionStorage || [],
      indexedDB: message.indexedDB || []
    });
    return;
  }

  if (message.type === "FINGERPRINT_EVENT") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null || !tabData[tabId]) return;

    const fp = tabData[tabId].fingerprinting;

    const existing = fp.find(function (f) {
      return f.origin === message.origin &&
        f.api === message.api &&
        f.method === message.method;
    });

    if (existing) {
      existing.count++;
      if (message.extra && message.extra.debugRenderer) {
        existing.debugRenderer = true;
      }
    } else {
      fp.push({
        origin: message.origin,
        isFirstParty: isFirstPartyOrigin(message.origin, tabData[tabId].url),
        api: message.api,
        method: message.method,
        count: 1,
        stack: message.stack || "",
        debugRenderer: !!(message.extra && message.extra.debugRenderer),
        firstSeen: Date.now()
      });
    }
  }
});