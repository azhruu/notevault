# NoteVault — Build Roadmap

Each item lands as one complete, tested change.

- [x] Core app: notes CRUD, live markdown preview, search, localStorage
- [x] Tags for notes with tag filtering
- [x] Export a note as a .md file (and import .md files)
- [x] Pin important notes to the top
- [x] Word/character count in the editor footer
- [x] Code blocks with syntax coloring in preview
- [x] Sort options (updated / created / A–Z)
- [x] Dark/light theme toggle
- [x] Export all notes as a single .zip-free bundle (.json) — one file with every note (ids, titles, bodies, tags, pins, timestamps) for backup or moving browsers
- [x] Trash bin with restore (soft delete)
- [x] Polish: blockquotes (`> ...`) and horizontal rules (`---`) in the markdown preview — quoted lines gather into one styled blockquote, a `---` line becomes an `<hr>`
- [x] Polish: copy the open note as markdown to the clipboard — one click, with a brief "Copied" confirmation and a fallback for browsers without clipboard access
- [x] Polish: ordered lists (`1. ...`) in the markdown preview — numbered lines gather into an `<ol>`, mixing freely with bullet lists, quotes and code blocks
- [x] Polish: reading-time estimate in the editor footer — "~N min read" at ~200 wpm, shown next to the word count
- [x] Polish: images (`![alt](url)`) in the markdown preview — http(s) images render as `<img>` (constrained to the preview width), other schemes stay literal text
- [x] Polish: task lists (`- [ ]` / `- [x]`) in the markdown preview — they render as real read-only checkboxes, mixing freely with plain bullet items
- [x] Polish: click a tag chip on a note in the list to filter by that tag — the same one-click filter as the tag bar, clicking the active tag again clears it
- [x] Polish: duplicate the open note — one click copies its body and tags into a new note titled "… (copy)" and opens it, so a template or draft can be reused without copy-paste
- [x] Polish: strikethrough (`~~text~~`) in the markdown preview — renders as `<del>`, mixing freely with bold, italic and inline code
- [x] Polish: empty note list shows a message — "No notes match — clear the search or tag filter" when a search or tag filter matches nothing, "Trash is empty" in an empty bin, "No notes yet — click + New note" in an empty vault — instead of a blank sidebar
- [x] Polish: relative timestamps in the note list — "Edited 3 hours ago" / "Deleted 2 days ago" at a glance instead of a full date string, with the exact date on hover; anything older than a few weeks falls back to the plain date
