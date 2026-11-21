/* NoteVault — markdown notes, vanilla JS + localStorage. */
"use strict";

const KEY = "notevault-v1";
const SORT_KEY = "notevault-sort-v1";
const THEME_KEY = "notevault-theme-v1";
const $ = (id) => document.getElementById(id);

let notes = load();
let activeId = notes.length ? notes[0].id : null;
let activeTag = null; // tag filter for the note list, null = show all
let trashView = false; // viewing the trash bin instead of live notes
let sortMode = loadSortMode();
const THEMES = ["dark", "light"];
let theme = loadTheme();

/*
 * Theme: a saved choice wins; otherwise follow the OS preference
 * (prefers-color-scheme); the default is the existing dark theme.
 * The choice is a `light` class on <body>, so every color comes from
 * the CSS variables and the whole UI — editor, preview, code blocks — flips.
 */
function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch { /* fall through */ }
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  } catch { /* fall through */ }
  return "dark";
}
function applyTheme() {
  document.body.classList.toggle("light", theme === "light");
  const btn = $("themeBtn");
  btn.textContent = theme === "light" ? "🌙 Dark theme" : "☀️ Light theme";
  btn.setAttribute("aria-pressed", String(theme === "light"));
  btn.title = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
}
function toggleTheme() {
  theme = theme === "light" ? "dark" : "light";
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  applyTheme();
}

/* Sort modes: pinned notes always stay on top, the mode orders the rest. */
const SORTS = {
  updated: { label: "Recently updated", cmp: (a, b) => b.updated - a.updated },
  created: { label: "Recently created", cmp: (a, b) => b.created - a.created },
  az: { label: "Title A–Z", cmp: (a, b) => titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: "base" }) },
};
function titleOf(n) { return (n.title || "").trim() || "Untitled"; }
function loadSortMode() {
  try {
    const m = localStorage.getItem(SORT_KEY);
    if (SORTS[m]) return m;
  } catch { /* fall through */ }
  return "updated";
}
function sortNotes(list) {
  const cmp = SORTS[sortMode].cmp;
  return [...list].sort((a, b) => (b.pinned - a.pinned) || cmp(a, b));
}

function load() {
  let parsed;
  try { parsed = JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
  for (const n of parsed) {
    if (!Array.isArray(n.tags)) n.tags = [];
    n.tags = [...new Set(n.tags.filter((t) => typeof t === "string")
      .map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10))];
    n.pinned = n.pinned === true; // notes gained a pin flag; older saves lack it
    /* Notes gained a created stamp; older saves fall back to their update time. */
    n.created = typeof n.created === "number" ? n.created : n.updated;
    /* Notes gained a trash flag; older saves are all live notes. */
    n.deleted = n.deleted === true;
    n.deletedAt = typeof n.deletedAt === "number" ? n.deletedAt : null;
  }
  return parsed;
}
function save() { localStorage.setItem(KEY, JSON.stringify(notes)); }
const active = () => notes.find((n) => n.id === activeId) || null;

/*
 * Trash bin: soft-deleted notes stay in the vault with `deleted` set,
 * so they can be restored; only "delete forever" removes them for good.
 * The trash view lists deleted notes, most recently deleted first.
 */
const liveNotes = () => notes.filter((n) => !n.deleted);
const trashedNotes = () => notes.filter((n) => n.deleted);
function visibleNotes() { return trashView ? trashedNotes() : liveNotes(); }
function trashNote(n) {
  if (!n || n.deleted) return;
  n.deleted = true;
  n.deletedAt = Date.now();
  n.updated = Date.now();
  save();
}
function restoreNote(n) {
  if (!n || !n.deleted) return;
  n.deleted = false;
  n.deletedAt = null;
  n.updated = Date.now();
  save();
}
function deleteNoteForever(n) {
  if (!n) return;
  notes = notes.filter((x) => x.id !== n.id);
  save();
}
function emptyTrash() {
  const count = trashedNotes().length;
  if (!count) return;
  if (!confirm(`Empty the trash? This permanently deletes ${count} note${count === 1 ? "" : "s"}.`)) return;
  notes = liveNotes();
  if (trashView) activeId = null;
  save(); renderAll();
}
/* After a delete/restore, point at the first note in the current view. */
function pickActiveAfterChange() {
  const list = visibleNotes();
  activeId = list.length ? list[0].id : null;
}
function toggleTrashView() {
  trashView = !trashView;
  activeTag = null;
  pickActiveAfterChange();
  renderAll();
}

/* Minimal, safe markdown subset: escape first, then format. */
function renderMarkdown(src) {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    /* Images first: `![alt](url)` would otherwise match the link rule below and leave a stray `!`. Only http(s) URLs, like links. */
    .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let html = "", inList = false, inOrdered = false, inCode = false, codeLang = "", codeBuf = [];
  /* Blockquotes: consecutive `> ` lines gather into one <blockquote>. */
  let inQuote = false, quoteBuf = [];
  const closeQuote = () => {
    if (!inQuote) return;
    html += "<blockquote>" + quoteBuf.map((q) => "<p>" + inline(q) + "</p>").join("") + "</blockquote>";
    inQuote = false; quoteBuf = [];
  };
  for (const line of esc.split("\n")) {
    /* Fenced code block: ```lang opens, ``` closes; inside, text stays raw. */
    const fence = /^```(\S*)\s*$/.exec(line);
    if (fence) {
      closeQuote();
      if (inCode) {
        html += codeBlockHtml(codeBuf.join("\n"), codeLang);
        inCode = false; codeBuf = [];
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        if (inOrdered) { html += "</ol>"; inOrdered = false; }
        inCode = true; codeLang = fence[1] || "";
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    /* A `> ` line joins the open quote; any other line closes it first.
       (The source is already HTML-escaped, so `>` arrives as `&gt;`.) */
    const quote = /^&gt;\s?(.*)$/.exec(line);
    if (quote) {
      if (inList) { html += "</ul>"; inList = false; }
      if (inOrdered) { html += "</ol>"; inOrdered = false; }
      inQuote = true;
      if (quote[1].trim()) quoteBuf.push(quote[1]);
      continue;
    }
    if (inQuote) closeQuote();
    /* Horizontal rule: a line of three or more -, * or _ characters. */
    if (/^(\*\*\*+|---+|___+)\s*$/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      if (inOrdered) { html += "</ol>"; inOrdered = false; }
      html += "<hr>";
      continue;
    }
    if (/^\s*-\s+/.test(line)) {
      if (inOrdered) { html += "</ol>"; inOrdered = false; }
      if (!inList) { html += "<ul>"; inList = true; }
      /* Task list: `- [ ]` / `- [x]` renders as a (read-only) checkbox. */
      const task = /^\s*-\s+\[([ xX])\]\s+(.*)$/.exec(line);
      if (task) {
        html += '<li class="task"><input type="checkbox" disabled' + (task[1].toLowerCase() === "x" ? " checked" : "") + '> ' + inline(task[2]) + "</li>";
      } else {
        html += "<li>" + inline(line.replace(/^\s*-\s+/, "")) + "</li>";
      }
      continue;
    }
    /* Ordered list: `1. ` lines gather into an <ol> (numbering is the author's). */
    if (/^\s*\d+\.\s+/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      if (!inOrdered) { html += "<ol>"; inOrdered = true; }
      html += "<li>" + inline(line.replace(/^\s*\d+\.\s+/, "")) + "</li>";
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (inOrdered) { html += "</ol>"; inOrdered = false; }
    if (/^###\s/.test(line)) html += "<h3>" + inline(line.slice(4)) + "</h3>";
    else if (/^##\s/.test(line)) html += "<h2>" + inline(line.slice(3)) + "</h2>";
    else if (/^#\s/.test(line)) html += "<h1>" + inline(line.slice(2)) + "</h1>";
    else if (line.trim()) html += "<p>" + inline(line) + "</p>";
  }
  if (inList) html += "</ul>";
  if (inOrdered) html += "</ol>";
  if (inQuote) closeQuote();
  if (inCode) html += codeBlockHtml(codeBuf.join("\n"), codeLang); // unclosed fence still renders as code
  return html || '<p style="color:var(--muted)">Preview appears here…</p>';
}

/*
 * Tiny syntax highlighter for fenced code blocks: keywords, strings,
 * numbers, comments and function names, in the GitHub-dark palette.
 * It runs on already-escaped text, so it can never inject markup.
 * `#` comments are only treated as comments for languages that use
 * them (Python, shell, …) — CSS `#id` selectors stay code.
 */
const CODE_KEYWORDS = new Set(("const let var function return if elif else for while do switch case break continue new class extends implements super this self typeof instanceof in of try catch except finally throw throws import from export default async await def lambda with as pass global nonlocal assert del yield print public private protected static final void int long short byte float double boolean char enum struct typedef namespace using true false null undefined True False None and or not is").split(" "));
const HASH_COMMENT_LANGS = new Set(["py", "python", "rb", "ruby", "sh", "bash", "zsh", "shell", "yml", "yaml", "toml", "r", "pl", "perl"]);
const NO_HASH_LANGS = new Set(["js", "javascript", "ts", "typescript", "java", "c", "h", "cpp", "c++", "cs", "csharp", "go", "rust", "rs", "php", "swift", "kotlin", "kt", "scala", "css", "html", "xml", "svg"]);
/* groups: 1 comment, 2 string, 3 number, 4 function name, 5 plain word */
const TOKEN_RE_HASH = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\\n]|\\.)*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)(?=\s*\()|\b([A-Za-z_$][\w$]*)\b/g;
const TOKEN_RE_NOHASH = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\\n]|\\.)*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)(?=\s*\()|\b([A-Za-z_$][\w$]*)\b/g;

function highlightCode(code, lang) {
  const l = (lang || "").toLowerCase();
  const re = (HASH_COMMENT_LANGS.has(l) || !NO_HASH_LANGS.has(l)) ? TOKEN_RE_HASH : TOKEN_RE_NOHASH;
  return code.replace(re, (m, com, str, num, fn, word) => {
    if (com) return '<span class="tok-com">' + com + "</span>";
    if (str) return '<span class="tok-str">' + str + "</span>";
    if (num) return '<span class="tok-num">' + num + "</span>";
    if (fn) return '<span class="' + (CODE_KEYWORDS.has(fn) ? "tok-kw" : "tok-fn") + '">' + fn + "</span>";
    if (word) return CODE_KEYWORDS.has(word) ? '<span class="tok-kw">' + word + "</span>" : word;
    return m;
  });
}

function codeBlockHtml(code, lang) {
  const safeLang = (lang || "").replace(/[^a-z0-9-]/gi, "");
  const cls = safeLang ? ' class="language-' + safeLang + '"' : "";
  return "<pre><code" + cls + ">" + highlightCode(code, lang) + "</code></pre>";
}

function allTags() {
  const set = new Set();
  for (const n of visibleNotes()) for (const t of n.tags) set.add(t);
  return [...set].sort();
}

function renderTagFilter() {
  const bar = $("tagFilter");
  bar.innerHTML = "";
  const tags = allTags();
  if (!tags.length) { bar.hidden = true; return; }
  bar.hidden = false;
  for (const t of tags) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tagchip" + (activeTag === t ? " on" : "");
    chip.textContent = "#" + t;
    chip.title = activeTag === t ? "Clear tag filter" : "Show only notes tagged " + t;
    chip.addEventListener("click", () => {
      activeTag = activeTag === t ? null : t;
      renderList(); renderTagFilter();
    });
    bar.appendChild(chip);
  }
  if (activeTag) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "tagchip clear";
    clear.textContent = "✕ clear";
    clear.addEventListener("click", () => { activeTag = null; renderList(); renderTagFilter(); });
    bar.appendChild(clear);
  }
}

function renderList() {
  const q = $("search").value.trim().toLowerCase();
  const ul = $("noteList");
  ul.innerHTML = "";
  /* In the trash, most recently deleted first; live notes use the chosen sort. */
  const ordered = trashView
    ? [...visibleNotes()].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
    : sortNotes(visibleNotes());
  for (const n of ordered) {
    if (q && !(n.title + " " + n.body).toLowerCase().includes(q)) continue;
    if (activeTag && !n.tags.includes(activeTag)) continue;
    const li = document.createElement("li");
    const cls = [];
    if (n.id === activeId) cls.push("active");
    if (n.pinned) cls.push("pinned");
    if (n.deleted) cls.push("trashed");
    li.className = cls.join(" ");
    const strong = document.createElement("strong");
    strong.textContent = (n.pinned ? "📌 " : "") + (n.title || "Untitled");
    const small = document.createElement("small");
    small.textContent = trashView && n.deletedAt
      ? "Deleted " + new Date(n.deletedAt).toLocaleString()
      : new Date(n.updated).toLocaleString();
    li.append(strong, small);
    if (n.tags.length) {
      const tagRow = document.createElement("div");
      tagRow.className = "tags";
      for (const t of n.tags) {
        /* A tag chip is also a filter: click it to show only notes with
           that tag — the same one-click filter as the tag bar above the
           list. Clicking the active tag again clears the filter. */
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag";
        chip.textContent = "#" + t;
        chip.title = activeTag === t ? "Clear tag filter" : "Show only notes tagged " + t;
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          activeTag = activeTag === t ? null : t;
          renderList(); renderTagFilter();
        });
        tagRow.appendChild(chip);
      }
      li.appendChild(tagRow);
    }
    li.addEventListener("click", () => { activeId = n.id; renderAll(); });
    ul.appendChild(li);
  }
}

function renderTags() {
  const n = active();
  const bar = $("tagChips");
  bar.innerHTML = "";
  if (n) for (const t of n.tags) {
    const chip = document.createElement("span");
    chip.className = "tag editable";
    chip.textContent = "#" + t + " ";
    const x = document.createElement("button");
    x.type = "button"; x.className = "tagx"; x.textContent = "✕";
    x.title = "Remove tag " + t;
    x.addEventListener("click", () => removeTag(t));
    chip.appendChild(x);
    bar.appendChild(chip);
  }
  $("tagInput").disabled = !n || n.deleted;
  $("tagInput").value = "";
  $("tagInput").placeholder = n ? "Add tag… press Enter" : "";
}

function normTag(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 20);
}

function addTag(raw) {
  const n = active();
  const t = normTag(raw);
  if (!n || !t || n.tags.includes(t) || n.tags.length >= 10) return;
  n.tags.push(t); n.updated = Date.now();
  notes.sort((a, b) => b.updated - a.updated);
  save(); renderAll();
}

function removeTag(t) {
  const n = active();
  if (!n) return;
  n.tags = n.tags.filter((x) => x !== t);
  if (activeTag === t && !notes.some((x) => x.tags.includes(t))) activeTag = null;
  n.updated = Date.now();
  notes.sort((a, b) => b.updated - a.updated);
  save(); renderAll();
}

function renderEditor() {
  const n = active();
  /* A trashed note is read-only: restore it or delete it forever. */
  const trashed = !!(trashView && n && n.deleted);
  $("noteTitle").value = n ? n.title : "";
  $("editor").value = n ? n.body : "";
  $("preview").innerHTML = renderMarkdown(n ? n.body : "");
  $("noteTitle").disabled = $("editor").disabled = !n || trashed;
  $("delBtn").disabled = !n;
  $("delBtn").textContent = trashed ? "Delete forever" : "Delete";
  $("restoreBtn").hidden = !trashed;
  $("exportBtn").disabled = !n || trashed;
  $("copyBtn").disabled = !n || trashed;
  $("pinBtn").disabled = !n || trashed;
  $("pinBtn").textContent = n && n.pinned ? "📌 Pinned" : "📌 Pin";
  $("pinBtn").classList.toggle("on", !!(n && n.pinned));
  renderTags();
  renderCounts();
}

/* Live word / character / line count for the open note, shown in the footer. */
function countWords(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
/*
 * Reading time: ~200 words per minute, rounded up, at least 1 minute
 * for a non-empty note; 0 (no estimate shown) for an empty one.
 */
function readingTimeMinutes(text) {
  const words = countWords(text);
  return words ? Math.max(1, Math.ceil(words / 200)) : 0;
}
function renderCounts() {
  const n = active();
  if (!n) { $("counts").textContent = "No note open"; return; }
  const body = n.body;
  const lines = body ? body.split("\n").length : 0;
  const mins = readingTimeMinutes(body);
  $("counts").textContent = countWords(body) + " words · " + body.length + " characters · " + lines + " lines"
    + (mins ? " · ~" + mins + " min read" : "");
}

function togglePin() {
  const n = active();
  if (!n) return;
  n.pinned = !n.pinned;
  save(); renderAll();
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50)
    || "untitled-note";
}

/* The .md text for a note: title as an H1 unless the body already opens with it. */
function noteMarkdown(n) {
  const title = n.title.trim();
  const body = n.body.replace(/^\s+/, "");
  if (!title) return body;
  if (body.split("\n")[0] === "# " + title) return body;
  return "# " + title + (body ? "\n\n" + body : "\n");
}

function downloadFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename, text) {
  downloadFile(filename, text, "text/markdown;charset=utf-8");
}

function exportActiveNote() {
  const n = active();
  if (!n) return;
  downloadText(slugify(n.title) + ".md", noteMarkdown(n));
}

/*
 * Copy the open note as markdown to the clipboard. Uses the async
 * clipboard API when available, with a hidden-textarea fallback for
 * browsers or contexts without clipboard access. The button briefly
 * confirms the result, then goes back to its normal label.
 */
async function copyActiveNote() {
  const n = active();
  if (!n) return;
  const text = noteMarkdown(n);
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch { /* fall through to the fallback */ }
  if (!ok) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
  }
  const btn = $("copyBtn");
  btn.textContent = ok ? "✓ Copied" : "Copy failed";
  setTimeout(() => { btn.textContent = "📋 Copy"; }, 1500);
}

/*
 * Export all notes: the whole vault travels as one .json bundle
 * { app, version, exportedAt, count, notes } so it can be backed up or
 * moved to another browser in a single file. Each note keeps its id,
 * title, body, tags, pin and timestamps.
 */
function serializeVault() {
  return JSON.stringify({ app: "notevault", version: 1, exportedAt: new Date().toISOString(), count: notes.length, notes }, null, 2);
}
function exportAllNotes() {
  downloadFile("notevault-all-notes-" + new Date().toISOString().slice(0, 10) + ".json", serializeVault(), "application/json;charset=utf-8");
}

/*
 * Turn one .md file's text into a note. The first "# ..." heading becomes
 * the title (the rest is the body); without one, the filename is the title.
 * Returns the new note.
 */
function importMarkdownText(text, filename) {
  const lines = text.replace(/^\uFEFF/, "").split("\n");
  let title = "";
  let body = text;
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first !== -1 && /^#\s+/.test(lines[first])) {
    title = lines[first].replace(/^#\s+/, "").trim().slice(0, 80);
    body = lines.slice(first + 1).join("\n").replace(/^\s+/, "");
  } else {
    title = (filename || "").replace(/\.(md|markdown)$/i, "").replace(/[-_]+/g, " ").trim().slice(0, 80);
  }
  const n = { id: Date.now() + Math.floor(Math.random() * 1000), title, body, tags: [], pinned: false, deleted: false, deletedAt: null, created: Date.now(), updated: Date.now() };
  notes.unshift(n);
  return n;
}

function renderAll() { renderTagFilter(); renderList(); renderEditor(); renderTrashButtons(); }

/* Trash button shows how many notes are in the bin and lights up in the trash view. */
function renderTrashButtons() {
  const count = trashedNotes().length;
  $("trashBtn").textContent = "🗑️ Trash" + (count ? " (" + count + ")" : "");
  $("trashBtn").classList.toggle("on", trashView);
  $("emptyTrashBtn").hidden = !(trashView && count);
}

function touch() {
  const n = active();
  if (!n) return;
  n.title = $("noteTitle").value;
  n.body = $("editor").value;
  n.updated = Date.now();
  notes.sort((a, b) => b.updated - a.updated);
  save();
  $("preview").innerHTML = renderMarkdown(n.body);
  renderCounts();
  renderList();
}

$("newBtn").addEventListener("click", () => {
  /* A new note is live, so leave the trash view to show it. */
  if (trashView) { trashView = false; activeTag = null; }
  const n = { id: Date.now(), title: "", body: "", tags: [], pinned: false, deleted: false, deletedAt: null, created: Date.now(), updated: Date.now() };
  notes.unshift(n); activeId = n.id; save(); renderAll();
  $("noteTitle").focus();
});
/* Theme toggle: flips dark/light and remembers the choice. */
$("themeBtn").addEventListener("click", toggleTheme);
$("pinBtn").addEventListener("click", togglePin);
$("exportBtn").addEventListener("click", exportActiveNote);
$("copyBtn").addEventListener("click", copyActiveNote);
$("exportAllBtn").addEventListener("click", exportAllNotes);
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", () => {
  const files = [...$("importFile").files];
  if (!files.length) return;
  let firstNew = null;
  let pending = files.length;
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = () => {
      const n = importMarkdownText(String(reader.result || ""), file.name);
      if (!firstNew) firstNew = n;
      if (--pending === 0) {
        /* Imported notes are live, so leave the trash view to show them. */
        if (trashView) { trashView = false; activeTag = null; }
        activeId = firstNew.id;
        save(); renderAll();
      }
    };
    reader.readAsText(file);
  }
  $("importFile").value = ""; // allow re-importing the same file later
});
/*
 * Delete: a live note goes to the trash (soft delete); a trashed note is
 * deleted forever, after a confirm. Restore moves a trashed note back.
 */
$("delBtn").addEventListener("click", () => {
  const n = active();
  if (!n) return;
  if (trashView && n.deleted) {
    if (!confirm(`Permanently delete "${titleOf(n)}"? This cannot be undone.`)) return;
    deleteNoteForever(n);
  } else {
    trashNote(n);
  }
  pickActiveAfterChange();
  save(); renderAll();
});
$("restoreBtn").addEventListener("click", () => {
  const n = active();
  if (!n || !n.deleted) return;
  restoreNote(n);
  pickActiveAfterChange();
  save(); renderAll();
});
$("trashBtn").addEventListener("click", toggleTrashView);
$("emptyTrashBtn").addEventListener("click", emptyTrash);
$("noteTitle").addEventListener("input", touch);
$("editor").addEventListener("input", touch);
$("search").addEventListener("input", renderList);
/* Sort picker: remembered across visits; re-renders the list on change. */
$("sortSelect").value = sortMode;
$("sortSelect").addEventListener("change", () => {
  sortMode = SORTS[$("sortSelect").value] ? $("sortSelect").value : "updated";
  try { localStorage.setItem(SORT_KEY, sortMode); } catch { /* private mode */ }
  renderList();
});
$("tagInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag($("tagInput").value);
    $("tagInput").value = "";
  }
});

if (!notes.length) {
  notes = [{ id: Date.now(), title: "Welcome", tags: ["welcome"], pinned: false, deleted: false, deletedAt: null, created: Date.now(), updated: Date.now(),
    body: "# Welcome to NoteVault\n\nWrite **markdown** on the left, see it *live* on the right.\n\n- Create notes\n- Search instantly\n- Tag notes and filter by tag\n- Everything stays in your browser" }];
  activeId = notes[0].id; save();
}
applyTheme();
renderAll();
