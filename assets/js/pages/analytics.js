/** Examination Behaviour Analytics */
(function (BB) {
  "use strict";
  var U = BB.utils, EA = BB.examAnalytics, QB = BB.questionBank;
  var all = [];
  var TYPE_NAMES = { all: "all question types", objective: "objective questions", subjective: "subjective questions", mcq: "multiple-choice questions", tf: "true/false questions", short: "short-answer questions", long: "long-answer questions" };

  BB.app.init({ page: "analytics", title: "Exam Patterns" }, function () {
    all = BB.repo.attempts();
    U.$("#demo-flag").innerHTML = BB.repo.showDemo() ? BB.ui.demoBadge("Includes demo data") : "";
    renderTmsDefinition();

    if (!all.length) {
      U.$("#filters").hidden = true;
      U.$("#analytics-content").innerHTML = '<div class="panel">' + BB.ui.empty({
        title: "No examination data yet",
        text: "Take a practice exam in the simulator. Brainy Buddy will record your time per question, answering order and revisions, and analyse them here.",
        action: { href: "exam.html", label: "Start a practice exam" }, headingTag: "h2"
      }) + "</div>";
      return;
    }

    var form = U.$("#filters");
    var subjects = [];
    all.forEach(function (a) { if (subjects.indexOf(a.subject) === -1) subjects.push(a.subject); });
    form.subject.innerHTML = '<option value="all">All subjects</option>' + subjects.map(function (s) { return '<option value="' + U.escapeHtml(s) + '">' + U.escapeHtml(s) + "</option>"; }).join("");

    var params = new URLSearchParams(location.search);
    var preset = params.get("attempt");
    if (preset && all.some(function (a) { return a.id === preset; })) {
      var pa = all.filter(function (a) { return a.id === preset; })[0];
      form.subject.value = pa.subject;
    }
    fillAttempts(preset);

    form.addEventListener("change", function (e) {
      if (e.target === form.subject) fillAttempts();
      if (e.target === form.from || e.target === form.to) {
        if (form.from.value && form.to.value && form.from.value > form.to.value) {
          BB.toast.show("The start date is after the end date, so the dates were swapped.", { type: "info" });
          var tmp = form.from.value; form.from.value = form.to.value; form.to.value = tmp;
        }
        fillAttempts(form.attemptId.value);
      }
      render();
    });
    render();
  });

  function filters() {
    var f = U.$("#filters");
    return { subject: f.subject.value, attemptId: f.attemptId.value, from: f.from.value, to: f.to.value, type: f.type.value };
  }

  function fillAttempts(selectId) {
    var f = U.$("#filters");
    var cur = selectId || f.attemptId.value;
    var list = EA.filterAttempts(all, { subject: f.subject.value, from: f.from.value, to: f.to.value }).slice().reverse();
    f.attemptId.innerHTML = '<option value="all">All examinations (' + list.length + ")</option>" +
      list.map(function (a) { return '<option value="' + U.escapeHtml(a.id) + '">' + U.escapeHtml(a.title) + ", " + U.formatDate(a.startedAt, "short") + "</option>"; }).join("");
    if (list.some(function (a) { return a.id === cur; })) f.attemptId.value = cur;
  }

  function render() {
    var f = filters();
    var attempts = EA.filterAttempts(all, f);
    var summary = U.$("#filter-summary");
    summary.innerHTML = "<span>Showing " + U.plural(attempts.length, "examination") + ", " + TYPE_NAMES[f.type] + ".</span>" +
      '<button type="button" class="link-btn text-xs" id="reset-filters">Reset filters</button>';
    U.$("#reset-filters").addEventListener("click", resetFilters);

    var content = U.$("#analytics-content");
    var emptyBox = U.$("#filter-empty");
    if (!attempts.length) {
      U.$$("#analytics-content > section").forEach(function (s) { s.hidden = true; });
      if (!emptyBox) {
        content.insertAdjacentHTML("afterbegin", '<div class="panel" id="filter-empty">' + BB.ui.empty({ title: "No examinations match these filters", text: "Widen the date range or choose a different subject or examination.", action: { id: "empty-reset", label: "Reset filters" } }) + "</div>");
        U.$("#empty-reset").addEventListener("click", resetFilters);
      }
      return;
    }
    if (emptyBox) emptyBox.remove();
    U.$$("#analytics-content > section").forEach(function (s) { s.hidden = false; });

    var focus = f.attemptId !== "all" ? attempts[0] : attempts[attempts.length - 1];
    renderOverview(attempts, f.type);
    renderTimeChart(attempts, f.type);
    renderCorrectness(attempts, f.type);
    renderSequence(attempts, focus, f.attemptId !== "all");
    renderChanges(attempts, f.type);
    renderUnanswered(attempts, f.type);
    renderTypeComparison(attempts);
    renderTimeline(focus, f.attemptId !== "all");
    renderInsights(attempts);
    U.$("#qb-desc").textContent = f.type === "all" ? "Across the examinations in your filter." : "Filtered to " + TYPE_NAMES[f.type] + ". The time management score always uses whole exams.";
  }

  function resetFilters() {
    var f = U.$("#filters");
    f.reset();
    fillAttempts("all");
    history.replaceState(null, "", "analytics.html");
    render();
  }

  function renderTmsDefinition() {
    U.$("#tms-body").innerHTML = "<ul>" + EA.TMS_DEFINITION.map(function (d) {
      return "<li><strong>" + d.weight + "% " + U.escapeHtml(d.label) + ".</strong> " + U.escapeHtml(d.text) + "</li>";
    }).join("") + "<li>Score = 0.4 × completion + 0.4 × pacing + 0.2 × ending buffer, shown out of 100. The overview averages the score across the exams in your filter.</li></ul>";
  }

  function renderOverview(attempts, type) {
    var ov = EA.overview(attempts, type);
    U.$("#ov-metrics").innerHTML =
      BB.ui.metric({ icon: "clock", label: "Average answering time", value: ov.answered ? U.formatDuration(ov.avgAnswerMs) : null, foot: "Per answered question" }) +
      BB.ui.metric({ icon: "check-circle", tone: "accent", label: "Average accuracy", value: ov.accuracy == null ? null : Math.round(ov.accuracy), unit: "%", foot: ov.correct + " correct of " + ov.answered + " answered" }) +
      BB.ui.metric({ icon: "repeat", tone: "violet", label: "Questions revised", value: ov.revised, foot: "Of " + ov.questions + " questions" }) +
      BB.ui.metric({ icon: "skip", tone: "amber", label: "Questions skipped", value: ov.skipped, foot: ov.unanswered + " still unanswered at the end" }) +
      BB.ui.metric({ icon: "timer", label: "Time management score", value: ov.tms, unit: "/100", progress: ov.tms, progressLabel: "Time management score", foot: "See how it's calculated below" });
  }

  function questionKinds(attempts) {
    // majority kind per question number
    var byNum = {};
    attempts.forEach(function (a) {
      a.questions.forEach(function (q) {
        byNum[q.number] = byNum[q.number] || { objective: 0, subjective: 0 };
        byNum[q.number][q.kind]++;
      });
    });
    return byNum;
  }

  function renderTimeChart(attempts, type) {
    var rows = EA.rows(attempts, type);
    var single = attempts.length === 1;
    if (!rows.length) { BB.charts.emptyState(U.$("#chart-time"), "No questions of this type in the selected examinations."); U.$("#c1-sub").textContent = ""; return; }
    var nums = [];
    rows.forEach(function (r) { if (nums.indexOf(r.q.number) === -1) nums.push(r.q.number); });
    nums.sort(function (a, b) { return a - b; });
    var kinds = questionKinds(attempts);
    var data = nums.map(function (n) {
      var list = rows.filter(function (r) { return r.q.number === n; });
      return U.mean(list, function (r) { return r.b.activeMs; }) / 60000;
    });
    U.$("#c1-sub").textContent = single ? "Active minutes on each question, with its time budget" : "Average active minutes per question number across " + U.plural(attempts.length, "exam");
    BB.charts.create("chart-time", function (c) {
      var ds = [{
        type: "bar", label: single ? "Active time" : "Average active time",
        data: data.map(function (x) { return U.round(x, 2); }),
        backgroundColor: nums.map(function (n) { var k = kinds[n]; return k && k.subjective > k.objective ? c.subjective : c.objective; }),
        maxBarThickness: 30
      }];
      if (single) {
        var a = attempts[0];
        ds.push({ type: "line", label: "Time budget", data: nums.map(function (n) { var q = a.questions[n - 1]; return U.round((a.allowedMs * q.marks / a.totalMarks) / 60000, 2); }), borderColor: c.textSecondary, borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, stepped: "middle" });
      }
      return {
        type: "bar",
        data: { labels: nums.map(function (n) { return "Q" + n; }), datasets: ds },
        options: {
          plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: function (t) { return " " + t.dataset.label + ": " + U.formatDuration(t.raw * 60000); } } } },
          scales: { y: BB.charts.axes.plain(c, { title: { display: true, text: "Minutes" } }), x: BB.charts.axes.category() }
        }
      };
    });
  }

  function renderCorrectness(attempts, type) {
    var rows = EA.rows(attempts, type);
    var types = ["mcq", "tf", "short", "long"].filter(function (t) { return rows.some(function (r) { return r.q.type === t; }); });
    if (!types.length) { BB.charts.emptyState(U.$("#chart-correctness"), "No questions of this type in the selected examinations."); return; }
    function count(t, status) { return rows.filter(function (r) { return r.q.type === t && r.q.status === status; }).length; }
    BB.charts.create("chart-correctness", function (c) {
      return {
        type: "bar",
        data: {
          labels: types.map(function (t) { return QB.TYPE_LABELS[t]; }),
          datasets: [
            { label: "Correct", data: types.map(function (t) { return count(t, "correct"); }), backgroundColor: c.accent, maxBarThickness: 40 },
            { label: "Incorrect", data: types.map(function (t) { return count(t, "incorrect"); }), backgroundColor: c.rose, maxBarThickness: 40 },
            { label: "Unanswered", data: types.map(function (t) { return count(t, "unanswered"); }), backgroundColor: c.muted, maxBarThickness: 40 }
          ]
        },
        options: {
          plugins: { legend: { position: "bottom" } },
          scales: { x: Object.assign(BB.charts.axes.category(), { stacked: true }), y: BB.charts.axes.plain(c, { stacked: true, ticks: { precision: 0 }, title: { display: true, text: "Questions" } }) }
        }
      };
    });
  }

  function renderSequence(attempts, a, chosen) {
    U.$("#c2-sub").textContent = chosen ? a.title + ", " + U.formatDate(a.startedAt) : "Your most recent exam in this filter (" + a.title + ", " + U.formatDate(a.startedAt, "short") + "). Choose an examination above to see another.";
    var order = BB.arcPath.orderFromAttempt(a);
    BB.arcPath.render(U.$("#sequence-path"), {
      questions: a.questions.map(function (q) { return { number: q.number, kind: q.kind, status: q.status === "unanswered" ? "unanswered" : null }; }),
      order: order,
      spacing: 54
    });
    var collapsed = order.filter(function (q, i) { return i === 0 || q !== order[i - 1]; });
    var backs = 0;
    for (var i = 1; i < collapsed.length; i++) if (collapsed[i] < collapsed[i - 1]) backs++;
    U.$("#sequence-text").textContent = "Visit order: " + collapsed.map(function (q) { return "Q" + (q + 1); }).join(", ") + ". " + U.plural(collapsed.length, "visit") + ", including " + U.plural(backs, "move") + " back to an earlier question.";
    var styles = U.groupBy(attempts, EA.openingStyle);
    var sf = (styles["subjective-first"] || []).length, of = (styles["objective-first"] || []).length;
    U.$("#opening-text").textContent = attempts.length > 1
      ? "Across this filter, you started with a written question in " + sf + " exams and with an objective question in " + of + ". Both are recorded without being treated as right or wrong."
      : "You started with " + (EA.openingStyle(a) === "subjective-first" ? "a written" : "an objective") + " question. Brainy Buddy records the order without treating either as right or wrong.";
  }

  function renderChanges(attempts, type) {
    var rows = EA.rows(attempts, type);
    var nums = [];
    rows.forEach(function (r) { if (nums.indexOf(r.q.number) === -1) nums.push(r.q.number); });
    nums.sort(function (a, b) { return a - b; });
    if (!nums.length) { BB.charts.emptyState(U.$("#chart-changes"), "No questions of this type in the selected examinations."); }
    else BB.charts.create("chart-changes", function (c) {
      return {
        type: "bar",
        data: {
          labels: nums.map(function (n) { return "Q" + n; }),
          datasets: [
            { label: "Answer changes", data: nums.map(function (n) { return U.sum(rows.filter(function (r) { return r.q.number === n; }), function (r) { return r.b.changes; }); }), backgroundColor: c.warning, maxBarThickness: 18 },
            { label: "Returns to the question", data: nums.map(function (n) { return U.sum(rows.filter(function (r) { return r.q.number === n; }), function (r) { return Math.max(0, r.b.visits - 1); }); }), backgroundColor: c.violet, maxBarThickness: 18 }
          ]
        },
        options: { plugins: { legend: { position: "bottom" } }, scales: { y: BB.charts.axes.plain(c, { ticks: { precision: 0 } }), x: BB.charts.axes.category() } }
      };
    });

    var co = EA.changeOutcomes(attempts);
    if (!co.total) BB.charts.emptyState(U.$("#chart-change-outcomes"), "No objective answers were changed in these examinations.");
    else BB.charts.create("chart-change-outcomes", function (c) {
      return {
        type: "doughnut",
        data: {
          labels: ["Incorrect to correct", "Correct to incorrect", "Incorrect to incorrect", "Back to the original"],
          datasets: [{ data: [co.wrongToRight, co.rightToWrong, co.wrongToWrong, co.backToSame], backgroundColor: [c.accent, c.rose, c.warning, c.muted], borderColor: c.surface, borderWidth: 2 }]
        },
        options: { cutout: "62%", plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: function (t) { return " " + t.label + ": " + t.raw; } } } } }
      };
    });
  }

  function renderUnanswered(attempts, type) {
    var rows = EA.rows(attempts, type).filter(function (r) { return !r.answered; });
    U.$("#c5-sub").textContent = rows.length ? U.plural(rows.length, "question") + " had no answer at submission." : "";
    var el = U.$("#unanswered-table");
    if (!rows.length) {
      el.innerHTML = '<div style="padding:8px 24px 24px">' + BB.ui.empty({ mood: "celebrate", title: "Every question was answered", text: "No questions in this selection were left blank at submission." }) + "</div>";
      return;
    }
    el.innerHTML = '<div class="table-wrap" style="border:0;border-top:1px solid var(--color-border);border-radius:0;margin-top:16px"><table class="table"><caption class="visually-hidden">Questions left unanswered</caption><thead><tr>' +
      '<th scope="col">Examination</th><th scope="col">Question</th><th scope="col">Type</th><th scope="col" class="num">Time viewed</th><th scope="col" class="num">Visits</th><th scope="col">Skipped</th><th scope="col">Flagged</th><th scope="col" class="num">Time left at submission</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return "<tr><td>" + U.escapeHtml(r.attempt.title) + '<div class="text-xs text-secondary">' + U.formatDate(r.attempt.startedAt, "short") + "</div></td>" +
          "<td>Q" + r.q.number + "</td>" +
          '<td><span class="badge badge--' + r.q.kind + '">' + QB.TYPE_LABELS[r.q.type] + "</span></td>" +
          '<td class="num">' + U.formatDuration(r.b.activeMs) + "</td>" +
          '<td class="num">' + r.b.visits + "</td>" +
          "<td>" + (r.b.skipped ? "Yes" : "No") + "</td>" +
          "<td>" + (r.b.flagged ? "Yes" : "No") + "</td>" +
          '<td class="num">' + U.formatDuration(Math.max(0, r.attempt.allowedMs - r.attempt.usedMs), { noSeconds: true }) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function renderTypeComparison(attempts) {
    var tc = EA.typeComparison(attempts);
    function row(label, s) {
      return "<tr><th scope=\"row\">" + label + "</th>" +
        '<td class="num">' + (s.answered ? U.formatDuration(s.avgMs) : "—") + "</td>" +
        '<td class="num">' + (s.accuracy == null ? "—" : Math.round(s.accuracy) + "%") + "</td>" +
        '<td class="num">' + s.obtained + " / " + s.total + (s.total ? ' <span class="text-secondary">(' + Math.round(U.pct(s.obtained, s.total)) + "%)</span>" : "") + "</td>" +
        '<td class="num">' + Math.round(s.timeShare) + "%</td>" +
        '<td class="num">' + Math.round(s.markShare) + "%</td></tr>";
    }
    U.$("#type-table").innerHTML = '<div class="table-wrap" style="border:0"><table class="table"><caption class="visually-hidden">Objective and subjective question comparison</caption><thead><tr>' +
      '<th scope="col">Question type</th><th scope="col" class="num">Average time spent</th><th scope="col" class="num">Accuracy</th><th scope="col" class="num">Marks obtained</th><th scope="col" class="num">Share of exam time</th><th scope="col" class="num">Share of marks</th></tr></thead><tbody>' +
      row('<span class="subject-name"><span class="subject-dot" style="background:var(--color-objective)"></span>Objective</span>', tc.objective) +
      row('<span class="subject-name"><span class="subject-dot" style="background:var(--color-subjective)"></span>Subjective</span>', tc.subjective) +
      '</tbody></table></div><p class="text-xs text-secondary" style="padding:12px 16px">Share of exam time is the share of active answering time across these exams. A written answer counts as correct when it earns at least half its marks.</p>';

    BB.charts.create("chart-type-compare", function (c) {
      return {
        type: "bar",
        data: {
          labels: ["Objective", "Subjective"],
          datasets: [
            { label: "Share of exam time", data: [U.round(tc.objective.timeShare, 1), U.round(tc.subjective.timeShare, 1)], backgroundColor: [c.objective, c.subjective], maxBarThickness: 26 },
            { label: "Share of marks", data: [U.round(tc.objective.markShare, 1), U.round(tc.subjective.markShare, 1)], backgroundColor: [c.alpha(c.objective, 0.35), c.alpha(c.subjective, 0.35)], maxBarThickness: 26 }
          ]
        },
        options: {
          indexAxis: "y",
          plugins: { legend: { position: "bottom", labels: { generateLabels: function () { return [{ text: "Share of exam time (solid)", fillStyle: c.textSecondary, strokeStyle: c.textSecondary, fontColor: c.textSecondary }, { text: "Share of marks (light)", fillStyle: c.muted, strokeStyle: c.muted, fontColor: c.textSecondary }]; } } },
            tooltip: { callbacks: { label: function (t) { return " " + t.dataset.label + ": " + t.raw + "%"; } } } },
          scales: { x: BB.charts.axes.percent(c), y: BB.charts.axes.category() }
        }
      };
    });
  }

  function renderTimeline(a, chosen) {
    var tl = EA.timeline(a);
    U.$("#tl-sub").textContent = (chosen ? "" : "Most recent exam in this filter: ") + a.title + ", " + U.formatDate(a.startedAt, "datetime") + ". Allowed " + U.formatDuration(tl.allowedMs) + ", used " + U.formatDuration(tl.usedMs) + ".";
    var pct = function (ms) { return U.clamp(ms / tl.allowedMs * 100, 0, 100); };
    var ICON = { answer: "check", change: "repeat", skip: "skip", flag: "flag" };
    var LABEL = { answer: "Answered", change: "Changed answer on", skip: "Left without answering", flag: "Flagged", unflag: "Removed flag from", revisit: "Returned to", clear: "Cleared answer on", hidden: "Left the tab on", visible: "Came back to the tab on", resume: "Resumed after reloading on", submit: "Submitted the exam" };
    var first = tl.firstAnswer;

    var segs = tl.segments.map(function (s) {
      var w = pct(s.leave) - pct(s.enter);
      var label = "Q" + s.number + " (" + (s.kind === "objective" ? "objective" : "written") + "), " + U.formatDuration(s.enter, { clock: true }) + " to " + U.formatDuration(s.leave, { clock: true });
      return '<button type="button" class="timeline__seg timeline__seg--' + s.kind + '" style="left:' + pct(s.enter) + "%;width:" + w + '%" title="' + label + '" aria-label="' + label + '">' + (w > 3.2 ? "Q" + s.number : "") + "</button>";
    }).join("");
    var markers = tl.events.filter(function (e) { return ICON[e.type]; }).map(function (e) {
      var isFirst = first && e.type === "answer" && e.t === first.t && e.q === first.q;
      var label = (isFirst ? "First answer: " : "") + LABEL[e.type] + " Q" + e.number + " at " + U.formatDuration(e.t, { clock: true });
      return '<span class="timeline__marker timeline__marker--' + (isFirst ? "first" : e.type) + '" style="left:' + pct(e.t) + '%" title="' + label + '" aria-hidden="true">' + BB.icon(isFirst ? "star" : ICON[e.type]) + "</span>";
    }).join("");
    var unused = tl.usedMs < tl.allowedMs ? '<span class="timeline__unused" style="left:' + pct(tl.usedMs) + "%;width:" + (100 - pct(tl.usedMs)) + '%" title="Unused time"></span>' : "";
    var axis = [0, 0.25, 0.5, 0.75, 1].map(function (f) { return "<span>" + U.formatDuration(tl.allowedMs * f, { clock: true }) + "</span>"; }).join("");

    var list = tl.events.filter(function (e) { return LABEL[e.type] && e.type !== "visible" && e.type !== "hidden"; }).map(function (e) {
      var isFirst = first && e.type === "answer" && e.t === first.t && e.q === first.q;
      var kind = isFirst ? "first" : ICON[e.type] ? e.type : null;
      var inFinal = e.t >= tl.finalPeriodStart;
      return '<li><time>' + U.formatDuration(e.t, { clock: true }) + "</time>" +
        (kind ? '<span class="timeline__marker timeline__marker--' + kind + '" aria-hidden="true">' + BB.icon(isFirst ? "star" : ICON[e.type]) + "</span>" : "<span></span>") +
        "<span>" + (isFirst ? "<strong>First question answered:</strong> " : "") + LABEL[e.type] + (e.number ? " Q" + e.number : "") +
        (inFinal ? ' <span class="badge badge--danger">Final 10%</span>' : "") + "</span></li>";
    }).join("");

    U.$("#timeline").innerHTML =
      '<div class="timeline__track-wrap">' +
      '<div class="timeline__track" role="group" aria-label="Time on each question during the exam">' + unused + segs +
      '<span class="timeline__final" style="width:10%"><span class="timeline__final-label">Final period</span></span>' + markers + "</div>" +
      '<div class="timeline__axis" aria-hidden="true">' + axis + "</div></div>" +
      '<div class="legend" style="margin:4px 0 16px" aria-hidden="true">' +
      '<span class="legend__item"><span class="timeline__marker timeline__marker--first" style="position:static;transform:none">' + BB.icon("star") + "</span>First answer</span>" +
      '<span class="legend__item"><span class="timeline__marker timeline__marker--answer" style="position:static;transform:none">' + BB.icon("check") + "</span>Answered</span>" +
      '<span class="legend__item"><span class="timeline__marker timeline__marker--change" style="position:static;transform:none">' + BB.icon("repeat") + "</span>Revised</span>" +
      '<span class="legend__item"><span class="timeline__marker timeline__marker--skip" style="position:static;transform:none">' + BB.icon("skip") + "</span>Skipped</span>" +
      '<span class="legend__item"><span class="timeline__marker timeline__marker--flag" style="position:static;transform:none">' + BB.icon("flag") + "</span>Flagged</span></div>" +
      '<h3 class="label" id="tl-events-title" style="margin-bottom:8px">Event log</h3><ol class="timeline__events" aria-labelledby="tl-events-title">' + list + "</ol>";
  }

  function renderInsights(attempts) {
    var list = EA.insights(attempts);
    var el = U.$("#insights");
    if (!list.length) {
      el.innerHTML = '<div class="panel">' + BB.ui.empty({ title: "No clear patterns in this selection", text: attempts.length < 3 ? "Insights need more data. Add a few more exams, or widen your filters." : "None of the behaviour rules found a notable pattern in these exams." }) + "</div>";
      return;
    }
    el.innerHTML = list.map(function (ins) {
      return BB.ui.insightCard(ins, {
        badge: BB.repo.showDemo() ? BB.ui.demoBadge() : "",
        footer: ins.metric ? '<div class="insight__foot"><span class="text-xs text-secondary">Measured from the exams in your current filter. Rule: ' + U.escapeHtml(ruleText(ins.id)) + "</span></div>" : ""
      });
    }).join("");
  }

  function ruleText(id) {
    return {
      "time-vs-marks": "time share differs from mark share by 8 or more percentage points.",
      "late-objective-accuracy": "final-quarter objective accuracy is 15+ points lower, with at least 4 late answers.",
      "answer-changes": "at least 4 objective answers were changed.",
      "unanswered-with-time": "a question was blank at submission with 3+ minutes left.",
      "skipped-not-returned": "3+ skipped questions, not all revisited."
    }[id] || "";
  }
})(window.BB = window.BB || {});
