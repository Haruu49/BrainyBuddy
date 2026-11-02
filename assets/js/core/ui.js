/**
 * BB.ui — HTML builders for repeated app patterns (metric cards, insight cards,
 * empty states, confidence meters). Return HTML strings; inputs are escaped.
 */
(function (BB) {
  "use strict";
  var U = BB.utils;
  var e = U.escapeHtml;

  function confidence(c) {
    if (!c) return "";
    return '<span class="confidence" data-level="' + e(c.level) + '" title="' + e(c.reason || "") + '">' +
      '<span class="confidence__bars" aria-hidden="true"><i></i><i></i><i></i></span>' + e(c.label || c.level) + "</span>";
  }

  function demoBadge(text) {
    return '<span class="badge badge--demo" title="Illustrative sample data, generated for demonstration">' + BB.icon("database", { size: "sm" }) + e(text || "Demo data") + "</span>";
  }

  /** Plain numbers get a data-countup hook so pages can animate them in. */
  function valueHtml(v) {
    if (typeof v === "number" && isFinite(v)) return '<span data-countup="' + v + '">' + e(v) + "</span>";
    return e(v);
  }

  function metric(m) {
    var delta = m.delta ? '<span class="metric__delta metric__delta--' + e(m.delta.dir || "flat") + '">' +
      (m.delta.dir === "up" ? BB.icon("trending-up", { size: "sm" }) : m.delta.dir === "down" ? BB.icon("trending-down", { size: "sm" }) : "") +
      e(m.delta.text) + "</span>" : "";
    var progress = m.progress != null
      ? '<div class="progress progress--sm' + (m.progressAccent ? " progress--accent" : "") + '" role="progressbar" aria-label="' + e(m.progressLabel || m.label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(m.progress) + '" style="--value:' + U.clamp(m.progress, 0, 100) + '%"><span class="progress__bar"></span></div>'
      : "";
    return '<article class="metric-card">' +
      '<div class="metric-card__top"><span class="metric-card__icon metric-card__icon--' + e(m.tone || "primary") + '">' + BB.icon(m.icon) + "</span>" +
      '<h3 class="metric__label">' + e(m.label) + "</h3></div>" +
      '<p class="metric__value">' + (m.value == null ? '<span class="text-muted">—</span>' : valueHtml(m.value) + (m.unit ? "<small>" + e(m.unit) + "</small>" : "")) + "</p>" +
      progress +
      '<p class="metric-card__foot">' + delta + (m.foot ? '<span class="text-secondary">' + e(m.foot) + "</span>" : "") + "</p>" +
      "</article>";
  }

  function insightCard(ins, opts) {
    opts = opts || {};
    var icon = (BB.recommend && BB.recommend.CATEGORY_ICONS[ins.category]) || "lightbulb";
    var evidence = (ins.evidence || []).slice(0, opts.maxEvidence || 5);
    var headingTag = opts.headingTag || "h3";
    return '<article class="insight' + (opts.compact ? " insight--compact" : "") + '" data-category="' + e(ins.category) + '"' + (ins.id ? ' id="insight-' + e(ins.id) + '"' : "") + ">" +
      '<header class="insight__head"><span class="insight__icon">' + BB.icon(icon) + "</span>" +
      '<div class="insight__heading"><p class="insight__category">' + e(ins.category) + (opts.badge ? " " + opts.badge : "") + "</p>" +
      "<" + headingTag + ' class="insight__title">' + e(ins.title) + "</" + headingTag + "></div>" + confidence(ins.confidence) + "</header>" +
      '<dl class="insight__body">' +
      "<div><dt>Detected pattern</dt><dd>" + e(ins.pattern) + "</dd></div>" +
      "<div><dt>Supporting evidence</dt><dd>" + (evidence.length > 1 ? "<ul>" + evidence.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>" : e(evidence[0] || "")) + "</dd></div>" +
      (opts.compact ? "" : "<div><dt>Confidence</dt><dd>" + e(ins.confidence ? ins.confidence.reason : "") + "</dd></div>") +
      "<div><dt>Recommended action</dt><dd>" + e(ins.action) + "</dd></div>" +
      (ins.target && !opts.hideTarget ? '<div><dt>Improvement target</dt><dd class="insight__target">' + e(ins.target) + "</dd></div>" : "") +
      "</dl>" + (opts.footer || "") + "</article>";
  }

  function empty(o) {
    o = o || {};
    var action = o.action ? (o.action.href
      ? '<a class="btn btn--primary" href="' + e(o.action.href) + '">' + e(o.action.label) + "</a>"
      : '<button type="button" class="btn btn--primary" id="' + e(o.action.id || "") + '">' + e(o.action.label) + "</button>") : "";
    return '<div class="empty-state">' +
      (o.mood !== false ? '<div class="empty-state__art">' + BB.mascot.svg({ mood: o.mood || "thinking" }) + "</div>" : "") +
      "<" + (o.headingTag || "h3") + ' class="empty-state__title">' + e(o.title) + "</" + (o.headingTag || "h3") + ">" +
      (o.text ? "<p>" + e(o.text) + "</p>" : "") + action + "</div>";
  }

  function statRow(icon, label, value, detail) {
    return '<li class="stat-row"><span class="stat-row__icon">' + BB.icon(icon) + '</span><div class="stat-row__text"><span class="stat-row__label">' + e(label) + "</span>" +
      (detail ? '<span class="stat-row__detail">' + e(detail) + "</span>" : "") + '</div><span class="stat-row__value">' + e(value) + "</span></li>";
  }

  function skeleton(lines) {
    var out = "";
    for (var i = 0; i < (lines || 3); i++) out += '<div class="skeleton" style="height:14px;margin:10px 0;width:' + (90 - i * 15) + '%"></div>';
    return '<div aria-hidden="true">' + out + "</div>";
  }

  /** Count numbers up from zero (one load moment per page). Final text is restored exactly. */
  function countUp(root, opts) {
    if (U.prefersReducedMotion()) return;
    var dur = (opts && opts.duration) || 900;
    U.$$("[data-countup]", root).forEach(function (el) {
      var target = Number(el.getAttribute("data-countup"));
      var finalText = el.textContent;
      if (!isFinite(target) || target === 0) return;
      var decimals = (finalText.split(".")[1] || "").length;
      var start = null;
      function frame(t) {
        if (start == null) start = t;
        var p = Math.min(1, (t - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(decimals);
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = finalText;
      }
      el.textContent = (0).toFixed(decimals);
      requestAnimationFrame(frame);
    });
  }

  BB.ui = { confidence: confidence, demoBadge: demoBadge, metric: metric, insightCard: insightCard, empty: empty, statRow: statRow, skeleton: skeleton, countUp: countUp };

  /** BB.fx.confetti() — a short burst for real achievements. Skipped for reduced motion. */
  var CONFETTI_COLORS = ["#ffa781", "#f59ab0", "#14b8a6", "#fcd27a", "#ff9466", "#9b87e0"];
  function confetti(opts) {
    opts = opts || {};
    if (U.prefersReducedMotion()) return;
    var box = document.createElement("div");
    box.className = "confetti";
    box.setAttribute("aria-hidden", "true");
    var html = "";
    for (var i = 0; i < (opts.count || 70); i++) {
      var round = i % 4 === 0;
      html += '<i style="left:' + (Math.random() * 100).toFixed(1) + "%;" +
        "background:" + CONFETTI_COLORS[i % CONFETTI_COLORS.length] + ";" +
        (round ? "width:10px;height:10px;border-radius:50%;" : "") +
        "--dx:" + Math.round((Math.random() - 0.5) * 260) + "px;" +
        "--dy:" + Math.round(55 + Math.random() * 45) + "vh;" +
        "--rot:" + Math.round(360 + Math.random() * 540) * (Math.random() < 0.5 ? -1 : 1) + "deg;" +
        "--delay:" + Math.round(Math.random() * 280) + "ms;" +
        "--fall:" + Math.round(1300 + Math.random() * 1100) + 'ms"></i>';
    }
    box.innerHTML = html;
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3000);
  }
  BB.fx = { confetti: confetti };
})(window.BB = window.BB || {});
