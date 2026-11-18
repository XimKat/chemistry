/* XimKAT Chemistry — оқушы беті.
   Басты бет · Тесттер · Тапсырмалар · Нәтижелер · Қателерім · Профиль,
   тест тапсыру, нәтиже және апелляция. */
(function () {
  "use strict";
  const { sb, configured, h, rich, toast, modal, errMsg, TYPE_LABEL, renderReview, fmtDate, num, pct, symbolOf, childrenMap, tintMap,
    chemifyText, chemUni, TASK_TYPES } = window.App;
  const app = document.getElementById("app");
  const topEl = document.getElementById("top");
  const tabbar = document.getElementById("tabbar");
  const TOKEN_KEY = "chem_student_token";
  let me = null; // {token, username, full_name, class_name, avatar}
  let D = { tests: [], history: [], folders: [], mistakes: [], notifs: [] };

  // ---------- суреттер мен белгішелер ----------
  const AVATARS = [
    { src: "img/cat-head.png", bg: "#E7F0FF" }, { src: "img/av-1.svg", bg: "#E6F7EC" },
    { src: "img/av-2.svg", bg: "#FFF2DD" }, { src: "img/av-3.svg", bg: "#F0EBFF" },
    { src: "img/av-4.svg", bg: "#FFE8EE" }, { src: "img/av-5.svg", bg: "#E3F6F8" },
    { src: "img/av-6.svg", bg: "#FFF7D6" }, { src: "img/av-7.svg", bg: "#EAF0F6" }
  ];
  const P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    tests: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 12l2 2 4-4"/>',
    tasks: '<path d="M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 0 0-4z"/>',
    results: '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
    mistakes: '<path d="M12 3l9 4v5c0 5-4 8-9 9-5-1-9-4-9-9V7z"/><path d="M12 8v5"/><path d="M12 16.5v.5"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
    atom: '<ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    repeat: '<path d="M4 12a8 8 0 0 1 14-5l2 2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M4 20v-5h5"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    msg: '<path d="M4 5h16v11H9l-5 4z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'
  };
  function ic(name, size, sw) {
    const t = document.createElement("template");
    t.innerHTML = `<svg width="${size || 20}" height="${size || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
    return t.content.firstChild;
  }
  const SWASH = () => h("span", { class: "swash", "aria-hidden": "true", html:
    '<svg width="200" height="26" viewBox="0 0 200 26"><path d="M6 20 C60 8 120 6 194 5" stroke="#F5B60B" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M40 23 C90 15 140 13 178 13" stroke="#F5B60B" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/></svg>' });
  function avatarEl(i, cls) {
    const a = AVATARS[i] || AVATARS[0];
    return h("span", { class: "av " + (cls || ""), style: { background: a.bg } }, h("img", { src: a.src, alt: "" }));
  }

  // ---------- көмекші ----------
  function setView(...nodes) {
    app.className = "wrap";
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
  const firstName = () => {
    const w = (me && me.full_name || "").trim().split(/\s+/);
    return w[1] || w[0] || "";
  };
  const dayDiff = d => {
    const a = new Date(d); a.setHours(0, 0, 0, 0);
    const b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
  };
  function relTime(d) {
    const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 2) return "жаңа ғана";
    if (mins < 60) return `${mins} мин бұрын`;
    if (mins < 60 * 24 && dayDiff(d) === 0) return `${Math.round(mins / 60)} сағат бұрын`;
    const dd = dayDiff(d);
    if (dd === 1) return "кеше";
    if (dd < 7) return `${dd} күн бұрын`;
    return fmtDate(d).slice(0, 10);
  }
  const savedKey = id => `chem_ans_${me.username}_${id}`;
  const hasSaved = id => { try { const v = JSON.parse(localStorage.getItem(savedKey(id)) || "{}"); return v && Object.keys(v).length > 0; } catch (_) { return false; } };
  const testById = id => D.tests.find(t => t.id === id);
  const kindOf = id => { const t = testById(id); return t ? (t.kind || "test") : "test"; };
  const active = () => D.history.filter(a => !a.archived);
  const unreadCount = () => D.notifs.filter(n => n.unread).length;

  // ---------- маршрут ----------
  const NAV = [
    ["home", "Басты бет", "Басты"], ["tests", "Тесттер", "Тесттер"], ["tasks", "Тапсырмалар", "Тапсырма"],
    ["results", "Нәтижелер", "Нәтиже"], ["mistakes", "Қателерім", "Қателер"], ["profile", "Профиль", "Профиль"]
  ];
  let curPage = "home";
  let lastHash = "#/home";
  function go(path) {
    const hs = "#/" + path;
    if (location.hash !== hs) location.hash = hs; else route();
  }
  window.addEventListener("hashchange", () => { if (me) route(); });

  async function loadAll() {
    const [tests, history, folders, mistakes, notifs] = await Promise.all([
      rpc("student_tests", { p_token: me.token }),
      rpc("student_history", { p_token: me.token }),
      rpc("student_folders", { p_token: me.token }),
      rpc("student_mistakes", { p_token: me.token }).catch(() => []),
      rpc("student_notifications", { p_token: me.token }).catch(() => [])
    ]);
    D = { tests: tests || [], history: history || [], folders: folders || [], mistakes: mistakes || [], notifs: notifs || [] };
  }

  async function route() {
    if (!me) return;
    const parts = (location.hash.replace(/^#\/?/, "") || "home").split("/").map(decodeURIComponent);
    const page = NAV.some(n => n[0] === parts[0]) ? parts[0] : "home";
    curPage = page; lastHash = location.hash || "#/home";
    document.body.classList.remove("taking", "login-pg");
    renderTop();
    loading();
    try { await loadAll(); }
    catch (ex) {
      if (ex.message !== "NO_SESSION") setView(h("div", { class: "narrow notice err" }, errMsg(ex)));
      return;
    }
    renderTop();
    const views = { home: viewHome, tests: viewTests, tasks: viewTasks, results: viewResults, mistakes: viewMistakes, profile: viewProfile };
    views[page](parts.slice(1));
  }

  // ---------- жоғарғы мәзір ----------
  let notifPanel = null;
  function renderTop() {
    closeNotif();
    topEl.innerHTML = ""; tabbar.innerHTML = "";
    if (!me) return;
    const mc = D.mistakes.length;
    const link = (k, label, short, mobile) => h("a", { href: "#/" + k, class: curPage === k ? "on" : "", "aria-current": curPage === k ? "page" : null, title: label },
      ic(k, mobile ? 24 : 19), h("span", { class: "lbl" }, mobile ? short : label),
      k === "mistakes" && mc ? h("span", { class: "cnt" }, mc > 99 ? "99+" : mc) : null);
    const un = unreadCount();
    const bell = h("button", { class: "xk-bell", "aria-label": un ? `Хабарламалар, ${un} жаңа` : "Хабарламалар", "aria-expanded": "false",
      onclick: e => { e.stopPropagation(); notifPanel ? closeNotif() : openNotif(right, bell); } },
      ic("bell", 24), un ? h("span", { class: "xk-badge" }, un > 9 ? "9+" : un) : null);
    const right = h("div", { class: "xk-right" }, bell,
      h("a", { class: "xk-user", href: "#/profile", "aria-label": "Профиль" }, avatarEl(me.avatar || 0),
        h("span", { class: "nm" }, firstName()), h("span", { class: "chev" }, ic("down", 18))));
    topEl.appendChild(h("div", { class: "xk-top-in" },
      h("a", { class: "xk-brand", href: "#/home", "aria-label": "XimKAT Chemistry — басты бет" },
        h("span", { class: "xk-brand-cat" }, h("img", { src: "img/cat-head.png", alt: "" })),
        h("img", { class: "xk-brand-word", src: "img/wordmark.png", alt: "XimKAT Chemistry" })),
      h("span", { class: "xk-sep" }),
      h("nav", { class: "xk-nav", "aria-label": "Негізгі мәзір" }, NAV.map(n => link(n[0], n[1], n[2]))),
      right));
    NAV.forEach(n => tabbar.appendChild(link(n[0], n[1], n[2], true)));
  }

  const N_KIND = {
    new_test: { icon: "tests", bg: "#E7F0FF", fg: "#1F5FD8" },
    retake: { icon: "repeat", bg: "#E2F6E9", fg: "#15924A" },
    message: { icon: "msg", bg: "#FFF1DA", fg: "#B45309" }
  };
  function openNotif(wrap, bell) {
    const items = D.notifs;
    const list = h("div", { class: "xk-notif-list" }, items.length ? items.map(n => {
      const k = N_KIND[n.kind] || N_KIND.message;
      const title = n.kind === "message" ? "Мұғалімнен хабарлама" : n.title;
      return h("button", { class: "n-item" + (n.unread ? " unread" : ""), onclick: () => {
        closeNotif();
        if (!n.test_id) return;
        const t = testById(n.test_id);
        if (!t) return;
        if (t.kind === "task") go("tasks/" + encodeURIComponent(t.task_type || "") + (t.folder_id ? "/" + t.folder_id : ""));
        else go("tests" + (t.folder_id ? "/" + t.folder_id : ""));
      } },
        h("span", { class: "n-ico", style: { background: k.bg, color: k.fg } }, ic(k.icon, 20)),
        h("span", { class: "n-body" },
          h("span", { class: "n-title", style: { display: "block" } }, title),
          h("span", { class: "n-text", style: { display: "block" } }, n.body),
          h("span", { class: "n-when", style: { display: "block" } }, relTime(n.created_at))),
        n.unread ? h("span", { class: "n-dot", "aria-label": "жаңа" }) : null);
    }) : h("div", { class: "n-empty" }, "Әзірге хабарлама жоқ."));
    notifPanel = h("div", { class: "xk-notif", role: "dialog", "aria-label": "Хабарламалар" },
      h("div", { class: "xk-notif-head" }, h("b", {}, "Хабарламалар"),
        items.length ? h("span", { class: "small muted" }, `${items.length} хабарлама`) : null),
      list);
    wrap.appendChild(notifPanel);
    bell.setAttribute("aria-expanded", "true");
    document.addEventListener("click", outside, true);
    document.addEventListener("keydown", escClose);
    if (unreadCount()) {
      rpc("student_notifications_seen", { p_token: me.token }).then(() => {
        D.notifs.forEach(n => { n.unread = false; });
        const b = bell.querySelector(".xk-badge"); if (b) b.remove();
      }).catch(() => {});
    }
  }
  function outside(e) { if (notifPanel && !notifPanel.contains(e.target) && !e.target.closest(".xk-bell")) closeNotif(); }
  function escClose(e) { if (e.key === "Escape") closeNotif(); }
  function closeNotif() {
    if (notifPanel) { notifPanel.remove(); notifPanel = null; }
    document.removeEventListener("click", outside, true);
    document.removeEventListener("keydown", escClose);
    const b = topEl.querySelector(".xk-bell"); if (b) b.setAttribute("aria-expanded", "false");
  }

  // ---------- кіру ----------
  function showLogin(msg) {
    me = null; renderTop();
    document.body.classList.add("login-pg");
    document.body.classList.remove("taking");
    const user = h("input", { type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: "false", required: true, placeholder: "мысалы, aidana11a" });
    const pass = h("input", { type: "password", autocomplete: "current-password", required: true });
    const err = h("div", { class: "notice err" + (msg ? "" : " hidden") }, msg || "");
    const btn = h("button", { class: "btn-pill blue", type: "submit", style: { justifyContent: "center" } }, "Кіру", ic("arrow", 20));
    const form = h("form", { onsubmit: async e => {
      e.preventDefault();
      btn.disabled = true; err.classList.add("hidden");
      try {
        const r = await rpc("student_login", { p_username: user.value.trim(), p_password: pass.value });
        if (r.error) throw new Error(r.error);
        localStorage.setItem(TOKEN_KEY, r.token);
        me = { token: r.token, username: r.username, full_name: r.full_name, class_name: r.class_name, avatar: 0 };
        try { Object.assign(me, await rpc("student_me", { p_token: r.token })); } catch (_) {}
        document.body.classList.remove("login-pg");
        if (location.hash && location.hash !== "#/home") go("home"); else route();
      } catch (ex) {
        if (ex.message === "NO_SESSION") return;
        err.textContent = errMsg(ex); err.classList.remove("hidden");
        btn.disabled = false;
      }
    } },
      h("img", { class: "wm", src: "img/wordmark.png", alt: "XimKAT Chemistry" }),
      h("div", {}, h("h1", {}, "Кіру"), h("p", { class: "muted", style: { margin: ".4rem 0 0" } }, "Мұғалім берген логин мен құпиясөзді енгіз.")),
      h("label", { class: "field" }, "Логин", user),
      h("label", { class: "field" }, "Құпиясөз", pass),
      err, btn,
      h("p", { class: "small muted", style: { margin: 0, textAlign: "center" } }, "Құпиясөзді ұмытсаң, мұғаліміңе айт."),
      h("p", { class: "slg" }, "XimKAT — сенің жеңісіңе бірге!"));
    setView(h("div", { class: "login" },
      h("div", { class: "login-art" },
        h("img", { src: "img/hero-cat.jpg", alt: "Көзілдірікті XimKAT мысығы колба мен пробиркамен" }),
        h("p", { class: "big" }, "Ынта. Еңбек. Нәтиже."),
        h("p", { class: "sub" }, "Химияны қызықты үйреніп, ҰБТ-ға сенімді дайындал!")),
      h("div", { class: "login-form" }, form)));
    app.className = "wrap";
    user.focus();
  }

  async function logout() {
    const tok = me && me.token;
    localStorage.removeItem(TOKEN_KEY);
    D = { tests: [], history: [], folders: [], mistakes: [], notifs: [] };
    showLogin();
    if (tok) { try { await sb.rpc("student_logout", { p_token: tok }); } catch (_) {} }
  }

  // ---------- басты бет ----------
  function stats() {
    const act = active();
    const testsDone = act.filter(a => kindOf(a.test_id) !== "task").length;
    const tasksDone = act.filter(a => kindOf(a.test_id) === "task").length;
    const avg = act.length ? Math.round(act.reduce((s, a) => s + pct(a.score, a.max_score), 0) / act.length) : 0;
    const best = act.length ? Math.max(...act.map(a => pct(a.score, a.max_score))) : 0;
    const last = D.history.length ? D.history.reduce((m, a) => (a.submitted_at > m ? a.submitted_at : m), D.history[0].submitted_at) : null;
    let lastTxt = "—";
    if (last) { const dd = dayDiff(last); lastTxt = dd === 0 ? "Бүгін" : dd === 1 ? "Кеше" : `${dd} күн`; }
    return { testsDone, tasksDone, avg, best, lastTxt, hasAny: act.length > 0 };
  }
  const statCard = (cls, icon, value, label, href) => h("a", { class: "stat2 " + cls, href },
    h("span", { class: "si" }, ic(icon, 38, 2.2)),
    h("span", { class: "sv" }, h("span", { class: "sn" }, value), h("span", { class: "sl" }, label)),
    h("span", { class: "sc" }, ic("chev", 16, 2.6)));

  function viewHome() {
    const s = stats();
    const nTests = D.tests.filter(t => (t.kind || "test") === "test").length;
    const nTasks = D.tests.filter(t => t.kind === "task").length;
    const typeCard = (cls, iconNode, title, text, href) => h("a", { class: "type2 " + cls, href },
      iconNode, h("span", { class: "tt" }, title),
      h("span", { class: "tb" }, h("span", { class: "td" }, text),
        h("span", { class: "ico-circ", style: { background: "#fff", border: "1px solid var(--rule)" } }, ic("chev", 16, 2.6))));
    const round = (cls, name) => h("span", { class: "ti-round " + cls }, ic(name, 30, 2.4));
    const mol = h("span", { class: "hero-mol", "aria-hidden": "true", html:
      '<svg width="140" height="120" viewBox="0 0 140 120" fill="none" stroke="#9CC1F5" stroke-width="2.5"><path d="M40 20 L65 6 L90 20 L90 48 L65 62 L40 48 Z"/><path d="M90 48 L115 62 L115 90"/><path d="M40 48 L18 62"/><circle cx="115" cy="92" r="5" fill="#C8DCF8"/><circle cx="16" cy="63" r="5" fill="#C8DCF8"/><circle cx="65" cy="6" r="4" fill="#C8DCF8"/></svg>' });

    setView(
      h("section", { class: "hero" }, mol,
        h("div", { class: "hero-in" },
          h("div", { class: "hero-text" },
            h("h1", {}, "XimKAT Chemistry", h("br"), h("span", {}, "Ынта. Еңбек. Нәтиже.")),
            h("div", { class: "hero-sub-wrap" },
              h("p", { class: "hero-sub" }, firstName() ? `Сәлем, ${firstName()}! ` : "", "Химияны қызықты үйреніп,", h("br"), "ҰБТ-ға сенімді дайындал!"),
              SWASH()),
            h("div", { class: "hero-btns" },
              h("a", { class: "btn-pill blue", href: "#/tests" }, ic("play", 20), "Тест тапсыруды бастау", ic("arrow", 20)),
              h("a", { class: "btn-play", href: "#/tasks" }, h("span", { class: "o" }, h("span", { class: "i" }, ic("play", 14))), "Тапсырмаларды көру"))),
          h("div", { class: "hero-art" }, h("img", { src: "img/hero-cat.jpg", alt: "Көзілдірікті XimKAT мысығы колба мен пробиркамен" })))),
      h("div", { class: "home-in" },
        h("section", { class: "stats", "aria-label": "Менің көрсеткіштерім" },
          statCard("c-blue", "cap", String(s.testsDone), "Тапсырылған тест", "#/results"),
          statCard("c-green", "target", s.hasAny ? s.avg + "%" : "—", "Орташа нәтиже", "#/results"),
          statCard("c-amber", "mistakes", String(D.mistakes.length), "Қайталайтын қате", "#/mistakes"),
          statCard("c-violet", "calendar", s.lastTxt, "Соңғы белсенділік", "#/results")),
        h("section", { class: "home-row" },
          h("div", { class: "home-types" },
            h("div", { class: "h2u" }, h("h2", {}, "Бөлімдер"), h("a", { href: "#/tests" }, "Барлық тесттер", ic("arrow", 16))),
            h("div", { class: "types" },
              typeCard("c-blue", h("span", { style: { color: "var(--accent)", display: "flex" } }, ic("atom", 62, 1.8)),
                "Тақырыптық тесттер", nTests ? `${nTests} тест · белгілі бір тақырыпты бекіту` : "Белгілі бір тақырыпты бекіту", "#/tests"),
              typeCard("c-violet", round("ti-violet", "tasks"), "Тапсырмалар",
                nTasks ? `${nTasks} тапсырма · Мен кіммін?, Теңестір, Мені аяқта` : "Мен кіммін?, Теңестір, Мені аяқта", "#/tasks"),
              typeCard("c-green", round("ti-green", "check"), "Қателермен жұмыс",
                D.mistakes.length ? `${D.mistakes.length} сұрақ қайталауды күтуде` : "Қателіктерді қайталап, білімді нығайту", "#/mistakes"))),
          h("div", { class: "banner" },
            h("img", { src: "img/cheer-cat.jpg", alt: "" }),
            h("div", { class: "banner-in" },
              h("div", {}, h("p", {}, "Жақсы нәтиже — сенің қолыңда!"), SWASH()),
              h("a", { class: "btn-pill white", href: "#/tests", style: { alignSelf: "flex-start", minHeight: "50px" } }, "Бастау", ic("arrow", 20))))),
        h("footer", { class: "home-foot" },
          h("div", { class: "feats" },
            h("span", {}, h("span", { style: { color: "var(--accent)", display: "flex", padding: 0 } }, ic("bolt", 22)), "Жылдам тестілеу"),
            h("span", {}, h("span", { style: { color: "var(--accent)", display: "flex", padding: 0 } }, ic("results", 22)), "Толық статистика"),
            h("span", {}, h("span", { style: { color: "#16A34A", display: "flex", padding: 0 } }, ic("shield", 22)), "Қауіпсіз платформа"),
            h("span", {}, h("span", { style: { color: "#E5484D", display: "flex", padding: 0 } }, ic("heart", 22)), "Жақсы көңіл-күй")),
          h("div", { class: "slogan" }, h("p", {}, "XimKAT — сенің жеңісіңе бірге!"), SWASH()))));
    app.className = "wrap home";
  }

  // ---------- тест/тапсырма жолы ----------
  function testRow(t) {
    const a = t.attempt;
    const isTask = t.kind === "task";
    const info = [isTask
      ? ((TASK_TYPES[t.task_type] || {}).title || "Тапсырма") + (t.task_type === "whoami" ? "" : `, ${t.question_count} реакция`)
      : `${t.question_count} сұрақ`];
    info.push(t.unlimited ? "шексіз қайталауға болады" : "бір рет тапсырылады");
    if (t.description) info.push(t.description);
    let chip = null, btns = [];
    if (a) {
      const p = pct(a.score, a.max_score);
      chip = h("span", { class: "chip2 " + (p >= 80 ? "ok" : p >= 60 ? "" : "warn") }, ic("checkc", 15), `${num(a.score)}/${num(a.max_score)} · ${p}%`);
      btns.push(h("button", { class: "sm", onclick: () => showReview(a.id) }, t.show_answers ? "Талдау" : "Нәтиже"));
      if (t.unlimited) btns.push(h("button", { class: "sm primary", onclick: () => startTest(t.id) }, "Қайта тапсыру"));
    } else if (hasSaved(t.id)) {
      chip = h("span", { class: "chip2 violet" }, ic("clock", 15), "Басталған");
      btns.push(h("button", { class: "sm primary", onclick: () => startTest(t.id) }, "Жалғастыру"));
    } else if (t.attempts_count > 0) {
      chip = h("span", { class: "chip2 warn" }, ic("repeat", 15), "Қайта ашылды");
      btns.push(h("button", { class: "sm primary", onclick: () => startTest(t.id) }, "Қайта тапсыру"));
    } else {
      btns.push(h("button", { class: "sm primary", onclick: () => startTest(t.id) }, "Бастау"));
    }
    return h("div", { class: "test-row" },
      h("span", { class: "tr-ico", style: isTask ? { background: "var(--violet-soft)", color: "var(--violet)" } : null }, ic(isTask ? "tasks" : "tests", 22)),
      h("div", { class: "t-main" }, h("div", { class: "t-title" }, t.title), h("div", { class: "t-sub" }, info.join(" · "))),
      h("div", { class: "tr-act" }, chip, btns));
  }
  const rows = list => h("div", { class: "rows" }, list.map(testRow));

  // Бөлімдер ағашын көрсету (тесттер де, тапсырмалар да осымен)
  function browse(opt) {
    const { items, scope, unit, base, folderId, head, rootCrumbs } = opt;
    const folders = D.folders.filter(f => (f.scope || "tests") === scope);
    const byId = {}; folders.forEach(f => { byId[f.id] = f; });
    const kids = childrenMap(folders), tint = tintMap(folders);
    const testsIn = {};
    items.forEach(t => { const k = t.folder_id && byId[t.folder_id] ? t.folder_id : "none"; (testsIn[k] = testsIn[k] || []).push(t); });
    const deep = id => [...(testsIn[id] || []), ...(kids[id] || []).flatMap(c => deep(c.id))];
    const doneCount = list => list.filter(t => t.attempt).length;

    if (folderId && byId[folderId]) {
      const f = byId[folderId];
      const path = []; for (let x = f; x; x = x.parent_id ? byId[x.parent_id] : null) path.unshift(x);
      const all = deep(f.id);
      const crumbs = h("nav", { class: "crumbs", "aria-label": "Жол" },
        rootCrumbs, h("button", { onclick: () => go(base) }, opt.rootLabel),
        path.slice(0, -1).map(p => [h("span", { class: "sep" }, "/"), h("button", { onclick: () => go(base + "/" + p.id) }, p.title)]),
        h("span", { class: "sep" }, "/"), h("span", {}, f.title));
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
      const p = all.length ? Math.round(doneCount(all) / all.length * 100) : 0;
      return [crumbs,
        h("div", { class: "section-head" },
          h("div", { class: "sec-sym " + (tint[f.id] || "t0"), style: { width: "64px", height: "64px", fontSize: "1.6rem" } }, symbolOf(path[0])),
          h("div", { style: { flex: 1, minWidth: 0 } }, h("h1", {}, f.title),
            h("div", { class: "muted" }, `${doneCount(all)} / ${all.length} ${unit} орындалды`),
            h("div", { class: "bar " + (tint[f.id] || "t0"), style: { maxWidth: "360px", marginTop: ".5rem" } }, h("i", { style: { width: p + "%" } })))),
        all.length ? h("div", { class: "reading", style: { maxWidth: "980px" } }, blocks) : h("div", { class: "empty2" }, `Бұл бөлімде әзірге ${unit} жоқ.`)];
    }

    const roots = (kids.root || []).filter(f => deep(f.id).length);
    const loose = testsIn.none || [];
    return [head,
      !items.length ? h("div", { class: "empty2" }, h("img", { src: "img/cat.png", alt: "" }),
        unit === "тест" ? "Мұғалім әлі тест жарияламаған." : "Мұғалім әлі тапсырма жарияламаған.") : null,
      roots.length ? h("div", { class: "secs" }, roots.map(f => {
        const all = deep(f.id), done = doneCount(all), p = all.length ? Math.round(done / all.length * 100) : 0;
        const nTopics = (kids[f.id] || []).filter(x => deep(x.id).length).length;
        return h("button", { class: "sec", onclick: () => go(base + "/" + f.id) },
          h("span", { class: "sec-top" },
            h("span", { class: "sec-sym " + (tint[f.id] || "t0") }, symbolOf(f)),
            h("span", {}, h("span", { class: "sec-name", style: { display: "block" } }, f.title),
              h("span", { class: "sec-meta", style: { display: "block" } }, (nTopics ? `${nTopics} тақырып · ` : "") + `${all.length} ${unit}`))),
          h("span", { class: "bar " + (tint[f.id] || "t0") }, h("i", { style: { width: p + "%" } })),
          h("span", { class: "sec-foot" }, h("span", {}, `${done} / ${all.length} орындалды`), h("b", {}, p + "%")));
      })) : null,
      loose.length ? h("h2", { style: { marginTop: "2rem" } }, roots.length ? (unit === "тест" ? "Басқа тесттер" : "Басқа тапсырмалар") : (unit === "тест" ? "Тесттер" : "Тапсырмалар")) : null,
      loose.length ? h("div", { style: { maxWidth: "980px" } }, rows(loose)) : null];
  }

  // ---------- тесттер ----------
  function viewTests(args) {
    const items = D.tests.filter(t => (t.kind || "test") === "test");
    const results = h("div", {});
    const input = h("input", { type: "text", placeholder: "Тест іздеу…", "aria-label": "Тест іздеу", oninput: () => {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = "";
      body.classList.toggle("hidden", !!q);
      if (!q) return;
      const found = items.filter(t => (t.title + " " + (t.description || "")).toLowerCase().includes(q));
      results.appendChild(found.length ? h("div", { style: { maxWidth: "980px" } }, h("p", { class: "muted" }, `Табылды: ${found.length}`), rows(found))
        : h("div", { class: "empty2" }, "Ештеңе табылмады."));
    } });
    const head = h("div", { class: "pg-head" },
      h("div", {}, h("h1", {}, "Тақырыптық тесттер"), h("p", {}, "Бөлімді таңдап, тест тапсыр. Жауаптарың тапсырғанға дейін осы құрылғыда сақталады.")),
      h("label", { class: "search" }, ic("search", 20), input));
    const body = h("div", {}, browse({ items, scope: "tests", unit: "тест", base: "tests", folderId: args[0], head: null, rootLabel: "Бөлімдер" }));
    setView(args[0] ? null : head, results, body);
  }

  // ---------- тапсырмалар ----------
  const TASK_UI = {
    whoami: { cls: "ti-blue", icon: "profile", bg: "#E7F0FF", fg: "#1F5FD8", sample: "Натрий хлориді → NaCl" },
    balance: { cls: "ti-green", icon: "results", bg: "#E2F6E9", fg: "#15924A", sample: "_ Al + _ O2 → _ Al2O3" },
    complete: { cls: "ti-amber", icon: "tasks", bg: "#FFF1DA", fg: "#B45309", sample: "Zn + 2HCl → ? + H2↑" }
  };
  function viewTasks(args) {
    const all = D.tasks = D.tests.filter(t => t.kind === "task");
    const type = args[0] && TASK_TYPES[args[0]] ? args[0] : null;
    if (!type) {
      return setView(
        h("div", { class: "pg-head" }, h("div", {}, h("h1", {}, "Тапсырмалар"), h("p", {}, "Формулалар мен реакцияларды ойын түрінде жаттықтыр."))),
        h("div", { class: "task-types" }, Object.entries(TASK_TYPES).map(([k, v]) => {
          const u = TASK_UI[k] || TASK_UI.whoami;
          const list = all.filter(t => t.task_type === k);
          const done = list.filter(t => t.attempt).length;
          return h("button", { class: "ttype", disabled: !list.length, onclick: () => go("tasks/" + k) },
            h("span", { class: "ttype-top" }, h("span", { class: "ti-round " + u.cls }, ic(u.icon, 28, 2.3)),
              h("span", { class: "chip2", style: { background: u.bg, color: u.fg } }, list.length ? `${done}/${list.length} орындалды` : "Әзірге жоқ")),
            h("b", {}, v.title),
            h("span", { class: "tdesc" }, v.hint),
            h("span", { class: "tsample", style: { background: u.bg }, html: chemifyText(u.sample) }),
            list.length ? h("span", { class: "tgo", style: { color: u.fg } }, "Бастау", ic("arrow", 18)) : null);
        })));
    }
    const items = all.filter(t => t.task_type === type);
    const crumbsRoot = [h("button", { onclick: () => go("tasks") }, "Тапсырмалар"), h("span", { class: "sep" }, "/")];
    const head = [h("nav", { class: "crumbs", "aria-label": "Жол" }, crumbsRoot, h("span", {}, TASK_TYPES[type].title)),
      h("div", { class: "pg-head" }, h("div", {}, h("h1", {}, TASK_TYPES[type].title), h("p", {}, TASK_TYPES[type].hint + " Бөлімді таңдап, орында.")))];
    setView(...browse({ items, scope: "tasks:" + type, unit: "тапсырма", base: "tasks/" + type, folderId: args[1], head, rootLabel: TASK_TYPES[type].title, rootCrumbs: crumbsRoot }).flat());
  }

  // ---------- нәтижелер ----------
  let resTab = "test";
  function viewResults() {
    const s = stats();
    const act = active();
    const last = act.slice().sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)).slice(-8);
    const color = p => p >= 80 ? "#16A34A" : p >= 60 ? "#1F6BEA" : "#F59E0B";
    const chart = last.length ? h("section", { class: "chart" },
      h("div", { class: "row between" }, h("h2", { style: { margin: 0, fontSize: "1.2rem" } }, `Соңғы ${last.length} нәтиже`),
        h("div", { class: "legend" },
          h("span", {}, h("i", { style: { background: "#16A34A" } }), "80% және жоғары"),
          h("span", {}, h("i", { style: { background: "#1F6BEA" } }), "60–79%"),
          h("span", {}, h("i", { style: { background: "#F59E0B" } }), "60%-дан төмен"))),
      h("div", { class: "chart-bars", role: "img", "aria-label": "Соңғы нәтижелер диаграммасы" }, last.map(a => {
        const p = pct(a.score, a.max_score);
        return h("div", { class: "cb", title: `${a.title}: ${p}%` }, h("b", {}, p + "%"),
          h("i", { style: { height: Math.max(p, 2) * 1.6 + "px", background: color(p) } }), h("span", {}, a.title));
      }))) : null;
    const listBox = h("div", {});
    const seg = h("div", { class: "seg2", role: "tablist" });
    const paint = () => {
      seg.innerHTML = "";
      [["test", "Тесттер"], ["task", "Тапсырмалар"]].forEach(([k, l]) => seg.appendChild(h("button", { class: resTab === k ? "on" : "", role: "tab", "aria-selected": resTab === k ? "true" : "false", onclick: () => { resTab = k; paint(); } }, l)));
      const list = D.history.filter(a => (kindOf(a.test_id) === "task") === (resTab === "task"));
      listBox.innerHTML = "";
      listBox.appendChild(list.length ? h("div", { class: "rows" }, list.map(a => {
        const p = pct(a.score, a.max_score);
        return h("div", { class: "test-row" },
          h("span", { class: "tr-ico" }, ic(resTab === "task" ? "tasks" : "tests", 22)),
          h("div", { class: "t-main" }, h("div", { class: "t-title" }, a.title),
            h("div", { class: "t-sub" }, fmtDate(a.submitted_at) + (a.archived ? " · бұрынғы әрекет" : ""))),
          h("div", { class: "tr-act" },
            h("span", { class: "t-score" }, `${num(a.score)}/${num(a.max_score)}`),
            h("span", { class: "chip2 " + (p >= 80 ? "ok" : p >= 60 ? "" : "warn") }, p + "%"),
            h("button", { class: "sm", onclick: () => showReview(a.id) }, "Талдау")));
      })) : h("div", { class: "empty2" }, resTab === "task" ? "Әзірге орындалған тапсырма жоқ." : "Әзірге тапсырылған тест жоқ."));
    };
    paint();
    setView(
      h("div", { class: "pg-head" }, h("div", {}, h("h1", {}, "Менің нәтижелерім"), h("p", {}, "Барлық тапсырған тесттерің мен тапсырмаларың осында сақталады."))),
      h("section", { class: "stats", style: { marginTop: 0, marginBottom: "1.6rem" } },
        statCard("c-blue", "cap", String(s.testsDone), "Тапсырылған тест", "#/results"),
        statCard("c-green", "target", s.hasAny ? s.avg + "%" : "—", "Орташа нәтиже", "#/results"),
        statCard("c-amber", "star", s.hasAny ? s.best + "%" : "—", "Ең жақсы нәтиже", "#/results"),
        statCard("c-violet", "tasks", String(s.tasksDone), "Орындалған тапсырма", "#/tasks")),
      chart,
      h("div", { style: { marginTop: "1.6rem" } }, seg, listBox));
  }

  // ---------- сұрақ карточкасы (тест пен «Қателерім» үшін ортақ) ----------
  function questionCard(q, n, answers, changed) {
    const card = h("div", { class: "card q-card", id: n ? "q" + n : null },
      h("div", { class: "q-meta" },
        n ? h("span", { class: "q-num" }, n + ".") : null,
        h("span", { class: "badge gray" }, TYPE_LABEL[q.type] || ""),
        h("span", { class: "small muted" }, `${num(q.points)} ұпай`)),
      rich(q.stem, "q-stem"));

    if (q.type === "single" || q.type === "multiple" || !q.type) {
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
            paint(); changed();
          } },
          h("span", { class: "letter" }, o.k), h("div", { class: "opt-body" }, rich(o.h)));
        btns.push([o.k, b]); opts.appendChild(b);
      }
      if (multi) card.appendChild(h("p", { class: "small muted", style: { marginTop: 0 } }, "Барлық дұрыс жауаптарды белгіле."));
      card.appendChild(opts);
      paint();
    } else if (q.type === "whoami") {
      const list = h("div", { class: "match-left" });
      for (const L of q.left || []) {
        const sel = h("select", { class: "who-sel", onchange: () => {
          const cur = Object.assign({}, answers[q.id] || {});
          if (sel.value) cur[L.k] = sel.value; else delete cur[L.k];
          if (Object.keys(cur).length) answers[q.id] = cur; else delete answers[q.id];
          changed();
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
          changed();
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
          changed(); paint();
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
            paint(); changed();
          } }, o.k);
          chips.push([o.k, c]); chipBox.appendChild(c);
        }
        left.appendChild(h("div", { class: "match-row" },
          h("div", {}, h("b", { class: "q-num" }, L.k + ")"), rich(L.h)), chipBox));
        paint();
      }
      card.appendChild(h("p", { class: "small muted", style: { marginTop: 0 } }, "Әр нөмірге сәйкес әріпті таңда."));
      card.appendChild(left);
      card.appendChild(h("div", { class: "opts match-opts" }, (q.options || []).map(o =>
        h("div", { class: "opt" }, h("span", { class: "letter" }, o.k), h("div", { class: "opt-body" }, rich(o.h))))));
    }
    return card;
  }
  function isAnswered(q, answers) {
    const a = answers[q.id];
    if (q.type === "matching" || q.type === "whoami") return a && (q.left || []).every(L => a[L.k]);
    if (q.type === "balance") return Array.isArray(a) && a.some(x => String(x || "").trim());
    if (q.type === "complete") return typeof a === "string" && a.trim().length > 0;
    if (q.type === "multiple") return Array.isArray(a) && a.length > 0;
    return !!a;
  }

  // ---------- қателерім ----------
  let mistFilter = null;
  function viewMistakes(args) {
    if (args[0] !== undefined) mistFilter = args[0] || null;
    const all = D.mistakes;
    const groups = {};
    all.forEach(m => { (groups[m.test_id] = groups[m.test_id] || { title: m.title, kind: m.kind, items: [] }).items.push(m); });
    if (mistFilter && !groups[mistFilter]) mistFilter = null;
    let queue = all.filter(m => !mistFilter || m.test_id === mistFilter);
    let idx = 0;
    const countEl = h("b", {}, String(all.length));
    const main = h("div", { class: "mist-main" });
    const side = h("div", { class: "mist-side" });

    const head = h("div", { class: "pg-head" },
      h("div", {}, h("h1", {}, "Қателерім"),
        h("p", { style: { maxWidth: "640px" } }, "Қате жауап берген сұрақтарың осында жиналады. Дұрыс жауап берсең, сұрақ тізімнен өшеді. Тест нәтижесі өзгермейді.")),
      all.length ? h("div", { class: "mist-count" }, countEl, h("span", {}, "сұрақ", h("br"), "қайталауды күтуде")) : null);

    if (!all.length) {
      return setView(head, h("div", { class: "empty2", style: { padding: "3rem 1rem" } },
        h("img", { src: "img/cheer-cat.jpg", alt: "", style: { width: "160px", borderRadius: "20px" } }),
        h("b", { style: { fontSize: "1.1rem", color: "var(--ink)" } }, "Қайталайтын қате жоқ!"),
        "Тест тапсырғанда қате жауап берсең, сол сұрақтар осында пайда болады.",
        h("a", { class: "btn-pill blue", href: "#/tests", style: { minHeight: "48px" } }, "Тест тапсыру", ic("arrow", 18))));
    }

    function renderSide() {
      side.innerHTML = "";
      side.appendChild(h("div", { class: "mist-tip" }, h("img", { src: "img/cat-head.png", alt: "" }),
        h("p", {}, "Қатеден қорықпа! Әр қайталау — жеңіске бір қадам.")));
      const ids = Object.keys(groups).filter(id => groups[id].items.length);
      side.appendChild(h("div", { class: "side-card" }, h("h3", {}, "Тесттер бойынша"),
        h("button", { class: "mg-row" + (!mistFilter ? " on" : ""), onclick: () => { mistFilter = null; restart(); } },
          h("span", { class: "t-main" }, h("span", { class: "t-title", style: { display: "block" } }, "Барлық қателер")),
          h("span", { class: "chip2 warn" }, `${all.length} сұрақ`)),
        ids.map(id => h("button", { class: "mg-row" + (mistFilter === id ? " on" : ""), onclick: () => { mistFilter = id; restart(); } },
          h("span", { class: "tr-ico", style: { width: "38px", height: "38px", background: "var(--warn-soft)", color: "var(--warn)" } }, ic(groups[id].kind === "task" ? "tasks" : "x", 20)),
          h("span", { class: "t-main" }, h("span", { class: "t-title", style: { display: "block" } }, groups[id].title),
            h("span", { class: "t-sub", style: { display: "block" } }, groups[id].kind === "task" ? "Тапсырма" : "Тест")),
          h("span", { class: "chip2 warn" }, `${groups[id].items.length}`)))));
    }
    function restart() { queue = all.filter(m => !mistFilter || m.test_id === mistFilter); idx = 0; renderSide(); renderQ(); }

    function renderQ() {
      main.innerHTML = "";
      if (!queue.length) {
        main.appendChild(h("div", { class: "empty2", style: { padding: "3rem 1rem" } },
          h("img", { src: "img/cheer-cat.jpg", alt: "", style: { width: "160px", borderRadius: "20px" } }),
          h("b", { style: { fontSize: "1.1rem", color: "var(--ink)" } }, "Жарайсың! Бұл қателердің бәрін түзеттің."),
          all.length ? h("button", { class: "primary", onclick: () => { mistFilter = null; restart(); } }, "Қалған қателерге өту") : null));
        return;
      }
      if (idx >= queue.length) idx = 0;
      const m = queue[idx];
      const q = m.question;
      const answers = {};
      const box = h("div", {});
      if (m.context) box.appendChild(h("div", { class: "card ctx-card", style: { marginBottom: "1rem" } }, h("div", { class: "ctx-label" }, "Контекст"), rich(m.context)));
      const checkBtn = h("button", { class: "primary", disabled: true, onclick: check }, "Тексеру");
      let solved = false;
      const nextBtn = h("button", { onclick: () => { if (!solved && queue.length) idx = (idx + 1) % queue.length; renderQ(); } }, queue.length > 1 ? "Келесі сұрақ" : "Қайта көру");
      const card = questionCard(q, 0, answers, () => { checkBtn.disabled = !isAnswered(q, answers); });
      box.append(card);
      const msg = h("div", {});
      main.append(
        h("div", { class: "mist-q-head" },
          h("span", { class: "chip2" }, m.title),
          h("span", { class: "small muted" }, `${idx + 1} / ${queue.length}` + (m.wrong_count > 1 ? ` · бұрын ${m.wrong_count} рет қате` : ""))),
        box, msg, h("div", { class: "mist-actions" }, checkBtn, nextBtn));

      async function check() {
        checkBtn.disabled = true;
        try {
          const r = await rpc("student_mistake_check", { p_token: me.token, p_test_id: m.test_id, p_question_id: m.question_id, p_answer: answers[q.id] === undefined ? null : answers[q.id] });
          const rev = renderReview({ questions: [r.question], details: r.details, answers: { [q.id]: answers[q.id] }, contexts: {} });
          box.innerHTML = ""; box.appendChild(rev);
          if (r.correct) {
            msg.replaceWith(h("div", { class: "mist-msg ok" }, ic("checkc", 22), "Дұрыс! Бұл сұрақ «Қателерім» тізімінен өшірілді."));
            const pos = all.indexOf(m); if (pos >= 0) all.splice(pos, 1);
            groups[m.test_id].items = groups[m.test_id].items.filter(x => x !== m);
            queue.splice(idx, 1); if (idx >= queue.length) idx = 0;
            countEl.textContent = String(all.length);
            const cnt = document.querySelectorAll(".xk-nav .cnt, .xk-tabbar .cnt");
            cnt.forEach(c => { if (all.length) c.textContent = all.length; else c.remove(); });
            renderSide();
            solved = true;
            nextBtn.textContent = queue.length ? "Келесі сұрақ" : "Аяқтау";
          } else {
            m.wrong_count++;
            msg.replaceWith(h("div", { class: "mist-msg bad" }, ic("x", 22), "Қате. Дұрыс жауапты қарап ал. Сұрақ тізімде қалады."));
          }
          checkBtn.remove();
          nextBtn.classList.add("primary");
        } catch (ex) {
          if (ex.message === "NO_SESSION") return;
          checkBtn.disabled = false; toast(errMsg(ex), 4000);
        }
      }
    }
    renderSide(); renderQ();
    setView(head, h("div", { class: "mist-grid" }, main, side));
  }

  // ---------- профиль ----------
  function viewProfile() {
    const s = stats();
    const big = h("span", {});
    const paintBig = () => { big.innerHTML = ""; big.appendChild(avatarEl(me.avatar || 0, "prof-av")); };
    paintBig();
    const grid = h("div", { class: "av-grid" });
    const paintGrid = () => {
      grid.innerHTML = "";
      AVATARS.forEach((a, i) => grid.appendChild(h("button", { class: "av-opt" + ((me.avatar || 0) === i ? " on" : ""), style: { background: a.bg },
        "aria-label": `Аватар ${i + 1}`, "aria-pressed": (me.avatar || 0) === i ? "true" : "false",
        onclick: async () => {
          const prev = me.avatar || 0;
          me.avatar = i; paintGrid(); paintBig(); renderTop();
          try { await rpc("student_set_avatar", { p_token: me.token, p_avatar: i }); toast("Аватар сақталды"); }
          catch (ex) { if (ex.message !== "NO_SESSION") { me.avatar = prev; paintGrid(); paintBig(); renderTop(); toast(errMsg(ex), 4000); } }
        } }, h("img", { src: a.src, alt: "" }))));
    };
    paintGrid();
    setView(
      h("div", { class: "pg-head" }, h("h1", {}, "Профиль")),
      h("div", { class: "prof" },
        h("div", { class: "card prof-card" }, big,
          h("div", { class: "prof-name" }, me.full_name),
          h("div", { class: "row", style: { justifyContent: "center" } },
            me.class_name ? h("span", { class: "chip2" }, me.class_name + " сынып") : null,
            h("span", { class: "chip2 gray" }, "Логин: " + me.username)),
          h("div", { class: "prof-stats" },
            h("div", {}, h("b", {}, String(s.testsDone)), h("span", {}, "тест")),
            h("div", {}, h("b", {}, s.hasAny ? s.avg + "%" : "—"), h("span", {}, "орташа")),
            h("div", {}, h("b", {}, String(s.tasksDone)), h("span", {}, "тапсырма"))),
          h("button", { class: "danger", style: { marginTop: ".6rem" }, onclick: logout }, ic("logout", 18), "Шығу")),
        h("div", { class: "card prof-pick" },
          h("div", {}, h("h2", { style: { margin: 0 } }, "Аватар таңда"),
            h("p", { class: "muted", style: { margin: ".35rem 0 0" } }, "Таңдаған мысығың мәзірде және профильде көрінеді.")),
          grid,
          h("div", { class: "prof-note" }, ic("lock", 18), "Құпиясөзді ұмытсаң, мұғаліміңе айт: ол жаңасын береді."))));
  }

  // ---------- тест тапсыру ----------
  async function startTest(testId) {
    closeNotif();
    loading();
    let test;
    try { test = await rpc("student_get_test", { p_token: me.token, p_test_id: testId }); }
    catch (ex) { if (ex.message !== "NO_SESSION") { toast(errMsg(ex), 4000); route(); } return; }
    document.body.classList.add("taking");

    const KEY = savedKey(testId);
    let answers = {};
    try { answers = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) { answers = {}; }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch (_) {} };

    const qs = test.questions || [];
    const navLinks = [];
    const bar = h("div", {});
    const counter = h("span", { class: "small muted num" });
    function refresh() {
      const n = qs.filter(q => isAnswered(q, answers)).length;
      bar.style.width = (qs.length ? (n / qs.length) * 100 : 0) + "%";
      counter.textContent = `${n}/${qs.length}`;
      qs.forEach((q, i) => navLinks[i].classList.toggle("done", isAnswered(q, answers)));
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
      body.appendChild(questionCard(q, i + 1, answers, () => { save(); refresh(); }));
    });

    const submitBtn = h("button", { class: "primary", onclick: () => submit() }, "Тапсыру");
    async function submit() {
      const left = qs.filter(q => !isAnswered(q, answers)).length;
      const ok = await modal(h("div", {},
        h("h3", {}, "Тестті тапсырасың ба?"),
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
        if (String(ex.message || "").includes("ALREADY_SUBMITTED")) { localStorage.removeItem(KEY); route(); }
      }
    }

    setView(h("div", { class: "reading", style: { margin: "0 auto" } },
      h("div", { class: "test-head" },
        h("button", { class: "ghost sm", onclick: async () => {
          if (await modal(h("p", {}, "Тізімге қайтасың ба? Жауаптарың осы құрылғыда сақталады, кейін жалғастыра аласың."),
            [{ label: "Жоқ", value: false }, { label: "Иә", value: true, class: "primary" }])) backToList();
        } }, "← Артқа"),
        h("h1", { style: { marginTop: ".4rem" } }, test.title),
        test.kind === "task" && TASK_TYPES[test.task_type] ? h("p", { class: "notice info" }, TASK_TYPES[test.task_type].hint) : null,
        test.description ? h("p", { class: "muted" }, test.description) : null,
        h("div", { class: "qnav", "aria-label": "Сұрақтар" }, navLinks)),
      body),
      h("div", { class: "submitbar" }, h("div", { class: "submitbar-inner" },
        counter, h("div", { class: "progress" }, bar), submitBtn))
    );
    refresh();
  }
  function backToList() {
    document.body.classList.remove("taking");
    if (location.hash !== lastHash) location.hash = lastHash; else route();
  }

  // ---------- нәтиже ----------
  function showResult(res) {
    document.body.classList.add("taking");
    const det = res.details || [];
    const full = det.filter(d => Number(d.earned) >= Number(d.points)).length;
    const part = det.filter(d => Number(d.earned) > 0 && Number(d.earned) < Number(d.points)).length;
    const zero = det.length - full - part;
    const p = pct(res.score, res.max_score);
    const head = h("div", { class: "card score-hero" },
      h("img", { src: p >= 60 ? "img/cheer-cat.jpg" : "img/cat-head.png", alt: "", style: { width: "92px", height: "92px", objectFit: "cover", borderRadius: "22px", background: "#fff" } }),
      h("div", { class: "score-big" }, num(res.score), h("span", { class: "of" }, " / " + num(res.max_score))),
      h("div", {},
        h("div", { class: "score-pct" }, p + "%"),
        h("div", { class: "muted small" }, fmtDate(res.submitted_at) + (res.archived ? " · бұрынғы әрекет" : ""))),
      det.length ? h("div", { class: "row", style: { marginLeft: "auto" } },
        h("span", { class: "badge ok" }, `Дұрыс: ${full}`),
        part ? h("span", { class: "badge warn" }, `Жартылай: ${part}`) : null,
        h("span", { class: "badge bad" }, `Қате: ${zero}`)) : null);
    const back = () => h("button", { class: "ghost sm", onclick: backToList }, "← Тізімге оралу");
    const again = () => res.can_retake ? h("button", { class: "primary sm", onclick: () => startTest(res.test_id) }, "Қайта тапсыру") : null;
    const toMist = () => zero + part > 0 && res.show_answers ? h("a", { class: "btn", href: "#/mistakes", style: { minHeight: "38px" } }, "Қателермен жұмыс") : null;
    const top = h("div", { class: "test-head" }, h("div", { class: "row between" }, back(), h("div", { class: "row" }, toMist(), again())),
      h("h1", { style: { marginTop: ".6rem" } }, res.title || "Нәтиже"));
    if (!res.show_answers || !res.questions) {
      return setView(h("div", { class: "reading", style: { margin: "0 auto" } }, top, head,
        h("p", { class: "muted" }, "Мұғалім бұл тест бойынша дұрыс жауаптарды жасырған."),
        h("div", { class: "row" }, again())));
    }
    setView(h("div", { class: "reading", style: { margin: "0 auto" } }, top, head,
      h("h2", {}, "Әр сұрақ бойынша"),
      h("p", { class: "small muted", style: { margin: "-.4rem 0 1rem" } },
        "Сұрақта немесе жауапта қате бар деп ойласаң, сол сұрақтың астындағы «Апелляция беру» батырмасын басып, себебін жаз."),
      renderReview(res, { footer: q => appealBox(res, q) }),
      h("div", { class: "row", style: { marginTop: "1.4rem" } }, back(), toMist(), again())));
  }

  // Сұрақтың астындағы апелляция бөлігі
  function appealBox(res, q) {
    const box = h("div", { class: "appeal" });
    const appeals = res.appeals || (res.appeals = {});
    const status = ap => {
      box.innerHTML = "";
      box.className = "appeal " + (ap.status === "open" ? "open" : "done");
      box.append(
        h("div", { class: "appeal-head" }, ap.status === "open"
          ? "Апелляция берілді. Мұғалім қарағанша бұл сұрақ басқа оқушыларға көрсетілмейді."
          : "Апелляция қаралды: мұғалім сұрақты дұрыс деп растады."),
        h("div", { class: "small" }, h("span", { class: "muted" }, "Сенің хабарламаң: "), ap.message),
        ...(ap.reply ? [h("div", { class: "small" }, h("span", { class: "muted" }, "Мұғалімнің жауабы: "), ap.reply)] : []));
    };
    const ap = appeals[q.id];
    if (ap) { status(ap); return box; }
    if ((res.verified || []).includes(q.id)) {
      box.className = "appeal quiet";
      box.textContent = "Мұғалім бұл сұрақты дұрыс деп растаған.";
      return box;
    }
    const open = () => {
      const area = h("textarea", { rows: 3, maxlength: 1000, placeholder: "Неге апелляция бересің? Мысалы: дұрыс жауап B емес, C болуы керек, себебі…" });
      const err = h("div", { class: "small mt-bad hidden" });
      const send = h("button", { class: "primary sm", onclick: async () => {
        const msg = area.value.trim();
        if (msg.length < 5) { err.textContent = "Себебін толығырақ жаз."; err.classList.remove("hidden"); area.focus(); return; }
        send.disabled = true; err.classList.add("hidden");
        try {
          const r = await rpc("student_appeal", { p_token: me.token, p_attempt_id: res.attempt_id, p_question_id: q.id, p_message: msg });
          appeals[q.id] = r; status(r); toast("Апелляция жіберілді");
        } catch (ex) {
          if (ex.message === "NO_SESSION") return;
          err.textContent = errMsg(ex); err.classList.remove("hidden"); send.disabled = false;
        }
      } }, "Жіберу");
      box.innerHTML = ""; box.className = "appeal form";
      box.append(h("label", { class: "field" }, "Апелляцияның себебі", area), err,
        h("div", { class: "row" }, send, h("button", { class: "ghost sm", onclick: closed }, "Бас тарту")));
      area.focus();
    };
    const closed = () => {
      box.innerHTML = ""; box.className = "appeal";
      box.append(h("button", { class: "ghost sm appeal-btn", onclick: open }, "Апелляция беру"));
    };
    closed();
    return box;
  }

  async function showReview(attemptId) {
    loading();
    try { showResult(await rpc("student_review", { p_token: me.token, p_attempt_id: attemptId })); }
    catch (ex) { if (ex.message !== "NO_SESSION") { toast(errMsg(ex), 4000); route(); } }
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
      me = { token: tok, avatar: 0, ...r.data };
      route();
    } catch (ex) {
      localStorage.removeItem(TOKEN_KEY);
      showLogin();
    }
  })();
})();
