/** Settings */
(function (BB) {
  "use strict";
  var U = BB.utils, R = BB.forms.rules;
  var user;

  BB.app.init({ page: "settings", title: "Settings" }, function (ctx) {
    user = ctx.user;
    initProfile();
    initEducation();
    initSubjects();
    initNotifications();
    initTheme();
    initAccount();
    initNav();
  });

  function save(patch, message) {
    try {
      user = BB.auth.updateUser(patch);
      if (message) BB.toast.show(message, { type: "success" });
      return true;
    } catch (err) {
      BB.toast.show(err.message || "Couldn't save your changes.", { type: "error" });
      return false;
    }
  }

  function refreshIdentity() {
    U.$("#profile-avatar").textContent = U.initials(user.name);
    U.$("#profile-name-display").textContent = user.name;
    U.$("#profile-since").textContent = "Member since " + U.formatDate(user.createdAt);
    var pb = U.$("#profile-btn");
    if (pb) {
      U.$(".avatar", pb).textContent = U.initials(user.name);
      U.$(".profile-btn__name", pb).textContent = U.firstName(user.name);
      pb.setAttribute("aria-label", "Account menu for " + user.name);
    }
  }

  /* ---------- Profile ---------- */
  function initProfile() {
    var form = U.$("#profile-form");
    form.name.value = user.name;
    form.email.value = user.email;
    refreshIdentity();
    var v = BB.forms.validator(form, {
      name: [R.required("Enter your full name."), R.minLength(2, "Enter at least 2 characters."), R.maxLength(80)],
      email: [R.required("Enter your email address."), R.email()]
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!v.validate()) return;
      try {
        user = BB.auth.updateUser({ name: form.name.value.trim(), email: form.email.value.trim() });
        refreshIdentity();
        BB.toast.show("Profile saved.", { type: "success" });
      } catch (err) {
        if (err.field) { v.setError(err.field, err.message); form[err.field].focus(); }
        else BB.toast.show(err.message, { type: "error" });
      }
    });
  }

  /* ---------- Education ---------- */
  function initEducation() {
    var form = U.$("#education-form");
    U.$("#level-options").innerHTML = BB.demo.EDUCATION_LEVELS.map(function (l) {
      return '<label class="option-card"><input type="radio" name="educationLevel" value="' + l.value + '" data-error-id="level-error"' + (user.educationLevel === l.value ? " checked" : "") + '><span class="option-card__body"><strong>' + U.escapeHtml(l.label) + "</strong><span>" + U.escapeHtml(l.hint) + "</span></span></label>";
    }).join("");
    form.institution.value = user.institution || "";
    form.yearOfStudy.value = user.yearOfStudy || "";
    form.weeklyGoalHours.value = user.weeklyGoalHours || 8;
    var v = BB.forms.validator(form, {
      educationLevel: [R.required("Choose your education level.")],
      institution: [R.maxLength(120)],
      yearOfStudy: [R.maxLength(40)],
      weeklyGoalHours: [R.required("Enter your weekly study goal."), R.custom(function (val) {
        var n = Number(val);
        return isFinite(n) && n >= 1 && n <= 60 && Math.floor(n) === n ? null : "Enter a whole number of hours from 1 to 60.";
      })]
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!v.validate()) return;
      save({
        educationLevel: form.educationLevel.value,
        institution: form.institution.value.trim(),
        yearOfStudy: form.yearOfStudy.value.trim(),
        weeklyGoalHours: Number(form.weeklyGoalHours.value)
      }, "Education information saved.");
    });
  }

  /* ---------- Subjects ---------- */
  function initSubjects() {
    U.$("#subject-catalog").innerHTML = BB.demo.CATALOG.map(function (s) { return '<option value="' + U.escapeHtml(s) + '"></option>'; }).join("");
    renderSubjects();
    var form = U.$("#subject-form");
    var input = U.$("#new-subject");
    var err = U.$("#new-subject-error");
    function showErr(msg) {
      err.innerHTML = msg ? BB.icon("alert-circle") + "<span>" + U.escapeHtml(msg) + "</span>" : "";
      if (msg) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", "new-subject-error"); input.focus(); }
      else input.removeAttribute("aria-invalid");
    }
    input.addEventListener("input", function () { if (err.textContent) showErr(null); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = input.value.trim().replace(/\s+/g, " ");
      if (!val) return showErr("Type a subject name first.");
      if (val.length < 2) return showErr("Use at least 2 characters.");
      var list = user.subjects && user.subjects.length ? user.subjects : BB.demo.DEFAULT_SUBJECTS.slice();
      if (list.some(function (s) { return s.toLowerCase() === val.toLowerCase(); })) return showErr(val + " is already in your subjects.");
      var match = BB.demo.CATALOG.filter(function (s) { return s.toLowerCase() === val.toLowerCase(); })[0];
      if (save({ subjects: list.concat([match || val]) }, (match || val) + " added.")) {
        input.value = "";
        showErr(null);
        renderSubjects();
      }
    });
  }

  function renderSubjects() {
    var subs = BB.demo.subjectsFor(user);
    var box = U.$("#subject-chips");
    box.innerHTML = subs.map(function (s) {
      return '<span class="chip is-selected" style="border-color:' + s.color + '"><span class="subject-dot" style="background:' + s.color + '"></span>' + U.escapeHtml(s.name) +
        (BB.questionBank.has(s.name) ? '<span class="badge badge--primary">Practice exams</span>' : "") +
        '<button type="button" class="chip__remove" data-remove="' + U.escapeHtml(s.name) + '" aria-label="Remove ' + U.escapeHtml(s.name) + '">' + BB.icon("x", { size: "sm" }) + "</button></span>";
    }).join("");
    U.$$("[data-remove]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-remove");
        var list = (user.subjects && user.subjects.length ? user.subjects : BB.demo.DEFAULT_SUBJECTS).slice();
        if (list.length <= 1) { BB.toast.show("Keep at least one subject. Add another before removing this one.", { type: "warning" }); return; }
        BB.dialog.confirm({ title: "Remove " + name + "?", body: "<p>It will no longer appear in your subject lists. Past results for " + U.escapeHtml(name) + " are kept.</p>", confirmText: "Remove subject", tone: "danger", focusCancel: true })
          .then(function (ok) {
            if (!ok) return;
            if (save({ subjects: list.filter(function (s) { return s !== name; }) }, name + " removed.")) {
              renderSubjects();
              U.$("#new-subject").focus();
            }
          });
      });
    });
  }

  /* ---------- Notifications ---------- */
  function initNotifications() {
    var form = U.$("#notif-form");
    var prefs = user.preferences || {};
    var n = prefs.notifications || {};
    ["studyReminders", "examReminders", "recommendations", "weeklySummary", "email"].forEach(function (k) { form[k].checked = !!n[k]; });
    form.reminderLeadMinutes.value = String(prefs.reminderLeadMinutes || 15);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var next = Object.assign({}, user.preferences || {});
      next.notifications = {
        studyReminders: form.studyReminders.checked,
        examReminders: form.examReminders.checked,
        recommendations: form.recommendations.checked,
        weeklySummary: form.weeklySummary.checked,
        email: form.email.checked
      };
      next.reminderLeadMinutes = Number(form.reminderLeadMinutes.value);
      save({ preferences: next }, "Notification preferences saved.");
    });
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    var pref = BB.theme.preference();
    U.$$('input[name="theme"]').forEach(function (r) {
      r.checked = r.value === pref;
      r.addEventListener("change", function () {
        BB.theme.set(r.value);
        BB.toast.show({ light: "Light theme on.", dark: "Dark theme on.", system: "Theme now matches your device." }[r.value], { type: "success" });
      });
    });
  }

  /* ---------- Account ---------- */
  function initAccount() {
    var form = U.$("#password-form");
    var v = BB.forms.validator(form, {
      currentPassword: [R.required("Enter your current password.")],
      newPassword: [R.required("Enter a new password."), R.password(), R.custom(function (val, el) { return val && val === el.form.currentPassword.value ? "Choose a password different from your current one." : null; })],
      confirmNew: [R.required("Re-enter your new password."), R.matches("newPassword", "The new passwords don't match.")]
    }, { dependents: { newPassword: ["confirmNew"] } });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!v.validate()) return;
      var btn = U.$("#pw-submit");
      BB.forms.setLoading(btn, true, "Updating…");
      BB.auth.changePassword(form.currentPassword.value, form.newPassword.value).then(function () {
        BB.forms.setLoading(btn, false);
        form.reset();
        v.reset();
        BB.toast.show("Password updated.", { type: "success" });
      }).catch(function (err) {
        BB.forms.setLoading(btn, false);
        if (err.field && form[err.field]) { v.setError(err.field, err.message); form[err.field].focus(); }
        else BB.toast.show(err.message, { type: "error" });
      });
    });

    var demo = U.$("#demo-toggle");
    demo.checked = BB.repo.showDemo();
    demo.addEventListener("change", function () {
      var prefs = Object.assign({}, user.preferences || {}, { showDemoData: demo.checked });
      save({ preferences: prefs });
      // Keep planner content in line with the setting
      if (!demo.checked) {
        BB.repo.saveTasks(BB.repo.tasks().filter(function (t) { return t.source !== "demo"; }));
        BB.repo.saveUpcomingExams(BB.repo.upcomingExams().filter(function (x) { return x.source !== "demo"; }));
      } else {
        var tasks = BB.repo.tasks(), exams = BB.repo.upcomingExams();
        if (!tasks.some(function (t) { return t.source === "demo"; })) BB.repo.saveTasks(tasks.concat(BB.demo.seedTasks(user, new Date())));
        if (!exams.some(function (x) { return x.source === "demo"; })) BB.repo.saveUpcomingExams(exams.concat(BB.demo.seedUpcomingExams(user, new Date())));
      }
      BB.toast.show(demo.checked ? "Demo data is shown again." : "Demo data hidden. You'll only see what you've recorded.", { type: "success" });
    });

    U.$("#export-btn").addEventListener("click", function () {
      var data = BB.repo.exportAll();
      U.downloadFile("brainy-buddy-data-" + U.dateKey(new Date()) + ".json", JSON.stringify(data, null, 2), "application/json");
      BB.toast.show("Your data was exported.", { type: "success" });
    });

    U.$("#reset-btn").addEventListener("click", function () {
      BB.dialog.confirm({
        title: "Reset your data?",
        body: "<p>This deletes your exams, study sessions, planner tasks, imported records and recommendation progress from this browser. Your profile and settings stay. <strong>This can't be undone.</strong></p>",
        confirmText: "Reset data",
        tone: "danger",
        focusCancel: true
      }).then(function (ok) {
        if (!ok) return;
        BB.repo.resetUserData();
        BB.toast.show("Your data was reset.", { type: "success" });
        setTimeout(function () { location.href = "dashboard.html"; }, 600);
      });
    });

    U.$("#delete-btn").addEventListener("click", function () {
      BB.dialog.confirm({
        title: "Delete your account?",
        body: "<p>Your demo account <strong>" + U.escapeHtml(user.email) + "</strong> and everything recorded with it will be deleted from this browser. <strong>This can't be undone.</strong></p>",
        confirmText: "Delete account",
        tone: "danger",
        focusCancel: true
      }).then(function (ok) {
        if (!ok) return;
        BB.repo.resetUserData();
        BB.auth.deleteAccount().then(function () { location.href = "../login.html?deleted=1"; });
      });
    });
  }

  /* ---------- Section nav ---------- */
  function initNav() {
    var links = U.$$(".settings-nav a");
    function mark(id) { links.forEach(function (a) { a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + id)); }); }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) mark(en.target.id); });
      }, { rootMargin: "-30% 0px -60% 0px" });
      U.$$(".settings-section").forEach(function (s) { io.observe(s); });
    }
    mark(location.hash ? location.hash.slice(1) : "profile");
    if (location.hash) {
      var t = document.getElementById(location.hash.slice(1));
      if (t) setTimeout(function () { t.scrollIntoView({ block: "start" }); var f = t.querySelector("input, select, button"); if (f) f.focus({ preventScroll: true }); }, 60);
    }
  }
})(window.BB = window.BB || {});
