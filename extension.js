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
    const pageDomain    = getRootDomain(new URL(pageUrl).hostname);
    
    return requestDomain !== pageDomain && requestDomain !== "";
  } catch (e) {
    return false;
  }
}

function initTab(tabId, url) {
  tabData[tabId] = {
    url:          url,
    thirdParties: [],
    cookies:      [],
    supercookies: []
  };
}

function classifyCookies(cookies, pageUrl) {
  let pageDomain;
  
  try {
    pageDomain = getRootDomain(new URL(pageUrl).hostname);
  } catch (e) {
    return [];
  }

  return cookies.map(function(cookie) {
    const cookieDomain = getRootDomain(cookie.domain.replace(/^\./, ""));
    const isFirstParty = cookieDomain === pageDomain;
    const isSession    = !cookie.expirationDate;
    const expiresDate  = cookie.expirationDate
      ? new Date(cookie.expirationDate * 1000).toLocaleDateString("pt-BR")
      : "sessão";

    return {
      name:       cookie.name,
      domain:     cookie.domain,
      firstParty: isFirstParty,
      session:    isSession,
      secure:     cookie.secure,
      httpOnly:   cookie.httpOnly,
      sameSite:   cookie.sameSite,
      size:       cookie.name.length + (cookie.value ? cookie.value.length : 0),
      expires:    expiresDate
    };
  });
}

function scanCookies(tabId) {
  const tab = tabData[tabId];
  if (!tab || !tab.url) return;

  browser.cookies.getAll({ url: tab.url }).then(function(cookies) {
    tabData[tabId].cookies = classifyCookies(cookies, tab.url);
  }).catch(function() {});
}

browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
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

browser.tabs.onRemoved.addListener(function(tabId) {
  delete tabData[tabId];
});

browser.webRequest.onBeforeRequest.addListener(
  function(details) {
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

    const existing = tabData[tabId].thirdParties.find(function(tp) {
      return tp.domain === requestDomain && tp.type === details.type;
    });

    if (existing) {
      existing.count++;
    } else {
      tabData[tabId].thirdParties.push({
        domain: requestDomain,
        type:   details.type,
        url:    details.url,
        count:  1
      });
    }
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onHeadersReceived.addListener(
  function(details) {
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

    const headers  = details.responseHeaders || [];
    const hasHSTS  = headers.some(function(h) { return h.name.toLowerCase() === "strict-transport-security"; });
    const hasEtag  = headers.some(function(h) { return h.name.toLowerCase() === "etag"; });

    if (!hasHSTS && !hasEtag) return;

    const alreadyDetected = tabData[tabId].supercookies.find(function(s) {
      return s.domain === requestDomain;
    });

    if (!alreadyDetected) {
      tabData[tabId].supercookies.push({
        domain: requestDomain,
        hsts:   hasHSTS,
        etag:   hasEtag
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === "GET_DATA") {
    const data = tabData[message.tabId] || {
      url:          "",
      thirdParties: [],
      cookies:      [],
      supercookies: []
    };

    sendResponse({
      url:          data.url,
      thirdParties: data.thirdParties,
      cookies:      data.cookies,
      supercookies: data.supercookies
    });
  }
});