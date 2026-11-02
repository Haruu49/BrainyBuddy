/** Student onboarding — 5 steps with Buddy as the guide. Progress is saved as you go. */
(function (BB) {
  "use strict";
  var U = BB.utils;

  var STEPS = [
    { key: "welcome", label: "Welcome", mood: "wave" },
    { key: "level", label: "Education level", mood: "happy" },
    { key: "subjects", label: "Subjects", mood: "thinking" },
    { key: "goals", label: "Learning goals", mood: "happy" },
    { key: "done", label: "All set", mood: "celebrate" }
  ];

  var SUGGESTED = {
    primary: ["Mathematics", "Science", "English", "Modern Languages", "History", "Geography", "Art & Design"],
    secondary: ["Mathematics", "Additional Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Geography", "Computer Science", "Economics", "Accounting", "Literature"],
    college: ["Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Economics", "Business Studies", "Accounting", "English", "Literature"],
    university: ["Mathematics", "Computer Science", "Economics", "Business Studies", "Accounting", "Physics", "Chemistry", "Biology", "Literature", "Modern Languages"]
  };

  var user, draft, step = 0;

  BB.page.init(function () {
    user = BB.auth.currentUser();
    if (!user) { location.replace("login.html?next=" + encodeURIComponent("app/dashboard.html")); return; }
    if (user.onboarded && !/[?&]redo=1/.test(location.search)) { location.replace("app/dashboard.html"); return; }

    draft = Object.assign({
      step: 0,
      educationLevel: user.educationLevel || "",
      subjects: user.subjects && user.subjects.length ? user.subjects.slice() : [],
      goals: user.goals ? user.goals.slice() : [],
      weeklyGoalHours: user.weeklyGoalHours || 8
    }, user.onboardingDraft || {});
    step = U.clamp(draft.step || 0, 0, STEPS.length - 1);

    U.$("#ob-signout").addEventListener("click", function () { BB.shell.signOut(); });
    U.$("#ob-back").addEventListener("click", function () { go(step - 1); });
    U.$("#ob-form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      if (step === STEPS.length - 1) return finish();
      go(step + 1);
    });
    render(false);
  });

  function saveDraft() {
    draft.step = step;
    user = BB.auth.updateUser({ onboardingDraft: draft });
  }

  function go(next) {
    step = U.clamp(next, 0, STEPS.length - 1);
    saveDraft();
    render(true);
  }

  function renderStepper() {
    U.$("#ob-stepper").innerHTML = STEPS.map(function (s, i) {
      var cls = i < step ? "is-done" : i === step ? "is-current" : "";
      return '<li class="stepper__item ' + cls + '"' + (i === step ? ' aria-current="step"' : "") + '><span class="stepper__label">' +
        (i + 1) + ". " + U.escapeHtml(s.label) + '</span><span class="visually-hidden">' + (i < step ? " (completed)" : "") + "</span></li>";
    }).join("");
  }

  function bubble(title, text) {
    U.$("#guide-bubble").innerHTML = "<strong>" + U.escapeHtml(title) + "</strong>" + U.escapeHtml(text);
  }

  function render(moveFocus) {
    renderStepper();
    U.$("#guide-mascot").innerHTML = BB.mascot.svg({ mood: STEPS[step].mood });
    var back = U.$("#ob-back"), next = U.$("#ob-next");
    back.hidden = step === 0 || step === STEPS.length - 1;
    next.textContent = step === 0 ? "Let's begin" : step === STEPS.length - 1 ? "Go to my dashboard" : step === STEPS.length - 2 ? "Finish setup" : "Continue";
    var el = U.$("#ob-step");
    var name = U.firstName(user.name);

    if (step === 0) {
      bubble("Hi " + name + ", I'm Buddy!", "I'll help you set up Brainy Buddy. It takes about two minutes.");
      el.innerHTML =
        '<section class="ob-step" aria-labelledby="ob-h"><h1 id="ob-h" tabindex="-1">Welcome to Brainy Buddy</h1>' +
        "<p>Here's what you'll be able to do once you're set up.</p>" +
        '<ul class="ob-welcome-list">' +
        item("timer", "Take practice exams", "Brainy Buddy records the time you spend on each question, the order you answer in and the answers you change.") +
        item("coffee", "Track your study sessions", "Time your sessions, log breaks and rate your focus to see your habits.") +
        item("sparkles", "Get recommendations with evidence", "Each one shows the pattern, the numbers behind it and a target you can measure.") +
        "</ul></section>";
    } else if (step === 1) {
      bubble("Where are you studying?", "This helps me suggest subjects and pitch examples at the right level.");
      el.innerHTML =
        '<section class="ob-step" aria-labelledby="ob-h"><h1 id="ob-h" tabindex="-1">Select your education level</h1>' +
        "<p>You can change this later in Settings.</p>" +
        '<fieldset class="ob-step__body" style="border:0;padding:0;margin-inline:0"><legend class="visually-hidden">Education level</legend>' +
        '<div class="option-grid level-options">' +
        BB.demo.EDUCATION_LEVELS.map(function (l) {
          var icon = { primary: "backpack", secondary: "school", college: "building", university: "cap" }[l.value];
          return '<label class="option-card"><input type="radio" name="educationLevel" value="' + l.value + '" data-error-id="level-error"' +
            (draft.educationLevel === l.value ? " checked" : "") + '><span class="option-card__body">' + BB.icon(icon) +
            "<strong>" + U.escapeHtml(l.label) + "</strong><span>" + U.escapeHtml(l.hint) + "</span></span></label>";
        }).join("") +
        '</div><p class="field-error" id="level-error"></p></fieldset></section>';
      U.$$('input[name="educationLevel"]', el).forEach(function (r) {
        r.addEventListener("change", function () { draft.educationLevel = r.value; clearErr("level-error", 'input[name="educationLevel"]'); });
      });
    } else if (step === 2) {
      bubble("What are you studying?", "Pick your subjects. Ones marked “Practice exams” have demo questions in the simulator.");
      var suggestions = SUGGESTED[draft.educationLevel] || BB.demo.CATALOG;
      var rest = BB.demo.CATALOG.filter(function (s) { return suggestions.indexOf(s) === -1; });
      el.innerHTML =
        '<section class="ob-step" aria-labelledby="ob-h"><h1 id="ob-h" tabindex="-1">Add your subjects</h1>' +
        "<p>Choose at least one. You can add or remove subjects later.</p>" +
        '<div class="ob-step__body">' +
        '<h2 class="label" id="sugg-label" style="margin-bottom:10px">Suggested for ' + U.escapeHtml(BB.demo.educationLabel(draft.educationLevel).toLowerCase()) + "</h2>" +
        '<div class="chip-group" role="group" aria-labelledby="sugg-label">' + suggestions.map(subjectChip).join("") + "</div>" +
        (rest.length ? '<h2 class="label" id="more-label" style="margin:20px 0 10px">More subjects</h2><div class="chip-group" role="group" aria-labelledby="more-label">' + rest.map(subjectChip).join("") + "</div>" : "") +
        '<div class="field" style="margin-top:20px"><label class="label" for="custom-subject">Another subject</label>' +
        '<div class="subject-picker__add"><input class="input" id="custom-subject" maxlength="40" placeholder="For example, Music" autocomplete="off">' +
        '<button type="button" class="btn" id="add-subject">' + BB.icon("plus") + "Add</button></div>" +
        '<p class="field-error" id="custom-error"></p></div>' +
        '<div class="subject-picker__selected"><h2 id="sel-label">Your subjects (<span id="sel-count">0</span>)</h2><div class="chip-group" id="selected-subjects" aria-labelledby="sel-label"></div></div>' +
        '<p class="field-error" id="subjects-error" style="margin-top:12px"></p>' +
        "</div></section>";
      U.$$("[data-subject]", el).forEach(function (btn) {
        btn.addEventListener("click", function () { toggleSubject(btn.getAttribute("data-subject")); });
      });
      var input = U.$("#custom-subject");
      U.$("#add-subject").addEventListener("click", addCustom);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addCustom(); } });
      renderSelected();
    } else if (step === 3) {
      bubble("What would you like to improve?", "Your goals decide which recommendations I show first.");
      el.innerHTML =
        '<section class="ob-step" aria-labelledby="ob-h"><h1 id="ob-h" tabindex="-1">Set your learning goals</h1>' +
        "<p>Choose one or more.</p>" +
        '<fieldset class="ob-step__body" style="border:0;padding:0;margin-inline:0"><legend class="visually-hidden">Learning goals</legend>' +
        '<div class="option-grid">' +
        BB.demo.GOALS.map(function (g) {
          return '<label class="option-card"><input type="checkbox" name="goals" value="' + g.value + '" data-error-id="goals-error"' +
            (draft.goals.indexOf(g.value) !== -1 ? " checked" : "") + '><span class="option-card__body">' + BB.icon(g.icon) +
            "<strong>" + U.escapeHtml(g.label) + "</strong></span></label>";
        }).join("") +
        '</div><p class="field-error" id="goals-error"></p></fieldset>' +
        '<div class="field" style="margin-top:24px;max-width:280px"><label class="label" for="weekly-hours">Weekly study goal (hours)</label>' +
        '<input class="input" id="weekly-hours" name="weeklyGoalHours" type="number" min="1" max="60" step="1" inputmode="numeric" value="' + draft.weeklyGoalHours + '" aria-describedby="weekly-hint">' +
        '<p class="hint" id="weekly-hint">Used on your dashboard to show weekly progress.</p><p class="field-error" id="weekly-hours-error"></p></div>' +
        "</section>";
      U.$$('input[name="goals"]', el).forEach(function (c) {
        c.addEventListener("change", function () {
          draft.goals = U.$$('input[name="goals"]:checked', el).map(function (x) { return x.value; });
          if (draft.goals.length) clearErr("goals-error", 'input[name="goals"]');
        });
      });
      U.$("#weekly-hours").addEventListener("input", function (e) { draft.weeklyGoalHours = e.target.value; });
    } else {
      bubble("You're all set, " + name + "!", "Start with a practice exam. The more you use Brainy Buddy, the clearer your patterns become.");
      el.innerHTML =
        '<section class="ob-step" aria-labelledby="ob-h"><h1 id="ob-h" tabindex="-1">Your profile is ready</h1>' +
        "<p>Here's a summary. You can change any of this in Settings.</p>" +
        '<dl class="ob-summary">' +
        "<div><dt>Name</dt><dd>" + U.escapeHtml(user.name) + "</dd></div>" +
        "<div><dt>Education level</dt><dd>" + U.escapeHtml(BB.demo.educationLabel(draft.educationLevel)) + (user.institution ? ", " + U.escapeHtml(user.institution) : "") + "</dd></div>" +
        "<div><dt>Subjects</dt><dd>" + U.escapeHtml(draft.subjects.join(", ")) + "</dd></div>" +
        "<div><dt>Goals</dt><dd>" + U.escapeHtml(draft.goals.map(BB.demo.goalLabel).join(", ")) + "</dd></div>" +
        "<div><dt>Weekly study goal</dt><dd>" + U.escapeHtml(draft.weeklyGoalHours) + " hours</dd></div>" +
        "</dl>" +
        '<div class="alert alert--info" style="margin-top:20px">' + BB.icon("info") + "<div>Your dashboard starts with <strong>demo data</strong> so you can explore every feature. It's clearly labelled, and you can turn it off in Settings.</div></div>" +
        "</section>";
    }

    if (moveFocus) {
      var h = U.$("#ob-h");
      if (h) h.focus();
    }
  }

  function item(icon, title, text) {
    return '<li><span class="feature-list__icon">' + BB.icon(icon) + "</span><div><strong>" + U.escapeHtml(title) + "</strong><span>" + U.escapeHtml(text) + "</span></div></li>";
  }

  function subjectChip(name) {
    var on = draft.subjects.indexOf(name) !== -1;
    return '<button type="button" class="chip" data-subject="' + U.escapeHtml(name) + '" aria-pressed="' + on + '">' +
      (on ? BB.icon("check", { size: "sm" }) : BB.icon("plus", { size: "sm" })) + U.escapeHtml(name) +
      (BB.questionBank.has(name) ? '<span class="badge badge--primary">Practice exams</span>' : "") + "</button>";
  }

  function toggleSubject(name) {
    var i = draft.subjects.indexOf(name);
    if (i === -1) draft.subjects.push(name);
    else draft.subjects.splice(i, 1);
    U.$$('[data-subject="' + cssEscape(name) + '"]').forEach(function (btn) {
      var on = draft.subjects.indexOf(name) !== -1;
      btn.setAttribute("aria-pressed", String(on));
      btn.querySelector("svg").outerHTML = BB.icon(on ? "check" : "plus", { size: "sm" });
    });
    renderSelected();
  }

  function addCustom() {
    var input = U.$("#custom-subject");
    var val = input.value.trim().replace(/\s+/g, " ");
    var err = U.$("#custom-error");
    if (!val) { err.innerHTML = BB.icon("alert-circle") + "<span>Type a subject name first.</span>"; input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    if (val.length < 2) { err.innerHTML = BB.icon("alert-circle") + "<span>Use at least 2 characters.</span>"; input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    var existing = draft.subjects.filter(function (s) { return s.toLowerCase() === val.toLowerCase(); })[0];
    if (existing) { err.innerHTML = BB.icon("alert-circle") + "<span>" + U.escapeHtml(existing) + " is already in your list.</span>"; input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    err.innerHTML = "";
    input.removeAttribute("aria-invalid");
    var catalogMatch = BB.demo.CATALOG.filter(function (s) { return s.toLowerCase() === val.toLowerCase(); })[0];
    if (catalogMatch) { toggleSubject(catalogMatch); }
    else { draft.subjects.push(val); renderSelected(); }
    input.value = "";
    input.focus();
  }

  function renderSelected() {
    var box = U.$("#selected-subjects");
    if (!box) return;
    U.$("#sel-count").textContent = draft.subjects.length;
    box.innerHTML = draft.subjects.length
      ? draft.subjects.map(function (s) {
        return '<span class="chip is-selected">' + U.escapeHtml(s) +
          '<button type="button" class="chip__remove" data-remove="' + U.escapeHtml(s) + '" aria-label="Remove ' + U.escapeHtml(s) + '">' + BB.icon("x", { size: "sm" }) + "</button></span>";
      }).join("")
      : '<p class="text-secondary text-sm">No subjects yet. Select from the lists above or add your own.</p>';
    U.$$("[data-remove]", box).forEach(function (btn) {
      btn.addEventListener("click", function () { toggleSubject(btn.getAttribute("data-remove")); U.$("#custom-subject").focus(); });
    });
    if (draft.subjects.length) clearErr("subjects-error");
  }

  function cssEscape(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"'); }

  function showErr(id, msg, focusSel) {
    var e = document.getElementById(id);
    e.innerHTML = BB.icon("alert-circle") + "<span>" + U.escapeHtml(msg) + "</span>";
    if (focusSel) {
      var targets = U.$$(focusSel);
      targets.forEach(function (t) { t.setAttribute("aria-invalid", "true"); t.setAttribute("aria-describedby", id); });
      if (targets[0]) targets[0].focus();
    }
  }
  function clearErr(id, sel) {
    var e = document.getElementById(id);
    if (e) e.innerHTML = "";
    if (sel) U.$$(sel).forEach(function (t) { t.removeAttribute("aria-invalid"); });
  }

  function validate() {
    if (step === 1 && !draft.educationLevel) { showErr("level-error", "Choose your education level to continue.", 'input[name="educationLevel"]'); return false; }
    if (step === 2 && !draft.subjects.length) { showErr("subjects-error", "Add at least one subject to continue."); U.$("[data-subject]").focus(); return false; }
    if (step === 3) {
      var ok = true;
      if (!draft.goals.length) { showErr("goals-error", "Choose at least one goal to continue.", 'input[name="goals"]'); ok = false; }
      var h = Number(draft.weeklyGoalHours);
      if (!isFinite(h) || h < 1 || h > 60 || Math.floor(h) !== h) {
        showErr("weekly-hours-error", "Enter a whole number of hours from 1 to 60.", ok ? "#weekly-hours" : null);
        U.$("#weekly-hours").setAttribute("aria-invalid", "true");
        ok = false;
      } else clearErr("weekly-hours-error", "#weekly-hours");
      return ok;
    }
    return true;
  }

  function finish() {
    var btn = U.$("#ob-next");
    BB.forms.setLoading(btn, true, "Opening your dashboard…");
    BB.auth.updateUser({
      educationLevel: draft.educationLevel,
      subjects: draft.subjects,
      goals: draft.goals,
      weeklyGoalHours: Number(draft.weeklyGoalHours),
      onboarded: true,
      onboardingDraft: null
    });
    setTimeout(function () { location.href = "app/dashboard.html"; }, 400);
  }
})(window.BB = window.BB || {});
