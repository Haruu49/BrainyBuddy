/** Student dashboard */
(function (BB) {
  "use strict";
  var U = BB.utils;

  BB.app.init({ page: "dashboard", title: "Dashboard" }, function (ctx) {
    var user = ctx.user;
    var attempts = BB.repo.attempts();
    var sessions = BB.repo.sessions();
    var records = BB.repo.records();
    var subjects = BB.repo.subjects();
    var demo = BB.repo.showDemo();
    var now = new Date();

    // Greeting
    U.$("#welcome-title").textContent = U.greeting(now) + ", " + U.firstName(user.name);
    var weekMins = BB.studyAnalytics.summary(sessions, now).last7Minutes;
    U.$("#welcome-text").textContent = attempts.length || sessions.length
      ? "You've studied " + U.formatMinutes(weekMins) + " in the last 7 days and completed " + U.plural(attempts.length, "practice exam") + " so far."
      : "Start with a practice exam or a study session and your patterns will appear here.";
    U.$("#welcome-meta").innerHTML =
      '<span class="badge badge--outline">' + BB.icon("cap", { size: "sm" }) + U.escapeHtml(BB.demo.educationLabel(user.educationLevel)) + "</span>" +
      (user.institution ? '<span class="badge badge--outline">' + BB.icon("building", { size: "sm" }) + U.escapeHtml(user.institution) + "</span>" : "") +
      (demo ? BB.ui.demoBadge("Includes demo data") : "");

    var openRecs = renderRecs(attempts, sessions, records, subjects);
    var today = renderToday(user, sessions, now);
    renderBuddy(today, openRecs, now);
    renderQuick(openRecs, now);
    renderMetrics(user, attempts, sessions, records, now);
    renderCharts(attempts, sessions, records, subjects, user, now);
    renderBehaviour(attempts);
    renderHabits(sessions);

    // One load moment: numbers count up and today's ring fills
    BB.ui.countUp(U.$("#metrics"));
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var fill = U.$(".today__fill");
        if (fill) fill.style.strokeDashoffset = String(100 - Number(fill.getAttribute("data-pct")));
      });
    });
    if (today.met && BB.store.get("ui.goalCelebrated") !== U.dateKey(now)) {
      BB.store.set("ui.goalCelebrated", U.dateKey(now));
      setTimeout(function () { BB.fx.confetti(); }, 500);
    }
  });

  /* ---------- Today's goal ring + streak ---------- */
  function studyStreak(sessions, now) {
    var days = {};
    sessions.forEach(function (s) { days[U.dateKey(s.startedAt)] = true; });
    var d = U.startOfDay(now);
    if (!days[U.dateKey(d)]) d = U.addDays(d, -1); // a streak is still alive until today ends
    var n = 0;
    while (days[U.dateKey(d)]) { n++; d = U.addDays(d, -1); }
    return n;
  }

  function renderToday(user, sessions, now) {
    var days = BB.studyAnalytics.daily(sessions, 1, now);
    var todayMin = Math.round(days[0].minutes);
    var goalMin = Math.round(((Number(user.weeklyGoalHours) || 8) * 60) / 7);
    var pct = goalMin ? Math.min(100, Math.round((todayMin / goalMin) * 100)) : 0;
    var met = goalMin > 0 && todayMin >= goalMin;
    var streak = studyStreak(sessions, now);
    var msg = met ? "Goal reached. Anything more is a bonus."
      : todayMin ? U.formatMinutes(goalMin - todayMin) + " to go. One short session gets you there."
      : "Nothing logged yet today. A 20-minute session is a great start.";

    U.$("#today-card").innerHTML =
      '<div class="today' + (met ? " is-met" : "") + '">' +
      '<p class="today__title">Today\'s study goal</p>' +
      '<div class="today__ring" role="img" aria-label="' + U.escapeHtml(U.formatMinutes(todayMin) + " of " + U.formatMinutes(goalMin) + " studied today, " + pct + "% of your daily goal") + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="today-grad" x1="0" y1="0" x2="1" y2="1">' +
      (met ? '<stop offset="0" stop-color="#3cc9b7"/><stop offset="1" stop-color="#0f9488"/>' : '<stop offset="0" stop-color="#ffa781"/><stop offset="1" stop-color="#ec7f9c"/>') +
      "</linearGradient></defs>" +
      '<circle class="today__track" cx="60" cy="60" r="50"/>' +
      '<circle class="today__fill" cx="60" cy="60" r="50" pathLength="100" stroke="url(#today-grad)" data-pct="' + pct + '"/></svg>' +
      '<div class="today__ring-label"><strong>' + U.escapeHtml(U.formatMinutes(todayMin)) + "</strong><span>of " + U.escapeHtml(U.formatMinutes(goalMin)) + "</span></div></div>" +
      '<div class="today__text"><p class="today__msg">' + U.escapeHtml(msg) + "</p>" +
      (streak ? '<p class="today__streak" style="margin-top:10px">' + BB.icon("zap", { size: "sm" }) + U.escapeHtml(U.plural(streak, "day")) + " study streak</p>" : "") +
      "</div></div>";

    return { todayMin: todayMin, goalMin: goalMin, met: met, streak: streak };
  }

  /* ---------- Buddy's nudges (tap Buddy for the next one) ---------- */
  function clock(hhmm) {
    var p = String(hhmm || "").split(":"), h = Number(p[0]), m = p[1] || "00";
    if (isNaN(h)) return hhmm;
    return (h % 12 || 12) + ":" + m + (h < 12 ? " am" : " pm");
  }

  function whenLabel(dateKey, now) {
    var diff = U.daysBetween(now, U.parseDateKey(dateKey));
    return diff === 0 ? "today" : diff === 1 ? "tomorrow" : U.formatDate(U.parseDateKey(dateKey), "weekday");
  }

  function renderBuddy(today, openRecs, now) {
    var e = U.escapeHtml;
    var nudges = [];
    // The ring already shows progress, so Buddy only speaks up about the goal to celebrate it
    if (today.met) nudges.push({ mood: "celebrate", html: "<strong>You reached today's goal!</strong> " + e(U.formatMinutes(today.todayMin)) + " studied. Nice work." });

    var nowKey = U.dateKey(now) + " " + U.timeKey(now);
    var next = BB.repo.tasks().filter(function (t) { return !t.completed && (t.date + " " + t.start) >= nowKey; })
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); })[0];
    if (next) nudges.push({ mood: "happy", html: "<strong>Next on your plan:</strong> " + e(next.title) + " (" + e(next.subject) + "), " + e(whenLabel(next.date, now)) + " at " + e(clock(next.start)) + "." });

    var exam = BB.repo.upcomingExams().filter(function (x) { return x.date >= U.dateKey(now); })[0];
    if (exam) {
      var inDays = U.daysBetween(now, U.parseDateKey(exam.date));
      nudges.push({ mood: "thinking", html: "<strong>" + e(exam.subject) + " " + e(exam.title.toLowerCase()) + "</strong> is " + (inDays === 0 ? "today" : inDays === 1 ? "tomorrow" : "in " + inDays + " days") + ". A practice exam now shows where to focus." });
    }
    if (openRecs[0]) nudges.push({ mood: "thinking", html: "<strong>Try this:</strong> " + e(openRecs[0].title) + "." });
    if (today.streak >= 2) nudges.push({ mood: "celebrate", html: "<strong>" + e(U.plural(today.streak, "day")) + " in a row!</strong> Study today to keep your streak going." });
    nudges.push({ mood: "wave", html: "<strong>Lost?</strong> Press Ctrl K (or the search button at the top) to jump to any page." });

    var i = 0;
    var btn = U.$("#buddy-btn");
    var text = U.$("#buddy-says");
    function show(animate) {
      var n = nudges[i];
      btn.innerHTML = BB.mascot.svg({ mood: n.mood });
      text.innerHTML = n.html;
      if (animate) {
        text.classList.remove("is-new");
        void text.offsetWidth;
        text.classList.add("is-new");
        BB.mascot.bounce(U.$(".mascot", btn));
      }
    }
    function nextNudge() { i = (i + 1) % nudges.length; show(true); }
    show(false);
    btn.addEventListener("click", nextNudge);
    U.$("#buddy-next").addEventListener("click", nextNudge);
  }

  /* ---------- "What would you like to do?" tiles ---------- */
  function renderQuick(openRecs, now) {
    var e = U.escapeHtml;
    var activeExam = BB.repo.activeExam();
    var activeStudy = BB.repo.activeStudy();
    var todayKey = U.dateKey(now);
    var tasksLeft = BB.repo.tasks().filter(function (t) { return t.date === todayKey && !t.completed; }).length;
    var tiles = [
      { tone: "peach", href: "exam.html", icon: "timer",
        title: activeExam ? "Resume your exam" : "Take a practice exam",
        desc: activeExam ? "Your answers are saved. Pick up where you left off." : "Timed questions. Buddy records how you work through them.",
        badge: activeExam ? "In progress" : "" },
      { tone: "teal", href: "habits.html#tracker", icon: "clock",
        title: activeStudy ? "Back to your session" : "Start a study session",
        desc: activeStudy ? "Your timer is running. Pause or finish it here." : "Time it, take breaks and rate your focus.",
        badge: activeStudy ? "Timer running" : "" },
      { tone: "honey", href: "planner.html", icon: "calendar", title: "Plan my week",
        desc: tasksLeft ? U.plural(tasksLeft, "task") + " left for today." : "Nothing planned for today yet. Add a task." },
      { tone: "pink", href: "recommendations.html", icon: "sparkles", title: "See my recommendations",
        desc: openRecs.length ? U.plural(openRecs.length, "open recommendation") + " based on your results." : "New suggestions appear as you add results." }
    ];
    U.$("#quick-actions").innerHTML = tiles.map(function (t) {
      return '<a class="quick-tile quick-tile--' + t.tone + '" href="' + t.href + '">' +
        '<span class="quick-tile__icon">' + BB.icon(t.icon) + "</span>" +
        '<span class="quick-tile__title">' + e(t.title) + "</span>" +
        '<span class="quick-tile__desc">' + e(t.desc) + "</span>" +
        (t.badge ? '<span class="quick-tile__badge">' + e(t.badge) + "</span>" : "") +
        '<span class="quick-tile__go" aria-hidden="true">' + BB.icon("arrow-right", { size: "sm" }) + "</span></a>";
    }).join("");
  }

  function renderMetrics(user, attempts, sessions, records, now) {
    var results = BB.academic.results(attempts, records);
    var cut = now.getTime() - 30 * U.DAY, prevCut = now.getTime() - 60 * U.DAY;
    var recent = results.filter(function (r) { return r.date >= cut; });
    var prior = results.filter(function (r) { return r.date >= prevCut && r.date < cut; });
    var avg = results.length ? U.mean(results, function (r) { return r.scorePct; }) : null;
    var scoreDelta = null;
    if (recent.length && prior.length) {
      var d = U.mean(recent, function (r) { return r.scorePct; }) - U.mean(prior, function (r) { return r.scorePct; });
      scoreDelta = { dir: d > 0.5 ? "up" : d < -0.5 ? "down" : "flat", text: (d >= 0 ? "+" : "−") + Math.abs(U.round(d, 1)) + " pts vs the 30 days before" };
    }

    var acc = BB.academic.accuracy(attempts);
    var accDelta = null;
    if (attempts.length >= 4) {
      var a1 = BB.academic.accuracy(attempts.slice(-3)), a0 = BB.academic.accuracy(attempts.slice(0, -3));
      var dd = a1 - a0;
      accDelta = { dir: dd > 0.5 ? "up" : dd < -0.5 ? "down" : "flat", text: (dd >= 0 ? "+" : "−") + Math.abs(Math.round(dd)) + " pts in your last 3 exams" };
    }

    var sum = BB.studyAnalytics.summary(sessions, now);
    var hours = sum.last7Minutes / 60;
    var goal = Number(user.weeklyGoalHours) || 8;
    var hDelta = sum.prev7Minutes ? (function () {
      var x = (sum.last7Minutes - sum.prev7Minutes) / 60;
      return { dir: x > 0.1 ? "up" : x < -0.1 ? "down" : "flat", text: (x >= 0 ? "+" : "−") + Math.abs(U.round(x, 1)) + " h vs previous week" };
    })() : null;

    U.$("#metrics").innerHTML =
      BB.ui.metric({ icon: "target", label: "Average examination score", value: avg == null ? null : Math.round(avg), unit: "%", delta: scoreDelta, foot: scoreDelta ? "" : "Across " + U.plural(results.length, "exam") }) +
      BB.ui.metric({ icon: "check-circle", tone: "accent", label: "Examination accuracy", value: acc == null ? null : Math.round(acc), unit: "%", delta: accDelta, foot: accDelta ? "" : "Correct ÷ answered questions" }) +
      BB.ui.metric({ icon: "file", tone: "violet", label: "Completed examinations", value: results.length, foot: recent.length + " in the last 30 days" }) +
      BB.ui.metric({ icon: "clock", tone: "amber", label: "Weekly study hours", value: U.round(hours, 1), unit: "h", progress: U.pct(hours, goal), progressAccent: true, progressLabel: "Weekly study goal progress", delta: hDelta, foot: "Goal " + goal + " h" });
  }

  function renderCharts(attempts, sessions, records, subjects, user, now) {
    var stats = BB.academic.subjectStats(attempts, records, subjects).filter(function (s) { return s.avgScore != null; });
    if (!stats.length) BB.charts.emptyState(U.$("#subject-chart"), "No scores yet. Take a practice exam to see subject performance.");
    else BB.charts.create("subject-chart", function (c) {
      return {
        type: "bar",
        data: {
          labels: stats.map(function (s) { return s.subject; }),
          datasets: [{ label: "Average score", data: stats.map(function (s) { return U.round(s.avgScore, 1); }), backgroundColor: stats.map(function (s) { return s.color; }), maxBarThickness: 22 }]
        },
        options: {
          indexAxis: "y",
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (t) { return " " + t.raw + "% average"; } } } },
          scales: { x: BB.charts.axes.percent(c), y: BB.charts.axes.category() }
        }
      };
    });

    var results = BB.academic.results(attempts, records);
    if (!results.length) BB.charts.emptyState(U.$("#score-chart"), "Your exam scores will appear here over time.");
    else BB.charts.create("score-chart", function (c) {
      return {
        type: "line",
        data: {
          labels: results.map(function (r) { return U.formatDate(r.date, "short"); }),
          datasets: [{
            label: "Score",
            data: results.map(function (r) { return r.scorePct; }),
            borderColor: c.primary,
            backgroundColor: c.alpha(c.objective, 0.12),
            fill: true,
            pointBackgroundColor: results.map(function (r) { return BB.repo.subjectColor(r.subject); }),
            pointBorderColor: c.surface,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: function (items) { var r = results[items[0].dataIndex]; return r.title; },
              label: function (t) { var r = results[t.dataIndex]; return " " + r.subject + ": " + r.scorePct + "%" + (r.source === "imported" ? " (imported)" : ""); }
            } }
          },
          scales: { y: BB.charts.axes.percent(c), x: BB.charts.axes.category({ ticks: { maxRotation: 0, autoSkipPadding: 12 } }) }
        }
      };
    });

    var days = BB.studyAnalytics.daily(sessions, 7, now);
    var dailyGoal = (Number(user.weeklyGoalHours) || 8) / 7;
    if (!sessions.length) BB.charts.emptyState(U.$("#weekly-chart"), "No study sessions recorded yet. Start one from Study Habits.");
    else BB.charts.create("weekly-chart", function (c) {
      return {
        type: "bar",
        data: {
          labels: days.map(function (d) { return U.formatDate(d.date, "weekday"); }),
          datasets: [
            { type: "bar", label: "Hours studied", data: days.map(function (d) { return U.round(d.minutes / 60, 2); }), backgroundColor: days.map(function (d, i) { return i === days.length - 1 ? c.accent : c.alpha(c.accent, 0.55); }), maxBarThickness: 28 },
            { type: "line", label: "Daily share of weekly goal", data: days.map(function () { return U.round(dailyGoal, 2); }), borderColor: c.textSecondary, borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, tension: 0 }
          ]
        },
        options: {
          plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: function (t) { return " " + t.dataset.label + ": " + U.formatMinutes(t.raw * 60); } } } },
          scales: { y: BB.charts.axes.plain(c, { ticks: { callback: function (v) { return v + " h"; } } }), x: BB.charts.axes.category() }
        }
      };
    });
  }

  function renderBehaviour(attempts) {
    var el = U.$("#behaviour-list");
    if (!attempts.length) {
      el.outerHTML = BB.ui.empty({ title: "No exam behaviour yet", text: "Take a practice exam and Brainy Buddy will record how you answer.", action: { href: "exam.html", label: "Start a practice exam" } });
      return;
    }
    var EA = BB.examAnalytics;
    var ov = EA.overview(attempts);
    var tc = EA.typeComparison(attempts);
    var rows = EA.rows(attempts);

    // Most frequently revised question positions
    var revisedBy = {};
    rows.forEach(function (r) {
      if (!r.revised) return;
      var k = r.q.number;
      revisedBy[k] = revisedBy[k] || { n: 0, type: r.q.type };
      revisedBy[k].n++;
    });
    var topRevised = Object.keys(revisedBy).map(function (k) { return { number: +k, n: revisedBy[k].n, type: revisedBy[k].type }; })
      .sort(function (a, b) { return b.n - a.n || a.number - b.number; }).slice(0, 2);

    var unansweredBy = U.groupBy(rows.filter(function (r) { return !r.answered; }), function (r) { return r.q.type; });
    var topUnanswered = Object.keys(unansweredBy).sort(function (a, b) { return unansweredBy[b].length - unansweredBy[a].length; })[0];

    el.innerHTML =
      BB.ui.statRow("clock", "Average time spent per question", U.formatDuration(ov.avgAnswerMs),
        "Objective " + U.formatDuration(tc.objective.avgMs) + ", written " + U.formatDuration(tc.subjective.avgMs)) +
      BB.ui.statRow("repeat", "Most frequently revised questions",
        topRevised.length ? topRevised.map(function (t) { return "Q" + t.number; }).join(", ") : "None",
        topRevised.length ? topRevised.map(function (t) { return "Q" + t.number + " (" + BB.questionBank.TYPE_LABELS[t.type].toLowerCase() + ") revised in " + t.n + " of " + attempts.length + " exams"; }).join("; ") : "No answers were revised") +
      BB.ui.statRow("skip", "Questions frequently left unanswered",
        topUnanswered ? BB.questionBank.TYPE_LABELS[topUnanswered] : "None",
        topUnanswered ? U.plural(unansweredBy[topUnanswered].length, "question") + " left blank across " + U.plural(attempts.length, "exam") : "Every question was answered") +
      BB.ui.statRow("timer", "Examination time management", ov.tms + " / 100",
        "Completion " + Math.round(ov.tmsParts.completion * 100) + "%, pacing " + Math.round(ov.tmsParts.pacing * 100) + "%, ending buffer " + Math.round(ov.tmsParts.buffer * 100) + "%");
  }

  function renderHabits(sessions) {
    var el = U.$("#habits-list");
    if (!sessions.length) {
      el.outerHTML = BB.ui.empty({ title: "No study sessions yet", text: "Time a study session to see your habits here.", action: { href: "habits.html", label: "Start a study session" } });
      return;
    }
    var s = BB.studyAnalytics.summary(sessions);
    var period = s.mostActivePeriod ? BB.demo.PERIODS.filter(function (p) { return p.key === s.mostActivePeriod.key; })[0] : null;
    el.innerHTML =
      BB.ui.statRow("sun", "Most active study period", period ? period.label : "—", period ? period.range + ", " + U.formatMinutes(s.mostActivePeriod.minutes) + " across " + U.plural(s.mostActivePeriod.count, "session") : "") +
      BB.ui.statRow("calendar", "Weekly study consistency", U.round(s.daysPerWeek, 1) + " days/week", "Studied on " + s.activeDays28 + " of the last 28 days") +
      BB.ui.statRow("hourglass", "Average study session duration", U.formatMinutes(s.avgMinutes), "Across " + U.plural(s.count, "session") + ", excluding breaks") +
      BB.ui.statRow("zap", "Study focus rating", s.avgFocus == null ? "—" : U.round(s.avgFocus, 1) + " / 5", "Your own rating at the end of each session");
  }

  function renderRecs(attempts, sessions, records, subjects) {
    var el = U.$("#rec-list");
    var recs = BB.recommend.generate({ attempts: attempts, sessions: sessions, records: records, subjects: subjects })
      .filter(function (r) { return r.status !== "completed"; });
    var order = { high: 0, medium: 1, low: 2 };
    recs.sort(function (a, b) { return order[a.confidence.level] - order[b.confidence.level]; });
    if (!recs.length) {
      el.innerHTML = '<div class="panel span-all">' + BB.ui.empty({ mood: "celebrate", title: "No open recommendations", text: "Either there isn't enough data yet, or you've completed them all. Keep practising and new ones will appear." }) + "</div>";
      return recs;
    }
    el.innerHTML = recs.slice(0, 3).map(function (r) {
      return BB.ui.insightCard(r, {
        compact: true,
        maxEvidence: 1,
        badge: BB.repo.showDemo() ? BB.ui.demoBadge() : "",
        footer: '<div class="insight__foot"><span class="text-xs text-secondary">Status: ' + U.escapeHtml(BB.recommend.statusLabel(r.status)) + '</span><a class="text-sm fw-600" href="recommendations.html#rec-' + U.escapeHtml(r.id) + '">See progress</a></div>'
      });
    }).join("");
    return recs;
  }
})(window.BB = window.BB || {});
