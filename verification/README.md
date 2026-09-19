# Verification

This is written on `feature/site-rebuild`, before that branch is merged to `main`. The live
URL, <https://hateandlovemodding.github.io>, is served from `main`, so right now it still shows
the template's "Hello, world" page, not this site. Capturing `screenshot.png` or `fetch.txt`
today would document the wrong page, so those two are placeholders (see "To finish" below).
`fetch-before-merge.txt` was captured now on purpose: it is the pre-merge baseline that proves
the deploy actually changed once the real `fetch.txt` is captured after the merge.

```
verification/
  capture.sh              script that fetches the live URL and stamps the date
  fetch-before-merge.txt  baseline: the live site BEFORE the merge (the old template page)
  fetch.txt               PLACEHOLDER, captured after the merge with ./capture.sh
  screenshot.png          PLACEHOLDER, captured after the merge, URL bar visible
  README.md               this file
```

## The three-line note

```
URL checked: https://hateandlovemodding.github.io
When: PLACEHOLDER - fill in after the merge, e.g. 2026-09-22 14:32
What would have made this fail: a stylesheet linked as an absolute path (e.g. href="/css/site.css")
would resolve on localhost, where the server root and the site root are the same directory, but
would 404 on GitHub Pages the moment this repo is not the account's only Pages site sharing that
namespace assumption, or if the site were ever served from a project path instead of the
username.github.io root; the deploy would still report success and the page would render as
unstyled text with every link and script tag broken, which is exactly the failure capture.sh's
curl -sI checks on css/site.css and resume.md are built to catch.
```

## To finish, after the pull request is merged

1. Wait for the Pages build to pick up `main` (usually under a minute; GitHub can cache up to
   10 minutes, so recheck before assuming something is wrong).
2. From the repo root, run `verification/capture.sh > verification/fetch.txt` and confirm it
   shows 200s for the page, `css/site.css`, and `resume.md`, and that the markup sample is the
   real site, not "Hello, world".
3. Open `https://hateandlovemodding.github.io` in a browser with the URL bar visible and save a
   screenshot as `verification/screenshot.png`.
4. Fill in the `When:` line above with the actual date and time you did step 2.
