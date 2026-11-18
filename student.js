/* Оқушы беті: логин + құпиясөз → тесттер → тапсыру → нәтиже, менің нәтижелерім */
(function () {
  "use strict";
  const { sb, CFG, configured, h, rich, toast, modal, errMsg, TYPE_LABEL, renderReview, fmtDate, num, pct, symbolOf, childrenMap, tintMap,
    chemifyText, chemUni, TASK_TYPES } = window.App;
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
    who.appendChild(h("div", {}, h("b", {}, me.full_name), me.class_name ? ", " + me.class_name : ""));
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

  // ---------- басты бет: бөлімдер → тақырыптар → тесттер ----------
  let homeTab = "tests";
  let curFolder = null;   // ашық бөлімнің id-і (null = барлық бөлімдер)
  let taskType = null;    // Тапсырмалар қойындысында таңдалған түр (null = түрлер тізімі)
  const plural = (n, word) => `${n} ${word}`;

  async function showHome() {
    renderWho(); loading();
    let tests, history, folders;
    try {
      [tests, history, folders] = await Promise.all([
        rpc("student_tests", { p_token: me.token }),
        rpc("student_history", { p_token: me.token }),
        rpc("student_folders", { p_token: me.token })
      ]);
    } catch (ex) { if (ex.message !== "NO_SESSION") showLogin(errMsg(ex)); return; }

    // Тесттер мен тапсырмалар бөлек көрсетіледі
    const isTasks = homeTab === "tasks";
    const unit = isTasks ? "тапсырма" : "тест";
    const allItems = tests;
    const allTasks = allItems.filter(t => t.kind === "task");
    tests = isTasks ? allTasks.filter(t => t.task_type === taskType) : allItems.filter(t => (t.kind || "test") === "test");
    folders = folders.filter(f => (f.scope || "tests") === (isTasks ? "tasks:" + taskType : "tests"));
    const byId = {}; folders.forEach(f => { byId[f.id] = f; });
    const kids = childrenMap(folders), tint = tintMap(folders);
    const testsIn = {};
    tests.forEach(t => { const k = t.folder_id && byId[t.folder_id] ? t.folder_id : "none"; (testsIn[k] = testsIn[k] || []).push(t); });
    // бір бөлімнің ішіндегі барлық тесттер (ұрпақтарымен)
    const deep = id => [...(testsIn[id] || []), ...(kids[id] || []).flatMap(c => deep(c.id))];
    if (curFolder && !byId[curFolder]) curFolder = null;

    const tab = (k, label) => h("button", { class: homeTab === k ? "active" : "", onclick: () => { if (homeTab !== k || k === "tasks") { curFolder = null; taskType = null; } homeTab = k; showHome(); } }, label);
    const seg = h("div", { class: "seg", role: "tablist" },
      tab("tests", "Тесттер"), tab("tasks", "Тапсырмалар"),
      tab("history", `Менің нәтижелерім (${history.length})`));
    const firstName = (me.full_name || "").trim().split(/\s+/)[1] || (me.full_name || "").trim().split(/\s+/)[0] || "";

    // ---- нәтижелер тарихы ----
    if (homeTab === "history") {
      const avg = history.length ? Math.round(history.reduce((s, a) => s + pct(a.score, a.max_score), 0) / history.length) : 0;
      return setView(h("div", { class: "reading" },
        h("h1", {}, "Менің нәтижелерім"), seg,
        history.length ? h("div", { class: "grid", style: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: "1.4rem" } },
          h("div", { class: "card stat" }, h("div", { class: "small muted" }, "Тапсырылған тесттер"), h("div", { class: "score-big" }, history.length)),
          h("div", { class: "card stat" }, h("div", { class: "small muted" }, "Орташа нәтиже"), h("div", { class: "score-big" }, avg + "%"))) : null,
        history.length ? h("div", { class: "rows" }, history.map(a => h("div", { class: "test-row" },
          h("div", { class: "t-main" },
            h("div", { class: "t-title" }, a.title),
            h("div", { class: "t-sub" }, fmtDate(a.submitted_at) + (a.archived ? ", бұрынғы әрекет" : ""))),
          h("div", { class: "t-score" }, `${num(a.score)}/${num(a.max_score)}`, h("small", {}, pct(a.score, a.max_score) + "%")),
          h("button", { class: "sm", onclick: () => showReview(a.id) }, "Талдау"))))
          : h("div", { class: "card empty" }, "Әзірге нәтиже жоқ. «Тапсырмалар» бөлімінен тест таңдап, тапсырып көріңіз.")));
    }

    const testRow = t => {
      const a = t.attempt;
      const info = [t.kind === "task"
        ? ((TASK_TYPES[t.task_type] || {}).title || "Тапсырма") + (t.task_type === "whoami" ? "" : `, ${t.question_count} реакция`)
        : plural(t.question_count, "сұрақ")];
      if (t.unlimited) info.push(t.attempts_count > 1 ? `${t.attempts_count} рет тапсырылды, соңғы нәтиже` : "қайта тапсыруға болады");
      if (t.description) info.push(t.description);
      return h("div", { class: "test-row" },
        h("div", { class: "t-main" },
          h("div", { class: "t-title" }, t.title),
          h("div", { class: "t-sub" }, info.join(". "))),
        a ? h("div", { class: "t-score" }, `${num(a.score)}/${num(a.max_score)}`, h("small", {}, pct(a.score, a.max_score) + "%")) : null,
        a ? h("button", { class: "sm", onclick: () => showReview(a.id) }, t.show_answers ? "Талдау" : "Нәтиже") : null,
        !a ? h("button", { class: "sm primary", onclick: () => startTest(t.id) }, "Бастау")
          : t.unlimited ? h("button", { class: "sm primary", onclick: () => startTest(t.id) }, "Қайта тапсыру") : null);
    };
    const rows = list => h("div", { class: "rows" }, list.map(testRow));
    const doneCount = list => list.filter(t => t.attempt).length;

    // ---- бір бөлімнің ішкі беті ----
    if (curFolder) {
      const f = byId[curFolder];
      const path = []; for (let x = f; x; x = x.parent_id ? byId[x.parent_id] : null) path.unshift(x);
      const all = deep(f.id);
      const crumbs = h("nav", { class: "crumbs", "aria-label": "Жол" },
        isTasks ? [h("button", { onclick: () => { curFolder = null; taskType = null; showHome(); } }, "Тапсырма түрлері"), h("span", { class: "sep" }, "/")] : null,
        h("button", { onclick: () => { curFolder = null; showHome(); } }, isTasks ? TASK_TYPES[taskType].title : "Барлық бөлімдер"),
        path.slice(0, -1).map(p => [h("span", { class: "sep" }, "/"), h("button", { onclick: () => { curFolder = p.id; showHome(); } }, p.title)]));

      const blocks = [];
      if ((testsIn[f.id] || []).length) blocks.push(rows(testsIn[f.id]));
      (kids[f.id] || []).filter(t => deep(t.id).length).forEach(topic => {
        const sub = [];
        if ((testsIn[topic.id] || []).length) sub.push(rows(testsIn[topic.id]));
        (kids[topic.id] || []).filter(st => deep(st.id).length).forEach(st => {
          sub.push(h("div", { class: "subtopic" }, h("h3", {}, st.title), rows(deep(st.id))));
        });
        blocks.push(h("section", { class: "topic" },
          h("h2", {}, topic.title),
          h("p", { class: "small muted", style: { margin: "0 0 .7rem" } }, `${doneCount(deep(topic.id))} / ${deep(topic.id).length} ${unit} орындалды`),
          sub));
      });
      return setView(h("div", { class: "reading" },
        crumbs,
        h("div", { class: "section-head" },
          h("div", { class: "sym-chip " + (tint[f.id] || "t0") }, symbolOf(path[0] === f ? f : f)),
          h("div", {}, h("h1", {}, f.title),
            h("div", { class: "muted" }, `${doneCount(all)} / ${all.length} ${unit} орындалды`))),
        all.length ? blocks : h("div", { class: "card empty" }, `Бұл бөлімде әзірге ${unit} жоқ.`)));
    }

    // ---- тапсырмалар: алдымен түрін таңдау ----
    if (isTasks && !taskType) {
      return setView(
        h("h1", {}, firstName ? `Сәлем, ${firstName}!` : "Тапсырмалар"),
        h("p", { class: "muted", style: { margin: "0 0 .4rem" } }, "Тапсырма түрін таңдаңыз."),
        seg,
        h("div", { class: "type-grid" }, Object.entries(TASK_TYPES).map(([k, v]) => {
          const list = allTasks.filter(t => t.task_type === k);
          return h("button", { class: "type-card big", disabled: !list.length, onclick: () => { taskType = k; curFolder = null; showHome(); } },
            h("b", {}, v.title),
            h("span", { class: "small muted" }, v.hint),
            h("span", { class: "type-meta" }, list.length ? `${doneCount(list)} / ${list.length} тапсырма орындалды` : "Әзірге тапсырма жоқ"));
        })));
    }

    // ---- барлық бөлімдер ----
    const roots = (kids.root || []).filter(f => deep(f.id).length);
    const loose = testsIn.none || [];
    setView(
      isTasks ? h("nav", { class: "crumbs", "aria-label": "Жол" },
        h("button", { onclick: () => { taskType = null; showHome(); } }, "Тапсырма түрлері"),
        h("span", { class: "sep" }, "/"), h("span", {}, TASK_TYPES[taskType].title)) : null,
      h("h1", {}, isTasks ? TASK_TYPES[taskType].title : firstName ? `Сәлем, ${firstName}!` : "Тапсырмалар"),
      h("p", { class: "muted", style: { margin: "0 0 .4rem" } }, isTasks
        ? TASK_TYPES[taskType].hint + " Бөлімді таңдап, орындаңыз."
        : "Бөлімді таңдап, тест тапсырыңыз. Жауаптарыңыз тапсырғанға дейін осы құрылғыда сақталады."),
      seg,
      !tests.length ? h("div", { class: "card empty" }, isTasks ? "Мұғалім әлі тапсырма жарияламаған." : "Мұғалім әлі тест жарияламаған.") : null,
      roots.length ? h("div", { class: "tiles" }, roots.map((f, i) => {
        const all = deep(f.id);
        return h("button", { class: "tile " + (tint[f.id] || "t0"), onclick: () => { curFolder = f.id; showHome(); } },
          h("span", { class: "tile-n" }, (kids.root || []).indexOf(f) + 1),
          h("span", { class: "tile-sym" }, symbolOf(f)),
          h("span", { class: "tile-name" }, f.title),
          h("span", { class: "tile-meta" }, `${doneCount(all)} / ${all.length} ${unit}`));
      })) : null,
      loose.length ? h("h2", {}, roots.length ? (isTasks ? "Басқа тапсырмалар" : "Басқа тесттер") : (isTasks ? "Тапсырмалар" : "Тесттер")) : null,
      loose.length ? h("div", { class: "reading" }, rows(loose)) : null
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
      if (q.type === "matching" || q.type === "whoami") return a && (q.left || []).every(L => a[L.k]);
      if (q.type === "balance") return Array.isArray(a) && a.some(x => String(x || "").trim());
      if (q.type === "complete") return typeof a === "string" && a.trim().length > 0;
      if (q.type === "multiple") return Array.isArray(a) && a.length > 0;
      return !!a;
    };

    const navLinks = [];
    const bar = h("div", {});
    const counter = h("span", { class: "small muted num" });
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
          h("div", { class: "ctx-label" }, "Контекст: келесі сұрақтарға ортақ мәтін"), rich(test.contexts[q.context])));
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
      } else if (q.type === "whoami") {
        const list = h("div", { class: "match-left" });
        for (const L of q.left || []) {
          const sel = h("select", { class: "who-sel", onchange: () => {
            const cur = Object.assign({}, answers[q.id] || {});
            if (sel.value) cur[L.k] = sel.value; else delete cur[L.k];
            if (Object.keys(cur).length) answers[q.id] = cur; else delete answers[q.id];
            save(); refresh();
          } }, h("option", { value: "" }, "Формуланы таңда"),
            (q.options || []).map(o => h("option", { value: o.k, selected: (answers[q.id] || {})[L.k] === o.k }, chemUni(o.h))));
          list.appendChild(h("div", { class: "match-row who-row" }, h("div", {}, rich(L.h)), sel));
        }
        card.appendChild(list);
      } else if (q.type === "balance") {
        const cur = Array.isArray(answers[q.id]) ? answers[q.id].slice() : (q.species || []).map(() => "");
        const line = h("div", { class: "eq-line eq-input" });
        (q.species || []).forEach((sp, i) => {
          if (i > 0) line.appendChild(h("span", { class: "eq-op" }, q.species[i - 1].side !== sp.side ? "→" : "+"));
          const inp = h("input", { type: "text", inputmode: "numeric", maxlength: 2, class: "coef", value: cur[i] || "", "aria-label": "коэффициент", oninput: () => {
            inp.value = inp.value.replace(/\D/g, "");
            cur[i] = inp.value; answers[q.id] = cur.slice();
            if (!cur.some(x => x)) delete answers[q.id];
            save(); refresh();
          } });
          line.appendChild(h("span", { class: "eq-term" }, inp, h("span", { html: chemifyText(sp.f) })));
        });
        card.appendChild(line);
      } else if (q.type === "complete") {
        const prev = h("div", { class: "small muted eq-preview" });
        const paint = () => { prev.innerHTML = inp.value.trim() ? chemifyText(q.start || "") + " " + chemifyText(window.App.latinize(inp.value)) : ""; };
        const inp = h("input", { type: "text", class: "complete-in", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
          placeholder: "мыс.: ZnCl2 + H2", value: answers[q.id] || "", oninput: () => {
            if (inp.value.trim()) answers[q.id] = inp.value; else delete answers[q.id];
            save(); refresh(); paint();
          } });
        card.appendChild(h("div", { class: "eq-line eq-complete" }, h("span", { html: chemifyText(q.start || "") }), inp));
        card.appendChild(prev); paint();
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

    setView(h("div", { class: "reading" },
      h("div", { class: "test-head" },
        h("button", { class: "ghost sm", onclick: async () => {
          if (await modal(h("p", {}, "Тізімге қайтасыз ба? Жауаптарыңыз осы құрылғыда сақталады, кейін жалғастыра аласыз."),
            [{ label: "Жоқ", value: false }, { label: "Иә", value: true, class: "primary" }])) showHome();
        } }, "Артқа"),
        h("h1", {}, test.title),
        test.kind === "task" && TASK_TYPES[test.task_type] ? h("p", { class: "notice info" }, TASK_TYPES[test.task_type].hint) : null,
        test.description ? h("p", { class: "muted" }, test.description) : null,
        h("div", { class: "qnav", "aria-label": "Сұрақтар" }, navLinks)),
      body),
      h("div", { class: "submitbar" }, h("div", { class: "submitbar-inner" },
        counter, h("div", { class: "progress" }, bar), submitBtn))
    );
    refresh();
  }

  // ---------- нәтиже ----------
  function showResult(res) {
    const det = res.details || [];
    const full = det.filter(d => Number(d.earned) >= Number(d.points)).length;
    const part = det.filter(d => Number(d.earned) > 0 && Number(d.earned) < Number(d.points)).length;
    const zero = det.length - full - part;
    const head = h("div", { class: "card score-hero" },
      h("div", { class: "score-big" }, num(res.score), h("span", { class: "of" }, " / " + num(res.max_score))),
      h("div", {},
        h("div", { class: "score-pct" }, pct(res.score, res.max_score) + "%"),
        h("div", { class: "muted small" }, fmtDate(res.submitted_at) + (res.archived ? ", бұрынғы әрекет" : ""))),
      det.length ? h("div", { class: "row", style: { marginLeft: "auto" } },
        h("span", { class: "badge ok" }, `Дұрыс: ${full}`),
        part ? h("span", { class: "badge warn" }, `Жартылай: ${part}`) : null,
        h("span", { class: "badge bad" }, `Қате: ${zero}`)) : null);
    const back = () => h("button", { class: "ghost sm", onclick: showHome }, "Тапсырмаларға оралу");
    const again = () => res.can_retake ? h("button", { class: "primary sm", onclick: () => startTest(res.test_id) }, "Қайта тапсыру") : null;
    const top = h("div", { class: "test-head" }, h("div", { class: "row between" }, back(), again()), h("h1", { style: { marginTop: ".6rem" } }, res.title || "Нәтиже"));
    if (!res.show_answers || !res.questions) {
      return setView(h("div", { class: "reading" }, top, head,
        h("p", { class: "muted" }, "Мұғалім бұл тест бойынша дұрыс жауаптарды жасырған."),
        h("div", { class: "row" }, again())));
    }
    setView(h("div", { class: "reading" }, top, head,
      h("h2", {}, "Әр сұрақ бойынша"),
      renderReview(res),
      h("div", { class: "row", style: { marginTop: "1.4rem" } }, back(), again())));
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
        "Сайт әлі бапталмаған: config.js файлына Supabase деректерін енгізіңіз."));
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
