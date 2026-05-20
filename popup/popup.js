browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  if (!tabs || tabs.length === 0) return;
  const tabId = tabs[0].id;

  browser.runtime.sendMessage({ type: "GET_DATA", tabId })
    .then(data => {
      if (!data) return;
      renderPrivacyScore(data.privacyScore);
      renderThirdParties(data);
      renderCookies(data);
      renderStorage(data);
      renderFingerprint(data);
      renderHijacking(data);
    })
    .catch(() => {
      renderPrivacyScore(null);
      renderThirdParties({ url: "", thirdParties: [] });
      renderCookies({ cookies: [], supercookies: [] });
      renderStorage({ storage: [] });
      renderFingerprint({ fingerprinting: [] });
      renderHijacking({ hijacking: [] });
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  document.getElementById("count-cookies").textContent      = cookies.length;
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


function renderStorage(data) {
  const storage = data.storage || [];

  const allLocal   = [];
  const allSession = [];
  const allIDB     = [];

  storage.forEach(s => {
    s.localStorage.forEach(e =>
      allLocal.push({ ...e, origin: s.origin, isFirstParty: s.isFirstParty })
    );
    s.sessionStorage.forEach(e =>
      allSession.push({ ...e, origin: s.origin, isFirstParty: s.isFirstParty })
    );
    s.indexedDB.forEach(db =>
      allIDB.push({ ...db, origin: s.origin, isFirstParty: s.isFirstParty })
    );
  });

  const total = allLocal.length + allSession.length + allIDB.length;
  document.getElementById("count-storage").textContent = total;

  const firstPartyOrigins = storage.filter(s => s.isFirstParty).length;
  const thirdPartyOrigins = storage.filter(s => !s.isFirstParty).length;
  const totalBytes        = [...allLocal, ...allSession]
    .reduce((acc, e) => acc + (e.size || 0), 0);

  document.getElementById("storage-summary").innerHTML = `
    <span class="summary-pill pill-first">1ª parte: ${firstPartyOrigins}</span>
    <span class="summary-pill pill-third">3ª parte: ${thirdPartyOrigins}</span>
    <span class="summary-pill pill-persist">~${totalBytes} chars</span>
  `;

  function renderList(elementId, entries, emptyLabel, isIDB) {
    const el = document.getElementById(elementId);

    if (entries.length === 0) {
      el.innerHTML = `<li class="empty">Nenhum dado em ${emptyLabel}.</li>`;
      return;
    }

    const sorted = [...entries].sort((a, b) =>
      Number(a.isFirstParty) - Number(b.isFirstParty) ||
      a.origin.localeCompare(b.origin)
    );

    el.innerHTML = sorted.map(e => `
      <li>
        <span class="name">${escapeHtml(isIDB ? e.name : e.key)}</span>
        <span class="tag ${e.isFirstParty ? 'tag-first' : 'tag-third'}">
          ${e.isFirstParty ? '1ª' : '3ª'}
        </span>
        <span class="expires">${escapeHtml(new URL(e.origin).hostname)}</span>
        ${isIDB
          ? `<span class="expires">v${e.version || '?'}</span>`
          : `<span class="expires">${e.size} ch</span>`}
      </li>
    `).join("");
  }

  renderList("list-localstorage",   allLocal,   "localStorage",   false);
  renderList("list-sessionstorage", allSession, "sessionStorage", false);
  renderList("list-indexeddb",      allIDB,     "IndexedDB",      true);
}

function renderFingerprint(data) {
  const fp = data.fingerprinting || [];
  document.getElementById("count-fingerprint").textContent = fp.length;

  const byApi = fp.reduce((acc, f) => {
    acc[f.api] = (acc[f.api] || 0) + f.count;
    return acc;
  }, {});

  const summary = document.getElementById("fingerprint-summary");

  if (fp.length === 0) {
    summary.innerHTML = "";
  } else {
    summary.innerHTML = Object.keys(byApi).map(api => `
      <span class="summary-pill pill-third">${escapeHtml(api)}: ${byApi[api]}</span>
    `).join("");
  }

  const list = document.getElementById("list-fingerprint");

  if (fp.length === 0) {
    list.innerHTML = '<li class="empty">Nenhuma tentativa detectada.</li>';
    return;
  }

  const sorted = [...fp].sort((a, b) =>
    Number(a.isFirstParty) - Number(b.isFirstParty) ||
    a.api.localeCompare(b.api) ||
    a.method.localeCompare(b.method)
  );

  list.innerHTML = sorted.map(f => {
    let host = "";
    try { host = new URL(f.origin).hostname; } catch (e) {}

    return `
      <li>
        <span class="name">
          ${escapeHtml(f.api)}.${escapeHtml(f.method)}
          ${f.debugRenderer ? '<span class="tag tag-third">⚠ debug renderer</span>' : ''}
        </span>
        <span class="tag ${f.isFirstParty ? 'tag-first' : 'tag-third'}">
          ${f.isFirstParty ? '1ª' : '3ª'}
        </span>
        <span class="expires">${escapeHtml(host)}</span>
        ${f.count > 1 ? `<span class="count">×${f.count}</span>` : ''}
      </li>
    `;
  }).join("");
  
}

function renderHijacking(data) {
  const hij = data.hijacking || [];
  document.getElementById("count-hijacking").textContent = hij.length;

  const list = document.getElementById("list-hijacking");

  if (hij.length === 0) {
    list.innerHTML = '<li class="empty">Nenhuma ameaça detectada.</li>';
    return;
  }

  list.innerHTML = hij.map(h => `
    <li>
      <span class="name">${h.type}</span>
      ${h.domain ? `<span class="domain">${h.domain}</span>` : ""}
    </li>
  `).join("");
}

function renderPrivacyScore(data) {
  const valueEl = document.getElementById("privacy-score-value");
  const labelEl = document.getElementById("privacy-score-label");
  const detailEl = document.getElementById("privacy-score-detail");

  if (!data) {
    valueEl.textContent = "—";
    labelEl.textContent = "Sem dados";
    detailEl.textContent = "";
    return;
  }

  valueEl.textContent = `${data.score}`;
  labelEl.textContent = data.label;
  detailEl.textContent = `Risco estimado: ${data.risk}/100`;
}