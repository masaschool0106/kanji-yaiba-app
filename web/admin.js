/* ===============================================================
   漢字の刃｜先生の管理画面（出席番号 32 ＋ 先生の Google アカウントのときだけ app.js が読み込む）
   ・児童一覧／ポイントの記録（PointLog）／ログインの記録（LoginLog）／カードの承認（CardRequests）／カード一覧・編集／説明書（「説明書」シート）
   ・カードの型：承認や画像の差しかえのとき、子どもの絵を型（assets/frames）に当てはめて、この画面でカードの画像を作る
   ・データはすべて GAS（google.script.run）から受け取る。先生かどうかはサーバーが毎回確かめる
   =============================================================== */
(function () {
  'use strict';
  let app = null, root = null, students = [], tab = 'students', filterId = '';

  const CSS = `
  body.view-admin { padding: 16px 14px 60px; }
  #view-admin .container { max-width: 1100px; margin: 0 auto; }
  .adm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 16px 20px; margin-bottom: 14px; }
  .adm-title { font-size: 22px; font-weight: 900; color: #f8fafc; }
  .adm-sub { font-size: 12px; color: #94a3b8; }
  .adm-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .adm-tab { font: inherit; font-size: 15px; font-weight: 800; padding: 10px 16px; border-radius: 999px; cursor: pointer; color: #e2e8f0; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.35); }
  .adm-tab.active { background: linear-gradient(135deg, #0ea5e9, #7c3aed); border-color: transparent; color: #fff; }
  .adm-tab:disabled { opacity: 0.45; cursor: default; }
  .adm-panel { padding: 16px; }
  .adm-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; color: #e2e8f0; font-size: 14px; }
  .adm-tools select, .adm-tools button { font: inherit; font-size: 14px; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.35); background: #0f172a; color: #e2e8f0; }
  .adm-tools button { cursor: pointer; font-weight: 800; }
  .adm-wrap { overflow-x: auto; max-height: 62vh; overflow-y: auto; border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.2); }
  .adm-table { width: 100%; border-collapse: collapse; font-size: 14px; color: #e2e8f0; }
  .adm-table th { position: sticky; top: 0; background: #0b1224; text-align: left; padding: 8px 10px; font-size: 12px; color: #94a3b8; white-space: nowrap; }
  .adm-table td { padding: 8px 10px; border-top: 1px solid rgba(148, 163, 184, 0.15); white-space: nowrap; }
  .adm-table td.wrap { white-space: normal; min-width: 200px; }
  .adm-table tr.click { cursor: pointer; }
  .adm-table tr.click:hover td { background: rgba(56, 189, 248, 0.1); }
  .adm-plus { color: #4ade80; font-weight: 900; } .adm-minus { color: #f87171; font-weight: 900; }
  .adm-tag { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: rgba(148, 163, 184, 0.25); }
  .adm-empty { padding: 24px; text-align: center; color: #94a3b8; }
  .adm-ok { color: #4ade80; } .adm-ng { color: #f87171; }
  .adm-cards { display: grid; gap: 12px; }
  .adm-card { display: grid; grid-template-columns: 150px 1fr; gap: 14px; padding: 12px; border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(2, 6, 23, 0.5); color: #e2e8f0; }
  .adm-card img { width: 150px; aspect-ratio: 600 / 849; object-fit: cover; border-radius: 10px; cursor: zoom-in; background: #0b1224; }
  .adm-card img.big { position: fixed; inset: 0; margin: auto; width: auto; height: 92vh; max-width: 96vw; z-index: 20000; cursor: zoom-out; box-shadow: 0 0 0 100vmax rgba(2, 6, 23, 0.85); }
  .adm-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px 10px; }
  .adm-form label { font-size: 12px; color: #94a3b8; display: block; }
  .adm-form input, .adm-form select { width: 100%; font: inherit; font-size: 14px; padding: 7px 9px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.35); background: #0f172a; color: #e2e8f0; }
  .adm-acts { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .adm-acts button { font: inherit; font-size: 14px; font-weight: 900; padding: 9px 16px; border-radius: 999px; cursor: pointer; border: none; color: #fff; }
  .adm-yes { background: linear-gradient(135deg, #10b981, #059669); } .adm-no { background: #64748b; }
  .adm-acts button:disabled { opacity: 0.5; cursor: default; }
  .adm-note { font-size: 13px; line-height: 1.6; color: #cbd5e1; margin-bottom: 10px; }
  .adm-dl a { color: #7dd3fc; font-weight: 800; margin-right: 12px; }
  .adm-toc { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .adm-toc button { font: inherit; font-size: 13px; font-weight: 700; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(56, 189, 248, 0.35); background: #0f172a; color: #e2e8f0; cursor: pointer; }
  .adm-md { color: #e2e8f0; font-size: 15px; line-height: 1.75; max-height: 68vh; overflow-y: auto; padding-right: 6px; }
  .adm-md h1 { font-size: 22px; margin: 4px 0 12px; color: #f8fafc; }
  .adm-md h2 { font-size: 19px; margin: 26px 0 10px; padding: 6px 12px; border-left: 4px solid #38bdf8; background: rgba(56, 189, 248, 0.08); border-radius: 6px; color: #f8fafc; }
  .adm-md h3 { font-size: 16px; margin: 18px 0 8px; color: #7dd3fc; }
  .adm-md h4 { font-size: 15px; margin: 14px 0 6px; color: #cbd5e1; }
  .adm-md p { margin: 8px 0; }
  .adm-md ul { list-style: none; padding: 0; margin: 8px 0; }
  .adm-md li { display: flex; gap: 0.45em; margin: 3px 0; }
  .adm-md li.lv1 { margin-left: 1.5em; } .adm-md li.lv2 { margin-left: 3em; } .adm-md li.lv3 { margin-left: 4.5em; }
  .adm-md .mk { flex: none; color: #38bdf8; font-weight: 900; }
  .adm-md code { font-family: ui-monospace, Menlo, monospace; font-size: 0.88em; background: rgba(148, 163, 184, 0.18); padding: 1px 6px; border-radius: 6px; color: #fde68a; word-break: break-all; }
  .adm-md pre { background: #0b1224; border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; padding: 12px; overflow-x: auto; }
  .adm-md pre code { background: none; padding: 0; color: #e2e8f0; word-break: normal; white-space: pre; }
  .adm-md blockquote { margin: 10px 0; padding: 8px 12px; border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.08); border-radius: 6px; }
  .adm-md hr { border: none; border-top: 1px solid rgba(148, 163, 184, 0.3); margin: 18px 0; }
  .adm-md a { color: #7dd3fc; }
  .adm-md-table { overflow-x: auto; margin: 10px 0; }
  .adm-md table { border-collapse: collapse; font-size: 14px; }
  .adm-md th, .adm-md td { border: 1px solid rgba(148, 163, 184, 0.25); padding: 6px 10px; vertical-align: top; text-align: left; }
  .adm-md th { background: #0b1224; color: #94a3b8; font-size: 12px; white-space: nowrap; }
  .adm-md td:first-child code { white-space: nowrap; word-break: normal; }
  .adm-steps { margin: 8px 0 12px 1.4em; line-height: 1.9; }
  .adm-compose { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; margin-top: 8px; }
  .adm-compose canvas { width: 200px; aspect-ratio: 1414 / 2000; border-radius: 10px; background: #fff; cursor: grab; touch-action: none; box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35); }
  .adm-compose .tools { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; min-width: 180px; }
  .adm-compose .tools button { font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.35); background: #0f172a; color: #e2e8f0; cursor: pointer; }
  .adm-compose input[type=range] { width: 180px; }
  .adm-cl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; max-height: 64vh; overflow-y: auto; padding: 2px; }
  .adm-cl-item { border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 8px; background: rgba(2, 6, 23, 0.5); color: #e2e8f0; cursor: pointer; font-size: 12px; line-height: 1.5; text-align: left; font-family: inherit; }
  .adm-cl-item:hover { border-color: #38bdf8; }
  .adm-cl-item img { width: 100%; aspect-ratio: 600 / 849; object-fit: cover; border-radius: 8px; background: #0b1224; display: block; margin-bottom: 6px; }
  .adm-cl-item b { font-size: 13px; }
  .adm-edit { display: grid; grid-template-columns: 220px 1fr; gap: 16px; color: #e2e8f0; }
  .adm-edit > img { width: 220px; aspect-ratio: 600 / 849; object-fit: cover; border-radius: 12px; background: #0b1224; }
  .adm-warn { color: #fbbf24; font-size: 13px; line-height: 1.6; }
  @media (max-width: 600px) { .adm-card { grid-template-columns: 1fr; } .adm-card img { width: 160px; } .adm-edit { grid-template-columns: 1fr; } }
  `;

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach((c) => { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function build() {
    if (root) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('section', { id: 'view-admin', class: 'app-view', hidden: '' }, [
      el('div', { class: 'container' }, [
        el('header', { class: 'adm-head hud-panel' }, [
          el('div', {}, [el('div', { class: 'adm-title', text: '👩‍🏫 先生の管理画面' }), el('div', { class: 'adm-sub', text: '児童の記録の確認と、カードの承認ができます' })]),
          el('button', { type: 'button', class: 'btn-logout', text: '🚪 ログアウト', onclick: () => app.logout() })
        ]),
        el('div', { class: 'adm-tabs', id: 'admTabs' }, [
          tabBtn('students', '👥 児童一覧'), tabBtn('point', '💰 ポイントの記録'), tabBtn('login', '🔐 ログインの記録'),
          tabBtn('cards', '🃏 カードの承認'), tabBtn('cardlist', '🗂️ カード一覧'), tabBtn('readme', '📘 説明書')
        ]),
        el('div', { class: 'adm-panel hud-panel', id: 'admPanel' })
      ])
    ]);
    document.body.appendChild(root);
  }

  function tabBtn(key, label) {
    return el('button', { type: 'button', class: 'adm-tab', 'data-tab': key, text: label, onclick: () => { tab = key; render(); } });
  }

  function panel() { return document.getElementById('admPanel'); }
  function setBusy(msg) { panel().replaceChildren(el('div', { class: 'adm-empty', text: msg || '読み込み中...' })); }
  function showError(err) { panel().replaceChildren(el('div', { class: 'adm-empty adm-ng', text: '⚠️ ' + ((err && err.message) || '読み込めませんでした') })); }

  function render() {
    document.querySelectorAll('#admTabs .adm-tab[data-tab]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    if (tab === 'students') renderStudents();
    else if (tab === 'cards') renderCards();
    else if (tab === 'readme') renderReadme();
    else if (tab === 'cardlist') renderCardList();
    else renderLogs(tab);
  }

  // ---------- 説明書（スプレッドシートの「説明書」シートに貼った README_GAS.md） ----------
  //   文章はサーバーから先生にだけ届く（このファイルは GitHub にあるので、説明書の中身は書かない）
  function renderReadme() {
    setBusy();
    app.call('admin.readme').then((d) => {
      if (tab !== 'readme') return;
      const reload = el('button', { type: 'button', text: '🔄 読みこみ直す', onclick: renderReadme });
      if (!d.text) {
        panel().replaceChildren(el('div', { class: 'adm-note' }, [
          el('strong', { text: d.missing ? '「説明書」シートがまだありません。' : '「説明書」シートが空です。' }),
          el('ol', { class: 'adm-steps' }, [
            el('li', { text: 'スプレッドシートの下の「＋」でシートを足し、名前を「説明書」にする' }),
            el('li', { text: 'README_GAS.md をテキストエディットで開いて、⌘A → ⌘C' }),
            el('li', { text: '「説明書」シートの A1 をダブルクリックしてから ⌘V → Enter（ダブルクリックしないと、「- 」で始まる行が数式とまちがえられてこわれます）' }),
            el('li', { text: 'この画面の「読みこみ直す」を押す' })
          ]),
          el('div', { class: 'adm-tools' }, [reload])
        ]));
        return;
      }
      const body = el('div', { class: 'adm-md' });
      body.innerHTML = mdToHtml(d.text);
      const toc = el('div', { class: 'adm-toc' }, Array.from(body.querySelectorAll('h2')).map((h) =>
        el('button', { type: 'button', text: h.textContent, onclick: () => h.scrollIntoView({ behavior: 'smooth', block: 'start' }) })));
      const warn = d.broken ? el('div', { class: 'adm-note adm-ng', text: '⚠️ うまく貼れていない行が ' + d.broken + ' 行あります（#ERROR! など）。シートを消して、A1 をダブルクリックしてから貼り直してください。' }) : null;
      panel().replaceChildren(...[warn, toc, body, el('div', { class: 'adm-tools', style: 'margin-top:10px' }, [reload])].filter(Boolean));
    }).catch(showError);
  }

  // かんたんな Markdown の表示（見出し・表・箇条書き・引用・コード・太字・リンク）
  //   先に < > & " を文字にしてから形を付けるので、説明書の中の文字がプログラムとして動くことはない
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function mdInline(s) {
    const codes = [];
    let t = esc(s).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/&lt;br\s*\/?&gt;/g, '<br>');
    return t.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[Number(i)] + '</code>');
  }
  function mdToHtml(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
    const BLOCK = /^(#{1,4})\s|^\s*```|^\s*\||^\s*>|^(\s*)([-*]|\d+\.)\s+/;
    const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^\s*```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { out.push('<h' + h[1].length + '>' + mdInline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (isRow(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const head = cells(line);
        const rows = [];
        i += 2;
        while (i < lines.length && isRow(lines[i])) rows.push(cells(lines[i++]));
        out.push('<div class="adm-md-table"><table><thead><tr>' + head.map((c) => '<th>' + mdInline(c) + '</th>').join('') + '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + r.map((c) => '<td>' + mdInline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }
      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push('<blockquote>' + buf.map(mdInline).join('<br>') + '</blockquote>');
        continue;
      }
      if (LIST.test(line)) {
        const items = [];
        while (i < lines.length && LIST.test(lines[i])) {
          const m = lines[i].match(LIST);
          const mark = /\d/.test(m[2]) ? m[2] : '•';
          let body = mdInline(m[3]);
          i++;
          // 字下げだけの続きの行は、同じ項目につなげる
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !LIST.test(lines[i]) && !BLOCK.test(lines[i])) body += '<br>' + mdInline(lines[i++].trim());
          items.push('<li class="lv' + Math.min(3, Math.floor(m[1].length / 2)) + '"><span class="mk">' + esc(mark) + '</span><span>' + body + '</span></li>');
        }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }
      const buf = [lines[i++]];
      while (i < lines.length && lines[i].trim() && !BLOCK.test(lines[i]) && !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])) buf.push(lines[i++]);
      out.push('<p>' + buf.map(mdInline).join('<br>') + '</p>');
    }
    return out.join('\n');
  }

  // ---------- カード一覧・編集 ----------
  //   消すことはできない（持っている子がいるため）。ガチャに出したくないときは、ガチャの種類を「なし」にする
  let cardData = null, cardFilter = { q: '', rarity: '', hand: '', gacha: '' };
  function effectName(d, id) { const e = (d.effects || []).find((x) => x.id === id); return e ? e.name : ''; }
  function thumbOf(c) {
    const base = (window.KANJI_CONFIG && KANJI_CONFIG.assetBase) || '';
    return base ? base + 'assets/cards/thumb/' + encodeURIComponent(c.no) + '.webp' : c.image;
  }
  function renderCardList() {
    setBusy();
    app.call('admin.cards').then((d) => { cardData = d; drawCardList(); }).catch(showError);
  }
  function drawCardList() {
    if (tab !== 'cardlist' || !cardData) return;
    const d = cardData;
    const sel = (key, label, list) => {
      const s = el('select', { onchange: () => { cardFilter[key] = s.value; drawCardList(); } }, [el('option', { value: '', text: label + '：すべて' })].concat(list.map((v) => el('option', { value: v, text: v }))));
      s.value = cardFilter[key];
      return s;
    };
    const q = el('input', { type: 'search', placeholder: '番号・名前でさがす', value: cardFilter.q, style: 'font:inherit;font-size:14px;padding:8px 10px;border-radius:10px;border:1px solid rgba(56,189,248,.35);background:#0f172a;color:#e2e8f0' });
    q.addEventListener('input', () => { cardFilter.q = q.value; paint(); });
    const grid = el('div', { class: 'adm-cl-grid' });
    const count = el('span', {});
    const paint = () => {
      const t = cardFilter.q.trim();
      const list = d.cards.filter((c) => (!cardFilter.rarity || c.rarity === cardFilter.rarity) && (!cardFilter.hand || c.hand === cardFilter.hand) &&
        (!cardFilter.gacha || c.gachaType === cardFilter.gacha) && (!t || c.no === t || c.name.indexOf(t) >= 0));
      count.textContent = list.length + ' 枚';
      grid.replaceChildren(...list.map((c) => {
        const img = el('img', { src: thumbOf(c), alt: '', loading: 'lazy' });
        img.onerror = () => { img.onerror = null; img.src = c.image || ''; };
        return el('button', { type: 'button', class: 'adm-cl-item', onclick: () => drawCardEdit(c) }, [
          img, el('b', { text: 'No.' + c.no + ' ' + c.name }), el('br'),
          c.rarity + '・' + c.hand + '・' + (c.gachaType || '-'), el('br'),
          '効果：' + (c.effect ? effectName(d, c.effect) : effectName(d, c.autoEffect) + '（自動）'), el('br'),
          '持っている子：' + c.owners + '人'
        ]);
      }));
    };
    panel().replaceChildren(
      el('div', { class: 'adm-note', text: 'カードを押すと、名前・レアリティ・ガチャ・手・効果・セリフ・画像を変えられます。消すことはできません（ガチャに出したくないときは、ガチャの種類を「なし」に）。' }),
      el('div', { class: 'adm-tools' }, [q, sel('rarity', 'レアリティ', d.rarities), sel('hand', '手', d.hands), sel('gacha', 'ガチャ', d.gachaTypes), count]),
      grid);
    paint();
  }
  function drawCardEdit(c) {
    const d = cardData;
    const opt = (list, val) => list.map((v) => { const o = el('option', { value: v, text: v }); if (v === val) o.selected = true; return o; });
    const nameIn = el('input', { type: 'text', maxlength: '12', value: c.name });
    const rarIn = el('select', {}, opt(d.rarities, c.rarity));
    const gachaIn = el('select', {}, opt(d.gachaTypes, c.gachaType));
    if (d.gachaTypes.indexOf(c.gachaType) < 0) gachaIn.prepend(el('option', { value: '', text: 'えらぶ（今：' + (c.gachaType || '空') + '）', selected: '' }));
    const handIn = el('select', {}, opt(d.hands, c.hand));
    const effIn = el('select', {});
    const fillEff = (h, selId) => {
      const auto = h === c.hand ? effectName(d, c.autoEffect || c.effect) : '';
      effIn.replaceChildren(...[el('option', { value: '', text: '自動' + (auto && !c.effect ? '（今：' + auto + '）' : '') })].concat((d.effects || []).filter((e) => e.hand === h).map((e) => {
        const o = el('option', { value: e.id, text: e.name + (e.auto ? '' : '（ぶっとび）') });
        if (e.id === selId) o.selected = true;
        return o;
      })));
    };
    fillEff(c.hand, c.effect);
    handIn.addEventListener('change', () => fillEff(handIn.value, ''));
    const lineIn = el('input', { type: 'text', maxlength: '30', value: c.line });
    const warn = el('div', { class: 'adm-warn' });
    const showWarn = () => {
      const w = [];
      if (handIn.value !== c.hand) w.push('手を変えると、ステップアップのデッキに入れている子のカードの手も変わります。');
      if (rarIn.value !== c.rarity) w.push('レアリティを変えると、強さとガチャの出方が変わります。');
      warn.textContent = (w.length && c.owners ? '⚠️ ' + c.owners + '人が持っています。' : '') + w.join('');
    };
    [handIn, rarIn].forEach((x) => x.addEventListener('change', showWarn));
    // 画像の差しかえ：新しい絵をえらぶと、型に当てはめた見本が出る
    const comp = makeComposer(() => ({ rarity: rarIn.value, name: nameIn.value, hand: handIn.value, line: lineIn.value }), { optional: true });
    [nameIn, handIn, lineIn, rarIn].forEach((x) => { x.addEventListener('input', comp.refresh); x.addEventListener('change', comp.refresh); });
    const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { msgEl.textContent = 'PNG・JPEG・WebP の画像をえらんでください。'; return; }
      const rd = new FileReader();
      rd.onload = () => comp.setPicture(rd.result);
      rd.readAsDataURL(f);
    });
    const msgEl = el('div', { class: 'adm-note' });
    const save = el('button', { type: 'button', class: 'adm-yes', text: '💾 保存する' });
    save.addEventListener('click', () => {
      if (!gachaIn.value) { msgEl.textContent = 'ガチャの種類をえらんでください。'; msgEl.className = 'adm-note adm-ng'; return; }
      if ((handIn.value !== c.hand || rarIn.value !== c.rarity) && c.owners && !confirm(c.owners + '人が持っているカードです。手・レアリティを変えてよいですか？')) return;
      save.disabled = true;
      msgEl.textContent = comp.hasPicture() ? '画像を作って保存しています...' : '保存しています...'; msgEl.className = 'adm-note';
      comp.exportImages().then((imgs) => app.call('admin.cardUpdate', Object.assign({ no: c.no, name: nameIn.value, rarity: rarIn.value, gachaType: gachaIn.value, hand: handIn.value, effect: effIn.value, line: lineIn.value },
        imgs ? { image: imgs.full, thumb: imgs.thumb } : {})))
        .then((x) => {
          msgEl.textContent = x.changed.length ? '保存しました（' + x.changed.join('・') + '）。' + (x.image ? '画像は GitHub に入れました。表示が変わるまで数分かかることがあります。' : '') : '変わったところはありませんでした。';
          msgEl.className = 'adm-note adm-ok';
          save.disabled = false;
          cardData = null;
        })
        .catch((err) => { msgEl.textContent = '⚠️ ' + (err.message || '保存できませんでした'); msgEl.className = 'adm-note adm-ng'; save.disabled = false; });
    });
    const back = el('button', { type: 'button', class: 'adm-no', text: '← 一覧にもどる', onclick: () => { if (cardData) drawCardList(); else renderCardList(); } });
    const img = el('img', { src: thumbOf(c), alt: '' });
    img.onerror = () => { img.onerror = null; img.src = c.image || ''; };
    const f = (label, input) => el('div', {}, [el('label', { text: label }), input]);
    panel().replaceChildren(el('div', { class: 'adm-edit' }, [
      img,
      el('div', {}, [
        el('div', { class: 'adm-title', style: 'font-size:18px;margin-bottom:6px', text: 'No.' + c.no + ' を編集（持っている子：' + c.owners + '人）' }),
        el('div', { class: 'adm-form' }, [f('カード名', nameIn), f('レアリティ', rarIn), f('ガチャの種類', gachaIn), f('手', handIn), f('ステップアップ効果', effIn), f('セリフ', lineIn)]),
        warn,
        el('div', { class: 'adm-note', style: 'margin-top:10px' }, ['画像を差しかえるとき：絵をえらぶ → ', file]),
        comp.el,
        el('div', { class: 'adm-acts' }, [save, back]),
        msgEl
      ])
    ]));
  }

  // ---------- カードの型（GitHub の web/assets/frames。型の画像は先生が作ったもの） ----------
  //   位置は 1414×2000 の型の上の位置（win＝絵、name＝名前、text＝セリフ、hand＝手のマークの丸の中心と半径）
  const FRAME_W = 1414, FRAME_H = 2000, OUT_W = 600, OUT_H = 849, THUMB_W = 240, THUMB_H = 340;
  const FRAMES = {
    'N': { file: 'N.webp', win: [173, 356, 1212, 1211], name: [402, 94, 1284, 268], text: [158, 1306, 1227, 1439], hand: [353, 1664, 211] },
    'N+': { file: 'Nplus.webp', win: [173, 421, 1212, 1211], name: [402, 76, 1284, 250], text: [158, 1306, 1227, 1447], hand: [353, 1672, 211] },
    'R': { file: 'R.webp', win: [173, 421, 1212, 1212], name: [402, 99, 1284, 273], text: [158, 1306, 1228, 1471], hand: [353, 1664, 211] },
    'R+': { file: 'Rplus.webp', win: [173, 421, 1212, 1211], name: [411, 107, 1292, 281], text: [158, 1306, 1228, 1476], hand: [353, 1701, 211] },
    'SR': { file: 'SR.webp', win: [173, 421, 1212, 1211], name: [411, 107, 1292, 281], text: [158, 1306, 1227, 1459], hand: [353, 1684, 211] },
    'SR+': { file: 'SRplus.webp', win: [173, 421, 1212, 1211], name: [411, 107, 1292, 281], text: [158, 1306, 1223, 1499], hand: [353, 1724, 211] },
    'SSR': { file: 'SSR.webp', win: [173, 421, 1212, 1211], name: [392, 107, 1273, 281], text: [158, 1306, 1223, 1499], hand: [353, 1724, 211] },
    'UR': { file: 'UR.webp', win: [173, 421, 1212, 1211], name: [411, 107, 1292, 281], text: [158, 1306, 1228, 1476], hand: [353, 1701, 211] },
    'UR+': { file: 'URplus.webp', win: [173, 421, 1212, 1212], name: [392, 107, 1273, 281], text: [158, 1306, 1227, 1456], hand: [353, 1681, 211] },
    'LEGEND': { file: 'LEGEND.webp', win: [173, 436, 1212, 1212], name: [411, 107, 1292, 281], text: [158, 1306, 1223, 1499], hand: [353, 1724, 211] }
  };
  const HAND_FILES = { 'グー': 'hand_gu.webp', 'チョキ': 'hand_choki.webp', 'パー': 'hand_pa.webp' };
  const NAME_FONT = '"Yusei Magic", "Hiragino Maru Gothic ProN", sans-serif';
  const TEXT_FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';
  const imgCache = {};
  function frameAsset(file) {
    const cfg = window.KANJI_CONFIG || {};
    return (cfg.assetBase || '') + 'assets/frames/' + file + (cfg.assetVersion ? '?v=' + encodeURIComponent(cfg.assetVersion) : '');
  }
  function loadImg(src) {
    if (!imgCache[src]) imgCache[src] = new Promise((ok, ng) => {
      const im = new Image();
      if (!/^data:/.test(src)) im.crossOrigin = 'anonymous';   // 型の画像は jsDelivr から（画像を作るために必要）
      im.onload = () => ok(im);
      im.onerror = () => { delete imgCache[src]; ng(new Error('画像を読めませんでした')); };
      im.src = src;
    });
    return imgCache[src];
  }
  let fontLink = null;
  function loadFonts(texts) {
    if (!fontLink) {
      fontLink = el('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Yusei+Magic&family=Zen+Maru+Gothic:wght@700&display=swap' });
      document.head.appendChild(fontLink);
    }
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const wait = Promise.all([document.fonts.load('100px ' + NAME_FONT, texts.name || 'カ'), document.fonts.load('700 50px ' + TEXT_FONT, texts.line || 'あ')]).catch(() => {});
    return Promise.race([wait, new Promise((ok) => setTimeout(ok, 2500))]);   // 字の形が届かないときは、パソコンの字で作る
  }
  // 文字を枠の中に入れる（入りきらなければ小さくし、それでも入らなければ折り返す）
  function fitLines(ctx, text, font, maxW, maxH, start, min, maxLines) {
    for (let size = start; size >= min; size -= 4) {
      ctx.font = font(size);
      const lines = [];
      let cur = '';
      for (const ch of Array.from(text)) {
        if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
      }
      if (cur) lines.push(cur);
      if (lines.length <= maxLines && lines.length * size * 1.3 <= maxH) return { size, lines };
    }
    ctx.font = font(min);
    return { size: min, lines: [text] };
  }
  async function drawCard(ctx, scale, f, pic, view) {
    const L = FRAMES[f.rarity] || FRAMES.N;
    const [frame, hand] = await Promise.all([loadImg(frameAsset(L.file)), loadImg(frameAsset(HAND_FILES[f.hand] || HAND_FILES['グー']))]);
    await loadFonts({ name: f.name, line: f.line });
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    const [hx, hy, hr] = L.hand;
    ctx.drawImage(hand, hx - hr - 3, hy - hr - 3, (hr + 3) * 2, (hr + 3) * 2);   // 手のマーク（型の箱が上に重なるので先に）
    ctx.drawImage(frame, 0, 0, FRAME_W, FRAME_H);
    // 絵：枠の中だけに。はじめは全体が入る大きさ（zoom＝1）。ドラッグで動かせる
    const [x0, y0, x1, y1] = L.win, ww = x1 - x0 + 1, wh = y1 - y0 + 1;
    if (pic) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0, ww, wh); ctx.clip();
      const s = Math.min(ww / pic.width, wh / pic.height) * view.zoom;
      const dw = pic.width * s, dh = pic.height * s;
      ctx.drawImage(pic, x0 + (ww - dw) / 2 + view.x, y0 + (wh - dh) / 2 + view.y, dw, dh);
      ctx.restore();
    }
    // 名前（黒い帯の中・白い字）
    const [nx0, ny0, nx1, ny1] = L.name;
    const nm = fitLines(ctx, f.name || '', (z) => z + 'px ' + NAME_FONT, nx1 - nx0, ny1 - ny0, 120, 56, 2);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    nm.lines.forEach((t, i) => ctx.fillText(t, (nx0 + nx1) / 2, (ny0 + ny1) / 2 + (i - (nm.lines.length - 1) / 2) * nm.size * 1.15));
    // セリフ（灰色の箱の中）
    if (f.line) {
      const [tx0, ty0, tx1, ty1] = L.text;
      const tl = fitLines(ctx, '「' + f.line + '」', (z) => '700 ' + z + 'px ' + TEXT_FONT, tx1 - tx0, ty1 - ty0, 64, 30, 3);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineJoin = 'round';
      tl.lines.forEach((t, i) => { const y = ty0 + i * tl.size * 1.3; ctx.strokeText(t, tx0, y); ctx.fillText(t, tx0, y); });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  // 型に当てはめる部品（見本・大きさ・位置）。getFields() は { rarity, name, hand, line } を返す
  function makeComposer(getFields, opts) {
    opts = opts || {};
    let pic = null, view = { zoom: 1, x: 0, y: 0 }, busy = false, again = false;
    const canvas = el('canvas', { width: String(FRAME_W / 2), height: String(FRAME_H / 2), title: 'ドラッグで絵を動かせます' });
    const use = el('input', { type: 'checkbox' });
    use.checked = true;
    const zoom = el('input', { type: 'range', min: '0.5', max: '3', step: '0.01', value: '1' });
    const info = el('div', { class: 'adm-sub' });
    const btn = (t, fn) => el('button', { type: 'button', text: t, onclick: () => { fn(); refresh(); } });
    const tools = el('div', { class: 'tools' }, [
      el('label', {}, [use, ' カードの型に入れる']),
      el('div', { text: '絵の大きさ' }), zoom,
      btn('全体を入れる', () => { view = { zoom: 1, x: 0, y: 0 }; zoom.value = '1'; }),
      btn('わくいっぱい', () => {
        const L = FRAMES[getFields().rarity] || FRAMES.N, ww = L.win[2] - L.win[0], wh = L.win[3] - L.win[1];
        if (pic) { const z = Math.max(ww / pic.width, wh / pic.height) / Math.min(ww / pic.width, wh / pic.height); view = { zoom: z, x: 0, y: 0 }; zoom.value = String(Math.min(3, z)); }
      }),
      info
    ]);
    const root = el('div', { class: 'adm-compose' }, [canvas, tools]);
    if (opts.optional) root.hidden = true;   // 編集では、新しい絵をえらんだときだけ出す
    zoom.addEventListener('input', () => { view.zoom = Number(zoom.value); refresh(); });
    use.addEventListener('change', () => { canvas.style.opacity = use.checked ? '1' : '0.35'; });
    // ドラッグで位置を動かす（見本の1ピクセル＝型の上の何ピクセルか、に直す）
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = FRAME_W / canvas.clientWidth;
      view.x = drag.vx + (e.clientX - drag.x) * k; view.y = drag.vy + (e.clientY - drag.y) * k;
      refresh();
    });
    canvas.addEventListener('pointerup', () => { drag = null; });
    function refresh() {
      if (busy) { again = true; return; }
      busy = true;
      const f = getFields();
      drawCard(canvas.getContext('2d'), 0.5, f, pic, view)
        .then(() => { info.textContent = f.rarity ? '' : 'レアリティをえらぶと、その型になります'; })
        .catch((e) => { info.textContent = '⚠️ 型の画像を読めませんでした（' + e.message + '）。このまま承認すると、申請の画像のままカードになります。'; })
        .then(() => { busy = false; if (again) { again = false; refresh(); } });
    }
    return {
      el: root,
      refresh: refresh,
      hasPicture: () => !!pic,
      fail: (m) => { info.textContent = '⚠️ ' + m; },
      setPicture(src) {
        loadImg(src).then((im) => { pic = im; view = { zoom: 1, x: 0, y: 0 }; zoom.value = '1'; root.hidden = false; refresh(); })
          .catch(() => { info.textContent = '⚠️ 絵を読めませんでした'; });
      },
      // 保存・承認のとき：型に入れた画像（600×849 と 240×340）。型を使わないときは null（編集で絵をえらんだときは、絵をそのまま切りぬく）
      exportImages() {
        if (!pic) return Promise.resolve(null);
        const big = document.createElement('canvas');
        let job;
        if (use.checked) {
          big.width = FRAME_W; big.height = FRAME_H;
          job = drawCard(big.getContext('2d'), 1, getFields(), pic, view);
        } else if (opts.optional) {
          big.width = OUT_W; big.height = OUT_H;
          const ctx = big.getContext('2d'), s = Math.max(OUT_W / pic.width, OUT_H / pic.height);
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUT_W, OUT_H);
          ctx.drawImage(pic, (OUT_W - pic.width * s) / 2, (OUT_H - pic.height * s) / 2, pic.width * s, pic.height * s);
          job = Promise.resolve();
        } else {
          return Promise.resolve(null);   // 承認で型を使わない：申請の画像のまま
        }
        const shrink = (w, h, q) => {
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(big, 0, 0, w, h);
          let u = c.toDataURL('image/webp', q);
          if (u.indexOf('data:image/webp') !== 0) u = c.toDataURL('image/jpeg', q);
          return u;
        };
        return job.then(() => ({ full: shrink(OUT_W, OUT_H, 0.9), thumb: shrink(THUMB_W, THUMB_H, 0.85) }));
      }
    };
  }

  // ---------- 児童一覧 ----------
  function loadStudents() {
    return app.call('admin.students').then((d) => { students = d.students || []; return students; });
  }

  function renderStudents() {
    setBusy();
    loadStudents().then(() => {
      if (!students.length) { panel().replaceChildren(el('div', { class: 'adm-empty', text: '児童のデータがありません' })); return; }
      const rows = students.map((s) => el('tr', { class: 'click', title: 'この子のポイントの記録を見る', onclick: () => { filterId = s.id; tab = 'point'; render(); } }, [
        el('td', { text: s.id }),
        el('td', {}, [s.nickname || '（未設定）', s.teacher ? el('span', { class: 'adm-tag', text: ' 先生用 ' }) : null]),
        el('td', { text: String(s.points) }), el('td', { text: String(s.testScore) }), el('td', { text: String(s.winStreak) }), el('td', { text: s.recordTotal })
      ]));
      panel().replaceChildren(
        el('div', { class: 'adm-tools', text: '行をタップすると、その子のポイントの記録を見られます' }),
        table(['番号', 'ニックネーム', 'ポイント', 'テスト', '連勝', '累計戦績'], rows)
      );
    }).catch(showError);
  }

  // ---------- ログ ----------
  function renderLogs(kind) {
    const select = el('select', { 'aria-label': '児童でしぼりこむ', onchange: (e) => { filterId = e.target.value; fetchLogs(kind); } }, [el('option', { value: '', text: '全員' })]);
    const tools = el('div', { class: 'adm-tools' }, [
      el('span', { text: '児童：' }), select,
      el('button', { type: 'button', text: '🔄 更新', onclick: () => fetchLogs(kind) }),
      el('span', { id: 'admCount', class: 'adm-sub' })
    ]);
    panel().replaceChildren(tools, el('div', { id: 'admLogBody' }, [el('div', { class: 'adm-empty', text: '読み込み中...' })]));
    const fill = () => {
      students.forEach((s) => select.appendChild(el('option', { value: s.id, text: s.id + '　' + (s.nickname || '') })));
      select.value = filterId;
    };
    (students.length ? Promise.resolve() : loadStudents()).then(fill).catch(() => {}).then(() => fetchLogs(kind));
  }

  function fetchLogs(kind) {
    const body = document.getElementById('admLogBody');
    if (!body) return;
    body.replaceChildren(el('div', { class: 'adm-empty', text: '読み込み中...' }));
    app.call('admin.logs', { kind: kind, studentId: filterId, limit: 300 }).then((d) => {
      const list = d.rows || [];
      const count = document.getElementById('admCount');
      if (count) count.textContent = list.length ? '新しい順に ' + list.length + ' 件' : '';
      if (!list.length) { body.replaceChildren(el('div', { class: 'adm-empty', text: 'この条件の記録はありません' })); return; }
      if (kind === 'point') {
        body.replaceChildren(table(['日時', '番号', '増減', '理由', '残高'], list.map((r) => el('tr', {}, [
          el('td', { text: r.time }), el('td', { text: r.id }),
          el('td', { class: r.delta >= 0 ? 'adm-plus' : 'adm-minus', text: (r.delta > 0 ? '+' : '') + r.delta }),
          el('td', { class: 'wrap', text: r.reason }), el('td', { text: String(r.balance) })
        ]))));
      } else {
        body.replaceChildren(table(['日時', '番号（入力）', '結果', '入力の特徴', 'Googleアカウント'], list.map((r) => el('tr', {}, [
          el('td', { text: r.time }), el('td', { text: r.id }),
          el('td', { class: r.result === 'OK' ? 'adm-ok' : 'adm-ng', text: r.result }),
          el('td', { class: 'wrap', text: r.flags }), el('td', { text: r.account })
        ]))));
      }
    }).catch((err) => body.replaceChildren(el('div', { class: 'adm-empty adm-ng', text: '⚠️ ' + ((err && err.message) || '読み込めませんでした') })));
  }

  // ---------- カードの承認 ----------
  function renderCards() {
    setBusy();
    app.call('admin.cardRequests', { all: true }).then((d) => {
      const note = d.autoGithub
        ? '承認すると、画像が GitHub に自動で追加されます。カードはすぐガチャ・図鑑に入りますが、絵が表示されるまで1〜10分かかります。作った子には1枚プレゼントされます。'
        : 'GITHUB_TOKEN が未設定なので「手動」です。承認したあとに出る2つの画像を、GitHub Desktop で web/assets/cards/（大きい画像）と web/assets/cards/thumb/（小さい画像）に入れて Push してください。';
      const items = (d.pending || []).map((r) => cardItem(r, d));
      const done = (d.done || []).map((r) => el('tr', {}, [
        el('td', { text: r.time }), el('td', { text: r.studentId + ' ' + r.nickname }), el('td', { text: r.name }),
        el('td', { class: r.status === '承認' ? 'adm-ok' : 'adm-ng', text: r.status }),
        el('td', { text: r.rank ? 'No.' + r.rank + '（' + r.rarity + '・' + r.gachaType + '）' : '' }), el('td', { text: r.github }), el('td', { class: 'wrap', text: r.comment })
      ]));
      panel().replaceChildren(...[
        el('div', { class: 'adm-note', text: note }),
        el('div', { class: 'adm-note', text: '確認すること：顔写真・名前・学校名などが写っていないか（画像は公開されます）。画像をクリックすると大きく見られます。' }),
        items.length ? el('div', { class: 'adm-cards' }, items) : el('div', { class: 'adm-empty', text: '審査中の申請はありません' }),
        done.length ? el('div', { style: 'margin-top:16px' }, [el('div', { class: 'adm-note', text: 'これまでの申請（新しい順・30件まで）' }),
          table(['申請日時', '児童', 'カード名', '結果', 'カード', 'GitHub', 'コメント'], done)]) : null
      ].filter(Boolean));
    }).catch(showError);
  }

  function cardItem(r, d) {
    const opt = (list, val) => list.map((v) => { const o = el('option', { value: v, text: v }); if (v === val) o.selected = true; return o; });
    const nameIn = el('input', { type: 'text', maxlength: '12', value: r.name });
    const handIn = el('select', {}, opt(d.hands, r.hand));
    // ステップアップの効果：子どもが選んだものが最初に入る（空＝おまかせ）。手を変えたら、その手の効果にえらび直す
    const effIn = el('select', {});
    const fillEff = (h, sel) => {
      effIn.replaceChildren(...[el('option', { value: '', text: 'おまかせ（自動）' })].concat((d.effects || []).filter((e) => e.hand === h).map((e) => {
        const o = el('option', { value: e.id, text: e.name + (e.auto ? '' : '（ぶっとび）') + '：' + e.desc.replace(/\{S(\d*)\}/g, (m, n) => n ? '強さ×' + n : '強さ').replace(/\{H\}/g, '強さの半分') });
        if (e.id === sel) o.selected = true;
        return o;
      })));
    };
    fillEff(r.hand, r.effect);
    handIn.addEventListener('change', () => fillEff(handIn.value, ''));
    const lineIn = el('input', { type: 'text', maxlength: '30', value: r.line });
    const rarIn = el('select', {}, [el('option', { value: '', text: 'えらぶ' })].concat(opt(d.rarities, '')));
    const gachaIn = el('select', {}, [el('option', { value: '', text: 'えらぶ' })].concat(opt(d.gachaTypes, '')));
    const comIn = el('input', { type: 'text', maxlength: '100', placeholder: '子どもへのひとこと（なくてもよい）' });
    const msgEl = el('div', { class: 'adm-note' });
    const img = el('img', { src: r.thumb || '', alt: r.name, title: 'クリックで大きく見る' });
    img.addEventListener('click', () => {
      if (img.classList.contains('big')) { img.classList.remove('big'); return; }
      img.classList.add('big');
      if (!img.dataset.full) app.call('admin.cardImage', { id: r.id }).then((x) => { if (x.image) { img.dataset.full = '1'; img.src = x.image; } }).catch(() => {});
    });
    // カードの型に当てはめる（レアリティ・名前・手・セリフを変えると、見本もすぐ変わる）
    const comp = makeComposer(() => ({ rarity: rarIn.value || 'N', name: nameIn.value, hand: handIn.value, line: lineIn.value }));
    app.call('admin.cardImage', { id: r.id }).then((x) => { if (x.image) comp.setPicture(x.image); }).catch(() => comp.fail('申請の画像を読めませんでした'));
    [nameIn, handIn, lineIn, rarIn].forEach((x) => { x.addEventListener('input', comp.refresh); x.addEventListener('change', comp.refresh); });
    const yes = el('button', { type: 'button', class: 'adm-yes', text: '✅ 承認してカードにする' });
    const no = el('button', { type: 'button', class: 'adm-no', text: '見送る' });
    const decide = (decision) => {
      if (decision === 'approve' && (!rarIn.value || !gachaIn.value)) { msgEl.textContent = 'レアリティとガチャの種類をえらんでください。'; msgEl.className = 'adm-note adm-ng'; return; }
      if (decision === 'reject' && !confirm('この申請を見送りますか？（画像はドライブのごみ箱に入ります）')) return;
      yes.disabled = no.disabled = true;
      msgEl.textContent = decision === 'approve' ? '追加しています...' : '記録しています...'; msgEl.className = 'adm-note';
      let made = null;
      (decision === 'approve' ? comp.exportImages() : Promise.resolve(null))
        .then((imgs) => {
          made = imgs;
          return app.call('admin.cardDecide', Object.assign({ id: r.id, decision: decision, rarity: rarIn.value, gachaType: gachaIn.value, name: nameIn.value, hand: handIn.value, effect: effIn.value, line: lineIn.value, comment: comIn.value },
            imgs ? { composed: imgs.full, composedThumb: imgs.thumb } : {}));
        })
        .then((x) => {
          if (x.decided !== '承認') { msgEl.textContent = '見送りました。子どもの画面にコメントが表示されます。'; msgEl.className = 'adm-note adm-ok'; return; }
          msgEl.textContent = 'カード No.' + x.rank + ' として追加しました。' + (x.github === '自動' ? '（GitHub に自動で追加済み。絵が表示されるまで1〜10分かかります。すぐに開いて出ないときは、10分ほど待ってから Ctrl＋Shift＋R で開き直してください）' : '');
          msgEl.className = 'adm-note adm-ok';
          if (x.github !== '自動') manualDownloads(r.id, x.rank, msgEl, made);
        })
        .catch((err) => { msgEl.textContent = '⚠️ ' + (err.message || 'できませんでした'); msgEl.className = 'adm-note adm-ng'; yes.disabled = no.disabled = false; });
    };
    yes.addEventListener('click', () => decide('approve'));
    no.addEventListener('click', () => decide('reject'));
    const f = (label, input) => el('div', {}, [el('label', { text: label }), input]);
    return el('div', { class: 'adm-card' }, [
      img,
      el('div', {}, [
        el('div', { class: 'adm-note', text: r.time + '　' + r.studentId + '番 ' + (r.nickname || '') }),
        el('div', { class: 'adm-form' }, [f('カード名', nameIn), f('手', handIn), f('ステップアップ効果', effIn), f('セリフ', lineIn), f('レアリティ', rarIn), f('ガチャの種類', gachaIn), f('コメント', comIn)]),
        comp.el,
        el('div', { class: 'adm-acts' }, [yes, no]),
        msgEl
      ])
    ]);
  }

  // 手動のとき：GitHub Desktop で入れる2つの画像（ファイル名＝カード番号）
  function manualDownloads(id, rank, msgEl, made) {
    (made ? Promise.resolve({ image: made.full, thumb: made.thumb }) : app.call('admin.cardImage', { id: id })).then((x) => {
      const link = (dataUrl, label) => {
        const a = el('a', { download: rank + '.webp', text: label });
        try { a.href = URL.createObjectURL(dataUrlToBlob(dataUrl)); } catch (e) { a.href = dataUrl; }
        return a;
      };
      msgEl.appendChild(el('div', { class: 'adm-dl' }, [
        link(x.image, '⬇ 大きい画像（' + rank + '.webp → web/assets/cards/）'),
        link(x.thumb, '⬇ 小さい画像（' + rank + '.webp → web/assets/cards/thumb/）')
      ]));
      msgEl.appendChild(el('div', { class: 'adm-sub', text: 'ダウンロードできないときは、申請画像のドライブのフォルダにある同じ画像を使ってください。' }));
    }).catch(() => {});
  }

  function dataUrlToBlob(u) {
    const m = String(u).match(/^data:([^;]+);base64,(.*)$/);
    const bin = atob(m[2]); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: m[1] });
  }

  function table(heads, rows) {
    return el('div', { class: 'adm-wrap' }, [el('table', { class: 'adm-table' }, [
      el('thead', {}, [el('tr', {}, heads.map((h) => el('th', { text: h })))]),
      el('tbody', {}, rows)
    ])]);
  }

  window.KanjiAdmin = {
    open(api) {
      app = api;
      build();
      app.showView('admin');
      const nav = document.getElementById('globalNav');
      if (nav) nav.hidden = true;   // 子ども用のメニューは出さない
      tab = 'students'; filterId = '';
      render();
    }
  };
})();
