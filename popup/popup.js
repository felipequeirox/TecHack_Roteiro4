browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  if (!tabs || tabs.length === 0) return;
  const tabId = tabs[0].id;

  browser.runtime.sendMessage({ type: "GET_DATA", tabId })
    .then(data => {
      if (!data) return;
      renderThirdParties(data);
      renderCookies(data);
    })
    .catch(() => {
      renderThirdParties({ url: "", thirdParties: [] });
      renderCookies({ cookies: [], supercookies: [] });
    });
});

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderThirdParties(data) {
  document.getElementById("page-url").textContent = data.url || "—";
  const parties = data.thirdParties || [];
  document.getElementById("count-third-parties").textContent = parties.length;
  const list = document.getElementById("list-third-parties");

  if (parties.length === 0) {
    list.innerHTML = '<li class="empty">Nenhuma conexão detectada.</li>';
    return;
  }

  const sorted = [...parties].sort((a, b) =>
    a.type.localeCompare(b.type) || a.domain.localeCompare(b.domain)
  );

  list.innerHTML = sorted.map(tp => `
    <li>
      <span class="domain">${escapeHtml(tp.domain)}</span>
      <span class="tag tag-type type-${tp.type}">${escapeHtml(tp.type)}</span>
      ${tp.count > 1 ? `<span class="count">×${tp.count}</span>` : ""}
    </li>
  `).join("");
}

function renderCookies(data) {
  const cookies      = data.cookies      || [];
  const supercookies = data.supercookies || [];

  document.getElementById("count-cookies").textContent = cookies.length;
  document.getElementById("count-supercookies").textContent = supercookies.length;

  const firstParty = cookies.filter(c => c.firstParty).length;
  const thirdParty = cookies.filter(c => !c.firstParty).length;
  const session    = cookies.filter(c => c.session).length;
  const persistent = cookies.filter(c => !c.session).length;

  document.getElementById("cookie-summary").innerHTML = `
    <span class="summary-pill pill-first">1ª parte: ${firstParty}</span>
    <span class="summary-pill pill-third">3ª parte: ${thirdParty}</span>
    <span class="summary-pill pill-session">Sessão: ${session}</span>
    <span class="summary-pill pill-persist">Persistente: ${persistent}</span>
  `;

  const listCookies = document.getElementById("list-cookies");
  if (cookies.length === 0) {
    listCookies.innerHTML = '<li class="empty">Nenhum cookie detectado.</li>';
  } else {
    const sorted = [...cookies].sort((a, b) =>
      Number(a.firstParty) - Number(b.firstParty) || a.domain.localeCompare(b.domain)
    );
    listCookies.innerHTML = sorted.map(c => `
      <li>
        <span class="name">${escapeHtml(c.name)}</span>
        <span class="tag ${c.firstParty ? 'tag-first' : 'tag-third'}">
          ${c.firstParty ? '1ª' : '3ª'}
        </span>
        <span class="tag ${c.session ? 'tag-session' : 'tag-persist'}">
          ${c.session ? 'sessão' : 'persist.'}
        </span>
        <span class="expires">${escapeHtml(c.expires)}</span>
      </li>
    `).join("");
  }

  const listSuper = document.getElementById("list-supercookies");
  if (supercookies.length === 0) {
    listSuper.innerHTML = '<li class="empty">Nenhum supercookie detectado.</li>';
  } else {
    listSuper.innerHTML = supercookies.map(s => `
      <li>
        <span class="domain">${escapeHtml(s.domain)}</span>
        ${s.hsts ? '<span class="tag tag-hsts">HSTS</span>' : ''}
        ${s.etag ? '<span class="tag tag-etag">ETag</span>' : ''}
      </li>
    `).join("");
  }
}