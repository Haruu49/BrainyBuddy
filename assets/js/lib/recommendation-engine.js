/**
 * BB.recommend — RULE-BASED recommendation engine (demo).
 *
 * No AI model is connected. Every recommendation is produced by a transparent
 * rule over the student's own exam and study records, and each card shows the
 * rule that fired. When a model is integrated later, it should return the same
 * shape: { id, title, category, pattern, evidence[], confidence, action, target,
 * progress, rule }.
 */
(function (BB) {
  "use strict";

  var U = BB.utils;
  var EA = function () { return BB.examAnalytics; };

  var CATEGORIES = ["Time Management", "Examination Strategy", "Study Consistency", "Subject Improvement", "Focus Management"];
  var CATEGORY_ICONS = {
    "Time Management": "timer",
    "Examination Strategy": "target",
    "Study Consistency": "calendar",
    "Subject Improvement": "trending-up",
    "Focus Management": "zap"
  };
  var STATUSES = [
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "completed", label: "Completed" }
  ];

  function sessionConfidence(n, strong) {
    var level = n >= 20 && strong ? "high" : n >= 10 ? "medium" : "low";
    return {
      level: level,
      label: level === "high" ? "High confidence" : level === "medium" ? "Medium confidence" : "Low confidence",
      reason: "Based on " + U.plural(n, "study session") + "."
    };
  }

  /** progress for a metric where we know baseline, current and target. */
  function progress(baseline, current, target, lowerIsBetter, unit, decimals) {
    if (baseline == null || current == null || target == null) return null;
    var span = lowerIsBetter ? baseline - target : target - baseline;
    var moved = lowerIsBetter ? baseline - current : current - baseline;
    var pct = span > 0 ? U.clamp(moved / span, 0, 1) * 100 : (lowerIsBetter ? (current <= target ? 100 : 0) : (current >= target ? 100 : 0));
    var d = decimals == null ? 0 : decimals;
    return {
      baseline: U.round(baseline, d),
      current: U.round(current, d),
      target: U.round(target, d),
      unit: unit || "",
      pct: Math.round(pct),
      met: lowerIsBetter ? current <= target : current >= target
    };
  }

  function generate(ctx) {
    var attempts = ctx.attempts || [];
    var sessions = ctx.sessions || [];
    var records = ctx.records || [];
    var subjects = ctx.subjects || [];
    var recs = [];
    var latest = attempts[attempts.length - 1];
    var earlier = attempts.slice(0, -1);

    /* ---------- Time Management ---------- */
    if (attempts.length >= 2) {
      var tcAll = EA().typeComparison(attempts);
      var diff = tcAll.subjective.timeShare - tcAll.subjective.markShare;
      if (diff >= 8) {
        var base = EA().typeComparison(earlier).subjective;
        var cur = EA().typeComparison([latest]).subjective;
        recs.push({
          id: "tm-written-share",
          title: "Rebalance time towards the marks on offer",
          category: "Time Management",
          pattern: "Written (subjective) questions take a bigger share of your exam time than their share of the marks.",
          evidence: [
            "Across " + U.plural(attempts.length, "exam") + ", written questions used " + Math.round(tcAll.subjective.timeShare) + "% of answering time and carried " + Math.round(tcAll.subjective.markShare) + "% of marks.",
            "In your latest exam (" + latest.title + ") the share was " + Math.round(cur.timeShare) + "%."
          ],
          confidence: EA().confidence(attempts.length, U.sum(attempts, function (a) { return a.questions.length; }), attempts.length >= 5),
          action: "Before each written question, note a time budget in proportion to its marks (your last paper allowed " + U.plural(U.round(latest.allowedMs / 60000 / latest.totalMarks, 1), "minute") + " per mark: " + Math.round(latest.allowedMs / 60000) + " minutes for " + latest.totalMarks + " marks) and move on when it runs out.",
          target: "Written-question time share at or below " + Math.round(tcAll.subjective.markShare + 5) + "% for 3 exams in a row.",
          progress: progress(base.timeShare, cur.timeShare, tcAll.subjective.markShare + 5, true, "%"),
          rule: "Fires when written questions' share of answering time exceeds their share of marks by 8+ percentage points across at least 2 exams."
        });
      }
    }

    if (attempts.length >= 4) {
      var recent = attempts.slice(-3), older = attempts.slice(0, -3);
      function avgWritten(list) {
        var rows = EA().rows(list, "subjective").filter(function (x) { return x.answered; });
        return rows.length ? U.mean(rows, function (x) { return x.b.activeMs; }) : null;
      }
      function writtenScore(list) {
        var rows = EA().rows(list, "subjective");
        var total = U.sum(rows, function (x) { return x.q.marks; });
        return total ? U.pct(U.sum(rows, function (x) { return x.q.obtained; }), total) : null;
      }
      var recentAvg = avgWritten(recent), olderAvg = avgWritten(older);
      if (recentAvg && olderAvg && recentAvg >= olderAvg * 1.1) {
        var increase = U.pct(recentAvg - olderAvg, olderAvg);
        recs.push({
          id: "tm-written-pace",
          title: "Speed up written answers without losing quality",
          category: "Time Management",
          pattern: "You spend more time on written answers than in your earlier exams.",
          evidence: [
            "Average time per written answer in your last 3 exams: " + U.formatDuration(recentAvg) + ", which is " + Math.round(increase) + "% more than in your " + U.plural(older.length, "earlier exam") + " (" + U.formatDuration(olderAvg) + ").",
            "Written-answer marks: " + Math.round(writtenScore(recent)) + "% recently vs " + Math.round(writtenScore(older)) + "% earlier."
          ],
          confidence: EA().confidence(attempts.length, EA().rows(attempts, "subjective").length, increase >= 20),
          action: "Practise answering written questions with a time limit. Plan each answer in 1 minute (key points only) before writing.",
          target: "Reduce average answering time by 10% (to " + U.formatDuration(recentAvg * 0.9) + " or less) without reducing written-answer marks.",
          progress: progress(recentAvg / 1000, avgWritten([latest]) / 1000, (recentAvg * 0.9) / 1000, true, "s"),
          rule: "Fires when the average time per written answer in the last 3 exams is at least 10% higher than in earlier exams."
        });
      }
    }

    /* ---------- Examination Strategy ---------- */
    if (attempts.length >= 2) {
      var la = EA().lateAccuracy(attempts);
      if (la.lateN >= 4 && la.earlyN >= 6 && la.early - la.late >= 15) {
        var laLatest = EA().lateAccuracy([latest]);
        recs.push({
          id: "es-final-quarter",
          title: "Protect accuracy in the final quarter",
          category: "Examination Strategy",
          pattern: "Objective answers given late in the exam are less accurate.",
          evidence: [
            "Objective answers first given in the last 25% of the time: " + Math.round(la.late) + "% correct (" + la.lateN + " answers).",
            "Objective answers given earlier: " + Math.round(la.early) + "% correct (" + la.earlyN + " answers)."
          ],
          confidence: EA().confidence(attempts.length, la.lateN + la.earlyN, la.lateN >= 10),
          action: "Finish objective questions before the final quarter, or keep the last 5 minutes to re-check late objective answers.",
          target: "Final-quarter objective accuracy of " + Math.round(la.early - 10) + "% or higher across your next 3 exams.",
          progress: laLatest.late != null ? progress(la.late, laLatest.late, la.early - 10, false, "%") : null,
          rule: "Fires when final-quarter objective accuracy is 15+ points below earlier accuracy, with at least 4 late and 6 earlier answers."
        });
      }

      var co = EA().changeOutcomes(attempts);
      if (co.total >= 4 && co.rightToWrong > co.wrongToRight) {
        recs.push({
          id: "es-answer-changes",
          title: "Change answers only for a clear reason",
          category: "Examination Strategy",
          pattern: "Changed objective answers moved away from the correct option more often than towards it.",
          evidence: [
            co.rightToWrong + " changes went from correct to incorrect; " + co.wrongToRight + " went from incorrect to correct.",
            "Based on " + U.plural(co.total, "changed objective answer") + "."
          ],
          confidence: EA().confidence(attempts.length, co.total, co.total >= 10),
          action: "Only change an answer when you can name the specific error (for example, a misread word or a calculation slip).",
          target: "No more correct-to-incorrect changes than incorrect-to-correct changes over your next 3 exams.",
          progress: progress(co.wrongToRight - co.rightToWrong, (function () { var c = EA().changeOutcomes([latest]); return c.wrongToRight - c.rightToWrong; })(), 0, false, ""),
          rule: "Fires when 4+ objective answers were changed and correct-to-incorrect changes outnumber incorrect-to-correct ones."
        });
      }

      var r = EA().rows(attempts);
      var skipped = r.filter(function (x) { return x.b.skipped; });
      var returned = skipped.filter(function (x) { return x.b.visits > 1; });
      if (skipped.length >= 3 && returned.length < skipped.length) {
        var latestSkipped = EA().rows([latest]).filter(function (x) { return x.b.skipped; });
        recs.push({
          id: "es-skipped",
          title: "Return to every question you skip",
          category: "Examination Strategy",
          pattern: "Some questions you skipped were never opened again.",
          evidence: [
            "You returned to " + returned.length + " of " + U.plural(skipped.length, "skipped question") + " (" + Math.round(U.pct(returned.length, skipped.length)) + "%).",
            skipped.filter(function (x) { return !x.answered; }).length + " skipped questions were still blank at submission."
          ],
          confidence: EA().confidence(attempts.length, skipped.length, skipped.length >= 8),
          action: "Flag each question as you skip it. Clear the flagged list before reviewing anything else.",
          target: "Return to 100% of skipped questions before submitting.",
          progress: progress(U.pct(returned.length, skipped.length),
            latestSkipped.length ? U.pct(latestSkipped.filter(function (x) { return x.b.visits > 1; }).length, latestSkipped.length) : 100, 100, false, "%"),
          rule: "Fires when at least 3 questions were skipped and not all of them were revisited."
        });
      }
    }

    /* ---------- Study Consistency ---------- */
    if (sessions.length >= 5) {
      var sum = BB.studyAnalytics.summary(sessions);
      if (sum.daysPerWeek < 5) {
        var daily = BB.studyAnalytics.daily(sessions, 28);
        var gaps = 0, run = 0;
        daily.forEach(function (d) {
          if (!d.minutes) { run++; } else { if (run >= 2) gaps++; run = 0; }
        });
        if (run >= 2) gaps++;
        recs.push({
          id: "sc-days-per-week",
          title: "Study on more days, even briefly",
          category: "Study Consistency",
          pattern: "Your study is concentrated on fewer days per week than your goal.",
          evidence: [
            "You studied on " + sum.activeDays28 + " of the last 28 days (" + U.round(sum.daysPerWeek, 1) + " days per week on average).",
            gaps + " gaps of 2 or more days in a row in the last 4 weeks."
          ],
          confidence: sessionConfidence(sum.count, sum.count >= 15),
          action: "Add a short 20–30 minute session on days you'd usually skip. Schedule it in the Study Planner so it has a fixed time.",
          target: "Study on at least 5 days per week for the next 3 weeks.",
          progress: progress(sum.daysPerWeek, sum.last7Days, 5, false, " days", 1),
          rule: "Fires when the student studied on fewer than 5 days per week on average over the last 28 days."
        });
      }
    }

    /* ---------- Subject Improvement ---------- */
    var stats = BB.academic.subjectStats(attempts, records, subjects).filter(function (s) { return s.count >= 1 && s.avgScore != null; });
    if (stats.length >= 2) {
      var overall = U.mean(stats, function (s) { return s.avgScore; });
      var weakest = stats.slice().sort(function (a, b) { return a.avgScore - b.avgScore; })[0];
      if (overall - weakest.avgScore >= 5) {
        recs.push({
          id: "su-" + weakest.subject.toLowerCase().replace(/[^a-z]+/g, "-"),
          title: "Focused practice for " + weakest.subject,
          category: "Subject Improvement",
          pattern: weakest.subject + " is your lowest-scoring subject.",
          evidence: [
            weakest.subject + " average: " + Math.round(weakest.avgScore) + "% across " + U.plural(weakest.count, "exam") + ", compared with " + Math.round(overall) + "% across all subjects.",
            weakest.weakest ? "Lowest category: " + weakest.weakest.category + " (" + Math.round(weakest.weakest.pct) + "% of marks)." : "Category-level results aren't available for this subject."
          ],
          confidence: EA().confidence(weakest.count, weakest.count * 12, weakest.count >= 3),
          action: "Add two focused sessions per week for " + weakest.subject + (weakest.weakest ? ", starting with " + weakest.weakest.category : "") + ", and take one simulator exam in it every two weeks.",
          target: "Raise the " + weakest.subject + " average practice score from " + Math.round(weakest.avgScore) + "% to " + Math.round(weakest.avgScore + 8) + "%.",
          progress: progress(weakest.avgScore, weakest.latestScore, weakest.avgScore + 8, false, "%"),
          rule: "Fires for the subject whose average score is 5+ points below the average across subjects."
        });
      }
    }

    /* ---------- Focus Management ---------- */
    var rated = sessions.filter(function (s) { return s.focus; });
    if (rated.length >= 10) {
      var long = rated.filter(function (s) { return s.activeMinutes > 75; });
      var short = rated.filter(function (s) { return s.activeMinutes <= 45; });
      var night = rated.filter(function (s) { return BB.demo.periodOf(s.startedAt) === "night"; });
      var other = rated.filter(function (s) { return BB.demo.periodOf(s.startedAt) !== "night"; });
      var candidates = [];
      if (long.length >= 5 && short.length >= 5) {
        candidates.push({ kind: "length", gap: U.mean(short, function (s) { return s.focus; }) - U.mean(long, function (s) { return s.focus; }), a: long, b: short });
      }
      if (night.length >= 5 && other.length >= 5) {
        candidates.push({ kind: "night", gap: U.mean(other, function (s) { return s.focus; }) - U.mean(night, function (s) { return s.focus; }), a: night, b: other });
      }
      candidates.sort(function (x, y) { return y.gap - x.gap; });
      var c = candidates[0];
      if (c && c.gap >= 0.4) {
        var aAvg = U.mean(c.a, function (s) { return s.focus; }), bAvg = U.mean(c.b, function (s) { return s.focus; });
        var focusTarget = U.round(Math.min(5, bAvg), 1);
        var recentGroup = c.a.slice(-3);
        recs.push({
          id: "fm-" + c.kind,
          title: c.kind === "night" ? "Move demanding study out of late-night sessions" : "Break up long sessions to protect focus",
          category: "Focus Management",
          pattern: c.kind === "night"
            ? "Your self-rated focus is lower in sessions after 9pm."
            : "Your self-rated focus is lower in sessions longer than 75 minutes.",
          evidence: [
            c.kind === "night"
              ? "Night sessions: average focus " + U.round(aAvg, 1) + "/5 (" + c.a.length + " sessions). Other times: " + U.round(bAvg, 1) + "/5 (" + c.b.length + " sessions)."
              : "Sessions over 75 minutes: average focus " + U.round(aAvg, 1) + "/5 (" + c.a.length + " sessions). Sessions of 45 minutes or less: " + U.round(bAvg, 1) + "/5 (" + c.b.length + " sessions).",
            "Focus ratings are your own 1–5 ratings recorded when each session ended."
          ],
          confidence: sessionConfidence(rated.length, Math.min(c.a.length, c.b.length) >= 8),
          action: c.kind === "night"
            ? "Schedule new or difficult topics before 9pm and keep late sessions for light review."
            : "Split long sessions into 30–40 minute blocks with a 5-minute break between them.",
          target: (c.kind === "night" ? "An average focus rating of " + focusTarget + "/5 or higher in sessions after 9pm" : "An average focus rating of " + focusTarget + "/5 or higher in sessions over 75 minutes") +
            ", matching your other sessions, over the next 3 weeks.",
          progress: progress(aAvg, U.mean(recentGroup, function (s) { return s.focus; }), focusTarget, false, "/5", 1),
          rule: "Fires when average focus differs by 0.4+ points between long and short sessions, or between night and other times (5+ rated sessions in each group)."
        });
      }
    }

    // Attach saved status
    var saved = BB.repo.recStatus();
    recs.forEach(function (rec) {
      var s = saved[rec.id];
      rec.status = s ? s.status : "not_started";
      rec.statusUpdatedAt = s ? s.updatedAt : null;
    });
    return recs;
  }

  /** Convenience: build from the current repo data. */
  function current() {
    return generate({
      attempts: BB.repo.attempts(),
      sessions: BB.repo.sessions(),
      records: BB.repo.records(),
      subjects: BB.repo.subjects()
    });
  }

  BB.recommend = {
    CATEGORIES: CATEGORIES,
    CATEGORY_ICONS: CATEGORY_ICONS,
    STATUSES: STATUSES,
    generate: generate,
    current: current,
    statusLabel: function (v) { var f = STATUSES.filter(function (s) { return s.value === v; })[0]; return f ? f.label : v; }
  };
})(window.BB = window.BB || {});
