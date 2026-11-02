/**
 * BB.theme — light / dark / system theme preference.
 * Dispatches "bb:themechange" on document so charts can re-colour.
 */
(function (BB) {
  "use strict";

  var KEY = "theme";
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function preference() { return BB.store.get(KEY, "system"); }

  function resolved(pref) {
    pref = pref || preference();
    if (pref === "system") return media && media.matches ? "dark" : "light";
    return pref;
  }

  function apply() {
    var mode = resolved();
    var current = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", mode);
    if (current !== mode) {
      document.dispatchEvent(new CustomEvent("bb:themechange", { detail: { mode: mode } }));
    }
    BB.utils.$$("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-label", mode === "dark" ? "Switch to light theme" : "Switch to dark theme");
      btn.innerHTML = BB.icon(mode === "dark" ? "sun" : "moon");
    });
  }

  function set(pref) {
    BB.store.set(KEY, pref);
    apply();
  }

  function toggle() { set(resolved() === "dark" ? "light" : "dark"); }

  if (media) {
    var onChange = function () { if (preference() === "system") apply(); };
    if (media.addEventListener) media.addEventListener("change", onChange);
    else if (media.addListener) media.addListener(onChange);
  }

  BB.theme = { preference: preference, resolved: resolved, apply: apply, set: set, toggle: toggle };
})(window.BB = window.BB || {});
