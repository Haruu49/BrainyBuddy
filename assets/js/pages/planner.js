/** Smart Study Planner */
(function (BB) {
  "use strict";
  var U = BB.utils, R = BB.forms.rules;
  var weekStart, selected, taskValidator, examValidator;

  BB.app.init({ page: "planner", title: "Study Planner" }, function () {
    U.$("#demo-flag").innerHTML = BB.repo.showDemo() ? BB.ui.demoBadge("Includes demo data") : "";
    weekStart = U.startOfWeek(new Date());
    selected = U.dateKey(new Date());

    var subjOpts = BB.repo.subjects().map(function (s) { return '<option value="' + U.escapeHtml(s.name) + '">' + U.escapeHtml(s.name) + "</option>"; }).join("");
    U.$("#t-subject").innerHTML = subjOpts;
    U.$("#e-subject").innerHTML = subjOpts;

    U.$("#week-prev").addEventListener("click", function () { weekStart = U.addDays(weekStart, -7); renderWeek(); });
    U.$("#week-next").addEventListener("click", function () { weekStart = U.addDays(weekStart, 7); renderWeek(); });
    U.$("#week-today").addEventListener("click", function () { weekStart = U.startOfWeek(new Date()); selected = U.dateKey(new Date()); renderAll(); });
    U.$("#add-task").addEventListener("click", function () { openTask(null, { date: selected }); });
    U.$("#add-task-day").addEventListener("click", function () { openTask(null, { date: selected }); });
    U.$("#add-exam").addEventListener("click", openExam);
    wireTaskForm();
    wireExamForm();
    renderAll();

    // "Add a study task" from the Jump to search (or a link) opens the form straight away
    function openFromHash() {
      if (location.hash !== "#new-task") return;
      history.replaceState(null, "", location.pathname + location.search);
      openTask(null, { date: selected });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);

    // Arriving from a recommendation or subject page
    var p = new URLSearchParams(location.search);
    if (p.get("suggest") || p.get("subject")) {
      var rec = p.get("suggest") ? BB.recommend.current().filter(function (r) { return r.id === p.get("suggest"); })[0] : null;
      var subj = p.get("subject") || "";
      openTask(null, {
        date: U.dateKey(U.addDays(new Date(), 1)),
        subject: subj,
        title: rec ? actionTitle(rec) : (subj ? subj + " practice session" : ""),
        notes: rec ? rec.action : ""
      });
      history.replaceState(null, "", "planner.html");
    }
  });

  function actionTitle(rec) {
    return {
      "Time Management": "Timed practice: written answers",
      "Examination Strategy": "Practice paper with a review plan",
      "Study Consistency": "Short study session (20–30 min)",
      "Subject Improvement": rec.title,
      "Focus Management": "Focused session in 30-minute blocks"
    }[rec.category] || rec.title;
  }

  function tasks() { return BB.repo.tasks(); }
  function sortTasks(list) { return list.slice().sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); }); }
  function renderAll() { renderWeek(); renderDay(); renderExams(); renderSuggestions(); renderReminders(); }

  /* ---------- Week ---------- */
  function renderWeek() {
    var end = U.addDays(weekStart, 6);
    U.$("#week-label").textContent = U.formatDate(weekStart, "short") + " to " + U.formatDate(end);
    var todayKey = U.dateKey(new Date());
    var all = sortTasks(tasks());
    var exams = BB.repo.upcomingExams();
    var html = "";
    for (var i = 0; i < 7; i++) {
      var d = U.addDays(weekStart, i);
      var k = U.dateKey(d);
      var dayTasks = all.filter(function (t) { return t.date === k; });
      var dayExams = exams.filter(function (e) { return e.date === k; });
      html += '<div class="week-day' + (k === todayKey ? " is-today" : "") + (k === selected ? " is-selected" : "") + '">' +
        '<button type="button" class="week-day__head" data-day="' + k + '" aria-pressed="' + (k === selected) + '" aria-label="' + U.formatDate(d, "long") + ", " + U.plural(dayTasks.length, "task") + (dayExams.length ? ", exam day" : "") + '">' +
        '<span class="week-day__name">' + U.formatDate(d, "weekday") + (k === todayKey ? " (today)" : "") + '</span><span class="week-day__date">' + d.getDate() + "</span></button>" +
        dayExams.map(function (e) { return '<div class="week-exam">' + BB.icon("alert", { size: "sm" }) + " " + U.escapeHtml(e.subject) + " exam</div>"; }).join("") +
        dayTasks.slice(0, 3).map(function (t) {
          return '<button type="button" class="week-task' + (t.completed ? " is-done" : "") + '" style="--task-color:' + BB.repo.subjectColor(t.subject) + '" data-task="' + U.escapeHtml(t.id) + '" aria-label="Edit ' + U.escapeHtml(t.title) + ", " + t.start + " to " + t.end + (t.completed ? ", completed" : "") + '">' +
            "<strong>" + t.start + "</strong><span>" + U.escapeHtml(t.title) + "</span></button>";
        }).join("") +
        (dayTasks.length > 3 ? '<span class="week-day__more">+' + (dayTasks.length - 3) + " more</span>" : "") +
        "</div>";
    }
    U.$("#week").innerHTML = html;
    U.$$("[data-day]").forEach(function (b) { b.addEventListener("click", function () { selected = b.getAttribute("data-day"); renderWeek(); renderDay(); U.$('[data-day="' + selected + '"]').focus(); }); });
    U.$$("#week [data-task]").forEach(function (b) { b.addEventListener("click", function () { openTask(b.getAttribute("data-task")); }); });
  }

  /* ---------- Day ---------- */
  function renderDay() {
    var d = U.parseDateKey(selected);
    U.$("#day-sub").textContent = U.formatDate(d, "long") + (selected === U.dateKey(new Date()) ? " (today)" : "");
    var list = sortTasks(tasks().filter(function (t) { return t.date === selected; }));
    var exams = BB.repo.upcomingExams().filter(function (e) { return e.date === selected; });
    var el = U.$("#day-list");
    if (!list.length && !exams.length) {
      el.innerHTML = BB.ui.empty({ mood: "happy", title: "Nothing planned for this day", text: "Add a study task, or pick a recommended session from the panel on the right.", action: { id: "empty-add", label: "Add study task" } });
      U.$("#empty-add").addEventListener("click", function () { openTask(null, { date: selected }); });
      return;
    }
    var mins = U.sum(list, function (t) { return t.duration; });
    el.innerHTML =
      exams.map(function (e) { return '<div class="alert alert--danger" style="margin-bottom:12px">' + BB.icon("alert") + "<div><strong>" + U.escapeHtml(e.subject + ": " + e.title) + "</strong> at " + e.time + "</div></div>"; }).join("") +
      '<p class="text-sm text-secondary" style="margin-bottom:12px">' + U.plural(list.length, "task") + ", " + U.formatMinutes(mins) + " planned, " + list.filter(function (t) { return t.completed; }).length + " completed.</p>" +
      '<ul class="day-list">' + list.map(function (t) {
        return '<li class="day-item' + (t.completed ? " is-done" : "") + '" style="--task-color:' + BB.repo.subjectColor(t.subject) + '">' +
          '<label class="check"><input type="checkbox" data-complete="' + U.escapeHtml(t.id) + '"' + (t.completed ? " checked" : "") + ' aria-label="Mark ' + U.escapeHtml(t.title) + ' as completed"></label>' +
          '<span class="day-item__time">' + t.start + "<small>to " + t.end + "</small></span>" +
          '<div><div class="day-item__title">' + U.escapeHtml(t.title) + '</div><div class="day-item__meta">' + U.escapeHtml(t.subject) + ", " + U.formatMinutes(t.duration) + (t.reminder ? ", reminder on" : "") + (t.source === "demo" ? ", demo task" : "") + (t.notes ? ". " + U.escapeHtml(t.notes) : "") + "</div></div>" +
          '<div class="day-item__actions"><button type="button" class="btn btn--ghost btn--icon btn--sm" data-edit="' + U.escapeHtml(t.id) + '" aria-label="Edit ' + U.escapeHtml(t.title) + '">' + BB.icon("pencil") + "</button>" +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-delete="' + U.escapeHtml(t.id) + '" aria-label="Delete ' + U.escapeHtml(t.title) + '">' + BB.icon("trash") + "</button></div></li>";
      }).join("") + "</ul>";
    U.$$("[data-complete]").forEach(function (c) {
      c.addEventListener("change", function () {
        var id = c.getAttribute("data-complete");
        BB.repo.saveTasks(tasks().map(function (t) { if (t.id === id) t.completed = c.checked; return t; }));
        BB.toast.show(c.checked ? "Nice work. Task completed." : "Task marked as not completed.", { type: "success" });
        if (c.checked) BB.fx.confetti({ count: 36 });
        renderWeek(); renderDay(); renderReminders();
        var again = U.$('[data-complete="' + id + '"]'); if (again) again.focus();
      });
    });
    U.$$("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { openTask(b.getAttribute("data-edit")); }); });
    U.$$("[data-delete]").forEach(function (b) { b.addEventListener("click", function () { deleteTask(b.getAttribute("data-delete")); }); });
  }

  function deleteTask(id) {
    var t = tasks().filter(function (x) { return x.id === id; })[0];
    if (!t) return Promise.resolve(false);
    return BB.dialog.confirm({ title: "Delete this task?", body: "<p><strong>" + U.escapeHtml(t.title) + "</strong> on " + U.formatDate(U.parseDateKey(t.date)) + " will be removed from your planner.</p>", confirmText: "Delete task", tone: "danger", focusCancel: true })
      .then(function (ok) {
        if (!ok) return false;
        BB.repo.saveTasks(tasks().filter(function (x) { return x.id !== id; }));
        BB.toast.show("Task deleted.", { type: "success" });
        renderAll();
        return true;
      });
  }

  /* ---------- Task dialog ---------- */
  function toMinutes(hhmm) { var p = String(hhmm).split(":"); return p.length === 2 ? +p[0] * 60 + +p[1] : NaN; }
  function fromMinutes(m) { m = U.clamp(m, 0, 23 * 60 + 59); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }

  function wireTaskForm() {
    var d = U.$("#task-dialog"), form = U.$("#task-form");
    BB.dialog.wire(d);
    taskValidator = BB.forms.validator(form, {
      title: [R.required("Enter what you'll study."), R.maxLength(80)],
      date: [R.required("Choose a date.")],
      start: [R.required("Choose a start time.")],
      end: [R.required("Choose an end time."), R.custom(function (v, el) {
        if (!v || !el.form.start.value) return null;
        return toMinutes(v) > toMinutes(el.form.start.value) ? null : "End time must be after the start time.";
      })],
      duration: [R.required("Enter a duration."), R.number({ min: 5, max: 480 }, "Enter between 5 and 480 minutes.")]
    }, { dependents: { start: ["end"] } });

    function syncDuration() {
      var s = toMinutes(form.start.value), e = toMinutes(form.end.value);
      if (isFinite(s) && isFinite(e) && e > s) form.duration.value = e - s;
    }
    form.start.addEventListener("change", function () {
      var dur = Number(form.duration.value) || 45;
      if (form.start.value) form.end.value = fromMinutes(toMinutes(form.start.value) + dur);
      taskValidator.check("end");
    });
    form.end.addEventListener("change", syncDuration);
    form.duration.addEventListener("input", function () {
      var dur = Number(form.duration.value);
      if (form.start.value && dur >= 5 && dur <= 480) { form.end.value = fromMinutes(toMinutes(form.start.value) + dur); taskValidator.check("end"); }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!taskValidator.validate()) return;
      var id = form.id.value;
      var data = {
        id: id || U.uid("task"),
        title: form.title.value.trim(),
        subject: form.subject.value,
        date: form.date.value,
        start: form.start.value,
        end: form.end.value,
        duration: toMinutes(form.end.value) - toMinutes(form.start.value),
        notes: form.notes.value.trim(),
        reminder: form.reminder.checked,
        completed: form.completed.checked,
        source: "student"
      };
      var clash = tasks().filter(function (t) {
        return t.id !== data.id && t.date === data.date && toMinutes(t.start) < toMinutes(data.end) && toMinutes(data.start) < toMinutes(t.end);
      })[0];
      var list = tasks().filter(function (t) { return t.id !== data.id; });
      list.push(data);
      BB.repo.saveTasks(list);
      BB.dialog.close(d);
      selected = data.date;
      weekStart = U.startOfWeek(U.parseDateKey(data.date));
      renderAll();
      BB.toast.show((id ? "Task updated." : "Task added.") + (clash ? " Heads up: it overlaps with “" + clash.title + "”." : ""), { type: clash ? "warning" : "success", duration: clash ? 6000 : 4200 });
    });

    U.$("#t-delete").addEventListener("click", function () {
      var id = form.id.value;
      BB.dialog.close(d);
      deleteTask(id).then(function (ok) { if (!ok) BB.dialog.open(d); });
    });
  }

  function openTask(id, preset) {
    var d = U.$("#task-dialog"), form = U.$("#task-form");
    form.reset();
    taskValidator.reset();
    var t = id ? tasks().filter(function (x) { return x.id === id; })[0] : null;
    preset = preset || {};
    U.$("#task-dialog-title").textContent = t ? "Edit study task" : "Add study task";
    U.$("#t-delete").hidden = !t;
    form.id.value = t ? t.id : "";
    form.title.value = t ? t.title : preset.title || "";
    var subjects = BB.repo.subjects().map(function (s) { return s.name; });
    var subj = t ? t.subject : preset.subject;
    form.subject.value = subj && subjects.indexOf(subj) !== -1 ? subj : subjects[0];
    form.date.value = t ? t.date : preset.date || U.dateKey(new Date());
    form.start.value = t ? t.start : "17:00";
    form.end.value = t ? t.end : "17:45";
    form.duration.value = t ? t.duration : 45;
    form.notes.value = t ? t.notes || "" : preset.notes || "";
    form.reminder.checked = t ? !!t.reminder : true;
    form.completed.checked = t ? !!t.completed : false;
    BB.dialog.open(d);
    form.title.focus();
  }

  /* ---------- Exams ---------- */
  function wireExamForm() {
    var d = U.$("#exam-dialog"), form = U.$("#exam-form");
    BB.dialog.wire(d);
    examValidator = BB.forms.validator(form, {
      title: [R.required("Enter the examination name."), R.maxLength(80)],
      date: [R.required("Choose the examination date."), R.custom(function (v) { return v && v < U.dateKey(new Date()) ? "Choose today or a future date." : null; })],
      time: [R.required("Choose a start time.")]
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!examValidator.validate()) return;
      var exams = BB.repo.upcomingExams();
      exams.push({ id: U.uid("exam"), subject: form.subject.value, title: form.title.value.trim(), date: form.date.value, time: form.time.value, source: "student" });
      BB.repo.saveUpcomingExams(exams);
      BB.dialog.close(d);
      BB.toast.show("Examination added.", { type: "success" });
      renderAll();
    });
  }
  function openExam() {
    var form = U.$("#exam-form");
    form.reset();
    examValidator.reset();
    form.date.min = U.dateKey(new Date());
    form.time.value = "09:00";
    BB.dialog.open(U.$("#exam-dialog"));
    form.subject.focus();
  }

  function renderExams() {
    var today = U.startOfDay(new Date());
    var exams = BB.repo.upcomingExams().filter(function (e) { return U.parseDateKey(e.date) >= today; });
    var el = U.$("#exam-list");
    if (!exams.length) { el.innerHTML = '<p class="text-sm text-secondary">No upcoming examinations. Add one to get recommended sessions before it.</p>'; return; }
    el.innerHTML = exams.map(function (e) {
      var days = U.daysBetween(today, U.parseDateKey(e.date));
      var planned = tasks().filter(function (t) { return t.subject === e.subject && t.date >= U.dateKey(today) && t.date <= e.date; }).length;
      return '<div class="side-item"><span class="exam-countdown" aria-hidden="true"><strong>' + days + "</strong><small>" + (days === 1 ? "day" : "days") + "</small></span>" +
        '<div class="side-item__text"><strong>' + U.escapeHtml(e.subject + ": " + e.title) + "</strong><span>" + U.formatDate(U.parseDateKey(e.date), "long") + ", " + e.time + ". " + U.plural(planned, "session") + " planned before it.</span>" +
        '<span class="visually-hidden">In ' + U.plural(days, "day") + ".</span></div>" +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-del-exam="' + U.escapeHtml(e.id) + '" aria-label="Remove ' + U.escapeHtml(e.subject + " " + e.title) + '">' + BB.icon("trash") + "</button></div>";
    }).join("");
    U.$$("[data-del-exam]").forEach(function (b) {
      b.addEventListener("click", function () {
        BB.dialog.confirm({ title: "Remove this examination?", body: "<p>It will be removed from your planner.</p>", confirmText: "Remove", tone: "danger", focusCancel: true }).then(function (ok) {
          if (!ok) return;
          BB.repo.saveUpcomingExams(BB.repo.upcomingExams().filter(function (x) { return x.id !== b.getAttribute("data-del-exam"); }));
          BB.toast.show("Examination removed.", { type: "success" });
          renderAll();
        });
      });
    });
  }

  /* ---------- Suggestions ---------- */
  function renderSuggestions() {
    var out = [];
    var today = U.startOfDay(new Date());
    BB.repo.upcomingExams().filter(function (e) { return U.parseDateKey(e.date) >= today; }).slice(0, 2).forEach(function (e) {
      var days = U.daysBetween(today, U.parseDateKey(e.date));
      out.push({ subject: e.subject, title: "Timed practice paper for " + e.subject, why: e.title + " in " + U.plural(days, "day") + ".", duration: 60, date: U.dateKey(U.addDays(today, Math.max(1, Math.floor(days / 2)))) });
    });
    var stats = BB.academic.subjectStats(BB.repo.attempts(), BB.repo.records(), BB.repo.subjects()).filter(function (s) { return s.avgScore != null; }).sort(function (a, b) { return a.avgScore - b.avgScore; });
    if (stats[0]) out.push({ subject: stats[0].subject, title: (stats[0].weakest ? stats[0].weakest.category + " practice" : "Focused practice") + " in " + stats[0].subject, why: "Lowest average score (" + Math.round(stats[0].avgScore) + "%)" + (stats[0].weakest ? ", weakest in " + stats[0].weakest.category : "") + ".", duration: 45, date: U.dateKey(U.addDays(today, 1)) });
    BB.recommend.current().filter(function (r) { return r.status !== "completed" && (r.category === "Time Management" || r.category === "Study Consistency"); }).slice(0, 1).forEach(function (r) {
      out.push({ subject: BB.repo.subjects()[0].name, title: actionTitle(r), why: "From your recommendation: " + r.title.toLowerCase() + ".", duration: r.category === "Study Consistency" ? 25 : 40, date: U.dateKey(U.addDays(today, 2)), notes: r.action });
    });
    var el = U.$("#suggestions");
    if (!out.length) { el.innerHTML = '<p class="text-sm text-secondary">Suggestions appear once you have upcoming exams or exam results.</p>'; return; }
    el.innerHTML = out.map(function (s, i) {
      return '<div class="side-item"><span class="subject-dot" style="background:' + BB.repo.subjectColor(s.subject) + ';width:12px;height:12px"></span>' +
        '<div class="side-item__text"><strong>' + U.escapeHtml(s.title) + "</strong><span>" + U.escapeHtml(s.why) + " About " + s.duration + " minutes.</span></div>" +
        '<button type="button" class="btn btn--sm btn--soft" data-suggest="' + i + '">Add</button></div>';
    }).join("");
    U.$$("[data-suggest]").forEach(function (b) {
      b.addEventListener("click", function () {
        var s = out[Number(b.getAttribute("data-suggest"))];
        openTask(null, { date: s.date, subject: s.subject, title: s.title, notes: s.notes || s.why });
        var form = U.$("#task-form");
        form.duration.value = s.duration;
        form.end.value = fromMinutes(toMinutes(form.start.value) + s.duration);
      });
    });
  }

  /* ---------- Reminders (demo) ---------- */
  function renderReminders() {
    var user = BB.repo.user();
    var lead = (user.preferences && user.preferences.reminderLeadMinutes) || 15;
    var enabled = !(user.preferences && user.preferences.notifications && user.preferences.notifications.studyReminders === false);
    var now = new Date();
    var upcoming = sortTasks(tasks()).filter(function (t) {
      return t.reminder && !t.completed && new Date(U.parseDateKey(t.date).getTime() + toMinutes(t.start) * 60000) > now;
    }).slice(0, 4);
    var el = U.$("#reminders");
    if (!enabled) { el.innerHTML = '<p class="text-sm text-secondary">Study reminders are turned off. You can turn them on in <a href="settings.html#notifications">Settings</a>.</p>'; return; }
    el.innerHTML = (upcoming.length
      ? upcoming.map(function (t) {
        var at = new Date(U.parseDateKey(t.date).getTime() + (toMinutes(t.start) - lead) * 60000);
        return '<div class="side-item"><span class="stat-row__icon">' + BB.icon("bell") + '</span><div class="side-item__text"><strong>' + U.escapeHtml(t.title) + "</strong><span>Would remind you at " + U.formatDate(at, "datetime") + " (" + lead + " min before).</span></div></div>";
      }).join("")
      : '<p class="text-sm text-secondary">No upcoming tasks have reminders. Turn on “Remind me” when you add a task.</p>') +
      (upcoming.length ? '<button type="button" class="btn btn--sm" id="preview-reminder" style="margin-top:12px">' + BB.icon("bell") + "Preview a reminder</button>" : "");
    var prev = U.$("#preview-reminder");
    if (prev) prev.addEventListener("click", function () {
      var t = upcoming[0];
      BB.toast.show("Reminder (demo): “" + t.title + "” starts at " + t.start + ".", { type: "info", duration: 6000 });
    });
  }
})(window.BB = window.BB || {});
