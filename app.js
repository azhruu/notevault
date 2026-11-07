/* NoteVault — markdown notes, vanilla JS + localStorage. */
"use strict";

const KEY = "notevault-v1";
const $ = (id) => document.getElementById(id);

let notes = load();
let activeId = notes.length ? notes[0].id : null;
let activeTag = null; // tag filter for the note list, null = show all

function load() {
  let parsed;
  try { parsed = JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
  for (const n of parsed) {
    if (!Array.isArray(n.tags)) n.tags = [];
    n.tags = [...new Set(n.tags.filter((t) => typeof t === "string")
      .map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10))];
  }
  return parsed;
}
function save() { localStorage.setItem(KEY, JSON.stringify(notes)); }
const active = () => notes.find((n) => n.id === activeId) || null;

/* Minimal, safe markdown subset: escape first, then format. */
function renderMarkdown(src) {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let html = "", inList = false;
  for (const line of esc.split("\n")) {
    if (/^\s*-\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + inline(line.replace(/^\s*-\s+/, "")) + "</li>";
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (/^###\s/.test(line)) html += "<h3>" + inline(line.slice(4)) + "</h3>";
    else if (/^##\s/.test(line)) html += "<h2>" + inline(line.slice(3)) + "</h2>";
    else if (/^#\s/.test(line)) html += "<h1>" + inline(line.slice(2)) + "</h1>";
    else if (line.trim()) html += "<p>" + inline(line) + "</p>";
  }
  if (inList) html += "</ul>";
  return html || '<p style="color:#8b949e">Preview appears here…</p>';
}

function allTags() {
  const set = new Set();
  for (const n of notes) for (const t of n.tags) set.add(t);
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
  for (const n of notes) {
    if (q && !(n.title + " " + n.body).toLowerCase().includes(q)) continue;
    if (activeTag && !n.tags.includes(activeTag)) continue;
    const li = document.createElement("li");
    if (n.id === activeId) li.className = "active";
    const strong = document.createElement("strong");
    strong.textContent = n.title || "Untitled";
    const small = document.createElement("small");
    small.textContent = new Date(n.updated).toLocaleString();
    li.append(strong, small);
    if (n.tags.length) {
      const tagRow = document.createElement("div");
      tagRow.className = "tags";
      for (const t of n.tags) {
        const chip = document.createElement("span");
        chip.className = "tag";
        chip.textContent = "#" + t;
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
  $("tagInput").disabled = !n;
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
  $("noteTitle").value = n ? n.title : "";
  $("editor").value = n ? n.body : "";
  $("preview").innerHTML = renderMarkdown(n ? n.body : "");
  $("noteTitle").disabled = $("editor").disabled = $("delBtn").disabled = $("exportBtn").disabled = !n;
  renderTags();
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

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportActiveNote() {
  const n = active();
  if (!n) return;
  downloadText(slugify(n.title) + ".md", noteMarkdown(n));
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
  const n = { id: Date.now() + Math.floor(Math.random() * 1000), title, body, tags: [], updated: Date.now() };
  notes.unshift(n);
  return n;
}

function renderAll() { renderTagFilter(); renderList(); renderEditor(); }

function touch() {
  const n = active();
  if (!n) return;
  n.title = $("noteTitle").value;
  n.body = $("editor").value;
  n.updated = Date.now();
  notes.sort((a, b) => b.updated - a.updated);
  save();
  $("preview").innerHTML = renderMarkdown(n.body);
  renderList();
}

$("newBtn").addEventListener("click", () => {
  const n = { id: Date.now(), title: "", body: "", tags: [], updated: Date.now() };
  notes.unshift(n); activeId = n.id; save(); renderAll();
  $("noteTitle").focus();
});
$("exportBtn").addEventListener("click", exportActiveNote);
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
        activeId = firstNew.id;
        save(); renderAll();
      }
    };
    reader.readAsText(file);
  }
  $("importFile").value = ""; // allow re-importing the same file later
});
$("delBtn").addEventListener("click", () => {
  if (!activeId) return;
  notes = notes.filter((n) => n.id !== activeId);
  activeId = notes.length ? notes[0].id : null;
  save(); renderAll();
});
$("noteTitle").addEventListener("input", touch);
$("editor").addEventListener("input", touch);
$("search").addEventListener("input", renderList);
$("tagInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag($("tagInput").value);
    $("tagInput").value = "";
  }
});

if (!notes.length) {
  notes = [{ id: Date.now(), title: "Welcome", tags: ["welcome"], updated: Date.now(),
    body: "# Welcome to NoteVault\n\nWrite **markdown** on the left, see it *live* on the right.\n\n- Create notes\n- Search instantly\n- Tag notes and filter by tag\n- Everything stays in your browser" }];
  activeId = notes[0].id; save();
}
renderAll();
