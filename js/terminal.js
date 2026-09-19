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

  var FAKE_DIRS = ['projects', 'posts', '.secrets', '~'];
  var FAKE_FILES = ['about.txt', 'README.md', 'resume.md'];

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
    overlay.setAttribute('aria-labelledby', 'terminal-title-text');

    var titlebar = document.createElement('div');
    titlebar.className = 'terminal-titlebar';

    var title = document.createElement('span');
    title.className = 'terminal-title';
    title.id = 'terminal-title-text';
    title.textContent = PROMPT + ' - terminal';
    titlebar.appendChild(title);

    var closeBtn = document.createElement('button');
    closeBtn.id = 'terminal-close';
    closeBtn.type = 'button';
    closeBtn.textContent = 'close';
    closeBtn.setAttribute('aria-label', 'Close terminal mode (Escape)');
    titlebar.appendChild(closeBtn);

    overlay.appendChild(titlebar);

    var output = document.createElement('div');
    output.id = 'terminal-output';
    // aria-live/role set here, per the CSS comment above #terminal-output in
    // css/site.css: the page shell only defines the visual chrome.
    output.setAttribute('role', 'log');
    output.setAttribute('aria-live', 'polite');
    overlay.appendChild(output);

    var inputRow = document.createElement('div');
    inputRow.className = 'terminal-input-row';

    var promptLabel = document.createElement('span');
    promptLabel.id = 'terminal-prompt-label';
    // Decorative: #terminal-input carries the equivalent meaning in its aria-label.
    promptLabel.setAttribute('aria-hidden', 'true');
    promptLabel.textContent = PROMPT;
    inputRow.appendChild(promptLabel);

    var input = document.createElement('input');
    input.id = 'terminal-input';
    input.type = 'text';
    input.setAttribute('aria-label', 'Terminal input, prompt ' + PROMPT);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    inputRow.appendChild(input);

    overlay.appendChild(inputRow);

    document.body.appendChild(overlay);

    return { overlay: overlay, output: output, input: input, closeBtn: closeBtn };
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

  function printLine(text) {
    var line = document.createElement('div');
    line.className = 'terminal-line';
    var t = text === undefined || text === null || text === '' ? ' ' : String(text);
    line.textContent = t;
    dom.output.appendChild(line);
    dom.output.scrollTop = dom.output.scrollHeight;
  }

  function echoPrompt(text) {
    printLine(PROMPT + (text ? ' ' + text : ''));
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
        var alt = child.getAttribute('alt') || '';
        var src = child.getAttribute('src') || '';
        buf += '[image: ' + alt + ']' + (src && src !== '#' ? ' (' + src + ')' : '');
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

  function printMarkdown(md) {
    var lines = markdownToLines(md);
    if (!lines.length) {
      printLine('(nothing here yet)');
      return;
    }
    lines.forEach(printLine);
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
    printLine('I build under the handle HateAndLoveModding. It comes from years of');
    printLine('Minecraft modding, and Superior Flat, a Fabric mod with 2,000+ CurseForge');
    printLine('downloads, is the receipt. Run ‘projects superior-flat’ for details.');
  }

  function cmdUses() {
    printLine('OS        Debian 13 (trixie), kernel 6.12');
    printLine('Desktop   GNOME on Wayland');
    printLine('Shell     bash 5.2.37');
    printLine('Editor    Zed');
    printLine('Laptop    Dell G16 7630, i7-13650HX, 16GB');
    printLine('Keyboard  a custom XKB layout named "best" (/usr/share/X11/xkb/symbols/best)');
    printLine('');
    printLine('TODO: what `best` actually changes - Ryker writes this.');
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
      printMarkdown(md);
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
    var artWidth = 22;
    var art = [
      '┌' + new Array(20).join('─') + '┐',
      '│  >_' + padRight('', 13) + '│',
      '│' + padRight('', 18) + '│',
      '│  ryker' + padRight('', 11) + '│',
      '│  @mines' + padRight('', 10) + '│',
      '│' + padRight('', 18) + '│',
      '└' + new Array(20).join('─') + '┘'
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

  function fakeFsSlugList(kind) {
    return cachedItems.filter(function (i) { return i.kind === kind; }).map(function (i) { return i.slug + '.md'; });
  }

  function cmdLs(args) {
    var dir = args[0];
    if (!dir || dir === '~') {
      printLine('about.txt  README.md  resume.md  projects/  posts/');
      return;
    }
    if (dir === 'projects') {
      return withIndex(function () {
        var names = fakeFsSlugList('project');
        printLine(names.length ? names.join('  ') : '(empty)');
      });
    }
    if (dir === 'posts') {
      return withIndex(function () {
        var names = fakeFsSlugList('post');
        printLine(names.length ? names.join('  ') : '(empty)');
      });
    }
    if (dir === '.secrets') {
      printLine('nothing-to-see-here.txt');
      return;
    }
    printLine('ls: cannot access ‘' + dir + '’: No such file or directory');
  }

  function cmdCd(args) {
    var dir = args[0];
    if (!dir) {
      printLine('cd: missing operand');
      return;
    }
    if (dir === '.secrets') {
      printLine('access granted. there’s nothing here, but you found it. - ryker');
      return;
    }
    if (dir === '~' || dir === 'projects' || dir === 'posts') {
      printLine('cd: this is a single-page site, there’s nowhere else to go. try `projects` or `blog` instead.');
      return;
    }
    printLine('cd: ' + dir + ': No such file or directory');
  }

  function cmdCat(args) {
    var file = args[0];
    if (!file) {
      printLine('cat: missing operand');
      return;
    }
    if (file === 'about.txt') return cmdAbout();
    if (file === 'README.md') {
      printLine('you’re looking at it.');
      return;
    }
    if (file === 'resume.md') return cmdResume();
    printLine('cat: ' + file + ': No such file or directory');
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
      synopsis: 'ls [dir]',
      short: 'List a directory.',
      long: ['A small fake filesystem over the real content: `ls`, `ls projects`, `ls posts`.'],
      run: cmdLs
    },
    {
      name: 'cd',
      synopsis: 'cd <dir>',
      short: 'Change directory.',
      long: ['This is a single page. Mostly a joke, except for one directory.'],
      run: cmdCd
    },
    {
      name: 'cat',
      synopsis: 'cat <file>',
      short: 'Print a file.',
      long: ['`cat about.txt`, `cat README.md`, or `cat resume.md`.'],
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
      case 'theme':
        if (rest.length === 1 && (rest[0] === 'dark' || rest[0] === 'light')) return 'theme ' + rest[0];
        return null;
      case 'git':
        if (rest.length === 1 && rest[0].toLowerCase() === 'log') return 'git log';
        return null;
      case 'cat':
        if (rest.length === 1 && FAKE_FILES.indexOf(rest[0]) !== -1) return 'cat ' + rest[0];
        return null;
      case 'cd':
        if (rest.length === 1 && FAKE_DIRS.indexOf(rest[0]) !== -1) return 'cd ' + rest[0];
        return null;
      case 'ls':
        if (!rest.length) return 'ls';
        if (rest.length === 1 && FAKE_DIRS.indexOf(rest[0]) !== -1) return 'ls ' + rest[0];
        return null;
      default:
        // about, resume, uses, contact, clear, exit, whoami, sudo, neofetch: no args.
        return rest.length === 0 ? name : null;
    }
  }

  // -------------------------------------------------------------------
  // Tab completion
  // -------------------------------------------------------------------

  function argPool(cmdName) {
    switch (cmdName) {
      case 'projects': return cachedItems.filter(function (i) { return i.kind === 'project'; }).map(function (i) { return i.slug; });
      case 'blog': return cachedItems.filter(function (i) { return i.kind === 'post'; }).map(function (i) { return i.slug; });
      case 'man':
      case 'help': return ALL_COMMAND_NAMES;
      case 'theme': return ['dark', 'light'];
      case 'cat': return FAKE_FILES;
      case 'cd': return FAKE_DIRS;
      case 'ls': return FAKE_DIRS;
      default: return null;
    }
  }

  function printCompletionCandidates(list) {
    printLine(list.join('  '));
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
    var pool = argPool(cmdName);
    if (!pool) return;
    var argPrefix = hasTrailingSpace ? '' : (parts[parts.length - 1] || '');
    var matches2 = pool.filter(function (n) { return n.toLowerCase().indexOf(argPrefix.toLowerCase()) === 0; });
    if (matches2.length === 1) {
      dom.input.value = leading + cmdName + ' ' + matches2[0] + ' ';
    } else if (matches2.length > 1) {
      var common2 = longestCommonPrefix(matches2);
      if (common2.length > argPrefix.length) {
        dom.input.value = leading + cmdName + ' ' + common2;
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
    var allLines = bootLines.concat(bannerLines).concat(['Type ‘help’ for a list of commands.']);

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
    dom.input.focus();
  }

  function proceedBoot(cb) {
    var alreadyBooted = false;
    try { alreadyBooted = sessionStorage.getItem(BOOT_SESSION_KEY) === '1'; } catch (e) { alreadyBooted = false; }
    if (alreadyBooted) {
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

  dom.closeBtn.addEventListener('click', function () {
    closeTerminalMode();
  });

  // Escape always closes; Tab on the close button moves focus to the input (the only
  // other focusable element while the overlay is open, since output/prompt-label are
  // not focusable), trapping keyboard focus inside the dialog.
  dom.overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTerminalMode();
      return;
    }
    if (e.key === 'Tab' && document.activeElement === dom.closeBtn) {
      e.preventDefault();
      dom.input.focus();
    }
  });

  // The input's own keydown handles typing: Enter submits, arrow keys walk history,
  // Tab completes (and, with Shift, moves focus back to the close button rather than
  // completing, closing the trap's other direction). This is the one focused <input>
  // the terminal listens to for command entry; no document-level keydown listener is
  // used for typing.
  var history = [];
  var historyIndex = 0;

  function placeCaretAtEnd(el) {
    var len = el.value.length;
    try { el.setSelectionRange(len, len); } catch (e) { /* ignore */ }
  }

  dom.input.addEventListener('keydown', function (e) {
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
          historyIndex = Math.max(0, historyIndex - 1);
          dom.input.value = history[historyIndex] || '';
          placeCaretAtEnd(dom.input);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (history.length) {
          historyIndex = Math.min(history.length, historyIndex + 1);
          dom.input.value = historyIndex === history.length ? '' : history[historyIndex];
          placeCaretAtEnd(dom.input);
        }
        break;
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          dom.closeBtn.focus();
        } else {
          handleTabComplete();
        }
        break;
      default:
        break;
    }
  });

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
