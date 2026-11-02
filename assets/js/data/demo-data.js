/**
 * BB.demo — deterministic, illustrative demo data.
 *
 * Everything here is generated from a seed (the student's email), relative to
 * today's date, so numbers stay consistent across every page and every visit.
 * Generated exam attempts use exactly the same shape as attempts recorded by
 * the Examination Simulator, so analytics treats both identically.
 *
 * All of it is labelled "Demo data" in the UI and can be switched off in Settings.
 */
(function (BB) {
  "use strict";

  var U = BB.utils;

  var CATALOG = [
    "Mathematics", "Additional Mathematics", "Science", "Physics", "Chemistry", "Biology",
    "English", "Literature", "History", "Geography", "Computer Science", "Economics",
    "Business Studies", "Accounting", "Art & Design", "Modern Languages"
  ];
  // Subject colours: peach, teal, brain pink, honey, sky, lavender, sage, caramel
  var PALETTE = ["#f0804f", "#14b8a6", "#ec7f9c", "#f2b134", "#4fa3d9", "#9b87e0", "#6fb26a", "#c08552"];
  var DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English"];

  var EDUCATION_LEVELS = [
    { value: "primary", label: "Primary School", hint: "Ages 6–12" },
    { value: "secondary", label: "Secondary School", hint: "Ages 12–18" },
    { value: "college", label: "College", hint: "Diploma, foundation or pre-university" },
    { value: "university", label: "University", hint: "Undergraduate or postgraduate" }
  ];

  var GOALS = [
    { value: "exam-timing", label: "Manage exam time better", icon: "timer" },
    { value: "improve-scores", label: "Raise my scores", icon: "trending-up" },
    { value: "consistency", label: "Study more consistently", icon: "calendar" },
    { value: "understand-habits", label: "Understand how I study", icon: "brain" },
    { value: "reduce-careless", label: "Make fewer careless mistakes", icon: "target" },
    { value: "focus", label: "Stay focused for longer", icon: "zap" }
  ];

  function subjectsFor(user) {
    var list = user && user.subjects && user.subjects.length ? user.subjects : DEFAULT_SUBJECTS;
    return list.map(function (name, i) { return { name: name, color: PALETTE[i % PALETTE.length] }; });
  }
  function colorFor(user, name) {
    var found = subjectsFor(user).filter(function (s) { return s.name === name; })[0];
    return found ? found.color : PALETTE[U.hashString(name) % PALETTE.length];
  }

  function shuffle(r, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function ability(seed, subject) {
    var r = U.rng(seed ^ U.hashString(subject));
    return 0.56 + r() * 0.26; // 0.56 – 0.82
  }

  /* ------------------------------------------------------------------
   * Exam behaviour simulation (demo attempts)
   * ------------------------------------------------------------------ */
  var PAPER = [
    { type: "mcq", marks: 2 }, { type: "mcq", marks: 2 }, { type: "mcq", marks: 2 },
    { type: "mcq", marks: 2 }, { type: "mcq", marks: 2 }, { type: "mcq", marks: 2 },
    { type: "tf", marks: 1 }, { type: "tf", marks: 1 },
    { type: "short", marks: 3 }, { type: "short", marks: 3 },
    { type: "long", marks: 8 }, { type: "long", marks: 8 }
  ];
  var BASE_SECONDS = { mcq: 62, tf: 34, short: 175, long: 540 };

  function kindOf(type) { return type === "mcq" || type === "tf" ? "objective" : "subjective"; }

  function simulateAttempt(r, cfg) {
    var qs = cfg.questions;
    var allowed = cfg.allowedMs;
    var objIdx = [], subIdx = [];
    qs.forEach(function (q, i) { (q.kind === "objective" ? objIdx : subIdx).push(i); });
    var firstPass = cfg.style === "subjective-first" ? subIdx.concat(objIdx) : objIdx.concat(subIdx);

    // Phase 1 — plan visits with raw durations
    var plan = [];
    firstPass.forEach(function (i) {
      var q = qs[i];
      var base = BASE_SECONDS[q.type] * (0.6 + r() * 0.9);
      var skipP = q.type === "long" ? 0.2 : q.type === "short" ? 0.15 : 0.1;
      if (r() < skipP) plan.push({ q: i, dur: base * (0.25 + r() * 0.25), action: "skip", flag: r() < 0.5 });
      else plan.push({ q: i, dur: base, action: "answer" });
    });
    plan.filter(function (p) { return p.action === "skip"; }).forEach(function (p) {
      var q = qs[p.q];
      var base = BASE_SECONDS[q.type] * (0.5 + r() * 0.7);
      if (r() < 0.75) plan.push({ q: p.q, dur: base, action: "answer" });
      else plan.push({ q: p.q, dur: base * 0.3, action: "leave" });
    });
    var reviewable = objIdx.filter(function (i) { return plan.some(function (p) { return p.q === i && p.action === "answer"; }); });
    shuffle(r, reviewable).slice(0, 2 + Math.floor(r() * 3)).forEach(function (i) {
      plan.push({ q: i, dur: BASE_SECONDS[qs[i].type] * (0.3 + r() * 0.4), action: "review" });
    });

    // Phase 2 — scale to fit inside the allowed time
    var rawTotal = U.sum(plan, function (p) { return p.dur * 1000; });
    var target = allowed * (0.84 + r() * 0.14);
    var scale = rawTotal > target ? target / rawTotal : 1;

    // Phase 3 — timestamps, answers and correctness
    var t = 0;
    var lateCut = allowed * 0.75;
    var state = qs.map(function () {
      return { firstViewedAt: null, activeMs: 0, visits: 0, history: [], skipped: false, flagged: false };
    });
    var visits = [], events = [{ t: 0, type: "start", q: null }];

    function pObjective(q, at) {
      var p = cfg.ability + (q.type === "tf" ? 0.06 : 0) + (at > lateCut ? -0.24 : 0.04);
      return U.clamp(p, 0.08, 0.96);
    }

    plan.forEach(function (p) {
      var q = qs[p.q], s = state[p.q];
      var enter = t;
      var dur = Math.round(p.dur * 1000 * scale);
      t += dur;
      if (s.firstViewedAt == null) s.firstViewedAt = enter;
      s.visits++;
      s.activeMs += dur;
      visits.push({ q: p.q, enter: enter, leave: t });
      events.push({ t: enter, type: s.visits > 1 ? "revisit" : "view", q: p.q });
      var at = enter + Math.round(dur * 0.85);

      if (p.action === "answer") {
        var correct = q.kind === "objective" ? r() < pObjective(q, at) : null;
        s.history.push({ t: at, correct: correct });
        events.push({ t: at, type: "answer", q: p.q });
      } else if (p.action === "skip" || p.action === "leave") {
        s.skipped = true;
        events.push({ t: t, type: "skip", q: p.q });
        if (p.flag) { s.flagged = true; events.push({ t: enter + Math.round(dur * 0.5), type: "flag", q: p.q }); }
      } else if (p.action === "review" && s.history.length) {
        var prev = s.history[s.history.length - 1].correct;
        var changeP = prev ? 0.28 : 0.62;
        if (r() < changeP) {
          var next = prev ? false : r() < 0.5;
          s.history.push({ t: at, correct: next });
          events.push({ t: at, type: "change", q: p.q });
        }
      }
    });

    events.push({ t: t, type: "submit", q: null });

    var results = qs.map(function (q, i) {
      var s = state[i];
      var answered = s.history.length > 0;
      var obtained = 0, status = "unanswered";
      if (answered) {
        var lastAt = s.history[s.history.length - 1].t;
        if (q.kind === "objective") {
          var ok = s.history[s.history.length - 1].correct;
          obtained = ok ? q.marks : 0;
          status = ok ? "correct" : "incorrect";
        } else {
          var frac = U.clamp(cfg.ability - 0.12 + (r() - 0.5) * 0.42 + (lastAt > lateCut ? -0.1 : 0), 0.1, 1);
          obtained = Math.round(frac * q.marks);
          status = obtained / q.marks >= 0.5 ? "correct" : "incorrect";
        }
      }
      return {
        number: i + 1,
        type: q.type,
        kind: q.kind,
        marks: q.marks,
        category: q.category,
        obtained: obtained,
        status: status
      };
    });

    return {
      usedMs: t,
      questions: results,
      behaviour: {
        visits: visits,
        events: events.sort(function (a, b) { return a.t - b.t; }),
        perQuestion: state.map(function (s) {
          return {
            firstViewedAt: s.firstViewedAt,
            activeMs: s.activeMs,
            visits: s.visits,
            changes: Math.max(0, s.history.length - 1),
            history: s.history,
            skipped: s.skipped,
            revisited: s.visits > 1,
            answeredAt: s.history.length ? s.history[0].t : null,
            flagged: s.flagged
          };
        })
      }
    };
  }

  function generateAttempts(user, now) {
    var seed = U.hashString((user && user.email) || "demo");
    var subjects = subjectsFor(user).map(function (s) { return s.name; }).slice(0, 5);
    var daysAgo = [74, 66, 57, 49, 41, 33, 26, 19, 11, 4];
    var today = U.startOfDay(now || new Date());
    var attempts = [];

    daysAgo.forEach(function (d, idx) {
      var r = U.rng(seed + idx * 7919);
      var subject = subjects[idx % subjects.length];
      var bank = BB.questionBank && BB.questionBank.categoriesFor(subject);
      var cats = bank && bank.length ? bank : ["Section A", "Section B", "Section C"];
      var questions = PAPER.map(function (p, i) {
        return { type: p.type, kind: kindOf(p.type), marks: p.marks, category: cats[i % cats.length] };
      });
      var allowedMs = 35 * 60000;
      var startedAt = U.addDays(today, -d).getTime() + (15 + Math.floor(r() * 5)) * U.HOUR + Math.floor(r() * 50) * 60000;
      var sim = simulateAttempt(r, {
        questions: questions,
        allowedMs: allowedMs,
        ability: U.clamp(ability(seed, subject) + idx * 0.012, 0.4, 0.92),
        style: r() < 0.45 ? "subjective-first" : "in-order"
      });
      var total = U.sum(sim.questions, function (q) { return q.marks; });
      var obtained = U.sum(sim.questions, function (q) { return q.obtained; });
      attempts.push({
        id: "demo-att-" + (idx + 1),
        source: "demo",
        subject: subject,
        title: subject + " practice paper " + (Math.floor(idx / subjects.length) + 1),
        categories: cats,
        startedAt: startedAt,
        submittedAt: startedAt + sim.usedMs,
        allowedMs: allowedMs,
        usedMs: sim.usedMs,
        totalMarks: total,
        obtainedMarks: obtained,
        scorePct: U.round(U.pct(obtained, total), 1),
        submittedBy: "student",
        questions: sim.questions,
        behaviour: sim.behaviour
      });
    });
    return attempts;
  }

  /* ------------------------------------------------------------------
   * Study sessions
   * ------------------------------------------------------------------ */
  var PERIODS = [
    { key: "morning", label: "Morning", range: "5am – 12pm", from: 5, to: 12 },
    { key: "afternoon", label: "Afternoon", range: "12pm – 5pm", from: 12, to: 17 },
    { key: "evening", label: "Evening", range: "5pm – 9pm", from: 17, to: 21 },
    { key: "night", label: "Night", range: "9pm – 5am", from: 21, to: 29 }
  ];
  function periodOf(date) {
    var h = new Date(date).getHours();
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 17) return "afternoon";
    if (h >= 17 && h < 21) return "evening";
    return "night";
  }

  function generateSessions(user, now) {
    var seed = U.hashString(((user && user.email) || "demo") + ":study");
    var r = U.rng(seed);
    var subjects = subjectsFor(user).map(function (s) { return s.name; });
    var nowTs = (now || new Date()).getTime();
    var today = U.startOfDay(now || new Date());
    var sessions = [];
    var periodWeights = [["evening", 0.45], ["afternoon", 0.27], ["morning", 0.14], ["night", 0.14]];
    var periodHours = { morning: [7, 11], afternoon: [13, 16], evening: [17, 20], night: [21, 23] };
    var periodEffect = { morning: 0, afternoon: 1, evening: 4, night: -3 };
    var focusEffect = { morning: 0.1, afternoon: 0, evening: 0.3, night: -0.6 };
    var diffEffect = { easy: 8, medium: 0, hard: -11 };

    for (var d = 41; d >= 0; d--) {
      var day = U.addDays(today, -d);
      var weekday = day.getDay();
      var studyP = weekday === 0 || weekday === 6 ? 0.55 : 0.78;
      if (r() > studyP) continue;
      var count = r() < 0.3 ? 2 : 1;
      for (var c = 0; c < count; c++) {
        var roll = r(), acc = 0, period = "evening";
        for (var w = 0; w < periodWeights.length; w++) {
          acc += periodWeights[w][1];
          if (roll <= acc) { period = periodWeights[w][0]; break; }
        }
        var hrs = periodHours[period];
        var start = new Date(day);
        start.setHours(hrs[0] + Math.floor(r() * (hrs[1] - hrs[0] + 1)), Math.floor(r() * 4) * 15, 0, 0);
        var active = 25 + Math.round((r() * 85) / 5) * 5;
        if (start.getTime() + active * 60000 > nowTs) continue;
        var subject = subjects[Math.floor(r() * subjects.length)];
        var breaks = Math.floor(active / 35 + r());
        var focus = Math.round(U.clamp(3.5 + focusEffect[period] + (r() - 0.5) * 2, 1, 5));
        var session = {
          id: "demo-ses-" + sessions.length,
          source: "demo",
          subject: subject,
          startedAt: start.getTime(),
          activeMinutes: active,
          pausedMinutes: breaks * (4 + Math.floor(r() * 6)),
          breaks: breaks,
          focus: focus,
          outcome: null
        };
        if (r() < 0.78) {
          var diffRoll = r();
          var difficulty = diffRoll < 0.3 ? "easy" : diffRoll < 0.75 ? "medium" : "hard";
          var accuracy = U.clamp(Math.round(ability(seed, subject) * 100 + periodEffect[period] + diffEffect[difficulty] + (r() - 0.5) * 16), 20, 100);
          var outcome = { accuracy: accuracy, difficulty: difficulty, retention: null };
          if (d > 7 && r() < 0.45) outcome.retention = U.clamp(Math.round(accuracy - (5 + r() * 13)), 10, 100);
          session.outcome = outcome;
        }
        sessions.push(session);
      }
    }
    return sessions;
  }

  /* ------------------------------------------------------------------
   * Planner seed, upcoming exams, notifications
   * ------------------------------------------------------------------ */
  function seedTasks(user, now) {
    var subjects = subjectsFor(user).map(function (s) { return s.name; });
    var today = U.startOfDay(now || new Date());
    function at(dayOffset, h, m) { var d = U.addDays(today, dayOffset); d.setHours(h, m || 0, 0, 0); return d; }
    var s = function (i) { return subjects[i % subjects.length]; };
    var items = [
      [-2, 17, 0, 60, s(0), "Past-paper questions: section A", true],
      [-1, 18, 30, 45, s(1), "Review lesson notes and make flashcards", true],
      [0, 16, 0, 60, s(0), "Timed practice: two long-answer questions", false],
      [0, 19, 30, 40, s(2), "Summarise this week's topic", false],
      [1, 17, 0, 50, s(1), "Practise calculation questions", false],
      [2, 18, 0, 45, s(3 % subjects.length), "Self-quiz with flashcards", false],
      [3, 16, 30, 60, s(4 % subjects.length), "Write and time one essay plan", false],
      [5, 10, 0, 90, s(0), "Full practice paper under exam conditions", false]
    ];
    return items.map(function (it, i) {
      var start = at(it[0], it[1], it[2]);
      var end = new Date(start.getTime() + it[3] * 60000);
      return {
        id: "task-seed-" + i,
        title: it[5],
        subject: it[4],
        date: U.dateKey(start),
        start: U.timeKey(start),
        end: U.timeKey(end),
        duration: it[3],
        completed: it[6],
        reminder: !it[6],
        source: "demo"
      };
    });
  }

  function seedUpcomingExams(user, now) {
    var subjects = subjectsFor(user).map(function (s) { return s.name; });
    var today = U.startOfDay(now || new Date());
    return [
      { id: "exam-seed-1", subject: subjects[0], title: "Mid-term examination", date: U.dateKey(U.addDays(today, 6)), time: "09:00", source: "demo" },
      { id: "exam-seed-2", subject: subjects[1 % subjects.length], title: "Topic test", date: U.dateKey(U.addDays(today, 13)), time: "10:30", source: "demo" },
      { id: "exam-seed-3", subject: subjects[2 % subjects.length], title: "Practical assessment", date: U.dateKey(U.addDays(today, 24)), time: "08:30", source: "demo" }
    ];
  }

  function notifications(user, now) {
    var n = (now || new Date()).getTime();
    var subjects = subjectsFor(user).map(function (s) { return s.name; });
    return [
      { id: "n1", icon: "sparkles", title: "New recommendation", body: "Your latest exam data produced a time-management suggestion.", at: n - 2 * U.HOUR, href: "recommendations.html", unread: true },
      { id: "n2", icon: "calendar", title: subjects[0] + " exam in 6 days", body: "Your planner has 3 sessions scheduled before it.", at: n - 5 * U.HOUR, href: "planner.html", unread: true },
      { id: "n3", icon: "clock", title: "Study session reminder", body: "Timed practice starts at 4:00 pm today.", at: n - 26 * U.HOUR, href: "planner.html", unread: false },
      { id: "n4", icon: "file", title: "Weekly report ready", body: "Your progress report for last week is ready to preview.", at: n - 3 * U.DAY, href: "reports.html", unread: false }
    ];
  }

  BB.demo = {
    CATALOG: CATALOG,
    PALETTE: PALETTE,
    DEFAULT_SUBJECTS: DEFAULT_SUBJECTS,
    EDUCATION_LEVELS: EDUCATION_LEVELS,
    GOALS: GOALS,
    PERIODS: PERIODS,
    periodOf: periodOf,
    kindOf: kindOf,
    subjectsFor: subjectsFor,
    colorFor: colorFor,
    generateAttempts: generateAttempts,
    generateSessions: generateSessions,
    seedTasks: seedTasks,
    seedUpcomingExams: seedUpcomingExams,
    notifications: notifications,
    educationLabel: function (value) {
      var f = EDUCATION_LEVELS.filter(function (l) { return l.value === value; })[0];
      return f ? f.label : "Not set";
    },
    goalLabel: function (value) {
      var f = GOALS.filter(function (g) { return g.value === value; })[0];
      return f ? f.label : value;
    }
  };
})(window.BB = window.BB || {});
