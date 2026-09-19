# ryker@mines:~$

Live: **<https://hateandlovemodding.github.io>**

## What this is

My personal website: a Gruvbox-themed, dual-mode portfolio built with plain HTML, CSS and
vanilla JavaScript. No framework, no build step, no CDN calls at runtime. There is a normal
site (home, projects, blog, uses, contact) and a terminal mode, a full-screen shell-like
overlay that reads the same content and answers commands like `projects`, `blog`, `resume`,
`uses`, and `git log`.

Content for projects and posts lives once, in `content/index.json` plus one Markdown file per
item, and every surface (project cards, detail pages, terminal mode) renders it from there.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Everything is a static file, so any static file server
works; this is just the one `RESOURCES.md`/the course recommends.

## File layout

```
index.html            home
projects.html         project cards, from content/index.json
project.html           one project, ?slug=
blog.html              post cards
post.html               one post, ?slug=
uses.html               the setup page
contact.html            contact + resume
css/gruvbox.css         color tokens, dark + light
css/site.css             layout, typography, terminal chrome
css/fonts/               vendored JetBrains Mono
js/theme.js              theme toggle + localStorage
js/content.js            fetch + render JSON/Markdown, shared by every page
js/pages.js              card-grid rendering, shared page wiring
js/terminal.js           terminal mode
js/vendor/marked.js      vendored Markdown renderer, no CDN
content/index.json       single source of truth for all project/post metadata
content/projects/*.md    one file per project
content/posts/*.md       one file per post
content/commits.json     generated changelog for the terminal's `git log` command
resume.md                phone number stripped; source for `cat resume` and curl
resume.pdf               the download
scripts/generate-commits.py   regenerates content/commits.json from git history
CLAUDE.md                short working conventions for future agents in this repo
DECISIONS.md             decision log
verification/            proof the live site works
```

## Regenerating generated files

**`content/commits.json`** (the terminal's `git log` output), from the repo root:

```bash
python3 scripts/generate-commits.py
```

Run it after any commit you want reflected in the terminal changelog, then commit the
regenerated file along with your change.

**`resume.pdf`**, from `resume.md`:

```bash
pandoc resume.md -o resume.pdf -V geometry:margin=0.5in
```

Keep `resume.md` and `resume.pdf` in sync, and keep the phone number out of both; only the
version emailed directly carries it.
