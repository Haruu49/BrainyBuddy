/**
 * BB.arcPath — the Brainy Buddy "answer path" arc diagram.
 *
 * Questions sit on a horizontal line. Each move from one question to the next is
 * drawn as an arc: forward moves arc ABOVE the line, moves back to an earlier
 * question arc BELOW it — so revisits are visible at a glance.
 *
 *   BB.arcPath.render(container, {
 *     questions: [{ number: 1, kind: "objective" }, …],
 *     order: [0, 1, 4, 2, …],          // visit sequence (question indices)
 *     animate: true,
 *     label: "Answer path for …"
 *   });
 */
(function (BB) {
  "use strict";

  var U = BB.utils;

  function render(container, opts) {
    if (!container) return;
    var qs = opts.questions || [];
    var order = (opts.order || []).slice();
    // collapse consecutive duplicates
    order = order.filter(function (q, i) { return i === 0 || q !== order[i - 1]; });
    var n = qs.length;
    if (!n || order.length < 1) {
      container.innerHTML = '<p class="text-secondary text-sm">No navigation was recorded for this exam.</p>';
      return;
    }

    var spacing = opts.spacing || 56;
    var chipW = Math.min(42, spacing - 8), chipH = 30;
    var padX = 24;
    var width = padX * 2 + (n - 1) * spacing + chipW;
    var maxUp = opts.maxArc || 74, maxDown = opts.maxArcDown || 56;
    var baseY = maxUp + 16;
    var height = baseY + chipH + maxDown + 16;
    var xOf = function (i) { return padX + chipW / 2 + i * spacing; };
    var reduce = U.prefersReducedMotion() || opts.animate === false;

    var arcs = "";
    var steps = order.length - 1;
    var stagger = Math.min(160, 2200 / Math.max(1, steps));
    for (var s = 0; s < steps; s++) {
      var a = order[s], b = order[s + 1];
      var x1 = xOf(a), x2 = xOf(b);
      var forward = b > a;
      var rx = Math.abs(x2 - x1) / 2;
      var ry = Math.min(rx * 0.9, forward ? maxUp : maxDown);
      var y = forward ? baseY - 2 : baseY + chipH + 2;
      var sweep = forward ? 1 : 1;
      // Above: draw left→right with sweep 1 (bulges up). Below: draw right→left with sweep 1 (bulges down).
      var d = "M" + x1 + " " + y + " A" + rx + " " + ry + " 0 0 " + sweep + " " + x2 + " " + y;
      var len = Math.round(Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)) + 4;
      var style = reduce ? "" : ' style="stroke-dasharray:' + len + ";stroke-dashoffset:" + len + ";animation-delay:" + Math.round(300 + s * stagger) + 'ms"';
      arcs += '<path class="arc ' + (forward ? "arc--forward" : "arc--back") + (reduce ? "" : " arc--animate") + '" d="' + d + '"' + style + "/>";
    }

    var visitCount = {};
    order.forEach(function (q) { visitCount[q] = (visitCount[q] || 0) + 1; });

    var chips = qs.map(function (q, i) {
      var x = xOf(i) - chipW / 2;
      var visited = visitCount[i] || 0;
      var cls = "chip-q chip-q--" + (q.kind || "objective") + (visited ? "" : " chip-q--unvisited") + (q.status ? " chip-q--" + q.status : "");
      return '<g class="' + cls + '">' +
        '<rect x="' + x + '" y="' + baseY + '" width="' + chipW + '" height="' + chipH + '" rx="8"/>' +
        '<text x="' + (x + chipW / 2) + '" y="' + (baseY + chipH / 2 + 4) + '" text-anchor="middle">' + (opts.prefix || "Q") + q.number + "</text>" +
        (visited > 1 ? '<circle cx="' + (x + chipW - 2) + '" cy="' + (baseY + 2) + '" r="8" class="chip-q__badge"/><text class="chip-q__badge-text" x="' + (x + chipW - 2) + '" y="' + (baseY + 5.5) + '" text-anchor="middle">' + visited + "</text>" : "") +
        "</g>";
    }).join("");

    var start = order[0];
    var startMarker = '<g class="arc-start"><circle cx="' + xOf(start) + '" cy="' + (baseY - 10) + '" r="4"/></g>';

    var label = opts.label || ("Answer path: " + order.map(function (q) { return "Q" + qs[q].number; }).join(", "));
    container.innerHTML =
      '<div class="arc-path">' +
      '<svg class="arc-path__svg" viewBox="0 0 ' + width + " " + height + '" style="min-width:' + Math.min(width, n * 30 + 40) + 'px;max-width:' + Math.round(width * 1.25) + 'px" role="img" aria-label="' + U.escapeHtml(label) + '">' +
      '<g class="arc-path__arcs">' + arcs + "</g>" + startMarker + chips +
      "</svg></div>";
  }

  /** Visit order from an attempt (indices). */
  function orderFromAttempt(a) {
    if (a.behaviour.navOrder) return a.behaviour.navOrder.slice();
    return a.behaviour.visits.filter(function (v) { return !v.resumed; }).map(function (v) { return v.q; });
  }

  BB.arcPath = { render: render, orderFromAttempt: orderFromAttempt };
})(window.BB = window.BB || {});
