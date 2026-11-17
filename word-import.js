/* Word (.docx) файлынан сұрақтарды оқу.
   Үлгі:
     1. Сұрақ мәтіні
     A) нұсқа
     B) нұсқа
     Жауап: B

   [Бірнеше] / [Сәйкестендіру] белгілері міндетті емес — түрі жауаптан анықталады:
     Жауап: B            → бір дұрыс жауап
     Жауап: A, C, E      → бірнеше дұрыс жауап
     Жауап: 1-B, 2-A     → сәйкестендіру (сол жақ элементтер 1) 2) ... деп жазылады)
   КОНТЕКСТ ... КОНТЕКСТ СОҢЫ — арасындағы сұрақтарға ортақ мәтін.
   Ұпай: 2 — сұраққа ұпайды өзгерту (міндетті емес).
   # белгісімен басталатын жолдар — түсініктеме, ескерілмейді. */
(function () {
  "use strict";

  const CYR = { "А": "A", "В": "B", "С": "C", "Д": "D", "Е": "E", "Ф": "F", "Г": "G", "Н": "H",
    "а": "A", "в": "B", "с": "C", "д": "D", "е": "E", "ф": "F", "г": "G", "н": "H" };
  const normLetter = ch => {
    if (!ch) return "";
    if (CYR[ch]) return CYR[ch];
    const u = ch.toUpperCase();
    return /^[A-H]$/.test(u) ? u : "";
  };

  const RX = {
    answer: /^\s*(жауабы|жауап|ответ|дұрыс жауап)\s*[:：.\-–—]?\s*(.*)$/i,
    points: /^\s*(ұпай|балл|ұпайы)\s*[:：\-–—]?\s*(\d+(?:[.,]\d+)?)\s*$/i,
    ctxEnd: /^\s*#?\s*КОНТЕКСТ\s*(СОҢЫ|АЯҒЫ|КОНЕЦ)(?=$|[\s.:!])/i,
    ctx: /^\s*#?\s*КОНТЕКСТ(?=$|[\s:：.\-–—\d])\s*\d*\s*[:：.\-–—]?\s*/i,
    title: /^\s*#?\s*ТЕСТ\s*(АТАУЫ)?\s*[:：]\s*(.+)$/i,
    comment: /^\s*#/,
    qStart: /^\s*\d{1,3}\s*[.)]\s*\S/,
    qNum: /^\s*\d{1,3}\s*[.)]\s*/,
    option: /^\s*([A-Ha-hА-ЕаеВвСсДдФфГгНн])\s*[).]\s*/,
    left: /^\s*(\d{1,2})\s*[).]\s*/,
    tag: /^\s*\[([^\]]+)\]\s*/
  };

  const uid = p => p + Math.random().toString(36).slice(2, 9);

  // HTML-ді «жолдарға» бөлу
  function toLines(html) {
    const root = document.createElement("div");
    root.innerHTML = html;
    const lines = [];
    const push = (el, isLi) => {
      const text = (el.textContent || "").replace(/ /g, " ").trim();
      const hasMedia = !!el.querySelector && !!el.querySelector("img, table");
      if (!text && !hasMedia && el.tagName !== "IMG" && el.tagName !== "TABLE") return;
      lines.push({
        html: el.tagName === "TABLE" || el.tagName === "IMG" ? el.outerHTML : el.innerHTML,
        text, isLi: !!isLi, block: el.tagName === "TABLE" || el.tagName === "IMG"
      });
    };
    const walk = node => {
      for (const el of Array.from(node.children)) {
        const tag = el.tagName;
        if (tag === "OL" || tag === "UL") {
          for (const li of Array.from(el.children)) {
            const nested = Array.from(li.querySelectorAll(":scope > ol, :scope > ul"));
            nested.forEach(n => n.remove());
            push(li, true);
            nested.forEach(walk);
          }
        } else if (tag === "TABLE" || tag === "IMG") push(el);
        else if (tag === "DIV") walk(el);
        else push(el);
      }
    };
    walk(root);
    return lines;
  }

  // HTML басындағы префиксті (мысалы "1. " немесе "A) ") алып тастау.
  // Префикс бірнеше тегке бөлінсе де ("<b>1</b>. мәтін") дұрыс жұмыс істейді.
  function stripPrefix(html, rx) {
    const box = document.createElement("div");
    box.innerHTML = html;
    const m = (box.textContent || "").match(rx);
    if (m && m.index === 0) {
      let count = m[0].length;
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      while (count > 0 && walker.nextNode()) {
        const n = walker.currentNode;
        const take = Math.min(count, n.nodeValue.length);
        n.nodeValue = n.nodeValue.slice(take);
        count -= take;
      }
    }
    return box.innerHTML.replace(/^(\s|&nbsp;|<br\s*\/?>)+/i, "");
  }

  function parseAnswer(raw) {
    const t = (raw || "").replace(/ /g, " ").trim();
    const pairs = {};
    const pairRx = /(\d{1,2})\s*[-–—:→>=)]*\s*([A-Ha-hА-ЕаеВвСсДдФфГгНн])(?![A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүІі])/g;
    let m, pairCount = 0;
    if (/\d/.test(t)) {
      while ((m = pairRx.exec(t))) { const L = normLetter(m[2]); if (L) { pairs[m[1]] = L; pairCount++; } }
    }
    if (pairCount) return { kind: "pairs", pairs };
    const letters = [];
    for (const tok of t.split(/[\s,;/+]+|және/)) {
      const tt = tok.replace(/[).]/g, "").trim();
      if (tt.length === 1) { const L = normLetter(tt); if (L && !letters.includes(L)) letters.push(L); }
      else if (/^[A-Ha-h]{2,8}$/.test(tt)) {           // "ACE" түрінде жазылса
        for (const ch of tt) { const L = normLetter(ch); if (L && !letters.includes(L)) letters.push(L); }
      }
    }
    return { kind: "letters", letters: letters.sort() };
  }

  function buildQuestion(block, ctxId, warnings, qIndex) {
    const lines = block.lines;
    const q = { id: uid("q"), type: "single", context: ctxId || null, stem: "", options: [], left: [], answer: "", points: 1 };
    let tagType = null;
    let stemParts = [];
    let first = lines[0];
    let stemHtml = stripPrefix(first.html, RX.qNum);
    // [Бірнеше] / [Сәйкестендіру] белгісі
    const tmp = document.createElement("div"); tmp.innerHTML = stemHtml;
    const tm = tmp.textContent.match(RX.tag);
    if (tm) {
      const tg = tm[1].toLowerCase();
      if (/сәйкес|соответ|match/.test(tg)) tagType = "matching";
      else if (/бірнеше|көп|несколько|multi/.test(tg)) tagType = "multiple";
      else if (/бір|один|single/.test(tg)) tagType = "single";
      stemHtml = stripPrefix(stemHtml, RX.tag);
    }
    stemParts.push(stemHtml);

    let implicitIdx = 0;
    for (let i = 1; i < lines.length; i++) {
      const ln = lines[i];
      const om = !ln.block && ln.text.match(RX.option);
      const lm = !ln.block && ln.text.match(RX.left);
      if (om && normLetter(om[1])) {
        q.options.push({ k: normLetter(om[1]), h: stripPrefix(ln.html, RX.option) });
      } else if (lm) {
        q.left.push({ k: lm[1], h: stripPrefix(ln.html, RX.left) });
      } else if (ln.isLi && !ln.block) {
        // Word автонөмірлеуі: әріп жоғалады — ретімен қоямыз
        const k = window.App.LETTERS[q.options.length] || String(q.options.length + 1);
        q.options.push({ k, h: ln.html });
        implicitIdx++;
      } else if (q.options.length) {
        q.options[q.options.length - 1].h += "<br>" + ln.html;
      } else if (q.left.length) {
        q.left[q.left.length - 1].h += "<br>" + ln.html;
      } else {
        stemParts.push(ln.html);
      }
    }
    q.stem = stemParts.map(s => (/^\s*<(table|img|p)/i.test(s) ? s : "<p>" + s + "</p>")).join("");

    const ans = parseAnswer(block.answer);
    if (tagType === "matching" || ans.kind === "pairs" || q.left.length) {
      q.type = "matching";
      q.answer = ans.kind === "pairs" ? ans.pairs : {};
      q.points = 2;
    } else if (tagType === "multiple" || (ans.letters && ans.letters.length > 1)) {
      q.type = "multiple";
      q.answer = ans.letters || [];
      q.points = 2;
    } else {
      q.type = "single";
      q.answer = (ans.letters && ans.letters[0]) || "";
      q.points = 1;
    }
    if (block.points != null) q.points = block.points;

    const label = `${qIndex}-сұрақ`;
    const keys = new Set(q.options.map(o => o.k));
    if (!q.options.length) warnings.push(`${label}: жауап нұсқалары табылмады.`);
    if (implicitIdx) warnings.push(`${label}: нұсқалар Word автонөмірлеуімен жазылған — әріптер ретімен қойылды, тексеріңіз.`);
    if (block.answer == null) warnings.push(`${label}: «Жауап:» жолы жоқ — дұрыс жауапты редакторда белгілеңіз.`);
    else if (q.type === "matching") {
      if (!q.left.length) warnings.push(`${label}: сәйкестендіру элементтері (1), 2) ...) табылмады.`);
      for (const L of q.left) {
        if (!q.answer[L.k]) warnings.push(`${label}: ${L.k}) үшін жауап көрсетілмеген.`);
        else if (!keys.has(q.answer[L.k])) warnings.push(`${label}: ${L.k}-${q.answer[L.k]} — мұндай нұсқа жоқ.`);
      }
    } else {
      const arr = q.type === "multiple" ? q.answer : [q.answer];
      if (!arr.length || !arr[0]) warnings.push(`${label}: жауап танылмады («${block.answer}»).`);
      arr.filter(Boolean).forEach(a => { if (!keys.has(a)) warnings.push(`${label}: «${a}» деген нұсқа жоқ.`); });
    }
    return q;
  }

  function parseHtml(html) {
    const lines = toLines(html);
    const out = { title: "", questions: [], contexts: {}, warnings: [] };
    let ctxId = null, ctxCollecting = false;
    let block = null;
    const flush = (answerText) => {
      if (!block || !block.lines.length) { block = null; return; }
      block.answer = answerText;
      out.questions.push(buildQuestion(block, block.ctx, out.warnings, out.questions.length + 1));
      block = null;
    };

    for (const ln of lines) {
      const t = ln.text;
      if (!ln.block) {
        const tm = t.match(RX.title);
        if (tm && !block) { out.title = tm[2].trim(); continue; }
        if (RX.ctxEnd.test(t)) { if (block) flush(null); ctxId = null; ctxCollecting = false; continue; }
        if (RX.ctx.test(t)) {
          if (block) flush(null);
          ctxId = uid("c"); ctxCollecting = true;
          const rest = stripPrefix(ln.html, RX.ctx);
          out.contexts[ctxId] = rest.trim() ? "<p>" + rest + "</p>" : "";
          continue;
        }
        if (RX.comment.test(t)) continue;
        const pm = t.match(RX.points);
        if (pm) {
          const v = Number(pm[2].replace(",", "."));
          if (block) block.points = v;
          else if (out.questions.length) out.questions[out.questions.length - 1].points = v;
          continue;
        }
        const am = t.match(RX.answer);
        if (am) {
          if (!block) { out.warnings.push(`«${t}» — сұрақсыз жауап жолы, өткізілді.`); continue; }
          flush(am[2]);
          continue;
        }
      }
      if (ctxCollecting) {
        if (!ln.block && RX.qStart.test(t)) {
          ctxCollecting = false;
        } else {
          const piece = ln.block || /^\s*<(table|img)/i.test(ln.html) ? ln.html : "<p>" + ln.html + "</p>";
          out.contexts[ctxId] += piece;
          continue;
        }
      }
      if (!block) block = { lines: [], ctx: ctxId, points: null };
      block.lines.push(ln);
    }
    if (block) flush(null);
    for (const [id, html] of Object.entries(out.contexts)) {
      if (!out.questions.some(q => q.context === id)) {
        out.warnings.push("Контекстке ешқандай сұрақ тиесілі емес — ол өткізілді.");
        delete out.contexts[id];
      } else if (!html.trim()) out.warnings.push("Бос контекст табылды.");
    }
    return out;
  }

  async function parseDocx(file) {
    if (!window.mammoth) throw new Error("Word оқитын кітапхана жүктелмеді. Интернетті тексеріп, бетті жаңартыңыз.");
    const buf = await file.arrayBuffer();
    const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
    const parsed = parseHtml(res.value);
    const unsupported = /image\/(x-)?(emf|wmf)/i.test(res.value);
    if (unsupported) parsed.warnings.unshift("Файлда EMF/WMF суреттері бар (ескі формула редакторы). Олар браузерде көрінбейді — формулаларды мәтінмен (H₂O) жазыңыз.");
    return parsed;
  }

  window.WordImport = { parseHtml, parseDocx, parseAnswer, toLines };
})();
