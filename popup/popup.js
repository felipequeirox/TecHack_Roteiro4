browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (!tabs || tabs.length === 0) return;

    const tabId = tabs[0].id;

    browser.runtime.sendMessage({ type: "GET_DATA", tabId: tabId })
        .then(data => renderThirdParties(data))
        .catch(err => console.error("Erro ao buscar dados:", err));
});


function renderThirdParties(data) {

        const urlEl = document.getElementById("page-url");
    urlEl.textContent = data.url || "—";

    const countEl = document.getElementById("count-third-parties");
    const list     = document.getElementById("list-third-parties");
    const parties  = data.thirdParties || [];

    countEl.textContent = parties.length;

    if (parties.length === 0) {
        list.innerHTML = '<li class="empty">Nenhuma conexão de terceira parte detectada.</li>';
        return;
    }

    const sorted = [...parties].sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.domain.localeCompare(b.domain);
    });

    list.innerHTML = sorted.map(tp => {
        const typeClass = "type-" + tp.type;
        const countText = tp.count > 1 ? `×${tp.count}` : "";
        return `
        <li>
            <span class="domain">${escapeHtml(tp.domain)}</span>
            <span class="type-badge ${typeClass}">${escapeHtml(tp.type)}</span>
            ${countText ? `<span class="count">${countText}</span>` : ""}
        </li>
        `;
    }).join("");
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}