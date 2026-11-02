/**
 * BB.examAnalytics — pure functions over exam attempts (demo + simulator).
 *
 * Definitions used throughout the UI:
 *  • Answered question  — has a final answer at submission.
 *  • Correct            — objective: the final answer matches the key.
 *                         written: earns at least half of its marks.
 *  • Accuracy           — correct ÷ answered.
 *  • Score              — marks obtained ÷ total marks.
 *  • Skipped            — left without an answer at least once (may be answered later).
 *  • Revised            — answer changed, or question revisited after it was answered.
 *  • Time management score (0–100) — see timeManagement() below.
 *
 * Insights describe what happened in the data. They never guess at why.
 */
(function (BB) {
  "use strict";

  var U = BB.utils;

  var TYPE_FILTERS = {
    all: function () { return true; },
    objective: function (q) { return q.kind === "objective"; },
    subjective: function (q) { return q.kind === "subjective"; },
    mcq: function (q) { return q.type === "mcq"; },
    tf: function (q) { return q.type === "tf"; },
    short: function (q) { return q.type === "short"; },
    long: function (q) { return q.type === "long"; }
  };

  function filterAttempts(attempts, f) {
    f = f || {};
    return attempts.filter(function (a) {
      if (f.subject && f.subject !== "all" && a.subject !== f.subject) return false;
      if (f.attemptId && f.attemptId !== "all" && a.id !== f.attemptId) return false;
      if (f.from && a.startedAt < U.parseDateKey(f.from).getTime()) return false;
      if (f.to && a.startedAt >= U.addDays(U.parseDateKey(f.to), 1).getTime()) return false;
      return true;
    });
  }

  /** Flatten attempts into one row per question with its behaviour. */
  function rows(attempts, type) {
    var keep = TYPE_FILTERS[type || "all"] || TYPE_FILTERS.all;
    var out = [];
    attempts.forEach(function (a) {
      a.questions.forEach(function (q, i) {
        if (!keep(q)) return;
        var b = a.behaviour.perQuestion[i];
        var visitsAfterAnswer = b.answeredAt == null ? 0 : a.behaviour.visits.filter(function (v) {
          return v.q === i && !v.resumed && v.enter > b.answeredAt;
        }).length;
        out.push({
          attempt: a,
          index: i,
          q: q,
          b: b,
          answered: q.status !== "unanswered",
          correct: q.status === "correct",
          revised: b.changes > 0 || visitsAfterAnswer > 0,
          lateAnswer: b.answeredAt != null && b.answeredAt > a.allowedMs * 0.75
        });
      });
    });
    return out;
  }

  /**
   * Time management score (0–100) for one attempt — weighted by marks, so a 1-mark item
   * counts less than an 8-mark essay:
   *   40% Completion     — marks of answered questions ÷ total marks
   *   40% Pacing         — marks of questions whose active time stayed within their time budget
   *                        ÷ total marks. Budget = allowed time × (question marks ÷ total marks).
   *                        Finishing a question quickly is never penalised.
   *   20% Ending buffer  — share of answers first given before the final 10% of the allowed time.
   */
  var TMS_DEFINITION = [
    { key: "completion", weight: 40, label: "Completion", text: "Marks of the questions you answered, as a share of all marks." },
    { key: "pacing", weight: 40, label: "Pacing", text: "Marks of the questions you finished within their time budget (allowed time × the question's share of marks). Answering quickly is never penalised." },
    { key: "buffer", weight: 20, label: "Ending buffer", text: "Share of your answers given before the final 10% of the allowed time." }
  ];

  function timeManagement(a) {
    var totalMarks = a.totalMarks || U.sum(a.questions, function (q) { return q.marks; });
    var answeredMarks = U.sum(a.questions.filter(function (q) { return q.status !== "unanswered"; }), function (q) { return q.marks; });
    var onBudgetMarks = U.sum(a.questions.filter(function (q, i) {
      var budget = a.allowedMs * (q.marks / totalMarks);
      return a.behaviour.perQuestion[i].activeMs <= budget;
    }), function (q) { return q.marks; });
    var lateCut = a.allowedMs * 0.9;
    var answers = a.behaviour.perQuestion.filter(function (b) { return b.answeredAt != null; });
    var answeredEarly = answers.filter(function (b) { return b.answeredAt <= lateCut; }).length;
    var completion = totalMarks ? answeredMarks / totalMarks : 0;
    var pacing = totalMarks ? onBudgetMarks / totalMarks : 0;
    var buffer = answers.length ? answeredEarly / answers.length : 0;
    return {
      score: Math.round(100 * (0.4 * completion + 0.4 * pacing + 0.2 * buffer)),
      completion: completion,
      pacing: pacing,
      buffer: buffer
    };
  }

  function overview(attempts, type) {
    var r = rows(attempts, type);
    var answered = r.filter(function (x) { return x.answered; });
    var tms = attempts.map(timeManagement);
    return {
      attempts: attempts.length,
      questions: r.length,
      answered: answered.length,
      correct: answered.filter(function (x) { return x.correct; }).length,
      avgAnswerMs: U.mean(answered, function (x) { return x.b.activeMs; }),
      accuracy: answered.length ? U.pct(answered.filter(function (x) { return x.correct; }).length, answered.length) : null,
      revised: r.filter(function (x) { return x.revised; }).length,
      skipped: r.filter(function (x) { return x.b.skipped; }).length,
      unanswered: r.filter(function (x) { return !x.answered; }).length,
      scorePct: attempts.length ? U.mean(attempts, function (a) { return a.scorePct; }) : null,
      tms: tms.length ? Math.round(U.mean(tms, function (t) { return t.score; })) : null,
      tmsParts: tms.length ? {
        completion: U.mean(tms, function (t) { return t.completion; }),
        pacing: U.mean(tms, function (t) { return t.pacing; }),
        buffer: U.mean(tms, function (t) { return t.buffer; })
      } : null
    };
  }

  function typeComparison(attempts) {
    var totalTime = U.sum(attempts, function (a) { return U.sum(a.behaviour.perQuestion, function (b) { return b.activeMs; }); });
    var totalMarks = U.sum(attempts, function (a) { return a.totalMarks; });
    function stats(kind) {
      var r = rows(attempts, kind);
      var answered = r.filter(function (x) { return x.answered; });
      var time = U.sum(r, function (x) { return x.b.activeMs; });
      var marks = U.sum(r, function (x) { return x.q.marks; });
      return {
        count: r.length,
        answered: answered.length,
        avgMs: answered.length ? U.mean(answered, function (x) { return x.b.activeMs; }) : 0,
        accuracy: answered.length ? U.pct(answered.filter(function (x) { return x.correct; }).length, answered.length) : null,
        obtained: U.sum(r, function (x) { return x.q.obtained; }),
        total: marks,
        timeShare: totalTime ? U.pct(time, totalTime) : 0,
        markShare: totalMarks ? U.pct(marks, totalMarks) : 0,
        timeMs: time
      };
    }
    return { objective: stats("objective"), subjective: stats("subjective") };
  }

  /** How answer changes turned out (objective questions only — written answers have no single key). */
  function changeOutcomes(attempts) {
    var res = { wrongToRight: 0, rightToWrong: 0, wrongToWrong: 0, backToSame: 0, writtenEdits: 0, total: 0 };
    rows(attempts).forEach(function (x) {
      if (x.b.changes < 1) return;
      if (x.q.kind === "subjective") { res.writtenEdits += x.b.changes; return; }
      var h = x.b.history;
      var first = h[0].correct, last = h[h.length - 1].correct;
      res.total++;
      if (!first && last) res.wrongToRight++;
      else if (first && !last) res.rightToWrong++;
      else if (first && last) res.backToSame++;
      else res.wrongToWrong++;
    });
    return res;
  }

  /** Objective accuracy for answers first given in the final quarter vs earlier. */
  function lateAccuracy(attempts) {
    var obj = rows(attempts, "objective").filter(function (x) { return x.answered; });
    var late = obj.filter(function (x) { return x.lateAnswer; });
    var early = obj.filter(function (x) { return !x.lateAnswer; });
    function acc(list) { return list.length ? U.pct(list.filter(function (x) { return x.correct; }).length, list.length) : null; }
    return { lateN: late.length, earlyN: early.length, late: acc(late), early: acc(early) };
  }

  /** Which kind of question the student answered first in an attempt. */
  function openingStyle(a) {
    var firstAnswer = a.behaviour.events.filter(function (e) { return e.type === "answer"; })[0];
    if (!firstAnswer) return "none";
    return a.questions[firstAnswer.q].kind === "subjective" ? "subjective-first" : "objective-first";
  }

  function confidence(nAttempts, nObs, strong) {
    var level = nAttempts >= 5 && nObs >= 15 && strong ? "high" : nAttempts >= 3 && nObs >= 8 ? "medium" : "low";
    return {
      level: level,
      label: level === "high" ? "High confidence" : level === "medium" ? "Medium confidence" : "Low confidence",
      reason: "Based on " + U.plural(nAttempts, "exam") + " and " + U.plural(nObs, "question response") + "."
    };
  }

  /**
   * Rule-based behaviour insights. Each one:
   * { id, category, title, pattern, evidence[], confidence, action, target, metric }
   */
  function insights(attempts) {
    var out = [];
    if (!attempts.length) return out;
    var nQ = U.sum(attempts, function (a) { return a.questions.length; });

    // 1 — Time share vs mark share
    var tc = typeComparison(attempts);
    var diff = tc.subjective.timeShare - tc.subjective.markShare;
    if (Math.abs(diff) >= 8 && tc.subjective.count && tc.objective.count) {
      var heavy = diff > 0 ? "subjective" : "objective";
      var heavyLabel = heavy === "subjective" ? "Written (subjective) questions" : "Objective questions";
      var s = tc[heavy];
      var perAttemptOver = attempts.filter(function (a) {
        var t1 = typeComparison([a])[heavy];
        return t1.timeShare - t1.markShare >= 8;
      }).length;
      out.push({
        id: "time-vs-marks",
        category: "Time Management",
        title: heavyLabel + " take a larger share of time than of marks",
        pattern: heavyLabel + " used " + Math.round(s.timeShare) + "% of your answering time but carry " + Math.round(s.markShare) + "% of the marks.",
        evidence: [
          "Across " + U.plural(attempts.length, "exam") + ": " + U.formatDuration(s.timeMs, { noSeconds: true }) + " on " + heavy + " questions out of " +
            U.formatDuration(tc.objective.timeMs + tc.subjective.timeMs, { noSeconds: true }) + " in total.",
          "The gap of " + Math.round(Math.abs(diff)) + " percentage points appeared in " + perAttemptOver + " of " + attempts.length + " exams.",
          "Objective accuracy: " + fmtPct(tc.objective.accuracy) + ". Written-answer accuracy: " + fmtPct(tc.subjective.accuracy) + "."
        ],
        confidence: confidence(attempts.length, nQ, perAttemptOver / attempts.length >= 0.6),
        action: heavy === "subjective"
          ? "Practise timed written answers. Before starting, note a time budget for each question in proportion to its marks, and move on when it runs out."
          : "Set a per-question time limit for objective items (about 1–2 minutes each) and flag any you can't settle to revisit later.",
        target: "Bring the " + (heavy === "subjective" ? "written" : "objective") + "-question time share to within 5 points of its mark share (" +
          Math.round(s.markShare + 5) + "% or less) in your next 3 exams.",
        metric: { name: heavy + "TimeShare", baseline: s.timeShare, target: s.markShare + 5, unit: "%", lowerIsBetter: true }
      });
    }

    // 2 — Final-quarter objective accuracy
    var la = lateAccuracy(attempts);
    if (la.lateN >= 4 && la.earlyN >= 6 && la.early - la.late >= 15) {
      out.push({
        id: "late-objective-accuracy",
        category: "Examination Strategy",
        title: "Objective accuracy is lower in the final quarter of the exam",
        pattern: "Objective answers given in the last 25% of the allowed time were correct " + Math.round(la.late) + "% of the time, compared with " + Math.round(la.early) + "% earlier in the exam.",
        evidence: [
          la.lateN + " objective answers were first given in the final quarter and " + la.earlyN + " were given earlier.",
          "The difference is " + Math.round(la.early - la.late) + " percentage points."
        ],
        confidence: confidence(attempts.length, la.lateN + la.earlyN, la.lateN >= 10),
        action: "Plan to finish objective questions before the final quarter, or reserve the last 5 minutes to re-check the objective answers you gave late.",
        target: "Raise final-quarter objective accuracy to within 10 points of your earlier accuracy (" + Math.round(la.early - 10) + "% or higher) over your next 3 exams.",
        metric: { name: "lateObjectiveAccuracy", baseline: la.late, target: la.early - 10, unit: "%", lowerIsBetter: false }
      });
    }

    // 3 — Effect of answer changes
    var co = changeOutcomes(attempts);
    if (co.total >= 4) {
      var harmful = co.rightToWrong > co.wrongToRight;
      var even = co.rightToWrong === co.wrongToRight;
      out.push({
        id: "answer-changes",
        category: "Examination Strategy",
        title: harmful ? "Changed answers more often moved away from the correct option"
          : even ? "Changed answers were as likely to become wrong as right"
            : "Changed answers more often moved to the correct option",
        pattern: "Of " + U.plural(co.total, "changed objective answer") + ", " + co.wrongToRight + " went from incorrect to correct and " + co.rightToWrong + " went from correct to incorrect.",
        evidence: [
          co.wrongToWrong + " changed from one incorrect option to another; " + co.backToSame + " ended on the original correct answer.",
          co.writtenEdits ? co.writtenEdits + " edits were made to written answers (not classified, as they have no single correct key)." : "No edits to written answers were recorded."
        ],
        confidence: confidence(attempts.length, co.total, co.total >= 10),
        action: harmful || even
          ? "Before changing an objective answer, name a specific reason (for example, you misread the question or found a calculation error). Without one, keep your first answer."
          : "Keep at least 5 minutes at the end of each exam to check answers, as you do now.",
        target: harmful || even
          ? "In your next 3 exams, have more incorrect-to-correct changes than correct-to-incorrect changes."
          : "Keep incorrect-to-correct changes at or above correct-to-incorrect changes in your next 3 exams.",
        metric: { name: "netChanges", baseline: co.wrongToRight - co.rightToWrong, target: 0, unit: "", lowerIsBetter: false }
      });
    }

    // 4 — Unanswered questions with time remaining
    var leftover = attempts.filter(function (a) {
      var unanswered = a.questions.filter(function (q) { return q.status === "unanswered"; }).length;
      return unanswered > 0 && a.allowedMs - a.usedMs >= 3 * 60000;
    });
    if (leftover.length) {
      var avgLeft = U.mean(leftover, function (a) { return a.allowedMs - a.usedMs; });
      var unansweredTotal = U.sum(leftover, function (a) { return a.questions.filter(function (q) { return q.status === "unanswered"; }).length; });
      out.push({
        id: "unanswered-with-time",
        category: "Examination Strategy",
        title: "Questions were left blank while time remained",
        pattern: "In " + U.plural(leftover.length, "exam") + ", you submitted with " + U.formatDuration(avgLeft, { noSeconds: true }) + " left on average and " + U.plural(unansweredTotal, "unanswered question") + " in total.",
        evidence: leftover.slice(-3).map(function (a) {
          return a.title + ": " + a.questions.filter(function (q) { return q.status === "unanswered"; }).length + " blank, " + U.formatDuration(a.allowedMs - a.usedMs, { noSeconds: true }) + " remaining.";
        }),
        confidence: confidence(attempts.length, unansweredTotal, leftover.length >= 3),
        action: "Before you submit, open the question navigator and attempt every blank question with your best answer.",
        target: "Submit with zero unanswered questions whenever time remains, in each of your next 3 exams.",
        metric: { name: "unansweredWithTime", baseline: unansweredTotal / leftover.length, target: 0, unit: "", lowerIsBetter: true }
      });
    }

    // 5 — Skipped questions that were never revisited
    var r = rows(attempts);
    var skipped = r.filter(function (x) { return x.b.skipped; });
    if (skipped.length >= 3) {
      var returned = skipped.filter(function (x) { return x.b.visits > 1; }).length;
      var answeredLater = skipped.filter(function (x) { return x.answered; }).length;
      if (returned < skipped.length) {
        out.push({
          id: "skipped-not-returned",
          category: "Examination Strategy",
          title: "Some skipped questions were not revisited",
          pattern: "You came back to " + returned + " of " + U.plural(skipped.length, "skipped question") + "; " + answeredLater + " of them were answered by the end.",
          evidence: [
            U.plural(skipped.filter(function (x) { return x.b.flagged; }).length, "skipped question") + " were flagged when skipped.",
            "Flagged skipped questions are easier to find again in the navigator."
          ],
          confidence: confidence(attempts.length, skipped.length, skipped.length >= 8),
          action: "Flag every question as you skip it, then work through the flagged list before reviewing anything else.",
          target: "Return to 100% of skipped questions before submitting, over your next 3 exams.",
          metric: { name: "skipReturnRate", baseline: U.pct(returned, skipped.length), target: 100, unit: "%", lowerIsBetter: false }
        });
      }
    }

    // 6 — Opening order (neutral comparison; no order is assumed to be better)
    var groups = U.groupBy(attempts, openingStyle);
    var sf = groups["subjective-first"] || [], of = groups["objective-first"] || [];
    if (sf.length >= 2 && of.length >= 2) {
      var sfScore = U.mean(sf, function (a) { return a.scorePct; });
      var ofScore = U.mean(of, function (a) { return a.scorePct; });
      out.push({
        id: "opening-order",
        category: "Examination Strategy",
        title: "Comparison of the order you answer questions in",
        pattern: "You started with written questions in " + U.plural(sf.length, "exam") + " (average score " + Math.round(sfScore) + "%) and with objective questions in " + U.plural(of.length, "exam") + " (average " + Math.round(ofScore) + "%).",
        evidence: [
          "This compares averages only. Subjects and papers differed between the groups, so the order alone doesn't explain the difference.",
          "Neither order is treated as correct. Brainy Buddy records it so you can compare like with like."
        ],
        confidence: { level: "low", label: "Low confidence", reason: "Only " + U.plural(sf.length + of.length, "exam") + ", with different subjects in each group." },
        action: "Keep the order that feels natural. To compare fairly, try both orders on practice papers in the same subject.",
        target: "Collect at least 3 exams of each order in the same subject before drawing a conclusion.",
        metric: null
      });
    }

    return out;
  }

  function fmtPct(v) { return v == null ? "not available" : Math.round(v) + "%"; }

  /** Data for the examination timeline view. */
  function timeline(a) {
    var events = a.behaviour.events.filter(function (e) { return e.type !== "view" && e.type !== "start"; });
    return {
      allowedMs: a.allowedMs,
      usedMs: a.usedMs,
      finalPeriodStart: a.allowedMs * 0.9,
      segments: a.behaviour.visits.map(function (v) {
        var q = a.questions[v.q];
        return { q: v.q, number: q.number, kind: q.kind, type: q.type, enter: v.enter, leave: v.leave };
      }),
      events: events.map(function (e) {
        return { t: e.t, type: e.type, q: e.q, number: e.q != null ? a.questions[e.q].number : null };
      }),
      firstAnswer: a.behaviour.events.filter(function (e) { return e.type === "answer"; })[0] || null
    };
  }

  BB.examAnalytics = {
    TYPE_FILTERS: TYPE_FILTERS,
    filterAttempts: filterAttempts,
    rows: rows,
    timeManagement: timeManagement,
    TMS_DEFINITION: TMS_DEFINITION,
    overview: overview,
    typeComparison: typeComparison,
    changeOutcomes: changeOutcomes,
    lateAccuracy: lateAccuracy,
    openingStyle: openingStyle,
    insights: insights,
    timeline: timeline,
    confidence: confidence
  };
})(window.BB = window.BB || {});
