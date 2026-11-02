/**
 * BB.csv     — small RFC 4180-style CSV parser/serialiser (quoted fields, CRLF, escaped quotes).
 * BB.records — mapping + validation for imported examination records.
 *
 * Optional fields (time spent, question order) are NEVER inferred: when absent they
 * stay null and the UI shows "Not recorded".
 */
(function (BB) {
  "use strict";

  var U = BB.utils;

  function parse(text) {
    var rows = [], row = [], field = "", inQuotes = false;
    text = String(text || "").replace(/^﻿/, "");
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ""; }); });
  }

  function escapeField(v) {
    var s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function stringify(rows) { return rows.map(function (r) { return r.map(escapeField).join(","); }).join("\r\n"); }

  BB.csv = { parse: parse, stringify: stringify };

  /* ---------------- Records ---------------- */
  var FIELDS = [
    { key: "subject", label: "Subject", required: true, aliases: ["subject", "course", "module"] },
    { key: "examName", label: "Examination name", required: true, aliases: ["examinationname", "examname", "exam", "examination", "testname", "assessment", "assessmentname"] },
    { key: "examDate", label: "Examination date", required: true, aliases: ["examinationdate", "examdate", "date", "testdate"] },
    { key: "questionType", label: "Question type", required: true, aliases: ["questiontype", "type", "questioncategory"] },
    { key: "marksObtained", label: "Marks obtained", required: true, aliases: ["marksobtained", "marks", "score", "obtained", "mark"] },
    { key: "totalMarks", label: "Total marks", required: true, aliases: ["totalmarks", "total", "outof", "maxmarks", "maximummarks", "possiblemarks"] },
    { key: "timeSpent", label: "Time spent (min)", required: false, aliases: ["timespent", "timespentminutes", "timespentmins", "time", "minutes", "duration"] },
    { key: "questionOrder", label: "Question order", required: false, aliases: ["questionorder", "order", "sequence", "answerorder"] }
  ];

  var TYPES = [
    { value: "mcq", label: "Multiple choice", aliases: ["mcq", "multiplechoice", "multiple", "mc"] },
    { value: "tf", label: "True/false", aliases: ["tf", "truefalse", "trueorfalse", "boolean"] },
    { value: "short", label: "Short answer", aliases: ["short", "shortanswer", "sa", "structuredshort"] },
    { value: "long", label: "Long answer", aliases: ["long", "longanswer", "essay", "la", "extended", "structured"] },
    { value: "objective", label: "Objective (mixed)", aliases: ["objective", "obj", "objectivemixed"] },
    { value: "subjective", label: "Subjective (mixed)", aliases: ["subjective", "subj", "written", "subjectivemixed"] }
  ];

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

  /** Map header cells to field keys. Returns { map: {colIndex: key}, missing: [labels], unknown: [headers] } */
  function mapHeaders(headers) {
    var map = {}, used = {};
    var unknown = [];
    headers.forEach(function (h, i) {
      var n = norm(h);
      var f = FIELDS.filter(function (f) { return !used[f.key] && f.aliases.indexOf(n) !== -1; })[0];
      if (f) { map[i] = f.key; used[f.key] = true; }
      else if (String(h).trim()) unknown.push(h);
    });
    var missing = FIELDS.filter(function (f) { return f.required && !used[f.key]; }).map(function (f) { return f.label; });
    return { map: map, missing: missing, unknown: unknown, present: used };
  }

  function parseDate(value) {
    var s = String(value || "").trim();
    var m;
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return build(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) return build(+m[3], +m[2], +m[1]); // DD/MM/YYYY
    return null;
    function build(y, mo, d) {
      var date = new Date(y, mo - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
      return U.dateKey(date);
    }
  }

  function parseType(value) {
    var n = norm(value);
    var t = TYPES.filter(function (t) { return t.aliases.indexOf(n) !== -1; })[0];
    return t ? t.value : null;
  }

  function typeLabel(v) { var t = TYPES.filter(function (x) { return x.value === v; })[0]; return t ? t.label : v; }

  function num(value) {
    var s = String(value == null ? "" : value).trim();
    if (s === "") return { empty: true };
    var n = Number(s);
    return isFinite(n) ? { value: n } : { invalid: true };
  }

  /**
   * Validate one raw row object { subject, examName, … } (strings).
   * Returns { clean, errors: { key: message } }.
   */
  function validate(raw) {
    var errors = {}, clean = {};
    var todayKey = U.dateKey(new Date());

    clean.subject = String(raw.subject || "").trim();
    if (!clean.subject) errors.subject = "Add the subject.";

    clean.examName = String(raw.examName || "").trim();
    if (!clean.examName) errors.examName = "Add the examination name.";

    var dk = parseDate(raw.examDate);
    if (!String(raw.examDate || "").trim()) errors.examDate = "Add the examination date.";
    else if (!dk) errors.examDate = "Use YYYY-MM-DD or DD/MM/YYYY.";
    else if (dk > todayKey) errors.examDate = "The date is in the future.";
    clean.examDate = dk;

    var qt = parseType(raw.questionType);
    if (!String(raw.questionType || "").trim()) errors.questionType = "Add the question type.";
    else if (!qt) errors.questionType = "Use multiple choice, true/false, short answer, long answer, objective or subjective.";
    clean.questionType = qt;

    var mo = num(raw.marksObtained), tm = num(raw.totalMarks);
    if (mo.empty) errors.marksObtained = "Add the marks obtained.";
    else if (mo.invalid) errors.marksObtained = "Enter a number.";
    else if (mo.value < 0) errors.marksObtained = "Marks can't be negative.";
    if (tm.empty) errors.totalMarks = "Add the total marks.";
    else if (tm.invalid) errors.totalMarks = "Enter a number.";
    else if (tm.value <= 0) errors.totalMarks = "Total marks must be more than 0.";
    if (!errors.marksObtained && !errors.totalMarks && mo.value > tm.value) errors.marksObtained = "Can't be more than the total marks (" + tm.value + ").";
    clean.marksObtained = mo.value != null ? mo.value : null;
    clean.totalMarks = tm.value != null ? tm.value : null;

    var ts = num(raw.timeSpent);
    if (ts.invalid) errors.timeSpent = "Enter minutes as a number, or leave it blank.";
    else if (!ts.empty && ts.value < 0) errors.timeSpent = "Time can't be negative.";
    clean.timeSpent = ts.empty || ts.invalid ? null : ts.value;

    var qo = num(raw.questionOrder);
    if (qo.invalid || (!qo.empty && (qo.value < 1 || Math.floor(qo.value) !== qo.value))) errors.questionOrder = "Use a whole number from 1, or leave it blank.";
    clean.questionOrder = qo.empty || errors.questionOrder ? null : qo.value;

    return { clean: clean, errors: errors };
  }

  /** Parse CSV text into rows ready for preview/validation. */
  function fromCsv(text) {
    var table = parse(text);
    if (!table.length) return { error: "The file is empty. Add a header row and at least one record." };
    var header = mapHeaders(table[0]);
    if (header.missing.length) {
      return {
        error: "The header row is missing required columns: " + header.missing.join(", ") + ".",
        header: header,
        headers: table[0]
      };
    }
    var dataRows = table.slice(1);
    if (!dataRows.length) return { error: "The file has a header row but no records." };
    var rows = dataRows.map(function (cells, idx) {
      var raw = {};
      FIELDS.forEach(function (f) { raw[f.key] = ""; });
      Object.keys(header.map).forEach(function (col) { raw[header.map[col]] = cells[col] != null ? cells[col] : ""; });
      return { line: idx + 2, raw: raw };
    });
    return { rows: rows, header: header, headers: table[0] };
  }

  function sampleCsv() {
    var today = new Date();
    function d(n) { return U.dateKey(U.addDays(today, -n)); }
    return stringify([
      ["Subject", "Examination name", "Examination date", "Question type", "Marks obtained", "Total marks", "Time spent", "Question order"],
      ["Mathematics", "Term 1 test", d(120), "Multiple choice", "16", "20", "18", "1"],
      ["Mathematics", "Term 1 test", d(120), "Long answer", "22", "40", "41", "2"],
      ["Physics", "Term 1 test", d(116), "Multiple choice", "14", "20", "", ""],
      ["Physics", "Term 1 test", d(116), "Short answer", "9", "15", "", ""],
      ["Chemistry", "Mock exam", d(95), "Objective", "31", "40", "35", "1"],
      ["Chemistry", "Mock exam", d(95), "Subjective", "34", "60", "70", "2"],
      ["Biology", "Quiz 3", d(88), "True/False", "8", "10", "6", ""],
      ["English", "Essay assessment", d(80), "Long answer", "27", "40", "", ""],
      ["Mathematics", "Term 2 test", d(60), "Multiple choice", "17", "20", "16", "2"],
      ["Mathematics", "Term 2 test", d(60), "Long answer", "29", "40", "38", "1"],
      // Rows with deliberate problems so the validation step has something to show
      ["Physics", "Term 2 test", "31/02/2026", "Multiple choice", "15", "20", "", ""],
      ["Biology", "Term 2 test", d(55), "Essay", "45", "40", "abc", ""]
    ]);
  }

  BB.records = {
    FIELDS: FIELDS,
    TYPES: TYPES,
    mapHeaders: mapHeaders,
    parseDate: parseDate,
    parseType: parseType,
    typeLabel: typeLabel,
    validate: validate,
    fromCsv: fromCsv,
    sampleCsv: sampleCsv,
    templateCsv: function () {
      return stringify([FIELDS.map(function (f) { return f.label.replace(" (min)", ""); }), ["Mathematics", "Term 1 test", U.dateKey(new Date()), "Multiple choice", "16", "20", "", ""]]);
    }
  };
})(window.BB = window.BB || {});
