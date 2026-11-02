/** Study Habits — session tracker and study analytics. */
(function (BB) {
  "use strict";
  var U = BB.utils, SA = BB.studyAnalytics;
  var tick = null;

  BB.app.init({ page: "habits", title: "Study Habits" }, function () {
    U.$("#demo-flag").innerHTML = BB.repo.showDemo() ? BB.ui.demoBadge("Includes demo data") : "";
    renderTracker();
    renderAnalytics();
    wireEndDialog();
  });

  /* ======================= Tracker ======================= */
  function activeMs(s) {
    var ms = U.sum(s.segments, function (seg) { return seg.end - seg.start; });
    if (!s.paused && s.runningSince) ms += Date.now() - s.runningSince;
    return ms;
  }
  function pausedMs(s) {
    var total = Date.now() - s.startedAt;
    return Math.max(0, total - activeMs(s));
  }

  function renderTracker() {
    clearInterval(tick);
    var el = U.$("#tracker");
    var s = BB.repo.activeStudy();
    el.classList.toggle("tracker--active", !!s);
    var subjects = BB.repo.subjects();

    if (!s) {
      el.innerHTML =
        '<div><h2 class="panel__title" id="tracker-title">Start a study session</h2>' +
        '<p class="panel__subtitle" style="margin-bottom:20px">The timer keeps running if you leave this page, and you can pause for breaks.</p>' +
        '<form class="tracker__form" id="start-form" novalidate>' +
        '<div class="field"><label class="label" for="st-subject">Subject</label><select class="select" id="st-subject" name="subject">' +
        subjects.map(function (x) { return '<option value="' + U.escapeHtml(x.name) + '">' + U.escapeHtml(x.name) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label class="label" for="st-topic">Topic <span class="optional">(optional)</span></label><input class="input" id="st-topic" name="topic" maxlength="60" placeholder="For example, Waves"></div>' +
        '<button type="submit" class="btn btn--accent btn--lg">' + BB.icon("play") + "Start session</button>" +
        "</form></div>" +
        '<div class="buddy-note">' + BB.mascot.svg({ mood: "happy" }) + "<p><strong>Tip from Buddy</strong>Rate your focus honestly when you finish. It helps compare sessions fairly, and nobody else sees it.</p></div>";
      U.$("#start-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var now = Date.now();
        BB.repo.saveActiveStudy({
          id: U.uid("ses"),
          subject: U.$("#st-subject").value,
          topic: U.$("#st-topic").value.trim(),
          startedAt: now,
          runningSince: now,
          paused: false,
          segments: [],
          breaks: 0
        });
        BB.toast.show("Study session started. Good luck!", { type: "success" });
        renderTracker();
        var pause = U.$("#pause-btn");
        if (pause) pause.focus();
      });
      return;
    }

    el.innerHTML =
      "<div>" +
      '<h2 class="visually-hidden" id="tracker-title">Active study session</h2>' +
      '<span class="tracker__status tracker__status--' + (s.paused ? "paused" : "running") + '" id="st-status"><span class="dot"></span>' + (s.paused ? "Paused" : "Studying") + "</span>" +
      '<p class="tracker__clock" id="st-clock" role="timer" aria-label="Active study time">00:00</p>' +
      '<p class="tracker__meta">' + U.escapeHtml(s.subject) + (s.topic ? ": " + U.escapeHtml(s.topic) : "") + ". Started at " + U.formatDate(s.startedAt, "time") + '. Paused time: <span id="st-paused">0s</span>.</p>' +
      '<div class="tracker__controls" style="margin-top:20px">' +
      (s.paused
        ? '<button type="button" class="btn btn--accent btn--lg" id="pause-btn">' + BB.icon("play") + "Resume</button>"
        : '<button type="button" class="btn btn--lg" id="pause-btn">' + BB.icon("pause") + "Pause for a break</button>") +
      '<button type="button" class="btn btn--primary btn--lg" id="end-btn">' + BB.icon("stop") + "End session</button>" +
      "</div></div>" +
      '<div class="tracker__side">' +
      '<div class="panel" style="padding:16px 20px"><div class="split"><div><p class="label">Breaks</p><p class="hint">Pausing adds one automatically</p></div>' +
      '<div class="counter"><button type="button" class="btn btn--icon btn--sm" id="brk-minus" aria-label="Remove a break">' + BB.icon("minus") + "</button>" +
      '<span class="counter__value" id="brk-value" aria-live="polite">' + s.breaks + "</span>" +
      '<button type="button" class="btn btn--icon btn--sm" id="brk-plus" aria-label="Add a break">' + BB.icon("plus") + "</button></div></div></div>" +
      '<p class="text-sm text-secondary">When you end the session you\'ll rate your focus from 1 to 5 and can add a practice result.</p>' +
      "</div>";

    var update = function () {
      var cur = BB.repo.activeStudy();
      if (!cur) return;
      U.$("#st-clock").textContent = U.formatDuration(activeMs(cur), { clock: true });
      U.$("#st-paused").textContent = U.formatDuration(pausedMs(cur), { noSeconds: pausedMs(cur) > 3600000 });
    };
    update();
    tick = setInterval(update, 1000);

    U.$("#pause-btn").addEventListener("click", function () {
      var cur = BB.repo.activeStudy();
      var now = Date.now();
      if (cur.paused) {
        cur.paused = false;
        cur.runningSince = now;
        BB.toast.show("Session resumed.", { type: "info" });
      } else {
        cur.segments.push({ start: cur.runningSince, end: now });
        cur.paused = true;
        cur.runningSince = null;
        cur.breaks++;
        BB.toast.show("Paused. Break time isn't counted as study time.", { type: "info" });
      }
      BB.repo.saveActiveStudy(cur);
      renderTracker();
      U.$("#pause-btn").focus();
    });
    U.$("#brk-plus").addEventListener("click", function () { adjustBreaks(1); });
    U.$("#brk-minus").addEventListener("click", function () { adjustBreaks(-1); });
    U.$("#end-btn").addEventListener("click", openEndDialog);
  }

  function adjustBreaks(d) {
    var cur = BB.repo.activeStudy();
    cur.breaks = U.clamp(cur.breaks + d, 0, 50);
    BB.repo.saveActiveStudy(cur);
    U.$("#brk-value").textContent = cur.breaks;
  }

  /* ---------- End session ---------- */
  function wireEndDialog() {
    var d = U.$("#end-dialog");
    BB.dialog.wire(d);
    U.$("#focus-rating").innerHTML = [1, 2, 3, 4, 5].map(function (n) {
      return '<label><input type="radio" name="focus" value="' + n + '" aria-label="Focus ' + n + ' out of 5"><span aria-hidden="true">' + n + "</span></label>";
    }).join("");
    U.$$('#focus-rating input').forEach(function (r) {
      r.addEventListener("change", function () {
        U.$("#focus-error").innerHTML = "";
        U.$$('#focus-rating input').forEach(function (x) { x.removeAttribute("aria-invalid"); });
      });
    });

    U.$("#end-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var cur = BB.repo.activeStudy();
      if (!cur) { BB.dialog.close(d); renderTracker(); return; }
      var form = e.target;
      var focus = form.querySelector('input[name="focus"]:checked');
      var ok = true;
      if (!focus) {
        U.$("#focus-error").innerHTML = BB.icon("alert-circle") + "<span>Choose a focus rating from 1 to 5.</span>";
        U.$$('#focus-rating input').forEach(function (x) { x.setAttribute("aria-invalid", "true"); x.setAttribute("aria-describedby", "focus-error"); });
        U.$('#focus-rating input').focus();
        ok = false;
      }
      var breaks = Number(form.breaks.value);
      if (form.breaks.value === "" || !isFinite(breaks) || breaks < 0 || breaks > 50 || Math.floor(breaks) !== breaks) {
        U.$("#end-breaks-error").innerHTML = BB.icon("alert-circle") + "<span>Enter a whole number from 0 to 50.</span>";
        form.breaks.setAttribute("aria-invalid", "true");
        if (ok) form.breaks.focus();
        ok = false;
      } else { U.$("#end-breaks-error").innerHTML = ""; form.breaks.removeAttribute("aria-invalid"); }
      var accRaw = form.accuracy.value.trim();
      var acc = Number(accRaw);
      if (accRaw !== "" && (!isFinite(acc) || acc < 0 || acc > 100)) {
        U.$("#end-accuracy-error").innerHTML = BB.icon("alert-circle") + "<span>Enter a score from 0 to 100, or leave it blank.</span>";
        form.accuracy.setAttribute("aria-invalid", "true");
        if (ok) form.accuracy.focus();
        ok = false;
      } else { U.$("#end-accuracy-error").innerHTML = ""; form.accuracy.removeAttribute("aria-invalid"); }
      if (!ok) return;

      var now = Date.now();
      if (!cur.paused && cur.runningSince) cur.segments.push({ start: cur.runningSince, end: now });
      var active = U.sum(cur.segments, function (seg) { return seg.end - seg.start; });
      var minutes = Math.max(1, Math.round(active / 60000));
      BB.repo.saveSession({
        id: cur.id,
        source: "tracker",
        subject: cur.subject,
        topic: cur.topic,
        startedAt: cur.startedAt,
        endedAt: now,
        activeMinutes: minutes,
        pausedMinutes: Math.max(0, Math.round((now - cur.startedAt - active) / 60000)),
        breaks: breaks,
        focus: Number(focus.value),
        outcome: accRaw === "" ? null : { accuracy: Math.round(acc), difficulty: form.difficulty.value, retention: null }
      });
      BB.repo.clearActiveStudy();
      BB.dialog.close(d);
      form.reset();
      U.$$('.nav-link[href="habits.html"] .nav-link__badge').forEach(function (b) { b.remove(); });
      BB.toast.show("Session saved: " + U.formatMinutes(minutes) + " of " + cur.subject + ".", { type: "success" });
      renderTracker();
      renderAnalytics();
    });

    U.$("#discard-session").addEventListener("click", function () {
      BB.dialog.close(d);
      BB.dialog.confirm({ title: "Discard this session?", body: "<p>The time you've tracked won't be saved.</p>", confirmText: "Discard session", tone: "danger", focusCancel: true })
        .then(function (yes) {
          if (!yes) { BB.dialog.open(d); return; }
          BB.repo.clearActiveStudy();
          U.$$('.nav-link[href="habits.html"] .nav-link__badge').forEach(function (b) { b.remove(); });
          BB.toast.show("Session discarded.", { type: "info" });
          renderTracker();
        });
    });
  }

  function openEndDialog() {
    var cur = BB.repo.activeStudy();
    if (!cur) return;
    var d = U.$("#end-dialog");
    U.$("#end-summary").textContent = "You've studied " + cur.subject + " for " + U.formatDuration(activeMs(cur), { noSeconds: activeMs(cur) > 600000 }) + " (excluding breaks).";
    U.$("#end-breaks").value = cur.breaks;
    BB.dialog.open(d);
    var first = U.$('#focus-rating input');
    if (first) first.focus();
  }

  /* ======================= Analytics ======================= */
  function renderAnalytics() {
    var sessions = BB.repo.sessions();
    var sum = SA.summary(sessions);
    var period = sum.mostActivePeriod ? BB.demo.PERIODS.filter(function (p) { return p.key === sum.mostActivePeriod.key; })[0] : null;

    U.$("#study-metrics").innerHTML =
      BB.ui.metric({ icon: "clock", label: "Total study hours", value: U.round(sum.totalMinutes / 60, 1), unit: "h", foot: "Across " + U.plural(sum.count, "session") }) +
      BB.ui.metric({ icon: "hourglass", tone: "accent", label: "Average session duration", value: sum.count ? U.formatMinutes(sum.avgMinutes) : null, foot: "Active time, breaks excluded" }) +
      BB.ui.metric({ icon: "calendar", tone: "violet", label: "Weekly consistency", value: sum.count ? U.round(sum.daysPerWeek, 1) : null, unit: " days/week", progress: U.pct(sum.daysPerWeek, 7), progressLabel: "Study days per week", foot: sum.activeDays28 + " of the last 28 days" }) +
      BB.ui.metric({ icon: "coffee", tone: "amber", label: "Break frequency", value: sum.count ? U.round(sum.breaksPerHour, 1) : null, unit: " per hour", foot: U.round(sum.avgBreaks, 1) + " breaks per session on average" }) +
      BB.ui.metric({ icon: "zap", label: "Average focus rating", value: sum.avgFocus == null ? null : U.round(sum.avgFocus, 1), unit: " / 5", foot: "Your own end-of-session ratings" }) +
      BB.ui.metric({ icon: "sun", tone: "accent", label: "Most active period", value: period ? period.label : null, foot: period ? period.range + ", " + U.plural(sum.mostActivePeriod.count, "session") : "No sessions yet" });

    if (!sessions.length) {
      U.$("#heatmap").innerHTML = BB.ui.empty({ title: "No study sessions yet", text: "Start your first session above. Your activity will build up here day by day." });
      ["chart-subjects", "chart-duration", "chart-focus", "chart-periods", "chart-scatter"].forEach(function (id) { BB.charts.emptyState(U.$("#" + id), "No study sessions recorded yet."); });
      U.$("#subject-sessions").innerHTML = "";
      U.$("#verdict").innerHTML = "";
      U.$("#period-table").innerHTML = "";
      U.$("#recent-sessions").innerHTML = '<div style="padding:0 24px 24px"><p class="text-secondary text-sm">Sessions you save will appear here.</p></div>';
      U.$("#method-list").innerHTML = methodItems();
      return;
    }

    renderHeatmap(sessions);
    renderSubjects(sessions);
    renderDuration(sessions);
    renderFocus(sessions);
    renderBestTime(sessions);
    renderRecent(sessions);
  }

  function renderHeatmap(sessions) {
    var weeks = 6;
    var grid = SA.heatmap(sessions, weeks);
    var max = Math.max.apply(null, grid.map(function (w) { return Math.max.apply(null, w.map(function (d) { return d.minutes; })); })) || 1;
    var todayKey = U.dateKey(new Date());
    var dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var html = '<div class="heatmap" style="--weeks:' + weeks + '" role="grid" aria-label="Minutes studied per day for the last 6 weeks">';
    html += '<div role="row" style="display:contents"><span role="columnheader"></span>' + grid.map(function (w) { return '<span class="heatmap__weeklabel" role="columnheader">' + U.formatDate(w[0].date, "short") + "</span>"; }).join("") + "</div>";
    for (var d = 0; d < 7; d++) {
      html += '<div role="row" style="display:contents"><span class="heatmap__daylabel" role="rowheader">' + dayNames[d] + "</span>";
      for (var w = 0; w < weeks; w++) {
        var cell = grid[w][d];
        var level = cell.minutes ? Math.min(4, Math.ceil((cell.minutes / max) * 4)) : 0;
        var label = U.formatDate(cell.date, "long") + ": " + (cell.future ? "upcoming" : cell.minutes ? U.formatMinutes(cell.minutes) + " in " + U.plural(cell.count, "session") : "no study");
        html += '<span role="gridcell" class="heatmap__cell' + (cell.key === todayKey ? " is-today" : "") + (cell.future ? " is-future" : "") + '" data-level="' + level + '" title="' + label + '" aria-label="' + label + '"></span>';
      }
      html += "</div>";
    }
    U.$("#heatmap").innerHTML = html + "</div>";
  }

  function renderSubjects(sessions) {
    var bs = SA.bySubject(sessions);
    BB.charts.create("chart-subjects", function (c) {
      return {
        type: "doughnut",
        data: { labels: bs.map(function (s) { return s.subject; }), datasets: [{ data: bs.map(function (s) { return s.minutes; }), backgroundColor: bs.map(function (s) { return BB.repo.subjectColor(s.subject); }), borderColor: c.surface, borderWidth: 2 }] },
        options: { cutout: "60%", plugins: { legend: { position: "right" }, tooltip: { callbacks: { label: function (t) { return " " + t.label + ": " + U.formatMinutes(t.raw); } } } } }
      };
    });
    U.$("#subject-sessions").innerHTML = bs.map(function (s) {
      return '<li class="stat-row" style="grid-template-columns:16px 1fr auto;padding:8px 0"><span class="subject-dot" style="background:' + BB.repo.subjectColor(s.subject) + '"></span>' +
        '<div class="stat-row__text"><span class="stat-row__label">' + U.escapeHtml(s.subject) + '</span></div><span class="stat-row__value text-sm">' + U.plural(s.count, "session") + ", " + U.formatMinutes(s.minutes) + "</span></li>";
    }).join("");
  }

  function renderDuration(sessions) {
    var days = SA.daily(sessions, 14);
    BB.charts.create("chart-duration", function (c) {
      return {
        type: "bar",
        data: { labels: days.map(function (d) { return U.formatDate(d.date, "short"); }), datasets: [{ label: "Minutes studied", data: days.map(function (d) { return d.minutes; }), backgroundColor: c.accent, maxBarThickness: 22 }] },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (t) { return " " + U.formatMinutes(t.raw); } } } },
          scales: { y: BB.charts.axes.plain(c, { title: { display: true, text: "Minutes" } }), x: BB.charts.axes.category({ ticks: { maxRotation: 0, autoSkipPadding: 10 } }) }
        }
      };
    });
  }

  function renderFocus(sessions) {
    var dist = SA.focusDistribution(sessions);
    BB.charts.create("chart-focus", function (c) {
      return {
        type: "bar",
        data: { labels: ["1", "2", "3", "4", "5"], datasets: [{ label: "Sessions", data: dist, backgroundColor: [c.rose, c.warning, c.muted, c.alpha(c.primary, 0.7), c.primary], maxBarThickness: 46 }] },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { title: function (i) { return "Focus " + i[0].label + " of 5"; }, label: function (t) { return " " + U.plural(t.raw, "session"); } } } },
          scales: { y: BB.charts.axes.plain(c, { ticks: { precision: 0 }, title: { display: true, text: "Sessions" } }), x: BB.charts.axes.category({ title: { display: true, text: "Focus rating (1 = very distracted, 5 = fully focused)" } }) }
        }
      };
    });
  }

  function methodItems() {
    return [
      "Sessions are grouped by start time: morning (5am to 12pm), afternoon (12pm to 5pm), evening (5pm to 9pm) and night (9pm to 5am).",
      "Only sessions followed by a practice result are compared. Each result is compared with your own average for the same subject and difficulty, so a period isn't favoured just because easier work happened then.",
      "A period needs at least 6 practice results to be compared. A result is called 'supported' only when both compared periods have 12 or more results and differ by 5 points or more. Otherwise it's 'preliminary'.",
      "Focus ratings and delayed retention checks (taken 7+ days later) are shown as extra evidence when available, and never inferred when missing.",
      "Session length isn't treated as a sign of quality. The chart shows how length and results relate in your own data."
    ].map(function (t) { return "<li>" + U.escapeHtml(t) + "</li>"; }).join("");
  }

  function renderBestTime(sessions) {
    var pc = SA.periodComparison(sessions);
    var v = pc.verdict;
    var mood = v.status === "supported" ? "celebrate" : v.status === "preliminary" ? "happy" : "thinking";
    var badge = { supported: "badge--success", preliminary: "badge--warning", insufficient: "", "no-difference": "badge--primary" }[v.status];
    U.$("#verdict").innerHTML = '<div class="verdict" data-status="' + v.status + '" role="status">' + BB.mascot.svg({ mood: mood }) +
      '<div><p class="verdict__label"><span class="badge ' + badge + '">' + U.escapeHtml(v.label) + "</span></p>" +
      "<p>" + U.escapeHtml(v.message) + "</p>" +
      (v.notes && v.notes.length ? "<ul>" + v.notes.map(function (n) { return "<li>" + U.escapeHtml(n) + "</li>"; }).join("") + "</ul>" : "") +
      "</div></div>";

    var eligible = function (p) { return p.outcomes >= pc.thresholds.MIN_OBS; };
    BB.charts.create("chart-periods", function (c) {
      return {
        type: "bar",
        data: {
          labels: pc.periods.map(function (p) { return p.label; }),
          datasets: [
            { type: "bar", label: "Practice result vs your usual (points)", yAxisID: "y", data: pc.periods.map(function (p) { return p.adjusted == null ? null : U.round(p.adjusted, 1); }),
              backgroundColor: pc.periods.map(function (p) { return eligible(p) ? (p.adjusted >= 0 ? c.accent : c.rose) : c.muted; }), maxBarThickness: 46 },
            { type: "line", label: "Average focus (1–5)", yAxisID: "y1", data: pc.periods.map(function (p) { return p.avgFocus == null ? null : U.round(p.avgFocus, 2); }), borderColor: c.primary, backgroundColor: c.primary, pointRadius: 5, tension: 0 }
          ]
        },
        options: {
          plugins: {
            legend: { position: "bottom" },
            tooltip: { callbacks: { afterLabel: function (t) { var p = pc.periods[t.dataIndex]; return t.datasetIndex === 0 ? "  " + U.plural(p.outcomes, "practice result") + (eligible(p) ? "" : " (too few to compare)") : ""; } } }
          },
          scales: {
            y: BB.charts.axes.plain(c, { beginAtZero: false, suggestedMin: -10, suggestedMax: 10, title: { display: true, text: "Points vs usual" } }),
            y1: { position: "right", min: 1, max: 5, grid: { display: false }, title: { display: true, text: "Focus" } },
            x: BB.charts.axes.category()
          }
        }
      };
    });

    var dv = SA.durationVsAccuracy(sessions);
    if (dv.points.length < 3) BB.charts.emptyState(U.$("#chart-scatter"), "Add practice results to sessions to see this comparison.");
    else BB.charts.create("chart-scatter", function (c) {
      return {
        type: "scatter",
        data: { datasets: [{ label: "Session", data: dv.points, backgroundColor: c.alpha(c.primary, 0.6), pointRadius: 4 }] },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (t) { return " " + t.raw.x + " min, " + t.raw.y + "% result"; } } } },
          scales: { x: BB.charts.axes.plain(c, { beginAtZero: false, title: { display: true, text: "Session length (min)" } }), y: BB.charts.axes.percent(c, { title: { display: true, text: "Result" } }) }
        }
      };
    });
    U.$("#scatter-note").textContent = dv.r == null || dv.n < 10
      ? "There aren't enough sessions with a practice result to judge this yet."
      : "Across " + dv.n + " sessions, " + dv.direction + " (correlation " + U.round(dv.r, 2) + ", " + dv.strength + "). This is a pattern in your data, not proof that length causes better results. Subject and difficulty also vary between sessions.";

    U.$("#period-table").innerHTML = '<table class="table period-table"><caption class="visually-hidden">Comparison of study periods</caption><thead><tr>' +
      '<th scope="col">Period</th><th scope="col" class="num">Sessions</th><th scope="col" class="num">Total time</th><th scope="col" class="num">Avg length</th><th scope="col" class="num">Avg focus</th>' +
      '<th scope="col" class="num">Practice results</th><th scope="col" class="num">Avg result</th><th scope="col" class="num">Vs your usual</th><th scope="col" class="num">Hard questions</th><th scope="col" class="num">Delayed retention</th><th scope="col">Comparison</th></tr></thead><tbody>' +
      pc.periods.map(function (p) {
        return '<tr><th scope="row">' + p.label + '<div class="text-xs text-secondary" style="font-weight:400">' + p.range + "</div></th>" +
          '<td class="num">' + p.count + "</td>" +
          '<td class="num">' + U.formatMinutes(p.minutes) + "</td>" +
          '<td class="num">' + (p.avgDuration == null ? "—" : U.formatMinutes(p.avgDuration)) + "</td>" +
          '<td class="num">' + (p.avgFocus == null ? "—" : U.round(p.avgFocus, 1)) + "</td>" +
          '<td class="num">' + p.outcomes + "</td>" +
          '<td class="num">' + (p.rawAccuracy == null ? "—" : Math.round(p.rawAccuracy) + "%") + "</td>" +
          '<td class="num">' + (p.adjusted == null ? "—" : SA.fmtSigned(p.adjusted)) + "</td>" +
          '<td class="num">' + (p.hardShare == null ? "—" : Math.round(p.hardShare) + "%") + "</td>" +
          '<td class="num">' + (p.retention == null ? '<span class="text-muted">' + (p.retentionN ? "Too few (" + p.retentionN + ")" : "Not recorded") + "</span>" : Math.round(p.retention) + "% (" + p.retentionN + ")") + "</td>" +
          "<td>" + (p.outcomes >= pc.thresholds.MIN_OBS ? '<span class="badge badge--success">Enough data</span>' : '<span class="badge">Needs ' + (pc.thresholds.MIN_OBS - p.outcomes) + " more</span>") + "</td></tr>";
      }).join("") + "</tbody></table>";
    U.$("#method-list").innerHTML = methodItems();
  }

  function renderRecent(sessions) {
    var recent = sessions.slice(-12).reverse();
    U.$("#recent-sessions").innerHTML = '<div class="table-wrap" style="border:0;border-top:1px solid var(--color-border);border-radius:0 0 var(--radius-lg) var(--radius-lg)"><table class="table"><caption class="visually-hidden">Recent study sessions</caption><thead><tr>' +
      '<th scope="col">Date</th><th scope="col">Subject</th><th scope="col">Period</th><th scope="col" class="num">Active time</th><th scope="col" class="num">Breaks</th><th scope="col" class="num">Focus</th><th scope="col" class="num">Practice result</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' +
      recent.map(function (s) {
        var period = BB.demo.PERIODS.filter(function (p) { return p.key === BB.demo.periodOf(s.startedAt); })[0];
        return "<tr><td>" + U.formatDate(s.startedAt, "datetime") + (s.source === "demo" ? ' <span class="badge badge--demo">Demo</span>' : "") + "</td>" +
          '<td><span class="subject-name"><span class="subject-dot" style="background:' + BB.repo.subjectColor(s.subject) + '"></span>' + U.escapeHtml(s.subject) + "</span>" + (s.topic ? '<div class="text-xs text-secondary">' + U.escapeHtml(s.topic) + "</div>" : "") + "</td>" +
          "<td>" + period.label + "</td>" +
          '<td class="num">' + U.formatMinutes(s.activeMinutes) + "</td>" +
          '<td class="num">' + s.breaks + "</td>" +
          '<td class="num">' + (s.focus || "—") + "</td>" +
          '<td class="num">' + (s.outcome ? s.outcome.accuracy + "% (" + s.outcome.difficulty + ")" : '<span class="text-muted">Not recorded</span>') + "</td>" +
          "<td>" + (s.source !== "demo" ? '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-del="' + U.escapeHtml(s.id) + '" aria-label="Delete session from ' + U.formatDate(s.startedAt, "datetime") + '">' + BB.icon("trash") + "</button>" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    U.$$("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        BB.dialog.confirm({ title: "Delete this session?", body: "<p>It will be removed from your study analytics.</p>", confirmText: "Delete session", tone: "danger", focusCancel: true })
          .then(function (ok) {
            if (!ok) return;
            BB.repo.deleteSession(b.getAttribute("data-del"));
            BB.toast.show("Session deleted.", { type: "success" });
            renderAnalytics();
          });
      });
    });
  }
})(window.BB = window.BB || {});
