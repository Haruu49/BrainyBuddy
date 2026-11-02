/**
 * BB.shell — renders the application shell into app pages:
 *   sidebar (grouped by what a student wants to do), top bar with a "Jump to" search,
 *   a bottom tab bar on phones, and Buddy's tip card.
 * BB.app.init(opts, fn) — guard + shell + page bootstrap for /app pages.
 * BB.page.init(fn)      — bootstrap for public pages (landing, auth, onboarding).
 */
(function (BB) {
  "use strict";

  var U = BB.utils;

  // Grouped by intent: where am I, practise, study, understand my results.
  var NAV = [
    {
      label: "Home",
      items: [
        { id: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "dashboard", desc: "Your scores, study time and next steps at a glance", keywords: "home overview start today" },
        { id: "subjects", label: "My Subjects", href: "subjects.html", icon: "book", desc: "Scores and progress for each subject", keywords: "classes courses topics" }
      ]
    },
    {
      label: "Practise",
      items: [
        { id: "exam", label: "Practice Exams", href: "exam.html", icon: "timer", desc: "Take a timed exam and see how you worked through it", keywords: "test quiz simulator examination mock" },
        { id: "upload", label: "Add Past Results", href: "upload.html", icon: "upload", desc: "Import scores from exams you've already sat", keywords: "upload csv import records marks grades" }
      ]
    },
    {
      label: "Study",
      items: [
        { id: "habits", label: "Study Habits", href: "habits.html", icon: "coffee", desc: "Time a study session and see when you focus best", keywords: "timer session focus streak stopwatch" },
        { id: "planner", label: "Study Planner", href: "planner.html", icon: "calendar", desc: "Plan study tasks around upcoming exams", keywords: "schedule calendar tasks todo week" }
      ]
    },
    {
      label: "Understand",
      items: [
        { id: "analytics", label: "Exam Patterns", href: "analytics.html", icon: "activity", desc: "Where your time went and which answers you changed", keywords: "behaviour behavior analytics charts insights time" },
        { id: "recommendations", label: "AI Recommendations", href: "recommendations.html", icon: "sparkles", desc: "Suggestions based on your own results", keywords: "tips advice suggestions improve" },
        { id: "reports", label: "My Reports", href: "reports.html", icon: "file", desc: "A printable summary for you, a parent or a teacher", keywords: "print pdf share summary parent teacher" }
      ]
    }
  ];
  var FOOTER_NAV = [{ id: "settings", label: "Settings", href: "settings.html", icon: "settings", desc: "Profile, study goal, theme and account", keywords: "profile account password theme goal" }];

  // The four places students go most, plus "More" for everything else (phones only).
  var BOTTOM_NAV = [
    { id: "dashboard", label: "Home", href: "dashboard.html", icon: "dashboard" },
    { id: "exam", label: "Practise", href: "exam.html", icon: "timer" },
    { id: "habits", label: "Study", href: "habits.html", icon: "coffee" },
    { id: "planner", label: "Planner", href: "planner.html", icon: "calendar" }
  ];

  var TIPS = {
    general: [
      "Press Ctrl K (or tap the search button) to jump to any page.",
      "Short, regular sessions beat one long cram. Little and often adds up.",
      "Your data stays in this browser. Nothing is sent anywhere in the demo."
    ],
    dashboard: [
      "Start from a tile under “What would you like to do?” to skip the menus.",
      "Tap Buddy at the top of this page for a nudge about your day."
    ],
    subjects: ["Pick the subject with the lowest score for your next practice exam."],
    exam: [
      "Flag questions you want to revisit. Your timeline shows when you came back to them.",
      "There's no right answering order. Brainy Buddy just records the path you took."
    ],
    upload: ["Rows with problems are highlighted so you can fix them before importing."],
    analytics: ["Tap a coloured bar on the timeline to see what happened at that moment."],
    habits: [
      "Pause the timer for breaks. Break time isn't counted as study time.",
      "Rate your focus honestly at the end. It's how Buddy finds your best study time."
    ],
    planner: ["Add your upcoming exams first, then plan study tasks in the days before them."],
    recommendations: ["Mark a recommendation as started, then check its progress after your next exams."],
    reports: ["Open the print preview to save your report as a PDF."],
    settings: ["Change your weekly study goal here and the dashboard ring updates to match."]
  };

  function allPages() {
    var out = [];
    NAV.forEach(function (g) { g.items.forEach(function (i) { out.push(i); }); });
    return out.concat(FOOTER_NAV);
  }

  function pageLabel(id) {
    var p = allPages().filter(function (i) { return i.id === id; })[0];
    return p ? p.label : "";
  }

  function navLink(item, active, badge) {
    var current = item.id === active ? ' aria-current="page"' : "";
    return (
      '<li><a class="nav-link" href="' + item.href + '"' + current + ' data-tooltip="' + U.escapeHtml(item.label) + '">' +
      '<span class="nav-link__icon">' + BB.icon(item.icon) + "</span>" +
      '<span class="nav-link__label">' + U.escapeHtml(item.label) + "</span>" +
      (badge ? '<span class="nav-link__badge">' + U.escapeHtml(badge) + "</span>" : "") +
      "</a></li>"
    );
  }

  function badges() {
    var b = {};
    try {
      if (BB.repo.activeStudy()) b.habits = "Live";
      if (BB.repo.activeExam()) b.exam = "Resume";
    } catch (e) { /* storage unavailable */ }
    return b;
  }

  function tipsFor(page) { return (TIPS[page] || []).concat(TIPS.general); }

  function renderSidebar(el, active) {
    var b = badges();
    var tips = tipsFor(active);
    el.setAttribute("aria-label", "Main navigation");
    el.innerHTML =
      '<div class="sidebar__brand">' +
      '<a class="brand" href="dashboard.html" aria-label="Brainy Buddy dashboard">' + BB.mascot.mark() +
      '<span class="brand__name">Brainy<span>Buddy</span></span></a>' +
      '<button type="button" class="sidebar__collapse" data-sidebar-collapse aria-label="Collapse sidebar" aria-pressed="false">' + BB.icon("chevrons-left") + "</button>" +
      '<button type="button" class="sidebar__close" data-sidebar-close aria-label="Close navigation">' + BB.icon("x") + "</button>" +
      "</div>" +
      '<nav class="sidebar__nav" aria-label="Primary">' +
      NAV.map(function (group) {
        return '<div class="sidebar__group"><p class="sidebar__group-label">' + U.escapeHtml(group.label) + '</p><ul class="nav-list" role="list">' +
          group.items.map(function (item) { return navLink(item, active, b[item.id]); }).join("") +
          "</ul></div>";
      }).join("") +
      "</nav>" +
      '<div class="sidebar__footer">' +
      '<div class="sidebar-tip">' +
      '<button type="button" class="sidebar-tip__buddy" data-tip-next tabindex="-1" aria-hidden="true">' + BB.mascot.svg({ mood: "happy" }) + "</button>" +
      '<div><strong>Buddy\'s tip</strong><p class="sidebar-tip__text" aria-live="polite">' + U.escapeHtml(tips[0]) + "</p>" +
      (tips.length > 1 ? '<button type="button" class="sidebar-tip__next" data-tip-next>Another tip</button>' : "") +
      "</div></div>" +
      '<ul class="nav-list" role="list" style="margin-top:12px">' + FOOTER_NAV.map(function (i) { return navLink(i, active); }).join("") + "</ul>" +
      "</div>";
  }

  function isMac() { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ""); }

  function renderTopbar(el, opts, user) {
    var notifs = BB.repo.notifications();
    var unread = notifs.filter(function (n) { return n.unread; }).length;
    var subtitle = opts.subtitle != null ? opts.subtitle : U.formatDate(new Date(), "long");
    el.innerHTML =
      '<button type="button" class="topbar__icon-btn topbar__menu" data-sidebar-open aria-controls="sidebar" aria-expanded="false" aria-label="Open navigation">' + BB.icon("menu") + "</button>" +
      '<div class="topbar__title"><h1>' + U.escapeHtml(opts.title || "") + "</h1>" +
      (subtitle ? '<p><time datetime="' + U.dateKey(new Date()) + '">' + U.escapeHtml(subtitle) + "</time></p>" : "") +
      "</div>" +
      '<div class="topbar__actions">' +
      '<button type="button" class="topbar-search" data-palette-open aria-haspopup="dialog" aria-label="Jump to a page or action" aria-keyshortcuts="' + (isMac() ? "Meta+K" : "Control+K") + '">' +
      BB.icon("search") + '<span class="topbar-search__text">Jump to a page…</span><kbd>' + (isMac() ? "⌘ K" : "Ctrl K") + "</kbd></button>" +
      '<button type="button" class="topbar__icon-btn" data-theme-toggle></button>' +
      '<div class="menu-anchor">' +
      '<button type="button" class="topbar__icon-btn" id="notif-btn" aria-label="Notifications' + (unread ? ", " + unread + " unread" : "") + '">' +
      BB.icon("bell") + (unread ? '<span class="notif-dot" aria-hidden="true"></span>' : "") + "</button>" +
      '<div class="menu notif-menu" id="notif-menu" role="region" aria-label="Notifications">' +
      '<div class="notif-menu__header"><h2>Notifications</h2>' +
      (unread ? '<button type="button" class="link-btn text-sm" data-mark-read>Mark all as read</button>' : "") + "</div>" +
      '<div class="notif-list">' +
      (notifs.length
        ? notifs.map(function (n) {
          return '<a class="notif-item menu__item' + (n.unread ? " is-unread" : "") + '" href="' + n.href + '">' +
            '<span class="notif-item__icon">' + BB.icon(n.icon) + "</span>" +
            '<span><span class="notif-item__title">' + U.escapeHtml(n.title) + "</span>" +
            '<span class="text-secondary" style="display:block">' + U.escapeHtml(n.body) + "</span>" +
            '<span class="notif-item__time">' + U.relativeTime(n.at) + "</span></span></a>";
        }).join("")
        : '<p class="text-secondary text-sm" style="padding:16px">You\'re all caught up. Reminders and new recommendations will appear here.</p>') +
      "</div></div></div>" +
      '<div class="menu-anchor">' +
      '<button type="button" class="profile-btn" id="profile-btn" aria-label="Account menu for ' + U.escapeHtml(user.name) + '">' +
      '<span class="avatar" aria-hidden="true">' + U.escapeHtml(U.initials(user.name)) + "</span>" +
      '<span class="profile-btn__name">' + U.escapeHtml(U.firstName(user.name)) + "</span>" + BB.icon("chevron-down", { size: "sm" }) +
      "</button>" +
      '<div class="menu" id="profile-menu">' +
      '<div class="menu__header"><strong style="display:block">' + U.escapeHtml(user.name) + '</strong><span class="text-secondary text-sm">' + U.escapeHtml(user.email) + "</span></div>" +
      '<a class="menu__item" href="settings.html#profile">' + BB.icon("user") + "Profile</a>" +
      '<a class="menu__item" href="settings.html">' + BB.icon("settings") + "Settings</a>" +
      '<a class="menu__item" href="reports.html">' + BB.icon("file") + "My reports</a>" +
      '<div class="menu__sep" role="separator"></div>' +
      '<button type="button" class="menu__item menu__item--danger" data-sign-out>' + BB.icon("logout") + "Sign out</button>" +
      "</div></div>" +
      "</div>";
  }

  function renderBottomNav(app, active) {
    var b = badges();
    var inBar = BOTTOM_NAV.some(function (i) { return i.id === active; });
    var moreCurrent = !inBar && !!pageLabel(active);
    var nav = document.createElement("nav");
    nav.className = "bottom-nav";
    nav.setAttribute("aria-label", "Quick navigation");
    nav.innerHTML =
      BOTTOM_NAV.map(function (i) {
        return '<a class="bottom-nav__item" href="' + i.href + '"' + (i.id === active ? ' aria-current="page"' : "") + ">" +
          '<span class="bottom-nav__icon">' + BB.icon(i.icon) + (b[i.id] ? '<span class="bottom-nav__dot" aria-hidden="true"></span>' : "") + "</span>" +
          "<span>" + U.escapeHtml(i.label) + (b[i.id] ? '<span class="visually-hidden"> (' + U.escapeHtml(b[i.id]) + ")</span>" : "") + "</span></a>";
      }).join("") +
      '<button type="button" class="bottom-nav__item" data-bottom-more aria-controls="sidebar" aria-expanded="false"' +
      (moreCurrent ? ' aria-current="page"' : "") + ">" +
      '<span class="bottom-nav__icon">' + BB.icon("menu") + "</span><span>More" +
      (moreCurrent ? '<span class="visually-hidden">, current page ' + U.escapeHtml(pageLabel(active)) + "</span>" : "") + "</span></button>";
    app.appendChild(nav);
    document.body.classList.add("has-bottom-nav");
    return nav;
  }

  /* ---------------- "Jump to" palette ---------------- */

  var ACTIONS = [
    { id: "act-exam", label: "Start a practice exam", href: "exam.html", icon: "play", desc: "Choose a subject and the timer starts when you're ready", keywords: "test quiz begin" },
    { id: "act-study", label: "Start a study session", href: "habits.html#tracker", icon: "clock", desc: "Open the study timer", keywords: "timer focus begin" },
    { id: "act-task", label: "Add a study task", href: "planner.html#new-task", icon: "plus", desc: "Put something on your plan", keywords: "todo schedule new" },
    { id: "act-import", label: "Import past results", href: "upload.html", icon: "upload", desc: "Add marks from a CSV file", keywords: "csv upload records" },
    { id: "act-theme", label: "Switch light or dark theme", icon: "moon", desc: "Change how Brainy Buddy looks", keywords: "dark mode light night appearance", run: function () { BB.theme.toggle(); BB.toast.show("Theme switched.", { type: "success" }); } },
    { id: "act-signout", label: "Sign out", icon: "logout", desc: "End this session on this device", keywords: "log out leave exit", run: function () { signOut(); } }
  ];

  var palette = null;

  function haystack(item, group) {
    return (item.label + " " + (item.desc || "") + " " + (item.keywords || "") + " " + group).toLowerCase();
  }

  function createPalette(active) {
    var d = document.createElement("dialog");
    d.className = "dialog palette";
    d.setAttribute("aria-labelledby", "palette-label");
    d.innerHTML =
      '<div class="palette__head">' + BB.mascot.svg({ mood: "wave", className: "palette__buddy" }) +
      '<div class="palette__field">' +
      '<label class="visually-hidden" for="palette-input" id="palette-label">Where do you want to go?</label>' +
      '<input class="palette__input" id="palette-input" type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Where do you want to go?">' +
      "</div>" +
      '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-palette-close aria-label="Close">' + BB.icon("x") + "</button>" +
      "</div>" +
      '<div class="palette__list" id="palette-list" role="listbox" aria-label="Pages and actions"></div>' +
      '<div class="palette__foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>';
    document.body.appendChild(d);

    var input = U.$("#palette-input", d);
    var list = U.$("#palette-list", d);
    var results = [];
    var selected = 0;

    function render() {
      var q = input.value.trim().toLowerCase();
      var terms = q.split(/\s+/).filter(Boolean);
      var match = function (item, group) {
        var h = haystack(item, group);
        return terms.every(function (t) { return h.indexOf(t) !== -1; });
      };
      var pages = allPages().filter(function (p) { return match(p, "page"); });
      var actions = ACTIONS.filter(function (a) { return match(a, "action"); });
      // When searching, show the closest name matches first — and the group holding the best match on top
      var actionsFirst = false;
      if (q) {
        var rank = function (i) { var l = i.label.toLowerCase(); return l.indexOf(q) === 0 ? 0 : l.indexOf(q) !== -1 ? 1 : 2; };
        pages.sort(function (a, b) { return rank(a) - rank(b); });
        actions.sort(function (a, b) { return rank(a) - rank(b); });
        actionsFirst = actions.length > 0 && (!pages.length || rank(actions[0]) < rank(pages[0]));
      }
      results = [];
      var html = "";
      function group(label, items, kind) {
        if (!items.length) return;
        var gid = "palette-g-" + kind;
        html += '<div role="group" aria-labelledby="' + gid + '"><p class="palette__group-label" id="' + gid + '">' + label + "</p>";
        items.forEach(function (it) {
          var idx = results.length;
          results.push(it);
          html += '<div class="palette__item' + (it.id === active ? " is-current" : "") + '" role="option" id="palette-opt-' + idx + '" data-index="' + idx + '" aria-selected="false">' +
            '<span class="palette__item-icon">' + BB.icon(it.icon) + "</span>" +
            '<span><span class="palette__item-title">' + U.escapeHtml(it.label) + "</span>" +
            '<span class="palette__item-desc">' + U.escapeHtml(it.desc || "") + "</span></span>" +
            '<span class="palette__item-hint" aria-hidden="true"><kbd>Enter</kbd></span></div>';
        });
        html += "</div>";
      }
      if (actionsFirst) { group("Quick actions", actions, "actions"); group("Pages", pages, "pages"); }
      else { group("Pages", pages, "pages"); group("Quick actions", actions, "actions"); }
      list.innerHTML = html || '<p class="palette__empty">Nothing matches “' + U.escapeHtml(input.value.trim()) + "”. Try a page name such as planner, exam or reports.</p>";
      select(0);
    }

    function select(i) {
      if (!results.length) { input.removeAttribute("aria-activedescendant"); return; }
      selected = (i + results.length) % results.length;
      U.$$(".palette__item", list).forEach(function (el) {
        var on = Number(el.getAttribute("data-index")) === selected;
        el.setAttribute("aria-selected", String(on));
        if (on) {
          input.setAttribute("aria-activedescendant", el.id);
          el.scrollIntoView({ block: "nearest" });
        }
      });
    }

    function activate(i) {
      var it = results[i];
      if (!it) return;
      BB.dialog.close(d);
      if (it.run) { it.run(); return; }
      location.href = it.href;
    }

    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); select(selected + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); select(selected - 1); }
      else if (e.key === "Home" && !input.value) { e.preventDefault(); select(0); }
      else if (e.key === "End" && !input.value) { e.preventDefault(); select(results.length - 1); }
      else if (e.key === "Enter") { e.preventDefault(); activate(selected); }
    });
    list.addEventListener("mousemove", function (e) {
      var row = e.target.closest(".palette__item");
      if (row && Number(row.getAttribute("data-index")) !== selected) select(Number(row.getAttribute("data-index")));
    });
    list.addEventListener("click", function (e) {
      var row = e.target.closest(".palette__item");
      if (row) activate(Number(row.getAttribute("data-index")));
    });
    U.$("[data-palette-close]", d).addEventListener("click", function () { BB.dialog.close(d); });
    d.addEventListener("click", function (e) { if (e.target === d) BB.dialog.close(d); });

    var opener = null;
    d.addEventListener("close", function () { if (opener && document.body.contains(opener)) opener.focus(); });

    return {
      open: function () {
        opener = document.activeElement;
        input.value = "";
        render();
        BB.dialog.open(d);
        input.focus();
      },
      isOpen: function () { return d.open; }
    };
  }

  function openPalette() {
    if (!palette) palette = createPalette(BB.shell._active);
    if (!palette.isOpen()) palette.open();
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  /* ---------------- Wiring ---------------- */

  function wire(app, sidebar, topbar, bottomNav, active) {
    // Theme
    U.$$("[data-theme-toggle]", topbar).forEach(function (btn) { btn.addEventListener("click", BB.theme.toggle); });
    BB.theme.apply();

    // Menus
    BB.menu.init(U.$("#notif-btn", topbar), U.$("#notif-menu", topbar));
    BB.menu.init(U.$("#profile-btn", topbar), U.$("#profile-menu", topbar));
    var markRead = U.$("[data-mark-read]", topbar);
    if (markRead) markRead.addEventListener("click", function () {
      BB.repo.markNotificationsRead();
      U.$$(".notif-item.is-unread", topbar).forEach(function (n) { n.classList.remove("is-unread"); });
      var dot = U.$(".notif-dot", topbar);
      if (dot) dot.remove();
      U.$("#notif-btn", topbar).setAttribute("aria-label", "Notifications");
      markRead.remove();
      BB.toast.show("Notifications marked as read.", { type: "success" });
    });
    U.$$("[data-sign-out]").forEach(function (btn) {
      btn.addEventListener("click", function () { signOut(); });
    });

    // "Jump to" palette: button, Ctrl/⌘ K, and "/" when not typing
    U.$$("[data-palette-open]").forEach(function (btn) { btn.addEventListener("click", openPalette); });
    document.addEventListener("keydown", function (e) {
      if (app.classList.contains("is-focus-mode")) return;
      var k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "k") { e.preventDefault(); openPalette(); }
      else if (k === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(document.activeElement) && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        openPalette();
      }
    });

    // Buddy's tip card cycles through tips for this page
    var tips = tipsFor(active), tipIndex = 0;
    var tipText = U.$(".sidebar-tip__text", sidebar);
    var tipBuddy = U.$(".sidebar-tip__buddy .mascot", sidebar);
    U.$$("[data-tip-next]", sidebar).forEach(function (btn) {
      btn.addEventListener("click", function () {
        tipIndex = (tipIndex + 1) % tips.length;
        if (tipText) tipText.textContent = tips[tipIndex];
        BB.mascot.bounce(tipBuddy);
      });
    });

    // Desktop collapse
    var collapseBtn = U.$("[data-sidebar-collapse]", sidebar);
    function setCollapsed(on) {
      app.classList.toggle("is-collapsed", on);
      collapseBtn.setAttribute("aria-pressed", String(on));
      collapseBtn.setAttribute("aria-label", on ? "Expand sidebar" : "Collapse sidebar");
      BB.store.set("ui.sidebarCollapsed", on);
      setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 220);
    }
    if (BB.store.get("ui.sidebarCollapsed", false)) setCollapsed(true);
    collapseBtn.addEventListener("click", function () { setCollapsed(!app.classList.contains("is-collapsed")); });

    // Mobile drawer (opened from the top-bar menu button or the bottom bar's "More")
    var openBtn = U.$("[data-sidebar-open]", topbar);
    var moreBtn = bottomNav ? U.$("[data-bottom-more]", bottomNav) : null;
    var closeBtn = U.$("[data-sidebar-close]", sidebar);
    var overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    overlay.hidden = true;
    app.appendChild(overlay);
    var drawerOpener = openBtn;

    function setExpanded(v) {
      openBtn.setAttribute("aria-expanded", v);
      if (moreBtn) moreBtn.setAttribute("aria-expanded", v);
    }
    function openDrawer(from) {
      drawerOpener = from || openBtn;
      app.classList.add("is-drawer-open");
      overlay.hidden = false;
      setExpanded("true");
      var first = U.$(".nav-link", sidebar);
      setTimeout(function () { (closeBtn || first).focus(); }, 50);
    }
    function closeDrawer(returnFocus) {
      if (!app.classList.contains("is-drawer-open")) return;
      app.classList.remove("is-drawer-open");
      overlay.hidden = true;
      setExpanded("false");
      if (returnFocus && drawerOpener) drawerOpener.focus();
    }
    openBtn.addEventListener("click", function () { openDrawer(openBtn); });
    if (moreBtn) moreBtn.addEventListener("click", function () { openDrawer(moreBtn); });
    closeBtn.addEventListener("click", function () { closeDrawer(true); });
    overlay.addEventListener("click", function () { closeDrawer(true); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer(true);
      // Keep focus inside the drawer while it's open
      if (e.key === "Tab" && app.classList.contains("is-drawer-open")) {
        var focusables = U.$$("a[href], button:not([disabled]):not([tabindex='-1'])", sidebar).filter(function (n) { return n.offsetParent !== null; });
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener("resize", function () { if (window.innerWidth >= 768) closeDrawer(false); });
  }

  function signOut() {
    BB.auth.signOut().then(function () {
      location.href = U.root("login.html?signedout=1");
    });
  }

  function mount(opts, user) {
    var app = U.$(".app");
    var sidebar = U.$("#sidebar");
    var topbar = U.$("#topbar");
    if (!app || !sidebar || !topbar) return;
    BB.shell._active = opts.page;
    renderSidebar(sidebar, opts.page);
    renderTopbar(topbar, opts, user);
    var bottomNav = renderBottomNav(app, opts.page);
    wire(app, sidebar, topbar, bottomNav, opts.page);
    if (opts.title) document.title = opts.title + " | Brainy Buddy";
  }

  function setTitle(title, subtitle) {
    var h = U.$("#topbar .topbar__title h1");
    if (h) h.textContent = title;
    if (subtitle != null) {
      var p = U.$("#topbar .topbar__title p");
      if (p) p.textContent = subtitle;
    }
  }

  function showPageError(err) {
    var main = U.$("#main");
    if (!main) return;
    main.innerHTML =
      '<div class="panel"><div class="empty-state">' +
      '<div class="empty-state__art">' + BB.mascot.svg({ mood: "thinking" }) + "</div>" +
      '<h2 class="empty-state__title">This page didn\'t load correctly</h2>' +
      "<p>Something unexpected happened while preparing this page. Reload to try again. Your saved data hasn't been changed.</p>" +
      '<button type="button" class="btn btn--primary" onclick="location.reload()">Reload page</button>' +
      '<p class="text-xs text-muted">Details: ' + U.escapeHtml(err && err.message ? err.message : String(err)) + "</p>" +
      "</div></div>";
  }

  BB.shell = { mount: mount, setTitle: setTitle, signOut: signOut, showPageError: showPageError, openPalette: openPalette, NAV: NAV, pageLabel: pageLabel };

  BB.app = {
    init: function (opts, fn) {
      U.ready(function () {
        var user = opts.public
          ? (BB.auth.currentUser() || { id: "guest", name: "Guest", email: "Not signed in", educationLevel: "", preferences: {} })
          : BB.auth.requireUser();
        if (!user) return;
        BB.auth.renderDemoBanner(U.$(".app__main"));
        mount(opts, user);
        BB.icons.hydrate();
        BB.mascot.hydrate();
        try {
          fn({ user: user });
          BB.icons.hydrate();
          BB.mascot.hydrate();
        } catch (err) {
          console.error(err);
          showPageError(err);
        }
      });
    }
  };

  BB.page = {
    init: function (fn) {
      U.ready(function () {
        BB.theme.apply();
        U.$$("[data-theme-toggle]").forEach(function (btn) { btn.addEventListener("click", BB.theme.toggle); });
        BB.icons.hydrate();
        BB.mascot.hydrate();
        try { if (fn) fn(); } catch (err) { console.error(err); }
      });
    }
  };
})(window.BB = window.BB || {});
