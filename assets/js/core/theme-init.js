/* Runs synchronously in <head> to apply the saved theme before first paint (prevents a flash). */
(function () {
  try {
    var pref = JSON.parse(localStorage.getItem("bb.theme") || '"system"');
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
