/** Upload examination records — 7-step CSV import, PDF placeholder, imported records list. */
(function (BB) {
  "use strict";
  var U = BB.utils, R = BB.records;
  var STEPS = ["Select file", "Upload", "Preview", "Validate", "Correct errors", "Confirm import", "Results"];
  var MAX_BYTES = 2 * 1024 * 1024;
  var st;

  BB.app.init({ page: "upload", title: "Add Past Results" }, function () {
    reset();
    wireTabs();
    wirePdf();
    renderImported();
  });

  function reset() {
    st = { step: 0, file: null, text: null, parsed: null, rows: [], showAll: false, skipDuplicates: true, result: null, skippedCorrect: false };
    render();
  }

  function go(step) { st.step = step; render(); var h = U.$("#import-step h3"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); } }

  function renderStepper() {
    U.$("#import-stepper").innerHTML = STEPS.map(function (s, i) {
      var cls = i < st.step ? "is-done" : i === st.step ? "is-current" : "";
      return '<li class="stepper__item ' + cls + '"' + (i === st.step ? ' aria-current="step"' : "") + '><span class="stepper__label">' + (i + 1) + ". " + s + "</span></li>";
    }).join("");
  }

  function render() {
    renderStepper();
    [renderSelect, renderUpload, renderPreview, renderValidate, renderCorrect, renderConfirm, renderResults][st.step]();
    BB.icons.hydrate(U.$("#import-step"));
  }

  function fmtSize(b) { return b < 1024 ? b + " B" : b < 1048576 ? U.round(b / 1024, 1) + " KB" : U.round(b / 1048576, 1) + " MB"; }

  /* ---------- 1. Select ---------- */
  function renderSelect() {
    var el = U.$("#import-step");
    el.innerHTML =
      '<div class="import-step"><h3>Select a CSV file</h3><p>One row per question type per exam. Download the template if you\'re not sure how to lay it out.</p>' +
      '<div id="select-error" style="margin-top:16px"></div>' +
      (st.file
        ? '<div class="file-chip" style="margin-top:20px">' + BB.icon("sheet") + '<div style="flex:1"><div class="file-chip__name">' + U.escapeHtml(st.file.name) + '</div><div class="file-chip__size">' + fmtSize(st.file.size) + '</div></div><button type="button" class="btn btn--ghost btn--sm" id="change-file">Choose a different file</button></div>'
        : '<label class="dropzone" id="csv-drop" style="margin-top:20px"><span class="dropzone__icon" data-icon="upload"></span><span class="dropzone__title">Drop a CSV file here or choose one</span><span class="dropzone__hint">.csv files up to 2 MB</span><input type="file" id="csv-input" accept=".csv,text/csv" aria-describedby="select-error"></label>') +
      '<div class="cluster" style="margin-top:16px"><button type="button" class="btn btn--sm" id="dl-template" data-icon="download">Download CSV template</button><button type="button" class="btn btn--sm btn--soft" id="use-sample" data-icon="sheet">Use a sample file</button></div>' +
      '<details class="definition" style="margin-top:20px"><summary>Columns Brainy Buddy understands</summary>' +
      '<div class="table-wrap" style="margin-top:12px"><table class="table field-guide"><thead><tr><th scope="col">Column</th><th scope="col">Required</th><th scope="col">Format</th></tr></thead><tbody>' +
      "<tr><td>Subject</td><td>Yes</td><td>Text, for example Mathematics</td></tr>" +
      "<tr><td>Examination name</td><td>Yes</td><td>Text, for example Term 1 test</td></tr>" +
      "<tr><td>Examination date</td><td>Yes</td><td>YYYY-MM-DD or DD/MM/YYYY</td></tr>" +
      "<tr><td>Question type</td><td>Yes</td><td>Multiple choice, True/False, Short answer, Long answer, Objective or Subjective</td></tr>" +
      "<tr><td>Marks obtained</td><td>Yes</td><td>Number, 0 or more</td></tr>" +
      "<tr><td>Total marks</td><td>Yes</td><td>Number greater than 0</td></tr>" +
      "<tr><td>Time spent</td><td>No</td><td>Minutes. Leave blank if you didn't record it</td></tr>" +
      "<tr><td>Question order</td><td>No</td><td>Whole number (1 = answered first). Leave blank if unknown</td></tr>" +
      "</tbody></table></div></details>" +
      '<div class="import-actions"><span></span><button type="button" class="btn btn--primary" id="upload-btn"' + (st.file ? "" : " disabled") + ">" + BB.icon("upload") + "Upload file</button></div></div>";

    var input = U.$("#csv-input");
    if (input) {
      input.addEventListener("change", function () { if (input.files[0]) pickFile(input.files[0]); });
      var drop = U.$("#csv-drop");
      ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-dragover"); }); });
      ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("is-dragover"); }); });
      drop.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]); });
    }
    var change = U.$("#change-file");
    if (change) change.addEventListener("click", function () { st.file = null; st.blob = null; render(); U.$("#csv-input").focus(); });
    U.$("#dl-template").addEventListener("click", function () { U.downloadFile("brainy-buddy-records-template.csv", R.templateCsv(), "text/csv"); BB.toast.show("Template downloaded.", { type: "success" }); });
    U.$("#use-sample").addEventListener("click", function () {
      var text = R.sampleCsv();
      st.blob = new Blob([text], { type: "text/csv" });
      st.file = { name: "sample-exam-records.csv", size: st.blob.size };
      render();
      U.$("#upload-btn").focus();
    });
    U.$("#upload-btn").addEventListener("click", function () { go(1); });
  }

  function pickFile(file) {
    var err = U.$("#select-error");
    var isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
    if (!isCsv) { err.innerHTML = alert("danger", "That file isn't a CSV.", "Choose a file ending in .csv. Spreadsheets can be saved as CSV from Excel, Google Sheets or Numbers."); return; }
    if (file.size > MAX_BYTES) { err.innerHTML = alert("danger", "That file is too large.", "CSV files can be up to 2 MB. Split the file into smaller files and import them one at a time."); return; }
    if (!file.size) { err.innerHTML = alert("danger", "That file is empty.", "Choose a CSV with a header row and at least one record."); return; }
    st.blob = file;
    st.file = { name: file.name, size: file.size };
    render();
    U.$("#upload-btn").focus();
  }

  function alert(kind, title, text) {
    return '<div class="alert alert--' + kind + '" role="alert">' + BB.icon(kind === "danger" ? "alert-circle" : kind === "warning" ? "alert" : kind === "success" ? "check-circle" : "info") +
      '<div><p class="alert__title">' + U.escapeHtml(title) + "</p><p>" + U.escapeHtml(text) + "</p></div></div>";
  }

  /* ---------- 2. Upload ---------- */
  function renderUpload() {
    var el = U.$("#import-step");
    el.innerHTML = '<div class="import-step"><h3>Uploading ' + U.escapeHtml(st.file.name) + "</h3><p>Reading the file in your browser. Nothing is sent to a server.</p>" +
      '<div class="file-chip" style="margin-top:20px">' + BB.icon("sheet") + '<div style="flex:1"><div class="file-chip__name">' + U.escapeHtml(st.file.name) + '</div><div class="file-chip__size" id="up-label">Starting…</div>' +
      '<div class="progress" style="margin-top:8px" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="up-bar"><span class="progress__bar"></span></div></div></div>' +
      '<div id="up-error" style="margin-top:16px"></div></div>';
    var bar = U.$("#up-bar"), label = U.$("#up-label");
    var shown = 0, loaded = false, text = null;
    var setP = function (p) { shown = p; bar.style.setProperty("--value", p + "%"); bar.setAttribute("aria-valuenow", String(Math.round(p))); label.textContent = Math.round(p) + "% of " + fmtSize(st.file.size); };
    var anim = setInterval(function () {
      if (!loaded) setP(Math.min(90, shown + 12));
      else {
        setP(Math.min(100, shown + 25));
        if (shown >= 100) { clearInterval(anim); finish(text); }
      }
    }, 90);
    var reader = new FileReader();
    reader.onload = function () { text = String(reader.result); loaded = true; };
    reader.onerror = function () {
      clearInterval(anim);
      U.$("#up-error").innerHTML = alert("danger", "The file couldn't be read.", "It may have been moved or is still open in another program. Close it and choose it again.") +
        '<div class="import-actions"><button type="button" class="btn" id="up-back">Choose another file</button></div>';
      U.$("#up-back").addEventListener("click", function () { st.file = null; go(0); });
    };
    reader.readAsText(st.blob);
  }

  function finish(text) {
    var parsed = R.fromCsv(text);
    if (parsed.error) {
      U.$("#up-label").textContent = "Uploaded, but the file couldn't be used";
      U.$("#up-error").innerHTML = alert("danger", "This file can't be imported yet.", parsed.error + " Check it against the template and try again.") +
        (parsed.headers ? '<p class="text-sm text-secondary" style="margin-top:8px">Columns found: ' + U.escapeHtml(parsed.headers.join(", ")) + "</p>" : "") +
        '<div class="import-actions"><button type="button" class="btn" id="up-back">Choose another file</button><button type="button" class="btn btn--soft" id="up-template">Download template</button></div>';
      U.$("#up-back").addEventListener("click", function () { st.file = null; go(0); });
      U.$("#up-template").addEventListener("click", function () { U.downloadFile("brainy-buddy-records-template.csv", R.templateCsv(), "text/csv"); });
      return;
    }
    st.parsed = parsed;
    st.rows = parsed.rows.map(function (r) { return { line: r.line, raw: r.raw, clean: null, errors: {}, excluded: false }; });
    U.$("#up-label").textContent = "Upload complete: " + U.plural(parsed.rows.length, "row") + " found";
    setTimeout(function () { go(2); }, 450);
  }

  /* ---------- 3. Preview ---------- */
  function cell(v, optional) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return optional ? '<span class="not-recorded">Not recorded</span>' : '<span class="text-danger">Missing</span>';
    return U.escapeHtml(s);
  }
  function renderPreview() {
    var h = st.parsed.header;
    var el = U.$("#import-step");
    var mapChips = Object.keys(h.map).map(function (col) {
      var f = R.FIELDS.filter(function (x) { return x.key === h.map[col]; })[0];
      return '<span class="badge badge--success">' + BB.icon("check", { size: "sm" }) + U.escapeHtml(f.label) + ' <span style="font-weight:400">from "' + U.escapeHtml(st.parsed.headers[col]) + '"</span></span>';
    }).join("");
    var missingOptional = R.FIELDS.filter(function (f) { return !f.required && !h.present[f.key]; }).map(function (f) { return f.label.replace(" (min)", ""); });
    var preview = st.rows.slice(0, 10);
    el.innerHTML = '<div class="import-step"><h3>Preview extracted data</h3><p>' + U.plural(st.rows.length, "row") + " found in " + U.escapeHtml(st.file.name) + ". Showing the first " + preview.length + ".</p>" +
      '<div class="mapping" aria-label="Columns matched">' + mapChips + "</div>" +
      (h.unknown.length ? '<p class="text-sm text-secondary" style="margin-top:8px">Ignored columns: ' + U.escapeHtml(h.unknown.join(", ")) + ".</p>" : "") +
      (missingOptional.length ? '<div style="margin-top:16px">' + alert("info", "Some optional columns aren't in this file", missingOptional.join(" and ") + " will be saved as “Not recorded”. Brainy Buddy won't estimate them.") + "</div>" : "") +
      '<div class="table-wrap" style="margin-top:16px"><table class="table"><caption class="visually-hidden">Preview of imported rows</caption><thead><tr><th scope="col">Line</th>' +
      R.FIELDS.map(function (f) { return '<th scope="col">' + f.label + "</th>"; }).join("") + "</tr></thead><tbody>" +
      preview.map(function (r) {
        return "<tr><td>" + r.line + "</td>" + R.FIELDS.map(function (f) { return "<td>" + cell(r.raw[f.key], !f.required) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="import-actions"><button type="button" class="btn" id="pv-back">' + BB.icon("arrow-left") + 'Choose another file</button><button type="button" class="btn btn--primary" id="pv-next">Validate records</button></div></div>';
    U.$("#pv-back").addEventListener("click", function () { st.file = null; go(0); });
    U.$("#pv-next").addEventListener("click", function () { validateAll(); go(3); });
  }

  function validateRow(r) { var v = R.validate(r.raw); r.clean = v.clean; r.errors = v.errors; }
  function validateAll() { st.rows.forEach(validateRow); }
  function problemRows() { return st.rows.filter(function (r) { return !r.excluded && Object.keys(r.errors).length; }); }

  /* ---------- 4. Validate ---------- */
  function renderValidate() {
    var bad = problemRows();
    var good = st.rows.length - bad.length;
    var el = U.$("#import-step");
    el.innerHTML = '<div class="import-step"><h3>Validate records</h3><p>Each row was checked for required values, valid dates, question types and marks. Line numbers match your file (line 1 is the header).</p>' +
      '<div class="validation-summary">' +
      BB.ui.metric({ icon: "sheet", label: "Rows checked", value: st.rows.length }) +
      BB.ui.metric({ icon: "check-circle", tone: "accent", label: "Ready to import", value: good }) +
      BB.ui.metric({ icon: "alert", tone: "amber", label: "Need correcting", value: bad.length }) + "</div>" +
      (bad.length
        ? '<h4 class="label" style="margin:20px 0 8px">Problems found</h4><ul class="stack text-sm" style="--stack-gap:6px;padding-left:1.2em;margin:0">' +
        bad.map(function (r) {
          return Object.keys(r.errors).map(function (k) {
            var f = R.FIELDS.filter(function (x) { return x.key === k; })[0];
            return "<li><strong>Line " + r.line + ", " + f.label + ":</strong> " + U.escapeHtml(r.errors[k]) + "</li>";
          }).join("");
        }).join("") + "</ul>"
        : '<div style="margin-top:20px">' + alert("success", "Every row passed validation", "You can go straight to confirming the import.") + "</div>") +
      '<div class="import-actions"><button type="button" class="btn" id="va-back">' + BB.icon("arrow-left") + "Back to preview</button>" +
      (bad.length ? '<button type="button" class="btn btn--primary" id="va-next">Correct errors</button>' : '<button type="button" class="btn btn--primary" id="va-skip">Continue to confirm</button>') + "</div></div>";
    U.$("#va-back").addEventListener("click", function () { go(2); });
    if (bad.length) U.$("#va-next").addEventListener("click", function () { go(4); });
    else U.$("#va-skip").addEventListener("click", function () { st.skippedCorrect = true; go(5); });
  }

  /* ---------- 5. Correct ---------- */
  function renderCorrect() {
    var el = U.$("#import-step");
    var rows = st.showAll ? st.rows : st.rows.filter(function (r) { return Object.keys(r.errors).length || r.touched; });
    rows.forEach(function (r) { r.touched = true; });
    el.innerHTML = '<div class="import-step"><h3>Correct errors</h3><p>Fix the highlighted values, or exclude a row you don\'t want to import. Changes are checked as you type.</p>' +
      '<div class="split" style="margin-top:16px"><p class="text-sm fw-600" id="issue-count" aria-live="polite"></p>' +
      '<label class="check"><input type="checkbox" id="show-all"' + (st.showAll ? " checked" : "") + "><span>Show all " + st.rows.length + " rows</span></label></div>" +
      '<div class="table-wrap" style="margin-top:12px"><table class="table edit-table"><caption class="visually-hidden">Editable records</caption><thead><tr><th scope="col">Line</th>' +
      R.FIELDS.map(function (f) { return '<th scope="col">' + f.label + (f.required ? "" : ' <span style="font-weight:400">(optional)</span>') + "</th>"; }).join("") +
      '<th scope="col">Exclude</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var idx = st.rows.indexOf(r);
        return '<tr data-idx="' + idx + '" class="' + (Object.keys(r.errors).length ? "has-error" : "") + (r.excluded ? " is-excluded" : "") + '"><td class="row-num">' + r.line + "</td>" +
          R.FIELDS.map(function (f) {
            var id = "c-" + idx + "-" + f.key;
            var label = "Line " + r.line + " " + f.label;
            var err = r.errors[f.key];
            var control = f.key === "questionType"
              ? '<select class="select" id="' + id + '" data-key="' + f.key + '" aria-label="' + label + '"' + (err ? ' aria-invalid="true" aria-describedby="' + id + '-e"' : "") + '><option value="">Choose…</option>' +
                R.TYPES.map(function (t) { var sel = R.parseType(r.raw.questionType) === t.value ? " selected" : ""; return '<option value="' + t.label + '"' + sel + ">" + t.label + "</option>"; }).join("") + "</select>"
              : '<input class="input" id="' + id + '" data-key="' + f.key + '" value="' + U.escapeHtml(r.raw[f.key]) + '" aria-label="' + label + '"' +
                (f.key === "examDate" ? ' placeholder="YYYY-MM-DD"' : "") + (!f.required ? ' placeholder="Not recorded"' : "") + (err ? ' aria-invalid="true" aria-describedby="' + id + '-e"' : "") + ">";
            return "<td>" + control + '<div class="cell-error" id="' + id + '-e">' + (err ? U.escapeHtml(err) : "") + "</div></td>";
          }).join("") +
          '<td><label class="check"><input type="checkbox" data-exclude' + (r.excluded ? " checked" : "") + ' aria-label="Exclude line ' + r.line + '"></label></td></tr>';
      }).join("") + "</tbody></table></div>" +
      '<div class="import-actions"><button type="button" class="btn" id="co-back">' + BB.icon("arrow-left") + 'Back</button><button type="button" class="btn btn--primary" id="co-next">Continue to confirm</button></div></div>';

    function updateCount() {
      var n = problemRows().length;
      U.$("#issue-count").innerHTML = n ? '<span class="text-danger">' + U.plural(n, "row") + " still need attention</span>" : '<span class="text-success">All included rows are valid</span>';
      U.$("#co-next").disabled = n > 0;
    }
    U.$$(".edit-table tbody tr").forEach(function (tr) {
      var r = st.rows[Number(tr.getAttribute("data-idx"))];
      U.$$("[data-key]", tr).forEach(function (inp) {
        inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", function () {
          r.raw[inp.getAttribute("data-key")] = inp.value;
          validateRow(r);
          R.FIELDS.forEach(function (f) {
            var ctl = U.$('[data-key="' + f.key + '"]', tr);
            var e = document.getElementById(ctl.id + "-e");
            var msg = r.errors[f.key];
            e.textContent = msg || "";
            if (msg) { ctl.setAttribute("aria-invalid", "true"); ctl.setAttribute("aria-describedby", ctl.id + "-e"); }
            else ctl.removeAttribute("aria-invalid");
          });
          tr.classList.toggle("has-error", Object.keys(r.errors).length > 0);
          updateCount();
        });
      });
      U.$("[data-exclude]", tr).addEventListener("change", function (e) {
        r.excluded = e.target.checked;
        tr.classList.toggle("is-excluded", r.excluded);
        updateCount();
      });
    });
    U.$("#show-all").addEventListener("change", function (e) { st.showAll = e.target.checked; render(); });
    U.$("#co-back").addEventListener("click", function () { go(3); });
    U.$("#co-next").addEventListener("click", function () { if (!problemRows().length) go(5); });
    updateCount();
  }

  /* ---------- 6. Confirm ---------- */
  function included() { return st.rows.filter(function (r) { return !r.excluded && !Object.keys(r.errors).length; }); }
  function dupKey(x) { return [x.subject.toLowerCase(), x.examName.toLowerCase(), x.examDate, x.questionType].join("|"); }

  function renderConfirm() {
    var rows = included();
    var existing = {};
    BB.repo.records().forEach(function (x) { existing[dupKey(x)] = true; });
    var dups = rows.filter(function (r) { return existing[dupKey(r.clean)]; });
    var excluded = st.rows.filter(function (r) { return r.excluded; }).length;
    var toImport = st.skipDuplicates ? rows.length - dups.length : rows.length;
    var exams = U.groupBy(rows, function (r) { return r.clean.subject + " | " + r.clean.examName + " | " + r.clean.examDate; });
    var withTime = rows.filter(function (r) { return r.clean.timeSpent != null; }).length;
    var withOrder = rows.filter(function (r) { return r.clean.questionOrder != null; }).length;
    var el = U.$("#import-step");
    el.innerHTML = '<div class="import-step"><h3>Confirm import</h3><p>Check the summary, then import.</p>' +
      '<dl class="kv" style="margin-top:16px;max-width:520px">' +
      "<div><dt>Records to import</dt><dd>" + toImport + "</dd></div>" +
      "<div><dt>Examinations</dt><dd>" + Object.keys(exams).length + "</dd></div>" +
      "<div><dt>Rows excluded by you</dt><dd>" + excluded + "</dd></div>" +
      "<div><dt>Time spent recorded</dt><dd>" + withTime + " of " + rows.length + " rows</dd></div>" +
      "<div><dt>Question order recorded</dt><dd>" + withOrder + " of " + rows.length + " rows</dd></div></dl>" +
      (withTime < rows.length || withOrder < rows.length ? '<p class="text-sm text-secondary" style="margin-top:12px">Rows without time spent or question order will show “Not recorded” and won\'t be used in time or order analysis.</p>' : "") +
      (dups.length ? '<div style="margin-top:16px">' + alert("warning", U.plural(dups.length, "row") + " match records you've already imported", "Same subject, examination, date and question type.") +
        '<label class="check" style="margin-top:8px"><input type="checkbox" id="skip-dups"' + (st.skipDuplicates ? " checked" : "") + "><span>Skip duplicate rows</span></label></div>" : "") +
      '<h4 class="label" style="margin:20px 0 8px">Examinations in this file</h4><ul class="stat-list">' +
      Object.keys(exams).map(function (k) {
        var list = exams[k], c = list[0].clean;
        var o = U.sum(list, function (r) { return r.clean.marksObtained; }), t = U.sum(list, function (r) { return r.clean.totalMarks; });
        return '<li class="stat-row" style="grid-template-columns:16px 1fr auto"><span class="subject-dot" style="background:' + BB.repo.subjectColor(c.subject) + '"></span><div class="stat-row__text"><span class="stat-row__label">' + U.escapeHtml(c.subject + ": " + c.examName) + '</span><span class="stat-row__detail">' + U.formatDate(U.parseDateKey(c.examDate)) + ", " + U.plural(list.length, "row") + '</span></div><span class="stat-row__value">' + o + " / " + t + "</span></li>";
      }).join("") + "</ul>" +
      '<div class="import-actions"><button type="button" class="btn" id="cf-back">' + BB.icon("arrow-left") + 'Back</button><button type="button" class="btn btn--primary" id="cf-import"' + (toImport ? "" : " disabled") + ">Import " + U.plural(toImport, "record") + "</button></div></div>";
    var skip = U.$("#skip-dups");
    if (skip) skip.addEventListener("change", function () { st.skipDuplicates = skip.checked; render(); });
    U.$("#cf-back").addEventListener("click", function () { go(st.skippedCorrect ? 3 : 4); });
    U.$("#cf-import").addEventListener("click", function () {
      var btn = U.$("#cf-import");
      BB.forms.setLoading(btn, true, "Importing…");
      setTimeout(function () {
        var batchId = U.uid("batch");
        var now = Date.now();
        var chosen = rows.filter(function (r) { return !(st.skipDuplicates && existing[dupKey(r.clean)]); });
        var newRecords = chosen.map(function (r) {
          return Object.assign({ id: U.uid("rec"), batchId: batchId, importedAt: now, sourceFile: st.file.name, sourceLine: r.line }, r.clean);
        });
        var ok = BB.repo.saveRecords(BB.repo.records().concat(newRecords));
        if (!ok) { BB.forms.setLoading(btn, false); return; }
        BB.repo.saveImportBatches(BB.repo.importBatches().concat([{ id: batchId, fileName: st.file.name, importedAt: now, count: newRecords.length }]));
        st.result = { imported: newRecords.length, duplicatesSkipped: rows.length - chosen.length, excluded: excluded, exams: BB.academic.recordExams(newRecords) };
        go(6);
        renderImported();
      }, 500);
    });
  }

  /* ---------- 7. Results ---------- */
  function renderResults() {
    var r = st.result;
    var el = U.$("#import-step");
    el.innerHTML = '<div class="import-step"><h3>Import complete</h3><p>Your records are now part of your dashboard, subject results and reports.</p>' +
      '<div style="margin-top:16px">' + alert("success", U.plural(r.imported, "record") + " imported", U.plural(r.exams.length, "examination") + " added from " + st.file.name + ".") + "</div>" +
      '<dl class="kv" style="margin-top:16px;max-width:520px"><div><dt>Imported</dt><dd>' + r.imported + "</dd></div><div><dt>Duplicates skipped</dt><dd>" + r.duplicatesSkipped + "</dd></div><div><dt>Excluded by you</dt><dd>" + r.excluded + "</dd></div></dl>" +
      '<ul class="stat-list" style="margin-top:16px">' + r.exams.map(function (x) {
        return '<li class="stat-row" style="grid-template-columns:16px 1fr auto"><span class="subject-dot" style="background:' + BB.repo.subjectColor(x.subject) + '"></span><div class="stat-row__text"><span class="stat-row__label">' + U.escapeHtml(x.subject + ": " + x.title) + '</span><span class="stat-row__detail">' + U.formatDate(x.date) + (x.timeRecorded ? "" : ", time not recorded") + '</span></div><span class="stat-row__value">' + Math.round(x.scorePct) + "%</span></li>";
      }).join("") + "</ul>" +
      '<div class="import-actions"><button type="button" class="btn" id="rs-again">Import another file</button><a class="btn btn--primary" href="dashboard.html">Go to dashboard</a></div></div>';
    U.$("#rs-again").addEventListener("click", reset);
  }

  /* ---------- Imported list ---------- */
  function renderImported() {
    var el = U.$("#imported-list");
    var records = BB.repo.records();
    if (!records.length) {
      el.innerHTML = '<div class="panel">' + BB.ui.empty({ mood: "thinking", title: "No imported records yet", text: "Records you import will appear here, grouped by examination." }) + "</div>";
      return;
    }
    var exams = BB.academic.recordExams(records).reverse();
    el.innerHTML = '<div class="panel panel--flush"><div class="table-wrap" style="border:0"><table class="table"><caption class="visually-hidden">Imported examination records</caption><thead><tr>' +
      '<th scope="col">Examination</th><th scope="col">Question type</th><th scope="col" class="num">Marks</th><th scope="col" class="num">Time spent</th><th scope="col" class="num">Question order</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' +
      exams.map(function (x) {
        return x.rows.map(function (r, i) {
          return "<tr>" + (i === 0 ? '<td rowspan="' + x.rows.length + '" style="vertical-align:top"><span class="subject-name"><span class="subject-dot" style="background:' + BB.repo.subjectColor(x.subject) + '"></span>' + U.escapeHtml(x.subject) + '</span><div class="fw-600" style="margin-top:2px">' + U.escapeHtml(x.title) + '</div><div class="text-xs text-secondary">' + U.formatDate(x.date) + ", " + Math.round(x.scorePct) + "% overall</div></td>" : "") +
            "<td>" + U.escapeHtml(R.typeLabel(r.questionType)) + "</td>" +
            '<td class="num">' + r.marksObtained + " / " + r.totalMarks + "</td>" +
            '<td class="num">' + (r.timeSpent == null ? '<span class="not-recorded">Not recorded</span>' : U.formatMinutes(r.timeSpent)) + "</td>" +
            '<td class="num">' + (r.questionOrder == null ? '<span class="not-recorded">Not recorded</span>' : r.questionOrder) + "</td>" +
            (i === 0 ? '<td rowspan="' + x.rows.length + '" style="vertical-align:top"><button type="button" class="btn btn--ghost btn--sm" data-del-exam="' + U.escapeHtml(x.id) + '" aria-label="Delete ' + U.escapeHtml(x.subject + " " + x.title) + ' records">' + BB.icon("trash") + "Delete</button></td>" : "") + "</tr>";
        }).join("");
      }).join("") + "</tbody></table></div></div>";
    U.$$("[data-del-exam]").forEach(function (b) {
      b.addEventListener("click", function () {
        var x = exams.filter(function (e) { return e.id === b.getAttribute("data-del-exam"); })[0];
        BB.dialog.confirm({ title: "Delete these records?", body: "<p>All " + x.rows.length + " imported rows for <strong>" + U.escapeHtml(x.subject + ": " + x.title) + "</strong> will be removed.</p>", confirmText: "Delete records", tone: "danger", focusCancel: true })
          .then(function (ok) {
            if (!ok) return;
            var ids = x.rows.map(function (r) { return r.id; });
            BB.repo.saveRecords(BB.repo.records().filter(function (r) { return ids.indexOf(r.id) === -1; }));
            BB.toast.show("Records deleted.", { type: "success" });
            renderImported();
          });
      });
    });
  }

  /* ---------- Tabs & PDF ---------- */
  function wireTabs() {
    var tabs = U.$$('[role="tab"]');
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          select(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]);
        }
      });
    });
  }

  function wirePdf() {
    var input = U.$("#pdf-input");
    input.addEventListener("change", function () {
      var f = input.files[0];
      var out = U.$("#pdf-status");
      if (!f) return;
      if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { out.innerHTML = alert("danger", "That file isn't a PDF.", "Choose a file ending in .pdf."); return; }
      if (f.size > 10 * 1024 * 1024) { out.innerHTML = alert("danger", "That PDF is too large.", "PDF reports can be up to 10 MB."); return; }
      out.innerHTML = '<div class="file-chip">' + BB.icon("pdf") + '<div style="flex:1"><div class="file-chip__name">' + U.escapeHtml(f.name) + '</div><div class="file-chip__size">' + fmtSize(f.size) + ', received but not processed</div></div></div>' +
        '<div style="margin-top:12px">' + alert("warning", "Not processed", "Document processing isn't connected yet, so no results were extracted and nothing was saved. To import these results now, copy them into the CSV template.") + "</div>";
      input.value = "";
    });
  }
})(window.BB = window.BB || {});
