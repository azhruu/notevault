# NoteVault

**Markdown notes that live in your browser.** Write on the left, see the rendered preview live on the right — with instant search and zero setup.

![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/status-actively%20building-brightgreen?style=for-the-badge)

## Features

- 🌓 Dark/light theme toggle — switch the whole UI (editor, preview, code blocks) between dark and light; your choice is remembered, otherwise it follows your OS setting
- ✍️ Split editor with **live markdown preview** (headings, bold, italic, inline code, fenced code blocks with syntax highlighting, lists, links)
- 🔢 Word & character count — live word, character and line count for the open note in the editor footer
- ↕️ Sort options — order the list by recently updated, recently created, or title A–Z (pinned notes always stay on top); your choice is remembered
- 📌 Pin notes — pin important notes to the top of the list (📌 button in the toolbar, gold border in the list)
- 🔎 Instant full-text search across titles and bodies
- 🏷️ Tags on notes with one-click tag filtering
- 📤 Export the open note as a `.md` file, and import `.md` files as new notes (first `#` heading becomes the title)
- 💾 Auto-save to `localStorage` on every keystroke
- 🛡️ Safe rendering — HTML is escaped before formatting, no injection
- 📱 Responsive layout

## Run it

Open `index.html` in any browser, or:

```bash
python3 -m http.server 8000   # http://localhost:8000
```

## Roadmap

Dark/light theme toggle → export all notes as a single .json bundle. Full plan: [ROADMAP.md](ROADMAP.md).

## License

MIT — see [LICENSE](LICENSE).
