// ── CONFIG ────────────────────────────────────────────────────
const BACKEND = "https://ghostmail-backend.devpandey618.workers.dev";
const DOMAIN  = "psychodead.qzz.io";

// ── SAFE VIEWABLE EXTENSIONS ──────────────────────────────────
const VIEWABLE_EXTS = new Set([
  "jpg","jpeg","png","gif","webp","svg","bmp","ico","avif",
  "mp4","webm","mov","ogg","ogv",
  "mp3","wav","m4a","flac","aac",
  "pdf",
  "txt","csv","log","md","json","xml","html","htm","css","js","ts",
  "docx","doc","xlsx","xls","pptx","ppt",
  "zip","rar","7z","tar","gz",
]);

const IMAGE_EXTS         = new Set(["jpg","jpeg","png","gif","webp","svg","bmp","ico","avif"]);
const VIDEO_EXTS         = new Set(["mp4","webm","mov","ogg","ogv"]);
const AUDIO_EXTS         = new Set(["mp3","wav","ogg","m4a","flac","aac"]);
const PDF_EXTS           = new Set(["pdf"]);
const TEXT_EXTS          = new Set(["txt","csv","log","md","json","xml","css","js","ts"]);
const DOWNLOAD_ONLY_EXTS = new Set(["docx","doc","xlsx","xls","pptx","ppt","zip","rar","7z","tar","gz"]);

// ── STATE ─────────────────────────────────────────────────────
let token           = localStorage.getItem("gm_token") || null;
let attachFiles     = [];
let currentMailId   = null;
let currentMailType = "sent";
let selectedMails   = new Set();
let selectionMode   = false;
let activeSubtab    = "inbox";
let viewerBlobUrl   = null;

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  if (token) showApp();
  else showLogin();
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
  loadAliases();
}

// ── BIND EVENTS ───────────────────────────────────────────────
function bindEvents() {
  document.getElementById("login-btn").addEventListener("click", doLogin);
  document.getElementById("login-password").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });

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

  document.querySelectorAll(".subtab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchSubtab(btn.dataset.subtab));
  });

  const aliasInput = document.getElementById("from-alias");
  aliasInput.addEventListener("focus", onAliasInput);
  aliasInput.addEventListener("input", onAliasInput);
  aliasInput.addEventListener("blur", () => {
    setTimeout(() => hideAliasSuggestions(), 150);
  });

  document.getElementById("attach-btn").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });
  document.getElementById("file-input").addEventListener("change", onFileSelect);

  document.getElementById("preview-btn").addEventListener("click", showPreview);
  document.getElementById("cancel-btn").addEventListener("click", clearCompose);
  document.getElementById("send-btn").addEventListener("click", doSend);

  document.getElementById("close-preview").addEventListener("click", closePreview);
  document.getElementById("preview-close-btn").addEventListener("click", closePreview);
  document.getElementById("preview-send-btn").addEventListener("click", doSend);

  document.getElementById("refresh-history-btn").addEventListener("click", () => {
    if (activeSubtab === "inbox") loadInbox();
    else loadHistory();
  });
  document.getElementById("delete-selected-btn").addEventListener("click", deleteSelectedMails);
  document.getElementById("cancel-selection-btn").addEventListener("click", exitSelectionMode);

  document.getElementById("close-detail").addEventListener("click", closeDetail);
  document.getElementById("detail-close-btn").addEventListener("click", closeDetail);
  document.getElementById("delete-mail-btn").addEventListener("click", deleteMail);

  document.getElementById("close-viewer").addEventListener("click", closeViewer);
  document.getElementById("viewer-close-btn").addEventListener("click", closeViewer);
  document.getElementById("viewer-download-btn").addEventListener("click", () => {
    const btn = document.getElementById("viewer-download-btn");
    if (!btn.dataset.blobUrl || !btn.dataset.filename) return;
    if (btn.dataset.isBlob === "0") {
      // R2 direct URL — fetch and trigger save
      triggerDownloadFromUrl(btn.dataset.blobUrl, btn.dataset.filename);
    } else {
      triggerDownload(btn.dataset.blobUrl, btn.dataset.filename);
    }
  });
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

  setLoading(btn, true);
  hideMsg(errEl);

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
  } catch {
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

// ── MAIN TABS ─────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(`tab-${tabName}`).classList.add("active");
  if (tabName === "history") {
    if (activeSubtab === "inbox") loadInbox();
    else loadHistory();
  }
}

// ── SUB-TABS ──────────────────────────────────────────────────
function switchSubtab(subtabName) {
  activeSubtab = subtabName;
  exitSelectionMode();

  document.querySelectorAll(".subtab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".subtab-content").forEach(c => c.classList.remove("active"));
  document.querySelector(`[data-subtab="${subtabName}"]`).classList.add("active");
  document.getElementById(`subtab-${subtabName}`).classList.add("active");

  if (subtabName === "inbox") loadInbox();
  else loadHistory();
}

// ── ALIAS SUGGESTIONS ─────────────────────────────────────────
const SAVED_ALIASES_KEY = "gm_aliases";

function getSavedAliases() {
  try { return JSON.parse(localStorage.getItem(SAVED_ALIASES_KEY) || "[]"); }
  catch { return []; }
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

function loadAliases() {}

function onAliasInput() {
  const val  = document.getElementById("from-alias").value.toLowerCase();
  const list = getSavedAliases().filter(a => !val || a.toLowerCase().includes(val));
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
  Array.from(e.target.files).forEach(f => {
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > 40) { alert(`"${f.name}" too large (${sizeMB.toFixed(1)} MB). Max 40MB.`); return; }
    if (!attachFiles.find(x => x.name === f.name)) attachFiles.push(f);
  });
  renderFileList();
  e.target.value = "";
}

function renderFileList() {
  const el = document.getElementById("file-list");
  el.innerHTML = attachFiles.map((f, i) => {
    const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
    return `<div class="file-item">
      <span class="file-item-name">${f.name}</span>
      <span class="file-item-size">${sizeMB} MB</span>
      <button class="file-remove" onclick="removeFile(${i})">✕</button>
    </div>`;
  }).join("");
}

function removeFile(i) { attachFiles.splice(i, 1); renderFileList(); }

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
  const errEl   = document.getElementById("compose-error");

  if (!alias || !to || !subject) {
    showError(errEl, "From alias, To, aur Subject bharo pehle.");
    return;
  }
  hideMsg(errEl);

  document.getElementById("prev-from").textContent    = `${alias}@${DOMAIN}`;
  document.getElementById("prev-to").textContent      = to;
  document.getElementById("prev-subject").textContent = subject;
  document.getElementById("prev-body").textContent    = body || "(empty)";

  const attEl = document.getElementById("prev-attachments");
  attEl.textContent = attachFiles.length
    ? `${attachFiles.length} file(s): ${attachFiles.map(f => f.name).join(", ")}`
    : "";

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

  hideMsg(errEl); hideMsg(sucEl);

  if (!alias || !to || !subject) {
    showError(errEl, "From alias, To, aur Subject zaroori hain.");
    closePreview();
    return;
  }

  setLoading(btn, true);

  try {
    const attachments = [];
    for (const file of attachFiles) {
      const content = await fileToBase64(file);
      attachments.push({ filename: file.name, content, type: file.type || "application/octet-stream" });
    }

    const res = await fetch(`${BACKEND}/send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body:    JSON.stringify({ from_alias: alias, to, subject, text: body, attachments }),
    });

    const data = await res.json();
    if (res.status === 401) { doLogout(); return; }
    if (!res.ok) { closePreview(); showError(errEl, data.error || "Send failed."); return; }

    closePreview();
    saveAlias(alias);

    document.getElementById("from-alias").value = "";
    document.getElementById("to-address").value  = "";
    document.getElementById("subject").value      = "";
    document.getElementById("body").value         = "";
    attachFiles = [];
    renderFileList();

    showSuc(sucEl, "✓ Mail sent successfully!");

  } catch {
    closePreview();
    showError(errEl, "Network error — try again.");
  } finally {
    setLoading(btn, false);
  }
}

function clearCompose() {
  document.getElementById("from-alias").value = "";
  document.getElementById("to-address").value  = "";
  document.getElementById("subject").value      = "";
  document.getElementById("body").value         = "";
  attachFiles = [];
  renderFileList();
  hideMsg(document.getElementById("compose-error"));
  hideMsg(document.getElementById("compose-success"));
}

// ── LOAD SENT HISTORY ─────────────────────────────────────────
async function loadHistory() {
  const el = document.getElementById("history-list");
  el.innerHTML = `<div class="history-empty">Loading...</div>`;
  if (!token) { el.innerHTML = `<div class="history-empty">Not logged in.</div>`; return; }

  try {
    const res = await fetch(`${BACKEND}/history`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (res.status === 401) { doLogout(); return; }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { el.innerHTML = `<div class="history-empty">Parse error.</div>`; return; }
    if (!res.ok) { el.innerHTML = `<div class="history-empty">Error: ${data.error || "Failed."}</div>`; return; }
    renderMailList(el, data.mails || [], "sent");
  } catch (err) {
    el.innerHTML = `<div class="history-empty">Network error: ${err.message}</div>`;
  }
}

// ── LOAD INBOX ────────────────────────────────────────────────
async function loadInbox() {
  const el = document.getElementById("inbox-list");
  el.innerHTML = `<div class="history-empty">Loading...</div>`;
  if (!token) { el.innerHTML = `<div class="history-empty">Not logged in.</div>`; return; }

  try {
    const res = await fetch(`${BACKEND}/inbox`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (res.status === 401) { doLogout(); return; }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { el.innerHTML = `<div class="history-empty">Parse error.</div>`; return; }
    if (!res.ok) { el.innerHTML = `<div class="history-empty">Error: ${data.error || "Failed."}</div>`; return; }
    renderMailList(el, data.mails || [], "inbox");
  } catch (err) {
    el.innerHTML = `<div class="history-empty">Network error: ${err.message}</div>`;
  }
}

// ── RENDER MAIL LIST (shared for inbox + sent) ────────────────
function renderMailList(el, mails, type) {
  const emptyMsg = type === "inbox" ? "No inbox mails yet." : "No sent mails yet.";

  if (!mails.length) {
    el.innerHTML = `<div class="history-empty">${emptyMsg}</div>`;
    storeMailsLocally([], type);
    return;
  }

  el.innerHTML = mails.map(m => {
    const isSelected = selectedMails.has(m.id);
    const dateField  = m.receivedAt || m.sentAt;
    const metaLine   = type === "inbox"
      ? `<span class="meta-from">◀ ${esc(cleanFrom(m.from, "inbox"))}</span><span>▶ ${esc(m.to || "")}</span>`
      : `<span>▶ ${esc(Array.isArray(m.to) ? m.to.join(", ") : (m.to || ""))}</span><span class="meta-from">◀ ${esc(cleanFrom(m.from, "sent"))}</span>`;

    const hasAttach = m.attachments && m.attachments.length > 0;

    return `
    <div class="history-item${isSelected ? " selected" : ""}" data-mail-id="${esc(m.id)}" data-mail-type="${type}">
      ${selectionMode ? `<span class="mail-checkbox">${isSelected ? "☑" : "☐"}</span>` : ""}
      <div class="history-item-top">
        <div class="mail-type-badge ${type}">${type === "inbox" ? "IN" : "OUT"}</div>
        <div class="history-item-subject">${esc(m.subject || "(No Subject)")}</div>
        ${hasAttach ? `<div class="mail-attach-badge" title="${m.attachments.length} attachment(s)">⊕</div>` : ""}
      </div>
      <div class="history-item-meta">
        ${metaLine}
        <span class="meta-date">◷ ${formatDate(dateField)}</span>
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll(".history-item").forEach(item => {
    const id       = item.dataset.mailId;
    const mailType = item.dataset.mailType;

    let pressTimer;
    item.addEventListener("pointerdown", () => {
      pressTimer = setTimeout(() => {
        if (!selectionMode) enterSelectionMode();
        toggleMailSelection(id);
        renderMailList(el, getStoredMails(mailType), mailType);
      }, 500);
    });
    item.addEventListener("pointerup",    () => clearTimeout(pressTimer));
    item.addEventListener("pointerleave", () => clearTimeout(pressTimer));

    item.addEventListener("click", () => {
      if (selectionMode) {
        toggleMailSelection(id);
        renderMailList(el, getStoredMails(mailType), mailType);
      } else {
        showDetail(id, mailType);
      }
    });
  });

  storeMailsLocally(mails, type);
  updateSelectionToolbar();
}

// ── MAIL LOCAL STORAGE (for detail lookup) ────────────────────
function storeMailsLocally(mails, type) {
  if (type === "inbox") window._inboxMails = mails;
  else window._historyMails = mails;
}

function getStoredMails(type) {
  return type === "inbox" ? (window._inboxMails || []) : (window._historyMails || []);
}

// ── SELECTION ─────────────────────────────────────────────────
function enterSelectionMode() {
  selectionMode = true;
  document.getElementById("selection-toolbar").classList.remove("hidden");
}

function exitSelectionMode() {
  selectionMode = false;
  selectedMails.clear();
  document.getElementById("selection-toolbar").classList.add("hidden");
  const el = activeSubtab === "inbox"
    ? document.getElementById("inbox-list")
    : document.getElementById("history-list");
  renderMailList(el, getStoredMails(activeSubtab), activeSubtab);
}

function toggleMailSelection(id) {
  if (selectedMails.has(id)) selectedMails.delete(id);
  else selectedMails.add(id);
}

function updateSelectionToolbar() {
  const count = selectedMails.size;
  const label = document.getElementById("selection-count");
  if (label) label.textContent = count > 0 ? `${count} selected` : "Select mails";
  const btn = document.getElementById("delete-selected-btn");
  if (btn) btn.disabled = count === 0;
}

async function deleteSelectedMails() {
  if (!selectedMails.size) return;
  const count = selectedMails.size;

  showConfirmDialog(
    `Delete ${count} mail${count > 1 ? "s" : ""}?`,
    "This action cannot be undone.",
    async () => {
      const ids   = Array.from(selectedMails);
      const type  = activeSubtab;
      const route = type === "inbox" ? "inbox" : "history";
      for (const id of ids) {
        try {
          await fetch(`${BACKEND}/${route}/${encodeURIComponent(id)}`, {
            method:  "DELETE",
            headers: { "Authorization": `Bearer ${token}` },
          });
        } catch {}
      }
      exitSelectionMode();
      if (type === "inbox") loadInbox();
      else loadHistory();
    }
    // no onCancel needed — just close
  );
}

// ── MAIL DETAIL ───────────────────────────────────────────────
function showDetail(id, type) {
  const mails = getStoredMails(type);
  const mail  = mails.find(m => m.id === id);
  if (!mail) return;

  currentMailId   = id;
  currentMailType = type;

  const titleEl = document.getElementById("detail-modal-title");
  titleEl.innerHTML = type === "inbox"
    ? `<span class="detail-type-badge incoming">INCOMING</span> MAIL`
    : `<span class="detail-type-badge outgoing">OUTGOING</span> MAIL`;

  const toStr    = Array.isArray(mail.to) ? mail.to.join(", ") : (mail.to || "");
  const dateField = mail.receivedAt || mail.sentAt;

  let attachHtml = "";
  if (mail.attachments && mail.attachments.length) {
    attachHtml = `<div class="detail-row">
      <span class="detail-label">FILES</span>
      <div class="detail-attachments">
        ${mail.attachments.map((a, i) => {
          const ext       = getExt(a.filename || "");
          const sizeLabel = formatSize(a.size);
          // canView: extension in viewable set, not download-only, or known media mimeType
          const mimeIsViewable = /^(image|video|audio|text)\//.test(a.mimeType || "") || (a.mimeType || "") === "application/pdf";
          const canView   = (VIEWABLE_EXTS.has(ext) && !DOWNLOAD_ONLY_EXTS.has(ext)) || (mimeIsViewable && !DOWNLOAD_ONLY_EXTS.has(ext));
          const truncName = truncateFilename(a.filename || "unknown", 24);
          return `<div class="att-item">
            <div class="att-name-row">
              <span class="att-name" title="${esc(a.filename)}">${esc(truncName)}</span>
              <div class="att-btns">
                ${canView ? `<button class="att-view-btn" data-index="${i}" data-mail-id="${esc(id)}" data-mail-type="${type}" data-action="view">VIEW</button>` : ""}
                <button class="att-dl-btn" data-index="${i}" data-mail-id="${esc(id)}" data-mail-type="${type}" data-action="dl">DL</button>
              </div>
            </div>
            <span class="att-size">${sizeLabel}</span>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }

  const el = document.getElementById("detail-content");

  // ── BUG 6 FIX: Robust HTML detection + safe rendering ──────
  const rawBody = mail.body || "(No body)";

  // Detect if body contains real HTML markup
  const hasHtml = /<\s*(a|b|i|u|p|br|div|span|img|h[1-6]|ul|ol|li|table|td|tr|th|tbody|thead|strong|em|font|center|blockquote|pre|code|hr)\b/i.test(rawBody)
    || /href\s*=/i.test(rawBody)
    || /&lt;a[\s>]/i.test(rawBody);

  let bodyHtml;
  if (hasHtml) {
    // Decode double-escaped entities first (some mail clients double-escape)
    let decoded = rawBody
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Sanitize: remove dangerous tags and event handlers
    const sanitized = decoded
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
      .replace(/javascript\s*:/gi, "about:")
      // Add target="_blank" to <a> tags that don't already have it
      .replace(/<a(?![^>]*target=)([^>]*)(href=[^>]*>)/gi, '<a target="_blank" rel="noopener noreferrer"$1$2')
      // Also handle <a> tags that already have target — ensure rel is safe
      .replace(/<a([^>]*target=["'][^"']*["'][^>]*)>/gi, (match) => {
        if (!match.includes("rel=")) {
          return match.replace(/>$/, ' rel="noopener noreferrer">');
        }
        return match;
      });

    bodyHtml = `<div class="detail-body detail-body-html">${sanitized}</div>`;
  } else {
    // Plain text: escape then auto-linkify URLs
    const escaped = esc(rawBody);
    const linked  = escaped.replace(
      /(https?:\/\/[^\s<>"&]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    bodyHtml = `<div class="detail-body">${linked}</div>`;
  }

  el.innerHTML = `
    <div class="detail-row"><span class="detail-label">FROM</span><span>${esc(cleanFrom(mail.from, type))}</span></div>
    <div class="detail-row"><span class="detail-label">TO</span><span>${esc(toStr)}</span></div>
    <div class="detail-row"><span class="detail-label">SUBJECT</span><span>${esc(mail.subject || "(No Subject)")}</span></div>
    <div class="detail-row"><span class="detail-label">DATE</span><span>${formatDate(dateField)}</span></div>
    ${attachHtml}
    ${bodyHtml}`;

  // Bind attachment buttons
  el.querySelectorAll(".att-view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      openAttachment(btn.dataset.mailId, btn.dataset.mailType, parseInt(btn.dataset.index), "view");
    });
  });
  el.querySelectorAll(".att-dl-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      openAttachment(btn.dataset.mailId, btn.dataset.mailType, parseInt(btn.dataset.index), "download");
    });
  });

  document.getElementById("detail-modal").classList.remove("hidden");
}

function closeDetail() {
  document.getElementById("detail-modal").classList.add("hidden");
  currentMailId   = null;
  currentMailType = null;
}

// ── BUG 3 FIX: Capture mailId/mailType before async — prevent cancel-then-delete ──
async function deleteMail() {
  if (!currentMailId) return;
  // Capture at the time the button is pressed — closeDetail() nulls these
  const mailId   = currentMailId;
  const mailType = currentMailType;

  showConfirmDialog(
    "Delete this mail?",
    "This action cannot be undone.",
    async () => {
      // onConfirm: user pressed DELETE
      const route = mailType === "inbox" ? "inbox" : "history";
      try {
        const res = await fetch(`${BACKEND}/${route}/${encodeURIComponent(mailId)}`, {
          method:  "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (res.status === 401) { doLogout(); return; }
        closeDetail();
        if (mailType === "inbox") loadInbox();
        else loadHistory();
      } catch {
        showToast("Delete failed — try again.", "error");
      }
    },
    null // onCancel: do nothing — just close dialog
  );
}

// ── ATTACHMENT OPEN ────────────────────────────────────────────
async function openAttachment(mailId, mailType, index, action) {
  const route = mailType === "inbox" ? "inbox" : "history";

  // Show loading state — use class to identify button type
  const viewBtns = document.querySelectorAll(
    `.att-view-btn[data-mail-id="${mailId}"][data-index="${index}"]`
  );
  const dlBtns = document.querySelectorAll(
    `.att-dl-btn[data-mail-id="${mailId}"][data-index="${index}"]`
  );
  const allBtns = [...viewBtns, ...dlBtns];

  allBtns.forEach(b => { b.disabled = true; b.textContent = "…"; });

  let att;
  try {
    const res = await fetch(
      `${BACKEND}/${route}/${encodeURIComponent(mailId)}/attachment/${index}`,
      { method: "GET", headers: { "Authorization": `Bearer ${token}` } }
    );
    if (res.status === 401) { doLogout(); return; }
    const respData = await res.json();
    if (!res.ok) {
      if (res.status === 410 || respData.error === "legacy") {
        showAttachmentError("This attachment is from before the R2 migration and cannot be retrieved. Newer mails will work fine.");
      } else {
        showAttachmentError(respData.error || "Attachment load failed.");
      }
      return;
    }
    att = respData.attachment;
  } catch {
    showToast("Network error loading attachment.", "error");
    return;
  } finally {
    // Restore each button to its own original label using data-action
    viewBtns.forEach(b => { b.disabled = false; b.textContent = "VIEW"; });
    dlBtns.forEach(b  => { b.disabled = false; b.textContent = "DL"; });
    // Also restore any button that matched by both classes (fallback)
    document.querySelectorAll(
      `button[data-mail-id="${mailId}"][data-index="${index}"]`
    ).forEach(b => {
      b.disabled = false;
      b.textContent = (b.dataset.action === "view") ? "VIEW" : "DL";
    });
  }

  if (!att) { showToast("Attachment not found.", "error"); return; }

  const ext      = getExt(att.filename);
  const mimeType = att.mimeType || guessMime(ext);

  // ── Fast path: R2 direct URL (no base64 roundtrip — loads instantly) ──
  if (att.r2Url) {
    if (action === "download") {
      // For download: fetch the file and trigger save
      triggerDownloadFromUrl(att.r2Url, att.filename);
      return;
    }
    openViewer(att.r2Url, att.filename, ext, mimeType, false /* not a blob */);
    return;
  }

  // ── Slow path: base64 data (sent mail KV or legacy fallback) ──
  if (!att.data) {
    showAttachmentError("This attachment cannot be retrieved. It may be from before the R2 migration.");
    return;
  }

  const blobUrl = base64ToBlobUrl(att.data, mimeType);

  if (action === "download") {
    triggerDownload(blobUrl, att.filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return;
  }

  openViewer(blobUrl, att.filename, ext, mimeType, true /* is a blob */);
}

// ── VIEWER ─────────────────────────────────────────────────────
// isBlob=true  → URL is a blob:// — revoke when done
// isBlob=false → URL is a real https:// R2 URL — never revoke
function openViewer(url, filename, ext, mimeType, isBlob = true) {
  if (viewerBlobUrl) { URL.revokeObjectURL(viewerBlobUrl); viewerBlobUrl = null; }
  if (isBlob) viewerBlobUrl = url;

  document.getElementById("viewer-filename").textContent = filename;

  const dlBtn = document.getElementById("viewer-download-btn");
  dlBtn.dataset.blobUrl  = url;
  dlBtn.dataset.filename = filename;
  dlBtn.dataset.isBlob   = isBlob ? "1" : "0";

  const content = document.getElementById("viewer-content");
  content.innerHTML = "";

  if (IMAGE_EXTS.has(ext) || (mimeType && mimeType.startsWith("image/"))) {
    content.innerHTML = `<img src="${url}" alt="${esc(filename)}" class="viewer-img" />`;

  } else if (VIDEO_EXTS.has(ext) || (mimeType && mimeType.startsWith("video/"))) {
    content.innerHTML = `<video controls class="viewer-media" src="${url}"></video>`;

  } else if (AUDIO_EXTS.has(ext) || (mimeType && mimeType.startsWith("audio/"))) {
    content.innerHTML = `<audio controls class="viewer-media" src="${url}"></audio>`;

  } else if (PDF_EXTS.has(ext)) {
    content.innerHTML = `<iframe src="${url}" class="viewer-frame" title="${esc(filename)}"></iframe>`;

  } else if (TEXT_EXTS.has(ext)) {
    fetch(url)
      .then(r => r.text())
      .then(txt => {
        content.innerHTML = `<pre class="viewer-text">${esc(txt)}</pre>`;
      })
      .catch(() => {
        content.innerHTML = `<div class="viewer-error">Could not load text content.</div>`;
      });
  } else {
    content.innerHTML = `<div class="viewer-error">Preview not available for this file type.<br>Use the DOWNLOAD button.</div>`;
  }

  document.getElementById("viewer-modal").classList.remove("hidden");
}

function closeViewer() {
  document.getElementById("viewer-modal").classList.add("hidden");
  document.getElementById("viewer-content").innerHTML = "";
  // Only revoke blob:// URLs — never revoke real R2 https:// URLs
  if (viewerBlobUrl) {
    URL.revokeObjectURL(viewerBlobUrl);
    viewerBlobUrl = null;
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function getExt(filename) {
  if (!filename) return "";
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function guessMime(ext) {
  const map = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif",  webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4",  webm: "video/webm", mov: "video/quicktime",
    mp3: "audio/mpeg", wav: "audio/wav",   ogg: "audio/ogg",
    pdf: "application/pdf",
    txt: "text/plain", csv: "text/csv",    json: "application/json",
    html: "text/html", htm: "text/html",
  };
  return map[ext] || "application/octet-stream";
}

function base64ToBlobUrl(b64, mimeType) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function triggerDownload(blobUrl, filename) {
  const a = document.createElement("a");
  a.href     = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Download from a real https:// URL (R2 direct) — fetch → blob → save
async function triggerDownloadFromUrl(url, filename) {
  try {
    const res   = await fetch(url);
    if (!res.ok) throw new Error("Fetch failed");
    const blob  = await res.blob();
    const bUrl  = URL.createObjectURL(blob);
    triggerDownload(bUrl, filename);
    setTimeout(() => URL.revokeObjectURL(bUrl), 5000);
  } catch {
    showToast("Download failed — try again.", "error");
  }
}

function formatSize(bytes) {
  if (!bytes) return "? KB";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── cleanFrom ─────────────────────────────────────────────────
// Sent mail from  : stored as "alias <alias@psychodead.qzz.io>"  → show email
// Received mail from: stored as raw email "x@y.com" (new worker)
//                     OR old format "Name <x@y.com>" (legacy mails)
// Either way — ALWAYS extract and show the email address only.
function cleanFrom(from, mailType) {
  if (!from) return "";
  const s = from.trim();

  // Step 1: try to extract email from angle brackets "Name <email@domain>"
  const bracketMatch = s.match(/<([^>@\s]+@[^>\s]+)>/);
  if (bracketMatch) {
    const email = bracketMatch[1].trim().toLowerCase();
    return email.length > 38 ? email.slice(0, 36) + "\u2026" : email;
  }

  // Step 2: no brackets — check if the whole string is already a bare email
  if (s.includes("@")) {
    const email = s.toLowerCase();
    // Skip UUID/hash-only local parts
    const local  = email.split("@")[0] || "";
    const domain = email.split("@")[1] || "";
    if (/^[0-9a-f\-]{12,}$/i.test(local) || local.length > 32) {
      return domain.length > 34 ? domain.slice(0, 32) + "\u2026" : domain;
    }
    return email.length > 38 ? email.slice(0, 36) + "\u2026" : email;
  }

  // Step 3: sent mail fallback — append domain (shouldn't normally happen)
  if (mailType === "sent") {
    const bare = `${s}@${DOMAIN}`;
    return bare.length > 38 ? bare.slice(0, 36) + "\u2026" : bare;
  }

  // Step 4: no email at all — truncate raw string
  return s.length > 30 ? s.slice(0, 28) + "\u2026" : s;
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

function showError(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }
function showSuc(el, msg) {
  el.textContent = msg; el.classList.remove("hidden");
  setTimeout(() => hideMsg(el), 5000);
}
function hideMsg(el) { if (el) el.classList.add("hidden"); }

// ── FILENAME TRUNCATION ───────────────────────────────────────
// Middle truncate: "Screenshot_2026…45.jpg" — keeps extension visible
function truncateFilename(name, maxLen) {
  if (!name || name.length <= maxLen) return name;
  const dot  = name.lastIndexOf(".");
  const ext  = dot > 0 ? name.slice(dot) : "";
  const base = dot > 0 ? name.slice(0, dot) : name;
  const keep = maxLen - ext.length - 3; // 3 for "…"
  if (keep < 4) return name.slice(0, maxLen - 1) + "…";
  return base.slice(0, Math.ceil(keep / 2)) + "…" + base.slice(-Math.floor(keep / 2)) + ext;
}

// ── CUSTOM CONFIRM DIALOG ─────────────────────────────────────
// BUG 3 FIX: stopPropagation on buttons prevents overlay-click from firing after button click
function showConfirmDialog(title, subtitle, onConfirm, onCancel) {
  const existing = document.getElementById("custom-confirm-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "custom-confirm-overlay";
  overlay.className = "custom-confirm-overlay";
  overlay.innerHTML = `
    <div class="custom-confirm-box">
      <div class="custom-confirm-icon">⚠</div>
      <div class="custom-confirm-title">${esc(title)}</div>
      ${subtitle ? `<div class="custom-confirm-sub">${esc(subtitle)}</div>` : ""}
      <div class="custom-confirm-btns">
        <button class="btn-ghost custom-confirm-cancel">CANCEL</button>
        <button class="btn-danger custom-confirm-ok">DELETE</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));

  const close = () => {
    // Immediately disable all buttons to prevent double-fire during fade-out
    overlay.querySelectorAll("button").forEach(b => b.disabled = true);
    overlay.style.pointerEvents = "none";
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 250);
  };

  // stopPropagation prevents click from bubbling to the overlay
  overlay.querySelector(".custom-confirm-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
    close();
    if (onCancel) onCancel();
  });
  overlay.querySelector(".custom-confirm-ok").addEventListener("click", (e) => {
    e.stopPropagation();
    close();
    if (onConfirm) onConfirm();
  });
  // Clicking the dark backdrop = cancel
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { close(); if (onCancel) onCancel(); }
  });
}

// ── ATTACHMENT ERROR TOAST ────────────────────────────────────
function showAttachmentError(msg) {
  showToast(msg, "error");
}

function showToast(msg, type = "info") {
  const existing = document.getElementById("gm-toast");
  if (existing) existing.remove();

  const t = document.createElement("div");
  t.id = "gm-toast";
  t.className = `gm-toast gm-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("visible"));
  setTimeout(() => { t.classList.remove("visible"); setTimeout(() => t.remove(), 400); }, 4000);
}
