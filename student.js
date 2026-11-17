/* Оқушы беті: логин + құпиясөз → тесттер → тапсыру → нәтиже, менің нәтижелерім */
(function () {
  "use strict";
  const { sb, CFG, configured, h, rich, toast, modal, errMsg, TYPE_LABEL, renderReview, fmtDate, num, pct } = window.App;
  const app = document.getElementById("app");
  const who = document.getElementById("who");
  const TOKEN_KEY = "chem_student_token";
  let me = null; // {token, username, full_name, class_name}

  if (CFG.SITE_TITLE) {
    document.getElementById("siteTitle").textContent = CFG.SITE_TITLE;
    document.title = CFG.SITE_TITLE;
  }

  function setView(...nodes) {
    app.innerHTML = "";
    nodes.forEach(n => n && app.appendChild(n));
    window.scrollTo(0, 0);
  }
  const loading = () => setView(h("div", { class: "narrow", style: { textAlign: "center" } }, h("span", { class: "spinner" })));

  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args);
    if (error) {
      if (String(error.message || "").includes("NO_SESSION")) { expired(); throw new Error("NO_SESSION"); }
      throw error;
    }
    return data;
  }
  function expired() {
    localStorage.removeItem(TOKEN_KEY);
    me = null;
    showLogin("Кіру мерзімі аяқталды немесе құпиясөз өзгерді. Қайта кіріңіз.");
  }

  function renderWho() {
    who.innerHTML = "";
    if (!me) return;
    who.appendChild(h("div", {}, h("b", {}, me.full_name), me.class_name ? " · " + me.class_name : ""));
    who.appendChild(h("button", { class: "ghost sm", onclick: logout }, "Шығу"));
  }

  // ---------- кіру ----------
  function showLogin(msg) {
    me = null; renderWho();
    const user = h("input", { type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: "false", required: true });
    const pass = h("input", { type: "password", autocomplete: "current-password", required: true });
    const err = h("div", { class: "notice err" + (msg ? "" : " hidden") }, msg || "");
    const btn = h("button", { class: "primary big full", type: "submit" }, "Кіру");
    const form = h("form", { class: "card stack", onsubmit: async e => {
      e.preventDefault();
      btn.disabled = true; err.classList.add("hidden");
      try {
        const r = await rpc("student_login", { p_username: user.value.trim(), p_password: pass.value });
        if (r.error) throw new Error(r.error);
        me = { token: r.token, username: r.username, full_name: r.full_name, class_name: r.class_name };
        localStorage.setItem(TOKEN_KEY, r.token);
        showHome();
      } catch (ex) {
        err.textContent = errMsg(ex); err.classList.remove("hidden");
        btn.disabled = false;
      }
    } },
      h("h1", {}, "Қош келдіңіз!"),
      h("p", { class: "muted" }, "Мұғалім берген логин мен құпиясөзді енгізіңіз."),
      h("label", { class: "field" }, "Логин", user),
      h("label", { class: "field" }, "Құпиясөз", pass),
      err, btn,
      h("p", { class: "small muted", style: { margin: 0 } }, "Құпиясөзді ұмытсаңыз, мұғаліміңізге хабарласыңыз."));
    setView(h("div", { class: "narrow" }, form));
    user.focus();
  }

  async function logout() {
    const tok = me && me.token;
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    if (tok) { try { await sb.rpc("student_logout", { p_token: tok }); } catch (_) {} }
  }

  // ---------- басты бет: тесттер және менің нәтижелерім ----------
  let homeTab = "tests";
  async function showHome() {
    renderWho(); loading();
    let tests, history;
    try {
      [tests, history] = await Promise.all([
        rpc("student_tests", { p_token: me.token }),
        rpc("student_history", { p_token: me.token })
      ]);
    } catch (ex) { if (ex.message !== "NO_SESSION") showLogin(errMsg(ex)); return; }

    const fresh = tests.filter(t => !t.attempt), done = tests.filter(t => t.attempt);
    const card = t => {
      const a = t.attempt;
      return h("div", { class: "card stack" },
        h("div", { class: "row between" },
          h("span", { class: "badge " + (a ? "ok" : "") }, a ? "Тапсырылды" : "Жаңа"),
          h("span", { class: "small muted" }, t.question_count + " сұрақ")),
        h("h3", {}, t.title),
        t.description ? h("p", { class: "small muted", style: { margin: 0 } }, t.description) : null,
        a
          ? h("div", { class: "row between" },
              h("div", {}, h("b", { class: "mono" }, `${num(a.score)} / ${num(a.max_score)}`),
                h("span", { class: "small muted" }, ` · ${pct(a.score, a.max_score)}%`)),
              h("button", { class: "sm", onclick: () => showReview(a.id) }, t.show_answers ? "Дұрыс / қате" : "Нәтиже"))
          : h("button", { class: "primary full", onclick: () => startTest(t.id) }, "Бастау"));
    };

    const tabBtn = (k, label) => h("button", { class: homeTab === k ? "active" : "", onclick: () => { homeTab = k; showHome(); } }, label);
    const nav = h("nav", { class: "tabs" }, tabBtn("tests", "Тапсырмалар"), tabBtn("history", `Менің нәтижелерім (${history.length})`));

    if (homeTab === "history") {
      const avg = history.length ? Math.round(history.reduce((s, a) => s + pct(a.score, a.max_score), 0) / history.length) : 0;
      return setView(nav,
        history.length ? h("div", { class: "grid", style: { gridTemplateColumns: "repeat(2, 1fr)", marginBottom: "1rem" } },
          h("div", { class: "card" }, h("div", { class: "small muted" }, "Тапсырылған тесттер"), h("div", { class: "score-big", style: { fontSize: "1.8rem" } }, history.length)),
          h("div", { class: "card" }, h("div", { class: "small muted" }, "Орташа нәтиже"), h("div", { class: "score-big", style: { fontSize: "1.8rem" } }, avg + "%"))) : null,
        history.length ? h("div", { class: "stack" }, history.map(a => h("div", { class: "card row between" },
          h("div", {},
            h("b", {}, a.title),
            h("div", { class: "small muted" }, fmtDate(a.submitted_at), a.archived ? " · бұрынғы әрекет" : "")),
          h("div", { class: "row" },
            h("span", { class: "mono" }, h("b", {}, `${num(a.score)}/${num(a.max_score)}`), ` · ${pct(a.score, a.max_score)}%`),
            h("button", { class: "sm", onclick: () => showReview(a.id) }, "Қарау")))))
          : h("div", { class: "notice info" }, "Сіз әлі ешбір тест тапсырмадыңыз."));
    }

    setView(nav,
      h("p", { class: "muted" }, "Әр тестті бір рет тапсырасыз. Жауаптарыңыз тапсырғанға дейін осы құрылғыда сақталып тұрады. Тапсырған тесттеріңіз «Менің нәтижелерім» бөлімінде сақталады."),
      tests.length ? null : h("div", { class: "notice info" }, "Әзірге жарияланған тест жоқ."),
      fresh.length ? h("h2", {}, "Жаңа тесттер") : null,
      fresh.length ? h("div", { class: "grid" }, fresh.map(card)) : null,
      done.length ? h("h2", {}, "Тапсырылған") : null,
      done.length ? h("div", { class: "grid" }, done.map(card)) : null
    );
  }

  // ---------- тест тапсыру ----------
  async function startTest(testId) {
    loading();
    let test;
    try { test = await rpc("student_get_test", { p_token: me.token, p_test_id: testId }); }
    catch (ex) { if (ex.message !== "NO_SESSION") { toast(errMsg(ex), 4000); showHome(); } return; }

    const KEY = `chem_ans_${me.username}_${testId}`;
    let answers = {};
    try { answers = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) { answers = {}; }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch (_) {} };

    const qs = test.questions || [];
    const isAnswered = q => {
      const a = answers[q.id];
      if (q.type === "matching") return a && (q.left || []).every(L => a[L.k]);
      if (q.type === "multiple") return Array.isArray(a) && a.length > 0;
      return !!a;
    };

    const navLinks = [];
    const bar = h("div", {});
    const counter = h("span", { class: "small muted mono" });
    function refresh() {
      const n = qs.filter(isAnswered).length;
      bar.style.width = (qs.length ? (n / qs.length) * 100 : 0) + "%";
      counter.textContent = `${n}/${qs.length}`;
      qs.forEach((q, i) => navLinks[i].classList.toggle("done", isAnswered(q)));
    }

    const body = h("div", {});
    let lastCtx = null;
    qs.forEach((q, i) => {
      navLinks.push(h("a", { href: "#q" + (i + 1), onclick: e => {
        e.preventDefault(); document.getElementById("q" + (i + 1)).scrollIntoView({ behavior: "smooth" });
      } }, String(i + 1)));
      if (q.context && q.context !== lastCtx && test.contexts && test.contexts[q.context]) {
        body.appendChild(h("div", { class: "card ctx-card" },
          h("div", { class: "ctx-label" }, "Контекст — келесі сұрақтарға ортақ"), rich(test.contexts[q.context])));
      }
      lastCtx = q.context || null;
      body.appendChild(questionCard(q, i + 1));
    });

    function questionCard(q, n) {
      const card = h("div", { class: "card q-card", id: "q" + n },
        h("div", { class: "q-meta" },
          h("span", { class: "q-num" }, n + "."),
          h("span", { class: "badge gray" }, TYPE_LABEL[q.type] || ""),
          h("span", { class: "small muted" }, `${num(q.points)} ұпай`)),
        rich(q.stem, "q-stem"));

      if (q.type === "single" || q.type === "multiple") {
        const multi = q.type === "multiple";
        const opts = h("div", { class: "opts", role: multi ? "group" : "radiogroup" });
        const btns = [];
        const paint = () => {
          const cur = answers[q.id];
          btns.forEach(([k, b]) => {
            const on = multi ? (Array.isArray(cur) && cur.includes(k)) : cur === k;
            b.classList.toggle("sel", on);
            b.setAttribute("aria-checked", on ? "true" : "false");
          });
        };
        for (const o of q.options || []) {
          const b = h("button", { type: "button", class: "opt" + (multi ? " multi" : ""), role: multi ? "checkbox" : "radio",
            onclick: () => {
              if (multi) {
                const cur = new Set(Array.isArray(answers[q.id]) ? answers[q.id] : []);
                cur.has(o.k) ? cur.delete(o.k) : cur.add(o.k);
                answers[q.id] = [...cur].sort();
                if (!answers[q.id].length) delete answers[q.id];
              } else {
                answers[q.id] === o.k ? delete answers[q.id] : (answers[q.id] = o.k);
              }
              save(); paint(); refresh();
            } },
            h("span", { class: "letter" }, o.k), h("div", { class: "opt-body" }, rich(o.h)));
          btns.push([o.k, b]); opts.appendChild(b);
        }
        if (multi) card.appendChild(h("p", { class: "small muted", style: { marginTop: 0 } }, "Барлық дұрыс жауаптарды белгілеңіз."));
        card.appendChild(opts);
        paint();
      } else if (q.type === "matching") {
        const left = h("div", { class: "match-left" });
        for (const L of q.left || []) {
          const chips = [];
          const paint = () => {
            const cur = (answers[q.id] || {})[L.k];
            chips.forEach(([k, c]) => c.classList.toggle("sel", cur === k));
          };
          const chipBox = h("div", { class: "chips" });
          for (const o of q.options || []) {
            const c = h("button", { type: "button", class: "sm chip", "aria-label": `${L.k} → ${o.k}`, onclick: () => {
              const cur = Object.assign({}, answers[q.id] || {});
              cur[L.k] === o.k ? delete cur[L.k] : (cur[L.k] = o.k);
              if (Object.keys(cur).length) answers[q.id] = cur; else delete answers[q.id];
              save(); paint(); refresh();
            } }, o.k);
            chips.push([o.k, c]); chipBox.appendChild(c);
          }
          left.appendChild(h("div", { class: "match-row" },
            h("div", {}, h("b", { class: "q-num" }, L.k + ")"), rich(L.h)), chipBox));
          paint();
        }
        card.appendChild(h("p", { class: "small muted", style: { marginTop: 0 } }, "Әр нөмірге сәйкес әріпті таңдаңыз."));
        card.appendChild(left);
        card.appendChild(h("div", { class: "opts match-opts" }, (q.options || []).map(o =>
          h("div", { class: "opt" }, h("span", { class: "letter" }, o.k), h("div", { class: "opt-body" }, rich(o.h))))));
      }
      return card;
    }

    const submitBtn = h("button", { class: "primary", onclick: () => submit() }, "Тапсыру");
    async function submit() {
      const left = qs.filter(q => !isAnswered(q)).length;
      const ok = await modal(h("div", {},
        h("h3", {}, "Тестті тапсырасыз ба?"),
        left ? h("p", { class: "notice" }, `Жауап берілмеген немесе толық емес сұрақтар: ${left}.`) : null,
        h("p", {}, "Тапсырғаннан кейін жауаптарды өзгертуге болмайды.")),
        [{ label: "Қайту", value: false }, { label: "Иә, тапсыру", value: true, class: "primary" }]);
      if (!ok) return;
      submitBtn.disabled = true;
      try {
        const res = await rpc("student_submit", { p_token: me.token, p_test_id: testId, p_answers: answers });
        localStorage.removeItem(KEY);
        showResult(res);
      } catch (ex) {
        submitBtn.disabled = false;
        toast(errMsg(ex), 5000);
        if (String(ex.message || "").includes("ALREADY_SUBMITTED")) { localStorage.removeItem(KEY); showHome(); }
      }
    }

    setView(
      h("div", { class: "test-head" },
        h("button", { class: "ghost sm", onclick: async () => {
          if (await modal(h("p", {}, "Тізімге қайтасыз ба? Жауаптарыңыз осы құрылғыда сақталады, кейін жалғастыра аласыз."),
            [{ label: "Жоқ", value: false }, { label: "Иә", value: true, class: "primary" }])) showHome();
        } }, "← Тізімге"),
        h("h1", {}, test.title),
        test.description ? h("p", { class: "muted" }, test.description) : null,
        h("div", { class: "qnav", "aria-label": "Сұрақтар" }, navLinks)),
      body,
      h("div", { class: "submitbar" }, h("div", { class: "submitbar-inner" },
        counter, h("div", { class: "progress" }, bar), submitBtn))
    );
    refresh();
  }

  // ---------- нәтиже ----------
  function showResult(res) {
    const head = h("div", { class: "card score-hero" },
      h("div", { class: "muted" }, res.title || "Нәтиже"),
      h("div", { class: "score-big" }, `${num(res.score)} / ${num(res.max_score)}`),
      h("div", { class: "muted" }, `${pct(res.score, res.max_score)}% · ${fmtDate(res.submitted_at)}`));
    const back = h("button", { onclick: showHome }, "← Тесттер тізіміне");
    if (!res.show_answers || !res.questions) {
      return setView(back, h("div", { style: { height: "1rem" } }), head,
        h("p", { class: "muted", style: { textAlign: "center" } }, "Мұғалім бұл тест бойынша дұрыс жауаптарды жасырған."));
    }
    setView(back, h("div", { style: { height: "1rem" } }), head,
      h("h2", {}, "Жауаптарды талдау"),
      renderReview(res),
      h("div", { style: { marginTop: "1.2rem" } }, h("button", { onclick: showHome }, "← Тесттер тізіміне")));
  }

  async function showReview(attemptId) {
    loading();
    try { showResult(await rpc("student_review", { p_token: me.token, p_attempt_id: attemptId })); }
    catch (ex) { if (ex.message !== "NO_SESSION") { toast(errMsg(ex), 4000); showHome(); } }
  }

  // ---------- іске қосу ----------
  (async function init() {
    if (!configured || !sb) {
      setView(h("div", { class: "narrow notice err" },
        "Сайт әлі бапталмаған: assets/config.js файлына Supabase деректерін енгізіңіз."));
      return;
    }
    const tok = localStorage.getItem(TOKEN_KEY);
    if (!tok) return showLogin();
    try {
      const r = await sb.rpc("student_me", { p_token: tok });
      if (r.error) throw r.error;
      me = { token: tok, ...r.data };
      showHome();
    } catch (ex) {
      localStorage.removeItem(TOKEN_KEY);
      showLogin();
    }
  })();
})();
