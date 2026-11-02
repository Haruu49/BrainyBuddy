/** Landing page */
(function (BB) {
  "use strict";
  var U = BB.utils;

  BB.page.init(function () {
    // Hero answer path (illustrative example)
    var questions = [];
    for (var i = 0; i < 10; i++) questions.push({ number: i + 1, kind: i < 6 ? "objective" : "subjective" });
    BB.arcPath.render(U.$("#hero-path"), {
      questions: questions,
      order: [6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 1, 3],
      spacing: 50,
      label: "Example answer path: the student answered Q7 to Q10 first, then Q1 to Q6, then went back to Q2 and Q4."
    });

    // Header border on scroll
    var header = U.$("#site-header");
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Mobile navigation
    var menuBtn = U.$("#site-menu-btn");
    var nav = U.$("#site-nav");
    function setMenu(open) {
      nav.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menuBtn.innerHTML = BB.icon(open ? "x" : "menu");
    }
    menuBtn.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
    U.$$("a", nav).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
    });

    // Demo account
    U.$$("[data-demo-signin]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.disabled = true;
        btn.textContent = "Opening the demo…";
        BB.auth.signInAsDemo().then(function () { location.href = "app/dashboard.html"; });
      });
    });

    // Dialogs
    U.$$("[data-open-dialog]").forEach(function (btn) {
      var d = document.getElementById(btn.getAttribute("data-open-dialog"));
      BB.dialog.wire(d);
      btn.addEventListener("click", function () { BB.dialog.open(d); });
    });

    U.$("#year").textContent = new Date().getFullYear();

    // Small screens: theme switch lives in the menu
    var navTheme = U.$("#nav-theme-toggle");
    var syncNavTheme = function () { navTheme.textContent = BB.theme.resolved() === "dark" ? "Switch to light theme" : "Switch to dark theme"; };
    navTheme.addEventListener("click", function () { BB.theme.toggle(); syncNavTheme(); });
    syncNavTheme();

    // Signed-in visitors get a shortcut instead of "Get started"
    var user = BB.auth.currentUser();
    if (user) {
      U.$$('.site-header__actions a.btn--primary').forEach(function (a) {
        a.textContent = "Open dashboard";
        a.href = user.onboarded ? "app/dashboard.html" : "onboarding.html";
      });
    }
  });
})(window.BB = window.BB || {});
