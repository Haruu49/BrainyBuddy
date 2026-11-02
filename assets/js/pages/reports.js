/** My Reports — academic progress report with preview and print layout. */
(function (BB) {
  "use strict";
  var U = BB.utils, EA = BB.examAnalytics, SA = BB.studyAnalytics;
  var e = U.escapeHtml;

  BB.app.init({ page: "reports", title: "My Reports" }, function (ctx) {
    var periodSel = U.$("#period");
    periodSel.addEventListener("change", function () { render(ctx.user); });
    U.$("#preview-btn").addEventListener("click", function () { setPreview(true); });
    U.$("#exit-preview").addEventListener("click", function () { setPreview(false); });
    U.$$("[data-print]").forEach(function (b) { b.addEventListener("click", function () { preparePrint(); window.print(); }); });
    window.addEventListener("beforeprint", preparePrint);
    window.addEventListener("afterprint", restoreAfterPrint);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && document.body.classList.contains("is-report-preview")) setPreview(false); });
    render(ctx.user);
  });

  // Charts are drawn on canvas, so re-draw them in light colours for paper.
  var themeBeforePrint = null;
  function preparePrint() {
    if (themeBeforePrint !== null) return;
    themeBeforePrint = document.documentElement.getAttribute("data-theme");
    if (themeBeforePrint !== "light") {
      document.documentElement.setAttribute("data-theme", "light");
      BB.charts.rebuildAll();
    }
    BB.charts.resizeAll();
  }
  function restoreAfterPrint() {
    if (themeBeforePrint === null) return;
    if (themeBeforePrint !== "light") {
      document.documentElement.setAttribute("data-theme", themeBeforePrint);
      BB.charts.rebuildAll();
    }
    themeBeforePrint = null;
    BB.charts.resizeAll();
  }

  function setPreview(on) {
    document.body.classList.toggle("is-report-preview", on);
    window.scrollTo(0, 0);
    setTimeout(BB.charts.resizeAll, 50);
    (on ? U.$("#exit-preview") : U.$("#preview-btn")).focus();
  }

  function range() {
    var v = U.$("#period").value;
    var to = new Date();
    if (v === "all") return { from: null, to: to, label: "All recorded activity" };
    var from = U.addDays(U.startOfDay(to), -(Number(v) - 1));
    return { from: from, to: to, label: U.formatDate(from) + " to " + U.formatDate(to) };
  }

  function inRange(ts, r) { return (!r.from || ts >= r.from.getTime()) && ts <= r.to.getTime(); }

  function trendCell(earlier, recent, unit, decimals) {
    if (earlier == null || recent == null) return '<td class="num">' + (earlier == null ? "—" : U.round(earlier, decimals || 0) + unit) + '</td><td class="num">' + (recent == null ? "—" : U.round(recent, decimals || 0) + unit) + '</td><td class="num text-muted">Not enough data</td>';
    var d = recent - earlier;
    var cls = Math.abs(d) < 0.05 ? "" : d > 0 ? "trend-up" : "trend-down";
    return '<td class="num">' + U.round(earlier, decimals || 0) + unit + '</td><td class="num">' + U.round(recent, decimals || 0) + unit + '</td><td class="num ' + cls + '">' + (d >= 0 ? "+" : "−") + Math.abs(U.round(d, decimals || 0)) + unit + "</td>";
  }

  function render(user) {
    var r = range();
    var attempts = BB.repo.attempts().filter(function (a) { return inRange(a.startedAt, r); });
    var sessions = BB.repo.sessions().filter(function (s) { return inRange(s.startedAt, r); });
    var records = BB.repo.records().filter(function (x) { return inRange(U.parseDateKey(x.examDate).getTime(), r); });
    var results = BB.academic.results(attempts, records);
    var subjects = BB.repo.subjects();
    var stats = BB.academic.subjectStats(attempts, records, subjects).filter(function (s) { return s.count; });
    var demo = BB.repo.showDemo();

    var html = "";
    // Header
    html += '<header class="report__head"><div>' + BB.mascot.mark() + '<h2 class="report__title" id="report-title">Academic progress report</h2>' +
      '<p class="report__student"><strong style="color:var(--color-text)">' + e(user.name) + "</strong>, " + e(BB.demo.educationLabel(user.educationLevel)) + (user.institution ? ", " + e(user.institution) : "") + (user.yearOfStudy ? ", " + e(user.yearOfStudy) : "") + "</p></div>" +
      '<div class="report__meta"><strong>Brainy Buddy</strong>Period: ' + e(r.label) + "<br>Generated " + U.formatDate(new Date(), "datetime") +
      (demo ? '<br><span class="badge badge--demo" style="margin-top:6px">Includes demo data</span>' : "") + "</div></header>";

    if (!results.length && !sessions.length) {
      html += '<div class="report__section">' + BB.ui.empty({ title: "Nothing to report for this period", text: "There are no exams or study sessions in the selected period. Choose a longer period, or come back after you've practised.", headingTag: "h3" }) + "</div>";
      U.$("#report").innerHTML = html;
      return;
    }

    // 1 — Examination performance
    var scores = results.map(function (x) { return x.scorePct; });
    var acc = BB.academic.accuracy(attempts);
    html += section(1, "Examination performance",
      '<dl class="report__kv">' +
      kv("Examinations", results.length) +
      kv("Average score", results.length ? Math.round(U.mean(scores)) + "%" : "—") +
      kv("Accuracy (practice exams)", acc == null ? "—" : Math.round(acc) + "%") +
      kv("Highest score", results.length ? Math.round(Math.max.apply(null, scores)) + "%" : "—") +
      kv("Lowest score", results.length ? Math.round(Math.min.apply(null, scores)) + "%" : "—") + "</dl>" +
      (results.length
        ? '<div class="report__two"><div class="chart-box"><canvas id="r-scores" role="img" aria-label="Exam scores in date order"></canvas></div>' +
          '<div class="table-wrap"><table class="table"><caption class="visually-hidden">Examinations in this period</caption><thead><tr><th scope="col">Date</th><th scope="col">Examination</th><th scope="col" class="num">Score</th></tr></thead><tbody>' +
          results.slice(-8).reverse().map(function (x) { return "<tr><td>" + U.formatDate(x.date, "short") + "</td><td>" + e(x.title) + (x.source === "imported" ? ' <span class="text-xs text-secondary">(imported)</span>' : "") + '</td><td class="num">' + Math.round(x.scorePct) + "%</td></tr>"; }).join("") +
          "</tbody></table></div></div>" + (results.length > 8 ? '<p class="report__note">The table shows the 8 most recent of ' + results.length + " examinations.</p>" : "")
        : '<p class="text-secondary text-sm">No examinations in this period.</p>'));

    // 2 — Subject comparison
    html += section(2, "Subject comparison",
      stats.length
        ? '<div class="report__two"><div class="table-wrap"><table class="table"><caption class="visually-hidden">Subject comparison</caption><thead><tr><th scope="col">Subject</th><th scope="col" class="num">Exams</th><th scope="col" class="num">Average</th><th scope="col" class="num">Latest</th><th scope="col" class="num">Change</th></tr></thead><tbody>' +
          stats.map(function (s) {
            return '<tr><td><span class="subject-name"><span class="subject-dot" style="background:' + s.color + '"></span>' + e(s.subject) + '</span></td><td class="num">' + s.count + '</td><td class="num">' + Math.round(s.avgScore) + '%</td><td class="num">' + Math.round(s.latestScore) + "%</td>" +
              '<td class="num ' + (s.trend == null ? "" : s.trend > 0 ? "trend-up" : s.trend < 0 ? "trend-down" : "") + '">' + (s.trend == null ? "—" : (s.trend >= 0 ? "+" : "−") + Math.abs(Math.round(s.trend)) + " pts") + "</td></tr>";
          }).join("") + '</tbody></table></div><div class="chart-box"><canvas id="r-subjects" role="img" aria-label="Average score by subject"></canvas></div></div>' +
          '<p class="report__note">Change compares the first and latest exam in each subject within this period.</p>'
        : '<p class="text-secondary text-sm">No subject results in this period.</p>');

    // 3 — Examination behaviour
    if (attempts.length) {
      var ov = EA.overview(attempts);
      var tc = EA.typeComparison(attempts);
      var ins = EA.insights(attempts).slice(0, 3);
      html += section(3, "Examination behaviour summary",
        '<dl class="report__kv">' +
        kv("Average time per question", U.formatDuration(ov.avgAnswerMs)) +
        kv("Time management score", ov.tms + " / 100") +
        kv("Written questions: share of time", Math.round(tc.subjective.timeShare) + "%") +
        kv("Written questions: share of marks", Math.round(tc.subjective.markShare) + "%") +
        kv("Questions revised", ov.revised + " of " + ov.questions) +
        kv("Left unanswered", ov.unanswered) + "</dl>" +
        (ins.length ? '<h4 class="label" style="margin-bottom:8px">Patterns found</h4><ul class="report__list">' + ins.map(function (i) { return "<li><strong>" + e(i.title) + ".</strong> " + e(i.pattern) + " <em>(" + e(i.confidence.label.toLowerCase()) + ")</em></li>"; }).join("") + "</ul>" : '<p class="text-sm text-secondary">No notable behaviour patterns were found in this period.</p>') +
        '<p class="report__note">Time management score: 40% completion, 40% pacing within each question\'s mark-weighted time budget, 20% answers given before the final 10% of time. Patterns describe what happened, not why.</p>');
    } else {
      html += section(3, "Examination behaviour summary", '<p class="text-secondary text-sm">No simulator exams in this period, so there\'s no behaviour data. Imported records don\'t include behaviour.</p>');
    }

    // 4 — Study habits
    if (sessions.length) {
      var sum = SA.summary(sessions);
      var pc = SA.periodComparison(sessions);
      var period = sum.mostActivePeriod ? BB.demo.PERIODS.filter(function (p) { return p.key === sum.mostActivePeriod.key; })[0] : null;
      html += section(4, "Study habits summary",
        '<dl class="report__kv">' +
        kv("Total study time", U.formatMinutes(sum.totalMinutes)) +
        kv("Sessions", sum.count) +
        kv("Average session", U.formatMinutes(sum.avgMinutes)) +
        kv("Study days per week", U.round(sum.daysPerWeek, 1)) +
        kv("Average focus", sum.avgFocus == null ? "—" : U.round(sum.avgFocus, 1) + " / 5") +
        kv("Most active period", period ? period.label : "—") + "</dl>" +
        '<p class="text-sm"><strong>Best study time (' + e(pc.verdict.label.toLowerCase()) + "):</strong> " + e(pc.verdict.message) + "</p>");
    } else {
      html += section(4, "Study habits summary", '<p class="text-secondary text-sm">No study sessions were recorded in this period.</p>');
    }

    // 5 — Improvement trends (first half vs second half of the period)
    var start = r.from ? r.from.getTime() : Math.min.apply(null, results.map(function (x) { return x.date; }).concat(sessions.map(function (s) { return s.startedAt; })));
    var mid = start + (r.to.getTime() - start) / 2;
    var aE = attempts.filter(function (a) { return a.startedAt < mid; }), aR = attempts.filter(function (a) { return a.startedAt >= mid; });
    var resE = results.filter(function (x) { return x.date < mid; }), resR = results.filter(function (x) { return x.date >= mid; });
    var sE = sessions.filter(function (s) { return s.startedAt < mid; }), sR = sessions.filter(function (s) { return s.startedAt >= mid; });
    var halfWeeks = Math.max(1, (r.to.getTime() - start) / 2 / (7 * U.DAY));
    var avg = function (list, fn) { return list.length ? U.mean(list, fn) : null; };
    html += section(5, "Improvement trends",
      '<div class="table-wrap"><table class="table"><caption class="visually-hidden">Earlier half of the period compared with the recent half</caption><thead><tr><th scope="col">Measure</th><th scope="col" class="num">Earlier half</th><th scope="col" class="num">Recent half</th><th scope="col" class="num">Change</th></tr></thead><tbody>' +
      "<tr><th scope=\"row\">Average score</th>" + trendCell(avg(resE, function (x) { return x.scorePct; }), avg(resR, function (x) { return x.scorePct; }), "%") + "</tr>" +
      "<tr><th scope=\"row\">Accuracy</th>" + trendCell(BB.academic.accuracy(aE), BB.academic.accuracy(aR), "%") + "</tr>" +
      "<tr><th scope=\"row\">Time management score</th>" + trendCell(aE.length ? EA.overview(aE).tms : null, aR.length ? EA.overview(aR).tms : null, "") + "</tr>" +
      "<tr><th scope=\"row\">Study hours per week</th>" + trendCell(sE.length ? U.sum(sE, function (s) { return s.activeMinutes; }) / 60 / halfWeeks : null, sR.length ? U.sum(sR, function (s) { return s.activeMinutes; }) / 60 / halfWeeks : null, " h", 1) + "</tr>" +
      "<tr><th scope=\"row\">Average focus rating</th>" + trendCell(avg(sE.filter(function (s) { return s.focus; }), function (s) { return s.focus; }), avg(sR.filter(function (s) { return s.focus; }), function (s) { return s.focus; }), "", 1) + "</tr>" +
      '</tbody></table></div><p class="report__note">The period is split into two equal halves. Small differences can happen by chance, especially with only a few exams.</p>');

    // 6 — Recommendations
    var recs = BB.recommend.current();
    var done = recs.filter(function (x) { return x.status === "completed"; });
    var doing = recs.filter(function (x) { return x.status === "in_progress"; });
    html += section(6, "Completed recommendations",
      (done.length
        ? '<ul class="report__list">' + done.map(function (x) { return "<li><strong>" + e(x.title) + "</strong> (" + e(x.category) + ")" + (x.statusUpdatedAt ? ", completed " + U.formatDate(x.statusUpdatedAt) : "") + ". Target: " + e(x.target) + "</li>"; }).join("") + "</ul>"
        : '<p class="text-sm text-secondary">No recommendations have been marked as completed yet.</p>') +
      (doing.length ? '<h4 class="label" style="margin:16px 0 8px">In progress</h4><ul class="report__list">' + doing.map(function (x) { return "<li>" + e(x.title) + (x.progress ? " (" + x.progress.pct + "% of the way to the target)" : "") + "</li>"; }).join("") + "</ul>" : "") +
      '<p class="report__note">Recommendations are generated by transparent rules from your records. No AI model is connected in this demo.</p>');

    html += '<footer class="report__foot"><span>Brainy Buddy: Learn Smarter. Understand Yourself.</span><span>' + (demo ? "Contains illustrative demo data. " : "") + "Generated from records stored in this browser.</span></footer>";
    U.$("#report").innerHTML = html;

    if (results.length) BB.charts.create("r-scores", function (c) {
      return {
        type: "line",
        data: { labels: results.map(function (x) { return U.formatDate(x.date, "short"); }), datasets: [{ label: "Score", data: results.map(function (x) { return x.scorePct; }), borderColor: c.primary, backgroundColor: c.alpha(c.objective, 0.1), fill: true, pointBackgroundColor: results.map(function (x) { return BB.repo.subjectColor(x.subject); }), pointRadius: 4 }] },
        options: { animation: false, plugins: { legend: { display: false } }, scales: { y: BB.charts.axes.percent(c), x: BB.charts.axes.category({ ticks: { maxRotation: 0, autoSkipPadding: 10 } }) } }
      };
    });
    if (stats.length) BB.charts.create("r-subjects", function (c) {
      return {
        type: "bar",
        data: { labels: stats.map(function (s) { return s.subject; }), datasets: [{ label: "Average score", data: stats.map(function (s) { return U.round(s.avgScore, 1); }), backgroundColor: stats.map(function (s) { return s.color; }), maxBarThickness: 20 }] },
        options: { animation: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: BB.charts.axes.percent(c), y: BB.charts.axes.category() } }
      };
    });
  }

  function section(n, title, body) {
    return '<section class="report__section" aria-labelledby="rs-' + n + '"><h3 id="rs-' + n + '"><span class="num">' + n + "</span>" + e(title) + "</h3>" + body + "</section>";
  }
  function kv(label, value) { return "<div><dt>" + e(label) + "</dt><dd>" + e(value) + "</dd></div>"; }
})(window.BB = window.BB || {});
