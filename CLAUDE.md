# Conventions

- Plain HTML, CSS and vanilla JS only. No framework, no build step, no CDN at runtime;
  third-party assets (marked.js, the font) are vendored into the repo and loaded by relative path.
- `content/index.json` is the single source of truth for projects and posts; card pages, detail
  pages and terminal mode all read it, so content is written once and rendered three ways.
- `resume.md` and `resume.pdf` must stay in sync and both stay free of the phone number;
  regenerate the PDF with `pandoc resume.md -o resume.pdf -V geometry:margin=0.5in`.
- Every path is relative (`css/site.css`, never `/css/site.css`) so the site survives living at
  a GitHub Pages root.
- `repo` in `content/index.json` is present only when the source is genuinely public; omit the
  key rather than linking a dead or private repo.
