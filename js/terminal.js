/*
 * js/terminal.js
 * Full-screen terminal mode overlay. Plain script (no module syntax), loaded after
 * js/pages.js on every page. Builds #terminal-overlay in JS using exactly the ids and
 * classes css/site.css already defines for it, and exposes window.openTerminalMode(),
 * which js/pages.js's #terminal-launch click handler calls if it is defined.
 *
 * Reuses window.Content (loadIndex/getItem/loadBody/renderMarkdown/sortByDate/
 * sanitizeUrl) and window.setTheme from js/theme.js rather than reimplementing any of
 * it. Markdown is turned into plain text for the output pane by reusing
 * Content.renderMarkdown() (already-sanitised HTML) and walking the result with
 * DOMParser on a document that is never attached to the page and never written with
 * innerHTML; every line that actually reaches #terminal-output is a real text node via
 * textContent, so nothing rendered here can execute or inject markup.
 */
(function () {
  'use strict';

  var PROMPT = 'ryker@mines:~$';
  var OPEN_STATE_KEY = 'ryker-terminal-open';
  var BOOT_SESSION_KEY = 'ryker-terminal-booted';
  // Printed as the boot sequence's last line, and again by itself on every
  // open after the first (when proceedBoot() skips the whole boot): the
  // boot banner and `help` are the only two places a visitor learns how to
  // leave, now that there is no close button.
  var EXIT_HINT = 'Type ‘help’ for a list of commands, ‘exit’ or Esc to leave.';


  // -------------------------------------------------------------------
  // DOM construction
  // -------------------------------------------------------------------

  var dom = buildOverlay();

  function buildOverlay() {
    var overlay = document.createElement('div');
    overlay.id = 'terminal-overlay';
    overlay.setAttribute('hidden', '');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    // No title bar, so there is no heading element left to point a labelling
    // attribute at; a plain label string names the dialog instead.
    overlay.setAttribute('aria-label', 'Terminal mode');

    // #terminal-screen is the one scrolling element: a full-screen text
    // buffer holding the output log followed by the live prompt line, so the
    // two always share one left edge and one scrollbar, like a real terminal.
    var screen = document.createElement('div');
    screen.id = 'terminal-screen';
    overlay.appendChild(screen);

    var output = document.createElement('div');
    output.id = 'terminal-output';
    // aria-live/role set here, per the CSS comment above #terminal-output in
    // css/site.css: the page shell only defines the visual chrome.
    output.setAttribute('role', 'log');
    output.setAttribute('aria-live', 'polite');
    screen.appendChild(output);

    // The live prompt line lives outside #terminal-output on purpose: a
    // live region must not re-announce itself on every keystroke, so the
    // line the user is actively typing on is a sibling, not a child, of the
    // aria-live log. It carries terminal-input-line--booting until
    // readyForInput() drops that class once the boot sequence finishes, so
    // the boot lines fill an otherwise empty screen from the top. That class
    // only hides #terminal-prompt-label and #terminal-typed (see
    // css/site.css); .terminal-input-line itself is never display: none, so
    // #terminal-input stays focusable and receiving keydown events the whole
    // time, which the boot sequence's skip-on-keypress listener and Escape
    // both depend on.
    var inputLine = document.createElement('div');
    inputLine.className = 'terminal-input-line terminal-input-line--booting';

    var promptLabel = document.createElement('span');
    promptLabel.id = 'terminal-prompt-label';
    // Decorative: #terminal-input carries the equivalent meaning in its aria-label.
    promptLabel.setAttribute('aria-hidden', 'true');
    promptLabel.textContent = PROMPT;
    inputLine.appendChild(promptLabel);

    // The rendered mirror of dom.input.value; see renderInputLine() below.
    // Also decorative for the same reason as promptLabel.
    var typed = document.createElement('span');
    typed.id = 'terminal-typed';
    typed.setAttribute('aria-hidden', 'true');
    inputLine.appendChild(typed);

    var input = document.createElement('input');
    input.id = 'terminal-input';
    input.type = 'text';
    input.setAttribute('aria-label', 'Terminal input, prompt ' + PROMPT);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    // Stays a real, focused <input>, never display: none or visibility:
    // hidden: css/site.css makes it opacity: 0 with a transparent caret
    // instead, so the keyboard, clipboard, IME composition and assistive
    // tech all still see an ordinary focused text field. The plan of record
    // calls for a focused <input> rather than a document-level keydown
    // listener, and this keeps that true while looking like a bare terminal
    // to sighted users, who see only #terminal-typed's mirror and its cursor.
    inputLine.appendChild(input);

    screen.appendChild(inputLine);

    document.body.appendChild(overlay);

    return {
      overlay: overlay, screen: screen, output: output, inputLine: inputLine,
      promptLabel: promptLabel, typed: typed, input: input
    };
  }

  // -------------------------------------------------------------------
  // Small helpers
  // -------------------------------------------------------------------

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function padRight(s, n) {
    s = String(s);
    if (s.length >= n) return s;
    return s + new Array(n - s.length + 1).join(' ');
  }

  function longestCommonPrefix(list) {
    if (!list.length) return '';
    var prefix = list[0];
    for (var i = 1; i < list.length; i++) {
      var s = list[i];
      var j = 0;
      while (j < prefix.length && j < s.length && prefix.charAt(j) === s.charAt(j)) j++;
      prefix = prefix.slice(0, j);
      if (!prefix) break;
    }
    return prefix;
  }

  function scrollToBottom() {
    dom.screen.scrollTop = dom.screen.scrollHeight;
  }

  // Within one line's height of the bottom counts as "at the bottom": exact
  // equality is brittle across browsers' sub-pixel scroll math.
  function isScrolledToBottom() {
    var tolerance = 24; // px, roughly one line at this font size
    return dom.screen.scrollHeight - dom.screen.scrollTop - dom.screen.clientHeight <= tolerance;
  }

  function printLine(text) {
    var line = document.createElement('div');
    line.className = 'terminal-line';
    var t = text === undefined || text === null || text === '' ? ' ' : String(text);
    line.textContent = t;
    dom.output.appendChild(line);
    scrollToBottom();
  }

  function echoPrompt(text) {
    printLine(currentPrompt() + (text ? ' ' + text : ''));
  }

  function printNotFound() {
    echoPrompt('');
    printLine('bash: command not found');
  }

  // -------------------------------------------------------------------
  // Markdown -> plain text, via Content.renderMarkdown() + an unattached DOMParser
  // document. Nothing here is ever assigned to innerHTML on a live element; only
  // strings extracted with textContent/attribute reads end up in the terminal, and
  // those are always inserted with textContent on freshly created nodes.
  // -------------------------------------------------------------------

  // Terminal mode never shows an image on its own: it prints the path, and the
  // `display` command draws the image on request. The alt text is left out because
  // every image in the content has a caption line under it.
  var IMAGE_MARKER = '[image] ';

  function imageReference(img) {
    var src = img.getAttribute('src') || '';
    if (src && src !== '#') return IMAGE_MARKER + src;
    return '[image: ' + (img.getAttribute('alt') || '') + ']';
  }

  function inlineText(node) {
    var buf = '';
    var kids = Array.prototype.slice.call(node.childNodes);
    kids.forEach(function (child) {
      if (child.nodeType === 3) {
        buf += child.nodeValue;
        return;
      }
      if (child.nodeType !== 1) return;
      var tag = child.tagName;
      if (tag === 'BR') {
        buf += '\n';
      } else if (tag === 'A') {
        var href = child.getAttribute('href') || '';
        var inner = inlineText(child).trim();
        buf += href && href !== '#' ? inner + ' (' + href + ')' : inner;
      } else if (tag === 'IMG') {
        buf += imageReference(child);
      } else {
        buf += inlineText(child);
      }
    });
    return buf;
  }

  function pushBlank(out) {
    if (out.length && out[out.length - 1] !== '') out.push('');
  }

  function blockToLines(node, out, indent) {
    indent = indent || '';
    var kids = Array.prototype.slice.call(node.childNodes);
    kids.forEach(function (child) {
      if (child.nodeType === 3) {
        var t = child.nodeValue.trim();
        if (t) out.push(indent + t);
        return;
      }
      if (child.nodeType !== 1) return;
      var tag = child.tagName;

      switch (tag) {
        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6':
          pushBlank(out);
          var htext = inlineText(child).trim();
          out.push(indent + (tag === 'H1' ? htext.toUpperCase() : htext));
          pushBlank(out);
          break;

        case 'P':
          pushBlank(out);
          out.push(indent + inlineText(child).trim());
          pushBlank(out);
          break;

        case 'UL':
        case 'OL':
          pushBlank(out);
          var n = 1;
          Array.prototype.slice.call(child.childNodes).forEach(function (li) {
            if (li.nodeType !== 1 || li.tagName !== 'LI') return;
            var marker = tag === 'UL' ? '- ' : (n++ + '. ');
            out.push(indent + marker + inlineText(li).trim());
          });
          pushBlank(out);
          break;

        case 'BLOCKQUOTE':
          var innerOut = [];
          blockToLines(child, innerOut, '');
          innerOut.forEach(function (line) {
            out.push(indent + (line ? '> ' + line : '>'));
          });
          pushBlank(out);
          break;

        case 'PRE':
          pushBlank(out);
          var codeText = child.textContent.replace(/\n+$/, '');
          codeText.split('\n').forEach(function (l) {
            out.push(indent + '    ' + l);
          });
          pushBlank(out);
          break;

        case 'HR':
          out.push(indent + '----------------------------------------');
          break;

        case 'IMG':
          // An IMG walked as a top-level block (not as a child inside a P) has no
          // childNodes of its own, so falling through to inlineText() in the
          // default: case below would silently return ''. Render the same
          // "[image] path" form the inline path produces instead.
          pushBlank(out);
          out.push(indent + imageReference(child));
          pushBlank(out);
          break;

        case 'TABLE':
          pushBlank(out);
          Array.prototype.slice.call(child.querySelectorAll('tr')).forEach(function (tr) {
            var cells = Array.prototype.slice.call(tr.querySelectorAll('th,td')).map(function (c) {
              return inlineText(c).trim();
            });
            out.push(indent + cells.join('  |  '));
          });
          pushBlank(out);
          break;

        default:
          // DIV/SECTION/SPAN and anything else (including the raw <div class="todo">
          // blocks the content Markdown embeds): treat as one plain paragraph.
          pushBlank(out);
          var dtext = inlineText(child).trim();
          if (dtext) out.push(indent + dtext);
          pushBlank(out);
          break;
      }
    });
  }

  function collapseBlankLines(lines) {
    var cleaned = [];
    var lastBlank = true; // trims a leading blank
    lines.forEach(function (l) {
      var isBlank = l.trim() === '';
      if (isBlank && lastBlank) return;
      cleaned.push(l);
      lastBlank = isBlank;
    });
    while (cleaned.length && cleaned[cleaned.length - 1].trim() === '') cleaned.pop();
    return cleaned;
  }

  function markdownToLines(md) {
    var html = '';
    try {
      html = Content.renderMarkdown(md);
    } catch (e) {
      html = '';
    }
    var lines = [];
    try {
      var doc = new DOMParser().parseFromString(String(html), 'text/html');
      blockToLines(doc.body, lines, '');
    } catch (e) {
      lines = ['(could not render this content)'];
    }
    return collapseBlankLines(lines);
  }

  // Returns the printed lines so a caller can tell whether the text referenced an image.
  function printMarkdown(md) {
    var lines = markdownToLines(md);
    if (!lines.length) {
      printLine('(nothing here yet)');
      return lines;
    }
    lines.forEach(printLine);
    return lines;
  }

  // -------------------------------------------------------------------
  // Content index cache (shared with the rest of the site through Content.loadIndex,
  // memoised there; this just keeps a local synchronous copy for tab-completion and
  // the ?cmd= whitelist).
  // -------------------------------------------------------------------

  var cachedItems = [];
  var indexPromise = Content.loadIndex();
  indexPromise.then(function (items) {
    cachedItems = items || [];
  }).catch(function () {
    cachedItems = [];
  });

  function withIndex(onItems) {
    return indexPromise.then(onItems).catch(function (err) {
      printLine(err && err.message ? err.message : 'Could not load content/index.json.');
    });
  }

  function findExactSlug(items, slug, kind) {
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].kind === kind && items[i].slug === slug) return items[i];
    }
    return null;
  }

  // -------------------------------------------------------------------
  // Static text (matches the copy already on index.html / uses.html / contact.html;
  // none of this lives in content/, so it is not something a later content/index.json
  // edit would need to stay in sync with).
  // -------------------------------------------------------------------

  function getObfuscatedEmail() {
    // Same reversed-string technique contact.html uses for #email-link, so the
    // address is not sitting in this file as plain, greppable text either.
    var user = 'splehpjrekyr'.split('').reverse().join('');
    var domain = 'moc.liamg'.split('').reverse().join('');
    return user + '@' + domain;
  }

  function cmdAbout() {
    printLine('CS @ Colorado School of Mines, B.S. December 2027.');
    printLine('Seeking a Software Engineering Internship, Summer 2027 - backend and AI/ML.');
    printLine('');
    printLine('I build under the handle HateAndLoveModding. The love part is easy:');
    printLine('Minecraft modding is genuinely fun, and nothing beats playing with something');
    printLine('I made myself. The hate part comes from having hundreds of mod ideas and');
    printLine('knowing I’ll never have time to build them all. That tension comes from years');
    printLine('of modding, and Superior Flat, a Fabric mod with 2,000+ CurseForge downloads,');
    printLine('is the receipt. Run ‘projects superior-flat’ for details.');
  }

  function cmdUses() {
    printLine('OS        Debian 13 (trixie), kernel 6.12');
    printLine('Desktop   GNOME on Wayland');
    printLine('Shell     bash 5.2.37');
    printLine('Editor    Zed');
    printLine('Laptop    Dell G16 7630, i7-13650HX, 16GB');
    printLine('Keyboard  a custom XKB layout named "best" (/usr/share/X11/xkb/symbols/best)');
    printLine('');
    printLine('I switched to best after watching a YouTube video about a keyboard layout');
    printLine('designed to minimize how far your fingers travel on average. I set it up to');
    printLine('try it out, and because I genuinely enjoyed practicing, I kept getting faster');
    printLine('until I passed my old QWERTY speed. I haven’t looked back since. I even bought');
    printLine('a programmable keyboard so the layout lives on the keyboard itself, which');
    printLine('means I can plug in and type on anyone’s computer without installing anything.');
  }

  function cmdContact() {
    printLine('Golden, CO. The fastest way to reach me is email.');
    printLine('');
    printLine('email     ' + getObfuscatedEmail());
    printLine('github    github.com/HateAndLoveModding');
    printLine('linkedin  linkedin.com/in/ryker-phelps');
    printLine('');
    printLine('Resume: resume.pdf, resume.md - or run `resume` here.');
  }

  function cmdResume() {
    return fetch('resume.md')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (md) {
        printMarkdown(md);
      })
      .catch(function (err) {
        printLine('Could not load resume.md' + (err && err.message ? ' (' + err.message + ')' : '') +
          '. Try running python3 -m http.server 8000.');
      });
  }

  function printItemList(items, kind, exampleFallback) {
    if (!items.length) {
      printLine('Nothing here yet.');
      return;
    }
    printLine(kind + ' (' + items.length + ')');
    printLine('');
    items.forEach(function (item) {
      printLine(item.slug + '  [' + (item.status || 'n/a') + ']');
      var metaBits = [];
      if (item.date) metaBits.push(item.date);
      if (item.tags && item.tags.length) metaBits.push(item.tags.join(', '));
      if (metaBits.length) printLine('    ' + metaBits.join('  -  '));
      if (item.summary) printLine('    ' + item.summary);
      printLine('');
    });
    printLine('Run ‘' + kind + ' <slug>’ for details, e.g. ‘' + kind + ' ' +
      (items[0] ? items[0].slug : exampleFallback) + '’.');
  }

  function printItemDetail(item) {
    printLine(item.title.toUpperCase());
    printLine('  status  ' + (item.status || 'n/a'));
    if (item.date) printLine('  date    ' + item.date);
    if (item.tags && item.tags.length) printLine('  tags    ' + item.tags.join(', '));
    if (item.repo) printLine('  repo    ' + item.repo);
    if (item.links && item.links.length) {
      item.links.forEach(function (l) {
        if (l && l.url && l.label) printLine('  ' + padRight(l.label + ':', 10) + ' ' + l.url);
      });
    }
    printLine('');
    return Content.loadBody(item).then(function (md) {
      var lines = printMarkdown(md);
      var hasImage = lines.some(function (l) { return l.indexOf(IMAGE_MARKER) !== -1; });
      if (hasImage) {
        printLine('');
        printLine('Run ‘display <path>’ to view an image, e.g. ‘display ' + firstImagePath(lines) + '’.');
      }
    }).catch(function (err) {
      printLine(err && err.message ? err.message : 'Could not load this content.');
    });
  }

  function cmdProjects(args) {
    return withIndex(function (items) {
      var projects = Content.sortByDate(items.filter(function (i) { return i.kind === 'project'; }));
      if (!args.length) {
        printItemList(projects, 'projects', 'superior-flat');
        return;
      }
      var item = findExactSlug(items, args[0], 'project');
      if (!item) {
        printLine('projects: no such project: ' + args[0]);
        return;
      }
      return printItemDetail(item);
    });
  }

  function cmdBlog(args) {
    return withIndex(function (items) {
      var posts = Content.sortByDate(items.filter(function (i) { return i.kind === 'post'; }));
      if (!args.length) {
        printItemList(posts, 'blog', 'working-with-ai-agents');
        return;
      }
      var item = findExactSlug(items, args[0], 'post');
      if (!item) {
        printLine('blog: no such post: ' + args[0]);
        return;
      }
      return printItemDetail(item);
    });
  }

  function cmdTheme(args) {
    if (args.length !== 1 || (args[0] !== 'dark' && args[0] !== 'light')) {
      printLine('usage: theme <dark|light>');
      return;
    }
    window.setTheme(args[0]);
    printLine('Theme set to ' + args[0] + '.');
  }

  function cmdClear() {
    while (dom.output.firstChild) {
      dom.output.removeChild(dom.output.firstChild);
    }
  }

  function cmdExit() {
    closeTerminalMode();
  }

  function cmdWhoami() {
    printLine('ryker');
  }

  function cmdSudo() {
    printLine('We trust you have received the usual lecture from the local System');
    printLine('Administrator. It usually boils down to these three things:');
    printLine('');
    printLine('    #1) Respect the privacy of others.');
    printLine('    #2) Think before you type.');
    printLine('    #3) With great power comes great responsibility.');
    printLine('');
    printLine('[sudo] password for ryker:');
    printLine('ryker is not in the sudoers file.  This incident will be reported.');
  }

  function cmdNeofetch() {
    // Every row is built through the same row() helper, so the interior width is
    // identical for all of them and the right-hand border always lands at the same
    // column. Verified by measuring rendered widths, not by eye (see the fix report).
    var innerWidth = 18;
    var border = new Array(innerWidth + 1).join('─');
    function row(text) {
      return '│' + padRight(text, innerWidth) + '│';
    }
    var artWidth = innerWidth + 2;
    var art = [
      '┌' + border + '┐',
      row('  >_'),
      row(''),
      row('  ryker'),
      row('  @mines'),
      row(''),
      '└' + border + '┘'
    ];
    var specs = [
      'ryker@mines',
      '------------------------------',
      'OS: Debian 13 (trixie)',
      'Kernel: 6.12',
      'DE: GNOME (Wayland)',
      'Shell: bash 5.2.37',
      'Editor: Zed',
      'Host: Dell G16 7630',
      'CPU: Intel i7-13650HX',
      'Memory: 16GB',
      'Keyboard: custom XKB layout "best"'
    ];
    var rows = Math.max(art.length, specs.length);
    for (var i = 0; i < rows; i++) {
      var left = art[i] || padRight('', artWidth);
      var right = specs[i] || '';
      printLine(padRight(left, artWidth) + '  ' + right);
    }
  }

  function cmdGitLog() {
    return fetch('content/commits.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var commits = (data && data.commits) || [];
        if (!commits.length) {
          printLine('fatal: no commits');
          return;
        }
        commits.forEach(function (c) {
          var shortDate = (c.date || '').slice(0, 10);
          printLine(c.hash + '  ' + shortDate + '  ' + c.subject);
        });
      })
      .catch(function (err) {
        printLine('fatal: could not read the commit history' +
          (err && err.message ? ' (' + err.message + ')' : '') +
          '. Try running python3 -m http.server 8000.');
      });
  }

  function cmdGitDispatch(args) {
    if (args.length === 1 && args[0].toLowerCase() === 'log') {
      return cmdGitLog();
    }
    var sub = args.length ? ' ' + args.join(' ') : '';
    printLine('bash: git' + sub + ': not a supported command here. Try `git log`.');
  }

  // -------------------------------------------------------------------
  // A small fake filesystem over the real content, with a working folder that `cd`
  // changes and the prompt shows. ~ holds three text files and four folders:
  // projects/ and blog/ hold one <slug>.md per item in content/index.json, media/ holds
  // every image the write-ups use, and .secrets/ stays out of a plain `ls`. Folders are
  // one level deep, so a location is just a folder name, with '' standing for ~.
  // -------------------------------------------------------------------

  var HOME_FILES = ['about.txt', 'README.md', 'resume.md'];
  var HOME_DIRS = ['projects', 'blog', 'media', '.secrets'];
  var ITEM_KIND_BY_DIR = { projects: 'project', blog: 'post' };
  var IMAGE_NAME_RE = /\.(?:png|gif|jpe?g|webp)$/i;

  var cwd = '';

  function dirLabel(dir) {
    return dir ? '~/' + dir : '~';
  }

  function currentPrompt() {
    return 'ryker@mines:' + dirLabel(cwd) + '$';
  }

  function setCwd(dir) {
    cwd = dir;
    dom.promptLabel.textContent = currentPrompt();
    dom.input.setAttribute('aria-label', 'Terminal input, prompt ' + currentPrompt());
  }

  // dirEntries(dir) -> [{ name, isDir, item }] for one folder. Reads only the caches the
  // content loaders fill (cachedItems, cachedMedia), so Tab completion can call it
  // synchronously; commands call loadFs() first so the caches are full.
  function dirEntries(dir) {
    if (dir === '') {
      return HOME_FILES.map(function (n) { return { name: n, isDir: false }; })
        .concat(HOME_DIRS.map(function (n) { return { name: n, isDir: true }; }));
    }
    if (ITEM_KIND_BY_DIR[dir]) {
      return cachedItems.filter(function (i) { return i.kind === ITEM_KIND_BY_DIR[dir]; })
        .map(function (i) { return { name: i.slug + '.md', isDir: false, item: i }; });
    }
    if (dir === 'media') {
      return cachedMedia.map(function (p) { return { name: p.slice(MEDIA_DIR.length), isDir: false }; });
    }
    if (dir === '.secrets') return [{ name: 'nothing-to-see-here.txt', isDir: false }];
    return [];
  }

  function loadFs() {
    var noop = function () { /* an empty folder is the fallback */ };
    return Promise.all([indexPromise.catch(noop), loadMediaList().catch(noop)]);
  }

  // resolvePath(arg) -> { dir, name, isDir, item } for what arg names, or null if nothing
  // is there. Relative to the working folder, or to ~ when arg starts with ~ or /. For a
  // folder, dir is the folder itself and name is ''; for a file, dir is its folder.
  function resolvePath(arg) {
    var stack = /^[~\/]/.test(arg) || !cwd ? [] : [cwd];
    arg.replace(/^~/, '').split('/').forEach(function (seg) {
      if (seg === '' || seg === '.') return;
      if (seg === '..') stack.pop();
      else stack.push(seg);
    });
    if (!stack.length) return { dir: '', name: '', isDir: true };
    if (stack.length > 2) return null;
    var parent = stack.length === 2 ? stack[0] : '';
    if (parent && HOME_DIRS.indexOf(parent) === -1) return null;
    var name = stack[stack.length - 1];
    var entries = dirEntries(parent);
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].name !== name) continue;
      if (entries[i].isDir) return { dir: name, name: '', isDir: true };
      return { dir: parent, name: name, isDir: false, item: entries[i].item };
    }
    return null;
  }

  // pathOf(resolved) -> its full path from ~, e.g. ~/projects/qwixx-scoresheet.md.
  function pathOf(r) {
    if (r.isDir) return dirLabel(r.dir);
    return dirLabel(r.dir) + '/' + r.name;
  }

  function byNameIgnoringCase(a, b) {
    var x = a.toLowerCase();
    var y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }

  function cmdLs(args) {
    var showHidden = false;
    var targets = [];
    for (var i = 0; i < args.length; i++) {
      if (args[i] === '-a') showHidden = true;
      else if (args[i].charAt(0) === '-') {
        printLine('ls: invalid option ‘' + args[i] + '’ (only -a is supported here)');
        return;
      } else targets.push(args[i]);
    }
    if (targets.length > 1) {
      printLine('ls: one path at a time here');
      return;
    }
    return loadFs().then(function () {
      var r = resolvePath(targets[0] || '.');
      if (!r) {
        printLine('ls: cannot access ‘' + targets[0] + '’: No such file or directory');
        return;
      }
      if (!r.isDir) {
        printLine(r.name);
        return;
      }
      var names = dirEntries(r.dir)
        .filter(function (e) { return showHidden || e.name.charAt(0) !== '.'; })
        .map(function (e) { return e.name + (e.isDir ? '/' : ''); })
        .sort(byNameIgnoringCase);
      printLine(names.length ? names.join('  ') : '(empty)');
    });
  }

  // Synchronous on purpose: every folder is known without waiting on a fetch, so the
  // prompt has already changed by the time the next command runs.
  function cmdCd(args) {
    if (args.length > 1) {
      printLine('cd: too many arguments');
      return;
    }
    var target = args[0] || '~';
    var r = resolvePath(target);
    if (!r) {
      printLine('cd: ' + target + ': No such file or directory');
      return;
    }
    if (!r.isDir) {
      printLine('cd: ' + target + ': Not a directory');
      return;
    }
    setCwd(r.dir);
    if (r.dir === '.secrets') {
      printLine('access granted. there’s nothing here, but you found it. - ryker');
    }
  }

  function cmdCat(args) {
    if (!args.length) {
      printLine('cat: missing operand');
      return;
    }
    var arg = args[0];
    return loadFs().then(function () {
      var r = resolvePath(arg);
      if (!r) {
        printLine('cat: ' + arg + ': No such file or directory');
        return;
      }
      if (r.isDir) {
        printLine('cat: ' + arg + ': Is a directory');
        return;
      }
      if (r.item) return printItemDetail(r.item);
      if (r.dir === 'media') {
        printLine('cat: ' + arg + ': is an image; try ‘display ' + arg + '’');
        return;
      }
      if (r.name === 'about.txt') return cmdAbout();
      if (r.name === 'README.md') {
        printLine('you’re looking at it.');
        return;
      }
      if (r.name === 'resume.md') return cmdResume();
      // nothing-to-see-here.txt is empty, like cat of any empty file.
    });
  }

  // pathCandidates(prefix, keep) -> Tab completions for a path argument, each spelled
  // with the folder part already typed, folders ending in '/'. Hidden entries are
  // offered only once the typed name starts with a dot, as in bash.
  function pathCandidates(prefix, keep) {
    var slash = prefix.lastIndexOf('/');
    var base = prefix.slice(0, slash + 1);
    var partial = prefix.slice(slash + 1);
    var r = resolvePath(base || '.');
    if (!r || !r.isDir) return [];
    return dirEntries(r.dir)
      .filter(function (e) { return partial.charAt(0) === '.' || e.name.charAt(0) !== '.'; })
      .filter(function (e) { return !keep || keep(e); })
      .map(function (e) { return base + e.name + (e.isDir ? '/' : ''); });
  }

  // -------------------------------------------------------------------
  // display: draws one image from content/media/ inline in the output. A path only ever
  // becomes an <img> src after it matches MEDIA_PATH_RE, so the command can load an
  // image file from this site's own media folder and nothing else.
  // -------------------------------------------------------------------

  var MEDIA_DIR = 'content/media/';
  var MEDIA_PATH_RE = /^content\/media\/[A-Za-z0-9_'.()-]+\.(?:png|gif|jpe?g|webp)$/i;

  // normalizeMediaPath(arg) -> 'content/media/<file>' or null. Accepts the full path a
  // write-up prints, or just the file name.
  function normalizeMediaPath(arg) {
    if (typeof arg !== 'string') return null;
    var p = arg.replace(/^\.\//, '');
    if (p.indexOf('/') === -1) p = MEDIA_DIR + p;
    return MEDIA_PATH_RE.test(p) ? p : null;
  }

  function firstImagePath(lines) {
    for (var i = 0; i < lines.length; i++) {
      var at = lines[i].indexOf(IMAGE_MARKER);
      if (at !== -1) return lines[i].slice(at + IMAGE_MARKER.length).split(/\s+/)[0];
    }
    return '';
  }

  // Every image path the projects and posts reference, in index order without repeats,
  // with each one's alt text. Filled by loadMediaList(), which is memoised like
  // Content.loadIndex(); a failure clears the memo so a later call can retry.
  var cachedMedia = [];
  var altByPath = {};
  var mediaPromise = null;

  function loadMediaList() {
    if (mediaPromise) return mediaPromise;
    mediaPromise = indexPromise.then(function (items) {
      var listed = items.filter(function (i) { return i.kind === 'project' || i.kind === 'post'; });
      return Promise.all(listed.map(function (item) {
        return Content.loadBody(item).catch(function () { return ''; });
      }));
    }).then(function (bodies) {
      var paths = [];
      bodies.forEach(function (md) {
        var doc = new DOMParser().parseFromString(String(Content.renderMarkdown(md)), 'text/html');
        Array.prototype.slice.call(doc.querySelectorAll('img')).forEach(function (img) {
          var p = normalizeMediaPath(img.getAttribute('src') || '');
          if (!p || altByPath.hasOwnProperty(p)) return;
          altByPath[p] = img.getAttribute('alt') || '';
          paths.push(p);
        });
      });
      cachedMedia = paths;
      return paths;
    }).catch(function (err) {
      mediaPromise = null;
      throw err;
    });
    return mediaPromise;
  }

  function cmdDisplay(args) {
    if (args.length !== 1) {
      printLine('usage: display <image>');
      return loadMediaList().then(function (paths) {
        if (!paths.length) return;
        printLine('');
        printLine('Images in the write-ups:');
        paths.forEach(function (p) { printLine('  ' + p); });
      }).catch(function () { /* the usage line already said enough */ });
    }
    // The line goes into the log now, so output stays in order even if another command
    // runs before the image finishes loading; the image fills it in when it arrives.
    var line = document.createElement('div');
    line.className = 'terminal-line terminal-image';
    dom.output.appendChild(line);
    return loadFs().then(function () {
      // A path through the fake filesystem (media/x.png, ../media/x.png) maps onto
      // content/media/; anything else must already be a content/media/ path or a bare
      // file name.
      var r = resolvePath(args[0]);
      var path = r && !r.isDir && r.dir === 'media' ? MEDIA_DIR + r.name : normalizeMediaPath(args[0]);
      if (!path) {
        line.classList.remove('terminal-image');
        line.textContent = 'display: ' + args[0] + ': not an image in ' + MEDIA_DIR;
        return;
      }
      return showImage(line, path);
    });
  }

  function showImage(line, path) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        img.alt = altByPath[path] || path.slice(MEDIA_DIR.length);
        line.appendChild(img);
        scrollToBottom();
        resolve();
      };
      img.onerror = function () {
        line.classList.remove('terminal-image');
        line.textContent = 'display: unable to open image ‘' + path + '’: No such file or directory';
        scrollToBottom();
        resolve();
      };
      img.src = path;
    });
  }

  // -------------------------------------------------------------------
  // Command registry: single source of truth for dispatch, help, man pages and
  // ?cmd= whitelisting.
  // -------------------------------------------------------------------

  var REGISTRY = [
    {
      name: 'help',
      synopsis: 'help [command]',
      short: 'List commands, or describe one in detail.',
      long: ['With no argument, lists every command with a one-line description. ' +
        'With a command name, this is the same as `man <command>`.'],
      run: function (args) {
        if (!args.length) {
          printLine('Available commands:');
          printLine('');
          REGISTRY.forEach(function (entry) {
            printLine('  ' + padRight(entry.displayName || entry.name, 12) + entry.short);
          });
          printLine('');
          printLine('Run `man <command>` or `help(<command>)` for details on one.');
          return;
        }
        return cmdMan(args);
      }
    },
    {
      name: 'man',
      synopsis: 'man <command>',
      short: 'Show the manual page for a command.',
      long: ['Formats a command like a real man page: NAME, SYNOPSIS, DESCRIPTION.'],
      run: function (args) { return cmdMan(args); }
    },
    {
      name: 'about',
      synopsis: 'about',
      short: 'Who I am and what I am looking for.',
      long: ['Prints the availability line and a short bio, the same text as the home page.'],
      run: cmdAbout
    },
    {
      name: 'projects',
      synopsis: 'projects [slug]',
      short: 'List projects, or show one in detail.',
      long: ['With no argument, lists every project from content/index.json, newest first, ' +
        'with its status, tags and one-line summary.',
        'With a slug (e.g. `projects superior-flat`), prints that project’s full write-up.'],
      run: cmdProjects
    },
    {
      name: 'blog',
      synopsis: 'blog [slug]',
      short: 'List posts, or show one in detail.',
      long: ['With no argument, lists every blog post, newest first. With a slug, prints that post in full.'],
      run: cmdBlog
    },
    {
      name: 'display',
      synopsis: 'display <image>',
      short: 'Show an image from a write-up.',
      long: ['Draws an image right in the terminal. Write-ups here print each image as ' +
        '`[image] <path>` instead of showing it; pass that path, just the file name, or a ' +
        'path through the folders, e.g. `display content/media/Qwixx_Normal.png`, or ' +
        '`display Qwixx_Normal.png` from inside media/.',
        'With no argument, lists every image the projects and posts use. Tab completes the paths.'],
      run: cmdDisplay
    },
    {
      name: 'resume',
      synopsis: 'resume',
      short: 'Print the plain-text resume.',
      long: ['Fetches resume.md and prints it, the same file `curl hateandlovemodding.github.io/resume.md` returns.'],
      run: cmdResume
    },
    {
      name: 'uses',
      synopsis: 'uses',
      short: 'The hardware and software I use.',
      long: ['OS, editor, shell and hardware, the same facts as uses.html.'],
      run: cmdUses
    },
    {
      name: 'contact',
      synopsis: 'contact',
      short: 'How to reach me.',
      long: ['Email, GitHub and LinkedIn.'],
      run: cmdContact
    },
    {
      name: 'theme',
      synopsis: 'theme <dark|light>',
      short: 'Switch the site theme.',
      long: ['Calls the same window.setTheme() the header toggle uses, so it also updates the page behind this overlay.'],
      run: cmdTheme
    },
    {
      name: 'clear',
      synopsis: 'clear',
      short: 'Clear the terminal output.',
      long: ['Empties the output pane. Does not affect command history.'],
      run: cmdClear
    },
    {
      name: 'exit',
      synopsis: 'exit',
      short: 'Close terminal mode.',
      long: ['Same as clicking close or pressing Escape: returns you to the regular site.'],
      run: cmdExit
    },
    {
      name: 'git',
      displayName: 'git log',
      synopsis: 'git log',
      short: 'Show this site’s real commit history.',
      long: ['Reads content/commits.json, generated from actual git history by scripts/generate-commits.py, ' +
        'and prints it as hash, date, subject.'],
      run: cmdGitDispatch
    },
    {
      name: 'whoami',
      synopsis: 'whoami',
      short: 'Print the current user.',
      long: ['Not a very deep rabbit hole.'],
      run: cmdWhoami
    },
    {
      name: 'sudo',
      synopsis: 'sudo <command>',
      short: 'Try to run a command as root.',
      long: ['You already know how this ends.'],
      run: cmdSudo
    },
    {
      name: 'neofetch',
      synopsis: 'neofetch',
      short: 'Print system info with a logo.',
      long: ['Real specs from the machine this site was built on, next to a small ASCII logo.'],
      run: cmdNeofetch
    },
    {
      name: 'ls',
      synopsis: 'ls [-a] [path]',
      short: 'List a folder.',
      long: ['A small filesystem over the real content. ~ holds about.txt, README.md and ' +
        'resume.md, plus three folders: projects/ and blog/ with one .md file per write-up, ' +
        'and media/ with every image the write-ups use.',
        'With no path, lists the current folder. `-a` also lists hidden entries.'],
      run: cmdLs
    },
    {
      name: 'cd',
      synopsis: 'cd [folder]',
      short: 'Change folder.',
      long: ['Moves into projects/, blog/ or media/, and the prompt shows where you are. ' +
        '`cd ..` goes up, and `cd` or `cd ~` goes home. Paths work from the current folder ' +
        'or from ~, e.g. `cd ~/media`.',
        'There may be one more folder that a plain `ls` does not show you.'],
      run: cmdCd
    },
    {
      name: 'cat',
      synopsis: 'cat <file>',
      short: 'Print a file.',
      long: ['`cat about.txt`, `cat README.md`, `cat resume.md`, or any write-up, e.g. ' +
        '`cat projects/qwixx-scoresheet.md`, which prints the same thing as ' +
        '`projects qwixx-scoresheet`. Images are for `display`.'],
      run: cmdCat
    }
  ];

  var REGISTRY_BY_NAME = {};
  REGISTRY.forEach(function (entry) { REGISTRY_BY_NAME[entry.name] = entry; });
  var ALL_COMMAND_NAMES = Object.keys(REGISTRY_BY_NAME);

  function cmdMan(args) {
    if (!args.length) {
      printLine('What manual page do you want? Example: man projects');
      return;
    }
    var key = args[0].toLowerCase();
    var entry = REGISTRY_BY_NAME[key];
    if (!entry) {
      printLine('No manual entry for ' + args[0]);
      return;
    }
    var displayName = entry.displayName || entry.name;
    printLine('NAME');
    printLine('    ' + displayName + ' - ' + entry.short);
    printLine('');
    printLine('SYNOPSIS');
    printLine('    ' + entry.synopsis);
    printLine('');
    printLine('DESCRIPTION');
    entry.long.forEach(function (para, i) {
      if (i > 0) printLine('');
      printLine('    ' + para);
    });
  }

  // -------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------

  function executeCommand(raw) {
    var trimmed = String(raw || '').trim();
    echoPrompt(trimmed);
    if (!trimmed) return;

    var helpParen = trimmed.match(/^help\(([^)]*)\)$/i);
    if (helpParen) {
      var target = helpParen[1].trim();
      if (!target) {
        printLine('What manual page do you want? Example: help(projects)');
        return;
      }
      return cmdMan([target]);
    }

    var tokens = trimmed.split(/\s+/);
    var name = tokens[0].toLowerCase();
    var rest = tokens.slice(1);

    if (!REGISTRY_BY_NAME.hasOwnProperty(name)) {
      printLine('bash: ' + tokens[0] + ': command not found');
      return;
    }
    return REGISTRY_BY_NAME[name].run(rest);
  }

  // -------------------------------------------------------------------
  // ?cmd= whitelist: the raw query value is never trusted or echoed. It is only ever
  // used to look up an exact match in our own command table / real content slugs /
  // fake-filesystem constants; what actually runs is always one of those known-good
  // strings, never the attacker-controlled original.
  // -------------------------------------------------------------------

  function validateCmdParam(raw, items) {
    if (typeof raw !== 'string') return null;
    var trimmed = raw.trim();
    if (!trimmed) return null;
    var tokens = trimmed.split(/\s+/);
    var name = tokens[0].toLowerCase();
    var rest = tokens.slice(1);

    if (!REGISTRY_BY_NAME.hasOwnProperty(name)) return null;

    switch (name) {
      case 'help':
      case 'man':
        if (!rest.length) return name;
        if (rest.length === 1 && REGISTRY_BY_NAME.hasOwnProperty(rest[0].toLowerCase())) {
          return name + ' ' + rest[0].toLowerCase();
        }
        return null;
      case 'projects': {
        if (!rest.length) return 'projects';
        if (rest.length !== 1) return null;
        var p = findExactSlug(items, rest[0], 'project');
        return p ? 'projects ' + p.slug : null;
      }
      case 'blog': {
        if (!rest.length) return 'blog';
        if (rest.length !== 1) return null;
        var b = findExactSlug(items, rest[0], 'post');
        return b ? 'blog ' + b.slug : null;
      }
      case 'display': {
        if (!rest.length) return 'display';
        if (rest.length !== 1) return null;
        var d = normalizeMediaPath(rest[0]);
        return d ? 'display ' + d : null;
      }
      case 'theme':
        if (rest.length === 1 && (rest[0] === 'dark' || rest[0] === 'light')) return 'theme ' + rest[0];
        return null;
      case 'git':
        if (rest.length === 1 && rest[0].toLowerCase() === 'log') return 'git log';
        return null;
      // cd/ls/cat: the path must resolve to something in the fake filesystem (from ~, since
      // nothing has changed folder yet), and what runs is that entry's own full path.
      case 'cat': {
        if (rest.length !== 1) return null;
        var fc = resolvePath(rest[0]);
        return fc && !fc.isDir ? 'cat ' + pathOf(fc) : null;
      }
      case 'cd': {
        if (!rest.length) return 'cd';
        if (rest.length !== 1) return null;
        var dc = resolvePath(rest[0]);
        return dc && dc.isDir ? 'cd ' + pathOf(dc) : null;
      }
      case 'ls': {
        if (!rest.length) return 'ls';
        if (rest.length === 1 && rest[0] === '-a') return 'ls -a';
        if (rest.length !== 1) return null;
        var lc = resolvePath(rest[0]);
        return lc ? 'ls ' + pathOf(lc) : null;
      }
      default:
        // about, resume, uses, contact, clear, exit, whoami, sudo, neofetch: no args.
        return rest.length === 0 ? name : null;
    }
  }

  // -------------------------------------------------------------------
  // Tab completion
  // -------------------------------------------------------------------

  // argPool(cmdName, argPrefix) -> the candidates for the argument being typed. Path
  // arguments depend on what is typed so far (the folder part), so it is passed in.
  function argPool(cmdName, argPrefix) {
    switch (cmdName) {
      case 'projects': return cachedItems.filter(function (i) { return i.kind === 'project'; }).map(function (i) { return i.slug; });
      case 'blog': return cachedItems.filter(function (i) { return i.kind === 'post'; }).map(function (i) { return i.slug; });
      case 'display':
        loadMediaList().catch(function () { /* completion just stays empty */ });
        if (argPrefix.indexOf('content/') === 0) return cachedMedia;
        return pathCandidates(argPrefix, function (e) { return e.isDir || IMAGE_NAME_RE.test(e.name); });
      case 'man':
      case 'help': return ALL_COMMAND_NAMES;
      case 'theme': return ['dark', 'light'];
      case 'cd': return pathCandidates(argPrefix, function (e) { return e.isDir; });
      case 'ls':
      case 'cat': return pathCandidates(argPrefix);
      default: return null;
    }
  }

  // Lists candidates by their last path part, the way bash does, so completing inside
  // a folder shows `qwixx-scoresheet.md`, not `projects/qwixx-scoresheet.md`.
  function printCompletionCandidates(list) {
    printLine(list.map(function (c) {
      return c.slice(c.lastIndexOf('/', c.length - 2) + 1);
    }).join('  '));
  }

  function handleTabComplete() {
    var raw = dom.input.value;
    var leading = raw.match(/^\s*/)[0];
    var rest = raw.slice(leading.length);
    var hasTrailingSpace = /\s$/.test(rest);
    var parts = rest.split(/\s+/).filter(function (p) { return p.length > 0; });

    if (!parts.length) return;

    if (parts.length === 1 && !hasTrailingSpace) {
      var prefix = parts[0].toLowerCase();
      var matches = ALL_COMMAND_NAMES.filter(function (n) { return n.indexOf(prefix) === 0; });
      if (matches.length === 1) {
        dom.input.value = leading + matches[0] + ' ';
      } else if (matches.length > 1) {
        var common = longestCommonPrefix(matches);
        if (common.length > prefix.length) {
          dom.input.value = leading + common;
        } else {
          printCompletionCandidates(matches);
        }
      }
      return;
    }

    var cmdName = parts[0].toLowerCase();
    var argPrefix = hasTrailingSpace ? '' : (parts[parts.length - 1] || '');
    var pool = argPool(cmdName, argPrefix);
    if (!pool) return;
    // Everything before the argument being completed stays as typed (e.g. `ls -a `).
    var head = leading + rest.slice(0, rest.length - argPrefix.length);
    var matches2 = pool.filter(function (n) { return n.toLowerCase().indexOf(argPrefix.toLowerCase()) === 0; });
    if (matches2.length === 1) {
      // A folder stays open for the next part of the path instead of ending the argument.
      var done = matches2[0].slice(-1) === '/' ? '' : ' ';
      dom.input.value = head + matches2[0] + done;
    } else if (matches2.length > 1) {
      var common2 = longestCommonPrefix(matches2);
      if (common2.length > argPrefix.length) {
        dom.input.value = head + common2;
      } else {
        printCompletionCandidates(matches2);
      }
    }
  }

  // -------------------------------------------------------------------
  // Boot sequence
  // -------------------------------------------------------------------

  function runBootSequence(done) {
    var bootLines = [
      '[ok] mounting content/index.json',
      '[ok] loading gruvbox theme tokens',
      '[ok] starting shell as ryker',
      '[ok] checking for updates... none'
    ];
    var bannerLines = [
      '',
      '========================================',
      '  ' + PROMPT + '   terminal mode',
      '========================================',
      ''
    ];
    var allLines = bootLines.concat(bannerLines).concat([EXIT_HINT]);

    function finishBoot() {
      try { sessionStorage.setItem(BOOT_SESSION_KEY, '1'); } catch (e) { /* ignore */ }
      done();
    }

    if (prefersReducedMotion()) {
      allLines.forEach(printLine);
      finishBoot();
      return;
    }

    dom.input.setAttribute('readonly', 'readonly');

    var i = 0;
    var timer = null;
    var skipped = false;

    function cleanup() {
      dom.input.removeEventListener('keydown', onKey);
    }

    function skip() {
      if (skipped) return;
      skipped = true;
      if (timer) clearTimeout(timer);
      for (; i < allLines.length; i++) printLine(allLines[i]);
      cleanup();
      finishBoot();
    }

    function step() {
      if (i >= allLines.length) {
        cleanup();
        finishBoot();
        return;
      }
      printLine(allLines[i]);
      i++;
      timer = setTimeout(step, 90);
    }

    function onKey(e) {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      e.preventDefault();
      skip();
    }

    dom.input.addEventListener('keydown', onKey);
    step();
  }

  function readyForInput() {
    dom.input.removeAttribute('readonly');
    dom.inputLine.classList.remove('terminal-input-line--booting');
    dom.input.focus();
    renderInputLine();
  }

  function proceedBoot(cb) {
    var alreadyBooted = false;
    try { alreadyBooted = sessionStorage.getItem(BOOT_SESSION_KEY) === '1'; } catch (e) { alreadyBooted = false; }
    if (alreadyBooted) {
      // The boot sequence (and the exit hint printed at the end of it) only
      // ever runs once per session; every later open still needs to tell
      // the visitor how to leave, so it lands in the aria-live log the same
      // as any other line.
      printLine(EXIT_HINT);
      cb();
    } else {
      runBootSequence(cb);
    }
  }

  // -------------------------------------------------------------------
  // Open / close, focus management and the Tab trap
  // -------------------------------------------------------------------

  function getBackgroundSiblings() {
    return Array.prototype.slice.call(document.body.children).filter(function (el) {
      return el !== dom.overlay && el.tagName !== 'SCRIPT';
    });
  }

  function setBackgroundInert(on) {
    getBackgroundSiblings().forEach(function (el) {
      if (on) {
        el.setAttribute('aria-hidden', 'true');
        try { el.inert = true; } catch (e) { /* ignore */ }
      } else {
        el.removeAttribute('aria-hidden');
        try { el.inert = false; } catch (e) { /* ignore */ }
      }
    });
  }

  function openTerminalMode(afterReady) {
    if (dom.overlay.hasAttribute('hidden')) {
      dom.overlay.removeAttribute('hidden');
      document.body.classList.add('terminal-open');
      setBackgroundInert(true);
      try { localStorage.setItem(OPEN_STATE_KEY, '1'); } catch (e) { /* ignore */ }
    }
    // Focus the input immediately, even before boot finishes: it is what the boot
    // sequence's own keydown listener (see runBootSequence) is attached to, so a
    // keypress skips the animation only if the input already has focus to receive it.
    dom.input.focus();
    // Warm the image list so the first Tab after `display ` already has paths to offer.
    loadMediaList().catch(function () { /* display reports its own errors */ });
    proceedBoot(function () {
      readyForInput();
      if (typeof afterReady === 'string' && afterReady) {
        executeCommand(afterReady);
      } else if (typeof afterReady === 'function') {
        afterReady();
      }
    });
  }

  function closeTerminalMode() {
    if (dom.overlay.hasAttribute('hidden')) return;
    dom.overlay.setAttribute('hidden', '');
    document.body.classList.remove('terminal-open');
    setBackgroundInert(false);
    try { localStorage.setItem(OPEN_STATE_KEY, '0'); } catch (e) { /* ignore */ }
    var launch = document.getElementById('terminal-launch');
    if (launch && typeof launch.focus === 'function') launch.focus();
  }

  // Escape always closes, no matter where focus is. A listener on the
  // overlay itself would only ever see events that bubble up from inside
  // it, but a mousedown on the non-focusable #terminal-output (dragging a
  // text selection over the output, say) moves focus to document.body,
  // which is an ancestor of the overlay, not a descendant, so nothing
  // bubbles through it and Escape would go dead. A document-level listener
  // sees every keydown no matter where focus is; it is scoped to Escape
  // only, and only while the overlay is open, so it never competes with
  // #terminal-input's own keydown listener below, which still handles
  // everything else. Typing itself still never uses a document-level
  // listener, only Escape does, and that distinction is the point: Escape
  // has to work regardless of focus, typing must not.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (dom.overlay.hasAttribute('hidden')) return;
    e.preventDefault();
    closeTerminalMode();
  });

  // -------------------------------------------------------------------
  // The live prompt line: dom.input is the real, focused <input>, but
  // css/site.css renders it invisible, so what the user actually sees is
  // this mirror, rebuilt into #terminal-typed on every call from
  // dom.input.value and dom.input.selectionStart. It is always rebuilt from
  // scratch (textContent only, never innerHTML) rather than patched in
  // place, so a fresh .terminal-cursor element is created on every
  // keystroke, which restarts its blink animation each time, the way a real
  // terminal cursor does.
  // -------------------------------------------------------------------

  function renderInputLine() {
    // Measured before any of the rebuilding below, which can itself change
    // #terminal-screen's scrollHeight by a pixel or two as the line reflows:
    // unlike printLine(), which always pulls new output into view, typing
    // must not yank a visitor back to the bottom if they scrolled up to
    // reread earlier output.
    var wasAtBottom = isScrolledToBottom();

    dom.typed.textContent = ''; // safe: sets no markup, just empties it

    var value = dom.input.value;
    var start = dom.input.selectionStart;
    var end = dom.input.selectionEnd;
    if (typeof start !== 'number') start = value.length;
    if (typeof end !== 'number') end = start;

    if (start !== end) {
      // A real selection (Ctrl+A, Shift+Arrow, a double-click): render it as
      // one inverted block over the selected text, with no separate caret
      // glyph, the way a real terminal shows a selection instead of a
      // cursor.
      var selStart = Math.min(start, end);
      var selEnd = Math.max(start, end);

      var beforeSel = document.createElement('span');
      beforeSel.textContent = value.slice(0, selStart);
      dom.typed.appendChild(beforeSel);

      var selected = document.createElement('span');
      selected.className = 'terminal-selection';
      selected.textContent = value.slice(selStart, selEnd);
      dom.typed.appendChild(selected);

      var afterSel = document.createElement('span');
      afterSel.textContent = value.slice(selEnd);
      dom.typed.appendChild(afterSel);
    } else {
      var caret = start;
      // The code point at the caret, or a single space when the caret is at
      // the end of the line, so the block cursor always has width. Reads a
      // full code point, not one UTF-16 code unit: charAt() would split an
      // astral character (an emoji, say) into a lone surrogate half in the
      // cursor and an orphaned surrogate half at the head of `after`, both
      // rendering as broken glyphs.
      var codePoint = value.codePointAt(caret);
      var charLen = (typeof codePoint === 'number' && codePoint > 0xFFFF) ? 2 : 1;

      var before = document.createElement('span');
      before.textContent = value.slice(0, caret);
      dom.typed.appendChild(before);

      var cursor = document.createElement('span');
      cursor.className = 'terminal-cursor';
      cursor.textContent = typeof codePoint === 'number' ? value.slice(caret, caret + charLen) : ' ';
      dom.typed.appendChild(cursor);

      var after = document.createElement('span');
      after.textContent = value.slice(caret + charLen);
      dom.typed.appendChild(after);
    }

    if (wasAtBottom) scrollToBottom();
  }

  var renderPending = false;

  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    // Deferred rather than immediate: on a keydown for an arrow key,
    // Backspace or Enter, the browser (or the switch below) has not yet
    // moved the caret or changed the value at the point the event fires,
    // and holding a key down repeats 'keydown' without a matching 'keyup'
    // until release, which is exactly what used to freeze the visible
    // cursor mid-repeat. A zero-delay timeout runs after all of that has
    // settled, once per batch of synchronous triggers, no matter how many
    // of input/keyup/keydown/click/select/compositionupdate fired for the
    // same keystroke.
    setTimeout(function () {
      renderPending = false;
      renderInputLine();
    }, 0);
  }

  // A solid, blinking block while dom.input is focused; a hollow, non-
  // blinking outline otherwise, so a sighted user can tell whether the
  // terminal is listening even though the real <input> is invisible. This
  // doubles as the focus indicator that the now-invisible input's own focus
  // ring can no longer provide.
  dom.input.addEventListener('focus', function () {
    dom.inputLine.classList.remove('terminal-cursor--idle');
  });
  dom.input.addEventListener('blur', function () {
    dom.inputLine.classList.add('terminal-cursor--idle');
  });

  // Clicking anywhere in the scrollback focuses the input, so the whole
  // screen behaves like a terminal to click into, EXCEPT when the click is
  // part of selecting output text to copy: a non-empty selection means the
  // user is selecting, not trying to type.
  dom.screen.addEventListener('click', function () {
    var selected = '';
    try { selected = window.getSelection().toString(); } catch (e) { selected = ''; }
    if (selected) return;
    dom.input.focus();
  });

  // The input's own keydown handles typing: Enter submits, arrow keys walk history,
  // Tab completes (and, with Shift, does nothing: there is no other focusable
  // element left to move focus to, so focus simply stays where it is). This is the
  // one focused <input> the terminal listens to for command entry; no
  // document-level keydown listener is used for typing.
  var history = [];
  var historyIndex = 0;
  // Holds whatever was typed but not submitted, saved the moment ArrowUp first
  // leaves the live line, and restored when ArrowDown walks back past the newest
  // history entry. Survives `clear` the same way `history` does: neither is touched
  // there.
  var draft = '';

  function placeCaretAtEnd(el) {
    var len = el.value.length;
    try { el.setSelectionRange(len, len); } catch (e) { /* ignore */ }
  }

  dom.input.addEventListener('keydown', function (e) {
    // The boot sequence's own keydown listener (see runBootSequence) owns
    // the input while it is readonly. Without this guard, Enter would still
    // reach the case below with an empty value and echo a stray bare prompt
    // line into the log just as the terminal becomes ready; readonly blocks
    // editing but not event dispatch. Returning here leaves the event alone
    // (no stopPropagation/stopImmediatePropagation), so the boot listener,
    // also attached to this same input, still gets it.
    if (dom.input.hasAttribute('readonly')) return;

    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        var val = dom.input.value;
        dom.input.value = '';
        if (val.trim()) history.push(val);
        historyIndex = history.length;
        Promise.resolve().then(function () { return executeCommand(val); }).catch(function (err) {
          printLine('bash: ' + (err && err.message ? err.message : 'something went wrong'));
        });
        break;
      }
      case 'ArrowUp':
        e.preventDefault();
        if (history.length) {
          // First step away from the live line: stash the in-progress draft before
          // history overwrites it.
          if (historyIndex === history.length) {
            draft = dom.input.value;
          }
          if (historyIndex > 0) {
            historyIndex -= 1;
            dom.input.value = history[historyIndex];
            placeCaretAtEnd(dom.input);
          }
          // Already at the oldest entry: stay put, do not wrap or clear.
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        // On the live line already (historyIndex === history.length): do nothing.
        if (history.length && historyIndex < history.length) {
          historyIndex += 1;
          dom.input.value = historyIndex === history.length ? draft : history[historyIndex];
          placeCaretAtEnd(dom.input);
        }
        break;
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        // Shift+Tab used to move focus to the close button; with no close
        // button left (and the background inert), there is nowhere else for
        // focus to go, so it simply does nothing.
        if (!e.shiftKey) {
          handleTabComplete();
        }
        break;
      default:
        break;
    }

    // Every branch above (and the default, plain-typing, case) ends here
    // instead of each calling it separately: scheduleRender()'s deferred
    // render (see below) reads the caret only once this listener has
    // returned, by which point any of the value/selection changes above,
    // or the browser's own default caret movement, have already happened.
    scheduleRender();
  });

  // input covers typing, pasting and IME commit; keyup covers caret moves
  // that do not fire an input event (ArrowLeft/ArrowRight/Home/End) plus the
  // trailing edge of Backspace/Delete; keydown is what actually fixes
  // key-repeat (see scheduleRender()), since holding an arrow key repeats
  // keydown without a matching keyup until release; click and select cover
  // the caret moving from a mouse click or a text-selection change, including
  // a setSelectionRange() call that fires 'select' redundantly; compositionupdate
  // covers IME composition, which can change the composed text without a
  // plain 'input' event on some platforms. Together these are every path
  // that can change dom.input.value or dom.input.selectionStart, so the
  // mirror in #terminal-typed never goes stale.
  dom.input.addEventListener('input', scheduleRender);
  dom.input.addEventListener('keyup', scheduleRender);
  dom.input.addEventListener('click', scheduleRender);
  dom.input.addEventListener('select', scheduleRender);
  dom.input.addEventListener('compositionupdate', scheduleRender);

  // -------------------------------------------------------------------
  // Initial state: a valid/invalid ?cmd= parameter, or a persisted open state from
  // localStorage, or nothing (wait for #terminal-launch).
  // -------------------------------------------------------------------

  window.openTerminalMode = openTerminalMode;
  window.closeTerminalMode = closeTerminalMode;

  (function initialState() {
    var cmdRaw = null;
    try {
      cmdRaw = new URLSearchParams(window.location.search).get('cmd');
    } catch (e) {
      cmdRaw = null;
    }

    if (cmdRaw !== null && cmdRaw !== '') {
      indexPromise.catch(function () { return []; }).then(function (items) {
        var canonical = validateCmdParam(cmdRaw, items || cachedItems);
        if (canonical) {
          openTerminalMode(canonical);
        } else {
          openTerminalMode(printNotFound);
        }
      });
      return;
    }

    var persistedOpen = false;
    try { persistedOpen = localStorage.getItem(OPEN_STATE_KEY) === '1'; } catch (e) { persistedOpen = false; }
    if (persistedOpen) {
      openTerminalMode();
    }
  })();
})();
