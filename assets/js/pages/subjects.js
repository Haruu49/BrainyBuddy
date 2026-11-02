/** My Subjects */
(function (BB) {
  "use strict";
  var U = BB.utils;

  BB.app.init({ page: "subjects", title: "My Subjects" }, function () {
    U.$("#demo-flag").innerHTML = BB.repo.showDemo() ? BB.ui.demoBadge("Includes demo data") : "";
    var subjects = BB.repo.subjects();
    var stats = BB.academic.subjectStats(BB.repo.attempts(), BB.repo.records(), subjects);
    var sessions = BB.repo.sessions();
    var mine = subjects.map(function (s) { return s.name; });
    var grid = U.$("#subject-grid");

    if (!subjects.length) {
      grid.innerHTML = '<div class="panel span-all">' + BB.ui.empty({ title: "No subjects yet", text: "Add the subjects you're studying to see results and study time for each.", action: { href: "settings.html#subjects", label: "Add subjects" }, headingTag: "h3" }) + "</div>";
      return;
    }

    grid.innerHTML = stats.filter(function (s) { return mine.indexOf(s.subject) !== -1; }).map(function (s) {
      var studied = sessions.filter(function (x) { return x.subject === s.subject; });
      var minutes = U.sum(studied, function (x) { return x.activeMinutes; });
      var trend = s.trend == null ? '<span class="text-muted">—</span>'
        : '<span class="' + (s.trend > 0 ? "text-success" : s.trend < 0 ? "text-danger" : "") + '">' + (s.trend >= 0 ? "+" : "−") + Math.abs(Math.round(s.trend)) + " pts</span>";
      var cats = s.categories.slice().sort(function (a, b) { return b.pct - a.pct; });
      return '<article class="panel subject-card" style="--subject-color:' + s.color + '" aria-labelledby="sub-' + U.hashString(s.subject) + '">' +
        '<div class="subject-card__head"><div><h3 class="panel__title" id="sub-' + U.hashString(s.subject) + '">' + U.escapeHtml(s.subject) + "</h3>" +
        '<p class="panel__subtitle">' + (s.lastDate ? "Last exam " + U.formatDate(s.lastDate) : "No exams yet") + "</p></div>" +
        (BB.questionBank.has(s.subject) ? '<span class="badge badge--primary">Practice exams</span>' : '<span class="badge">No demo questions</span>') + "</div>" +
        '<dl class="subject-card__stats">' +
        "<div><dt>Average score</dt><dd>" + (s.avgScore == null ? '<span class="text-muted">—</span>' : Math.round(s.avgScore) + "%") + "</dd></div>" +
        "<div><dt>Exams</dt><dd>" + s.count + "</dd></div>" +
        "<div><dt>Change</dt><dd>" + trend + "</dd></div>" +
        "<div><dt>Study time</dt><dd>" + (minutes ? U.formatMinutes(minutes) : '<span class="text-muted">—</span>') + "</dd></div>" +
        "<div><dt>Sessions</dt><dd>" + studied.length + "</dd></div>" +
        "<div><dt>Avg focus</dt><dd>" + (studied.filter(function (x) { return x.focus; }).length ? U.round(U.mean(studied.filter(function (x) { return x.focus; }), function (x) { return x.focus; }), 1) : '<span class="text-muted">—</span>') + "</dd></div></dl>" +
        (cats.length
          ? '<div class="subject-card__cats"><p class="label">Marks by topic</p>' + cats.map(function (c) {
            return '<div class="subject-card__cat"><span>' + U.escapeHtml(c.category) + '</span><div class="progress progress--sm" role="progressbar" aria-label="' + U.escapeHtml(c.category) + ' marks" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(c.pct) + '" style="--value:' + c.pct + '%"><span class="progress__bar" style="background:' + s.color + '"></span></div><span class="text-sm fw-600 tabular" style="text-align:right">' + Math.round(c.pct) + "%</span></div>";
          }).join("") + "</div>"
          : '<p class="text-sm text-secondary">Topic results appear after a practice exam in this subject.</p>') +
        '<div class="subject-card__actions">' +
        (BB.questionBank.has(s.subject) ? '<a class="btn btn--sm btn--primary" href="exam.html?subject=' + encodeURIComponent(s.subject) + '">' + BB.icon("timer") + "Practice exam</a>" : "") +
        '<a class="btn btn--sm" href="planner.html?subject=' + encodeURIComponent(s.subject) + '">' + BB.icon("calendar") + "Plan a session</a></div>" +
        "</article>";
    }).join("");
  });
})(window.BB = window.BB || {});
