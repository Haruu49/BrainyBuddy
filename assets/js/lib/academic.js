/**
 * BB.academic — subject-level performance shared by Dashboard, Subjects, Reports and Recommendations.
 * Combines simulator/demo attempts with imported historical records (CSV).
 */
(function (BB) {
  "use strict";

  var U = BB.utils;

  /** Group imported question-type rows into exam-level results. */
  function recordExams(records) {
    var g = U.groupBy(records, function (r) { return r.subject + "|" + r.examName + "|" + r.examDate; });
    return Object.keys(g).map(function (k) {
      var rows = g[k];
      var obtained = U.sum(rows, function (r) { return r.marksObtained; });
      var total = U.sum(rows, function (r) { return r.totalMarks; });
      var timed = rows.filter(function (r) { return r.timeSpent != null; });
      return {
        id: "rec-" + U.hashString(k).toString(36),
        source: "imported",
        subject: rows[0].subject,
        title: rows[0].examName,
        date: U.parseDateKey(rows[0].examDate).getTime(),
        obtained: obtained,
        total: total,
        scorePct: total ? U.round(U.pct(obtained, total), 1) : null,
        rows: rows,
        timeRecorded: timed.length === rows.length,
        timeMinutes: timed.length ? U.sum(timed, function (r) { return r.timeSpent; }) : null
      };
    }).sort(function (a, b) { return a.date - b.date; });
  }

  /** Unified list of exam results: { subject, title, date, scorePct, source }. */
  function results(attempts, records) {
    var list = attempts.map(function (a) {
      return { id: a.id, subject: a.subject, title: a.title, date: a.startedAt, scorePct: a.scorePct, source: a.source, obtained: a.obtainedMarks, total: a.totalMarks };
    }).concat(recordExams(records || []).map(function (r) {
      return { id: r.id, subject: r.subject, title: r.title, date: r.date, scorePct: r.scorePct, source: "imported", obtained: r.obtained, total: r.total };
    }));
    return list.filter(function (r) { return r.scorePct != null; }).sort(function (a, b) { return a.date - b.date; });
  }

  function subjectStats(attempts, records, subjects) {
    var all = results(attempts, records);
    var names = subjects.map(function (s) { return s.name; });
    all.forEach(function (r) { if (names.indexOf(r.subject) === -1) names.push(r.subject); });
    return names.map(function (name) {
      var list = all.filter(function (r) { return r.subject === name; });
      var subjectAttempts = attempts.filter(function (a) { return a.subject === name; });
      var cats = categoryScores(subjectAttempts);
      var first = list[0], last = list[list.length - 1];
      return {
        subject: name,
        color: BB.repo.subjectColor(name),
        count: list.length,
        avgScore: list.length ? U.mean(list, function (r) { return r.scorePct; }) : null,
        latestScore: last ? last.scorePct : null,
        trend: list.length >= 2 ? last.scorePct - first.scorePct : null,
        lastDate: last ? last.date : null,
        categories: cats,
        weakest: cats.length ? cats.slice().sort(function (a, b) { return a.pct - b.pct; })[0] : null,
        strongest: cats.length ? cats.slice().sort(function (a, b) { return b.pct - a.pct; })[0] : null
      };
    });
  }

  function categoryScores(attempts) {
    var acc = {};
    attempts.forEach(function (a) {
      a.questions.forEach(function (q) {
        var c = q.category || "General";
        acc[c] = acc[c] || { obtained: 0, total: 0 };
        acc[c].obtained += q.obtained;
        acc[c].total += q.marks;
      });
    });
    return Object.keys(acc).map(function (c) {
      return { category: c, pct: U.pct(acc[c].obtained, acc[c].total), obtained: acc[c].obtained, total: acc[c].total };
    });
  }

  function accuracy(attempts) {
    var answered = 0, correct = 0;
    attempts.forEach(function (a) {
      a.questions.forEach(function (q) {
        if (q.status === "unanswered") return;
        answered++;
        if (q.status === "correct") correct++;
      });
    });
    return answered ? U.pct(correct, answered) : null;
  }

  BB.academic = {
    recordExams: recordExams,
    results: results,
    subjectStats: subjectStats,
    categoryScores: categoryScores,
    accuracy: accuracy
  };
})(window.BB = window.BB || {});
