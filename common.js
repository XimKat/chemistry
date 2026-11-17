/* Ортақ көмекші функциялар (оқушы және мұғалім беттері үшін) */
(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
    !/XXXX/.test(CFG.SUPABASE_URL) && !/^XXXX$/.test(CFG.SUPABASE_ANON_KEY));

  let sb = null;
  if (configured && window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  }

  const TYPE_LABEL = {
    single: "Бір дұрыс жауап",
    multiple: "Бір немесе бірнеше дұрыс жауап",
    matching: "Сәйкестендіру"
  };

  const ERRORS = {
    BAD_LOGIN: "Логин немесе құпиясөз қате.",
    LOCKED: "Құпиясөз тым көп рет қате енгізілді. 5 минуттан кейін қайталап көріңіз.",
    NO_SESSION: "Қайта кіріңіз.",
    SHORT_PASSWORD: "Құпиясөз кемінде 4 таңбадан тұруы керек.",
    NO_NAME: "Оқушының аты-жөні жазылмаған.",
    NOT_TEACHER: "Бұл әрекет тек мұғалімге рұқсат етілген.",
    ALREADY_SUBMITTED: "Бұл тестті сіз тапсырып қойғансыз. Қайта тапсыру үшін мұғаліміңізге хабарласыңыз.",
    NO_TEST: "Тест табылмады немесе әлі жарияланбаған.",
    NO_ATTEMPT: "Бұл тест бойынша нәтиже жоқ.",
    BAD_ANSWERS: "Жауаптар дұрыс жіберілмеді.",
    "Invalid login credentials": "Пошта немесе құпиясөз қате.",
    "Failed to fetch": "Интернет байланысын тексеріңіз."
  };

  function errMsg(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e || "Белгісіз қате");
    let x;
    if ((x = m.match(/USERNAME_TAKEN:(.*)/))) return `Бұл логин(дер) бос емес: ${x[1].trim()}. Басқа логин таңдаңыз.`;
    if ((x = m.match(/BAD_USERNAME:(.*)/))) return `«${x[1].trim()}» — логин 3–40 таңбадан тұруы керек, бос орынсыз.`;
    if (/students_username_key|duplicate key/.test(m)) return "Бұл логин бос емес. Басқа логин таңдаңыз.";
    for (const k of Object.keys(ERRORS)) if (m.includes(k)) return ERRORS[k];
    return m;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const PURIFY = {
    ALLOWED_TAGS: ["p", "br", "b", "strong", "i", "em", "u", "sub", "sup", "img", "table", "thead", "tbody",
      "tr", "td", "th", "ul", "ol", "li", "span", "div"],
    ALLOWED_ATTR: ["src", "alt", "colspan", "rowspan"],
    ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);)/i
  };
  function clean(html) {
    if (window.DOMPurify) return window.DOMPurify.sanitize(html || "", PURIFY);
    return esc(html || "");
  }

  // Шағын DOM құрастырушы: h("div", {class:"x", onclick: fn}, child1, "мәтін")
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k in el && typeof v !== "string") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  function rich(html, cls) { return h("div", { class: "rich " + (cls || ""), html: clean(html) }); }

  let toastTimer;
  function toast(msg, ms) {
    let t = document.querySelector(".toast");
    if (!t) { t = h("div", { class: "toast" }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), ms || 2800);
  }

  // Модаль терезе. buttons: [{label, value, class}] → Promise(value)
  function modal(content, buttons) {
    return new Promise(resolve => {
      const back = h("div", { class: "modal-back" });
      const close = v => { back.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
      const onKey = e => { if (e.key === "Escape") close(null); };
      const btns = (buttons || [{ label: "Жабу", value: null }]).map(b =>
        h("button", { class: b.class || "", onclick: () => close(b.value) }, b.label));
      const box = h("div", { class: "modal" },
        typeof content === "string" ? h("div", { html: content }) : content,
        h("div", { class: "row", style: { justifyContent: "flex-end", marginTop: "1.1rem" } }, btns));
      back.appendChild(box);
      back.addEventListener("click", e => { if (e.target === back) close(null); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(back);
      const f = box.querySelector("input:not([type=checkbox]):not([type=radio]), textarea, select") || box.querySelector("button.primary");
      if (f) f.focus();
    });
  }
  const confirmBox = (text, okLabel, danger) => modal(h("p", {}, text), [
    { label: "Бас тарту", value: false },
    { label: okLabel || "Иә", value: true, class: danger ? "primary danger-bg" : "primary" }
  ]);

  // Химиялық формулаларды автоматты түзету: H2SO4 → H₂SO₄, Fe^3+ → Fe³⁺
  function chemifyText(t) {
    return esc(t)
      .replace(/\^\(?(\d*[+\-−–])\)?/g, "<sup>$1</sup>")
      .replace(/\^(\d+)/g, "<sup>$1</sup>")
      .replace(/([A-Z][a-z]?|\)|\])(\d+)/g, "$1<sub>$2</sub>");
  }
  function chemifyNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.parentElement && /^(SUB|SUP)$/.test(n.parentElement.tagName)) continue;
      if (/([A-Z][a-z]?|\)|\])\d|\^/.test(n.nodeValue)) nodes.push(n);
    }
    for (const n of nodes) {
      const span = document.createElement("span");
      span.innerHTML = chemifyText(n.nodeValue);
      n.replaceWith(...span.childNodes);
    }
  }

  const fmtDate = d => {
    if (!d) return "";
    const x = new Date(d);
    const p = n => String(n).padStart(2, "0");
    return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}`;
  };
  const num = v => { const n = Number(v); return Number.isInteger(n) ? String(n) : n.toFixed(1); };
  const pct = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : 0);

  // Нәтижені көрсету (оқушыға да, мұғалімге де ортақ)
  // data: {questions, contexts, answers, details}
  function renderReview(data) {
    const frag = document.createDocumentFragment();
    const det = {};
    (data.details || []).forEach(d => { det[d.id] = d; });
    const answers = data.answers || {};
    let lastCtx = null, n = 0;
    for (const q of data.questions || []) {
      n++;
      if (q.context && q.context !== lastCtx && data.contexts && data.contexts[q.context]) {
        frag.appendChild(h("div", { class: "card ctx-card" },
          h("div", { class: "ctx-label" }, "Контекст"), rich(data.contexts[q.context])));
      }
      lastCtx = q.context || null;
      const d = det[q.id] || { earned: 0, points: q.points };
      const given = answers[q.id];
      const state = Number(d.earned) >= Number(d.points) ? "r-ok" : Number(d.earned) > 0 ? "r-part" : "r-bad";
      const card = h("div", { class: "card q-card " + state },
        h("div", { class: "q-meta" },
          h("span", { class: "q-num" }, n + "."),
          h("span", { class: "badge gray" }, TYPE_LABEL[q.type] || ""),
          h("span", { class: "badge " + (state === "r-ok" ? "ok" : state === "r-part" ? "warn" : "bad") },
            `${num(d.earned)} / ${num(d.points)} ұпай`)),
        rich(q.stem, "q-stem"));

      if (q.type === "matching") {
        const correct = q.answer || {};
        const g = given || {};
        const list = h("div", { class: "match-left" });
        for (const L of q.left || []) {
          const mine = g[L.k] || "—";
          const ok = mine === correct[L.k];
          list.appendChild(h("div", { class: "match-row" },
            h("div", {}, h("b", { class: "q-num" }, L.k + ")"), rich(L.h)),
            h("div", { class: "small" },
              h("span", { class: ok ? "mt-ok" : "mt-bad" }, "Сіздікі: " + mine),
              ok ? null : h("span", { class: "mt-ok" }, ", дұрысы: " + (correct[L.k] || "?")))));
        }
        card.appendChild(list);
        card.appendChild(h("div", { class: "opts match-opts" }, (q.options || []).map(o =>
          h("div", { class: "opt" }, h("span", { class: "letter" }, o.k), h("div", { class: "opt-body" }, rich(o.h)))
        )));
      } else {
        const correctSet = new Set(q.type === "multiple" ? (q.answer || []) : [q.answer]);
        const givenSet = new Set(q.type === "multiple" ? (Array.isArray(given) ? given : []) : (given ? [given] : []));
        const opts = h("div", { class: "opts" });
        for (const o of q.options || []) {
          const isC = correctSet.has(o.k), isG = givenSet.has(o.k);
          let cls = "opt" + (q.type === "multiple" ? " multi" : "");
          let tag = null;
          if (isC && isG) { cls += " correct"; tag = h("span", { class: "tag mt-ok" }, "✓ сіздің жауабыңыз"); }
          else if (isC) { cls += " correct"; tag = h("span", { class: "tag mt-ok" }, "дұрыс жауап"); }
          else if (isG) { cls += " wrong"; tag = h("span", { class: "tag mt-bad" }, "✗ сіздің жауабыңыз"); }
          opts.appendChild(h("div", { class: cls },
            h("span", { class: "letter" }, o.k), h("div", { class: "opt-body" }, rich(o.h)), tag));
        }
        if (!givenSet.size) card.appendChild(h("p", { class: "small mt-bad" }, "Жауап берілмеген"));
        card.appendChild(opts);
      }
      frag.appendChild(card);
    }
    return frag;
  }

  // Бөлім белгісі: «Бейорганикалық химия» → «Бх», «Электролиз» → «Эл»
  function symbolOf(f) {
    if (f && f.symbol && f.symbol.trim()) return f.symbol.trim().slice(0, 3);
    const w = String((f && f.title) || "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
    if (!w.length) return "?";
    const a = w[0][0].toUpperCase();
    const b = w.length > 1 ? w[1][0].toLowerCase() : (w[0][1] || "").toLowerCase();
    return a + b;
  }
  // Ағаш: parent_id → балалар тізімі
  function childrenMap(folders) {
    const m = {};
    (folders || []).forEach(f => { const k = f.parent_id || "root"; (m[k] = m[k] || []).push(f); });
    Object.values(m).forEach(l => l.sort((a, b) => (a.position - b.position) || String(a.created_at || "").localeCompare(String(b.created_at || ""))));
    return m;
  }
  // Әр бөлімнің түсі (түбірдегі ретіне қарай), балалары сол түсті алады
  function tintMap(folders) {
    const kids = childrenMap(folders), tint = {};
    const walk = (id, t) => { tint[id] = t; (kids[id] || []).forEach(c => walk(c.id, t)); };
    (kids.root || []).forEach((f, i) => walk(f.id, "t" + (i % 6)));
    return tint;
  }

  window.App = {
    CFG, sb, configured, TYPE_LABEL, errMsg, esc, clean, h, rich, toast, modal, confirmBox,
    chemifyNode, chemifyText, fmtDate, num, pct, renderReview, symbolOf, childrenMap, tintMap,
    LETTERS: "ABCDEFGH".split("")
  };
})();
