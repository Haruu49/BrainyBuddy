/**
 * Authentication
 * ─────────────────────────────────────────────────────────────────────────────
 * BB.auth is the ONLY interface pages use for sign-in state. Today it delegates
 * to DemoAuthProvider (below), which simulates accounts in localStorage.
 *
 * ⚠  DEMO ONLY — DemoAuthProvider is not secure. Passwords are hashed with a
 *    non-cryptographic function purely so they aren't stored as plain text in
 *    the demo. Replace the provider with a real one (e.g. Supabase Auth) by
 *    implementing the same methods and assigning it in `BB.auth.provider`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (BB) {
  "use strict";

  var U = BB.utils;
  var USERS_KEY = "demo.users";
  var SESSION_KEY = "demo.session";
  var DEMO_EMAIL = "demo@brainybuddy.app";

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function demoHash(password) {
    // Not cryptographic — demo only (see header).
    return "demo$" + U.hashString("bb-demo-salt:" + password).toString(16);
  }

  function AuthError(field, message) {
    this.field = field;
    this.message = message;
  }

  var DemoAuthProvider = {
    name: "demo",

    _users: function () { return BB.store.get(USERS_KEY, {}); },
    _saveUsers: function (users) { BB.store.set(USERS_KEY, users); },

    _session: function () {
      return BB.store.get(SESSION_KEY, null) || BB.store.get(SESSION_KEY, null, "session");
    },
    _startSession: function (email, remember) {
      var session = { email: email, startedAt: Date.now(), remember: !!remember };
      BB.store.remove(SESSION_KEY);
      BB.store.remove(SESSION_KEY, "session");
      BB.store.set(SESSION_KEY, session, remember ? "local" : "session");
    },

    register: function (data) {
      var self = this;
      return delay(550).then(function () {
        var email = String(data.email).trim().toLowerCase();
        var users = self._users();
        if (users[email]) throw new AuthError("email", "An account with this email already exists. Sign in instead.");
        var user = {
          id: U.uid("usr"),
          name: String(data.name).trim(),
          email: email,
          passwordHash: demoHash(data.password),
          educationLevel: data.educationLevel || "",
          institution: String(data.institution || "").trim(),
          yearOfStudy: "",
          subjects: [],
          goals: [],
          weeklyGoalHours: 8,
          onboarded: false,
          createdAt: Date.now(),
          preferences: defaultPreferences()
        };
        users[email] = user;
        self._saveUsers(users);
        self._startSession(email, true);
        return sanitize(user);
      });
    },

    signIn: function (data) {
      var self = this;
      return delay(500).then(function () {
        var email = String(data.email).trim().toLowerCase();
        var user = self._users()[email];
        if (!user || user.passwordHash !== demoHash(data.password)) {
          throw new AuthError("form", "That email and password don't match a demo account on this browser. Check them, or create an account.");
        }
        self._startSession(email, data.remember);
        return sanitize(user);
      });
    },

    signInAsDemo: function () {
      var self = this;
      return delay(350).then(function () {
        var users = self._users();
        if (!users[DEMO_EMAIL]) {
          users[DEMO_EMAIL] = {
            id: "usr-demo",
            name: "Aisha Rahman",
            email: DEMO_EMAIL,
            passwordHash: demoHash("Demo1234"),
            educationLevel: "secondary",
            institution: "Riverside Secondary School",
            yearOfStudy: "Form 5",
            subjects: ["Mathematics", "Physics", "Chemistry", "Biology", "English"],
            goals: ["exam-timing", "consistency", "improve-scores"],
            weeklyGoalHours: 10,
            onboarded: true,
            createdAt: Date.now() - 80 * U.DAY,
            preferences: defaultPreferences()
          };
          self._saveUsers(users);
        }
        self._startSession(DEMO_EMAIL, true);
        return sanitize(users[DEMO_EMAIL]);
      });
    },

    signOut: function () {
      BB.store.remove(SESSION_KEY);
      BB.store.remove(SESSION_KEY, "session");
      return Promise.resolve();
    },

    currentUser: function () {
      var s = this._session();
      if (!s) return null;
      var user = this._users()[s.email];
      return user ? sanitize(user) : null;
    },

    updateUser: function (patch) {
      var s = this._session();
      if (!s) return null;
      var users = this._users();
      var user = users[s.email];
      if (!user) return null;
      var nextEmail = patch.email ? String(patch.email).trim().toLowerCase() : user.email;
      if (nextEmail !== user.email && users[nextEmail]) throw new AuthError("email", "Another demo account already uses this email.");
      Object.keys(patch).forEach(function (k) {
        if (k === "passwordHash" || k === "id") return;
        user[k] = patch[k];
      });
      user.email = nextEmail;
      if (nextEmail !== s.email) {
        delete users[s.email];
        this._startSession(nextEmail, s.remember);
      }
      users[nextEmail] = user;
      this._saveUsers(users);
      return sanitize(user);
    },

    changePassword: function (current, next) {
      var self = this;
      return delay(450).then(function () {
        var s = self._session();
        var users = self._users();
        var user = s && users[s.email];
        if (!user) throw new AuthError("form", "You're signed out. Sign in again to change your password.");
        if (user.passwordHash !== demoHash(current)) throw new AuthError("currentPassword", "Your current password is incorrect.");
        user.passwordHash = demoHash(next);
        self._saveUsers(users);
      });
    },

    requestPasswordReset: function () {
      // A real provider would email a reset link. The demo just resolves.
      return delay(600);
    },

    deleteAccount: function () {
      var s = this._session();
      if (!s) return Promise.resolve();
      var users = this._users();
      delete users[s.email];
      this._saveUsers(users);
      return this.signOut();
    }
  };

  function defaultPreferences() {
    return {
      notifications: { studyReminders: true, examReminders: true, weeklySummary: true, recommendations: true, email: false },
      reminderLeadMinutes: 15
    };
  }

  function sanitize(user) {
    var copy = JSON.parse(JSON.stringify(user));
    delete copy.passwordHash;
    copy.preferences = copy.preferences || defaultPreferences();
    return copy;
  }

  var auth = {
    provider: DemoAuthProvider,
    AuthError: AuthError,
    DEMO_EMAIL: DEMO_EMAIL,
    get isDemo() { return this.provider.name === "demo"; },

    register: function (d) { return this.provider.register(d); },
    signIn: function (d) { return this.provider.signIn(d); },
    signInAsDemo: function () { return this.provider.signInAsDemo(); },
    signOut: function () { return this.provider.signOut(); },
    currentUser: function () { return this.provider.currentUser(); },
    updateUser: function (p) { return this.provider.updateUser(p); },
    changePassword: function (a, b) { return this.provider.changePassword(a, b); },
    requestPasswordReset: function (e) { return this.provider.requestPasswordReset(e); },
    deleteAccount: function () { return this.provider.deleteAccount(); },

    /** Guard for app pages. Redirects and returns null when access isn't allowed. */
    requireUser: function (opts) {
      opts = opts || {};
      var user = this.currentUser();
      if (!user) {
        var next = encodeURIComponent(location.pathname.split("/").slice(-2).join("/"));
        location.replace(U.root("login.html?next=" + next));
        return null;
      }
      if (!user.onboarded && !opts.allowIncompleteOnboarding) {
        location.replace(U.root("onboarding.html"));
        return null;
      }
      return user;
    },

    /** For login/register: send signed-in users onward. */
    redirectIfSignedIn: function () {
      var user = this.currentUser();
      if (!user) return false;
      location.replace(U.root(user.onboarded ? "app/dashboard.html" : "onboarding.html"));
      return true;
    },

    /** Safe post-login destination (same-site relative paths only). */
    nextUrl: function (fallback) {
      var params = new URLSearchParams(location.search);
      var next = params.get("next");
      if (next && /^app\/[a-z-]+\.html$/.test(next)) return U.root(next);
      return U.root(fallback || "app/dashboard.html");
    },

    /** The banner that makes demo behaviour obvious on every page. */
    renderDemoBanner: function (target) {
      if (!this.isDemo) return;
      var el = document.createElement("div");
      el.className = "demo-banner";
      el.setAttribute("role", "note");
      el.innerHTML = BB.icon("info", { size: "sm" }) +
        "<span>Demo mode: sign-in is simulated and everything you enter stays in this browser. No data is sent anywhere.</span>";
      if (target) target.prepend(el);
      else document.body.prepend(el);
    }
  };

  BB.auth = auth;
})(window.BB = window.BB || {});
