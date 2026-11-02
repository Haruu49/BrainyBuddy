/** AI Recommendations (rule-based demo) */
(function (BB) {
  "use strict";
  var U = BB.utils;
  var recs = [], category = "all";

  BB.app.init({ page: "recommendations", title: "AI Recommendations" }, function () {
    U.$("#demo-flag").innerHTML = BB.repo.showDemo() ? BB.ui.demoBadge("Includes demo data") : "";
    recs = BB.recommend.current();
    U.$("#status-filter").addEventListener("change", renderList);
    render();
    // Deep link from the dashboard (#rec-<id>)
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) { target.scrollIntoView({ block: "start" }); target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
    }
  });

  function render() { renderMetrics(); renderChips(); renderList(); }

  function renderMetrics() {
    var count = function (s) { return recs.filter(function (r) { return r.status === s; }).length; };
    var cats = {};
    recs.forEach(function (r) { cats[r.category] = true; });
    U.$("#rec-metrics").innerHTML =
      BB.ui.metric({ icon: "sparkles", label: "Active recommendations", value: recs.length - count("completed"), foot: "Not yet completed" }) +
      BB.ui.metric({ icon: "play", tone: "amber", label: "In progress", value: count("in_progress") }) +
      BB.ui.metric({ icon: "check-circle", tone: "accent", label: "Completed", value: count("completed"), progress: recs.length ? U.pct(count("completed"), recs.length) : 0, progressAccent: true, progressLabel: "Recommendations completed" }) +
      BB.ui.metric({ icon: "layers", tone: "violet", label: "Categories covered", value: Object.keys(cats).length + " of " + BB.recommend.CATEGORIES.length });
  }

  function renderChips() {
    var el = U.$("#category-chips");
    var counts = {};
    recs.forEach(function (r) { counts[r.category] = (counts[r.category] || 0) + 1; });
    el.innerHTML = '<button type="button" class="chip" data-cat="all" aria-pressed="' + (category === "all") + '">All (' + recs.length + ")</button>" +
      BB.recommend.CATEGORIES.map(function (c) {
        return '<button type="button" class="chip" data-cat="' + U.escapeHtml(c) + '" aria-pressed="' + (category === c) + '">' + BB.icon(BB.recommend.CATEGORY_ICONS[c], { size: "sm" }) + U.escapeHtml(c) + " (" + (counts[c] || 0) + ")</button>";
      }).join("");
    U.$$(".chip", el).forEach(function (b) {
      b.addEventListener("click", function () { category = b.getAttribute("data-cat"); renderChips(); renderList(); el.querySelector('[data-cat="' + category + '"]').focus(); });
    });
  }

  function progressBlock(r) {
    var p = r.progress;
    if (!p) return '<div class="rec-progress"><p class="text-sm text-secondary">Progress will be measured after your next exam or study session that includes this behaviour.</p></div>';
    return '<div class="rec-progress"><div class="split"><span class="label">Progress towards target</span><span class="text-sm fw-600">' + (p.met ? '<span class="text-success">Target met</span>' : p.pct + "%") + "</span></div>" +
      '<div class="progress' + (p.met ? " progress--accent" : "") + '" role="progressbar" aria-label="Progress towards target" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.pct + '" style="--value:' + p.pct + '%"><span class="progress__bar"></span></div>' +
      '<div class="rec-progress__nums"><span>Starting point<strong>' + p.baseline + p.unit + '</strong></span><span style="text-align:center">Latest<strong>' + p.current + p.unit + '</strong></span><span style="text-align:right">Target<strong>' + p.target + p.unit + "</strong></span></div></div>";
  }

  function plannerLink(r) {
    var subject = (r.id.indexOf("su-") === 0 && r.title.replace("Focused practice for ", "")) || "";
    return "planner.html?suggest=" + encodeURIComponent(r.id) + (subject ? "&subject=" + encodeURIComponent(subject) : "");
  }

  function renderList() {
    var status = U.$("#status-filter").value;
    var list = recs.filter(function (r) {
      if (category !== "all" && r.category !== category) return false;
      if (status === "open") return r.status !== "completed";
      if (status !== "all" && r.status !== status) return false;
      return true;
    });
    var el = U.$("#rec-list");
    if (!recs.length) {
      el.innerHTML = '<div class="panel">' + BB.ui.empty({ title: "No recommendations yet", text: "Recommendations appear once there's enough data: at least 2 exams for exam strategy, and 5 or more study sessions for study habits.", action: { href: "exam.html", label: "Take a practice exam" } }) + "</div>";
      return;
    }
    if (!list.length) {
      el.innerHTML = '<div class="panel">' + BB.ui.empty({ mood: "thinking", title: "Nothing matches these filters", text: "Choose another category or status to see more recommendations." }) + "</div>";
      return;
    }
    el.innerHTML = list.map(function (r) {
      var footer =
        progressBlock(r) +
        '<div class="rec-controls">' +
        '<div class="cluster"><label class="label" for="st-' + r.id + '" style="font-weight:500">Status</label>' +
        '<select class="select select--sm" id="st-' + r.id + '" data-status-for="' + r.id + '">' +
        BB.recommend.STATUSES.map(function (s) { return '<option value="' + s.value + '"' + (s.value === r.status ? " selected" : "") + ">" + s.label + "</option>"; }).join("") + "</select>" +
        (r.statusUpdatedAt ? '<span class="text-xs text-secondary">Updated ' + U.relativeTime(r.statusUpdatedAt) + "</span>" : "") + "</div>" +
        '<a class="btn btn--sm btn--soft" href="' + plannerLink(r) + '">' + BB.icon("calendar") + "Schedule in planner</a></div>" +
        '<details class="rule-note"><summary>How this was generated</summary><p>' + U.escapeHtml(r.rule) + " Confidence: " + U.escapeHtml(r.confidence.reason) + "</p></details>";
      return BB.ui.insightCard(r, { badge: BB.repo.showDemo() ? BB.ui.demoBadge() : "", headingTag: "h3", footer: '<div class="stack" style="--stack-gap:12px">' + footer + "</div>" })
        .replace('<article class="insight"', '<article class="insight rec-card" data-status="' + r.status + '"')
        .replace('id="insight-' + r.id + '"', 'id="rec-' + r.id + '"');
    }).join("");
    U.$$("[data-status-for]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var id = sel.getAttribute("data-status-for");
        var saved = BB.repo.setRecStatus(id, sel.value);
        var r = recs.filter(function (x) { return x.id === id; })[0];
        r.status = saved.status;
        r.statusUpdatedAt = saved.updatedAt;
        BB.toast.show("Marked as " + BB.recommend.statusLabel(sel.value).toLowerCase() + ".", { type: "success" });
        renderMetrics();
        renderChips();
        renderList();
        var again = document.getElementById("st-" + id);
        if (again) again.focus();
      });
    });
  }
})(window.BB = window.BB || {});
