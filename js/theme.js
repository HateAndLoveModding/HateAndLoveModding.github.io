/* Theme toggle: wires the header button (#theme-toggle), persists to
   localStorage under "ryker-theme", and exposes window.setTheme /
   window.toggleTheme so terminal mode's `theme` command can reuse them.

   The inline snippet in <head> (see SPEC.md) already set data-theme on
   <html> before this file runs, using the stored value or, if nothing is
   stored yet, prefers-color-scheme. This file only keeps things in sync
   from here on and does not duplicate that first paint decision.

   Plain script, no "type=module", so it can be loaded with a plain
   <script src="js/theme.js"></script> tag. */

(function () {
  "use strict";

  var STORAGE_KEY = "ryker-theme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storeTheme(name) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch (e) {
      /* Storage blocked or unavailable (e.g. Safari private mode). The
         in-memory attribute set below still works for this session. */
    }
  }

  function currentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    return attr === "light" ? "light" : "dark";
  }

  function describeToggleTarget(current) {
    // The button's label/text says what it WILL switch to, not what it is now.
    return current === "dark" ? "light" : "dark";
  }

  function updateToggleButton(button, current) {
    if (!button) return;
    var target = describeToggleTarget(current);
    button.setAttribute("aria-label", "Switch to " + target + " theme");
    button.textContent = target === "light" ? "light mode" : "dark mode";
  }

  function applyTheme(name) {
    var theme = name === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    storeTheme(theme);
    updateToggleButton(document.getElementById("theme-toggle"), theme);
  }

  function setTheme(name) {
    applyTheme(name);
  }

  function toggleTheme() {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  }

  // Expose for terminal mode (js/terminal.js) and any other page script.
  window.setTheme = setTheme;
  window.toggleTheme = toggleTheme;

  function init() {
    // Sync the button's label to whatever the inline head script already
    // chose, even if this page has no toggle button (guarded lookup).
    var button = document.getElementById("theme-toggle");
    updateToggleButton(button, currentTheme());

    if (button) {
      button.addEventListener("click", function () {
        toggleTheme();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
