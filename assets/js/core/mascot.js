/**
 * BB.mascot — "Buddy", the Brainy Buddy brain character.
 * A pink brain (like a real one) with visible folds, smart glasses and a confident smile.
 * Eyes blink now and then; clicking hosts can add .is-bouncing for a little hop.
 * Drawn as inline SVG so it scales crisply and themes cleanly.
 *
 *   BB.mascot.svg({ mood: "happy" | "thinking" | "celebrate" | "wave", title: "…" })
 *   BB.mascot.mark()  → compact logo mark (no feet, fewer folds)
 *   <div data-mascot="thinking"></div> is hydrated by BB.mascot.hydrate()
 */
(function (BB) {
  "use strict";

  var counter = 0;
  var INK = "#3b1e2b";
  // Brain pinks: light highlight → body → deeper underside, with darker folds
  var PINK_LIGHT = "#ffd0dc", PINK = "#f59ab0", PINK_DEEP = "#e7799a", FOLD = "#b8476c", FEET = "#d9668a";

  var OUTLINE =
    "M64 176C34 176 16 152 26 128C8 116 8 84 32 72C30 46 56 28 84 36C94 18 126 14 140 30" +
    "C162 16 196 28 200 56C226 64 236 98 220 116C234 140 216 170 188 172" +
    "C178 192 146 196 128 182C110 198 76 196 64 176Z";

  var FOLDS = [
    "M126 33C119 46 133 57 124 72",
    "M82 50C91 59 103 53 108 63",
    "M44 88C57 80 69 90 77 79",
    "M37 125C50 116 58 128 71 120",
    "M166 46C158 57 146 53 142 63",
    "M206 84C193 78 181 90 172 80",
    "M213 124C200 116 192 128 179 120",
    "M70 161C79 152 91 159 97 150",
    "M180 161C171 152 159 159 153 150",
    "M58 60C62 66 70 66 72 72",
    "M190 60C186 66 178 66 176 72"
  ];

  function face(mood) {
    var eyeDx = 0, eyeDy = 0;
    var brows = '<path d="M86 95Q99 88 112 93" /><path d="M136 93Q149 88 162 95" />';
    var mouth = '<path d="M108 146Q124 160 140 146" fill="none" />';
    var extra = "";

    if (mood === "thinking") {
      eyeDx = 2.5; eyeDy = -3;
      brows = '<path d="M86 96Q99 92 112 95" /><path d="M136 90Q149 82 162 90" />';
      mouth = '<path d="M114 151Q124 147 134 151" fill="none" />';
      extra =
        '<circle cx="196" cy="34" r="5" fill="#ffd5c2"/><circle cx="210" cy="18" r="7.5" fill="#ffd5c2"/>' +
        '<circle cx="228" cy="-2" r="10" fill="#ffd5c2" opacity=".9"/>';
    } else if (mood === "celebrate") {
      brows = '<path d="M86 92Q99 84 112 90" /><path d="M136 90Q149 84 162 92" />';
      mouth =
        '<path d="M106 143Q124 170 142 143Z" fill="' + INK + '" stroke-linejoin="round" />' +
        '<path d="M115 156Q124 150 133 156Q128 162 124 162Q119 162 115 156Z" fill="#ff6f91" stroke="none" />';
      extra = sparkle(28, 30, 10, "#14b8a6") + sparkle(214, 40, 12, "#f5a524") + sparkle(222, 150, 8, "#ff9466") + sparkle(14, 150, 7, "#f59ab0");
    } else if (mood === "wave") {
      extra =
        '<path d="M214 136C230 134 238 120 236 100" fill="none" stroke="' + FEET + '" stroke-width="10" stroke-linecap="round"/>' +
        '<circle cx="236" cy="94" r="10" fill="' + FEET + '"/>' +
        '<path d="M220 78Q226 70 236 72" fill="none" stroke="#14b8a6" stroke-width="3.5" stroke-linecap="round"/>';
    }

    return (
      '<g stroke="' + INK + '" stroke-width="5" stroke-linecap="round" fill="none">' + brows + "</g>" +
      // Glasses
      '<g stroke="' + INK + '" stroke-width="5" stroke-linejoin="round">' +
      '<rect x="80" y="102" width="40" height="33" rx="13" fill="#ffffff" fill-opacity=".93"/>' +
      '<rect x="128" y="102" width="40" height="33" rx="13" fill="#ffffff" fill-opacity=".93"/>' +
      '<path d="M120 116Q124 110 128 116" fill="none"/>' +
      '<path d="M80 113L64 106M168 113L184 106" fill="none" stroke-linecap="round"/>' +
      "</g>" +
      // Lens glint
      '<path d="M88 110L94 106M136 110L142 106" stroke="#fbd3de" stroke-width="3" stroke-linecap="round"/>' +
      // Eyes (grouped so they can blink)
      '<g class="mascot__eyes">' +
      '<circle cx="' + (100 + eyeDx) + '" cy="' + (120 + eyeDy) + '" r="7.5" fill="' + INK + '"/>' +
      '<circle cx="' + (148 + eyeDx) + '" cy="' + (120 + eyeDy) + '" r="7.5" fill="' + INK + '"/>' +
      '<circle cx="' + (102.6 + eyeDx) + '" cy="' + (117.2 + eyeDy) + '" r="2.6" fill="#fff"/>' +
      '<circle cx="' + (150.6 + eyeDx) + '" cy="' + (117.2 + eyeDy) + '" r="2.6" fill="#fff"/>' +
      "</g>" +
      // Cheeks — a deeper rosy pink so they read on a pink brain
      '<ellipse cx="76" cy="146" rx="9.5" ry="5.5" fill="#ff6f91" opacity=".45"/>' +
      '<ellipse cx="172" cy="146" rx="9.5" ry="5.5" fill="#ff6f91" opacity=".45"/>' +
      '<g stroke="' + INK + '" stroke-width="5" stroke-linecap="round">' + mouth + "</g>" +
      extra
    );
  }

  function sparkle(x, y, r, color) {
    var s = r, t = r * 0.28;
    return '<path d="M' + x + " " + (y - s) + "Q" + (x + t) + " " + (y - t) + " " + (x + s) + " " + y +
      "Q" + (x + t) + " " + (y + t) + " " + x + " " + (y + s) + "Q" + (x - t) + " " + (y + t) + " " + (x - s) + " " + y +
      "Q" + (x - t) + " " + (y - t) + " " + x + " " + (y - s) + 'Z" fill="' + color + '"/>';
  }

  function svg(opts) {
    opts = opts || {};
    var id = "bbm" + (++counter);
    var mood = opts.mood || "happy";
    var title = opts.title;
    var a11y = title
      ? ' role="img" aria-labelledby="' + id + 't"'
      : ' aria-hidden="true" focusable="false"';
    var cls = "mascot mascot--" + mood + (opts.className ? " " + opts.className : "");
    // Offset each Buddy's blink so several on one page don't blink in unison
    var blinkDelay = "--blink-delay:-" + ((counter * 1.7) % 6).toFixed(1) + "s";
    return (
      '<svg class="' + cls + '" style="' + blinkDelay + '" viewBox="0 -12 244 236" xmlns="http://www.w3.org/2000/svg"' + a11y + ">" +
      (title ? '<title id="' + id + 't">' + BB.utils.escapeHtml(title) + "</title>" : "") +
      "<defs>" +
      '<linearGradient id="' + id + 'g" x1="0.15" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="' + PINK_LIGHT + '"/><stop offset=".5" stop-color="' + PINK + '"/><stop offset="1" stop-color="' + PINK_DEEP + '"/>' +
      "</linearGradient>" +
      "</defs>" +
      '<ellipse cx="124" cy="214" rx="66" ry="7" fill="#5b2d1e" opacity=".12"/>' +
      // Feet
      '<g class="mascot__feet">' +
      '<rect x="94" y="184" width="20" height="24" rx="9" fill="' + FEET + '"/>' +
      '<rect x="134" y="184" width="20" height="24" rx="9" fill="' + FEET + '"/>' +
      "</g>" +
      '<g class="mascot__body">' +
      '<path d="' + OUTLINE + '" fill="url(#' + id + 'g)"/>' +
      '<path d="' + OUTLINE + '" fill="none" stroke="' + FOLD + '" stroke-opacity=".4" stroke-width="3"/>' +
      '<g fill="none" stroke="' + FOLD + '" stroke-opacity=".5" stroke-width="4.5" stroke-linecap="round">' +
      FOLDS.map(function (d) { return '<path d="' + d + '"/>'; }).join("") +
      "</g>" +
      '<ellipse cx="70" cy="62" rx="17" ry="8" transform="rotate(-28 70 62)" fill="#fff" opacity=".4"/>' +
      '<ellipse cx="150" cy="40" rx="9" ry="4" transform="rotate(-12 150 40)" fill="#fff" opacity=".28"/>' +
      face(mood) +
      "</g>" +
      "</svg>"
    );
  }

  /** Compact logo mark — reads at 24–48px. */
  function mark(opts) {
    opts = opts || {};
    var id = "bbk" + (++counter);
    return (
      '<svg class="brand__mark' + (opts.className ? " " + opts.className : "") + '" viewBox="0 8 244 196" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + id + '" x1="0.15" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="' + PINK_LIGHT + '"/><stop offset=".5" stop-color="' + PINK + '"/><stop offset="1" stop-color="' + PINK_DEEP + '"/>' +
      "</linearGradient></defs>" +
      '<path d="' + OUTLINE + '" fill="url(#' + id + ')"/>' +
      '<path d="' + OUTLINE + '" fill="none" stroke="' + FOLD + '" stroke-opacity=".45" stroke-width="5"/>' +
      '<g fill="none" stroke="' + FOLD + '" stroke-opacity=".55" stroke-width="7" stroke-linecap="round">' +
      '<path d="' + FOLDS[0] + '"/><path d="' + FOLDS[2] + '"/><path d="' + FOLDS[5] + '"/></g>' +
      '<g stroke="' + INK + '" stroke-width="8" stroke-linejoin="round">' +
      '<rect x="78" y="100" width="42" height="36" rx="14" fill="#fff"/>' +
      '<rect x="128" y="100" width="42" height="36" rx="14" fill="#fff"/>' +
      '<path d="M120 116Q124 109 128 116" fill="none"/></g>' +
      '<circle cx="100" cy="119" r="8" fill="' + INK + '"/><circle cx="148" cy="119" r="8" fill="' + INK + '"/>' +
      '<path d="M108 152Q124 164 140 152" fill="none" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>' +
      "</svg>"
    );
  }

  function hydrate(root) {
    BB.utils.$$("[data-mascot]", root).forEach(function (el) {
      if (el.getAttribute("data-mascot-done")) return;
      el.innerHTML = svg({ mood: el.getAttribute("data-mascot") || "happy", title: el.getAttribute("data-mascot-title") || null });
      el.setAttribute("data-mascot-done", "1");
    });
    BB.utils.$$("[data-brand-mark]", root).forEach(function (el) {
      if (el.getAttribute("data-mascot-done")) return;
      el.innerHTML = mark();
      el.setAttribute("data-mascot-done", "1");
    });
  }

  /** A little hop — feedback when someone clicks Buddy. Skipped for reduced motion. */
  function bounce(el) {
    if (!el || BB.utils.prefersReducedMotion()) return;
    el.classList.remove("is-bouncing");
    void el.getBoundingClientRect();
    el.classList.add("is-bouncing");
    el.addEventListener("animationend", function done(e) {
      if (e.animationName !== "bb-hop") return;
      el.classList.remove("is-bouncing");
      el.removeEventListener("animationend", done);
    });
  }

  BB.mascot = { svg: svg, mark: mark, hydrate: hydrate, bounce: bounce };
})(window.BB = window.BB || {});
