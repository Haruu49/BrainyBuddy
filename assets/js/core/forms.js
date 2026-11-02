/**
 * BB.forms — declarative client-side validation with accessible error messages.
 *
 *   var v = BB.forms.validator(form, {
 *     email: [BB.forms.rules.required("Enter your email address."), BB.forms.rules.email()],
 *   });
 *   form.addEventListener("submit", e => { e.preventDefault(); if (v.validate()) … });
 *
 * Errors render into the element with id "<field-id>-error" (created if missing),
 * linked via aria-describedby and aria-invalid. Validation runs on blur, then live once a field was touched.
 */
(function (BB) {
  "use strict";

  var U = BB.utils;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var rules = {
    required: function (msg) {
      return function (value, el) {
        if (el && (el.type === "checkbox")) return el.checked ? null : msg;
        return String(value == null ? "" : value).trim() ? null : msg;
      };
    },
    email: function (msg) {
      return function (value) {
        if (!String(value || "").trim()) return null;
        return EMAIL_RE.test(String(value).trim()) ? null : (msg || "Enter an email address in the format name@example.com.");
      };
    },
    minLength: function (n, msg) {
      return function (value) {
        if (!value) return null;
        return String(value).trim().length >= n ? null : (msg || "Use at least " + n + " characters.");
      };
    },
    maxLength: function (n, msg) {
      return function (value) {
        return String(value || "").length <= n ? null : (msg || "Use " + n + " characters or fewer.");
      };
    },
    password: function () {
      return function (value) {
        if (!value) return null;
        if (value.length < 8) return "Use at least 8 characters.";
        if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Include at least one letter and one number.";
        return null;
      };
    },
    matches: function (otherName, msg) {
      return function (value, el) {
        var other = el.form.elements[otherName];
        if (!value) return null;
        return other && other.value === value ? null : (msg || "The values don't match.");
      };
    },
    number: function (opts, msg) {
      opts = opts || {};
      return function (value) {
        if (value === "" || value == null) return null;
        var n = Number(value);
        if (!isFinite(n)) return msg || "Enter a number.";
        if (opts.min != null && n < opts.min) return msg || "Enter " + opts.min + " or more.";
        if (opts.max != null && n > opts.max) return msg || "Enter " + opts.max + " or less.";
        return null;
      };
    },
    custom: function (fn) { return fn; }
  };

  function fieldValue(form, name) {
    var el = form.elements[name];
    if (!el) return { value: "", el: null };
    // RadioNodeList / checkbox groups
    if (el instanceof RadioNodeList || (el.length && !el.tagName)) {
      var list = Array.prototype.slice.call(el);
      var first = list[0];
      if (first && first.type === "checkbox") {
        var values = list.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
        return { value: values.length ? values : "", el: first, group: list };
      }
      return { value: el.value, el: first, group: list };
    }
    return { value: el.value, el: el };
  }

  function errorElFor(el, name) {
    var id = (el.getAttribute("data-error-id")) || ((el.id || name) + "-error");
    var err = document.getElementById(id);
    if (!err) {
      err = document.createElement("p");
      err.id = id;
      err.className = "field-error";
      var field = el.closest(".field") || el.parentElement;
      field.appendChild(err);
    }
    return err;
  }

  function setError(el, name, message, group) {
    var err = errorElFor(el, name);
    var targets = group || [el];
    if (message) {
      err.innerHTML = BB.icon("alert-circle") + "<span>" + U.escapeHtml(message) + "</span>";
      targets.forEach(function (t) {
        t.setAttribute("aria-invalid", "true");
        var described = (t.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
        if (described.indexOf(err.id) === -1) described.push(err.id);
        t.setAttribute("aria-describedby", described.join(" "));
      });
    } else {
      err.innerHTML = "";
      targets.forEach(function (t) { t.removeAttribute("aria-invalid"); });
    }
  }

  function validator(form, schema, opts) {
    opts = opts || {};
    var touched = {};

    function check(name) {
      var fv = fieldValue(form, name);
      if (!fv.el) return null;
      var list = schema[name] || [];
      var message = null;
      for (var i = 0; i < list.length; i++) {
        message = list[i](fv.value, fv.el, form);
        if (message) break;
      }
      setError(fv.el, name, message, fv.group);
      return message;
    }

    Object.keys(schema).forEach(function (name) {
      var fv = fieldValue(form, name);
      if (!fv.el) return;
      var targets = fv.group || [fv.el];
      targets.forEach(function (t) {
        t.addEventListener("blur", function (e) {
          // Moving focus to a button in this form (Save, Cancel…): skip. Showing an error here
          // would shift the layout mid-click and swallow the click; submit validates everything.
          var next = e.relatedTarget;
          if (next && next.tagName === "BUTTON" && form.contains(next)) return;
          // Only validate on blur once the user has typed something, so tabbing past is quiet.
          if (t.value || touched[name]) { touched[name] = true; check(name); }
        });
        t.addEventListener(t.type === "checkbox" || t.type === "radio" || t.tagName === "SELECT" ? "change" : "input", function () {
          if (touched[name]) check(name);
          // Re-check dependent "matches" fields
          (opts.dependents && opts.dependents[name] || []).forEach(function (dep) { if (touched[dep]) check(dep); });
        });
      });
    });

    return {
      validate: function () {
        var firstInvalid = null;
        var errors = {};
        Object.keys(schema).forEach(function (name) {
          touched[name] = true;
          var msg = check(name);
          if (msg) {
            errors[name] = msg;
            if (!firstInvalid) firstInvalid = fieldValue(form, name).el;
          }
        });
        if (firstInvalid) firstInvalid.focus();
        if (opts.summary) renderSummary(opts.summary, errors, form);
        return !firstInvalid;
      },
      check: check,
      setError: function (name, message) {
        var fv = fieldValue(form, name);
        if (fv.el) setError(fv.el, name, message, fv.group);
      },
      reset: function () {
        touched = {};
        Object.keys(schema).forEach(function (name) {
          var fv = fieldValue(form, name);
          if (fv.el) setError(fv.el, name, null, fv.group);
        });
        if (opts.summary) opts.summary.hidden = true;
      }
    };
  }

  function renderSummary(container, errors, form) {
    var names = Object.keys(errors);
    if (!names.length) { container.hidden = true; container.innerHTML = ""; return; }
    container.hidden = false;
    container.innerHTML =
      BB.icon("alert-circle") +
      '<div><p class="alert__title">Check ' + (names.length === 1 ? "this field" : "these " + names.length + " fields") + "</p><ul>" +
      names.map(function (n) {
        var el = fieldValue(form, n).el;
        return '<li><a href="#' + (el && el.id) + '">' + U.escapeHtml(errors[n]) + "</a></li>";
      }).join("") +
      "</ul></div>";
  }

  /** Simple strength estimate for the password meter: 0–4. */
  function passwordStrength(pw) {
    if (!pw) return 0;
    var score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(4, score);
  }

  /** Toggle password visibility for buttons with data-toggle-password="inputId". */
  function wirePasswordToggles(root) {
    U.$$("[data-toggle-password]", root).forEach(function (btn) {
      var input = document.getElementById(btn.getAttribute("data-toggle-password"));
      if (!input) return;
      function render() {
        var visible = input.type === "text";
        btn.innerHTML = BB.icon(visible ? "eye-off" : "eye");
        btn.setAttribute("aria-label", visible ? "Hide password" : "Show password");
        btn.setAttribute("aria-pressed", String(visible));
      }
      btn.addEventListener("click", function () {
        input.type = input.type === "password" ? "text" : "password";
        render();
        input.focus();
      });
      render();
    });
  }

  function setLoading(button, loading, label) {
    if (!button) return;
    if (loading) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + U.escapeHtml(label || "Working…") + "</span>";
    } else {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      if (button.dataset.label) button.innerHTML = button.dataset.label;
    }
  }

  BB.forms = {
    rules: rules,
    validator: validator,
    passwordStrength: passwordStrength,
    wirePasswordToggles: wirePasswordToggles,
    setLoading: setLoading,
    EMAIL_RE: EMAIL_RE
  };
})(window.BB = window.BB || {});
