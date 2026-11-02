/**
 * BB.charts — Chart.js helpers that follow the Brainy Buddy design tokens.
 *
 *   BB.charts.create("canvasId", function (c) { return { type: "bar", data: …, options: … }; });
 *
 * The builder receives the current colour set, so charts re-colour correctly
 * when the theme changes (every registered chart is rebuilt on "bb:themechange").
 * If Chart.js failed to load, a readable fallback message replaces the canvas.
 */
(function (BB) {
  "use strict";

  var U = BB.utils;
  var registry = {};

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function colors() {
    return {
      text: css("--color-text"),
      textSecondary: css("--color-text-secondary"),
      border: css("--color-border"),
      surface: css("--color-surface"),
      primary: css("--color-control"), // stronger peach so lines and bars stay visible on white
      accent: css("--color-accent"),
      objective: css("--color-objective"),
      subjective: css("--color-subjective"),
      danger: css("--color-danger"),
      warning: "#f5a524",
      muted: css("--color-border-strong"),
      violet: "#9b87e0",
      sky: "#4fa3d9",
      rose: "#ef4f6f",
      pink: "#ec7f9c",
      palette: BB.demo.PALETTE.slice(),
      alpha: function (hex, a) {
        hex = hex.replace("#", "");
        if (hex.length === 3) hex = hex.split("").map(function (x) { return x + x; }).join("");
        var n = parseInt(hex, 16);
        return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
      }
    };
  }

  function available() { return typeof window.Chart !== "undefined"; }

  function applyDefaults(c) {
    var Chart = window.Chart;
    Chart.defaults.font.family = css("--font-sans") || "Inter, system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = c.textSecondary;
    Chart.defaults.borderColor = c.border;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.responsive = true;
    Chart.defaults.animation.duration = U.prefersReducedMotion() ? 0 : 500;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.tooltip.backgroundColor = "#3b2730";
    Chart.defaults.plugins.tooltip.titleColor = "#fff";
    Chart.defaults.plugins.tooltip.bodyColor = "#f3dcd4";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.boxPadding = 4;
    Chart.defaults.elements.bar.borderRadius = 6;
    Chart.defaults.elements.line.tension = 0.35;
    Chart.defaults.elements.point.radius = 3;
    Chart.defaults.elements.point.hoverRadius = 5;
    Chart.defaults.scale.grid.color = c.border;
    Chart.defaults.scale.border.display = false;
  }

  function fallback(canvas, message) {
    var box = canvas.parentElement;
    var div = document.createElement("div");
    div.className = "chart-fallback";
    div.setAttribute("role", "note");
    div.textContent = message || "This chart couldn't be displayed because the chart library didn't load. Reload the page to try again.";
    canvas.style.display = "none";
    if (!box.querySelector(".chart-fallback")) box.appendChild(div);
  }

  function emptyState(canvas, message) {
    destroy(canvas.id);
    fallback(canvas, message);
  }

  function create(id, build) {
    var canvas = typeof id === "string" ? document.getElementById(id) : id;
    if (!canvas) return null;
    var key = canvas.id;
    if (!available()) { fallback(canvas); return null; }
    destroy(key);
    var old = canvas.parentElement.querySelector(".chart-fallback");
    if (old) old.remove();
    canvas.style.display = "";
    var c = colors();
    applyDefaults(c);
    try {
      var config = build(c);
      if (!config) return null;
      var chart = new window.Chart(canvas, config);
      registry[key] = { chart: chart, build: build, canvas: canvas };
      return chart;
    } catch (err) {
      console.error("Chart failed: " + key, err);
      fallback(canvas, "This chart couldn't be drawn from the current data.");
      return null;
    }
  }

  function destroy(key) {
    if (registry[key]) {
      registry[key].chart.destroy();
      delete registry[key];
    }
  }

  function rebuildAll() {
    Object.keys(registry).forEach(function (k) {
      var entry = registry[k];
      if (document.body.contains(entry.canvas)) create(entry.canvas, entry.build);
      else destroy(k);
    });
  }

  function resizeAll() {
    Object.keys(registry).forEach(function (k) { registry[k].chart.resize(); });
  }

  document.addEventListener("bb:themechange", function () { setTimeout(rebuildAll, 0); });

  /** Shared axis presets */
  var axes = {
    percent: function (c, extra) {
      return Object.assign({ min: 0, max: 100, ticks: { callback: function (v) { return v + "%"; }, stepSize: 25 }, grid: { color: c.border } }, extra || {});
    },
    plain: function (c, extra) { return Object.assign({ grid: { color: c.border }, beginAtZero: true }, extra || {}); },
    category: function (extra) { return Object.assign({ grid: { display: false } }, extra || {}); }
  };

  BB.charts = {
    create: create,
    destroy: destroy,
    rebuildAll: rebuildAll,
    resizeAll: resizeAll,
    colors: colors,
    available: available,
    emptyState: emptyState,
    axes: axes
  };
})(window.BB = window.BB || {});
