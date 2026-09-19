/*
 * js/content.js
 * Plain script (no module syntax). Owns fetching content/index.json and the per-item
 * Markdown files, and rendering Markdown to sanitised HTML. Exposes window.Content.
 * Does not touch the DOM except inside the render helpers (renderFetchError); the pages
 * own their own layout.
 */
(function () {
  'use strict';

  var _indexPromise = null;
  var _itemsBySlug = null;

  function isFileProtocol() {
    try {
      return window.location.protocol === 'file:';
    } catch (e) {
      return false;
    }
  }

  // Turns any fetch failure into a message a page can safely display, instead of a
  // blank page or an uncaught console error. file:// is the most common cause.
  function friendlyErrorMessage(what, err) {
    var base = 'Could not load ' + what + '.';
    var hint;
    if (isFileProtocol()) {
      hint = ' This page was opened directly from disk (file://), which browsers block ' +
        'from fetching local files. Run "python3 -m http.server 8000" in the project ' +
        'folder, then open http://localhost:8000 instead.';
    } else {
      hint = ' Try running "python3 -m http.server 8000" in the project folder and ' +
        'opening the page from http://localhost:8000, or check that the file deployed ' +
        'correctly.';
    }
    var detail = err && err.message ? ' (' + err.message + ')' : '';
    return base + hint + detail;
  }

  // loadIndex() -> Promise of the parsed items array. Memoised: repeat calls reuse the
  // same in-flight or resolved promise instead of refetching. A failed fetch clears the
  // memo so a later retry (e.g. after starting a local server) can succeed.
  function loadIndex() {
    if (_indexPromise) return _indexPromise;

    _indexPromise = fetch('content/index.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = data && Array.isArray(data.items) ? data.items : [];
        _itemsBySlug = {};
        items.forEach(function (item) {
          if (item && item.slug) _itemsBySlug[item.slug] = item;
        });
        return items;
      })
      .catch(function (err) {
        _indexPromise = null;
        _itemsBySlug = null;
        throw new Error(friendlyErrorMessage('the content index (content/index.json)', err));
      });

    return _indexPromise;
  }

  // getItem(slug) -> the entry or undefined. Reads from the memoised index, so call
  // loadIndex() first (and let it resolve) before relying on this.
  function getItem(slug) {
    if (!_itemsBySlug) return undefined;
    return _itemsBySlug[slug];
  }

  // loadBody(item) -> Promise of the raw Markdown string for that item.
  function loadBody(item) {
    if (!item || !item.slug || !item.kind) {
      return Promise.reject(new Error('Could not load content: no valid item was given.'));
    }
    var folder = item.kind === 'post' ? 'posts' : 'projects';
    var path = 'content/' + folder + '/' + item.slug + '.md';

    return fetch(path)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .catch(function (err) {
        var title = item.title ? '"' + item.title + '"' : 'this item';
        throw new Error(friendlyErrorMessage(title + ' (' + path + ')', err));
      });
  }

  // Decodes decimal (&#106;) and hex (&#x6A;) numeric character references so a scheme
  // like "&#106;avascript:" is checked as "javascript:" rather than sliding past the
  // scheme guard as literal, un-decoded markup.
  function decodeNumericEntities(s) {
    return s.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, function (whole, code) {
      try {
        var isHex = code.charAt(0) === 'x' || code.charAt(0) === 'X';
        var num = isHex ? parseInt(code.slice(1), 16) : parseInt(code, 10);
        if (isNaN(num)) return whole;
        return String.fromCodePoint(num);
      } catch (e) {
        return whole;
      }
    });
  }

  // Schemes that can execute script or embed arbitrary content when assigned to href/src.
  // data: is blocked outright rather than allow-listing data:image/... : nothing in this
  // site's content uses a data: URL today, so blocking it entirely is strictly safer than
  // trying to parse and trust a MIME type out of attacker-controlled text.
  var DANGEROUS_SCHEME_RE = /^(?:javascript|vbscript|data):/i;

  // isDangerousUrl(url) -> true if url resolves to a blocked scheme once normalised.
  // Normalisation matches how browsers actually parse a URL string before evasions like
  // whitespace, embedded tabs/newlines inside the scheme, or HTML-entity-encoded
  // characters can hide behind: decode numeric entities, strip ASCII tab/newline/CR
  // anywhere in the string (browsers do this during URL parsing, which is what makes
  // "java\nscript:" resolve as "javascript:"), then trim and lowercase.
  function isDangerousUrl(url) {
    if (typeof url !== 'string' || !url) return false;
    var s = decodeNumericEntities(url);
    s = s.replace(/[\t\n\r]/g, '');
    s = s.replace(/^[\s\x00-\x1f]+|[\s\x00-\x1f]+$/g, '');
    return DANGEROUS_SCHEME_RE.test(s.toLowerCase());
  }

  // sanitizeUrl(url) -> url unchanged if its scheme is safe, otherwise "#". Exported as
  // Content.sanitizeUrl so any page assigning a content/index.json-sourced URL (item.repo,
  // links[].url) to an .href can guard it too, not just Markdown bodies rendered here.
  function sanitizeUrl(url) {
    if (typeof url !== 'string' || !url) return '#';
    return isDangerousUrl(url) ? '#' : url;
  }

  // Neutralises href="..." / src="..." attributes (either quote style) that resolve to a
  // dangerous scheme, by replacing the value with "#" rather than dropping the attribute
  // (dropping it can leave a same-page navigation or a broken-but-inert img either way;
  // "#" is inert and keeps the markup well-formed).
  function sanitizeUrlAttributes(html) {
    html = html.replace(/(\s(?:href|src)\s*=\s*)"([^"]*)"/gi, function (whole, prefix, value) {
      return isDangerousUrl(value) ? prefix + '"#"' : whole;
    });
    html = html.replace(/(\s(?:href|src)\s*=\s*)'([^']*)'/gi, function (whole, prefix, value) {
      return isDangerousUrl(value) ? prefix + "'#'" : whole;
    });
    return html;
  }

  // Strips <script>, <iframe>, <object>, <embed>, any on*="..." attribute, and neutralises
  // javascript:/vbscript:/data: URL schemes in href/src, from an HTML string. Content here
  // is all first-party, but the pages insert the result with innerHTML, so this runs on
  // every renderMarkdown() call regardless.
  function sanitizeHtml(html) {
    if (typeof html !== 'string') return '';

    // Paired tags: drop the tag and everything between the open and close.
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    html = html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '');
    html = html.replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, '');

    // embed has no closing tag; drop the tag itself.
    html = html.replace(/<embed\b[^>]*\/?>/gi, '');

    // Catch any stray/unpaired opening or closing tags of the same names.
    html = html.replace(/<\/?(?:script|iframe|object|embed)\b[^>]*>/gi, '');

    // Strip on*="...", on*='...', and bare on*=value attributes.
    html = html.replace(/\son\w+\s*=\s*"(?:[^"\\]|\\.)*"/gi, '');
    html = html.replace(/\son\w+\s*=\s*'(?:[^'\\]|\\.)*'/gi, '');
    html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');

    // Neutralise dangerous URL schemes in href/src (see sanitizeUrlAttributes above).
    html = sanitizeUrlAttributes(html);

    return html;
  }

  // renderMarkdown(md) -> sanitised HTML string, using the vendored marked.js.
  function renderMarkdown(md) {
    if (typeof md !== 'string') return '';

    var raw;
    try {
      if (window.marked && typeof window.marked.parse === 'function') {
        raw = window.marked.parse(md);
      } else if (typeof window.marked === 'function') {
        raw = window.marked(md);
      } else {
        // marked.js did not load; fail readably instead of throwing.
        raw = '<p>Could not render this content: the Markdown renderer did not load.</p>';
      }
    } catch (e) {
      raw = '<p>Could not render this content.</p>';
    }

    return sanitizeHtml(raw);
  }

  // Sort helper: newest first by ISO date string. Does not mutate the input array.
  function sortByDate(items) {
    return (items || []).slice().sort(function (a, b) {
      var da = (a && a.date) || '';
      var db = (b && b.date) || '';
      if (da === db) return 0;
      return da < db ? 1 : -1;
    });
  }

  // Render helper the pages call from a .catch() on loadIndex()/loadBody() so a failed
  // fetch shows a readable message instead of a blank page or an uncaught error.
  function renderFetchError(container, err) {
    if (!container) return;
    var message = err && err.message ? err.message : 'Something failed to load.';
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'content-error';
    box.setAttribute('role', 'alert');
    var p = document.createElement('p');
    p.textContent = message;
    box.appendChild(p);
    container.appendChild(box);
  }

  window.Content = {
    loadIndex: loadIndex,
    getItem: getItem,
    loadBody: loadBody,
    renderMarkdown: renderMarkdown,
    sortByDate: sortByDate,
    renderFetchError: renderFetchError,
    sanitizeUrl: sanitizeUrl
  };
})();
