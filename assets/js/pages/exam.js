/** Examination Simulator — setup, live exam with behaviour tracking, autosave and results. */
(function (BB) {
  "use strict";
  var U = BB.utils, QB = BB.questionBank;
  var DURATIONS = [10, 15, 20, 30, 45];
  var TYPE_ORDER = ["mcq", "tf", "short", "long"];

  var tracker = null, questions = [], timerId = null, heartbeatId = null, saveTimer = null;
  var announced = {};

  BB.app.init({ page: "exam", title: "Practice Exams" }, function () {
    var params = new URLSearchParams(location.search);
    var resultId = params.get("result");
    if (resultId) {
      var a = BB.repo.attempt(resultId);
      if (a) { showResults(a, false); return; }
      BB.toast.show("That exam result couldn't be found. It may have been deleted.", { type: "warning" });
    }
    var active = BB.repo.activeExam();
    if (active) {
      if (Date.now() >= active.deadline) {
        // Time ran out while the page was closed: submit what was recorded.
        restore(active, true);
        submitExam("timer");
        return;
      }
      renderResumeBanner(active);
      if (params.get("resume") === "1") { restore(active); return; }
    }
    initSetup(params.get("subject"));
  });

  /* ======================= Setup ======================= */
  function examSubjects() {
    var mine = BB.repo.subjects().map(function (s) { return s.name; });
    var withBank = mine.filter(QB.has);
    return { available: withBank.length ? withBank : QB.subjects(), unavailable: mine.filter(function (s) { return !QB.has(s); }), fallback: !withBank.length };
  }

  function initSetup(preselect) {
    var form = U.$("#setup-form");
    var subj = examSubjects();
    var select = U.$("#setup-subject");
    select.innerHTML = subj.available.map(function (s) { return '<option value="' + U.escapeHtml(s) + '">' + U.escapeHtml(s) + "</option>"; }).join("") +
      subj.unavailable.map(function (s) { return '<option disabled>' + U.escapeHtml(s) + " (no demo questions yet)</option>"; }).join("");
    if (preselect && subj.available.indexOf(preselect) !== -1) select.value = preselect;
    U.$("#subject-hint").textContent = subj.fallback
      ? "None of your subjects have demo questions yet, so every demo subject is listed."
      : "Demo question banks are available for " + QB.subjects().join(", ") + ".";

    U.$("#duration-options").innerHTML = DURATIONS.map(function (d) {
      return '<label><input type="radio" name="duration" value="' + d + '"' + (d === 20 ? " checked" : "") + "><span>" + d + " min</span></label>";
    }).join("");

    U.$("#type-options").innerHTML = TYPE_ORDER.map(function (t) {
      return '<button type="button" class="chip" aria-pressed="true" data-type="' + t + '">' + BB.icon("check", { size: "sm" }) + QB.TYPE_LABELS[t] + "</button>";
    }).join("");

    function renderCategories() {
      U.$("#category-options").innerHTML = QB.categoriesFor(select.value).map(function (c) {
        return '<button type="button" class="chip" aria-pressed="true" data-category="' + U.escapeHtml(c) + '">' + BB.icon("check", { size: "sm" }) + U.escapeHtml(c) + "</button>";
      }).join("");
      wireChips("#category-options");
      updateAvailable();
    }
    function wireChips(sel) {
      U.$$(sel + " .chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          var on = chip.getAttribute("aria-pressed") !== "true";
          chip.setAttribute("aria-pressed", String(on));
          chip.querySelector("svg").outerHTML = BB.icon(on ? "check" : "plus", { size: "sm" });
          updateAvailable();
        });
      });
    }
    function selected(sel, attr) {
      return U.$$(sel + ' .chip[aria-pressed="true"]').map(function (c) { return c.getAttribute(attr); });
    }
    function pool() {
      var cats = selected("#category-options", "data-category"), types = selected("#type-options", "data-type");
      return QB.questions(select.value).filter(function (q) { return cats.indexOf(q.category) !== -1 && types.indexOf(q.type) !== -1; });
    }
    function updateAvailable() {
      var n = pool().length;
      var countSel = U.$("#setup-count");
      var prev = Number(countSel.value) || 10;
      var opts = [5, 8, 10, 12, 15].filter(function (x) { return x < n; });
      if (n) opts.push(n);
      countSel.innerHTML = opts.map(function (x) { return '<option value="' + x + '">' + (x === n ? "All " + n + " questions" : x + " questions") + "</option>"; }).join("");
      var pick = opts.filter(function (x) { return x <= prev; }).pop() || opts[0];
      if (pick) countSel.value = pick;
      countSel.disabled = !n;
      U.$("#available-note").textContent = n
        ? U.plural(n, "question") + " match your choices."
        : "No questions match these choices. Select more categories or question types.";
      U.$("#start-btn").disabled = !n;
      U.$("#categories-error").innerHTML = selected("#category-options", "data-category").length ? "" : BB.icon("alert-circle") + "<span>Choose at least one category.</span>";
      U.$("#types-error").innerHTML = selected("#type-options", "data-type").length ? "" : BB.icon("alert-circle") + "<span>Choose at least one question type.</span>";
    }

    select.addEventListener("change", renderCategories);
    wireChips("#type-options");
    renderCategories();
    renderRecent();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var p = pool();
      if (!p.length) { updateAvailable(); U.$("#category-options .chip").focus(); return; }
      var go = function () {
        var count = Number(U.$("#setup-count").value);
        var picked = pickQuestions(p, count);
        var minutes = Number(form.querySelector('input[name="duration"]:checked').value);
        startExam(select.value, picked, minutes, selected("#category-options", "data-category"), selected("#type-options", "data-type"));
      };
      if (BB.repo.activeExam()) {
        BB.dialog.confirm({
          title: "Discard your unfinished exam?",
          body: "<p>You have an exam in progress. Starting a new one will discard its answers and behaviour data.</p>",
          confirmText: "Discard and start new",
          tone: "danger",
          focusCancel: true
        }).then(function (ok) { if (ok) { BB.repo.clearActiveExam(); go(); } });
      } else go();
    });
  }

  function pickQuestions(pool, count) {
    var shuffled = pool.slice().sort(function () { return Math.random() - 0.5; });
    var chosen = [];
    // Make sure each selected type appears at least once when there's room
    TYPE_ORDER.forEach(function (t) {
      var q = shuffled.filter(function (x) { return x.type === t && chosen.indexOf(x) === -1; })[0];
      if (q && chosen.length < count) chosen.push(q);
    });
    shuffled.forEach(function (q) { if (chosen.length < count && chosen.indexOf(q) === -1) chosen.push(q); });
    return chosen.sort(function (a, b) { return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type); });
  }

  function renderRecent() {
    var el = U.$("#recent-attempts");
    var mine = BB.repo.attempts({ includeDemo: false }).filter(function (a) { return a.source === "simulator"; }).slice(-5).reverse();
    if (!mine.length) {
      el.innerHTML = '<p class="text-secondary text-sm">You haven\'t taken a simulator exam yet. Your results will be listed here.</p>';
      return;
    }
    el.innerHTML = '<ul class="stat-list">' + mine.map(function (a) {
      return '<li class="stat-row"><span class="stat-row__icon">' + BB.icon("file") + '</span><div class="stat-row__text"><a class="stat-row__label" href="exam.html?result=' + encodeURIComponent(a.id) + '">' + U.escapeHtml(a.title) + "</a>" +
        '<span class="stat-row__detail">' + U.formatDate(a.startedAt, "datetime") + "</span></div>" + scorePill(a.scorePct) + "</li>";
    }).join("") + "</ul>";
  }

  function scorePill(pct) {
    var cls = pct >= 70 ? "high" : pct >= 50 ? "mid" : "low";
    return '<span class="score-pill score-pill--' + cls + '">' + Math.round(pct) + "%</span>";
  }

  function renderResumeBanner(active) {
    var answered = Object.keys(active.answers).filter(function (k) { return String(active.answers[k]).trim() !== ""; }).length;
    var left = Math.max(0, active.deadline - Date.now());
    U.$("#resume-slot").innerHTML =
      '<div class="alert alert--warning" role="status" style="margin-bottom:24px;align-items:center">' + BB.icon("alert") +
      '<div style="flex:1"><p class="alert__title">You have an unfinished exam</p><p>' + U.escapeHtml(active.title) + ": " + answered + " of " + active.questionIds.length +
      " answered, " + U.formatDuration(left, { noSeconds: true }) + " left on the clock. The clock kept running while you were away.</p></div>" +
      '<div class="cluster"><button type="button" class="btn btn--sm" id="discard-active">Discard</button><button type="button" class="btn btn--primary btn--sm" id="resume-active">Resume exam</button></div></div>';
    U.$("#resume-active").addEventListener("click", function () { restore(BB.repo.activeExam()); });
    U.$("#discard-active").addEventListener("click", function () {
      BB.dialog.confirm({ title: "Discard this exam?", body: "<p>Your answers and behaviour data for this exam will be deleted.</p>", confirmText: "Discard exam", tone: "danger", focusCancel: true })
        .then(function (ok) {
          if (!ok) return;
          BB.repo.clearActiveExam();
          U.$("#resume-slot").innerHTML = "";
          BB.toast.show("Unfinished exam discarded.", { type: "success" });
        });
    });
  }

  /* ======================= Live exam ======================= */
  function resolveQuestions(ids, subject) {
    var bank = QB.questions(subject);
    return ids.map(function (id) { return bank.filter(function (q) { return q.id === id; })[0]; });
  }

  function startExam(subject, picked, minutes, categories, types) {
    questions = picked;
    tracker = BB.ExamTracker.create({
      subject: subject,
      title: subject + " practice exam",
      categories: categories,
      types: types,
      questionIds: picked.map(function (q) { return q.id; }),
      allowedMs: minutes * 60000
    }, questions);
    tracker.start();
    save(true);
    enterExamView();
  }

  function restore(state, silent) {
    questions = resolveQuestions(state.questionIds, state.subject);
    if (questions.some(function (q) { return !q; })) {
      BB.repo.clearActiveExam();
      BB.toast.show("That exam's questions are no longer available, so it was discarded.", { type: "error" });
      return;
    }
    tracker = new BB.ExamTracker(state, questions);
    tracker.resume();
    if (silent) return;
    save(true);
    enterExamView();
    BB.toast.show("Exam resumed. Your answers were restored.", { type: "success" });
  }

  function enterExamView() {
    U.$("#resume-slot").innerHTML = "";
    U.$("#view-setup").hidden = true;
    U.$("#view-results").hidden = true;
    var view = U.$("#view-exam");
    view.hidden = false;
    U.$(".app").classList.add("is-focus-mode");
    document.title = "Exam in progress | Brainy Buddy";
    var s = tracker.s;
    view.innerHTML =
      '<div class="exam">' +
      '<div class="exam-bar">' +
      '<div class="exam-bar__title"><h2>' + U.escapeHtml(s.title) + "</h2>" +
      '<div class="exam-bar__progress"><span id="answered-count"></span><div class="progress progress--sm" role="progressbar" aria-label="Questions answered" aria-valuemin="0" aria-valuemax="' + questions.length + '" id="answered-bar"><span class="progress__bar"></span></div></div></div>' +
      '<span class="save-status" id="save-status" role="status" aria-live="polite"></span>' +
      '<div class="exam-timer" id="exam-timer" role="timer" aria-label="Time remaining">' + BB.icon("clock") + '<span id="timer-text">--:--</span></div>' +
      '<button type="button" class="btn btn--primary" id="submit-btn">Submit exam</button>' +
      "</div>" +
      '<div class="exam-body">' +
      '<section class="panel question-panel" id="question-panel" aria-labelledby="q-text"></section>' +
      '<aside class="panel navigator" aria-labelledby="nav-title">' +
      '<button type="button" class="btn navigator__toggle" id="nav-toggle" aria-expanded="false" aria-controls="nav-content"><span>Questions <span class="text-secondary" id="nav-toggle-count"></span></span>' + BB.icon("chevron-down") + "</button>" +
      '<div class="navigator__content" id="nav-content">' +
      '<h3 class="panel__title navigator__title" id="nav-title">Questions</h3>' +
      '<div class="nav-grid" id="nav-grid" role="list"></div>' +
      '<div class="nav-legend" aria-hidden="true"><span><i class="l-current"></i>Current</span><span><i class="l-answered"></i>Answered</span><span><i class="l-skipped"></i>Skipped</span><span><i class="l-flag"></i>Flagged</span></div>' +
      '<dl class="kv nav-summary" id="nav-summary"></dl>' +
      "</div></aside></div></div>";

    U.$("#submit-btn").addEventListener("click", confirmSubmit);
    var toggle = U.$("#nav-toggle"), content = U.$("#nav-content");
    function syncNavToggle() {
      var mobile = window.matchMedia("(max-width: 1023px)").matches;
      if (!mobile) { content.hidden = false; return; }
      content.hidden = toggle.getAttribute("aria-expanded") !== "true";
    }
    toggle.addEventListener("click", function () {
      toggle.setAttribute("aria-expanded", String(toggle.getAttribute("aria-expanded") !== "true"));
      syncNavToggle();
    });
    window.addEventListener("resize", syncNavToggle);
    syncNavToggle();

    renderQuestion(false);
    renderNavigator();
    startTimer();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    heartbeatId = setInterval(function () { save(false); }, 10000);
    setSaveStatus("saved");
    window.scrollTo(0, 0);
    var h = U.$("#q-text");
    if (h) h.focus();
  }

  function onVisibility() {
    if (!tracker) return;
    if (document.hidden) tracker.pause();
    else tracker.unpause();
    save(true);
  }
  function onPageHide() { if (tracker) save(true); }

  function renderQuestion(focus) {
    var i = tracker.s.current;
    var q = questions[i];
    var ans = tracker.s.answers[i];
    var flagged = !!tracker.s.flags[i];
    var area = "";
    if (q.type === "mcq" || q.type === "tf") {
      var opts = q.type === "mcq" ? q.options.map(function (o, k) { return { value: String(k), label: o, key: String.fromCharCode(65 + k) }; })
        : [{ value: "true", label: "True", key: "T" }, { value: "false", label: "False", key: "F" }];
      area = '<fieldset class="answer-options' + (q.type === "tf" ? " tf-options" : "") + '"><legend class="visually-hidden">Choose one answer</legend>' +
        opts.map(function (o) {
          return '<label class="answer-option"><input type="radio" name="answer" value="' + o.value + '"' + (ans != null && String(ans) === o.value ? " checked" : "") + ">" +
            '<span class="answer-option__body"><span class="answer-option__key" aria-hidden="true">' + o.key + "</span><span>" + U.escapeHtml(o.label) + "</span></span></label>";
        }).join("") + "</fieldset>";
    } else if (q.type === "short") {
      area = '<div class="answer-text field"><label class="label" for="answer-input">Your answer</label>' +
        '<input class="input" id="answer-input" type="text" autocomplete="off" value="' + U.escapeHtml(ans || "") + '" aria-describedby="answer-hint">' +
        '<p class="hint" id="answer-hint">A word, phrase or number. Units aren\'t needed.</p></div>';
    } else {
      area = '<div class="answer-text field"><label class="label" for="answer-input">Your answer</label>' +
        '<textarea class="textarea" id="answer-input" aria-describedby="answer-hint">' + U.escapeHtml(ans || "") + "</textarea>" +
        '<div class="answer-text__meta"><span id="answer-hint">Aim for at least ' + (q.minWords || 30) + ' words. Explain your reasoning.</span><span id="word-count" aria-live="off"></span></div></div>';
    }

    var isLast = i === questions.length - 1;
    U.$("#question-panel").innerHTML =
      '<div class="question-meta"><span class="question-meta__num">Question ' + (i + 1) + " of " + questions.length + "</span>" +
      '<span class="badge badge--' + q.kind + '">' + QB.TYPE_LABELS[q.type] + "</span>" +
      '<span class="badge">' + U.plural(q.marks, "mark") + "</span>" +
      '<span class="badge badge--outline">' + U.escapeHtml(q.category) + "</span></div>" +
      '<h2 class="question-text" id="q-text" tabindex="-1">' + U.escapeHtml(q.text) + "</h2>" +
      '<div class="answer-area">' + area + "</div>" +
      '<div class="question-actions">' +
      '<button type="button" class="btn" id="prev-btn"' + (i === 0 ? " disabled" : "") + ">" + BB.icon("chevron-left") + "Previous</button>" +
      '<button type="button" class="btn flag-btn" id="flag-btn" aria-pressed="' + flagged + '">' + BB.icon("flag") + (flagged ? "Flagged" : "Flag for review") + "</button>" +
      '<button type="button" class="btn btn--ghost" id="clear-btn"' + (tracker.hasAnswer(i) ? "" : " hidden") + ">Clear answer</button>" +
      '<span class="question-actions__spacer"></span>' +
      (isLast
        ? '<button type="button" class="btn btn--primary" id="next-btn">Review and submit</button>'
        : '<button type="button" class="btn btn--primary" id="next-btn">Next' + BB.icon("chevron-right") + "</button>") +
      "</div>";

    U.$$('input[name="answer"]').forEach(function (r) {
      r.addEventListener("change", function () {
        tracker.setAnswer(i, r.value);
        U.$("#clear-btn").hidden = false;
        afterChange();
      });
    });
    var input = U.$("#answer-input");
    if (input) {
      var updateWords = function () {
        var wc = U.$("#word-count");
        if (wc) { var n = input.value.trim() ? input.value.trim().split(/\s+/).length : 0; wc.textContent = U.plural(n, "word"); }
      };
      input.addEventListener("input", function () {
        tracker.setDraft(i, input.value);
        U.$("#clear-btn").hidden = !input.value.trim();
        updateWords();
        renderNavigator();
        scheduleSave();
      });
      input.addEventListener("blur", function () { tracker.commitText(i); scheduleSave(); });
      updateWords();
    }
    U.$("#prev-btn").addEventListener("click", function () { goTo(i - 1); });
    U.$("#next-btn").addEventListener("click", function () { if (isLast) confirmSubmit(); else goTo(i + 1); });
    U.$("#flag-btn").addEventListener("click", function () {
      var on = tracker.toggleFlag(i);
      var b = U.$("#flag-btn");
      b.setAttribute("aria-pressed", String(on));
      b.innerHTML = BB.icon("flag") + (on ? "Flagged" : "Flag for review");
      afterChange();
    });
    U.$("#clear-btn").addEventListener("click", function () {
      tracker.clearAnswer(i);
      renderQuestion(false);
      afterChange();
      var first = U.$('input[name="answer"]') || U.$("#answer-input");
      if (first) first.focus();
    });
    if (focus) U.$("#q-text").focus();
  }

  function goTo(i) {
    if (i < 0 || i >= questions.length) return;
    tracker.goTo(i);
    renderQuestion(true);
    renderNavigator();
    scheduleSave();
    var toggle = U.$("#nav-toggle");
    if (toggle && window.matchMedia("(max-width: 1023px)").matches && toggle.getAttribute("aria-expanded") === "true") {
      toggle.click();
    }
    if (window.matchMedia("(max-width: 1023px)").matches) U.$("#question-panel").scrollIntoView({ block: "start" });
  }

  function afterChange() { renderNavigator(); scheduleSave(); }

  function renderNavigator() {
    var s = tracker.s, c = tracker.counts();
    U.$("#nav-grid").innerHTML = questions.map(function (q, i) {
      var answered = tracker.hasAnswer(i);
      var skipped = !answered && s.t.per[i].skipped;
      var flagged = !!s.flags[i];
      var state = (answered ? "answered" : skipped ? "skipped, not answered" : s.t.per[i].visits ? "not answered" : "not visited") + (flagged ? ", flagged" : "");
      return '<button type="button" role="listitem" class="nav-q' + (answered ? " is-answered" : "") + (skipped ? " is-skipped" : "") + '" data-q="' + i + '"' +
        (i === s.current ? ' aria-current="true"' : "") + ' aria-label="Question ' + (i + 1) + ", " + state + '">' + (i + 1) +
        (flagged ? '<span class="nav-q__flag" aria-hidden="true">' + BB.icon("flag") + "</span>" : "") + "</button>";
    }).join("");
    U.$$(".nav-q").forEach(function (b) { b.addEventListener("click", function () { goTo(Number(b.getAttribute("data-q"))); }); });
    U.$("#nav-summary").innerHTML =
      "<div><dt>Answered</dt><dd>" + c.answered + " of " + c.total + "</dd></div>" +
      "<div><dt>Flagged for review</dt><dd>" + c.flagged + "</dd></div>" +
      "<div><dt>Not answered</dt><dd>" + c.unanswered + "</dd></div>";
    U.$("#answered-count").textContent = c.answered + " of " + c.total + " answered";
    U.$("#nav-toggle-count").textContent = "(" + c.answered + " of " + c.total + " answered)";
    var bar = U.$("#answered-bar");
    bar.style.setProperty("--value", U.pct(c.answered, c.total) + "%");
    bar.setAttribute("aria-valuenow", String(c.answered));
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    clearInterval(timerId);
    announced = {};
    var tick = function () {
      if (!tracker) return;
      var left = tracker.s.deadline - Date.now();
      var el = U.$("#exam-timer"), txt = U.$("#timer-text");
      if (!el) return;
      txt.textContent = U.formatDuration(Math.max(0, left), { clock: true });
      el.classList.toggle("is-warning", left <= 5 * 60000 && left > 60000);
      el.classList.toggle("is-danger", left <= 60000);
      [[5 * 60000, "5 minutes remaining."], [60000, "1 minute remaining."]].forEach(function (m) {
        if (left <= m[0] && left > m[0] - 2000 && !announced[m[0]]) {
          announced[m[0]] = true;
          U.$("#exam-live").textContent = m[1];
          BB.toast.show(m[1], { type: "warning" });
        }
      });
      if (left <= 0) {
        clearInterval(timerId);
        submitExam("timer");
      }
    };
    tick();
    timerId = setInterval(tick, 500);
  }

  /* ---------- Autosave ---------- */
  function setSaveStatus(kind) {
    var el = U.$("#save-status");
    if (!el) return;
    el.className = "save-status" + (kind === "saving" ? " is-saving" : kind === "error" ? " is-error" : "");
    if (kind === "saving") el.innerHTML = '<span class="spinner" style="width:14px;height:14px" aria-hidden="true"></span>Saving…';
    else if (kind === "error") el.innerHTML = BB.icon("alert-circle") + "Not saved. Browser storage is full or blocked.";
    else el.innerHTML = BB.icon("cloud") + "Saved at " + U.formatDate(new Date(), "time");
  }
  function scheduleSave() {
    setSaveStatus("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { save(true); }, 450);
  }
  function save(showStatus) {
    if (!tracker) return;
    tracker.s.savedAt = Date.now();
    var ok = BB.repo.saveActiveExam(tracker.s);
    if (showStatus !== false) setSaveStatus(ok ? "saved" : "error");
  }

  /* ---------- Submit ---------- */
  function confirmSubmit() {
    var i = tracker.s.current;
    if (questions[i] && tracker.isText(i)) tracker.commitText(i);
    var c = tracker.counts();
    var unanswered = questions.map(function (q, k) { return k; }).filter(function (k) { return !tracker.hasAnswer(k); });
    var flagged = questions.map(function (q, k) { return k; }).filter(function (k) { return tracker.s.flags[k]; });
    var left = tracker.s.deadline - Date.now();
    var list = function (arr) { return arr.map(function (k) { return "Q" + (k + 1); }).join(", "); };
    BB.dialog.confirm({
      title: "Submit your exam?",
      body:
        "<p>You've answered <strong>" + c.answered + " of " + c.total + "</strong> questions, with <strong>" + U.formatDuration(left, { noSeconds: true }) + "</strong> remaining.</p>" +
        (unanswered.length ? '<p style="margin-top:8px">Not answered: <strong>' + list(unanswered) + "</strong>.</p>" : "") +
        (flagged.length ? '<p style="margin-top:8px">Flagged for review: <strong>' + list(flagged) + "</strong>.</p>" : "") +
        '<p style="margin-top:8px">You can\'t change your answers after submitting.</p>',
      confirmText: "Submit exam",
      cancelText: "Keep working",
      focusCancel: unanswered.length > 0
    }).then(function (ok) { if (ok) submitExam("student"); });
  }

  function submitExam(reason) {
    if (!tracker) return;
    clearInterval(timerId);
    clearInterval(heartbeatId);
    clearTimeout(saveTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    tracker.finish(reason);
    var attempt = tracker.toAttempt();
    BB.repo.saveAttempt(attempt);
    BB.repo.clearActiveExam();
    tracker = null;
    U.$(".app").classList.remove("is-focus-mode");
    U.$$('.nav-link[href="exam.html"] .nav-link__badge').forEach(function (b) { b.remove(); });
    if (reason === "timer") BB.toast.show("Time's up. Your exam was submitted automatically.", { type: "warning", duration: 6000 });
    else BB.toast.show("Exam submitted.", { type: "success" });
    history.replaceState(null, "", "exam.html?result=" + encodeURIComponent(attempt.id));
    showResults(attempt, true);
  }

  /* ======================= Results ======================= */
  function showResults(a, fresh) {
    U.$("#view-setup").hidden = true;
    U.$("#view-exam").hidden = true;
    U.$("#resume-slot").innerHTML = "";
    var view = U.$("#view-results");
    view.hidden = false;
    document.title = "Exam results | Brainy Buddy";
    BB.shell.setTitle("Exam results");

    var answered = a.questions.filter(function (q) { return q.status !== "unanswered"; });
    var correct = a.questions.filter(function (q) { return q.status === "correct"; }).length;
    var incorrect = a.questions.filter(function (q) { return q.status === "incorrect"; }).length;
    var unanswered = a.questions.length - answered.length;
    var accuracy = answered.length ? U.pct(correct, answered.length) : null;
    var hasEstimates = a.questions.some(function (q) { return q.type === "long"; });
    var mood = a.scorePct >= 70 ? "celebrate" : a.scorePct >= 50 ? "happy" : "thinking";

    view.innerHTML =
      '<div class="results-hero">' + BB.mascot.svg({ mood: mood }) +
      '<div><h2 id="results-title">' + U.escapeHtml(a.title) + "</h2>" +
      "<p>" + (a.source === "demo" ? "Demo exam taken " : "Taken ") + U.formatDate(a.startedAt, "datetime") +
      (a.submittedBy === "timer" ? ". Submitted automatically when time ran out." : ".") + "</p></div>" +
      '<div class="cluster"><a class="btn" href="exam.html">Take another exam</a><a class="btn btn--primary" href="analytics.html?attempt=' + encodeURIComponent(a.id) + '">See your exam patterns</a></div></div>' +

      '<section aria-label="Results summary"><div class="results-grid">' +
      BB.ui.metric({ icon: "target", label: "Total marks", value: a.obtainedMarks + " / " + a.totalMarks, foot: Math.round(a.scorePct) + "% score" }) +
      BB.ui.metric({ icon: "check-circle", tone: "accent", label: "Accuracy", value: accuracy == null ? null : Math.round(accuracy), unit: "%", foot: "Correct ÷ answered" }) +
      BB.ui.metric({ icon: "check", tone: "accent", label: "Correct answers", value: correct }) +
      BB.ui.metric({ icon: "x", tone: "amber", label: "Incorrect answers", value: incorrect }) +
      BB.ui.metric({ icon: "skip", tone: "violet", label: "Unanswered", value: unanswered }) +
      BB.ui.metric({ icon: "clock", label: "Total duration", value: U.formatDuration(a.usedMs, { noSeconds: false }), foot: "of " + U.formatDuration(a.allowedMs) + " allowed" }) +
      "</div></section>" +

      (hasEstimates ? '<div class="alert alert--info" style="margin-top:20px">' + BB.icon("info") + "<div><strong>About marking:</strong> objective and short answers are checked automatically. Long answers are given an <strong>estimated</strong> mark from key ideas and length, for this demo only. A written answer counts as correct when it earns at least half its marks.</div></div>" : "") +

      '<div class="grid grid--main-side section">' +
      '<section class="panel" aria-labelledby="time-q-title"><div class="panel__header"><div><h3 class="panel__title" id="time-q-title">Time spent per question</h3><p class="panel__subtitle">Active time only: paused while you were on other questions or away from the tab</p></div></div>' +
      '<div class="chart-box"><canvas id="result-time-chart" role="img" aria-label="Active time spent on each question"></canvas></div>' +
      '<div class="legend" style="margin-top:12px"><span class="legend__item" style="color:var(--color-objective)"><span class="legend__swatch"></span><span class="text-secondary">Objective</span></span><span class="legend__item" style="color:var(--color-subjective)"><span class="legend__swatch"></span><span class="text-secondary">Written</span></span><span class="legend__item" style="color:var(--color-text-secondary)"><span class="legend__swatch legend__swatch--dashed"></span>Time budget (allowed time × share of marks)</span></div></section>' +
      '<section class="panel" aria-labelledby="path-title"><div class="panel__header"><div><h3 class="panel__title" id="path-title">Your answer path</h3><p class="panel__subtitle">The order you moved through the questions</p></div></div>' +
      '<div id="result-path"></div><p class="text-sm text-secondary" style="margin-top:12px">Arcs above the line are forward moves. Dashed arcs below are moves back to an earlier question. There\'s no right or wrong order.</p></section>' +
      "</div>" +

      '<section class="section panel panel--flush" aria-labelledby="qtable-title"><div class="panel__header" style="padding:24px 24px 0"><div><h3 class="panel__title" id="qtable-title">Question by question</h3><p class="panel__subtitle">Your answers, results and behaviour for each question</p></div></div>' +
      '<div class="table-wrap" style="border:0;border-top:1px solid var(--color-border);border-radius:0 0 var(--radius-lg) var(--radius-lg)"><table class="table results-table"><caption class="visually-hidden">Results for each question</caption><thead><tr>' +
      '<th scope="col">Q</th><th scope="col">Type</th><th scope="col">Your answer</th><th scope="col">Result</th><th scope="col" class="num">Marks</th><th scope="col" class="num">Time spent</th><th scope="col" class="num">Visits</th><th scope="col" class="num">Changes</th><th scope="col" class="num">First viewed</th>' +
      "</tr></thead><tbody>" +
      a.questions.map(function (q, i) {
        var b = a.behaviour.perQuestion[i];
        var status = q.status === "correct" ? '<span class="badge badge--success">' + BB.icon("check", { size: "sm" }) + "Correct</span>"
          : q.status === "incorrect" ? '<span class="badge badge--danger">' + BB.icon("x", { size: "sm" }) + "Incorrect</span>"
            : '<span class="badge">Unanswered</span>';
        var ans = q.answerLabel != null ? q.answerLabel : null;
        return "<tr><td>" + q.number + "</td>" +
          '<td><span class="badge badge--' + q.kind + '">' + QB.TYPE_LABELS[q.type] + "</span></td>" +
          '<td><div class="answer-cell" title="' + U.escapeHtml(ans || "") + '">' + (ans == null ? '<span class="text-muted">Not stored for demo exams</span>' : ans ? U.escapeHtml(ans) : '<span class="text-muted">No answer</span>') + "</div>" +
          (q.correctLabel && q.status !== "correct" ? '<div class="answer-review">Expected: ' + U.escapeHtml(q.correctLabel) + "</div>" : "") +
          (q.method === "keyword-estimate" ? '<div class="answer-review">Estimated mark: ' + U.escapeHtml(q.detail || "") + "</div>" : "") + "</td>" +
          "<td>" + status + "</td>" +
          '<td class="num">' + q.obtained + " / " + q.marks + "</td>" +
          '<td class="num">' + U.formatDuration(b.activeMs) + "</td>" +
          '<td class="num">' + b.visits + "</td>" +
          '<td class="num">' + b.changes + "</td>" +
          '<td class="num">' + (b.firstViewedAt == null ? "Not viewed" : U.formatDuration(b.firstViewedAt, { clock: true })) + "</td></tr>";
      }).join("") +
      "</tbody></table></div></section>";

    BB.charts.create("result-time-chart", function (c) {
      return {
        type: "bar",
        data: {
          labels: a.questions.map(function (q) { return "Q" + q.number; }),
          datasets: [
            { type: "bar", label: "Active time (min)", data: a.behaviour.perQuestion.map(function (b) { return U.round(b.activeMs / 60000, 2); }), backgroundColor: a.questions.map(function (q) { return q.kind === "objective" ? c.objective : c.subjective; }), maxBarThickness: 34 },
            { type: "line", label: "Time budget (min)", data: a.questions.map(function (q) { return U.round((a.allowedMs * q.marks / a.totalMarks) / 60000, 2); }), borderColor: c.textSecondary, borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, stepped: "middle" }
          ]
        },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (t) { return " " + t.dataset.label.replace(" (min)", "") + ": " + U.formatDuration(t.raw * 60000); } } } },
          scales: { y: BB.charts.axes.plain(c, { title: { display: true, text: "Minutes" } }), x: BB.charts.axes.category() }
        }
      };
    });

    BB.arcPath.render(U.$("#result-path"), {
      questions: a.questions.map(function (q) { return { number: q.number, kind: q.kind, status: q.status === "unanswered" ? "unanswered" : null }; }),
      order: BB.arcPath.orderFromAttempt(a),
      spacing: a.questions.length > 12 ? 44 : 50,
      animate: fresh
    });

    if (fresh) {
      var h = U.$("#results-title"); h.setAttribute("tabindex", "-1"); h.focus();
      BB.ui.countUp(view);
      BB.mascot.bounce(U.$(".results-hero .mascot", view));
      if (a.scorePct >= 70) setTimeout(function () { BB.fx.confetti(); }, 250);
    }
    window.scrollTo(0, 0);
  }
})(window.BB = window.BB || {});
