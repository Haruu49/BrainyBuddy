/**
 * BB.mascot — "Buddy", the Brainy Buddy brain character.
 * A pink brain (like a real one) with visible folds, smart glasses and a confident smile.
 * Buddy breathes, blinks, follows the pointer with its eyes and can wave and talk.
 * Drawn as inline SVG so it scales crisply and themes cleanly.
 *
 *   BB.mascot.svg({ mood: "happy" | "thinking" | "celebrate" | "wave", title: "…" })
 *   BB.mascot.mark()  → compact logo mark (no feet, fewer folds)
 *   BB.mascot.bounce(svgEl) / BB.mascot.wave(svgEl) → one-off hop / wave
 *   BB.mascot.interactive(hostEl, { mood, place, greet, lines }) → clickable Buddy with a speech bubble
 *   <div data-mascot="thinking"></div> is hydrated by BB.mascot.hydrate()
 *   <div data-mascot="wave" data-mascot-greet="load|view|click" data-bubble="top|top-start|left"></div>
 *     → an interactive Buddy that says hi on load, when scrolled into view, or only when clicked
 *   …plus data-mascot-watch="#form-id" → Buddy walks over to watch you type, and looks away from passwords
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
    }

    return (
      '<g class="mascot__face">' +
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
      // Eyes: the outer group looks toward the pointer, the inner one blinks
      '<g class="mascot__look"><g class="mascot__eyes">' +
      '<circle cx="' + (100 + eyeDx) + '" cy="' + (120 + eyeDy) + '" r="7.5" fill="' + INK + '"/>' +
      '<circle cx="' + (148 + eyeDx) + '" cy="' + (120 + eyeDy) + '" r="7.5" fill="' + INK + '"/>' +
      '<circle cx="' + (102.6 + eyeDx) + '" cy="' + (117.2 + eyeDy) + '" r="2.6" fill="#fff"/>' +
      '<circle cx="' + (150.6 + eyeDx) + '" cy="' + (117.2 + eyeDy) + '" r="2.6" fill="#fff"/>' +
      "</g></g>" +
      // Cheeks — a deeper rosy pink so they read on a pink brain
      '<ellipse cx="76" cy="146" rx="9.5" ry="5.5" fill="#ff6f91" opacity=".45"/>' +
      '<ellipse cx="172" cy="146" rx="9.5" ry="5.5" fill="#ff6f91" opacity=".45"/>' +
      '<g class="mascot__mouth" stroke="' + INK + '" stroke-width="5" stroke-linecap="round">' + mouth + "</g>" +
      // Little "o" for whistling while Buddy looks away from a password
      '<ellipse class="mascot__whistle" cx="128" cy="151" rx="4.5" ry="5.5" fill="#7a2e45" stroke="' + INK + '" stroke-width="3.5"/>' +
      "</g>" +
      extra + arm()
    );
  }

  /** Waving arm. Every mood has one; it only shows in the "wave" mood or while .is-waving.
   *  The other hand holds a magnifying glass that only shows while Buddy reads a form field. */
  function arm() {
    return (
      '<g class="mascot__magnifier"><g class="mascot__magnifier-inner">' +
      '<path d="M27 142C19 147 10 145 4 139" fill="none" stroke="' + FEET + '" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M-13 121L3 137" stroke="#7a4a33" stroke-width="8" stroke-linecap="round"/>' +
      '<circle cx="3" cy="138" r="9" fill="' + FEET + '"/>' +
      '<circle cx="-32" cy="102" r="25" fill="#e3f6ff" fill-opacity=".75" stroke="' + INK + '" stroke-width="5"/>' +
      // The last character typed, magnified
      '<text class="mascot__lens-char" x="-32" y="112.5" text-anchor="middle" font-size="30" fill="' + INK + '"></text>' +
      '<path d="M-48 94Q-45 85 -36 83" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>' +
      "</g></g>" +
      '<g class="mascot__arm">' +
      '<path d="M214 136C230 134 238 120 236 100" fill="none" stroke="' + FEET + '" stroke-width="10" stroke-linecap="round"/>' +
      '<circle cx="236" cy="94" r="10" fill="' + FEET + '"/>' +
      "</g>" +
      '<path class="mascot__wave-line" d="M220 78Q226 70 236 72" fill="none" stroke="#14b8a6" stroke-width="3.5" stroke-linecap="round"/>'
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
      '<rect class="mascot__foot mascot__foot--l" x="94" y="184" width="20" height="24" rx="9" fill="' + FEET + '"/>' +
      '<rect class="mascot__foot mascot__foot--r" x="134" y="184" width="20" height="24" rx="9" fill="' + FEET + '"/>' +
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
      var mood = el.getAttribute("data-mascot") || "happy";
      if (el.hasAttribute("data-mascot-greet")) {
        var first = el.getAttribute("data-mascot-say");
        var buddy = interactive(el, {
          mood: mood,
          place: el.getAttribute("data-bubble") || "top",
          greet: el.getAttribute("data-mascot-greet") || "click",
          lines: first ? [first].concat(LINES.slice(1)) : LINES
        });
        var watchSel = el.getAttribute("data-mascot-watch");
        if (watchSel) buddy.watch(document.querySelector(watchSel));
      } else {
        el.innerHTML = svg({ mood: mood, title: el.getAttribute("data-mascot-title") || null });
      }
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

  /** Raise an arm and wave. Buddies in the "wave" mood wave a little harder. Skipped for reduced motion. */
  function wave(el) {
    if (!el || BB.utils.prefersReducedMotion()) return;
    el.classList.remove("is-waving");
    void el.getBoundingClientRect();
    el.classList.add("is-waving");
    clearTimeout(el._bbWave);
    el._bbWave = setTimeout(function () { el.classList.remove("is-waving"); }, 2000);
  }

  /* ---------- Talking Buddy: click to hear the next line ---------- */
  var LINES = [
    "Hi! Get Ready To Brainy!",
    "Let's learn smarter together!",
    "Hehe, that tickles!",
    "Practise a little every day, and I'll keep track!"
  ];
  var TYPE_MS = 45;

  /**
   * Turn hostEl into a clickable Buddy with a speech bubble.
   * opts.greet: "load" (say hi shortly after load), "view" (when first scrolled into view) or "click" (only when clicked).
   * opts.place: where the bubble sits: "top" (centred), "top-start" (left-aligned) or "left".
   */
  function interactive(host, opts) {
    if (host._bbBuddy) return host._bbBuddy;
    opts = opts || {};
    var U = BB.utils;
    var lines = opts.lines && opts.lines.length ? opts.lines : LINES;
    host.classList.add("mascot-host");
    host.innerHTML =
      '<button type="button" class="buddy-btn" aria-label="Say hi to Buddy">' + svg({ mood: opts.mood || "happy" }) + "</button>" +
      '<span class="mascot-bubble" data-place="' + (opts.place || "top") + '" aria-hidden="true">' +
      '<span class="mascot-bubble__size"></span><span class="mascot-bubble__text"></span></span>' +
      '<span class="mascot-notes" aria-hidden="true"><i>♪</i><i>♫</i><i>♪</i></span>' +
      '<span class="visually-hidden" role="status"></span>';

    var btn = host.firstChild;
    var buddy = U.$(".mascot", btn);
    // A thinking Buddy cheers up while it talks, then goes back to thinking
    var baseMood = opts.mood || "happy";
    var talkMood = baseMood === "thinking" ? "happy" : baseMood;
    var shownMood = baseMood;
    function setMood(mood) {
      if (mood === shownMood) return;
      shownMood = mood;
      btn.innerHTML = svg({ mood: mood });
      buddy = U.$(".mascot", btn);
      requestLook();
      showLens(false);
    }

    /** Put the last typed character in the magnifying glass; pop → a little zoom as it changes. */
    function showLens(pop) {
      var t = U.$(".mascot__lens-char", btn);
      if (!t) return;
      t.textContent = host._bbLens || "";
      if (!pop) return;
      t.classList.remove("is-pop");
      void t.getBoundingClientRect();
      t.classList.add("is-pop");
    }
    var bubble = U.$(".mascot-bubble", host);
    var sizer = U.$(".mascot-bubble__size", bubble);
    var typed = U.$(".mascot-bubble__text", bubble);
    var live = U.$('[role="status"]', host);
    var index = -1, typeTimer = 0, hideTimer = 0, lastWave = 0;

    function hide() {
      bubble.classList.remove("is-shown");
      hideTimer = setTimeout(function () { setMood(baseMood); }, 400);
    }

    function say(i, announce) {
      index = i % lines.length;
      speak(lines[index], { announce: announce, gesture: true });
    }

    /** Show text in the bubble. opts.announce → also tell screen readers; opts.gesture → hop and wave. */
    function speak(text, o) {
      o = o || {};
      clearInterval(typeTimer);
      clearTimeout(hideTimer);
      // The hidden sizer holds the full line, so the bubble opens at its final size and doesn't grow while typing
      sizer.textContent = text;
      typed.textContent = "";
      setMood(talkMood);
      bubble.classList.add("is-shown");
      if (o.gesture) {
        bounce(buddy);
        wave(buddy);
        lastWave = Date.now();
      }
      if (o.announce) live.textContent = text;

      var holdMs = Math.max(3200, 1600 + text.length * 70);
      if (U.prefersReducedMotion()) {
        typed.textContent = text;
        hideTimer = setTimeout(hide, holdMs);
        return;
      }
      var n = 0;
      typed.classList.add("is-typing");
      typeTimer = setInterval(function () {
        n++;
        typed.textContent = text.slice(0, n);
        if (n >= text.length) {
          clearInterval(typeTimer);
          typed.classList.remove("is-typing");
          hideTimer = setTimeout(hide, holdMs);
        }
      }, TYPE_MS);
    }

    btn.addEventListener("click", function () { say(index + 1, true); });
    // A quick wave when the pointer arrives, at most every couple of seconds
    btn.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse" || Date.now() - lastWave < 2200) return;
      lastWave = Date.now();
      wave(buddy);
    });

    var greet = opts.greet || "click";
    if (greet === "load") {
      setTimeout(function () { if (index < 0) say(0, false); }, 700);
    } else if (greet === "view") {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          setTimeout(function () { if (index < 0) say(0, false); }, 400);
        }, { threshold: 0.6 });
        io.observe(host);
      } else {
        setTimeout(function () { if (index < 0) say(0, false); }, 700);
      }
    }

    /* ---------- Watching a form: walk over to see what you type, look away from passwords ---------- */
    var notes = U.$(".mascot-notes", host);
    var walkTimer = 0, mode = "idle", field = null, side = -1;
    var measure = document.createElement("canvas").getContext("2d");

    function walkTo(x) {
      if (U.prefersReducedMotion()) x = 0; // Stay put; turning the face and eyes is enough
      var from = host._bbX || 0;
      if (Math.abs(x - from) < 2) return;
      var secs = Math.min(1.4, Math.max(0.45, Math.abs(x - from) / 240));
      host._bbX = x;
      host.style.transitionDuration = secs + "s";
      host.style.transform = x ? "translateX(" + x.toFixed(1) + "px)" : "";
      host.classList.add("is-walking");
      clearTimeout(walkTimer);
      walkTimer = setTimeout(function () { host.classList.remove("is-walking"); requestLook(); }, secs * 1000);
    }

    /** How far Buddy can walk toward (dir -1 = left, 1 = right) the edge of its panel, keeping `extra` px clear. */
    function room(dir, extra) {
      var panel = host.offsetParent;
      if (!panel) return 0;
      var gap = 12 + (extra || 0);
      return dir < 0 ? gap - host.offsetLeft : panel.clientWidth - gap - host.offsetLeft - host.offsetWidth;
    }

    /** Where the typing caret is, so Buddy can read along. */
    function caret(input) {
      var r = input.getBoundingClientRect();
      var cs = getComputedStyle(input);
      measure.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
      var inner = Math.max(1, r.width - padL - padR);
      var w = Math.min(inner, measure.measureText(input.value).width);
      return { x: r.left + padL + w, y: r.top + r.height / 2, progress: w / inner };
    }

    function follow() {
      if (!field) return;
      var c = caret(field);
      host._bbLook = { x: c.x, y: c.y };
      // Turn the face toward the field, a little less (or more) as the text grows toward Buddy
      host.style.setProperty("--face-x", ((side < 0 ? -9 : 4) + 5 * c.progress).toFixed(1) + "px");
      requestLook();
      host._bbLens = field.value.slice(-1);
      showLens(true);
    }

    function peek(input) {
      var wasPeeking = mode === "peek";
      mode = "peek";
      field = input;
      var r = input.getBoundingClientRect(), b = host.getBoundingClientRect();
      side = r.left + r.width / 2 < b.left + b.width / 2 ? -1 : 1;
      host.classList.remove("is-shy");
      host.classList.add("is-peeking");
      // The magnifying glass is drawn on Buddy's left, so it comes out when the field is to the left
      var magnify = side < 0;
      host.classList.toggle("is-magnifying", magnify);
      host.style.setProperty("--face-y", "2px");
      host.style.setProperty("--lean", side * 4 + "deg");
      walkTo(room(side, magnify ? host.offsetWidth * 62 / 244 : 0));
      follow();
      if (!wasPeeking) speak("Let me take a closer look!");
    }

    function lookAway(input) {
      if (mode === "shy") return;
      mode = "shy";
      field = null;
      var r = input.getBoundingClientRect(), b = host.getBoundingClientRect();
      side = r.left + r.width / 2 < b.left + b.width / 2 ? -1 : 1;
      host.classList.remove("is-peeking", "is-magnifying");
      host.classList.add("is-shy");
      host.style.setProperty("--face-x", -side * 9 + "px");
      host.style.setProperty("--face-y", "-5px");
      host.style.setProperty("--lean", -side * 3 + "deg");
      notes.style.left = side < 0 ? "68%" : "8%";
      host._bbLook = { dx: -side * 4.5, dy: -3.5 };
      requestLook();
      // Step away from the form, but not past the edge of the panel
      walkTo(-side * Math.max(0, Math.min(40, room(-side))));
      speak("I'm not looking, promise!");
    }

    function goHome() {
      if (mode === "idle") return;
      mode = "idle";
      field = null;
      host.classList.remove("is-peeking", "is-shy", "is-magnifying");
      host._bbLook = null;
      requestLook();
      walkTo(0);
    }

    function watch(form) {
      if (!form || host._bbWatching) return;
      host._bbWatching = true;
      var fields = U.$$("input", form).filter(function (el) { return /^(email|text|password|tel|search|url)$/.test(el.type); });
      // Remember which fields are secret now: "show password" turns them into text fields later
      fields.forEach(function (el) { el._bbSecret = el.type === "password"; });
      function secretNear(el) {
        var group = el.closest && el.closest(".input-group");
        return !!(group && fields.some(function (f) { return f._bbSecret && group.contains(f); }));
      }
      var leaveTimer = 0;
      function react(el) {
        if (!host.offsetWidth) return; // Buddy is hidden (small screens)
        if (fields.indexOf(el) >= 0) { if (el._bbSecret) lookAway(el); else peek(el); }
        else if (secretNear(el)) lookAway(el); // e.g. the "show password" button
        else goHome();
      }
      form.addEventListener("focusin", function (e) { clearTimeout(leaveTimer); react(e.target); });
      form.addEventListener("focusout", function () {
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(function () { if (!form.contains(document.activeElement)) goHome(); }, 120);
      });
      form.addEventListener("input", function (e) { if (mode === "peek" && e.target === field) follow(); });
      window.addEventListener("resize", function () {
        var el = document.activeElement;
        if (mode === "idle" || !form.contains(el)) return;
        mode = "moved"; // Force a fresh walk to the new position
        react(el);
      });
      if (form.contains(document.activeElement)) react(document.activeElement);
    }

    host._bbBuddy = { say: function (i) { say(i == null ? index + 1 : i, true); }, speak: speak, hide: hide, watch: watch, button: btn };
    return host._bbBuddy;
  }

  /* ---------- Eyes follow the pointer (every Buddy on the page) ---------- */
  // Centre point between the eyes, as a fraction of the viewBox (0 -12 244 236)
  var EYE_X = 124 / 244, EYE_Y = (120 + 12) / 236;
  var pointer = null, frame = 0, idleTimer = 0;
  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function look() {
    frame = 0;
    var looks = document.querySelectorAll(".mascot__look");
    for (var i = 0; i < looks.length; i++) {
      var el = looks[i];
      var owner = el.ownerSVGElement;
      var host = owner && owner.closest(".mascot-host");
      var target = host && host._bbLook; // set while Buddy watches a form field or looks away
      if (target && target.dx != null) { el.style.transform = "translate(" + target.dx + "px," + target.dy + "px)"; continue; }
      var at = target || pointer;
      if (!at) { el.style.transform = ""; continue; }
      var r = owner.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) continue;
      var dx = at.x - (r.left + r.width * EYE_X);
      var dy = at.y - (r.top + r.height * EYE_Y);
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      // Look further off-centre the further away the pointer is, up to what fits inside the glasses
      var reach = target ? 1 : Math.min(1, dist / Math.max(60, r.width));
      el.style.transform = "translate(" + (dx / dist * 4.5 * reach).toFixed(2) + "px," + (dy / dist * 3.5 * reach).toFixed(2) + "px)";
    }
  }
  function requestLook() { if (!frame) frame = requestAnimationFrame(look); }
  function lookAhead() { pointer = null; requestLook(); }

  document.addEventListener("pointermove", function (e) {
    if (reduceQuery && reduceQuery.matches) return;
    pointer = { x: e.clientX, y: e.clientY };
    requestLook();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(lookAhead, 4000);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", lookAhead);
  window.addEventListener("blur", lookAhead);

  BB.mascot = { svg: svg, mark: mark, hydrate: hydrate, bounce: bounce, wave: wave, interactive: interactive, LINES: LINES };
})(window.BB = window.BB || {});
