/*
 * js/pages.js
 * Shared glue for the individual pages: building card grids and detail meta from
 * window.Content data, a readable "not found" box, the slug query-param reader, and
 * wiring the header's #terminal-launch button. Plain script, no module syntax, loaded
 * after js/content.js and before each page's own small inline script.
 *
 * Everything here builds DOM with createElement/textContent, never innerHTML, so a
 * value that ultimately traces back to the URL (the slug) is never interpolated into
 * markup.
 */
(function () {
  'use strict';

  // getSlugParam() -> the ?slug= value from the URL, or '' if absent/unreadable.
  // Never assume URLSearchParams exists without a guard; some very old browsers lack it.
  function getSlugParam() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('slug') || '';
    } catch (e) {
      return '';
    }
  }

  // createBadge(status) -> <span class="badge" data-status="...">status</span>
  function createBadge(status) {
    var badge = document.createElement('span');
    badge.className = 'badge';
    badge.setAttribute('data-status', status);
    badge.textContent = status;
    return badge;
  }

  // createTagList(tags) -> <div class="card-tags"><span>tag</span>...</div>
  function createTagList(tags) {
    var wrap = document.createElement('div');
    wrap.className = 'card-tags';
    (tags || []).forEach(function (tag) {
      var span = document.createElement('span');
      span.textContent = tag;
      wrap.appendChild(span);
    });
    return wrap;
  }

  // createCard(item, detailHref) -> one <article class="card"> for a card grid.
  // detailHref is built by the caller (e.g. "project.html?slug=" + encodeURIComponent(item.slug)),
  // from data already loaded out of content/index.json, never from the page's own URL.
  function createCard(item, detailHref) {
    var card = document.createElement('article');
    card.className = 'card';

    var titleEl = document.createElement('h3');
    titleEl.className = 'card-title';
    var link = document.createElement('a');
    link.href = detailHref;
    link.textContent = item.title;
    titleEl.appendChild(link);
    if (item.status) {
      titleEl.appendChild(createBadge(item.status));
    }
    card.appendChild(titleEl);

    var meta = document.createElement('p');
    meta.className = 'card-meta';
    meta.textContent = item.date || '';
    card.appendChild(meta);

    var summary = document.createElement('p');
    summary.className = 'card-summary';
    summary.textContent = item.summary || '';
    card.appendChild(summary);

    if (item.tags && item.tags.length) {
      card.appendChild(createTagList(item.tags));
    }

    if (item.repo) {
      var linksEl = document.createElement('div');
      linksEl.className = 'card-links';
      var repoLink = document.createElement('a');
      // Guard against a dangerous URL scheme even though every value in
      // content/index.json today is a first-party https://github.com/... link:
      // defense-in-depth for when the JSON is edited later.
      repoLink.href = Content.sanitizeUrl(item.repo);
      repoLink.textContent = 'repo';
      repoLink.rel = 'noopener';
      linksEl.appendChild(repoLink);
      card.appendChild(linksEl);
    }

    return card;
  }

  // renderCardList(container, items, hrefBuilder) - clears container, then renders a
  // .card-grid of items (built via createCard), or a plain "nothing here yet" message
  // when items is empty. hrefBuilder(item) -> the detail page URL for that item.
  function renderCardList(container, items, hrefBuilder) {
    if (!container) return;
    container.innerHTML = '';
    if (!items || !items.length) {
      var p = document.createElement('p');
      p.textContent = 'Nothing here yet.';
      container.appendChild(p);
      return;
    }
    var grid = document.createElement('div');
    grid.className = 'card-grid';
    items.forEach(function (item) {
      grid.appendChild(createCard(item, hrefBuilder(item)));
    });
    container.appendChild(grid);
  }

  // renderNotFound(container, heading, message, backHref, backLabel) - a readable "there
  // is nothing here" box: a real <h1> (so the page still carries exactly one heading even
  // on a bad slug), a message paragraph, and a link back, wrapped in the .window chrome
  // for visual consistency with the rest of the site. message and heading are set with
  // textContent, so this is safe even when the caller embeds a value read from the URL
  // (e.g. an unknown slug) into the message string.
  function renderNotFound(container, heading, message, backHref, backLabel) {
    if (!container) return;
    container.innerHTML = '';

    var h1 = document.createElement('h1');
    h1.textContent = heading;
    container.appendChild(h1);

    var win = document.createElement('div');
    win.className = 'window';

    var titlebar = document.createElement('div');
    titlebar.className = 'window-titlebar';
    titlebar.setAttribute('aria-hidden', 'true');
    var titleEl = document.createElement('span');
    titleEl.className = 'window-title';
    titleEl.textContent = 'error.txt';
    titlebar.appendChild(titleEl);
    win.appendChild(titlebar);

    var body = document.createElement('div');
    body.className = 'window-body';

    var msg = document.createElement('p');
    msg.textContent = message;
    body.appendChild(msg);

    var backP = document.createElement('p');
    var link = document.createElement('a');
    link.href = backHref;
    link.textContent = backLabel;
    backP.appendChild(link);
    body.appendChild(backP);

    win.appendChild(body);
    container.appendChild(win);
  }

  // wireTerminalLaunch() - hooks up #terminal-launch, if present on the page, to open
  // terminal mode once js/terminal.js (a later agent's work) defines it. Guarded so a
  // click never throws even when terminal.js has not loaded: functional-but-inert.
  function wireTerminalLaunch() {
    var btn = document.getElementById('terminal-launch');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (typeof window.openTerminalMode === 'function') {
        window.openTerminalMode();
      }
      // Otherwise: terminal mode has not shipped yet. Do nothing, quietly.
    });
  }

  function init() {
    wireTerminalLaunch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Pages = {
    getSlugParam: getSlugParam,
    createBadge: createBadge,
    createTagList: createTagList,
    createCard: createCard,
    renderCardList: renderCardList,
    renderNotFound: renderNotFound,
    wireTerminalLaunch: wireTerminalLaunch
  };
})();
