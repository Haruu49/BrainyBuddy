/** Design system reference page (public — no sign-in required). */
(function (BB) {
  "use strict";
  var U = BB.utils;

  BB.app.init({ page: "", title: "Design system", public: true }, function () {
    var SW = [
      ["Peach", "#FFA781", "Brand, primary buttons, active navigation"], ["Peach 600", "#E2652F", "Objective questions, form controls, chart lines"],
      ["Peach 700", "#B0461C", "Links and peach text (AA contrast)"], ["Brain Pink", "#F59AB0", "Buddy, secondary accents"], ["Pink 700", "#A8335A", "Pink text (AA contrast)"],
      ["Plum", "#3B2730", "Main text, tooltips, toasts"], ["Secondary Text", "#7A5A62", "Supporting text"], ["Blush", "#FFF6F2", "Page background"], ["White", "#FFFFFF", "Surfaces"],
      ["Teal", "#14B8A6", "Written questions, success"], ["Honey", "#FCD27A", "Planner tile, highlights"], ["Red 600", "#C62828", "Errors"]
    ];
    U.$("#swatches").innerHTML = SW.map(function (s) {
      return '<div class="swatch"><div class="swatch__chip" style="background:' + s[1] + '"></div><div class="swatch__info"><strong>' + s[0] + "</strong><code>" + s[1] + "</code><div class=\"text-secondary\">" + s[2] + "</div></div></div>";
    }).join("");

    U.$("#sg-metrics").innerHTML =
      BB.ui.metric({ icon: "target", label: "Average score", value: 72, unit: "%", delta: { dir: "up", text: "+4 pts vs last month" } }) +
      BB.ui.metric({ icon: "check-circle", tone: "accent", label: "Accuracy", value: 81, unit: "%", delta: { dir: "down", text: "−2 pts" } }) +
      BB.ui.metric({ icon: "file", tone: "violet", label: "Completed exams", value: 12, foot: "3 this month" }) +
      BB.ui.metric({ icon: "clock", tone: "amber", label: "Weekly hours", value: 7.5, unit: "h", progress: 75, progressAccent: true, foot: "Goal 10 h" });

    U.$("#sg-insight").innerHTML = BB.ui.insightCard({
      category: "Time Management", title: "Example insight card",
      pattern: "Written questions used 65% of answering time and carry 48% of the marks.",
      evidence: ["Seen in 5 of the last 6 exams.", "Objective accuracy: 74%."],
      confidence: { level: "high", label: "High confidence", reason: "Based on 6 exams and 72 question responses." },
      action: "Practise timed written answers.", target: "Written time share at or below 53% in the next 3 exams."
    }, { badge: '<span class="badge badge--demo">Example</span>' });

    U.$("#sg-empty").innerHTML = BB.ui.empty({ title: "No study sessions yet", text: "Start a session and it will appear here.", action: { id: "sg-empty-btn", label: "Start a session" } });
    U.$("#sg-empty-btn").addEventListener("click", function () { BB.toast.show("Empty-state actions lead somewhere useful.", { type: "info" }); });

    U.$("#sg-mascots").innerHTML = [["happy", "Happy (default)"], ["thinking", "Thinking"], ["celebrate", "Celebrating"], ["wave", "Waving"]].map(function (m) {
      return "<figure>" + BB.mascot.svg({ mood: m[0], title: "Buddy, " + m[1].toLowerCase() }) + "<figcaption>" + m[1] + "</figcaption></figure>";
    }).join("");
    U.$("#sg-icon-grid").innerHTML = BB.icons.names.map(function (n) { return "<div>" + BB.icon(n) + "<span>" + n + "</span></div>"; }).join("");

    BB.forms.wirePasswordToggles();
    var form = U.$("#sg-form");
    var v = BB.forms.validator(form, { email: [BB.forms.rules.required("Enter an email address."), BB.forms.rules.email()] });
    form.addEventListener("submit", function (e) { e.preventDefault(); if (v.validate()) BB.toast.show("Looks good.", { type: "success" }); });

    var loadBtn = U.$("#sg-loading");
    loadBtn.addEventListener("click", function () { BB.forms.setLoading(loadBtn, true, "Loading…"); setTimeout(function () { BB.forms.setLoading(loadBtn, false); }, 1500); });
    U.$$("#sg-chips .chip").forEach(function (c) { c.addEventListener("click", function () { c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true")); }); });
    U.$$("[data-toast]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-toast");
        BB.toast.show(t === "error" ? "Couldn't save. Check your connection and try again." : "Changes saved.", { type: t });
      });
    });
    U.$("#sg-dialog").addEventListener("click", function () {
      BB.dialog.confirm({ title: "Example dialog", body: "<p>Dialogs trap focus, close with Escape and return focus to the button that opened them.</p>", confirmText: "Got it" });
    });
    BB.menu.init(U.$("#sg-menu-btn"), U.$("#sg-menu"));

    var tabs = U.$$('#sg-nav ~ [role="tablist"] [role="tab"], [aria-label="Example tabs"] [role="tab"]');
    tabs.forEach(function (t, i) {
      function select(tab) {
        tabs.forEach(function (x) { var on = x === tab; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute("aria-controls")).hidden = !on; });
        tab.focus();
      }
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); select(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]); }
      });
    });
  });
})(window.BB = window.BB || {});
