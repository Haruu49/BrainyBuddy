/**
 * BB.ExamTracker — records answering behaviour during a simulator exam.
 *
 * Timing model (non-overlapping by construction):
 *   • Exactly one question can be "active" at a time (t.activeQ).
 *   • Moving to another question ALWAYS closes the current visit first
 *     (adds now − activeSince to that question), then opens the next one.
 *   • When the tab is hidden the active visit is closed; it re-opens when the
 *     tab is visible again (as a "resumed" segment that isn't counted as a revisit).
 *   • After a refresh, an orphaned active visit is closed at the last autosave
 *     time (savedAt), so time while the page was closed is never attributed.
 *
 * All timestamps in the exported attempt are offsets in ms from the exam start.
 * The whole state object is plain JSON so it can be autosaved to storage.
 */
(function (BB) {
  "use strict";

  function createState(cfg, now) {
    return {
      id: "sim-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      subject: cfg.subject,
      title: cfg.title,
      categories: cfg.categories,
      types: cfg.types,
      questionIds: cfg.questionIds,
      startedAt: now,
      allowedMs: cfg.allowedMs,
      deadline: now + cfg.allowedMs,
      current: 0,
      answers: {},
      flags: {},
      t: {
        activeQ: null,
        activeSince: null,
        segmentResumed: false,
        pausedQ: null,
        per: cfg.questionIds.map(function () {
          return { firstViewedAt: null, activeMs: 0, visits: 0, history: [], skipped: false, everFlagged: false };
        }),
        visits: [],
        events: [],
        navOrder: []
      },
      savedAt: now
    };
  }

  function ExamTracker(state, questions, clock) {
    this.s = state;
    this.q = questions;
    this.now = clock || function () { return Date.now(); };
  }

  ExamTracker.create = function (cfg, questions, clock) {
    var now = (clock || Date.now)();
    return new ExamTracker(createState(cfg, now), questions, clock);
  };

  var P = ExamTracker.prototype;

  P.offset = function (ts) { return Math.max(0, ts - this.s.startedAt); };
  P.event = function (type, q, extra, ts) {
    var e = { t: this.offset(ts == null ? this.now() : ts), type: type, q: q == null ? null : q };
    if (extra) e.detail = extra;
    this.s.t.events.push(e);
  };
  P.isText = function (i) { var type = this.q[i].type; return type === "short" || type === "long"; };
  P.lastValue = function (i) {
    var h = this.s.t.per[i].history;
    return h.length ? h[h.length - 1].value : "";
  };
  P.hasAnswer = function (i) {
    var v = this.s.answers[i];
    return v != null && String(v).trim() !== "";
  };

  P._open = function (i, resumed, ts) {
    var t = this.s.t;
    var now = ts == null ? this.now() : ts;
    t.activeQ = i;
    t.activeSince = now;
    t.segmentResumed = !!resumed;
    this.s.current = i;
    if (!resumed) {
      var p = t.per[i];
      p.visits++;
      if (p.firstViewedAt == null) p.firstViewedAt = this.offset(now);
      t.navOrder.push(i);
      this.event(p.visits > 1 ? "revisit" : "view", i, null, now);
    }
  };

  P._close = function (ts) {
    var t = this.s.t;
    if (t.activeQ == null) return;
    var now = ts == null ? this.now() : ts;
    var since = t.activeSince == null ? now : t.activeSince;
    var dur = Math.max(0, now - since);
    t.per[t.activeQ].activeMs += dur;
    t.visits.push({ q: t.activeQ, enter: this.offset(since), leave: this.offset(now), resumed: t.segmentResumed });
    t.activeQ = null;
    t.activeSince = null;
    t.segmentResumed = false;
  };

  P.start = function () {
    this.event("start", null);
    this._open(0, false);
  };

  /** After a page reload. */
  P.resume = function () {
    var t = this.s.t;
    var now = this.now();
    if (t.activeQ != null) {
      // Close the orphaned visit at the last known autosave, never later than now.
      this._close(Math.min(this.s.savedAt || now, now));
    }
    var target = t.pausedQ != null ? t.pausedQ : this.s.current;
    t.pausedQ = null;
    this.event("resume", target);
    this._open(target, true);
  };

  P.goTo = function (i) {
    var t = this.s.t;
    if (i < 0 || i >= this.q.length) return;
    if (t.pausedQ != null) this.unpause();
    if (t.activeQ === i) return;
    var leaving = t.activeQ;
    if (leaving != null) {
      if (this.isText(leaving)) this.commitText(leaving);
      if (!this.hasAnswer(leaving)) {
        t.per[leaving].skipped = true;
        this.event("skip", leaving);
      }
      this._close();
    }
    this._open(i, false);
  };

  /** Objective answers are committed immediately. */
  P.setAnswer = function (i, value) {
    var p = this.s.t.per[i];
    this.s.answers[i] = value;
    var v = String(value);
    if (v === String(this.lastValue(i))) return;
    var hadAnswer = p.history.some(function (h) { return h.value !== ""; });
    p.history.push({ t: this.offset(this.now()), value: v });
    this.event(hadAnswer ? "change" : "answer", i);
  };

  /** Text answers update a draft while typing… */
  P.setDraft = function (i, value) { this.s.answers[i] = value; };

  /** …and are committed when the student leaves the field or the question. */
  P.commitText = function (i) {
    if (i == null || !this.isText(i)) return;
    var p = this.s.t.per[i];
    var v = String(this.s.answers[i] || "").trim();
    var last = String(this.lastValue(i) || "").trim();
    if (v === last) return;
    var hadAnswer = p.history.some(function (h) { return h.value !== ""; });
    p.history.push({ t: this.offset(this.now()), value: v });
    if (v === "") this.event("clear", i);
    else this.event(hadAnswer ? "change" : "answer", i);
  };

  P.clearAnswer = function (i) {
    this.s.answers[i] = "";
    var p = this.s.t.per[i];
    if (this.lastValue(i) !== "" && p.history.length) {
      p.history.push({ t: this.offset(this.now()), value: "" });
      this.event("clear", i);
    }
  };

  P.toggleFlag = function (i) {
    var on = !this.s.flags[i];
    this.s.flags[i] = on;
    if (on) this.s.t.per[i].everFlagged = true;
    this.event(on ? "flag" : "unflag", i);
    return on;
  };

  P.pause = function () {
    var t = this.s.t;
    if (t.activeQ == null) return;
    if (this.isText(t.activeQ)) this.commitText(t.activeQ);
    t.pausedQ = t.activeQ;
    this._close();
    this.event("hidden", t.pausedQ);
  };

  P.unpause = function () {
    var t = this.s.t;
    if (t.pausedQ == null) return;
    var q = t.pausedQ;
    t.pausedQ = null;
    this.event("visible", q);
    this._open(q, true);
  };

  P.finish = function (reason) {
    var t = this.s.t;
    var now = Math.min(this.now(), this.s.deadline + 1000);
    if (t.activeQ != null && this.isText(t.activeQ)) this.commitText(t.activeQ);
    if (t.pausedQ != null) t.pausedQ = null;
    this._close(now);
    this.s.submittedAt = now;
    this.s.submittedBy = reason || "student";
    this.event("submit", null, { reason: this.s.submittedBy }, now);
  };

  /** Totals for the live UI. */
  P.counts = function () {
    var self = this, answered = 0, flagged = 0;
    this.q.forEach(function (q, i) {
      if (self.hasAnswer(i)) answered++;
      if (self.s.flags[i]) flagged++;
    });
    return { answered: answered, flagged: flagged, unanswered: this.q.length - answered, total: this.q.length };
  };

  /** Live active time for question i, including the open visit. */
  P.activeTime = function (i) {
    var t = this.s.t;
    var ms = t.per[i].activeMs;
    if (t.activeQ === i && t.activeSince != null) ms += Math.max(0, this.now() - t.activeSince);
    return ms;
  };

  /** Build the stored attempt (same shape as demo attempts) with grading. */
  P.toAttempt = function () {
    var s = this.s, QB = BB.questionBank, self = this;
    var questions = this.q.map(function (q, i) {
      var ans = s.answers[i] == null ? "" : s.answers[i];
      var g = QB.grade(q, ans);
      return {
        number: i + 1, id: q.id, type: q.type, kind: q.kind, marks: q.marks, category: q.category,
        obtained: g.obtained, status: g.status, method: g.method, detail: g.detail || null,
        text: q.text, answer: ans, answerLabel: answerLabel(q, ans), correctLabel: correctLabel(q)
      };
    });
    var perQuestion = s.t.per.map(function (p, i) {
      var q = self.q[i];
      var firstIdx = -1;
      for (var k = 0; k < p.history.length; k++) { if (p.history[k].value !== "") { firstIdx = k; break; } }
      var h = firstIdx < 0 ? [] : p.history.slice(firstIdx);
      var nonEmpty = h.filter(function (x) { return x.value !== ""; });
      return {
        firstViewedAt: p.firstViewedAt,
        activeMs: p.activeMs,
        visits: p.visits,
        changes: Math.max(0, h.length - 1),
        history: nonEmpty.map(function (x) {
          return { t: x.t, correct: q.kind === "objective" ? QB.grade(q, x.value).status === "correct" : null };
        }),
        skipped: p.skipped,
        revisited: p.visits > 1,
        answeredAt: nonEmpty.length ? nonEmpty[0].t : null,
        flagged: !!(s.flags[i] || p.everFlagged)
      };
    });
    var total = questions.reduce(function (a, q) { return a + q.marks; }, 0);
    var obtained = questions.reduce(function (a, q) { return a + q.obtained; }, 0);
    var used = Math.min(s.allowedMs, Math.max(0, (s.submittedAt || this.now()) - s.startedAt));
    return {
      id: s.id,
      source: "simulator",
      subject: s.subject,
      title: s.title,
      categories: s.categories,
      types: s.types,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
      allowedMs: s.allowedMs,
      usedMs: used,
      totalMarks: total,
      obtainedMarks: obtained,
      scorePct: total ? Math.round((obtained / total) * 1000) / 10 : 0,
      submittedBy: s.submittedBy || "student",
      questions: questions,
      behaviour: {
        visits: s.t.visits.slice(),
        events: s.t.events.slice(),
        navOrder: s.t.navOrder.slice(),
        perQuestion: perQuestion
      }
    };
  };

  function answerLabel(q, ans) {
    if (ans == null || String(ans).trim() === "") return "";
    if (q.type === "mcq") return q.options[Number(ans)] || "";
    if (q.type === "tf") return String(ans) === "true" ? "True" : "False";
    return String(ans);
  }
  function correctLabel(q) {
    if (q.type === "mcq") return q.options[q.answer];
    if (q.type === "tf") return q.answer ? "True" : "False";
    if (q.type === "short") return q.accept ? q.accept[0] : String(q.numeric);
    return "Key ideas: " + q.keywords.map(function (g) { return g[0]; }).join(", ");
  }

  BB.ExamTracker = ExamTracker;
})(window.BB = window.BB || {});
