/**
 * BB.utils — small, dependency-free helpers shared by every module.
 * Classic script (no ES modules) so the app also runs from file://.
 */
(function (BB) {
  "use strict";

  var HOUR = 3600000;
  var DAY = 86400000;

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Tagged template that escapes interpolated values unless wrapped in BB.utils.raw(). */
  function html(strings) {
    var out = strings[0];
    for (var i = 1; i < arguments.length; i++) {
      var v = arguments[i];
      if (Array.isArray(v)) v = v.map(function (x) { return x && x.__raw ? x.value : escapeHtml(x); }).join("");
      else if (v && v.__raw) v = v.value;
      else v = escapeHtml(v);
      out += v + strings[i];
    }
    return { __raw: true, value: out, toString: function () { return out; } };
  }
  function raw(value) { return { __raw: true, value: String(value), toString: function () { return String(value); } }; }

  function setHTML(el, content) {
    if (!el) return;
    el.innerHTML = content && content.__raw ? content.value : String(content);
  }

  function uid(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function sum(arr, fn) { return arr.reduce(function (a, x) { return a + (fn ? fn(x) : x); }, 0); }
  function mean(arr, fn) { return arr.length ? sum(arr, fn) / arr.length : 0; }
  function round(n, dp) { var f = Math.pow(10, dp || 0); return Math.round(n * f) / f; }
  function pct(part, whole) { return whole ? (part / whole) * 100 : 0; }
  function groupBy(arr, fn) {
    return arr.reduce(function (acc, x) {
      var k = fn(x);
      (acc[k] = acc[k] || []).push(x);
      return acc;
    }, {});
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }

  /** Pearson correlation coefficient; null when not computable. */
  function correlation(xs, ys) {
    var n = xs.length;
    if (n < 3) return null;
    var mx = mean(xs), my = mean(ys), num = 0, dx = 0, dy = 0;
    for (var i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      dx += Math.pow(xs[i] - mx, 2);
      dy += Math.pow(ys[i] - my, 2);
    }
    if (!dx || !dy) return null;
    return num / Math.sqrt(dx * dy);
  }

  /** Deterministic PRNG (mulberry32) so demo data is stable between visits. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* ---------- Dates & durations ---------- */
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfWeek(d) {
    // Weeks start on Monday
    var x = startOfDay(d);
    var day = (x.getDay() + 6) % 7;
    return addDays(x, -day);
  }
  function dateKey(d) {
    var x = new Date(d);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  function parseDateKey(key) {
    var p = String(key).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function timeKey(d) {
    var x = new Date(d);
    return String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0");
  }
  function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / DAY); }

  var fmtCache = {};
  function fmt(options) {
    var k = JSON.stringify(options);
    if (!fmtCache[k]) fmtCache[k] = new Intl.DateTimeFormat(undefined, options);
    return fmtCache[k];
  }
  function formatDate(d, style) {
    var date = new Date(d);
    if (style === "long") return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
    if (style === "short") return fmt({ day: "numeric", month: "short" }).format(date);
    if (style === "weekday") return fmt({ weekday: "short" }).format(date);
    if (style === "time") return fmt({ hour: "numeric", minute: "2-digit" }).format(date);
    if (style === "datetime") return fmt({ day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
    return fmt({ day: "numeric", month: "short", year: "numeric" }).format(date);
  }
  function relativeTime(d) {
    var diff = Date.now() - new Date(d).getTime();
    var mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return plural(hrs, "hour") + " ago";
    var days = Math.round(hrs / 24);
    if (days < 7) return plural(days, "day") + " ago";
    return formatDate(d);
  }
  /** 754000 → "12m 34s" (compact) */
  function formatDuration(ms, opts) {
    ms = Math.max(0, Math.round(ms || 0));
    var totalSec = Math.round(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (opts && opts.clock) {
      var mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
      return h ? h + ":" + mm + ":" + ss : mm + ":" + ss;
    }
    if (h) return h + "h " + (m ? m + "m" : "");
    if (m) return m + "m" + (s && !(opts && opts.noSeconds) ? " " + s + "s" : "");
    return s + "s";
  }
  function formatMinutes(min) {
    min = Math.round(min || 0);
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + " min";
    return h + "h" + (m ? " " + m + "m" : "");
  }
  function formatHours(min) { return round((min || 0) / 60, 1) + " h"; }

  function greeting(date) {
    var h = (date || new Date()).getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "BB";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  function firstName(name) { return String(name || "").trim().split(/\s+/)[0] || "there"; }

  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: type || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** Run fn once the DOM is ready. */
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /** Root-relative path prefix for pages in sub-folders (set via <html data-root="../">). */
  function root(path) {
    var prefix = document.documentElement.getAttribute("data-root") || "";
    return prefix + (path || "");
  }

  BB.utils = {
    HOUR: HOUR, DAY: DAY,
    $: $, $$: $$, escapeHtml: escapeHtml, html: html, raw: raw, setHTML: setHTML,
    uid: uid, debounce: debounce, clamp: clamp, sum: sum, mean: mean, round: round, pct: pct,
    groupBy: groupBy, plural: plural, correlation: correlation, rng: rng, hashString: hashString,
    startOfDay: startOfDay, addDays: addDays, startOfWeek: startOfWeek, dateKey: dateKey,
    parseDateKey: parseDateKey, timeKey: timeKey, daysBetween: daysBetween,
    formatDate: formatDate, relativeTime: relativeTime, formatDuration: formatDuration,
    formatMinutes: formatMinutes, formatHours: formatHours, greeting: greeting,
    initials: initials, firstName: firstName, downloadFile: downloadFile,
    prefersReducedMotion: prefersReducedMotion, ready: ready, root: root
  };
})(window.BB = window.BB || {});
