/**
 * BB.studyAnalytics — pure functions over study sessions.
 *
 * Best-study-time analysis compares practice results ("outcomes") across
 * periods of the day AFTER adjusting for subject and question difficulty,
 * so a period isn't favoured just because easier subjects were studied then.
 * Session length is shown but never assumed to make a session better.
 */
(function (BB) {
  "use strict";

  var U = BB.utils;
  var MIN_OBS = 6;        // outcomes needed in a period to compare it at all
  var STRONG_OBS = 12;    // outcomes needed in both compared periods for a "supported" result
  var MIN_DIFF = 3;       // adjusted-accuracy points below which periods count as no different

  function lastNDays(sessions, n, now) {
    var from = U.addDays(U.startOfDay(now || new Date()), -(n - 1)).getTime();
    return sessions.filter(function (s) { return s.startedAt >= from; });
  }

  function summary(sessions, now) {
    now = now || new Date();
    var total = U.sum(sessions, function (s) { return s.activeMinutes; });
    var breaks = U.sum(sessions, function (s) { return s.breaks; });
    var focusRated = sessions.filter(function (s) { return s.focus; });
    var last28 = lastNDays(sessions, 28, now);
    var days28 = {};
    last28.forEach(function (s) { days28[U.dateKey(s.startedAt)] = true; });
    var last7 = lastNDays(sessions, 7, now);
    var prev7 = sessions.filter(function (s) {
      var from = U.addDays(U.startOfDay(now), -13).getTime(), to = U.addDays(U.startOfDay(now), -6).getTime();
      return s.startedAt >= from && s.startedAt < to;
    });

    // Current streak (consecutive days with a session, ending today or yesterday)
    var daySet = {};
    sessions.forEach(function (s) { daySet[U.dateKey(s.startedAt)] = true; });
    var streak = 0;
    var cursor = U.startOfDay(now);
    if (!daySet[U.dateKey(cursor)]) cursor = U.addDays(cursor, -1);
    while (daySet[U.dateKey(cursor)]) { streak++; cursor = U.addDays(cursor, -1); }

    var byPeriod = U.groupBy(sessions, function (s) { return BB.demo.periodOf(s.startedAt); });
    var mostActive = null;
    Object.keys(byPeriod).forEach(function (k) {
      var m = U.sum(byPeriod[k], function (s) { return s.activeMinutes; });
      if (!mostActive || m > mostActive.minutes) mostActive = { key: k, minutes: m, count: byPeriod[k].length };
    });

    return {
      count: sessions.length,
      totalMinutes: total,
      avgMinutes: sessions.length ? total / sessions.length : 0,
      breaksPerHour: total ? breaks / (total / 60) : 0,
      avgBreaks: sessions.length ? breaks / sessions.length : 0,
      avgFocus: focusRated.length ? U.mean(focusRated, function (s) { return s.focus; }) : null,
      daysPerWeek: Object.keys(days28).length / 4,
      activeDays28: Object.keys(days28).length,
      last7Minutes: U.sum(last7, function (s) { return s.activeMinutes; }),
      prev7Minutes: U.sum(prev7, function (s) { return s.activeMinutes; }),
      last7Days: Object.keys(last7.reduce(function (acc, s) { acc[U.dateKey(s.startedAt)] = 1; return acc; }, {})).length,
      streak: streak,
      mostActivePeriod: mostActive
    };
  }

  function bySubject(sessions) {
    var g = U.groupBy(sessions, function (s) { return s.subject; });
    return Object.keys(g).map(function (k) {
      return { subject: k, minutes: U.sum(g[k], function (s) { return s.activeMinutes; }), count: g[k].length };
    }).sort(function (a, b) { return b.minutes - a.minutes; });
  }

  function focusDistribution(sessions) {
    var d = [0, 0, 0, 0, 0];
    sessions.forEach(function (s) { if (s.focus >= 1 && s.focus <= 5) d[s.focus - 1]++; });
    return d;
  }

  function daily(sessions, days, now) {
    var today = U.startOfDay(now || new Date());
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = U.addDays(today, -i);
      var k = U.dateKey(d);
      out.push({ date: d, key: k, minutes: U.sum(sessions.filter(function (s) { return U.dateKey(s.startedAt) === k; }), function (s) { return s.activeMinutes; }) });
    }
    return out;
  }

  /** weeks × 7 grid (Mon–Sun), oldest week first. */
  function heatmap(sessions, weeks, now) {
    var start = U.addDays(U.startOfWeek(now || new Date()), -(weeks - 1) * 7);
    var todayKey = U.dateKey(now || new Date());
    var grid = [];
    for (var w = 0; w < weeks; w++) {
      var row = [];
      for (var d = 0; d < 7; d++) {
        var date = U.addDays(start, w * 7 + d);
        var k = U.dateKey(date);
        var list = sessions.filter(function (s) { return U.dateKey(s.startedAt) === k; });
        row.push({ date: date, key: k, minutes: U.sum(list, function (s) { return s.activeMinutes; }), count: list.length, future: k > todayKey });
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Adjusted accuracy residual for each session with an outcome:
   * accuracy − the student's mean accuracy for the same subject AND difficulty
   * (falls back to subject mean, then overall mean, when a group is too small).
   */
  function residuals(sessions) {
    var withOutcome = sessions.filter(function (s) { return s.outcome && s.outcome.accuracy != null; });
    var overall = U.mean(withOutcome, function (s) { return s.outcome.accuracy; });
    var bySubDiff = U.groupBy(withOutcome, function (s) { return s.subject + "|" + s.outcome.difficulty; });
    var bySub = U.groupBy(withOutcome, function (s) { return s.subject; });
    return withOutcome.map(function (s) {
      var g = bySubDiff[s.subject + "|" + s.outcome.difficulty];
      var base = g && g.length >= 2 ? U.mean(g, function (x) { return x.outcome.accuracy; })
        : bySub[s.subject] && bySub[s.subject].length >= 2 ? U.mean(bySub[s.subject], function (x) { return x.outcome.accuracy; })
          : overall;
      return { session: s, residual: s.outcome.accuracy - base };
    });
  }

  function periodComparison(sessions) {
    var res = residuals(sessions);
    var periods = BB.demo.PERIODS.map(function (p) {
      var list = sessions.filter(function (s) { return BB.demo.periodOf(s.startedAt) === p.key; });
      var outcomes = res.filter(function (r) { return BB.demo.periodOf(r.session.startedAt) === p.key; });
      var retention = list.filter(function (s) { return s.outcome && s.outcome.retention != null; });
      var focusList = list.filter(function (s) { return s.focus; });
      var subjects = {};
      list.forEach(function (s) { subjects[s.subject] = true; });
      var diffMix = U.groupBy(outcomes, function (r) { return r.session.outcome.difficulty; });
      return {
        key: p.key,
        label: p.label,
        range: p.range,
        count: list.length,
        minutes: U.sum(list, function (s) { return s.activeMinutes; }),
        avgDuration: list.length ? U.mean(list, function (s) { return s.activeMinutes; }) : null,
        avgFocus: focusList.length ? U.mean(focusList, function (s) { return s.focus; }) : null,
        outcomes: outcomes.length,
        rawAccuracy: outcomes.length ? U.mean(outcomes, function (r) { return r.session.outcome.accuracy; }) : null,
        adjusted: outcomes.length ? U.mean(outcomes, function (r) { return r.residual; }) : null,
        retention: retention.length >= 4 ? U.mean(retention, function (s) { return s.outcome.retention; }) : null,
        retentionN: retention.length,
        subjects: Object.keys(subjects).length,
        hardShare: outcomes.length ? U.pct((diffMix.hard || []).length, outcomes.length) : null
      };
    });

    var eligible = periods.filter(function (p) { return p.outcomes >= MIN_OBS; })
      .sort(function (a, b) { return b.adjusted - a.adjusted; });

    var verdict;
    if (eligible.length < 2) {
      verdict = {
        status: "insufficient",
        label: "Insufficient data",
        message: "There aren't enough comparable sessions yet. A comparison needs at least " + MIN_OBS +
          " sessions with a practice result in at least two periods of the day. Periods with enough data so far: " +
          (eligible.length ? eligible[0].label : "none") + "."
      };
    } else {
      var best = eligible[0], next = eligible[1];
      var diff = best.adjusted - next.adjusted;
      if (diff < MIN_DIFF) {
        verdict = {
          status: "no-difference",
          label: "No clear difference",
          best: null,
          message: "Practice results were similar across " + eligible.map(function (p) { return p.label.toLowerCase(); }).join(", ") +
            " once subject and difficulty are taken into account (the largest gap is " + U.round(diff, 1) + " points)."
        };
      } else {
        var strong = best.outcomes >= STRONG_OBS && next.outcomes >= STRONG_OBS && diff >= 5;
        verdict = {
          status: strong ? "supported" : "preliminary",
          label: strong ? "Supported by your data" : "Preliminary",
          best: best,
          next: next,
          diff: diff,
          message: best.label + " sessions were followed by practice results " + fmtSigned(best.adjusted) + " points relative to your usual for the same subject and difficulty (" +
            U.plural(best.outcomes, "session") + "), compared with " + next.label.toLowerCase() + " at " + fmtSigned(next.adjusted) + " (" + U.plural(next.outcomes, "session") + ")." +
            (strong ? "" : " Treat this as preliminary: more sessions are needed in both periods before relying on it.")
        };
      }
      // Secondary evidence notes
      var notes = [];
      if (verdict.best && verdict.best.avgFocus != null && verdict.next.avgFocus != null) {
        notes.push("Average focus rating: " + U.round(verdict.best.avgFocus, 1) + " in the " + verdict.best.label.toLowerCase() + " vs " + U.round(verdict.next.avgFocus, 1) + " in the " + verdict.next.label.toLowerCase() + ".");
      }
      if (verdict.best && verdict.best.retention != null && verdict.next.retention != null) {
        notes.push("Delayed retention checks (7+ days later): " + Math.round(verdict.best.retention) + "% vs " + Math.round(verdict.next.retention) + "%.");
      } else {
        notes.push("Delayed retention isn't available for enough sessions in these periods to compare.");
      }
      verdict.notes = notes;
    }

    return { periods: periods, verdict: verdict, thresholds: { MIN_OBS: MIN_OBS, STRONG_OBS: STRONG_OBS, MIN_DIFF: MIN_DIFF } };
  }

  function durationVsAccuracy(sessions) {
    var pts = sessions.filter(function (s) { return s.outcome; }).map(function (s) { return { x: s.activeMinutes, y: s.outcome.accuracy }; });
    var r = U.correlation(pts.map(function (p) { return p.x; }), pts.map(function (p) { return p.y; }));
    var n = pts.length;
    var strength = r == null || n < 10 ? "not enough data to judge"
      : Math.abs(r) < 0.1 ? "no meaningful relationship"
        : Math.abs(r) < 0.3 ? "a weak relationship"
          : Math.abs(r) < 0.5 ? "a moderate relationship" : "a fairly strong relationship";
    var direction = r == null ? "" : r > 0 ? "longer sessions tended to have higher practice results" : "longer sessions tended to have lower practice results";
    return { points: pts, r: r, n: n, strength: strength, direction: direction };
  }

  function fmtSigned(n) { return (n >= 0 ? "+" : "−") + Math.abs(U.round(n, 1)); }

  BB.studyAnalytics = {
    summary: summary,
    bySubject: bySubject,
    focusDistribution: focusDistribution,
    daily: daily,
    heatmap: heatmap,
    periodComparison: periodComparison,
    durationVsAccuracy: durationVsAccuracy,
    lastNDays: lastNDays,
    fmtSigned: fmtSigned
  };
})(window.BB = window.BB || {});
