// ── CONFIG ────────────────────────────────────────────────────
const BACKEND = "https://ghostmail-backend.devpandey618.workers.dev";
const DOMAIN  = "psychodead.qzz.io";

// ── STATE ─────────────────────────────────────────────────────
let token        = localStorage.getItem("gm_token") || null;
let attachFiles  = []; // Array of File objects
let currentMailId = null;

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (token) {
    showApp();
  } else {
    showLogin();
  }

  bindEvents();
  loadTheme();
});

// ── SHOW/HIDE SCREENS ─────────────────────────────────────────
function showLogin() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("login-screen").classList.add("active");
  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("active");
}

function showApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  loadAliases();
}

// ── BIND EVENTS ───────────────────────────────────────────────
function bindEvents() {
  // Login
  document.getElementById("login-btn").addEventListener("click", doLogin);
  document.getElementById("login-password").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });

  // Logout
  document.getElementById("logout-btn").addEventListener("click", doLogout);

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Alias input
  const aliasInput = document.getElementById("from-alias");
  aliasInput.addEventListener("input", onAliasInput);
  aliasInput.addEventListener("blur", () => {
    setTimeout(() => hideAliasSuggestions(), 150);
  });

  // File attach
  document.getElementById("attach-btn").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });
  document.getElementById("file-input").addEventListener("change", onFileSelect);

  // Compose actions
  document.getElementById("preview-btn").addEventListener("click", showPreview);
  document.getElementById("cancel-btn").addEventListener("click", clearCompose);
  document.getElementById("send-btn").addEventListener("click", doSend);

  // Preview modal
  document.getElementById("close-preview").addEventListener("click", closePreview);
  document.getElementById("preview-close-btn").addEventListener("click", closePreview);
  document.getElementById("preview-send-btn").addEventListener("click", doSend);

  // History
  document.getElementById("refresh-history-btn").addEventListener("click", loadHistory);

  // Detail modal
  document.getElementById("close-detail").addEventListener("click", closeDetail);
  document.getElementById("detail-close-btn").addEventListener("click", closeDetail);
  document.getElementById("delete-mail-btn").addEventListener("click", deleteMail);

  // Theme
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
}

// ── LOGIN ─────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const errEl    = document.getElementById("login-error");
  const btn      = document.getElementById("login-btn");

  if (!username || !password) {
    showError(errEl, "Username aur password dono bharo.");
    return;
  }

  setLoading(btn, true);
  hideError(errEl);

  try {
    const res  = await fetch(`${BACKEND}/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(errEl, data.error || "Login failed.");
      return;
    }

    token = data.token;
    localStorage.setItem("gm_token", token);
    showApp();
  } catch (err) {
    showError(errEl, "Network error — try again.");
  } finally {
    setLoading(btn, false);
  }
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

// ── ALIAS SUGGESTIONS ─────────────────────────────────────────
const SAVED_ALIASES_KEY = "gm_aliases";

function getSavedAliases() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_ALIASES_KEY) || "[]");
  } catch { return []; }
}

function saveAlias(alias) {
  if (!alias) return;
  const list = getSavedAliases();
  if (!list.includes(alias)) {
    list.unshift(alias);
    if (list.length > 10) list.pop();
    localStorage.setItem(SAVED_ALIASES_KEY, JSON.stringify(list));
  }
}

function loadAliases() { /* aliases load on input focus */ }

function onAliasInput() {
  const val  = document.getElementById("from-alias").value.toLowerCase();
  const list = getSavedAliases().filter(a => a.toLowerCase().includes(val));
  renderAliasSuggestions(list);
}

function renderAliasSuggestions(list) {
  const el = document.getElementById("alias-suggestions");
  if (!list.length) { el.classList.add("hidden"); return; }
  el.innerHTML = list.map(a =>
    `<div class="alias-option" data-alias="${a}">${a}@${DOMAIN}</div>`
  ).join("");
  el.classList.remove("hidden");
  el.querySelectorAll(".alias-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.getElementById("from-alias").value = opt.dataset.alias;
      hideAliasSuggestions();
    });
  });
}

function hideAliasSuggestions() {
  document.getElementById("alias-suggestions").classList.add("hidden");
}

// ── FILE ATTACH ───────────────────────────────────────────────
function onFileSelect(e) {
  const files = Array.from(e.target.files);
  files.forEach(f => {
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > 40) {
      alert(`"${f.name}" is too large (${sizeMB.toFixed(1)} MB). Max 40MB.`);
      return;
    }
    if (!attachFiles.find(x => x.name === f.name)) {
      attachFiles.push(f);
    }
  });
  renderFileList();
  e.target.value = "";
}

function renderFileList() {
  const el = document.getElementById("file-list");
  el.innerHTML = attachFiles.map((f, i) => {
    const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
    return `
      <div class="file-item">
        <span class="file-item-name">📎 ${f.name}</span>
        <span class="file-item-size">${sizeMB} MB</span>
        <button class="file-remove" onclick="removeFile(${i})">✕</button>
      </div>`;
  }).join("");
}

function removeFile(i) {
  attachFiles.splice(i, 1);
  renderFileList();
}

// ── FILE TO BASE64 ────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── PREVIEW ───────────────────────────────────────────────────
function showPreview() {
  const alias   = document.getElementById("from-alias").value.trim();
  const to      = document.getElementById("to-address").value.trim();
  const subject = document.getElementById("subject").value.trim();
  const body    = document.getElementById("body").value.trim();

  if (!alias || !to || !subject) {
    const errEl = document.getElementById("compose-error");
    showError(errEl, "From alias, To, aur Subject bharo pehle.");
    return;
  }

  document.getElementById("prev-from").textContent    = `${alias}@${DOMAIN}`;
  document.getElementById("prev-to").textContent      = to;
  document.getElementById("prev-subject").textContent = subject;
  document.getElementById("prev-body").textContent    = body || "(empty)";

  const attEl = document.getElementById("prev-attachments");
  if (attachFiles.length) {
    attEl.textContent = `📎 ${attachFiles.length} attachment(s): ` +
      attachFiles.map(f => f.name).join(", ");
  } else {
    attEl.textContent = "";
  }

  document.getElementById("preview-modal").classList.remove("hidden");
}

function closePreview() {
  document.getElementById("preview-modal").classList.add("hidden");
}

// ── SEND ──────────────────────────────────────────────────────
async function doSend() {
  const alias   = document.getElementById("from-alias").value.trim();
  const to      = document.getElementById("to-address").value.trim();
  const subject = document.getElementById("subject").value.trim();
  const body    = document.getElementById("body").value.trim();
  const errEl   = document.getElementById("compose-error");
  const sucEl   = document.getElementById("compose-success");
  const btn     = document.getElementById("send-btn");

  hideError(errEl);
  hideSuc(sucEl);

  if (!alias || !to || !subject) {
    showError(errEl, "From alias, To, aur Subject zaroori hain.");
    closePreview();
    return;
  }

  setLoading(btn, true);

  try {
    // Build attachments
    const attachments = [];
    for (const file of attachFiles) {
      const content = await fileToBase64(file);
      attachments.push({
        filename: file.name,
        content:  content,
        type:     file.type || "application/octet-stream",
      });
    }

    const res = await fetch(`${BACKEND}/send`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ from_alias: alias, to, subject, text: body, attachments }),
    });

    const data = await res.json();

    if (res.status === 401) {
      doLogout(); return;
    }
    if (!res.ok) {
      showError(errEl, data.error || "Send failed.");
      closePreview();
      return;
    }

    // Success
    saveAlias(alias);
    showSuc(sucEl, "✓ Mail sent successfully!");
    closePreview();
    clearCompose();

  } catch (err) {
    showError(errEl, "Network error — try again.");
    closePreview();
  } finally {
    setLoading(btn, false);
  }
}

function clearCompose() {
  document.getElementById("from-alias").value  = "";
  document.getElementById("to-address").value  = "";
  document.getElementById("subject").value      = "";
  document.getElementById("body").value         = "";
  attachFiles = [];
  renderFileList();
  hideError(document.getElementById("compose-error"));
  hideSuc(document.getElementById("compose-success"));
}

// ── HISTORY ───────────────────────────────────────────────────
async function loadHistory() {
  const el = document.getElementById("history-list");
  el.innerHTML = `<div class="history-empty">Loading...</div>`;

  try {
    const res  = await fetch(`${BACKEND}/history`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (res.status === 401) { doLogout(); return; }

    const data = await res.json();
    renderHistory(data.mails || []);
  } catch {
    el.innerHTML = `<div class="history-empty">Failed to load history.</div>`;
  }
}

function renderHistory(mails) {
  const el = document.getElementById("history-list");
  if (!mails.length) {
    el.innerHTML = `<div class="history-empty">No sent mails yet.</div>`;
    return;
  }
  el.innerHTML = mails.map(m => `
    <div class="history-item" onclick="showDetail('${m.id}')">
      <div class="history-item-subject">${esc(m.subject)}</div>
      <div class="history-item-meta">
        <span>▶ ${esc(m.to)}</span>
        <span>◀ ${esc(m.from)}</span>
        <span>◷ ${formatDate(m.sentAt)}</span>
      </div>
    </div>`).join("");

  // Store mails in memory for detail view
  window._historyMails = mails;
}

function showDetail(id) {
  const mail = (window._historyMails || []).find(m => m.id === id);
  if (!mail) return;

  currentMailId = id;

  const el = document.getElementById("detail-content");
  el.innerHTML = `
    <div class="detail-row"><span class="detail-label">FROM</span><span>${esc(mail.from)}</span></div>
    <div class="detail-row"><span class="detail-label">TO</span><span>${esc(mail.to)}</span></div>
    <div class="detail-row"><span class="detail-label">SUBJECT</span><span>${esc(mail.subject)}</span></div>
    <div class="detail-row"><span class="detail-label">DATE</span><span>${formatDate(mail.sentAt)}</span></div>
    ${mail.attachments && mail.attachments.length
      ? `<div class="detail-row"><span class="detail-label">FILES</span><span>${mail.attachments.map(a => esc(a)).join(", ")}</span></div>`
      : ""}
    <div class="detail-body">${esc(mail.body)}</div>
  `;

  document.getElementById("detail-modal").classList.remove("hidden");
}

function closeDetail() {
  document.getElementById("detail-modal").classList.add("hidden");
  currentMailId = null;
}

async function deleteMail() {
  if (!currentMailId) return;
  if (!confirm("Delete this mail from history?")) return;

  try {
    const res = await fetch(`${BACKEND}/history/${encodeURIComponent(currentMailId)}`, {
      method:  "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (res.status === 401) { doLogout(); return; }
    closeDetail();
    loadHistory();
  } catch {
    alert("Delete failed.");
  }
}

// ── THEME ─────────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem("gm_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next    = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("gm_theme", next);
}

// ── HELPERS ───────────────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function setLoading(btn, loading) {
  const text   = btn.querySelector(".btn-text");
  const loader = btn.querySelector(".btn-loader");
  if (!text || !loader) return;
  btn.disabled = loading;
  text.classList.toggle("hidden", loading);
  loader.classList.toggle("hidden", !loading);
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}
function hideError(el) { el.classList.add("hidden"); }
function showSuc(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => hideSuc(el), 4000);
}
function hideSuc(el) { el.classList.add("hidden"); }
