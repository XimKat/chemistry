/* Мұғалім беті: тесттер, Word импорт, оқушылар, нәтижелер */
(function () {
  "use strict";
  const A = window.App;
  const { sb, configured, h, rich, toast, modal, confirmBox, errMsg, TYPE_LABEL, renderReview, fmtDate, num, pct, clean, LETTERS, symbolOf, childrenMap, tintMap } = A;
  const app = document.getElementById("app");
  const who = document.getElementById("who");
  let user = null;
  let tab = "tests";

  const uid = p => p + Math.random().toString(36).slice(2, 9);
  const setView = (...nodes) => { app.innerHTML = ""; nodes.flat().forEach(n => n && app.appendChild(n)); };
  const loading = () => setView(h("div", { style: { textAlign: "center", padding: "2rem" } }, h("span", { class: "spinner" })));
  const must = ({ data, error }) => { if (error) throw error; return data; };

  // =====================================================================
  //  КІРУ
  // =====================================================================
  function showLogin(msg) {
    who.innerHTML = "";
    const email = h("input", { type: "email", autocomplete: "username", required: true });
    const pass = h("input", { type: "password", autocomplete: "current-password", required: true });
    const err = h("div", { class: "notice err" + (msg ? "" : " hidden") }, msg || "");
    const btn = h("button", { class: "primary full big", type: "submit" }, "Кіру");
    setView(h("div", { class: "narrow" }, h("form", { class: "card stack", onsubmit: async e => {
      e.preventDefault(); btn.disabled = true; err.classList.add("hidden");
      try {
        must(await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value }));
        await afterLogin();
      } catch (ex) { err.textContent = errMsg(ex); err.classList.remove("hidden"); btn.disabled = false; }
    } },
      h("h1", {}, "Мұғалім беті"),
      h("label", { class: "field" }, "Пошта", email),
      h("label", { class: "field" }, "Құпиясөз", pass),
      err, btn,
      h("p", { class: "small muted" }, h("a", { href: "./" }, "Оқушы беті")))));
    email.focus();
  }

  async function afterLogin() {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return showLogin();
    const ok = must(await sb.rpc("is_teacher"));
    if (!ok) {
      await sb.auth.signOut();
      return showLogin("Бұл пошта мұғалім ретінде тіркелмеген. setup.sql ішіндегі поштаны тексеріп, қайта іске қосыңыз.");
    }
    user = s.session.user;
    who.innerHTML = "";
    who.append(h("span", { class: "small" }, user.email),
      h("button", { class: "ghost sm", onclick: async () => { await sb.auth.signOut(); user = null; showLogin(); } }, "Шығу"));
    route();
  }

  // =====================================================================
  //  ҚОЙЫНДЫЛАР
  // =====================================================================
  function tabs() {
    const items = [["tests", "Тесттер"], ["students", "Оқушылар"], ["results", "Нәтижелер"]];
    return h("nav", { class: "tabs no-print" }, items.map(([k, label]) =>
      h("button", { class: tab === k ? "active" : "", onclick: () => { tab = k; route(); } }, label)));
  }
  function route(arg) {
    if (tab === "tests") return showTests();
    if (tab === "students") return showStudents();
    if (tab === "results") return showResults(arg);
  }

  // =====================================================================
  //  ТЕСТТЕР ТІЗІМІ
  // =====================================================================
  const LEVEL = ["Бөлім", "Тақырып", "Тақырыпша"];
  const LEVEL_NEW = ["Жаңа бөлім", "Жаңа тақырып", "Жаңа тақырыпша"];
  let selFolder = "all";   // "all" | "none" | бөлім id-і

  async function loadFolders() {
    return must(await sb.from("folders").select("id,parent_id,title,symbol,position,created_at").order("position").order("created_at"));
  }
  // Ағашты тізім ретінде: [{f, depth}]
  function flatTree(folders) {
    const kids = childrenMap(folders), out = [];
    const walk = (id, d) => (kids[id] || []).forEach(f => { out.push({ f, depth: d }); walk(f.id, d + 1); });
    walk("root", 0);
    return out;
  }
  function folderPath(folders, id) {
    const byId = {}; folders.forEach(f => { byId[f.id] = f; });
    const p = []; for (let x = byId[id]; x; x = x.parent_id ? byId[x.parent_id] : null) p.unshift(x.title);
    return p.join(" / ");
  }
  function folderSelect(folders, value) {
    return h("select", {},
      h("option", { value: "" }, "Бөлімсіз"),
      flatTree(folders).map(({ f, depth }) => h("option", { value: f.id, selected: f.id === value },
        " ".repeat(depth) + f.title)));
  }

  async function folderDialog(title, f, depth) {
    const t = h("input", { type: "text", value: f ? f.title : "", placeholder: depth === 0 ? "Мысалы: Бейорганикалық химия" : depth === 1 ? "Мысалы: Металдар" : "Мысалы: Сілтілік металдар" });
    const sym = h("input", { type: "text", maxlength: 3, value: f ? f.symbol : "", placeholder: "автоматты", style: { maxWidth: "140px" } });
    const box = h("div", { class: "stack" }, h("h3", {}, title), h("label", { class: "field" }, "Атауы", t),
      depth === 0 ? h("label", { class: "field" }, "Белгісі (элемент ұяшығындағы 1–3 әріп, міндетті емес)", sym) : null);
    const ok = await modal(box, [{ label: "Бас тарту", value: false }, { label: "Сақтау", value: true, class: "primary" }]);
    if (!ok || !t.value.trim()) return null;
    return { title: t.value.trim(), symbol: sym.value.trim() };
  }

  async function showTests() {
    loading();
    let tests, folders, counts = {};
    try {
      [tests, folders] = await Promise.all([
        sb.from("tests").select("id,title,description,content,published,show_answers,created_at,folder_id,position,max_attempts,classes").order("position").order("created_at").then(must),
        loadFolders()
      ]);
      must(await sb.from("attempts").select("test_id")).forEach(a => { counts[a.test_id] = (counts[a.test_id] || 0) + 1; });
    } catch (ex) { return setView(tabs(), h("div", { class: "notice err" }, errMsg(ex))); }

    const byId = {}; folders.forEach(f => { byId[f.id] = f; });
    if (selFolder !== "all" && selFolder !== "none" && !byId[selFolder]) selFolder = "all";
    const kids = childrenMap(folders), tint = tintMap(folders);
    const descendants = id => [id, ...(kids[id] || []).flatMap(c => descendants(c.id))];
    const countIn = id => { const ids = new Set(descendants(id)); return tests.filter(t => ids.has(t.folder_id)).length; };
    const loose = tests.filter(t => !t.folder_id || !byId[t.folder_id]);

    // ---- бөлімдер ағашы ----
    async function addFolder(parent, depth) {
      const v = await folderDialog(LEVEL_NEW[depth], null, depth);
      if (!v) return;
      const siblings = kids[parent ? parent.id : "root"] || [];
      try {
        const ins = must(await sb.from("folders").insert({ parent_id: parent ? parent.id : null, title: v.title, symbol: v.symbol,
          position: siblings.length ? Math.max(...siblings.map(x => x.position)) + 1 : 0 }).select("id").single());
        selFolder = ins.id; showTests();
      } catch (ex) { toast(errMsg(ex)); }
    }
    async function renameFolder(f, depth) {
      const v = await folderDialog(`${LEVEL[depth]}ты өзгерту`, f, depth);
      if (!v) return;
      try { must(await sb.from("folders").update({ title: v.title, symbol: v.symbol }).eq("id", f.id)); showTests(); }
      catch (ex) { toast(errMsg(ex)); }
    }
    async function moveFolder(f, d) {
      const sib = kids[f.parent_id || "root"] || [];
      const i = sib.indexOf(f), j = i + d;
      if (j < 0 || j >= sib.length) return;
      const order = sib.slice(); [order[i], order[j]] = [order[j], order[i]];
      try {
        for (let k = 0; k < order.length; k++) if (order[k].position !== k) must(await sb.from("folders").update({ position: k }).eq("id", order[k].id));
        showTests();
      } catch (ex) { toast(errMsg(ex)); }
    }
    async function deleteFolder(f, depth) {
      const n = countIn(f.id), sub = descendants(f.id).length - 1;
      const msg = `«${f.title}» өшірілсін бе?` + (sub ? ` Ішіндегі ${sub} тақырып/тақырыпша да өшеді.` : "") +
        (n ? ` ${n} тест өшпейді, «Бөлімсіз тесттер» тізіміне ауысады.` : "");
      if (!(await confirmBox(msg, "Өшіру", true))) return;
      try { must(await sb.from("folders").delete().eq("id", f.id)); if (selFolder === f.id) selFolder = "all"; showTests(); }
      catch (ex) { toast(errMsg(ex)); }
    }

    const node = (key, label, count, depth, f) => {
      const sym = f && depth === 0 ? h("span", { class: "tree-sym", style: { background: `var(--${tint[f.id]}-bg)`, color: `var(--${tint[f.id]}-ink)` } }, symbolOf(f)) : null;
      return h("div", { class: `tree-node lvl-${depth}` + (selFolder === key ? " active" : "") },
        h("button", { class: "tn-label", onclick: () => { selFolder = key; showTests(); } }, sym, h("span", {}, label), h("span", { class: "tn-count" }, count)),
        f ? h("div", { class: "tn-tools" },
          depth < 2 ? h("button", { title: `${LEVEL[depth + 1]} қосу`, "aria-label": `${LEVEL[depth + 1]} қосу`, onclick: () => addFolder(f, depth + 1) }, "+") : null,
          h("button", { title: "Атауын өзгерту", "aria-label": "Атауын өзгерту", onclick: () => renameFolder(f, depth) }, "✎"),
          h("button", { title: "Жоғары", "aria-label": "Жоғары", onclick: () => moveFolder(f, -1) }, "↑"),
          h("button", { title: "Төмен", "aria-label": "Төмен", onclick: () => moveFolder(f, 1) }, "↓"),
          h("button", { title: "Өшіру", "aria-label": "Өшіру", onclick: () => deleteFolder(f, depth) }, "✕")) : null);
    };
    const tree = h("aside", { class: "card tree" },
      h("div", { class: "tree-title" }, h("h3", {}, "Бөлімдер"), h("button", { class: "sm", onclick: () => addFolder(null, 0) }, "+ Бөлім")),
      node("all", "Барлық тесттер", tests.length, 0, null),
      h("div", { class: "tree-sep" }),
      flatTree(folders).map(({ f, depth }) => node(f.id, f.title, countIn(f.id), depth, f)),
      folders.length ? h("div", { class: "tree-sep" }) : h("p", { class: "small muted", style: { margin: ".4rem .3rem" } },
        "Бөлім → тақырып → тақырыпша құрып, тесттерді соларға орналастырыңыз."),
      node("none", "Бөлімсіз тесттер", loose.length, 0, null));

    // ---- таңдалған бөлімнің тесттері ----
    const order = {}; flatTree(folders).forEach(({ f }, i) => { order[f.id] = i; });
    const byTree = (a, b) => ((order[a.folder_id] ?? 1e9) - (order[b.folder_id] ?? 1e9)) || (a.position - b.position) ||
      String(a.created_at).localeCompare(String(b.created_at));
    tests.sort(byTree);
    let shown, heading, sub = "";
    if (selFolder === "all") { shown = tests; heading = "Барлық тесттер"; }
    else if (selFolder === "none") { shown = loose; heading = "Бөлімсіз тесттер"; }
    else {
      const ids = new Set(descendants(selFolder));
      shown = tests.filter(t => ids.has(t.folder_id));
      heading = byId[selFolder].title;
      const p = folderPath(folders, byId[selFolder].parent_id);
      sub = p;
    }

    async function setPublished(t, cb) {
      cb.disabled = true;
      try { must(await sb.from("tests").update({ published: cb.checked }).eq("id", t.id)); t.published = cb.checked; cb.parentElement.classList.toggle("on", cb.checked); toast(cb.checked ? "Оқушыларға жарияланды" : "Жариялау тоқтатылды"); }
      catch (ex) { cb.checked = !cb.checked; toast(errMsg(ex)); }
      cb.disabled = false;
    }
    async function duplicate(t) {
      try {
        must(await sb.from("tests").insert({ title: (t.title || "") + " (көшірме)", description: t.description, content: t.content,
          published: false, show_answers: t.show_answers, folder_id: t.folder_id, position: t.position,
          max_attempts: t.max_attempts, classes: t.classes || [] }));
        toast("Көшірме жасалды"); showTests();
      } catch (ex) { toast(errMsg(ex)); }
    }
    async function moveTest(t) {
      const sel = folderSelect(folders, t.folder_id);
      const ok = await modal(h("div", { class: "stack" }, h("h3", {}, `«${t.title}» тестін орналастыру`),
        h("label", { class: "field" }, "Бөлім, тақырып немесе тақырыпша", sel)),
        [{ label: "Бас тарту", value: false }, { label: "Орналастыру", value: true, class: "primary" }]);
      if (!ok) return;
      try { must(await sb.from("tests").update({ folder_id: sel.value || null }).eq("id", t.id)); toast("Орналастырылды"); showTests(); }
      catch (ex) { toast(errMsg(ex)); }
    }
    async function del(t) {
      if (!(await confirmBox(`«${t.title}» тестін және оның барлық нәтижелерін өшіресіз бе? Бұны қайтаруға болмайды.`, "Өшіру", true))) return;
      try { must(await sb.from("tests").delete().eq("id", t.id)); toast("Өшірілді"); showTests(); }
      catch (ex) { toast(errMsg(ex)); }
    }

    const testRow = t => {
      const qs = (t.content && t.content.questions) || [];
      const total = qs.reduce((acc, q) => acc + Number(q.points || 0), 0);
      const cb = h("input", { type: "checkbox", checked: !!t.published, onchange: () => setPublished(t, cb) });
      const where = t.folder_id && byId[t.folder_id] ? folderPath(folders, t.folder_id) : "Бөлімсіз";
      return h("div", { class: "test-row admin" },
        h("div", { class: "t-main" },
          h("div", { class: "t-title" }, t.title || "Атаусыз тест"),
          h("div", { class: "t-sub" }, `${where}. ${qs.length} сұрақ, ${num(total)} ұпай, тапсырғандар: ${counts[t.id] || 0}`),
          h("div", { class: "row", style: { gap: ".35rem", marginTop: ".35rem" } },
            h("span", { class: "badge gray" }, (t.classes || []).length ? "Сыныптар: " + t.classes.join(", ") : "Барлық сыныптар"),
            h("span", { class: "badge gray" }, t.max_attempts === 0 ? "Шексіз тапсыру" : "Бір рет тапсыру"))),
        h("div", { class: "t-actions" },
          h("label", { class: "pub" + (t.published ? " on" : "") }, cb, h("span", {}, "Жарияланған")),
          h("button", { class: "sm", onclick: () => showEditor(t.id) }, "Өңдеу"),
          h("button", { class: "sm ghost", onclick: () => { tab = "results"; route(t.id); } }, "Нәтижелер"),
          h("button", { class: "sm ghost", onclick: () => moveTest(t) }, "Орны"),
          h("button", { class: "sm ghost", onclick: () => duplicate(t) }, "Көшірме"),
          h("button", { class: "sm ghost danger", onclick: () => del(t) }, "Өшіру")));
    };

    const newFolderId = selFolder !== "all" && selFolder !== "none" ? selFolder : null;
    const right = h("div", {},
      h("div", { class: "row between", style: { marginBottom: "1rem", alignItems: "flex-end" } },
        h("div", {}, sub ? h("div", { class: "small muted" }, sub) : null, h("h1", { style: { margin: 0 } }, heading)),
        h("button", { class: "primary", onclick: () => showEditor(null, newFolderId) }, "Жаңа тест")),
      shown.length ? h("div", { class: "rows" }, shown.map(testRow))
        : h("div", { class: "card empty" }, selFolder === "all"
            ? "Әзірге тест жоқ. «Жаңа тест» батырмасын басыңыз: сұрақтарды қолмен немесе Word файлынан қосуға болады."
            : "Мұнда тест жоқ. «Жаңа тест» батырмасын бассаңыз, тест осы жерге орналасады."));

    setView(tabs(), h("div", { class: "split" }, tree, right));
  }

  // =====================================================================
  //  СУРЕТТЕР
  // =====================================================================
  async function compressImage(blob) {
    if (!/^image\/(png|jpe?g|webp|bmp)$/i.test(blob.type)) return blob;
    try {
      const url = URL.createObjectURL(blob);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      URL.revokeObjectURL(url);
      const max = 1400;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale === 1 && blob.size < 400 * 1024) return blob;
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const out = await new Promise(res => c.toBlob(res, "image/webp", 0.88));
      return out && out.size < blob.size ? out : blob;
    } catch (_) { return blob; }
  }
  async function uploadImage(blob) {
    const b = await compressImage(blob);
    const ext = (b.type.split("/")[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg");
    const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    must(await sb.storage.from("images").upload(path, b, { contentType: b.type, upsert: false }));
    return sb.storage.from("images").getPublicUrl(path).data.publicUrl;
  }
  // HTML ішіндегі data: суреттерді жүктеп, сілтемеге ауыстыру
  async function uploadInlineImages(html, cache, onWarn) {
    if (!html || !html.includes("data:")) return html;
    const box = document.createElement("div"); box.innerHTML = html;
    for (const img of Array.from(box.querySelectorAll("img"))) {
      const src = img.getAttribute("src") || "";
      if (!src.startsWith("data:")) continue;
      if (/^data:image\/(x-)?(emf|wmf)/i.test(src)) { img.remove(); onWarn && onWarn("EMF/WMF сурет өшірілді (браузер көрсете алмайды)."); continue; }
      if (!cache[src]) {
        const blob = await (await fetch(src)).blob();
        cache[src] = await uploadImage(blob);
      }
      img.setAttribute("src", cache[src]);
    }
    return box.innerHTML;
  }

  // =====================================================================
  //  ТЕСТ РЕДАКТОРЫ
  // =====================================================================
  let lastRte = null;         // соңғы фокусталған мәтін өрісі
  let dirty = false;
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  function rte(html, onChange, ph) {
    const el = h("div", { class: "rte rich", contenteditable: "true", "data-ph": ph || "", html: clean(html || "") });
    const sync = () => { onChange(el.innerHTML); dirty = true; };
    el.addEventListener("input", sync);
    el.addEventListener("focus", () => { lastRte = el; });
    el.addEventListener("paste", async e => {
      const cd = e.clipboardData;
      if (!cd) return;
      const files = Array.from(cd.files || []).filter(f => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        for (const f of files) await insertImageFile(el, f);
        return;
      }
      const htmlData = cd.getData("text/html");
      if (htmlData) {
        e.preventDefault();
        document.execCommand("insertHTML", false, clean(htmlData));
      }
    });
    el._sync = sync;
    return el;
  }
  async function insertImageFile(el, file) {
    toast("Сурет жүктелуде...");
    try {
      const url = await uploadImage(file);
      el.focus();
      const ok = document.execCommand("insertHTML", false, `<img src="${url}" alt="">`);
      if (!ok) el.insertAdjacentHTML("beforeend", `<img src="${url}" alt="">`);
      el._sync && el._sync();
      toast("Сурет қосылды");
    } catch (ex) { toast("Сурет жүктелмеді: " + errMsg(ex), 5000); }
  }

  function editorToolbar() {
    const act = fn => h("button", { type: "button", class: "sm", onmousedown: e => e.preventDefault(), onclick: () => {
      if (!lastRte || !document.body.contains(lastRte)) { toast("Алдымен мәтін өрісін таңдаңыз"); return; }
      fn(lastRte);
    } });
    const fileIn = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: async () => {
      if (fileIn.files[0] && lastRte) await insertImageFile(lastRte, fileIn.files[0]);
      fileIn.value = "";
    } });
    const b = (label, title, fn) => { const x = act(fn); x.textContent = label; x.title = title; return x; };
    return h("div", { class: "row", style: { gap: ".3rem" } },
      h("span", { class: "small muted" }, "Мәтін:"),
      b("x₂", "Төменгі индекс (H₂O)", el => { el.focus(); document.execCommand("subscript"); el._sync(); }),
      b("x²", "Жоғарғы индекс (Fe³⁺)", el => { el.focus(); document.execCommand("superscript"); el._sync(); }),
      b("Ж", "Жуан қаріп", el => { el.focus(); document.execCommand("bold"); el._sync(); }),
      b("⚗ Формулаларды түзету", "Осы сұрақтағы барлық мәтінде: H2SO4 → H₂SO₄, SO4^2- → SO₄²⁻", el => {
        const card = el.closest(".editor-q, .ctx-card") || el;
        const fields = card.matches(".rte") ? [card] : Array.from(card.querySelectorAll(".rte"));
        fields.forEach(f => { A.chemifyNode(f); f._sync && f._sync(); });
        toast("Формулалар түзетілді");
      }),
      b("🖼 Сурет", "Сурет қосу (немесе Ctrl+V арқылы қойыңыз)", () => fileIn.click()),
      fileIn);
  }

  async function showEditor(testId, folderId) {
    loading();
    let doc;
    let attemptsCount = 0;
    try {
      if (testId) {
        doc = must(await sb.from("tests").select("*").eq("id", testId).single());
        const { count } = await sb.from("attempts").select("id", { count: "exact", head: true }).eq("test_id", testId);
        attemptsCount = count || 0;
      } else {
        doc = { id: null, title: "", description: "", published: false, show_answers: true, folder_id: folderId || null,
          max_attempts: 1, classes: [], content: { questions: [], contexts: {} } };
      }
    } catch (ex) { return setView(tabs(), h("div", { class: "notice err" }, errMsg(ex))); }
    doc.content = doc.content || {};
    doc.content.questions = doc.content.questions || [];
    doc.content.contexts = doc.content.contexts || {};
    const C = doc.content;
    dirty = false;

    const titleIn = h("input", { type: "text", value: doc.title, placeholder: "Мысалы: Бейорганикалық химия — 1-нұсқа",
      oninput: () => { doc.title = titleIn.value; dirty = true; } });
    let folders = [];
    try { folders = await loadFolders(); } catch (_) {}
    const folderSel = folderSelect(folders, doc.folder_id);
    folderSel.onchange = () => { doc.folder_id = folderSel.value || null; dirty = true; };
    let allClasses = [];
    try { allClasses = [...new Set(must(await sb.from("students").select("class_name")).map(x => (x.class_name || "").trim()).filter(Boolean))].sort(); } catch (_) {}
    doc.classes = Array.isArray(doc.classes) ? doc.classes : [];
    (doc.classes || []).forEach(c => { if (!allClasses.includes(c)) allClasses.push(c); });
    const modeSel = h("select", { style: { maxWidth: "460px", display: "block" }, onchange: () => { doc.max_attempts = Number(modeSel.value); dirty = true; } },
      h("option", { value: "1", selected: doc.max_attempts !== 0 }, "Бір рет (қайта тапсыруға сіз ғана рұқсат бересіз)"),
      h("option", { value: "0", selected: doc.max_attempts === 0 }, "Шексіз (оқушы қалағанша қайта тапсыра алады)"));
    const classBox = h("div", { class: "row", style: { gap: ".4rem .9rem", marginTop: ".35rem" } });
    function renderClasses() {
      classBox.innerHTML = "";
      const allCb = h("input", { type: "checkbox", checked: !doc.classes.length, onchange: () => { doc.classes = []; dirty = true; renderClasses(); } });
      classBox.appendChild(h("label", { class: "row small", style: { gap: ".35rem", cursor: "pointer", color: "var(--ink)" } }, allCb, "Барлық сыныптар"));
      allClasses.forEach(c => {
        const cb = h("input", { type: "checkbox", checked: doc.classes.includes(c), onchange: () => {
          doc.classes = cb.checked ? [...doc.classes, c] : doc.classes.filter(x => x !== c);
          dirty = true; renderClasses();
        } });
        classBox.appendChild(h("label", { class: "row small", style: { gap: ".35rem", cursor: "pointer", color: "var(--ink)" } }, cb, c));
      });
      if (!allClasses.length) classBox.appendChild(h("span", { class: "small muted" }, "Сыныптар оқушы аккаунттарын ашқанда пайда болады."));
    }
    renderClasses();
    const showAnsCb = h("input", { type: "checkbox", checked: doc.show_answers !== false, onchange: () => { doc.show_answers = showAnsCb.checked; dirty = true; } });
    const descIn = h("input", { type: "text", value: doc.description, placeholder: "Қысқаша сипаттама (міндетті емес)",
      oninput: () => { doc.description = descIn.value; dirty = true; } });

    const listBox = h("div", {});
    const ctxBox = h("div", {});
    const summary = h("span", { class: "small muted" });
    const saveBtn = h("button", { class: "primary", onclick: () => save() }, "Сақтау");

    function ctxName(id) {
      const i = Object.keys(C.contexts).indexOf(id);
      return i >= 0 ? `Контекст ${i + 1}` : "";
    }
    function updateSummary() {
      const total = C.questions.reduce((s, q) => s + Number(q.points || 0), 0);
      summary.textContent = `${C.questions.length} сұрақ, ${num(total)} ұпай`;
    }

    // ---- контекстер ----
    function renderContexts() {
      ctxBox.innerHTML = "";
      const ids = Object.keys(C.contexts);
      if (!ids.length) return;
      ctxBox.appendChild(h("h2", {}, "Контекстер"));
      ctxBox.appendChild(h("p", { class: "small muted" }, "Контекст — бірнеше сұраққа ортақ мәтін/кесте/сурет. Сұрақтың «Контекст» өрісінде таңдаңыз."));
      ids.forEach(id => {
        const used = C.questions.filter(q => q.context === id).length;
        ctxBox.appendChild(h("div", { class: "card ctx-card stack", style: { marginBottom: ".8rem" } },
          h("div", { class: "row between" }, h("b", {}, ctxName(id)), h("span", { class: "small muted" }, `${used} сұрақ`),
            h("button", { class: "sm danger", onclick: async () => {
              if (!(await confirmBox(`${ctxName(id)} өшірілсін бе? Сұрақтар өшпейді, тек контекстен ажырайды.`, "Өшіру", true))) return;
              delete C.contexts[id]; C.questions.forEach(q => { if (q.context === id) q.context = null; });
              dirty = true; renderAll();
            } }, "Өшіру")),
          rte(C.contexts[id], v => { C.contexts[id] = v; }, "Контекст мәтіні...")));
      });
    }

    // ---- сұрақтар ----
    function relabel(q) {
      // нұсқаларды A, B, C... деп қайта белгілеу және жауапты сәйкестендіру
      const map = {};
      q.options.forEach((o, i) => { map[o.k] = LETTERS[i]; o.k = LETTERS[i]; });
      if (q.type === "single") q.answer = map[q.answer] || "";
      else if (q.type === "multiple") q.answer = (q.answer || []).map(a => map[a]).filter(Boolean).sort();
      else if (q.type === "matching") {
        const na = {};
        q.left.forEach((L, i) => { const old = L.k; L.k = String(i + 1); if (q.answer[old] && map[q.answer[old]]) na[L.k] = map[q.answer[old]]; });
        q.answer = na;
      }
    }

    function questionEditor(q, idx) {
      const card = h("div", { class: "card editor-q stack", id: "eq" + idx });
      const typeSel = h("select", { style: { width: "auto" }, onchange: () => {
        const old = q.type; q.type = typeSel.value;
        if (q.type === "single") q.answer = old === "multiple" ? ((q.answer || [])[0] || "") : "";
        if (q.type === "multiple") q.answer = old === "single" && q.answer ? [q.answer] : [];
        if (q.type === "matching") { q.answer = {}; if (!q.left || !q.left.length) q.left = [{ k: "1", h: "" }, { k: "2", h: "" }]; }
        if (q.type !== "matching") q.left = [];
        if (q.type === "single" && old !== "single") q.points = q.context ? 1 : 1;
        if (q.type !== "single" && old === "single") q.points = 2;
        dirty = true; renderAll();
      } }, Object.entries(TYPE_LABEL).map(([k, v]) => h("option", { value: k, selected: q.type === k }, v)));
      const ptsIn = h("input", { type: "number", min: 0, step: 1, value: q.points, style: { width: "80px" },
        oninput: () => { q.points = Number(ptsIn.value || 0); dirty = true; updateSummary(); } });
      const ctxSel = h("select", { style: { width: "auto" }, onchange: () => { q.context = ctxSel.value || null; dirty = true; renderContexts(); } },
        h("option", { value: "" }, "Контекстсіз"),
        Object.keys(C.contexts).map(id => h("option", { value: id, selected: q.context === id }, ctxName(id))));
      const move = d => { const j = idx + d; if (j < 0 || j >= C.questions.length) return;
        [C.questions[idx], C.questions[j]] = [C.questions[j], C.questions[idx]]; dirty = true; renderAll();
        const el = document.getElementById("eq" + j); el && el.scrollIntoView({ block: "center" }); };

      card.appendChild(h("div", { class: "row between" },
        h("div", { class: "row" }, h("b", { class: "q-num" }, (idx + 1) + "."), typeSel,
          h("label", { class: "row small muted", style: { gap: ".3rem" } }, "Ұпай", ptsIn), ctxSel),
        h("div", { class: "row", style: { gap: ".25rem" } },
          h("button", { class: "sm ghost", title: "Жоғары", onclick: () => move(-1) }, "↑"),
          h("button", { class: "sm ghost", title: "Төмен", onclick: () => move(1) }, "↓"),
          h("button", { class: "sm ghost", title: "Көшірме", onclick: () => {
            const copy = JSON.parse(JSON.stringify(q)); copy.id = uid("q");
            C.questions.splice(idx + 1, 0, copy); dirty = true; renderAll(); } }, "⧉"),
          h("button", { class: "sm danger", title: "Өшіру", onclick: async () => {
            if (!(await confirmBox(`${idx + 1}-сұрақты өшіресіз бе?`, "Өшіру", true))) return;
            C.questions.splice(idx, 1); dirty = true; renderAll(); } }, "✕"))));

      card.appendChild(rte(q.stem, v => { q.stem = v; }, "Сұрақ мәтіні..."));

      const multi = q.type === "multiple";
      if (q.type === "matching") {
        card.appendChild(h("div", { class: "ed-section-title" }, "Сол жақ (нөмірленген) элементтер және дұрыс жауап"));
        q.left.forEach((L, i) => {
          const sel = h("select", { onchange: () => { if (sel.value) q.answer[L.k] = sel.value; else delete q.answer[L.k]; dirty = true; } },
            h("option", { value: "" }, "—"), q.options.map(o => h("option", { value: o.k, selected: q.answer[L.k] === o.k }, "→ " + o.k)));
          card.appendChild(h("div", { class: "ed-left" },
            h("span", { class: "lt" }, L.k + ")"),
            rte(L.h, v => { L.h = v; }, "Элемент..."),
            sel,
            h("button", { class: "sm ghost del", title: "Өшіру", onclick: () => { q.left.splice(i, 1); relabel(q); dirty = true; renderAll(); } }, "✕")));
        });
        card.appendChild(h("div", {}, h("button", { class: "sm", onclick: () => {
          q.left.push({ k: String(q.left.length + 1), h: "" }); dirty = true; renderAll(); } }, "+ элемент")));
        card.appendChild(h("div", { class: "ed-section-title" }, "Жауап нұсқалары (әріптер)"));
      } else {
        card.appendChild(h("div", { class: "ed-section-title" }, multi ? "Нұсқалар — барлық дұрыс жауапты белгілеңіз ☑" : "Нұсқалар — дұрыс жауапты белгілеңіз ◉"));
      }

      const radioName = uid("r");
      q.options.forEach((o, i) => {
        let mark;
        if (q.type === "single") mark = h("input", { type: "radio", name: radioName, checked: q.answer === o.k, title: "Дұрыс жауап",
          onchange: () => { q.answer = o.k; dirty = true; } });
        else if (multi) mark = h("input", { type: "checkbox", checked: (q.answer || []).includes(o.k), title: "Дұрыс жауап",
          onchange: () => { const s = new Set(q.answer || []); mark.checked ? s.add(o.k) : s.delete(o.k); q.answer = [...s].sort(); dirty = true; } });
        else mark = h("span", {});
        card.appendChild(h("div", { class: "ed-opt" }, mark, h("span", { class: "lt" }, o.k),
          rte(o.h, v => { o.h = v; }, "Нұсқа..."),
          h("button", { class: "sm ghost", title: "Өшіру", onclick: () => { q.options.splice(i, 1); relabel(q); dirty = true; renderAll(); } }, "✕")));
      });
      if (q.options.length < LETTERS.length) {
        card.appendChild(h("div", {}, h("button", { class: "sm", onclick: () => {
          q.options.push({ k: LETTERS[q.options.length], h: "" }); dirty = true; renderAll(); } }, "+ нұсқа")));
      }
      return card;
    }

    function renderList() {
      listBox.innerHTML = "";
      if (!C.questions.length) {
        listBox.appendChild(h("div", { class: "notice info" }, "Сұрақтар жоқ. Төмендегі батырмалармен қосыңыз немесе Word файлын жүктеңіз."));
      }
      let lastCtx = null;
      C.questions.forEach((q, i) => {
        if (q.context && q.context !== lastCtx) listBox.appendChild(h("div", { class: "ctx-label", style: { margin: "1rem 0 .3rem" } }, "▼ " + ctxName(q.context)));
        lastCtx = q.context || null;
        listBox.appendChild(questionEditor(q, i));
        listBox.appendChild(h("div", { style: { height: ".8rem" } }));
      });
      updateSummary();
    }
    function renderAll() { renderContexts(); renderList(); }

    const newQ = type => {
      const q = { id: uid("q"), type, context: null, stem: "", left: [], answer: type === "single" ? "" : type === "multiple" ? [] : {},
        points: type === "single" ? 1 : 2, options: [] };
      const n = type === "multiple" ? 6 : type === "matching" ? 4 : 5;
      for (let i = 0; i < n; i++) q.options.push({ k: LETTERS[i], h: "" });
      if (type === "matching") q.left = [{ k: "1", h: "" }, { k: "2", h: "" }];
      return q;
    };
    const addQ = type => { C.questions.push(newQ(type)); dirty = true; renderAll();
      const el = document.getElementById("eq" + (C.questions.length - 1)); el && el.scrollIntoView({ behavior: "smooth", block: "center" }); };
    const addCtx = () => {
      const id = uid("c"); C.contexts[id] = ""; dirty = true;
      const q = newQ("single"); q.context = id; C.questions.push(q);
      const q2 = newQ("single"); q2.context = id; C.questions.push(q2);
      renderAll(); toast("Контекст және оған 2 сұрақ қосылды");
    };

    // ---- Word импорт ----
    const wordIn = h("input", { type: "file", accept: ".docx", class: "hidden", onchange: async () => {
      const f = wordIn.files[0]; wordIn.value = "";
      if (!f) return;
      toast("Word файлы оқылуда...");
      let parsed;
      try { parsed = await window.WordImport.parseDocx(f); }
      catch (ex) { return modal(h("div", {}, h("h3", {}, "Файлды оқу мүмкін болмады"), h("p", {}, errMsg(ex)))); }
      const byType = { single: 0, multiple: 0, matching: 0 };
      parsed.questions.forEach(q => byType[q.type]++);
      const nCtx = Object.keys(parsed.contexts).length;
      const ok = await modal(h("div", { class: "stack" },
        h("h3", {}, `«${f.name}»`),
        parsed.questions.length
          ? h("p", {}, `Табылды: ${parsed.questions.length} сұрақ — бір жауапты: ${byType.single}, бірнеше жауапты: ${byType.multiple}, сәйкестендіру: ${byType.matching}; контекст: ${nCtx}.`)
          : h("div", { class: "notice err" }, "Бірде-бір сұрақ табылмады. Файл үлгіге сай жазылғанын тексеріңіз."),
        parsed.warnings.length ? h("div", { class: "notice warnings" }, h("b", {}, "Тексеру керек:"),
          h("ul", { style: { margin: ".3rem 0 0", paddingLeft: "1.2rem" } }, parsed.warnings.map(w => h("li", {}, w)))) : null,
        h("p", { class: "small muted" }, "Сұрақтар тесттің соңына қосылады. Қосқаннан кейін әр сұрақты тексеріп, «Сақтау» басыңыз.")),
        parsed.questions.length ? [{ label: "Бас тарту", value: false }, { label: `${parsed.questions.length} сұрақты қосу`, value: true, class: "primary" }] : null);
      if (!ok) return;
      Object.assign(C.contexts, parsed.contexts);
      C.questions.push(...parsed.questions);
      if (!doc.title && parsed.title) { doc.title = parsed.title; titleIn.value = parsed.title; }
      if (!doc.title) { doc.title = f.name.replace(/\.docx$/i, ""); titleIn.value = doc.title; }
      dirty = true; renderAll();
      toast("Сұрақтар қосылды. Тексеріп, «Сақтау» басыңыз.", 4500);
    } });

    // ---- сақтау ----
    async function save() {
      if (!doc.title.trim()) { toast("Тест атауын жазыңыз"); titleIn.focus(); return; }
      const problems = [];
      C.questions.forEach((q, i) => {
        const n = i + 1;
        if (!q.options.length) problems.push(`${n}-сұрақ: нұсқа жоқ`);
        if (q.type === "single" && !q.answer) problems.push(`${n}-сұрақ: дұрыс жауап белгіленбеген`);
        if (q.type === "multiple" && !(q.answer || []).length) problems.push(`${n}-сұрақ: дұрыс жауап белгіленбеген`);
        if (q.type === "matching" && q.left.some(L => !q.answer[L.k])) problems.push(`${n}-сұрақ: сәйкестік толық көрсетілмеген`);
      });
      if (problems.length) {
        const go = await modal(h("div", {}, h("h3", {}, "Назар аударыңыз"),
          h("ul", { class: "warnings" }, problems.slice(0, 30).map(p => h("li", {}, p))),
          h("p", { class: "small muted" }, "Бәрібір сақтай берсеңіз болады, бірақ бұл сұрақтар дұрыс бағаланбайды.")),
          [{ label: "Түзетемін", value: false }, { label: "Бәрібір сақтау", value: true, class: "primary" }]);
        if (!go) return;
      }
      saveBtn.disabled = true; saveBtn.textContent = "Сақталуда...";
      try {
        const cache = {}; const warns = new Set(); const w = m => warns.add(m);
        const up = s => uploadInlineImages(s, cache, w);
        for (const id of Object.keys(C.contexts)) C.contexts[id] = clean(await up(C.contexts[id]));
        for (const q of C.questions) {
          q.stem = clean(await up(q.stem));
          for (const o of q.options) o.h = clean(await up(o.h));
          for (const L of q.left || []) L.h = clean(await up(L.h));
        }
        const row = { title: doc.title.trim(), description: (doc.description || "").trim(), content: C, folder_id: doc.folder_id || null,
          show_answers: doc.show_answers !== false, max_attempts: doc.max_attempts === 0 ? 0 : 1, classes: doc.classes || [],
          updated_at: new Date().toISOString() };
        if (doc.id) must(await sb.from("tests").update(row).eq("id", doc.id));
        else {
          const ins = must(await sb.from("tests").insert({ ...row, published: false }).select("id").single());
          doc.id = ins.id;
        }
        dirty = false;
        toast(warns.size ? "Сақталды. " + [...warns].join(" ") : "Сақталды ✓", warns.size ? 6000 : 2500);
        renderAll();
      } catch (ex) { toast("Сақталмады: " + errMsg(ex), 6000); }
      saveBtn.disabled = false; saveBtn.textContent = "Сақтау";
    }

    const back = h("button", { class: "ghost sm", onclick: async () => {
      if (dirty && !(await confirmBox("Сақталмаған өзгерістер бар. Шыға берейін бе?", "Шығу", true))) return;
      dirty = false; tab = "tests"; route();
    } }, "Тесттерге оралу");

    setView(
      h("div", { class: "editor-sticky no-print" },
        h("div", { class: "row between" }, h("div", { class: "row" }, back, summary), saveBtn),
        h("div", { style: { marginTop: ".45rem" } }, editorToolbar())),
      attemptsCount ? h("div", { class: "notice", style: { marginBottom: "1rem" } },
        `Бұл тестті ${attemptsCount} оқушы тапсырған. Дұрыс жауаптарды өзгертсеңіз, олардың бұрынғы ұпайы қайта есептелмейді.`) : null,
      h("div", { class: "card stack" },
        h("label", { class: "field" }, "Тест атауы", titleIn),
        h("label", { class: "field" }, "Сипаттама", descIn),
        h("label", { class: "field" }, "Орны: бөлім, тақырып немесе тақырыпша", folderSel),
        h("label", { class: "field" }, "Неше рет тапсыруға болады", modeSel),
        h("div", { class: "field" }, "Кімге: тест тек белгіленген сыныптардың оқушыларына көрінеді", classBox),
        h("label", { class: "row small", style: { gap: ".4rem", cursor: "pointer" } }, showAnsCb, "Тапсырған соң оқушыға дұрыс және қате жауаптарын көрсету")),
      h("div", { class: "card stack", style: { marginTop: "1rem" } },
        h("b", {}, "Word файлынан сұрақтар қосу"),
        h("p", { class: "small muted", style: { margin: 0 } }, "Сұрақтарды үлгі бойынша Word-та жазып, файлды жүктеңіз. Формулалардағы индекстер (H₂SO₄), суреттер мен кестелер сақталады."),
        h("div", { class: "row" },
          h("button", { class: "primary", onclick: () => wordIn.click() }, "📄 Word (.docx) жүктеу"),
          h("a", { class: "btn", href: "suraqtar-ulgisi.docx", download: "" }, "⬇ Үлгі файлды жүктеп алу"),
          wordIn)),
      ctxBox,
      h("h2", {}, "Сұрақтар"),
      listBox,
      h("div", { class: "card row no-print", style: { marginTop: ".5rem" } },
        h("span", { class: "small muted" }, "Сұрақ қосу:"),
        h("button", { class: "sm", onclick: () => addQ("single") }, "+ Бір дұрыс жауап"),
        h("button", { class: "sm", onclick: () => addQ("multiple") }, "+ Бірнеше дұрыс жауап"),
        h("button", { class: "sm", onclick: () => addQ("matching") }, "+ Сәйкестендіру"),
        h("button", { class: "sm", onclick: addCtx }, "+ Контекстік тапсырма")),
      h("div", { class: "row", style: { justifyContent: "flex-end", marginTop: "1rem" } },
        h("button", { class: "primary big", onclick: () => save() }, "Сақтау"))
    );
    renderAll();
  }

  // =====================================================================
  //  ОҚУШЫЛАР (аккаунттар)
  // =====================================================================
  const PASS_ABC = "abcdefghjkmnpqrstuvwxyz23456789";
  const genPassword = () => {
    const a = new Uint32Array(6); crypto.getRandomValues(a);
    return Array.from(a, x => PASS_ABC[x % PASS_ABC.length]).join("");
  };
  const TR = { а:"a",ә:"a",б:"b",в:"v",г:"g",ғ:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"i",к:"k",қ:"q",л:"l",м:"m",н:"n",ң:"n",о:"o",ө:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ұ:"u",ү:"u",ф:"f",х:"h",һ:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sh",ъ:"",ы:"y",і:"i",ь:"",э:"e",ю:"yu",я:"ya" };
  const translit = t => Array.from(t.toLowerCase()).map(c => (c in TR ? TR[c] : c)).join("").replace(/[^a-z0-9]/g, "");
  // «Асанова Аружан» → asanova.a (бос болмаса asanova.a2, asanova.a3 ...)
  function suggestLogin(fullName, taken) {
    const parts = fullName.trim().split(/\s+/);
    let base = translit(parts[0] || "") + (parts[1] ? "." + translit(parts[1]).slice(0, 1) : "");
    if (base.replace(".", "").length < 3) base = (base + "student").slice(0, 8);
    let u = base, n = 2;
    while (taken.has(u)) u = base + n++;
    taken.add(u);
    return u;
  }

  // Логин/құпиясөз тізімін көрсету (басып шығару, көшіру)
  function credentialsModal(list, title) {
    const site = location.href.replace(/teacher\.html.*$/, "");
    const copy = () => {
      const text = list.map(s => `${s.full_name}\t${s.class_name || ""}\t${s.username}\t${s.password}`).join("\n");
      navigator.clipboard.writeText(text).then(() => toast("Көшірілді — Excel-ге қоюға болады"), () => toast("Көшіру мүмкін болмады"));
    };
    const print = () => {
      const area = document.getElementById("printArea");
      area.innerHTML = "";
      area.appendChild(h("div", { class: "code-cards" }, list.map(s => h("div", { class: "code-card" },
        h("div", {}, h("b", {}, s.full_name), s.class_name ? ", " + s.class_name : ""),
        h("div", { style: { marginTop: "2mm" } }, "Логин: ", h("span", { class: "mono" }, s.username)),
        h("div", {}, "Құпиясөз: ", h("span", { class: "mono" }, s.password)),
        h("div", { style: { fontSize: "9pt", marginTop: "2mm" } }, "Сайт: " + site)))));
      document.querySelector(".modal-back") && document.querySelector(".modal-back").classList.add("no-print");
      document.body.classList.add("printing-cards");
      window.addEventListener("afterprint", () => document.body.classList.remove("printing-cards"), { once: true });
      window.print();
    };
    return modal(h("div", { class: "stack" },
      h("h3", {}, title || "Аккаунттар дайын"),
      h("div", { class: "notice" }, "Құпиясөздерді қазір басып шығарыңыз немесе көшіріп алыңыз — қауіпсіздік үшін олар сайтта сақталмайды (тек шифрланған түрде). Оқушы ұмытса, «Құпиясөз беру» арқылы жаңасын бересіз."),
      h("div", { class: "table-scroll" }, h("table", { class: "list" },
        h("thead", {}, h("tr", {}, ["Аты-жөні", "Сынып", "Логин", "Құпиясөз"].map(x => h("th", {}, x)))),
        h("tbody", {}, list.map(s => h("tr", {}, h("td", {}, s.full_name), h("td", {}, s.class_name || ""),
          h("td", { class: "mono" }, h("b", {}, s.username)), h("td", { class: "mono" }, h("b", {}, s.password))))))),
      h("div", { class: "row" },
        h("button", { onclick: copy }, "Көшіру"),
        h("button", { onclick: print }, "🖨 Басып шығару")),
      h("p", { class: "small muted", style: { margin: 0 } }, "Оқушылар кіретін сайт: " + site)),
      [{ label: "Дайын", value: true, class: "primary" }]);
  }

  // Оқушының барлық әрекеттері (мұғалім үшін)
  async function studentHistory(s) {
    let attempts, tests;
    try {
      attempts = must(await sb.from("attempts").select("*").eq("student_id", s.id).order("submitted_at", { ascending: false }));
      tests = must(await sb.from("tests").select("id,title,content"));
    } catch (ex) { return toast(errMsg(ex)); }
    const byId = {}; tests.forEach(t => { byId[t.id] = t; });
    const detail = h("div", {});
    const show = a => {
      const t = byId[a.test_id] || { title: "?", content: {} };
      detail.innerHTML = "";
      detail.append(h("h3", { style: { marginTop: "1rem" } }, `${t.title} — ${num(a.score)}/${num(a.max_score)} (${pct(a.score, a.max_score)}%)`),
        renderReview({ questions: (t.content || {}).questions || [], contexts: (t.content || {}).contexts, answers: a.answers, details: a.details }));
      detail.scrollIntoView({ behavior: "smooth" });
    };
    modal(h("div", { class: "stack" },
      h("h3", {}, `${s.full_name}${s.class_name ? ", " + s.class_name : ""}`),
      attempts.length ? h("table", { class: "list" },
        h("thead", {}, h("tr", {}, ["Тест", "Ұпай", "Уақыты", ""].map(x => h("th", {}, x)))),
        h("tbody", {}, attempts.map(a => h("tr", {},
          h("td", {}, (byId[a.test_id] || {}).title || "?", a.archived ? h("div", { class: "small muted" }, "бұрынғы әрекет") : null),
          h("td", { class: "mono" }, `${num(a.score)}/${num(a.max_score)}, ${pct(a.score, a.max_score)}%`),
          h("td", { class: "small muted" }, fmtDate(a.submitted_at)),
          h("td", {}, h("button", { class: "sm", onclick: () => show(a) }, "Қарау"))))))
        : h("p", { class: "muted" }, "Бұл оқушы әлі тест тапсырмаған."),
      detail));
  }

  let classFilter = "";
  async function showStudents() {
    loading();
    let students, counts = {};
    try {
      students = must(await sb.from("students").select("id,full_name,class_name,username,created_at").order("class_name").order("full_name"));
      must(await sb.from("attempts").select("student_id")).forEach(a => { counts[a.student_id] = (counts[a.student_id] || 0) + 1; });
    } catch (ex) { return setView(tabs(), h("div", { class: "notice err" }, errMsg(ex))); }

    const taken = () => new Set(students.map(s => (s.username || "").toLowerCase()));
    const classes = [...new Set(students.map(s => s.class_name).filter(Boolean))].sort();
    if (classFilter && !classes.includes(classFilter)) classFilter = "";
    const shown = students.filter(s => !classFilter || s.class_name === classFilter);

    async function create(list) {
      const t = taken();
      list.forEach(s => {
        s.username = (s.username || "").trim().toLowerCase() || suggestLogin(s.full_name, t);
        t.add(s.username);
        s.password = (s.password || "").trim() || genPassword();
      });
      must(await sb.rpc("teacher_create_students", { p_list: list }));
      await credentialsModal(list, `${list.length} аккаунт ашылды`);
      showStudents();
    }

    const nameIn = h("input", { type: "text", placeholder: "Аты-жөні, мыс. Асанова Аружан" });
    const classIn = h("input", { type: "text", placeholder: "Сынып, мыс. 11А", list: "classList" });
    const userIn = h("input", { type: "text", placeholder: "Логин (бос қалса — автоматты)", autocapitalize: "none" });
    const passIn = h("input", { type: "text", placeholder: "Құпиясөз (бос қалса — автоматты)", autocomplete: "off" });
    const bulk = h("textarea", { rows: 6, placeholder: "Әр жолға бір оқушы:\nАсанова Аружан, 11А\nБекұлы Нұрсұлтан, 11А\nСерікова Дана, 11Б, dana11, d4n4pass" });

    async function addOne(e) {
      e.preventDefault();
      if (!nameIn.value.trim()) { nameIn.focus(); return; }
      try { await create([{ full_name: nameIn.value.trim(), class_name: classIn.value.trim(), username: userIn.value, password: passIn.value }]); }
      catch (ex) { toast(errMsg(ex), 5000); }
    }
    async function addBulk() {
      const list = bulk.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
        const p = l.split(/\t|;|,/).map(x => x.trim());
        return { full_name: p[0], class_name: p[1] || "", username: p[2] || "", password: p[3] || "" };
      }).filter(s => s.full_name);
      if (!list.length) { toast("Тізім бос"); return; }
      try { await create(list); } catch (ex) { toast(errMsg(ex), 6000); }
    }
    async function edit(s) {
      const n = h("input", { type: "text", value: s.full_name });
      const c = h("input", { type: "text", value: s.class_name });
      const u = h("input", { type: "text", value: s.username || "", autocapitalize: "none" });
      const ok = await modal(h("div", { class: "stack" }, h("h3", {}, "Оқушыны өзгерту"),
        h("label", { class: "field" }, "Аты-жөні", n), h("label", { class: "field" }, "Сынып", c), h("label", { class: "field" }, "Логин", u)),
        [{ label: "Бас тарту", value: false }, { label: "Сақтау", value: true, class: "primary" }]);
      if (!ok) return;
      const login = u.value.trim().toLowerCase();
      if (!/^\S{3,40}$/.test(login)) return toast("Логин 3–40 таңбадан тұруы керек, бос орынсыз.", 4000);
      try { must(await sb.from("students").update({ full_name: n.value.trim(), class_name: c.value.trim(), username: login }).eq("id", s.id)); toast("Сақталды"); showStudents(); }
      catch (ex) { toast(errMsg(ex), 5000); }
    }
    async function setPassword(s) {
      const p = h("input", { type: "text", value: genPassword(), autocomplete: "off" });
      const ok = await modal(h("div", { class: "stack" }, h("h3", {}, `${s.full_name} — жаңа құпиясөз`),
        h("label", { class: "field" }, "Құпиясөз (өзгертуге болады, кемінде 4 таңба)", p),
        h("p", { class: "small muted", style: { margin: 0 } }, "Ескі құпиясөз жұмыс істемей қалады, оқушы барлық құрылғылардан шығып кетеді. Тапсырған тесттері сақталады.")),
        [{ label: "Бас тарту", value: false }, { label: "Құпиясөз беру", value: true, class: "primary" }]);
      if (!ok) return;
      try {
        must(await sb.rpc("teacher_set_password", { p_student_id: s.id, p_password: p.value.trim() }));
        await credentialsModal([{ full_name: s.full_name, class_name: s.class_name, username: s.username, password: p.value.trim() }], "Жаңа құпиясөз берілді");
      } catch (ex) { toast(errMsg(ex), 5000); }
    }
    async function remove(s) {
      if (!(await confirmBox(`${s.full_name} аккаунты өшірілсін бе? Оның барлық нәтижелері де өшеді.`, "Өшіру", true))) return;
      try { must(await sb.from("students").delete().eq("id", s.id)); toast("Өшірілді"); showStudents(); }
      catch (ex) { toast(errMsg(ex)); }
    }
    function copyList() {
      const text = shown.map(s => `${s.full_name}\t${s.class_name}\t${s.username || ""}`).join("\n");
      navigator.clipboard.writeText(text).then(() => toast("Тізім көшірілді"), () => toast("Көшіру мүмкін болмады"));
    }

    const filterSel = h("select", { style: { width: "auto" }, onchange: () => { classFilter = filterSel.value; showStudents(); } },
      h("option", { value: "" }, "Барлық сыныптар"), classes.map(c => h("option", { value: c, selected: c === classFilter }, c)));

    setView(tabs(),
      h("h1", {}, "Оқушылар"),
      h("p", { class: "muted" }, "Әр оқушыға жеке аккаунт (логин + құпиясөз) ашасыз. Оқушының тапсырған барлық тесттері оның аккаунтында сақталады."),
      h("datalist", { id: "classList" }, classes.map(c => h("option", { value: c }))),
      h("div", { class: "grid no-print", style: { gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" } },
        h("form", { class: "card stack", onsubmit: addOne }, h("b", {}, "Бір аккаунт ашу"),
          nameIn, classIn, userIn, passIn, h("button", { class: "primary", type: "submit" }, "Аккаунт ашу")),
        h("div", { class: "card stack" }, h("b", {}, "Тізіммен ашу"),
          h("p", { class: "small muted", style: { margin: 0 } }, "Әр жолға: Аты-жөні, Сынып. Логин мен құпиясөзді де жазуға болады — жазбасаңыз, автоматты жасалады."),
          bulk, h("button", { class: "primary", onclick: addBulk }, "Аккаунттар ашу"))),
      h("div", { class: "row between no-print", style: { margin: "1.5rem 0 .7rem" } },
        h("div", { class: "row" }, filterSel, h("span", { class: "small muted" }, `${shown.length} оқушы`)),
        h("button", { class: "sm", onclick: copyList, disabled: !shown.length }, "Тізімді көшіру")),
      shown.length ? h("div", { class: "table-scroll no-print" }, h("table", { class: "list" },
        h("thead", {}, h("tr", {}, ["№", "Аты-жөні", "Сынып", "Логин", "Тапсырған", ""].map(x => h("th", {}, x)))),
        h("tbody", {}, shown.map((s, i) => h("tr", {},
          h("td", { class: "muted" }, i + 1), h("td", {}, s.full_name), h("td", {}, s.class_name),
          h("td", { class: "mono" }, s.username || h("span", { class: "badge warn" }, "логин жоқ")),
          h("td", {}, counts[s.id] ? h("button", { class: "sm ghost", onclick: () => studentHistory(s) }, `${counts[s.id]} тест →`) : h("span", { class: "small muted" }, "—")),
          h("td", { style: { whiteSpace: "nowrap", textAlign: "right" } },
            h("button", { class: "sm ghost", onclick: () => setPassword(s) }, "Құпиясөз беру"),
            h("button", { class: "sm ghost", onclick: () => edit(s) }, "Өзгерту"),
            h("button", { class: "sm ghost danger", onclick: () => remove(s) }, "Өшіру")))))))
        : h("div", { class: "notice info" }, "Әзірге аккаунт жоқ."));
  }

  // =====================================================================
  //  НӘТИЖЕЛЕР
  // =====================================================================
  let resClass = "";
  async function showResults(preselect) {
    loading();
    let tests, students;
    try {
      tests = must(await sb.from("tests").select("id,title,content,created_at,classes,max_attempts").order("created_at", { ascending: false }));
      students = must(await sb.from("students").select("id,full_name,class_name").order("class_name").order("full_name"));
    } catch (ex) { return setView(tabs(), h("div", { class: "notice err" }, errMsg(ex))); }
    if (!tests.length) return setView(tabs(), h("h1", {}, "Нәтижелер"), h("div", { class: "notice info" }, "Әзірге тест жоқ."));

    const testSel = h("select", { style: { width: "auto", maxWidth: "100%" } }, tests.map(t => h("option", { value: t.id, selected: t.id === preselect }, t.title)));
    const classes = [...new Set(students.map(s => s.class_name).filter(Boolean))].sort();
    const classSel = h("select", { style: { width: "auto" } }, h("option", { value: "" }, "Барлық сыныптар"),
      classes.map(c => h("option", { value: c, selected: c === resClass }, c)));
    const out = h("div", {});
    testSel.onchange = load; classSel.onchange = () => { resClass = classSel.value; load(); };

    async function load() {
      out.innerHTML = ""; out.appendChild(h("span", { class: "spinner" }));
      const test = tests.find(t => t.id === testSel.value);
      let attempts;
      try { attempts = must(await sb.from("attempts").select("*").eq("test_id", test.id)); }
      catch (ex) { out.innerHTML = ""; return out.appendChild(h("div", { class: "notice err" }, errMsg(ex))); }
      const byStudent = {}, older = {};
      attempts.forEach(a => { if (a.archived) older[a.student_id] = (older[a.student_id] || 0) + 1; else byStudent[a.student_id] = a; });
      const assigned = (test.classes || []).map(c => c.trim().toUpperCase());
      const list = students.filter(s => (!resClass || s.class_name === resClass) &&
        (!assigned.length || assigned.includes((s.class_name || "").trim().toUpperCase()) || byStudent[s.id] || older[s.id]));
      const done = list.filter(s => byStudent[s.id]);
      const avg = done.length ? Math.round(done.reduce((acc, s) => acc + pct(byStudent[s.id].score, byStudent[s.id].max_score), 0) / done.length) : 0;
      const qs = (test.content && test.content.questions) || [];

      const view = s => {
        const a = byStudent[s.id];
        const box = h("div", {},
          h("h3", {}, `${s.full_name}${s.class_name ? ", " + s.class_name : ""}`),
          h("p", { class: "muted" }, `${test.title} — ${num(a.score)} / ${num(a.max_score)} (${pct(a.score, a.max_score)}%), ${fmtDate(a.submitted_at)}`),
          renderReview({ questions: qs, contexts: test.content.contexts, answers: a.answers, details: a.details }));
        modal(box);
      };
      const allowRetake = async s => {
        if (!(await confirmBox(`${s.full_name} бұл тестті қайта тапсыра алады. Қазіргі нәтижесі өшпейді — оқушының тарихында «бұрынғы әрекет» болып сақталады. Келісесіз бе?`, "Иә, рұқсат беру"))) return;
        try { must(await sb.from("attempts").update({ archived: true }).eq("id", byStudent[s.id].id)); toast("Рұқсат берілді"); load(); }
        catch (ex) { toast(errMsg(ex)); }
      };
      const exportCsv = () => {
        const sep = ";";
        const escCsv = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
        const head = ["Аты-жөні", "Сынып", "Ұпай", "Максимум", "%", "Уақыты", ...qs.map((_, i) => `С${i + 1}`)];
        const lines = [head.map(escCsv).join(sep)];
        list.forEach(s => {
          const a = byStudent[s.id];
          const det = {}; (a ? a.details : []).forEach(d => { det[d.id] = d.earned; });
          lines.push([s.full_name, s.class_name, a ? num(a.score) : "", a ? num(a.max_score) : "", a ? pct(a.score, a.max_score) : "",
            a ? fmtDate(a.submitted_at) : "тапсырмаған", ...qs.map(q => (a ? (det[q.id] ?? "") : ""))].map(escCsv).join(sep));
        });
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = h("a", { href: url, download: `${test.title.replace(/[\\/:*?"<>|]/g, "_")}${resClass ? "_" + resClass : ""}.csv` });
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      };

      // Сұрақтар бойынша талдау
      const qStats = qs.map(q => {
        let earned = 0, max = 0;
        done.forEach(s => { const d = (byStudent[s.id].details || []).find(x => x.id === q.id); if (d) { earned += Number(d.earned); max += Number(d.points); } });
        return max ? Math.round((earned / max) * 100) : null;
      });
      const statBar = p => h("div", { class: "progress", style: { minWidth: "80px" } }, h("div", { style: { width: (p || 0) + "%", background: p < 40 ? "var(--bad)" : p < 70 ? "var(--warn)" : "var(--ok)" } }));
      const plain = html => { const d = document.createElement("div"); d.innerHTML = clean(html); const t = d.textContent.trim(); return t.length > 70 ? t.slice(0, 70) + "…" : t; };

      out.innerHTML = "";
      out.append(
        h("div", { class: "grid", style: { gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: "1rem" } },
          h("div", { class: "card" }, h("div", { class: "small muted" }, "Тапсырғандар"), h("div", { class: "score-big", style: { fontSize: "1.8rem" } }, `${done.length}/${list.length}`)),
          h("div", { class: "card" }, h("div", { class: "small muted" }, "Орташа нәтиже"), h("div", { class: "score-big", style: { fontSize: "1.8rem" } }, `${avg}%`))),
        h("div", { class: "row between", style: { marginBottom: ".6rem" } }, h("h2", { style: { margin: 0 } }, "Оқушылар"),
          h("button", { class: "sm", onclick: exportCsv }, "⬇ Excel (CSV) жүктеу")),
        list.length ? h("div", { class: "table-scroll" }, h("table", { class: "list" },
          h("thead", {}, h("tr", {}, ["Аты-жөні", "Сынып", "Ұпай", "%", "Уақыты", ""].map(x => h("th", {}, x)))),
          h("tbody", {}, list.map(s => {
            const a = byStudent[s.id];
            return h("tr", {},
              h("td", {}, s.full_name), h("td", {}, s.class_name),
              h("td", { class: "mono" }, a ? `${num(a.score)}/${num(a.max_score)}` : h("span", { class: "badge " + (older[s.id] ? "warn" : "gray") }, older[s.id] ? "қайта тапсыруда" : "тапсырмаған"),
                older[s.id] ? h("div", { class: "small muted" }, `+${older[s.id]} бұрынғы`) : null),
              h("td", {}, a ? `${pct(a.score, a.max_score)}%` : ""),
              h("td", { class: "small muted" }, a ? fmtDate(a.submitted_at) : ""),
              h("td", { style: { whiteSpace: "nowrap", textAlign: "right" } },
                a ? h("button", { class: "sm ghost", onclick: () => view(s) }, "Қарау") : null,
                a ? h("button", { class: "sm ghost", onclick: () => allowRetake(s) }, "Қайта тапсыру") : null,
                (a || older[s.id]) ? h("button", { class: "sm ghost", onclick: () => studentHistory(s) }, "Тарихы") : null));
          })))) : h("div", { class: "notice info" }, "Бұл сыныпта оқушы жоқ."),
        done.length && qs.length ? h("h2", {}, "Сұрақтар бойынша талдау") : null,
        done.length && qs.length ? h("div", { class: "table-scroll" }, h("table", { class: "list" },
          h("thead", {}, h("tr", {}, ["№", "Түрі", "Сұрақ", "Орындалуы"].map(x => h("th", {}, x)))),
          h("tbody", {}, qs.map((q, i) => h("tr", {},
            h("td", { class: "mono" }, i + 1), h("td", { class: "small" }, TYPE_LABEL[q.type]),
            h("td", { class: "small" }, plain(q.stem)),
            h("td", {}, h("div", { class: "row", style: { flexWrap: "nowrap" } }, statBar(qStats[i]), h("span", { class: "small mono" }, qStats[i] == null ? "—" : qStats[i] + "%")))))))) : null
      );
    }

    setView(tabs(), h("h1", {}, "Нәтижелер"),
      h("div", { class: "row", style: { marginBottom: "1rem" } }, testSel, classSel), out);
    load();
  }

  // =====================================================================
  //  ІСКЕ ҚОСУ
  // =====================================================================
  (async function init() {
    if (!configured || !sb) {
      return setView(h("div", { class: "narrow notice err" }, "Сайт әлі бапталмаған: config.js файлына Supabase деректерін енгізіңіз."));
    }
    try {
      const { data } = await sb.auth.getSession();
      if (data.session) return await afterLogin();
    } catch (_) {}
    showLogin();
  })();
})();
