/**
 * BB.store — namespaced, failure-tolerant wrapper around Web Storage.
 * Everything Brainy Buddy saves locally goes through here (prefix "bb.").
 * When a backend is connected, BB.repo is the layer that changes — not this.
 */
(function (BB) {
  "use strict";

  var PREFIX = "bb.";
  var memory = {};

  function backend(kind) {
    try {
      var s = kind === "session" ? window.sessionStorage : window.localStorage;
      var probe = PREFIX + "__probe";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return s;
    } catch (e) {
      return null;
    }
  }

  function get(key, fallback, kind) {
    var s = backend(kind);
    try {
      var raw = s ? s.getItem(PREFIX + key) : memory[PREFIX + key];
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value, kind) {
    var s = backend(kind);
    var raw = JSON.stringify(value);
    try {
      if (s) s.setItem(PREFIX + key, raw);
      else memory[PREFIX + key] = raw;
      return true;
    } catch (e) {
      // Quota exceeded or storage blocked
      if (BB.toast) BB.toast.show("Couldn't save to this browser's storage. Free up space and try again.", { type: "error" });
      return false;
    }
  }

  function remove(key, kind) {
    var s = backend(kind);
    try {
      if (s) s.removeItem(PREFIX + key);
      delete memory[PREFIX + key];
    } catch (e) { /* ignore */ }
  }

  /** Remove every Brainy Buddy key (used by "Reset demo data"). */
  function clearAll(options) {
    var keep = (options && options.keep) || [];
    ["local", "session"].forEach(function (kind) {
      var s = backend(kind);
      if (!s) return;
      var keys = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf(PREFIX) === 0 && keep.indexOf(k.slice(PREFIX.length)) === -1) keys.push(k);
      }
      keys.forEach(function (k) { s.removeItem(k); });
    });
  }

  function available() { return !!backend(); }

  BB.store = { get: get, set: set, remove: remove, clearAll: clearAll, available: available };
})(window.BB = window.BB || {});
