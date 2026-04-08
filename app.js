// ── CONFIG ────────────────────────────────────────────────────
const BACKEND = "https://ghostmail-backend.devpandey618.workers.dev";
const DOMAIN  = "psychodead.qzz.io";

// ── STATE ─────────────────────────────────────────────────────
let token         = localStorage.getItem("gm_token") || null;
let attachFiles   = [];
let currentMailId = null;

const HISTORY_KEY      = "gm_history";
const SAVED_ALIASES_KEY = "gm_aliases";

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  if (token) showApp(); else showLogin();
  bindEvents();
});

// ── SCREENS ───────────────────────────────────────────────────
function showLogin() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("login-screen").classList.add("active");
  document.getElementById("app-screen").classList.add("hidden");
}
function showApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
}

// ── BIND EVENTS ───────────────────────────────────────────────
function bindEvents() {
  document.getElementById("login-btn").addEventListener("click", doLogin);
  document.getElementById("login-password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  document.getElementById("logout-btn").addEventListener("click", doLogout);

  const themeCheckbox = document.getElementById("theme-checkbox");
  themeCheckbox.addEventListener("change", () => {
    const theme = themeCheckbox.checked ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("gm_theme", theme);
  });

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  const aliasInput = document.getElementById("from-alias");
  aliasInput.addEventListener("focus", onAliasInput);
  aliasInput.addEventListener("input", onAliasInput);
  aliasInput.addEventListener("blur", () => setTimeout(() => hideAliasSuggestions(), 150));

  document.getElementById("attach-btn").addEventListener("click", () => document.getElementById("file-input").click());
  document.getElementById("file-input").addEventListener("change", onFileSelect);

  document.getElementById("preview-btn").addEventListener("click", showPreview);
  document.getElementById("cancel-btn").addEventListener("click", clearCompose);
  document.getElementById("send-btn").addEventListener("click", doSend);

  document.getElementById("close-preview").addEventListener("click", closePreview);
  document.getElementById("preview-close-btn").addEventListener("click", closePreview);
  document.getElementById("preview-send-btn").addEventListener("click", doSend);

  document.getElementById("refresh-history-btn").addEventListener("click", loadHistory);

  document.getElementById("close-detail").addEventListener("click", closeDetail);
  document.getElementById("detail-close-btn").addEventListener("click", closeDetail);
  document.getElementById("delete-mail-btn").addEventListener("click", deleteMail);
}

// ── THEME ─────────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem("gm_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  const cb = document.getElementById("theme-checkbox");
  if (cb) cb.checked = (saved === "light");
}

// ── LOGIN ─────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const errEl    = document.getElementById("login-error");
  const btn      = document.getElementById("login-btn");
  if (!username || !password) { showError(errEl, "Username aur password dono bharo."); return; }
  setLoading(btn, true); hideMsg(errEl);
  try {
    const res  = await fetch(`${BACKEND}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { showError(errEl, data.error || "Login failed."); return; }
    token = data.token;
    localStorage.setItem("gm_token", token);
    showApp();
  } catch { showError(errEl, "Network error — try again."); }
  finally { setLoading(btn, false); }
}

function doLogout() {
  token = null;
  localStorage.removeItem("gm_token");
  showLogin();
}

// ── TABS ──────────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(`tab-${tabName}`).classList.add("active");
  if (tabName === "history") loadHistory();
}

// ── ALIAS ─────────────────────────────────────────────────────
function getSavedAliases() {
  try { return JSON.parse(localStorage.getItem(SAVED_ALIASES_KEY) || "[]"); } catch { return []; }
}
function saveAlias(alias) {
  if (!alias) return;
  const list = getSavedAliases();
  if (!list.includes(alias)) { list.unshift(alias); if (list.length > 10) list.pop(); }
  localStorage.setItem(SAVED_ALIASES_KEY, JSON.stringify(list));
}
function onAliasInput() {
  const val  = document.getElementById("from-alias").value.toLowerCase();
  const list = getSavedAliases().filter(a => !val || a.toLowerCase().includes(val));
  renderAliasSuggestions(list);
}
function renderAliasSuggestions(list) {
  const el = document.getElementById("alias-suggestions");
  if (!list.length) { el.classList.add("hidden"); return; }
  el.innerHTML = list.map(a => `<div class="alias-option" data-alias="${a}">${a}@${DOMAIN}</div>`).join("");
  el.classList.remove("hidden");
  el.querySelectorAll(".alias-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.getElementById("from-alias").value = opt.dataset.alias;
      hideAliasSuggestions();
    });
  });
}
function hideAliasSuggestions() { document.getElementById("alias-suggestions").classList.add("hidden"); }

// ── FILE ATTACH ───────────────────────────────────────────────
function onFileSelect(e) {
  Array.from(e.target.files).forEach(f => {
    if (f.size / 1048576 > 40) { alert(`"${f.name}" too large. Max 40MB.`); return; }
    if (!attachFiles.find(x => x.name === f.name)) attachFiles.push(f);
  });
  renderFileList(); e.target.value = "";
}
function renderFileList() {
  document.getElementById("file-list").innerHTML = attachFiles.map((f, i) =>
    `<div class="file-item">
      <span class="file-item-name">📎 ${f.name}</span>
      <span class="file-item-size">${(f.size/1048576).toFixed(2)} MB</span>
      <button class="file-remove" onclick="removeFile(${i})">✕</button>
    </div>`).join("");
}
function removeFile(i) { attachFiles.splice(i, 1); renderFileList(); }
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ── LOCAL HISTORY HELPERS ─────────────────────────────────────
function getLocalHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveLocalHistory(mails) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(mails)); } catch(e) { console.warn("localStorage full:", e); }
}
function addToLocalHistory(mailObj) {
  const list = getLocalHistory();
  if (!list.find(m => m.id === mailObj.id)) {
    list.unshift(mailObj);
    if (list.length > 200) list.splice(200);
    saveLocalHistory(list);
  }
}
function deleteFromLocalHistory(id) {
  saveLocalHistory(getLocalHistory().filter(m => m.id !== id));
}
// KV = source of truth, local fills gaps for offline/unsynced mails
function mergeHistories(kvMails, localMails) {
  const map = new Map();
  localMails.forEach(m => map.set(m.id, m));
  kvMails.forEach(m => map.set(m.id, { ...m, _local: false }));
  return Array.from(map.values()).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
}

// ── PREVIEW ───────────────────────────────────────────────────
function showPreview() {
  const alias = document.getElementById("from-alias").value.trim();
  const to    = document.getElementById("to-address").value.trim();
  const sub   = document.getElementById("subject").value.trim();
  const body  = document.getElementById("body").value.trim();
  const errEl = document.getElementById("compose-error");
  if (!alias || !to || !sub) { showError(errEl, "From alias, To, aur Subject bharo pehle."); return; }
  hideMsg(errEl);
  document.getElementById("prev-from").textContent    = `${alias}@${DOMAIN}`;
  document.getElementById("prev-to").textContent      = to;
  document.getElementById("prev-subject").textContent = sub;
  document.getElementById("prev-body").textContent    = body || "(empty)";
  document.getElementById("prev-attachments").textContent = attachFiles.length
    ? `📎 ${attachFiles.length} file(s): ${attachFiles.map(f => f.name).join(", ")}` : "";
  document.getElementById("preview-modal").classList.remove("hidden");
}
function closePreview() { document.getElementById("preview-modal").classList.add("hidden"); }

// ── SEND ──────────────────────────────────────────────────────
async function doSend() {
  const alias = document.getElementById("from-alias").value.trim();
  const to    = document.getElementById("to-address").value.trim();
  const sub   = document.getElementById("subject").value.trim();
  const body  = document.getElementById("body").value.trim();
  const errEl = document.getElementById("compose-error");
  const sucEl = document.getElementById("compose-success");
  const btn   = document.getElementById("send-btn");

  hideMsg(errEl); hideMsg(sucEl);
  if (!alias || !to || !sub) { showError(errEl, "From alias, To, aur Subject zaroori hain."); closePreview(); return; }
  setLoading(btn, true);

  try {
    const attachments = [];
    for (const file of attachFiles) {
      attachments.push({ filename: file.name, content: await fileToBase64(file), type: file.type || "application/octet-stream" });
    }

    const res = await fetch(`${BACKEND}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ from_alias: alias, to, subject: sub, text: body, attachments }),
    });

    if (res.status === 401) { doLogout(); return; }

    const data = await res.json();
    if (!res.ok) { closePreview(); showError(errEl, data.error || "Send failed."); return; }

    closePreview();
    saveAlias(alias);

    // ── Save to localStorage immediately after send ───────────
    const safeAlias = alias.replace(/[^a-zA-Z0-9._-]/g, "");
    const localId   = `mail:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    addToLocalHistory({
      id:          localId,
      from:        `${safeAlias} <${safeAlias}@${DOMAIN}>`,
      to:          to,
      subject:     sub,
      body:        body || "(empty)",
      attachments: attachments.map(a => a.filename),
      sentAt:      new Date().toISOString(),
      _local:      true,
    });
    // ──────────────────────────────────────────────────────────

    document.getElementById("from-alias").value = "";
    document.getElementById("to-address").value  = "";
    document.getElementById("subject").value      = "";
    document.getElementById("body").value         = "";
    attachFiles = []; renderFileList();
    showSuc(sucEl, "✓ Mail sent! History mein save ho gayi.");

  } catch(err) {
    closePreview();
    showError(errEl, "Network error: " + err.message);
  } finally {
    setLoading(btn, false);
  }
}

function clearCompose() {
  ["from-alias","to-address","subject","body"].forEach(id => document.getElementById(id).value = "");
  attachFiles = []; renderFileList();
  hideMsg(document.getElementById("compose-error"));
  hideMsg(document.getElementById("compose-success"));
}

// ── HISTORY ───────────────────────────────────────────────────
async function loadHistory() {
  const el = document.getElementById("history-list");

  // STEP 1 — localStorage se turant dikhao (instant, no delay)
  const localMails = getLocalHistory();
  if (localMails.length > 0) {
    renderHistory(localMails);
    // sync banner add karo
    const banner = document.createElement("div");
    banner.id = "kv-sync-banner";
    banner.style.cssText = "text-align:center;font-size:11px;color:var(--text3);padding:4px 0 8px;font-family:var(--font-mono);";
    banner.textContent = "⟳ syncing with server...";
    el.prepend(banner);
  } else {
    el.innerHTML = `<div class="history-empty">⟳ Loading...</div>`;
  }

  if (!token) { el.innerHTML = `<div class="history-empty">Not logged in.</div>`; return; }

  // STEP 2 — KV se background fetch
  try {
    const res = await fetch(`${BACKEND}/history`, {
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });

    // Banner hata do
    const banner = document.getElementById("kv-sync-banner");
    if (banner) banner.remove();

    if (res.status === 401) { doLogout(); return; }

    let data;
    try { data = await res.json(); }
    catch(e) {
      if (!localMails.length) el.innerHTML = `<div class="history-empty">Server parse error.</div>`;
      return;
    }

    if (!res.ok) {
      if (!localMails.length) el.innerHTML = `<div class="history-empty">Server error ${res.status}: ${data.error || "Unknown"}</div>`;
      return;
    }

    // STEP 3 — Merge KV + local, save merged list, render
    const kvMails = data.mails || [];
    const merged  = mergeHistories(kvMails, localMails);
    saveLocalHistory(merged);
    renderHistory(merged);

  } catch(err) {
    const banner = document.getElementById("kv-sync-banner");
    if (banner) banner.textContent = "⚠ Offline — showing local only";
    if (!localMails.length) el.innerHTML = `<div class="history-empty">Network error: ${err.message}</div>`;
  }
}

// ── RENDER HISTORY ────────────────────────────────────────────
function renderHistory(mails) {
  const el = document.getElementById("history-list");
  if (!mails || !mails.length) {
    el.innerHTML = `<div class="history-empty">No sent mails yet.</div>`;
    return;
  }
  el.innerHTML = mails.map(m => `
    <div class="history-item" data-mail-id="${esc(m.id)}">
      <div class="history-item-subject">${esc(m.subject)}</div>
      <div class="history-item-meta">
        <span>▶ ${esc(m.to)}</span>
        <span>◀ ${esc(m.from)}</span>
        <span>◷ ${formatDate(m.sentAt)}</span>
        ${m._local ? `<span style="color:var(--accent2);font-size:0.6rem">● local</span>` : ""}
      </div>
    </div>`).join("");

  el.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", () => showDetail(item.dataset.mailId));
  });
  window._historyMails = mails;
}

// ── DETAIL MODAL ──────────────────────────────────────────────
function showDetail(id) {
  const mail = (window._historyMails || []).find(m => m.id === id);
  if (!mail) return;
  currentMailId = id;
  document.getElementById("detail-content").innerHTML = `
    <div class="detail-row"><span class="detail-label">FROM</span><span>${esc(mail.from)}</span></div>
    <div class="detail-row"><span class="detail-label">TO</span><span>${esc(mail.to)}</span></div>
    <div class="detail-row"><span class="detail-label">SUBJECT</span><span>${esc(mail.subject)}</span></div>
    <div class="detail-row"><span class="detail-label">DATE</span><span>${formatDate(mail.sentAt)}</span></div>
    ${mail.attachments && mail.attachments.length
      ? `<div class="detail-row"><span class="detail-label">FILES</span><span>${mail.attachments.map(a => esc(a)).join(", ")}</span></div>`
      : ""}
    <div class="detail-body">${esc(mail.body)}</div>`;
  document.getElementById("detail-modal").classList.remove("hidden");
}
function closeDetail() { document.getElementById("detail-modal").classList.add("hidden"); currentMailId = null; }

async function deleteMail() {
  if (!currentMailId) return;
  if (!confirm("Delete this mail from history?")) return;
  deleteFromLocalHistory(currentMailId);
  try {
    const res = await fetch(`${BACKEND}/history/${encodeURIComponent(currentMailId)}`, {
      method: "DELETE", headers: { "Authorization": `Bearer ${token}` },
    });
    if (res.status === 401) { doLogout(); return; }
  } catch { console.warn("KV delete failed — removed from local only."); }
  closeDetail();
  loadHistory();
}

// ── HELPERS ───────────────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
    });
  } catch { return iso; }
}
function setLoading(btn, loading) {
  const t = btn.querySelector(".btn-text");
  const l = btn.querySelector(".btn-loader");
  if (!t || !l) return;
  btn.disabled = loading; t.classList.toggle("hidden", loading); l.classList.toggle("hidden", !loading);
}
function showError(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }
function showSuc(el, msg)   { el.textContent = msg; el.classList.remove("hidden"); setTimeout(() => hideMsg(el), 5000); }
function hideMsg(el)        { if (el) el.classList.add("hidden"); }
