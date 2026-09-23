# Verification

Proof that the live site at <https://hateandlovemodding.github.io> serves this site, not just
that it works on localhost. `feature/site-rebuild` was merged to `main` on 2026-09-22, GitHub
Pages built commit `c01d1fd`, and the two files below were captured from the live URL after
that build. `fetch-before-merge.txt` is the same capture taken on 2026-09-19, before the merge,
so comparing the two shows the deploy actually changed what the URL serves.

```
verification/
  capture.sh              script that fetches the live URL and stamps the date
  fetch-before-merge.txt  baseline: the live site BEFORE the merge (the old template page)
  fetch.txt               the live site AFTER the merge, captured with capture.sh
  screenshot.png          the live site in a browser, URL bar visible, after the merge
  README.md               this file
```

## The three-line note

```
URL checked: https://hateandlovemodding.github.io
When: 2026-09-22 21:46 MDT (2026-09-23 03:46 UTC), the timestamp in fetch.txt
What would have made this fail: the site not being deployed from main; fetch-before-merge.txt shows exactly that, the template's "Hello, world" page with css/site.css and resume.md returning 404.
```

## How to recapture

From the repo root, run `verification/capture.sh > verification/fetch.txt` and confirm it shows
200 for the page, `css/site.css`, and `resume.md`, and that the markup sample is the real site,
not "Hello, world". GitHub can cache a page for up to 10 minutes after a push, so recheck before
assuming something is wrong.
