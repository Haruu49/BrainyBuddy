/**
 * BB.toast  — transient status messages in a polite live region.
 * BB.dialog — accessible confirm / custom dialogs built on native <dialog>.
 * BB.menu   — disclosure-style dropdown menus (Escape, outside click, focus return).
 */
(function (BB) {
  "use strict";

  var U = BB.utils;

  /* ---------------- Toast ---------------- */
  var region;
  function ensureRegion() {
    if (region && document.body.contains(region)) return region;
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
    return region;
  }

  var TOAST_ICONS = { success: "check-circle", error: "alert-circle", warning: "alert", info: "info" };

  function show(message, opts) {
    opts = opts || {};
    var type = opts.type || "info";
    var el = document.createElement("div");
    el.className = "toast toast--" + type;
    el.innerHTML =
      BB.icon(TOAST_ICONS[type] || "info") +
      '<div class="toast__msg">' + U.escapeHtml(message) + "</div>" +
      '<button type="button" class="toast__close" aria-label="Dismiss notification">' + BB.icon("x", { size: "sm" }) + "</button>";
    ensureRegion().appendChild(el);
    var timer = setTimeout(dismiss, opts.duration || 4200);
    function dismiss() {
      clearTimeout(timer);
      el.classList.add("is-leaving");
      setTimeout(function () { el.remove(); }, 220);
    }
    el.querySelector(".toast__close").addEventListener("click", dismiss);
    return dismiss;
  }

  BB.toast = { show: show };

  /* ---------------- Dialog ---------------- */
  /**
   * BB.dialog.confirm({ title, body (HTML string), confirmText, cancelText, tone: "danger"|"primary" })
   * → Promise<boolean>
   */
  function confirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var d = document.createElement("dialog");
      var titleId = U.uid("dlg-title");
      var bodyId = U.uid("dlg-body");
      d.className = "dialog";
      d.setAttribute("aria-labelledby", titleId);
      d.setAttribute("aria-describedby", bodyId);
      var tone = opts.tone === "danger" ? "btn--danger" : "btn--primary";
      d.innerHTML =
        '<form method="dialog">' +
        '<div class="dialog__header"><h2 class="dialog__title" id="' + titleId + '">' + U.escapeHtml(opts.title || "Are you sure?") + "</h2>" +
        '<button type="submit" value="cancel" class="btn btn--ghost btn--icon btn--sm" aria-label="Close dialog">' + BB.icon("x") + "</button></div>" +
        '<div class="dialog__body" id="' + bodyId + '">' + (opts.body || "") + "</div>" +
        '<div class="dialog__footer">' +
        '<button type="submit" value="cancel" class="btn">' + U.escapeHtml(opts.cancelText || "Cancel") + "</button>" +
        '<button type="submit" value="confirm" class="btn ' + tone + '" data-autofocus>' + U.escapeHtml(opts.confirmText || "Confirm") + "</button>" +
        "</div></form>";
      document.body.appendChild(d);
      d.addEventListener("close", function () {
        resolve(d.returnValue === "confirm");
        setTimeout(function () { d.remove(); }, 50);
      });
      open(d);
      var focusTarget = opts.focusCancel ? d.querySelector('[value="cancel"].btn:not(.btn--icon)') : d.querySelector("[data-autofocus]");
      if (focusTarget) focusTarget.focus();
    });
  }

  function open(d) {
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }
  function close(d, value) {
    if (typeof d.close === "function") d.close(value);
    else d.removeAttribute("open");
  }

  /** Wire close buttons ([data-dialog-close]) and light-dismiss on backdrop click for an existing <dialog>. */
  function wire(d) {
    if (!d || d.__wired) return;
    d.__wired = true;
    U.$$("[data-dialog-close]", d).forEach(function (btn) {
      btn.addEventListener("click", function () { close(d, "cancel"); });
    });
    d.addEventListener("click", function (e) {
      if (e.target === d) close(d, "cancel");
    });
  }

  BB.dialog = { confirm: confirm, open: open, close: close, wire: wire };

  /* ---------------- Menu ---------------- */
  var openMenus = [];

  function initMenu(button, panel, opts) {
    opts = opts || {};
    if (!button || !panel) return null;
    if (!panel.id) panel.id = U.uid("menu");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", panel.id);
    panel.hidden = true;

    var api = {
      open: function () {
        closeAll(api);
        panel.hidden = false;
        button.setAttribute("aria-expanded", "true");
        openMenus.push(api);
        if (opts.onOpen) opts.onOpen();
        var first = panel.querySelector("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])");
        if (first && opts.focusFirst !== false) first.focus();
      },
      close: function (returnFocus) {
        if (panel.hidden) return;
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
        openMenus = openMenus.filter(function (m) { return m !== api; });
        if (returnFocus) button.focus();
      },
      toggle: function () { panel.hidden ? api.open() : api.close(); },
      contains: function (node) { return button.contains(node) || panel.contains(node); }
    };

    button.addEventListener("click", function (e) { e.stopPropagation(); api.toggle(); });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); api.close(true); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        var items = U.$$(".menu__item", panel).filter(function (i) { return !i.disabled; });
        if (!items.length) return;
        e.preventDefault();
        var idx = items.indexOf(document.activeElement);
        var next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    });
    return api;
  }

  function closeAll(except) {
    openMenus.slice().forEach(function (m) { if (m !== except) m.close(false); });
  }

  document.addEventListener("click", function (e) {
    openMenus.slice().forEach(function (m) { if (!m.contains(e.target)) m.close(false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openMenus.length) openMenus[openMenus.length - 1].close(true);
  });

  BB.menu = { init: initMenu, closeAll: closeAll };
})(window.BB = window.BB || {});
