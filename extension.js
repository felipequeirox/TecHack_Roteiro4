const tabData = {};

function getRootDomain(hostname) {
    if (!hostname) return "";
    const parts = hostname.split(".");
    const twoPartSuffixes = ["com.br","org.br","net.br","gov.br","co.uk","com.au"];
    const lastTwo = parts.slice(-2).join(".");
    if (twoPartSuffixes.includes(lastTwo) && parts.length > 2) {
        return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
}

function isThirdParty(requestUrl, pageUrl) {
    try {
        const reqDomain  = getRootDomain(new URL(requestUrl).hostname);
        const pageDomain = getRootDomain(new URL(pageUrl).hostname);
        return reqDomain !== pageDomain && reqDomain !== "";
    } catch (e) {
        return false;
    }
}

function initTab(tabId, url) {
    tabData[tabId] = {
        url: url,
        thirdParties: []
    };
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading" && tab.url) {
        if (tab.url.startsWith("http://") || tab.url.startsWith("https://")) {
        initTab(tabId, tab.url);
        }
    }
});

browser.tabs.onRemoved.addListener((tabId) => {
    delete tabData[tabId];
});

browser.webRequest.onBeforeRequest.addListener(
    function(details) {
        const tabId = details.tabId;
        if (tabId < 0) return;
        if (details.type === "main_frame") return;

        // Se a aba ainda não foi inicializada, busca a URL real da aba agora
        if (!tabData[tabId]) {
        browser.tabs.get(tabId).then(tab => {
            if (tab && tab.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))) {
            initTab(tabId, tab.url);
            }
        }).catch(() => {});
        return;
        }

        const pageUrl = tabData[tabId].url;
        if (!isThirdParty(details.url, pageUrl)) return;

        let requestDomain;
        try {
        requestDomain = new URL(details.url).hostname;
        } catch (e) {
        return;
        }

        const existing = tabData[tabId].thirdParties.find(
        tp => tp.domain === requestDomain && tp.type === details.type
        );

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

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_DATA") {
        const data = tabData[message.tabId] || { url: "", thirdParties: [] };
        sendResponse({ thirdParties: data.thirdParties, url: data.url });
    }
});