/* NoteVault — markdown notes, vanilla JS + localStorage. */
"use strict";

const KEY = "notevault-v1";
const $ = (id) => document.getElementById(id);

let notes = load();
let activeId = notes.length ? notes[0].id : null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
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

function renderList() {
  const q = $("search").value.trim().toLowerCase();
  const ul = $("noteList");
  ul.innerHTML = "";
  for (const n of notes) {
    if (q && !(n.title + " " + n.body).toLowerCase().includes(q)) continue;
    const li = document.createElement("li");
    if (n.id === activeId) li.className = "active";
    const strong = document.createElement("strong");
    strong.textContent = n.title || "Untitled";
    const small = document.createElement("small");
    small.textContent = new Date(n.updated).toLocaleString();
    li.append(strong, small);
    li.addEventListener("click", () => { activeId = n.id; renderAll(); });
    ul.appendChild(li);
  }
}

function renderEditor() {
  const n = active();
  $("noteTitle").value = n ? n.title : "";
  $("editor").value = n ? n.body : "";
  $("preview").innerHTML = renderMarkdown(n ? n.body : "");
  $("noteTitle").disabled = $("editor").disabled = $("delBtn").disabled = !n;
}

function renderAll() { renderList(); renderEditor(); }

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
  const n = { id: Date.now(), title: "", body: "", updated: Date.now() };
  notes.unshift(n); activeId = n.id; save(); renderAll();
  $("noteTitle").focus();
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

if (!notes.length) {
  notes = [{ id: Date.now(), title: "Welcome", updated: Date.now(),
    body: "# Welcome to NoteVault\n\nWrite **markdown** on the left, see it *live* on the right.\n\n- Create notes\n- Search instantly\n- Everything stays in your browser" }];
  activeId = notes[0].id; save();
}
renderAll();
