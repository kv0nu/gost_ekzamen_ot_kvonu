(function () {
  "use strict";

  // ---------- State ----------
  let session = [];        // array of {id, question, options:[{html,correct}], picked, flagged}
  let current = 0;
  let timerHandle = null;
  let startTime = null;
  let elapsedAtPause = 0;
  let selectedCount = null;
  let lastWrongPool = null; // for "retry mistakes"

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showScreen(id) {
    $all(".screen").forEach((s) => s.classList.remove("active"));
    $("#" + id).classList.add("active");
    window.scrollTo({ top: 0 });
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return m + ":" + s;
  }

  // ---------- Home screen ----------
  $("#pool-total").textContent = QUESTIONS.length;

  $all(".count-card").forEach((card) => {
    card.addEventListener("click", () => {
      $all(".count-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedCount = parseInt(card.dataset.count, 10);
      $("#btn-start").disabled = false;
    });
  });

  $("#btn-start").addEventListener("click", () => startQuiz(pickRandomQuestions(selectedCount)));

  function pickRandomQuestions(n) {
    const pool = shuffle(QUESTIONS).slice(0, Math.min(n, QUESTIONS.length));
    return pool.map((q) => ({
      id: q.id,
      question: q.question,
      options: shuffle(q.options),
      picked: null,
      flagged: false,
    }));
  }

  // ---------- Quiz flow ----------
  function startQuiz(questions) {
    session = questions;
    current = 0;
    startTime = Date.now();
    elapsedAtPause = 0;
    clearInterval(timerHandle);
    timerHandle = setInterval(updateTimer, 500);
    showScreen("screen-quiz");
    renderQuestion();
  }

  function updateTimer() {
    const sec = (Date.now() - startTime) / 1000;
    $("#quiz-timer").textContent = formatTime(sec);
  }

  function renderQuestion(direction) {
    const q = session[current];
    $("#quiz-position").textContent = `Вопрос ${current + 1} из ${session.length}`;
    $("#progress-fill").style.width = ((current) / session.length * 100) + "%";
    $("#question-number").textContent = current + 1;
    $("#question-source").textContent = `№ ${q.id} в базе`;
    $("#question-text").innerHTML = q.question;

    const card = $("#question-card");
    card.classList.remove("slide-back");
    void card.offsetWidth;
    if (direction === "back") card.classList.add("slide-back");

    const optsWrap = $("#options");
    optsWrap.innerHTML = "";
    const letters = ["A", "B", "C", "D"];
    q.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.innerHTML = `<span class="option-mark">${letters[idx]}</span><span class="opt-text">${opt.html}</span>`;
      if (q.picked !== null) {
        btn.classList.add("disabled");
        if (idx === q.picked) btn.classList.add("selected");
        if (opt.correct) btn.classList.add("correct");
        else if (idx === q.picked) btn.classList.add("wrong");
      }
      btn.addEventListener("click", () => selectOption(idx));
      optsWrap.appendChild(btn);
    });

    $("#btn-prev").disabled = current === 0;
    $("#btn-next").textContent = current === session.length - 1 ? "Завершить" : "Далее →";
    updateFlagButton();
  }

  function selectOption(idx) {
    const q = session[current];
    if (q.picked !== null) return;
    q.picked = idx;
    renderQuestion();
    // small delay auto-advance for smoother feel, unless last question
    if (current < session.length - 1) {
      setTimeout(() => {
        if (session[current].picked !== null) goNext();
      }, 480);
    }
  }

  function goNext() {
    if (current < session.length - 1) {
      current++;
      renderQuestion();
    } else {
      finishQuiz();
    }
  }
  function goPrev() {
    if (current > 0) {
      current--;
      renderQuestion("back");
    }
  }

  $("#btn-next").addEventListener("click", goNext);
  $("#btn-prev").addEventListener("click", goPrev);

  function updateFlagButton() {
    const q = session[current];
    $("#btn-flag").classList.toggle("flagged", q.flagged);
    $("#btn-flag").textContent = q.flagged ? "★" : "☆";
  }
  $("#btn-flag").addEventListener("click", () => {
    session[current].flagged = !session[current].flagged;
    updateFlagButton();
    renderNavGrid();
  });

  $("#btn-quit").addEventListener("click", () => {
    if (confirm("Завершить тест и вернуться на главный экран? Прогресс будет потерян.")) {
      clearInterval(timerHandle);
      showScreen("screen-home");
    }
  });

  // ---------- Navigator overlay ----------
  function renderNavGrid() {
    const grid = $("#nav-grid");
    grid.innerHTML = "";
    session.forEach((q, idx) => {
      const cell = document.createElement("button");
      cell.className = "nav-cell";
      if (q.picked !== null) cell.classList.add("answered");
      if (idx === current) cell.classList.add("current");
      if (q.flagged) cell.classList.add("flagged");
      cell.textContent = idx + 1;
      cell.title = `№ ${q.id} в базе`;
      cell.addEventListener("click", () => {
        current = idx;
        renderQuestion();
        closeNav();
      });
      grid.appendChild(cell);
    });
  }
  function openNav() {
    renderNavGrid();
    $("#nav-overlay").classList.add("open");
  }
  function closeNav() { $("#nav-overlay").classList.remove("open"); }
  $("#btn-nav-open").addEventListener("click", openNav);
  $("#btn-nav-close").addEventListener("click", closeNav);
  $("#nav-overlay").addEventListener("click", (e) => { if (e.target.id === "nav-overlay") closeNav(); });
  $("#btn-finish").addEventListener("click", () => { closeNav(); finishQuiz(); });

  // ---------- Keyboard shortcuts ----------
  document.addEventListener("keydown", (e) => {
    if (!$("#screen-quiz").classList.contains("active")) return;
    if ($("#nav-overlay").classList.contains("open")) return;
    const key = e.key.toUpperCase();
    const map = { "1": 0, "2": 1, "3": 2, "4": 3, "A": 0, "B": 1, "C": 2, "D": 3 };
    if (map[key] !== undefined) selectOption(map[key]);
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
  });

  // ---------- Results ----------
  function finishQuiz() {
    clearInterval(timerHandle);
    const totalTime = (Date.now() - startTime) / 1000;
    const correct = session.filter((q) => q.picked !== null && q.options[q.picked].correct).length;
    const answered = session.filter((q) => q.picked !== null).length;
    const total = session.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;

    $("#result-percent").textContent = pct + "%";
    $("#result-sub").textContent = `Правильных ответов: ${correct} из ${total}` + (answered < total ? ` (отвечено на ${answered})` : "");
    $("#stat-correct").textContent = correct;
    $("#stat-wrong").textContent = total - correct;
    $("#stat-time").textContent = formatTime(totalTime);

    let title = "Отличный результат!";
    let ringColor = "var(--good)";
    if (pct < 50) { title = "Есть куда расти"; ringColor = "var(--bad)"; }
    else if (pct < 80) { title = "Хороший результат"; ringColor = "var(--accent)"; }
    $("#result-title").textContent = title;

    const ring = $("#ring-fg");
    ring.style.stroke = ringColor;
    const circumference = 553;
    ring.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
      ring.style.strokeDashoffset = circumference - (circumference * pct) / 100;
    });

    const wrongCount = session.filter((q) => q.picked === null || !q.options[q.picked].correct).length;
    $("#btn-retry-wrong").style.display = wrongCount > 0 ? "block" : "none";

    showScreen("screen-result");
  }

  $("#btn-review").addEventListener("click", () => renderReview("wrong"));
  $("#btn-restart").addEventListener("click", () => showScreen("screen-home"));
  $("#btn-retry-wrong").addEventListener("click", () => {
    const wrongQs = session.filter((q) => q.picked === null || !q.options[q.picked].correct);
    const rebuilt = wrongQs.map((q) => ({
      id: q.id,
      question: q.question,
      options: shuffle(q.options.map((o) => ({ html: o.html, correct: o.correct }))),
      picked: null,
      flagged: false,
    }));
    startQuiz(rebuilt);
  });

  // ---------- Review screen ----------
  function renderReview(filter) {
    $all(".chip").forEach((c) => c.classList.toggle("chip-active", c.dataset.filter === filter));
    const list = $("#review-list");
    list.innerHTML = "";
    const items = session.filter((q) => filter === "all" || q.picked === null || !q.options[q.picked].correct);

    if (items.length === 0) {
      list.innerHTML = '<div class="review-empty">Ошибок нет — отличная работа!</div>';
    } else {
      items.forEach((q) => {
        const originalIdx = session.indexOf(q);
        const box = document.createElement("div");
        box.className = "review-item";
        const letters = ["A", "B", "C", "D"];
        let optsHtml = "";
        q.options.forEach((opt, idx) => {
          let cls = "option disabled";
          if (opt.correct) cls += " correct";
          else if (idx === q.picked) cls += " wrong";
          optsHtml += `<div class="${cls}"><span class="option-mark">${letters[idx]}</span><span class="opt-text">${opt.html}</span></div>`;
        });
        box.innerHTML = `
          <div class="question-meta">
            <div class="question-number">${originalIdx + 1}</div>
            <div class="question-source">№ ${q.id} в базе</div>
          </div>
          <div class="question-text">${q.question}</div>
          <div class="options">${optsHtml}</div>
        `;
        list.appendChild(box);
      });
    }
    showScreen("screen-review");
  }

  $all(".chip").forEach((chip) => chip.addEventListener("click", () => renderReview(chip.dataset.filter)));
  $("#btn-review-back").addEventListener("click", () => showScreen("screen-result"));

})();
