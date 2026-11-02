/**
 * BB.repo — the data-access layer.
 *
 * Pages never touch localStorage directly for app data; they call BB.repo.
 * Backend integration = re-implementing these functions against an API
 * (e.g. Supabase tables) with the same return shapes.
 *
 * Keys are namespaced per signed-in user: "u.<userId>.<collection>".
 */
(function (BB) {
  "use strict";

  var U = BB.utils;
  var cache = {};

  function user() { return BB.auth.currentUser(); }
  function key(name) {
    var u = user();
    return "u." + (u ? u.id : "anon") + "." + name;
  }
  function list(name) { return BB.store.get(key(name), []); }
  function saveList(name, items) { return BB.store.set(key(name), items); }

  function showDemo() {
    var u = user();
    return !(u && u.preferences && u.preferences.showDemoData === false);
  }

  function demoAttempts() {
    var u = user();
    var k = "att:" + (u && u.email) + ":" + (u && (u.subjects || []).join("|")) + ":" + U.dateKey(new Date());
    if (!cache[k]) cache[k] = BB.demo.generateAttempts(u, new Date());
    return cache[k];
  }
  function demoSessions() {
    var u = user();
    var k = "ses:" + (u && u.email) + ":" + (u && (u.subjects || []).join("|")) + ":" + U.dateKey(new Date());
    if (!cache[k]) cache[k] = BB.demo.generateSessions(u, new Date());
    return cache[k];
  }

  var repo = {
    user: user,
    showDemo: showDemo,

    subjects: function () { return BB.demo.subjectsFor(user()); },
    subjectColor: function (name) { return BB.demo.colorFor(user(), name); },

    /* ---------- Exam attempts ---------- */
    attempts: function (opts) {
      opts = opts || {};
      var own = list("attempts");
      var all = (showDemo() && opts.includeDemo !== false ? demoAttempts() : []).concat(own);
      return all.sort(function (a, b) { return a.startedAt - b.startedAt; });
    },
    attempt: function (id) {
      return repo.attempts().filter(function (a) { return a.id === id; })[0] || null;
    },
    saveAttempt: function (attempt) {
      var own = list("attempts").filter(function (a) { return a.id !== attempt.id; });
      own.push(attempt);
      return saveList("attempts", own);
    },
    deleteAttempt: function (id) {
      saveList("attempts", list("attempts").filter(function (a) { return a.id !== id; }));
    },

    /* Active (in-progress) exam — autosaved for refresh recovery */
    activeExam: function () { return BB.store.get(key("activeExam"), null); },
    saveActiveExam: function (state) { return BB.store.set(key("activeExam"), state); },
    clearActiveExam: function () { BB.store.remove(key("activeExam")); },

    /* ---------- Study sessions ---------- */
    sessions: function (opts) {
      opts = opts || {};
      var own = list("sessions");
      var all = (showDemo() && opts.includeDemo !== false ? demoSessions() : []).concat(own);
      return all.sort(function (a, b) { return a.startedAt - b.startedAt; });
    },
    saveSession: function (session) {
      var own = list("sessions").filter(function (s) { return s.id !== session.id; });
      own.push(session);
      return saveList("sessions", own);
    },
    deleteSession: function (id) {
      saveList("sessions", list("sessions").filter(function (s) { return s.id !== id; }));
    },
    activeStudy: function () { return BB.store.get(key("activeStudy"), null); },
    saveActiveStudy: function (state) { return BB.store.set(key("activeStudy"), state); },
    clearActiveStudy: function () { BB.store.remove(key("activeStudy")); },

    /* ---------- Planner ---------- */
    tasks: function () {
      var stored = BB.store.get(key("tasks"), null);
      if (stored === null) {
        stored = showDemo() ? BB.demo.seedTasks(user(), new Date()) : [];
        BB.store.set(key("tasks"), stored);
      }
      return stored;
    },
    saveTasks: function (tasks) { return BB.store.set(key("tasks"), tasks); },

    upcomingExams: function () {
      var stored = BB.store.get(key("upcomingExams"), null);
      if (stored === null) {
        stored = showDemo() ? BB.demo.seedUpcomingExams(user(), new Date()) : [];
        BB.store.set(key("upcomingExams"), stored);
      }
      return stored.slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    },
    saveUpcomingExams: function (exams) { return BB.store.set(key("upcomingExams"), exams); },

    /* ---------- Imported historical records (CSV) ---------- */
    records: function () { return list("records"); },
    saveRecords: function (records) { return saveList("records", records); },
    importBatches: function () { return list("importBatches"); },
    saveImportBatches: function (b) { return saveList("importBatches", b); },

    /* ---------- Recommendation progress ---------- */
    recStatus: function () { return BB.store.get(key("recStatus"), {}); },
    setRecStatus: function (id, status) {
      var all = repo.recStatus();
      all[id] = { status: status, updatedAt: Date.now() };
      BB.store.set(key("recStatus"), all);
      return all[id];
    },

    /* ---------- Notifications ---------- */
    notifications: function () {
      var read = BB.store.get(key("notifRead"), []);
      return (showDemo() ? BB.demo.notifications(user(), new Date()) : []).map(function (n) {
        if (read.indexOf(n.id) !== -1) n.unread = false;
        return n;
      });
    },
    markNotificationsRead: function () {
      BB.store.set(key("notifRead"), repo.notifications().map(function (n) { return n.id; }));
    },

    /* ---------- Data management ---------- */
    exportAll: function () {
      return {
        exportedAt: new Date().toISOString(),
        app: "Brainy Buddy (frontend demo)",
        profile: user(),
        examAttempts: list("attempts"),
        studySessions: list("sessions"),
        plannerTasks: repo.tasks(),
        upcomingExams: repo.upcomingExams(),
        importedRecords: repo.records(),
        recommendationProgress: repo.recStatus()
      };
    },
    resetUserData: function () {
      ["attempts", "activeExam", "sessions", "activeStudy", "tasks", "upcomingExams", "records", "importBatches", "recStatus", "notifRead"]
        .forEach(function (n) { BB.store.remove(key(n)); });
      cache = {};
    }
  };

  BB.repo = repo;
})(window.BB = window.BB || {});
