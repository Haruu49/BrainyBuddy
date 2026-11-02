/** Login, registration and password reset pages (mock authentication via BB.auth). */
(function (BB) {
  "use strict";
  var U = BB.utils;
  var R = BB.forms.rules;

  BB.page.init(function () {
    BB.forms.wirePasswordToggles();
    if (U.$("#login-form")) initLogin();
    if (U.$("#register-form")) initRegister();
    if (U.$("#forgot-form")) initForgot();
  });

  function initLogin() {
    if (BB.auth.redirectIfSignedIn()) return;
    var form = U.$("#login-form");
    var errorBox = U.$("#login-error");
    var notice = U.$("#login-notice");
    var params = new URLSearchParams(location.search);

    if (params.get("signedout")) showNotice("You've signed out. See you next time.");
    else if (params.get("next")) showNotice("Sign in to continue to that page.");
    else if (params.get("deleted")) showNotice("Your demo account and its data were deleted from this browser.");

    function showNotice(text) {
      notice.innerHTML = BB.icon("info") + "<div>" + U.escapeHtml(text) + "</div>";
      notice.hidden = false;
    }

    var v = BB.forms.validator(form, {
      email: [R.required("Enter your email address."), R.email()],
      password: [R.required("Enter your password.")]
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errorBox.hidden = true;
      if (!v.validate()) return;
      var btn = U.$("#login-submit");
      BB.forms.setLoading(btn, true, "Signing in…");
      BB.auth.signIn({
        email: form.email.value,
        password: form.password.value,
        remember: form.remember.checked
      }).then(function (user) {
        location.href = user.onboarded ? BB.auth.nextUrl() : U.root("onboarding.html");
      }).catch(function (err) {
        BB.forms.setLoading(btn, false);
        errorBox.innerHTML = BB.icon("alert-circle") + "<div>" + U.escapeHtml(err.message || "Sign-in failed. Try again.") + "</div>";
        errorBox.hidden = false;
        form.password.value = "";
        form.password.focus();
      });
    });

    var demoBtn = U.$("#demo-signin");
    demoBtn.addEventListener("click", function () {
      BB.forms.setLoading(demoBtn, true, "Opening the demo…");
      BB.auth.signInAsDemo().then(function () { location.href = BB.auth.nextUrl(); });
    });
  }

  function initRegister() {
    if (BB.auth.redirectIfSignedIn()) return;
    var form = U.$("#register-form");

    U.$("#level-options").innerHTML = BB.demo.EDUCATION_LEVELS.map(function (l, i) {
      return '<label class="option-card"><input type="radio" name="educationLevel" value="' + l.value + '" id="level-' + l.value + '"' +
        (i === 0 ? ' data-error-id="educationLevel-error"' : ' data-error-id="educationLevel-error"') + ">" +
        '<span class="option-card__body"><strong>' + U.escapeHtml(l.label) + "</strong><span>" + U.escapeHtml(l.hint) + "</span></span></label>";
    }).join("");

    // Password strength meter
    var meter = U.$("#strength"), label = U.$("#strength-label");
    var LABELS = ["", "Weak", "Fair", "Good", "Strong"];
    form.password.addEventListener("input", function () {
      var s = BB.forms.passwordStrength(form.password.value);
      meter.setAttribute("data-score", String(s));
      label.textContent = form.password.value ? LABELS[Math.max(1, s)] : "";
    });

    var v = BB.forms.validator(form, {
      name: [R.required("Enter your full name."), R.minLength(2, "Enter at least 2 characters."), R.maxLength(80)],
      email: [R.required("Enter your email address."), R.email()],
      password: [R.required("Create a password."), R.password()],
      confirmPassword: [R.required("Re-enter your password."), R.matches("password", "The passwords don't match.")],
      educationLevel: [R.required("Choose your education level.")],
      institution: [R.maxLength(120)]
    }, { summary: U.$("#register-summary"), dependents: { password: ["confirmPassword"] } });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!v.validate()) return;
      var btn = U.$("#register-submit");
      BB.forms.setLoading(btn, true, "Creating your account…");
      BB.auth.register({
        name: form.name.value,
        email: form.email.value,
        password: form.password.value,
        educationLevel: form.educationLevel.value,
        institution: form.institution.value
      }).then(function () {
        location.href = U.root("onboarding.html");
      }).catch(function (err) {
        BB.forms.setLoading(btn, false);
        if (err.field) { v.setError(err.field, err.message); form[err.field] && form[err.field].focus(); }
        else BB.toast.show(err.message || "Couldn't create the account. Try again.", { type: "error" });
      });
    });
  }

  function initForgot() {
    var form = U.$("#forgot-form");
    var v = BB.forms.validator(form, { email: [R.required("Enter your email address."), R.email()] });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!v.validate()) return;
      var btn = U.$("#forgot-submit");
      BB.forms.setLoading(btn, true, "Sending…");
      BB.auth.requestPasswordReset(form.email.value).then(function () {
        BB.forms.setLoading(btn, false);
        var done = U.$("#forgot-done");
        U.$("#forgot-done-text").textContent = "If an account exists for " + form.email.value.trim() + ", a password reset link would be sent to it.";
        done.hidden = false;
        done.focus();
      });
    });
  }
})(window.BB = window.BB || {});
