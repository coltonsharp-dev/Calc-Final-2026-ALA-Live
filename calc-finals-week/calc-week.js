/* ──────────────────────────────────────────────────────────────────
   AP PRE-CALC · FINALS REVIEW WEEK · SHARED ENGINE
   Powers randomized practice questions with instant misconception
   feedback. Each day page calls window.CalcDay.init(config).
   ────────────────────────────────────────────────────────────────── */

// ── EDIT THIS: teacher's email & school strings ────────────────────
window.CALC_CONFIG = window.CALC_CONFIG || {
  TEACHER_EMAIL: "colton.sharp@alaschools.org",
  SCHOOL_LINE:   "ALA Queen Creek · Room 501",
  COURSE_LINE:   "AP Calculus AB · Finals Review Week"
};

// ── RANDOM HELPERS (R for random) ──────────────────────────────────
const R = {
  int(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; },
  intExcl(min, max, exclude){
    const excluded = Array.isArray(exclude) ? exclude : [exclude];
    let v; let tries = 0;
    do { v = R.int(min, max); tries++; }
    while (excluded.includes(v) && tries < 40);
    return v;
  },
  pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; },
  shuffle(arr){
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  sign(){ return Math.random() < 0.5 ? -1 : 1; },
  letter(i){ return "ABCDEFGH"[i]; }
};
window.R = R;

// ── STRING / ANSWER NORMALIZATION ──────────────────────────────────
// Used to compare student input against accepted answers loosely.
function normalize(s){
  if (s === null || s === undefined) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/π|pi/g, "p")            // π and "pi" both become "p"
    .replace(/√|sqrt/g, "r")          // √ and "sqrt" both become "r"
    .replace(/\*/g, "")               // strip multiplication stars
    .replace(/·/g, "")
    .replace(/×/g, "")
    .replace(/\^/g, "")               // strip exponent caret (so x^2 == x2)
    .replace(/×|·/g, "")
    .replace(/[()\[\]{}]/g, "");      // strip brackets
}

// Match input against an accepted-answer list. Each accepted answer can be:
//   - a string (compared via normalize equality)
//   - a function (val => boolean) for custom matching
function matchAnswer(input, accepted){
  const n = normalize(input);
  if (n === "") return false;
  for (const a of accepted){
    if (typeof a === "function"){
      if (a(input, n)) return true;
    } else {
      if (normalize(a) === n) return true;
    }
  }
  return false;
}

// Try to match a wrong answer against a misconception entry. Each entry:
//   { match: "15" | ["15","15.0"] | (val => bool), why: "..." }
function matchMisconception(input, miscList){
  if (!miscList || miscList.length === 0) return null;
  const n = normalize(input);
  for (const m of miscList){
    if (typeof m.match === "function"){
      if (m.match(input, n)) return m;
    } else {
      const list = Array.isArray(m.match) ? m.match : [m.match];
      for (const v of list){
        if (normalize(v) === n) return m;
      }
    }
  }
  return null;
}

// ── ENGINE STATE ───────────────────────────────────────────────────
const State = {
  questions: [],       // question definitions
  variants: {},        // current variant data per question id
  responses: {},       // current student response per question id
  attempts: {},        // attempt count per question id
  results: {},         // pass/fail per question id (latest attempt)
  submitted: false,
  startTime: Date.now(),
  finalTime: "00:00",
  config: null
};

// ── TIMER ──────────────────────────────────────────────────────────
function pad(n){ return n < 10 ? "0" + n : "" + n; }
function fmtTime(ms){
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60){
    const h = Math.floor(m / 60);
    return pad(h) + ":" + pad(m % 60) + ":" + pad(sec);
  }
  return pad(m) + ":" + pad(sec);
}
function startTimer(){
  const tv = document.getElementById("timerVal");
  if (!tv) return;
  State.startTime = Date.now();
  setInterval(() => {
    if (!State.submitted) tv.textContent = fmtTime(Date.now() - State.startTime);
  }, 500);
}
function stopTimer(){
  State.finalTime = fmtTime(Date.now() - State.startTime);
  const tv = document.getElementById("timerVal");
  if (tv) tv.textContent = State.finalTime;
}

// ── QUESTION CARD RENDERING ────────────────────────────────────────
function renderQuestion(q){
  const card = document.querySelector('.q-card[data-q="' + q.id + '"]');
  if (!card) return;

  // Generate fresh variant
  const variant = q.generate();
  State.variants[q.id] = variant;
  State.responses[q.id] = null;
  State.results[q.id] = null;

  // Render stem
  const stemEl = card.querySelector(".q-stem");
  if (stemEl) stemEl.innerHTML = variant.stem;

  // Render input area by type
  const inputArea = card.querySelector(".q-input-area");
  if (!inputArea) return;

  if (q.type === "mc"){
    renderMC(card, inputArea, q, variant);
  } else if (q.type === "fib"){
    renderFIB(card, inputArea, q, variant);
  } else if (q.type === "dd"){
    renderDD(card, inputArea, q, variant);
  }

  // Clear feedback panel
  const fb = card.querySelector(".q-feedback");
  if (fb){ fb.classList.remove("shown", "correct", "wrong"); fb.innerHTML = ""; }

  // Update attempts pill
  const attEl = card.querySelector(".q-attempts");
  if (attEl){
    const n = State.attempts[q.id] || 0;
    attEl.textContent = "Attempt " + (n + 1);
  }
}

function renderMC(card, inputArea, q, variant){
  // Shuffle options so the correct one isn't always in the same slot
  const opts = R.shuffle(variant.options);
  variant._shuffledOpts = opts;
  inputArea.innerHTML = '<div class="opts">' +
    opts.map((o, i) =>
      '<div class="opt" data-idx="' + i + '">' +
        '<span class="opt-letter">' + R.letter(i) + '</span>' +
        '<span class="opt-text">' + o.html + '</span>' +
      '</div>'
    ).join("") +
    '</div>';

  // Wire click handlers
  inputArea.querySelectorAll(".opt").forEach(el => {
    el.addEventListener("click", () => {
      if (State.submitted) return;
      const idx = parseInt(el.dataset.idx, 10);
      const chosen = opts[idx];
      // Mark all as locked, show correct/wrong
      inputArea.querySelectorAll(".opt").forEach((o, i) => {
        o.classList.add("locked");
        o.classList.remove("selected");
        const opt = opts[i];
        if (opt.correct) o.classList.add("correct");
        if (i === idx && !opt.correct) o.classList.add("wrong");
      });
      handleAnswer(q, chosen.correct, chosen);
    });
  });
}

function renderFIB(card, inputArea, q, variant){
  const inputId = "fib-" + q.id;
  const prefix = variant.prefix || "Answer:";
  inputArea.innerHTML =
    '<div class="fib-wrap">' +
      '<span class="fib-prefix">' + prefix + '</span>' +
      '<input type="text" class="fib-input" id="' + inputId + '" placeholder="' + (variant.placeholder || "your answer") + '" autocomplete="off">' +
      '<button class="fib-check" data-q="' + q.id + '">Check</button>' +
    '</div>';

  const input = inputArea.querySelector("input");
  const btn = inputArea.querySelector("button");

  const submitFIB = () => {
    if (State.submitted) return;
    if (input.disabled) return;
    const val = input.value.trim();
    if (val === "") { input.focus(); return; }
    const correct = matchAnswer(val, variant.accepted || []);
    input.disabled = true; btn.disabled = true;
    input.classList.add(correct ? "correct" : "wrong");
    handleAnswer(q, correct, { value: val, isFIB: true });
  };
  btn.addEventListener("click", submitFIB);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitFIB(); });
}

function renderDD(card, inputArea, q, variant){
  const ddId = "dd-" + q.id;
  const prefix = variant.prefix || "Select:";
  const opts = R.shuffle(variant.options);
  variant._shuffledOpts = opts;
  const optionsHTML = '<option value="" selected disabled>— choose —</option>' +
    opts.map((o, i) => '<option value="' + i + '">' + o.text + '</option>').join("");
  inputArea.innerHTML =
    '<div class="dd-wrap">' +
      '<span class="dd-prefix">' + prefix + '</span>' +
      '<select class="dd-select" id="' + ddId + '">' + optionsHTML + '</select>' +
    '</div>';

  const sel = inputArea.querySelector("select");
  sel.addEventListener("change", () => {
    if (State.submitted) return;
    const idx = parseInt(sel.value, 10);
    if (isNaN(idx)) return;
    const chosen = opts[idx];
    sel.disabled = true;
    sel.classList.add(chosen.correct ? "correct" : "wrong");
    handleAnswer(q, chosen.correct, chosen);
  });
}

// ── ANSWER HANDLING + FEEDBACK ─────────────────────────────────────
function handleAnswer(q, isCorrect, chosen){
  State.attempts[q.id] = (State.attempts[q.id] || 0) + 1;
  State.responses[q.id] = chosen;
  State.results[q.id] = isCorrect;
  showFeedback(q, isCorrect, chosen);
  updateProgress();
}

function showFeedback(q, isCorrect, chosen){
  const card = document.querySelector('.q-card[data-q="' + q.id + '"]');
  if (!card) return;
  const fb = card.querySelector(".q-feedback");
  if (!fb) return;
  const variant = State.variants[q.id];

  fb.classList.remove("correct", "wrong");
  fb.classList.add(isCorrect ? "correct" : "wrong");

  let html = '<div class="fb-head">' +
    '<span class="fb-tag">' + (isCorrect ? "✓ Correct" : "✗ Not quite") + '</span>' +
    '<span class="fb-title">' + (isCorrect ? "Nice — that\'s it." : "Let\'s look at why.") + '</span>' +
    '</div>';

  if (isCorrect){
    if (variant.workedSolution){
      html += '<div class="fb-body">' + variant.workedSolution + '</div>';
    }
  } else {
    // Build a misconception-targeted explanation
    let misc = null;
    if (chosen && chosen.misconception){
      misc = { why: chosen.misconception };
    } else if (chosen && chosen.isFIB){
      misc = matchMisconception(chosen.value, variant.misconceptions);
    }
    if (misc){
      html += '<div class="fb-misconception">' +
        '<span class="lbl">Misconception</span>' + misc.why +
        '</div>';
    } else {
      html += '<div class="fb-body">That answer doesn\'t match the expected result. Check your setup against the worked solution below.</div>';
    }
    // Always include the correct value + worked solution on wrong answers
    if (variant.correctDisplay){
      html += '<div class="fb-correct-line">' +
        '<span class="lbl">Correct</span>' + variant.correctDisplay +
        '</div>';
    }
    if (variant.workedSolution){
      html += '<div class="fb-body" style="margin-top:10px;">' + variant.workedSolution + '</div>';
    }
  }

  fb.innerHTML = html;
  fb.classList.add("shown");
}

// ── REGEN BUTTON ───────────────────────────────────────────────────
function wireRegenButton(q){
  const card = document.querySelector('.q-card[data-q="' + q.id + '"]');
  if (!card) return;
  const btn = card.querySelector(".q-regen");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (State.submitted) return;
    renderQuestion(q);
    updateProgress();
  });
}

// ── PROGRESS UI ────────────────────────────────────────────────────
function countAnswered(){
  return State.questions.filter(q => State.results[q.id] !== null && State.results[q.id] !== undefined).length;
}
function countCorrect(){
  return State.questions.filter(q => State.results[q.id] === true).length;
}
function countWrong(){
  return State.questions.filter(q => State.results[q.id] === false).length;
}
function updateProgress(){
  const total = State.questions.length;
  const ans = countAnswered();
  const correct = countCorrect();
  const wrong = countWrong();
  const progNum = document.getElementById("progNum");
  if (progNum) progNum.textContent = ans;
  const meter = document.getElementById("submitMeterFill");
  if (meter) meter.style.width = (ans / total) * 100 + "%";

  // Update score pills
  const cEl = document.getElementById("scoreCorrect");
  const wEl = document.getElementById("scoreWrong");
  const uEl = document.getElementById("scoreUnanswered");
  if (cEl) cEl.textContent = correct;
  if (wEl) wEl.textContent = wrong;
  if (uEl) uEl.textContent = total - ans;
}

// ── BUILD SUBMISSION TEXT ──────────────────────────────────────────
function pad2(s, n){ s = String(s); return s + " ".repeat(Math.max(0, n - s.length)); }

function buildSubmissionText(){
  const cfg = State.config;
  const name = (document.getElementById("studentName").value || "").trim();
  const now = new Date();
  const dateStr = now.toLocaleString("en-US", {
    weekday:"short", year:"numeric", month:"short", day:"numeric",
    hour:"numeric", minute:"2-digit"
  });
  const elapsed = State.submitted ? State.finalTime : fmtTime(Date.now() - State.startTime);
  const total = State.questions.length;
  const ans = countAnswered();
  const correct = countCorrect();
  const wrong = countWrong();

  const L = [];
  L.push("─────────────────────────────────────────────────────────");
  L.push("   " + window.CALC_CONFIG.COURSE_LINE.toUpperCase());
  L.push("   " + cfg.dayTitle.toUpperCase() + " · " + cfg.dayLabel);
  L.push("   " + window.CALC_CONFIG.SCHOOL_LINE);
  L.push("─────────────────────────────────────────────────────────");
  L.push("");
  L.push("Student:        " + (name || "(NAME NOT ENTERED)"));
  L.push("Submitted:      " + dateStr);
  L.push("Time taken:     " + elapsed);
  L.push("Completion:     " + ans + " / " + total + " answered");
  L.push("Score:          " + correct + " correct  ·  " + wrong + " wrong  ·  " + (total - ans) + " unanswered");
  if (ans > 0){
    const pct = Math.round((correct / ans) * 100);
    L.push("Accuracy:       " + pct + "%  (of " + ans + " attempted)");
  }
  L.push("");
  L.push("──────── QUESTION-BY-QUESTION RESULTS ───────────────────");
  L.push("");
  State.questions.forEach((q, i) => {
    const num = pad2(i + 1, 3);
    const att = State.attempts[q.id] || 0;
    const result = State.results[q.id];
    const variant = State.variants[q.id];
    let resStr;
    if (result === true)      resStr = "✓ correct";
    else if (result === false) resStr = "✗ wrong";
    else                       resStr = "—  unanswered";
    L.push("  Q" + num + "  [" + q.tag.padEnd(20) + "]  " + resStr + "  (attempts: " + att + ")");
    // Add their last response for context
    if (variant && State.responses[q.id]){
      const resp = State.responses[q.id];
      let respStr = "";
      if (resp.isFIB) respStr = "typed: " + resp.value;
      else if (resp.text !== undefined) respStr = "selected: " + resp.text;
      else if (resp.html !== undefined) respStr = "selected: " + stripHtml(resp.html);
      if (respStr) L.push("            " + respStr);
    }
  });
  L.push("");
  L.push("─────────────────────────────────────────────────────────");
  L.push("                  END OF SUBMISSION");
  L.push("─────────────────────────────────────────────────────────");
  return L.join("\n");
}

function stripHtml(html){
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim().replace(/\s+/g, " ");
}

// ── CLIPBOARD COPY ─────────────────────────────────────────────────
async function copyToClipboard(text){
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch(e){
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch(e2){ return false; }
  }
}

// ── NAME VALIDATION + LOCK ─────────────────────────────────────────
function nameOK(){
  const v = (document.getElementById("studentName").value || "").trim();
  if (v.length < 2){
    const inp = document.getElementById("studentName");
    inp.classList.add("missing");
    inp.focus();
    setTimeout(() => inp.classList.remove("missing"), 2400);
    return false;
  }
  return true;
}
function lockExam(){
  document.querySelectorAll(".opt").forEach(o => o.classList.add("locked"));
  document.querySelectorAll(".fib-input").forEach(i => i.disabled = true);
  document.querySelectorAll(".fib-check").forEach(b => b.disabled = true);
  document.querySelectorAll(".dd-select").forEach(s => s.disabled = true);
  document.querySelectorAll(".q-regen").forEach(b => b.disabled = true);
  document.getElementById("studentName").disabled = true;
  State.submitted = true;
  stopTimer();
  const cb = document.getElementById("copyBtn");
  if (cb){
    cb.classList.add("done");
    const t = cb.querySelector(".sb-text");
    const i = cb.querySelector(".sb-icon");
    if (t) t.textContent = "Copied — Open Canvas";
    if (i) i.textContent = "✓";
  }
}

// ── EMAIL FLOW ─────────────────────────────────────────────────────
function openEmail(){
  if (!nameOK()) return;
  const name = document.getElementById("studentName").value.trim();
  const text = buildSubmissionText();
  const cfg = State.config;
  const subject = "Calc Review · " + cfg.dayTitle + " Submission — " + name;
  const mailto = "mailto:" + encodeURIComponent(window.CALC_CONFIG.TEACHER_EMAIL)
    + "?subject=" + encodeURIComponent(subject)
    + "&body=" + encodeURIComponent(text);
  window.location.href = mailto;
  if (!State.submitted) lockExam();
}

// ── COPY FLOW ──────────────────────────────────────────────────────
async function copyFlow(){
  if (!nameOK()) return;
  const text = buildSubmissionText();
  const ok = await copyToClipboard(text);
  const previewEl = document.getElementById("previewText");
  if (previewEl) previewEl.textContent = text;
  const modal = document.getElementById("resultsModal");
  if (modal) modal.classList.add("shown");
  if (!State.submitted) lockExam();
  if (!ok){
    const ph = document.querySelector(".ph-label");
    if (ph) ph.innerHTML = "Preview · <strong style=\"color:var(--gold)\">auto-copy blocked — select all below and copy manually</strong>";
  }
}

// ── INIT ───────────────────────────────────────────────────────────
window.CalcDay = {
  init(config){
    State.config = config;
    State.questions = config.questions || [];

    // Render all questions
    State.questions.forEach(q => {
      renderQuestion(q);
      wireRegenButton(q);
    });

    // Scroll-top + progress bar
    const progressBar = document.getElementById("progressBar");
    const scrollTopBtn = document.getElementById("scrollTop");
    window.addEventListener("scroll", () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
      if (progressBar) progressBar.style.transform = "scaleX(" + scrolled + ")";
      if (scrollTopBtn){
        if (h.scrollTop > 600) scrollTopBtn.classList.add("visible");
        else                   scrollTopBtn.classList.remove("visible");
      }
    });
    if (scrollTopBtn){
      scrollTopBtn.addEventListener("click", () => window.scrollTo({ top:0, behavior:"smooth" }));
    }

    // Wire submit buttons
    const copyBtn = document.getElementById("copyBtn");
    if (copyBtn) copyBtn.addEventListener("click", copyFlow);
    const emailBtn = document.getElementById("emailBtn");
    if (emailBtn) emailBtn.addEventListener("click", openEmail);
    const modalEmail = document.getElementById("modalEmail");
    if (modalEmail) modalEmail.addEventListener("click", openEmail);
    const recopyBtn = document.getElementById("recopyBtn");
    if (recopyBtn) recopyBtn.addEventListener("click", async () => {
      const text = document.getElementById("previewText").textContent;
      const ok = await copyToClipboard(text);
      recopyBtn.textContent = ok ? "✓ Copied" : "Couldn't auto-copy — select & copy below";
      setTimeout(() => { recopyBtn.textContent = "Copy Again"; }, 2200);
    });
    const modalClose = document.getElementById("modalClose");
    if (modalClose) modalClose.addEventListener("click", () => {
      document.getElementById("resultsModal").classList.remove("shown");
    });
    const modalOverlay = document.getElementById("resultsModal");
    if (modalOverlay) modalOverlay.addEventListener("click", (e) => {
      if (e.target.id === "resultsModal") modalOverlay.classList.remove("shown");
    });
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) resetBtn.addEventListener("click", () => {
      if (confirm("Reset all your answers and start over with new numbers?")) location.reload();
    });
    const nameInp = document.getElementById("studentName");
    if (nameInp) nameInp.addEventListener("input", () => nameInp.classList.remove("missing"));

    // Start timer
    startTimer();
    updateProgress();
  }
};
