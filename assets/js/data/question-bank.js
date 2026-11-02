/**
 * BB.questionBank — demo questions for the Examination Simulator.
 *
 * Types:
 *   mcq   { options: [...], answer: index }
 *   tf    { answer: true|false }
 *   short { accept: ["…"] } and/or { numeric: n, tolerance: t }   → auto-checked
 *   long  { keywords: [["synonym", …], …], minWords }              → keyword estimate (demo marking)
 *
 * Marks: mcq 2 · tf 1 · short 3 · long 8
 */
(function (BB) {
  "use strict";

  var MARKS = { mcq: 2, tf: 1, short: 3, long: 8 };

  var BANK = {
    Mathematics: [
      { category: "Algebra", type: "mcq", text: "Solve 3x − 7 = 11.", options: ["x = 4", "x = 6", "x = 3", "x = 18"], answer: 1 },
      { category: "Algebra", type: "mcq", text: "Which expression is equivalent to (x + 3)²?", options: ["x² + 9", "x² + 6x + 9", "x² + 3x + 9", "2x + 6"], answer: 1 },
      { category: "Algebra", type: "mcq", text: "What is the gradient of the line y = −2x + 5?", options: ["5", "2", "−2", "−5"], answer: 2 },
      { category: "Geometry", type: "mcq", text: "The interior angles of a triangle add up to:", options: ["90°", "180°", "270°", "360°"], answer: 1 },
      { category: "Geometry", type: "mcq", text: "What is the area of a circle with radius 5 cm? (Use π ≈ 3.14)", options: ["15.7 cm²", "31.4 cm²", "78.5 cm²", "157 cm²"], answer: 2 },
      { category: "Geometry", type: "mcq", text: "A right-angled triangle has shorter sides of 6 cm and 8 cm. How long is the hypotenuse?", options: ["10 cm", "12 cm", "14 cm", "48 cm"], answer: 0 },
      { category: "Statistics", type: "mcq", text: "What is the median of 3, 7, 9, 12, 15?", options: ["7", "9", "9.2", "12"], answer: 1 },
      { category: "Statistics", type: "mcq", text: "A fair six-sided die is rolled once. What is the probability of rolling an even number?", options: ["1/6", "1/3", "1/2", "2/3"], answer: 2 },
      { category: "Algebra", type: "tf", text: "The equation x² = −4 has a real-number solution.", answer: false },
      { category: "Geometry", type: "tf", text: "Every square is also a rectangle.", answer: true },
      { category: "Statistics", type: "tf", text: "The mean of a data set is always one of the values in the set.", answer: false },
      { category: "Algebra", type: "short", text: "Factorise x² − 9.", accept: ["(x-3)(x+3)", "(x+3)(x-3)"] },
      { category: "Statistics", type: "short", text: "Find the mean of 4, 8, 10 and 14.", numeric: 9, tolerance: 0 },
      { category: "Geometry", type: "long", text: "Explain how to find the area of a trapezium. Then use your method to find the area of a trapezium with parallel sides of 6 cm and 10 cm and a height of 4 cm.", keywords: [["parallel"], ["height", "perpendicular"], ["half", "1/2", "divide by 2", "÷ 2", "average"], ["32"]], minWords: 30 },
      { category: "Statistics", type: "long", text: "Explain the difference between the mean, median and mode. Describe a situation where the median is a better summary than the mean.", keywords: [["mean", "average"], ["median", "middle"], ["mode", "most frequent", "most common"], ["outlier", "extreme", "skew"]], minWords: 40 }
    ],
    Physics: [
      { category: "Mechanics", type: "mcq", text: "What is the SI unit of force?", options: ["Joule", "Newton", "Watt", "Pascal"], answer: 1 },
      { category: "Mechanics", type: "mcq", text: "A car travels 120 km in 2 hours. What is its average speed?", options: ["40 km/h", "60 km/h", "120 km/h", "240 km/h"], answer: 1 },
      { category: "Mechanics", type: "mcq", text: "Which of these quantities is a vector?", options: ["Mass", "Speed", "Velocity", "Energy"], answer: 2 },
      { category: "Electricity", type: "mcq", text: "Which equation states Ohm's law?", options: ["V = IR", "P = IV²", "V = I / R", "R = VI"], answer: 0 },
      { category: "Electricity", type: "mcq", text: "A 4 Ω resistor and a 6 Ω resistor are connected in series. What is the total resistance?", options: ["2.4 Ω", "10 Ω", "24 Ω", "1.5 Ω"], answer: 1 },
      { category: "Waves", type: "mcq", text: "Which of these is a longitudinal wave?", options: ["Light", "Radio", "Sound", "X-ray"], answer: 2 },
      { category: "Waves", type: "mcq", text: "A wave has a frequency of 50 Hz and a wavelength of 2 m. What is its speed?", options: ["25 m/s", "52 m/s", "100 m/s", "48 m/s"], answer: 2 },
      { category: "Mechanics", type: "tf", text: "An object moving at a constant velocity has zero resultant force acting on it.", answer: true },
      { category: "Electricity", type: "tf", text: "In a series circuit, the current is the same at every point.", answer: true },
      { category: "Waves", type: "tf", text: "Sound travels faster in a vacuum than in air.", answer: false },
      { category: "Mechanics", type: "short", text: "Calculate the weight, in newtons, of a 5 kg mass where g = 10 N/kg.", numeric: 50, tolerance: 0 },
      { category: "Electricity", type: "short", text: "A 12 V supply drives a current of 3 A through a lamp. What is the power of the lamp in watts?", numeric: 36, tolerance: 0 },
      { category: "Mechanics", type: "long", text: "Describe the energy changes when a ball is dropped from a height and bounces. Explain why it does not return to its original height.", keywords: [["gravitational potential", "potential"], ["kinetic"], ["heat", "thermal", "sound"], ["lost", "dissipated", "wasted", "transferred"], ["conserv"]], minWords: 40 },
      { category: "Waves", type: "long", text: "Explain the difference between transverse and longitudinal waves. Give one example of each.", keywords: [["perpendicular", "right angle"], ["parallel", "same direction"], ["light", "water", "electromagnetic"], ["sound"], ["vibrat", "oscillat"]], minWords: 35 }
    ],
    Chemistry: [
      { category: "Atomic structure", type: "mcq", text: "What is the charge on a proton?", options: ["Negative", "Positive", "Neutral", "It varies"], answer: 1 },
      { category: "Atomic structure", type: "mcq", text: "The atomic number of an element tells you the number of:", options: ["Neutrons", "Protons", "Electron shells", "Isotopes"], answer: 1 },
      { category: "Atomic structure", type: "mcq", text: "Which of these elements is a noble gas?", options: ["Oxygen", "Nitrogen", "Argon", "Chlorine"], answer: 2 },
      { category: "Reactions", type: "mcq", text: "Iron needs which of the following to rust?", options: ["Oxygen only", "Water only", "Oxygen and water", "Carbon dioxide"], answer: 2 },
      { category: "Reactions", type: "mcq", text: "Which change increases the rate of a reaction?", options: ["Lowering the temperature", "Using larger lumps", "Adding a catalyst", "Diluting the reactants"], answer: 2 },
      { category: "Acids and bases", type: "mcq", text: "What is the pH of a neutral solution at 25 °C?", options: ["0", "5", "7", "14"], answer: 2 },
      { category: "Acids and bases", type: "mcq", text: "An acid reacts with an alkali to produce:", options: ["A salt and water", "A salt and hydrogen", "An oxide and water", "Hydrogen and oxygen"], answer: 0 },
      { category: "Atomic structure", type: "tf", text: "Isotopes of an element have different numbers of neutrons.", answer: true },
      { category: "Reactions", type: "tf", text: "A catalyst is used up during a reaction.", answer: false },
      { category: "Acids and bases", type: "tf", text: "Universal indicator turns red in a strong alkali.", answer: false },
      { category: "Atomic structure", type: "short", text: "How many electrons does a neutral sodium atom (atomic number 11) have?", numeric: 11, tolerance: 0 },
      { category: "Acids and bases", type: "short", text: "Name the gas produced when a reactive metal reacts with an acid.", accept: ["hydrogen", "hydrogen gas", "h2"] },
      { category: "Reactions", type: "long", text: "Use collision theory to explain why increasing the temperature increases the rate of a reaction.", keywords: [["collision", "collide"], ["energy", "kinetic"], ["faster", "more often", "frequent"], ["activation energy"], ["successful"]], minWords: 35 },
      { category: "Acids and bases", type: "long", text: "Describe how you would prepare a pure, dry sample of a soluble salt from an acid and an insoluble base.", keywords: [["excess"], ["filter"], ["evaporat", "heat", "crystal"], ["dry"], ["neutral", "react"]], minWords: 40 }
    ],
    Biology: [
      { category: "Cells", type: "mcq", text: "Where does aerobic respiration take place in a cell?", options: ["Nucleus", "Ribosome", "Mitochondrion", "Cell wall"], answer: 2 },
      { category: "Cells", type: "mcq", text: "Which structure is found in plant cells but not in animal cells?", options: ["Cell membrane", "Chloroplast", "Cytoplasm", "Nucleus"], answer: 1 },
      { category: "Cells", type: "mcq", text: "Diffusion is the net movement of particles from:", options: ["Low to high concentration", "High to low concentration", "Only through membranes", "Only in liquids"], answer: 1 },
      { category: "Genetics", type: "mcq", text: "In a plant or animal cell, DNA is found mainly in the:", options: ["Nucleus", "Vacuole", "Cell wall", "Chloroplast"], answer: 0 },
      { category: "Genetics", type: "mcq", text: "How many chromosomes are in a typical human body cell?", options: ["23", "44", "46", "48"], answer: 2 },
      { category: "Ecology", type: "mcq", text: "The producers in a food chain are usually:", options: ["Herbivores", "Green plants", "Decomposers", "Carnivores"], answer: 1 },
      { category: "Ecology", type: "mcq", text: "Which gas do plants absorb for photosynthesis?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
      { category: "Cells", type: "tf", text: "Enzymes are biological catalysts.", answer: true },
      { category: "Genetics", type: "tf", text: "Identical twins have the same DNA.", answer: true },
      { category: "Ecology", type: "tf", text: "Energy is recycled within a food chain.", answer: false },
      { category: "Ecology", type: "short", text: "Name the process plants use to make glucose using light energy.", accept: ["photosynthesis"] },
      { category: "Genetics", type: "short", text: "What is the term for different versions of the same gene?", accept: ["allele", "alleles"] },
      { category: "Cells", type: "long", text: "Describe how the structure of a red blood cell is adapted to its function.", keywords: [["haemoglobin", "hemoglobin"], ["oxygen"], ["no nucleus", "lack a nucleus", "without a nucleus"], ["biconcave", "surface area"], ["flexible", "squeeze", "capillar"]], minWords: 35 },
      { category: "Ecology", type: "long", text: "Explain how deforestation can affect the carbon cycle and biodiversity.", keywords: [["carbon dioxide", "co2"], ["photosynthesis"], ["habitat"], ["species", "biodiversity"], ["burn", "combustion", "decompos"]], minWords: 40 }
    ],
    English: [
      { category: "Grammar", type: "mcq", text: "Choose the correct word: \"Neither of the answers ___ correct.\"", options: ["are", "is", "were", "be"], answer: 1 },
      { category: "Grammar", type: "mcq", text: "Which sentence uses the apostrophe correctly?", options: ["The dog wagged it's tail.", "The dog wagged its tail.", "The dogs' wagged its tail.", "The dog wagged its' tail."], answer: 1 },
      { category: "Grammar", type: "mcq", text: "Identify the adverb: \"She answered the question confidently.\"", options: ["She", "answered", "question", "confidently"], answer: 3 },
      { category: "Vocabulary", type: "mcq", text: "Which word is closest in meaning to \"meticulous\"?", options: ["Careless", "Thorough", "Quick", "Noisy"], answer: 1 },
      { category: "Vocabulary", type: "mcq", text: "Which word is the opposite of \"scarce\"?", options: ["Rare", "Plentiful", "Limited", "Hidden"], answer: 1 },
      { category: "Comprehension", type: "mcq", text: "An author's tone is best described as the author's:", options: ["Main argument", "Attitude toward the subject", "Choice of title", "Use of evidence"], answer: 1 },
      { category: "Comprehension", type: "mcq", text: "A text written mainly to convince the reader is:", options: ["Narrative", "Descriptive", "Persuasive", "Instructional"], answer: 2 },
      { category: "Grammar", type: "tf", text: "A semicolon can join two closely related independent clauses.", answer: true },
      { category: "Vocabulary", type: "tf", text: "\"Affect\" is usually a verb and \"effect\" is usually a noun.", answer: true },
      { category: "Comprehension", type: "tf", text: "A summary should include your personal opinion of the text.", answer: false },
      { category: "Grammar", type: "short", text: "Write the simple past tense of \"begin\".", accept: ["began"] },
      { category: "Vocabulary", type: "short", text: "Give one word that means \"happening once every year\".", accept: ["annual", "yearly", "annually"] },
      { category: "Comprehension", type: "long", text: "Write a paragraph arguing whether students should be given homework. Use at least two persuasive techniques.", keywords: [["because", "therefore", "as a result"], ["evidence", "research", "study", "statistic"], ["you", "we", "our"], ["however", "although", "on the other hand"], ["in conclusion", "overall", "clearly"]], minWords: 60 },
      { category: "Comprehension", type: "long", text: "Explain the difference between a fact and an opinion. Give one example of each.", keywords: [["fact"], ["opinion"], ["prove", "verify", "evidence", "true"], ["belief", "feel", "think", "view"], ["example", "for instance", "such as"]], minWords: 35 }
    ]
  };

  // Attach ids and marks
  Object.keys(BANK).forEach(function (subject) {
    var prefix = subject.slice(0, 4).toLowerCase();
    BANK[subject].forEach(function (q, i) {
      q.id = prefix + "-" + String(i + 1).padStart(2, "0");
      q.marks = MARKS[q.type];
      q.kind = q.type === "mcq" || q.type === "tf" ? "objective" : "subjective";
    });
  });

  var TYPE_LABELS = { mcq: "Multiple choice", tf: "True or false", short: "Short answer", long: "Long answer" };

  function normalise(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[−–—]/g, "-")
      .replace(/\s+/g, "")
      .replace(/[.,;!?'"]/g, "");
  }

  /**
   * Grade one answer. Returns { obtained, status: "correct"|"incorrect"|"unanswered", method }.
   * Long answers are estimated by keyword coverage — clearly labelled as demo marking in the UI.
   */
  function grade(q, answer) {
    var empty = answer == null || answer === "" || (typeof answer === "string" && !answer.trim());
    if (empty) return { obtained: 0, status: "unanswered", method: "none" };

    if (q.type === "mcq") {
      var ok = Number(answer) === q.answer;
      return { obtained: ok ? q.marks : 0, status: ok ? "correct" : "incorrect", method: "auto" };
    }
    if (q.type === "tf") {
      var okTf = String(answer) === String(q.answer);
      return { obtained: okTf ? q.marks : 0, status: okTf ? "correct" : "incorrect", method: "auto" };
    }
    if (q.type === "short") {
      var good = false;
      if (q.numeric != null) {
        var n = parseFloat(String(answer).replace(/[^0-9.\-]/g, ""));
        good = isFinite(n) && Math.abs(n - q.numeric) <= (q.tolerance || 0);
      }
      if (!good && q.accept) {
        var a = normalise(answer);
        good = q.accept.some(function (x) { return normalise(x) === a; });
      }
      return { obtained: good ? q.marks : 0, status: good ? "correct" : "incorrect", method: "auto" };
    }
    // long
    var text = String(answer).toLowerCase();
    var words = text.split(/\s+/).filter(Boolean).length;
    var hits = q.keywords.filter(function (group) {
      return group.some(function (k) { return text.indexOf(k.toLowerCase()) !== -1; });
    }).length;
    var coverage = hits / q.keywords.length;
    var lengthFactor = Math.min(1, words / (q.minWords || 30));
    var obtained = Math.round(q.marks * coverage * (0.6 + 0.4 * lengthFactor));
    return {
      obtained: obtained,
      status: obtained / q.marks >= 0.5 ? "correct" : "incorrect",
      method: "keyword-estimate",
      detail: hits + " of " + q.keywords.length + " key ideas found in " + words + " words"
    };
  }

  BB.questionBank = {
    MARKS: MARKS,
    TYPE_LABELS: TYPE_LABELS,
    subjects: function () { return Object.keys(BANK); },
    has: function (subject) { return !!BANK[subject]; },
    questions: function (subject) { return (BANK[subject] || []).slice(); },
    categoriesFor: function (subject) {
      var seen = [];
      (BANK[subject] || []).forEach(function (q) { if (seen.indexOf(q.category) === -1) seen.push(q.category); });
      return seen;
    },
    grade: grade
  };
})(window.BB = window.BB || {});
