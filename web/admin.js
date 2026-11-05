/* ===============================================================
   漢字の刃｜先生の管理画面（出席番号 32 ＋ 先生の Google アカウントのときだけ app.js が読み込む）
   ・児童一覧／ポイントの記録（PointLog）／ログインの記録（LoginLog）／カードの承認（CardRequests）／カード一覧・編集／説明書（「説明書」シート）
   ・カードの型：承認や画像の差しかえのとき、子どもの絵を型（assets/frames）に当てはめて、この画面でカードの画像を作る
   ・データはすべて GAS（google.script.run）から受け取る。先生かどうかはサーバーが毎回確かめる
   =============================================================== */
(function () {
  'use strict';
  // 管理画面の版：画面の上に出す。Push したのに新しいボタンが出ないときは、ここが古いまま（5分ほど待って Ctrl＋Shift＋R）
  const ADMIN_VERSION = '2026-11-05（カードの属性）';
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
  :where(.attr-chip) { display: inline-block; padding: 0 4px; border: 2px solid #000; background: var(--attr-c, #c2c3c7); color: #000; font-size: 12px; line-height: 1.5; white-space: nowrap; font-weight: bold; }
  .adm-cl-item .attr-chip { margin: 2px 0; }
  .adm-attr-hint { font-size: 12px; line-height: 1.6; color: #cbd5e1; margin-top: 6px; }
  .adm-attr-hint b { color: #fde68a; }
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
          el('div', {}, [el('div', { class: 'adm-title', text: '👩‍🏫 先生の管理画面' }), el('div', { class: 'adm-sub', text: '児童の記録の確認と、カードの承認ができます　（管理画面の版：' + ADMIN_VERSION + '）' })]),
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
  let cardData = null, cardFilter = { q: '', rarity: '', hand: '', gacha: '', attr: '' };
  // 属性（2026-11-05）：サーバーの属性の表（d.attrs：id・名前・アイコン・色）だけから作る（シートの字はそのまま出さない）
  //   表がない（前の Api.gs・code.gs）ときは、えらぶ欄を出さず、attr も送らない（シートの「属性」列はそのまま）
  function attrList(d) { return d && Array.isArray(d.attrs) && d.attrs.length ? d.attrs : null; }
  function attrOf(d, id) { return id ? (attrList(d) || []).find((a) => a && a.id === id) || null : null; }
  function attrLabel(a) { return (a.icon ? a.icon + ' ' : '') + a.name; }
  function attrChipEl(d, id) {   // <span class="attr-chip" style="--attr-c:#…" title="属性：忍者">🥷 忍者</span>。属性なしは null
    const a = attrOf(d, id);
    if (!a) return null;
    const s = el('span', { class: 'attr-chip', title: '属性：' + a.name, text: attrLabel(a) });
    if (/^#[0-9a-fA-F]{6}$/.test(String(a.color || ''))) s.style.setProperty('--attr-c', a.color);
    return s;
  }
  function attrSelect(d, cur) {
    const s = el('select', { 'aria-label': '属性' }, [el('option', { value: '', text: '属性なし' })].concat(attrList(d).map((a) => el('option', { value: a.id, text: attrLabel(a) }))));
    s.value = attrOf(d, cur) ? cur : '';
    return s;
  }
  // えらんだ属性の「属性コンボ」の説明（「デッキの役」〔手の組み合わせ〕とはべつ）
  function attrHint(d, id) {
    const a = attrOf(d, id), cb = d && d.attrCombos;
    const k = a && cb && cb.list ? cb.list[id] : null;
    if (!a) return [document.createTextNode('属性なし：「属性コンボ」には数えません。')];
    if (!k) return [];
    return [el('b', { text: '属性コンボ「' + (k.icon ? k.icon + ' ' : '') + k.name + '」' }),
      '　同じ属性のちがうカードを' + (cb.min || '') + '枚以上デッキに入れると発動。ボス戦：' + (k.text || '') + '　対人バトル：' + (k.pvpText || '')];
  }
  function effectName(d, id) { const e = (d.effects || []).find((x) => x.id === id); return e ? e.name : ''; }
  // ステップアップのスキルの段（段階4）：ふつう（N〜R+）・つよい（SR〜SR+）・イカサマ（SSR〜LEGEND）。レアリティに合う段のスキルだけえらべる
  function tierOfRarity(d, rarity) { return (d.tiers || {})[rarity] || ''; }
  function tierName(d, tier) { return (d.tierNames || {})[tier] || ''; }
  function skillsFor(d, hand, rarity) {
    const t = tierOfRarity(d, rarity);
    return (d.effects || []).filter((e) => e.hand === hand && (!t || !e.tier || e.tier === t));
  }
  function skillWords(desc) { return String(desc || '').replace(/\{S(\d*)\}/g, (m, n) => n ? '強さ×' + n : '強さ').replace(/\{H\}/g, '強さの半分').replace(/\{Q\}/g, '（1＋強さ×0.25）'); }
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
    // 属性でしぼる（すべて・属性なし・8つ。かっこは枚数）
    const attrs = attrList(d);
    const nAttr = (id) => d.cards.filter((c) => (id ? c.attr === id : !attrOf(d, c.attr))).length;
    const attrSel = attrs ? el('select', { 'aria-label': '属性でしぼる', onchange: () => { cardFilter.attr = attrSel.value; drawCardList(); } },
      [el('option', { value: '', text: '属性：すべて' }), el('option', { value: '-', text: '属性なし（' + nAttr('') + '）' })]
        .concat(attrs.map((a) => el('option', { value: a.id, text: attrLabel(a) + '（' + nAttr(a.id) + '）' })))) : null;
    if (attrSel) attrSel.value = cardFilter.attr === '-' || attrOf(d, cardFilter.attr) ? cardFilter.attr : '';
    const q = el('input', { type: 'search', placeholder: '番号・名前でさがす', value: cardFilter.q, style: 'font:inherit;font-size:14px;padding:8px 10px;border-radius:10px;border:1px solid rgba(56,189,248,.35);background:#0f172a;color:#e2e8f0' });
    q.addEventListener('input', () => { cardFilter.q = q.value; paint(); });
    const grid = el('div', { class: 'adm-cl-grid' });
    const count = el('span', {});
    const paint = () => {
      const t = cardFilter.q.trim();
      const fa = attrs ? cardFilter.attr : '';
      const list = d.cards.filter((c) => (!cardFilter.rarity || c.rarity === cardFilter.rarity) && (!cardFilter.hand || c.hand === cardFilter.hand) &&
        (!cardFilter.gacha || c.gachaType === cardFilter.gacha) && (!fa || (fa === '-' ? !attrOf(d, c.attr) : c.attr === fa)) && (!t || c.no === t || c.name.indexOf(t) >= 0));
      count.textContent = list.length + ' 枚';
      grid.replaceChildren(...list.map((c) => {
        const img = el('img', { src: thumbOf(c), alt: '', loading: 'lazy' });
        img.onerror = () => { img.onerror = null; img.src = c.image || ''; };
        const chip = attrChipEl(d, c.attr);
        return el('button', { type: 'button', class: 'adm-cl-item', onclick: () => drawCardEdit(c) }, [
          img, el('b', { text: 'No.' + c.no + ' ' + c.name }), el('br'),
          chip, chip ? el('br') : null,
          !chip && c.attrRaw ? el('span', { class: 'adm-warn', text: '⚠️ 属性が読めない（' + c.attrRaw + '）' }) : null, !chip && c.attrRaw ? el('br') : null,
          c.rarity + '・' + c.hand + '・' + (c.gachaType || '-'), el('br'),
          'スキル：' + (c.effect ? effectName(d, c.effect) : effectName(d, c.autoEffect) + '（自動）') + (tierName(d, tierOfRarity(d, c.rarity)) ? '・' + tierName(d, tierOfRarity(d, c.rarity)) : ''), el('br'),
          '持っている子：' + c.owners + '人'
        ]);
      }));
    };
    panel().replaceChildren(
      el('div', { class: 'adm-note', text: 'カードを押すと、名前・レアリティ・ガチャ・手・効果・' + (attrs ? '属性・' : '') + 'セリフ・画像を変えられます。消すことはできません（ガチャに出したくないときは、ガチャの種類を「なし」に）。' }),
      el('div', { class: 'adm-tools' }, [q, sel('rarity', 'レアリティ', d.rarities), sel('hand', '手', d.hands), sel('gacha', 'ガチャ', d.gachaTypes), attrSel, count]),
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
      const same = h === c.hand && rarIn.value === c.rarity;
      const auto = same ? effectName(d, c.autoEffect || c.effect) : '';
      const t = tierName(d, tierOfRarity(d, rarIn.value));
      effIn.replaceChildren(...[el('option', { value: '', text: '自動' + (t ? '（' + t + 'の段）' : '') + (auto && !c.effect ? '（今：' + auto + '）' : '') })].concat(skillsFor(d, h, rarIn.value).map((e) => {
        const o = el('option', { value: e.id, text: e.name + '（' + (tierName(d, e.tier) || '') + '）：' + skillWords(e.desc) });
        if (e.id === selId) o.selected = true;
        return o;
      })));
    };
    fillEff(c.hand, c.effect);
    handIn.addEventListener('change', () => fillEff(handIn.value, ''));
    rarIn.addEventListener('change', () => fillEff(handIn.value, effIn.value));   // レアリティの段が変わったら、その段のスキルにえらび直す
    const lineIn = el('input', { type: 'text', maxlength: '30', value: c.line });
    // 属性（2026-11-05）：サーバーが属性の表を送ってきたときだけ出す
    const attrIn = attrList(d) ? attrSelect(d, c.attr) : null;
    const attrHintEl = el('div', { class: 'adm-attr-hint' });
    const showAttrHint = () => {
      if (!attrIn) return;
      const chip = attrChipEl(d, attrIn.value);
      attrHintEl.replaceChildren(...(chip ? [chip, ' '] : []), ...attrHint(d, attrIn.value));
    };
    if (attrIn) { attrIn.addEventListener('change', showAttrHint); showAttrHint(); }
    const warn = el('div', { class: 'adm-warn' });
    const showWarn = () => {
      const w = [];
      if (handIn.value !== c.hand) w.push('手を変えると、ステップアップのデッキに入れている子のカードの手も変わります。');
      if (rarIn.value !== c.rarity) w.push('レアリティを変えると、強さとガチャの出方が変わります。');
      if (attrIn && attrIn.value !== (attrOf(d, c.attr) ? c.attr : '')) w.push('属性を変えると、このカードを入れたデッキの「属性コンボ」が変わることがあります。');
      warn.textContent = (w.length && c.owners ? '⚠️ ' + c.owners + '人が持っています。' : '') + w.join('') +
        (attrIn && c.attrRaw ? '（シートの「属性」の「' + c.attrRaw + '」は読めないので、今は属性なしです。保存すると、ここでえらんだ属性になります）' : '');
    };
    [handIn, rarIn].concat(attrIn ? [attrIn] : []).forEach((x) => x.addEventListener('change', showWarn));
    showWarn();
    // 画像の差しかえ：新しい絵をえらぶと、型に当てはめた見本が出る
    const comp = makeComposer(() => ({ rarity: rarIn.value, name: nameIn.value, hand: handIn.value, line: lineIn.value, gachaType: gachaIn.value }), { optional: true });
    [nameIn, handIn, lineIn, rarIn, gachaIn].forEach((x) => { x.addEventListener('input', comp.refresh); x.addEventListener('change', comp.refresh); });
    // 枠だけ付け直す（2026-11-02）：絵はそのまま、今のレアリティ・ガチャの種類の型（ふつう／キラキラ）に入れ直す
    //   型なしの絵（assets/cards/src/番号.webp）があればそれを使い、なければ今のカードの絵の窓の中を切りぬく
    const reframe = el('button', { type: 'button', text: '🖼 枠だけ付け直す（絵はそのまま）' });
    reframe.addEventListener('click', () => {
      reframe.disabled = true;
      msgEl.textContent = '今のカードから絵を取り出しています...'; msgEl.className = 'adm-note';
      pictureFromCard(c)
        .then((got) => { comp.setPicture(got.url); msgEl.textContent = got.note + ' 見本を見て、よければ「保存する」。'; })
        .catch((err) => { msgEl.textContent = '⚠️ ' + (err.message || '絵を取り出せませんでした'); msgEl.className = 'adm-note adm-ng'; })
        .then(() => { reframe.disabled = false; });
    });
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
      let saved = null;
      comp.exportImages().then((imgs) => { saved = imgs; return app.call('admin.cardUpdate', Object.assign({ no: c.no, name: nameIn.value, rarity: rarIn.value, gachaType: gachaIn.value, hand: handIn.value, effect: effIn.value, line: lineIn.value },
        attrIn ? { attr: attrIn.value } : {}, imgs ? { image: imgs.full, thumb: imgs.thumb, source: imgs.source || '' } : {})); })
        .then((x) => {
          if (x.image) { rememberSaved(c.no, x.source ? saved : Object.assign({}, saved, { source: '' })); c.image = x.image; }
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
        el('div', { class: 'adm-form' }, [f('カード名', nameIn), f('レアリティ', rarIn), f('ガチャの種類', gachaIn), f('手', handIn), f('ステップアップ効果', effIn), attrIn ? f('属性', attrIn) : null, f('セリフ', lineIn)]),
        attrIn ? attrHintEl : null,
        warn,
        el('div', { class: 'adm-note', style: 'margin-top:10px' }, [reframe, '　新しい型（キラキラもふくむ）に入れ直すとき。ガチャの種類を「キラキラ」にすると、キラキラの型になります']),
        el('div', { class: 'adm-note' }, ['画像を差しかえるとき：絵をえらぶ → ', file]),
        comp.el,
        el('div', { class: 'adm-acts' }, [save, back]),
        msgEl
      ])
    ]));
  }

  // ---------- カードの型（GitHub の web/assets/frames。型の画像は先生が作ったもの） ----------
  //   位置は 1414×2000 の型の上の位置（win＝絵、name＝名前、text＝セリフ、hand＝手のマークの丸の中心と半径）
  //   2026-11-01：背景の色がついた型に入れかえた。手のマークの丸は型に穴があいていて、下に手の絵を描く
  const FRAME_W = 1414, FRAME_H = 2000, OUT_W = 600, OUT_H = 849, THUMB_W = 240, THUMB_H = 340;
  const FRAMES = {
    'N': { file: 'N.webp', win: [173, 356, 1211, 1210], name: [401, 94, 1284, 267], text: [157, 1309, 1227, 1439], hand: [353, 1664, 212] },
    'N+': { file: 'Nplus.webp', win: [173, 421, 1211, 1211], name: [400, 77, 1285, 249], text: [157, 1302, 1226, 1446], hand: [353, 1672, 212] },
    'R': { file: 'R.webp', win: [173, 421, 1211, 1211], name: [400, 100, 1285, 272], text: [157, 1296, 1227, 1471], hand: [353, 1664, 212] },
    'R+': { file: 'Rplus.webp', win: [173, 421, 1211, 1211], name: [409, 108, 1294, 281], text: [157, 1302, 1227, 1476], hand: [353, 1701, 212] },
    'SR': { file: 'SR.webp', win: [173, 421, 1211, 1211], name: [409, 108, 1294, 281], text: [157, 1302, 1226, 1458], hand: [353, 1683, 212] },
    'SR+': { file: 'SRplus.webp', win: [173, 421, 1211, 1211], name: [409, 108, 1294, 280], text: [157, 1302, 1227, 1498], hand: [353, 1724, 212] },
    'SSR': { file: 'SSR.webp', win: [173, 421, 1211, 1211], name: [390, 108, 1274, 280], text: [157, 1302, 1227, 1498], hand: [353, 1724, 212] },
    'UR': { file: 'UR.webp', win: [173, 421, 1211, 1211], name: [409, 108, 1294, 281], text: [157, 1302, 1226, 1476], hand: [353, 1701, 212] },
    'UR+': { file: 'URplus.webp', win: [173, 421, 1211, 1211], name: [390, 108, 1274, 280], text: [157, 1302, 1227, 1455], hand: [353, 1681, 212] },
    'LEGEND': { file: 'LEGEND.webp', win: [173, 436, 1211, 1211], name: [409, 108, 1294, 280], text: [157, 1302, 1227, 1498], hand: [353, 1724, 212] }
  };
  // キラキラの型（web/assets/frames/kira）：絵がカード全体に広がり、その上に型と星がのる（今あるキラキラカード No.21 などと同じ形）
  //   型は背景がすけている。セリフの箱は半透明の黒。星は drawSparkles が描く
  const KIRA_FRAMES = {
    'N': { file: 'kira/N.webp', name: [408, 95, 1277, 281], text: [157, 1306, 1228, 1439], hand: [352, 1664, 211] },
    'N+': { file: 'kira/Nplus.webp', name: [407, 78, 1278, 262], text: [157, 1260, 1228, 1447], hand: [352, 1671, 211] },
    'R': { file: 'kira/R.webp', name: [407, 101, 1278, 286], text: [157, 1260, 1228, 1471], hand: [352, 1664, 212] },
    'R+': { file: 'kira/Rplus.webp', name: [415, 110, 1288, 295], text: [157, 1260, 1228, 1476], hand: [353, 1700, 211] },
    'SR': { file: 'kira/SR.webp', name: [415, 110, 1288, 295], text: [157, 1260, 1228, 1458], hand: [353, 1683, 211] },
    'SR+': { file: 'kira/SRplus.webp', name: [415, 110, 1288, 295], text: [157, 1260, 1226, 1498], hand: [353, 1723, 212] },
    'SSR': { file: 'kira/SSR.webp', name: [396, 110, 1268, 295], text: [157, 1260, 1226, 1498], hand: [353, 1723, 211] },
    'UR': { file: 'kira/UR.webp', name: [415, 110, 1288, 295], text: [157, 1260, 1228, 1476], hand: [353, 1700, 211] },
    'UR+': { file: 'kira/URplus.webp', name: [396, 110, 1268, 295], text: [157, 1260, 1228, 1456], hand: [352, 1680, 211] },
    'LEGEND': { file: 'kira/LEGEND.webp', name: [415, 110, 1288, 295], text: [157, 1260, 1226, 1498], hand: [353, 1723, 211] }
  };
  Object.keys(KIRA_FRAMES).forEach((k) => { KIRA_FRAMES[k].win = [0, 0, FRAME_W - 1, FRAME_H - 1]; KIRA_FRAMES[k].kira = true; });
  const isKiraGacha = (g) => /キラキラ/.test(String(g || ''));
  const HAND_FILES = { 'グー': 'hand_gu.webp', 'チョキ': 'hand_choki.webp', 'パー': 'hand_pa.webp' };
  // 手の丸の色が型の背景と同じになる組み合わせ：LEGEND のグーは先生の絵と同じうすい赤、N+ のパーは丸の内がわに白いふち
  const HAND_STYLE = { 'LEGEND|グー': { file: 'hand_gu_light.webp' }, 'N+|パー': { rim: '#ffffff' } };
  const KIRA_HAND_STYLE = { 'N|グー': { file: 'hand_gu_light.webp' } };   // 先生のキラキラ N の型も、グーはうすい赤

  // ---------- キラキラの星（先生のキラキラの型と、今あるキラキラカードの星を測ったもの） ----------
  //   12コマで1回り（1コマ 0.1秒）。どの星も同じ12コマの中で、出るタイミング（phase）だけずれる
  //   長さは星の大きさ S に対する割合。star＝四つの先がとがった星の先までの長さ、rays／cross＝十字の線、dashes＝外へ飛ぶ短い線、
  //   diag＝ななめの線、ring＝まわりの輪（4つの弧）。w＝線の太さ。off＝そのコマだけ中心を少し動かす
  const KIRA_CYCLE = 12, KIRA_MS = 100;
  const SPARKLE_TYPES = {
    twinkle: [
      { t: 0, off: [0.013, -0.024], cross: { r: [0, 0.2], w: 0.055 } },
      { t: 1, off: [0.013, -0.024], star: 0.55 },
      { t: 2, off: [0, -0.012], star: 0.85, rays: { r: [0, 0.86], w: 0.065 }, dashes: [{ r: [0.92, 1.08], w: 0.05 }] },
      { t: 3, off: [0, 0.02], star: 1.0, rays: { r: [0, 0.98], w: 0.06 }, dashes: [{ r: [1.1, 1.4], w: 0.05 }] },
      { t: 4, off: [0, 0.02], dashes: [{ r: [0.34, 0.74], w: 0.035 }, { r: [0.86, 1.24], w: 0.035 }, { r: [1.46, 1.66], w: 0.03 }] },
      { t: 5, off: [0, 0.02], dashes: [{ r: [0.52, 0.72], w: 0.028 }, { r: [0.86, 1.08], w: 0.028 }] }
    ],
    burst: [
      { t: 0, star: 0.035 },
      { t: 1, cross: { r: [0, 0.18], w: 0.03 } },
      { t: 2, cross: { rx: [0, 0.3], ry: [0, 0.45], w: 0.03 }, diag: { r: [0.03, 0.16], w: 0.025 } },
      { t: 3, off: [-0.009, -0.015], star: 0.45, rays: { rx: [0, 0.61], ry: [0, 0.73], w: 0.027 }, diag: { r: [0.27, 0.49], w: 0.017 } },
      { t: 4, off: [0, -0.024], star: 0.62, rays: { rx: [0, 0.66], ry: [0, 0.68], w: 0.027 }, dashes: [{ r: [0.76, 0.9], w: 0.025 }], diag: { r: [0.5, 0.62], w: 0.019 } },
      { t: 5, off: [0, 0.009], star: 1.0, dashes: [{ r: [0.86, 0.94], w: 0.035 }], ring: { r: 0.72, w: 0.022, half: 33 } },
      { t: 6, off: [0, 0.012], star: 0.84, rays: { r: [0, 0.97], w: 0.035 }, ring: { r: 0.655, w: 0.018, half: 25 } },
      { t: 7, off: [-0.006, 0], dashes: [{ r: [0.14, 0.52], w: 0.02 }, { r: [0.62, 0.78], w: 0.02 }, { r: [0.9, 1.06], w: 0.02 }], ring: { r: 0.46, w: 0.018, half: 33 }, diag: { r: [0.72, 0.8], w: 0.018 } },
      { t: 8, star: 0.2, rays: { r: [0, 0.34], w: 0.025 }, dashes: [{ r: [0.5, 0.61], w: 0.02 }, { r: [0.73, 0.86], w: 0.02 }], ring: { r: 0.31, w: 0.016, half: 38 } },
      { t: 9, cross: { r: [0, 0.26], w: 0.022 }, dashes: [{ r: [0.33, 0.41], w: 0.022 }] },
      { t: 10, cross: { r: [0, 0.16], w: 0.018 } },
      { t: 11, diag: { r: [0, 0.07], w: 0.02 } }
    ]
  };
  // 星の場所（1414×2000）：A＝絵の上の大きな星、B＝名前の帯の右はし、C＝セリフの箱の左上、D＝手の右、E＝右下の波
  const SPARKLES = [
    { type: 'burst', x: 448, y: 522.9, s: 400, phase: 0 },
    { type: 'twinkle', x: 1273.8, y: 1668.4, s: 204, phase: 0 },
    { type: 'twinkle', x: 1335.6, y: 281.6, s: 171, phase: 3 },
    { type: 'twinkle', x: 589.4, y: 1670.8, s: 137, phase: 6 },
    { type: 'twinkle', x: 125.4, y: 1234.7, s: 108, phase: 9 }
  ];
  // 先生の型によって、星の場所が少しずれている（先生の GIF に合わせる）
  const SPARKLE_SHIFT = { 'N': [35.6, 0], 'R+': [35.6, 0], 'UR': [51.1, 89.1] };
  function drawSparkles(ctx, scale, rarity, frame) {
    const sh = SPARKLE_SHIFT[rarity] || [0, 0];
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
    SPARKLES.forEach((p) => {
      const t = ((frame - p.phase) % KIRA_CYCLE + KIRA_CYCLE) % KIRA_CYCLE;
      const k = SPARKLE_TYPES[p.type].find((x) => x.t === t);
      if (!k) return;
      const S = p.s, off = k.off || [0, 0];
      const cx = p.x + sh[0] + off[0] * S, cy = p.y + sh[1] + off[1] * S;
      const seg = (dx, dy, r0, r1, w) => {
        ctx.lineWidth = Math.max(1 / scale, w * S);
        ctx.beginPath(); ctx.moveTo(cx + dx * r0 * S, cy + dy * r0 * S); ctx.lineTo(cx + dx * r1 * S, cy + dy * r1 * S); ctx.stroke();
      };
      const axes = (spec) => {   // 右・左・下・上（rx／ry があれば横と縦で長さがちがう）
        const rx = spec.rx || spec.r, ry = spec.ry || spec.r;
        seg(1, 0, rx[0], rx[1], spec.w); seg(-1, 0, rx[0], rx[1], spec.w);
        seg(0, 1, ry[0], ry[1], spec.w); seg(0, -1, ry[0], ry[1], spec.w);
      };
      if (k.cross) axes(k.cross);
      if (k.rays) axes(k.rays);
      (k.dashes || []).forEach(axes);
      if (k.diag) { const d = Math.SQRT1_2; [[d, d], [-d, d], [d, -d], [-d, -d]].forEach(([dx, dy]) => seg(dx, dy, k.diag.r[0], k.diag.r[1], k.diag.w)); }
      if (k.ring) {
        ctx.lineWidth = Math.max(1 / scale, k.ring.w * S);
        const h = k.ring.half * Math.PI / 180;
        [45, 135, 225, 315].forEach((deg) => { const a = deg * Math.PI / 180; ctx.beginPath(); ctx.arc(cx, cy, k.ring.r * S, a - h, a + h); ctx.stroke(); });
      }
      if (k.star) {   // 四つの先がとがった星（ふちは中心を通る放物線）
        const R = k.star * S;
        ctx.beginPath(); ctx.moveTo(cx, cy - R);
        ctx.quadraticCurveTo(cx, cy, cx + R, cy); ctx.quadraticCurveTo(cx, cy, cx, cy + R);
        ctx.quadraticCurveTo(cx, cy, cx - R, cy); ctx.quadraticCurveTo(cx, cy, cx, cy - R);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  // ---------- 動く WebP を作る（ブラウザが作った1コマずつの WebP を、ANIM／ANMF の入れものにつめる） ----------
  //   どのコマもカード全体（0,0 から）・重ねない（no blend）・前のコマは消さない（dispose none）：古い iPad でも正しく動く形
  function dataUrlBytes(u) {
    const bin = atob(String(u).split(',')[1] || '');
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function webpChunks(b) {
    const tag = (p) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    if (b.length < 20 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') throw new Error('WebP の画像を作れませんでした');
    const out = [];
    for (let p = 12; p + 8 <= b.length;) {
      const size = (b[p + 4] | (b[p + 5] << 8) | (b[p + 6] << 16) | (b[p + 7] << 24)) >>> 0;
      out.push({ id: tag(p), data: b.subarray(p + 8, p + 8 + size) });
      p += 8 + size + (size & 1);
    }
    return out;
  }
  function muxAnimatedWebp(frameBytes, w, h, ms) {
    const parts = [];
    let total = 4;   // 'WEBP'
    const u24 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
    const chunk = (id, payloadParts) => {
      const len = payloadParts.reduce((n, x) => n + x.length, 0);
      const head = new Uint8Array(8);
      for (let i = 0; i < 4; i++) head[i] = id.charCodeAt(i);
      head[4] = len & 255; head[5] = (len >> 8) & 255; head[6] = (len >> 16) & 255; head[7] = (len >>> 24) & 255;
      const pieces = [head].concat(payloadParts);
      if (len & 1) pieces.push(new Uint8Array(1));
      return pieces;
    };
    const flat = (pieces) => { const n = pieces.reduce((s, x) => s + x.length, 0), a = new Uint8Array(n); let o = 0; pieces.forEach((x) => { a.set(x, o); o += x.length; }); return a; };
    let alpha = false;
    const frames = frameBytes.map((b) => {
      const cs = webpChunks(b).filter((c) => c.id === 'ALPH' || c.id === 'VP8 ' || c.id === 'VP8L');
      if (!cs.some((c) => c.id === 'VP8 ' || c.id === 'VP8L')) throw new Error('WebP のコマが正しくありません');
      if (cs.some((c) => c.id !== 'VP8 ')) alpha = true;
      return flat([].concat(...cs.map((c) => chunk(c.id, [c.data]))));
    });
    const add = (pieces) => { pieces.forEach((x) => { parts.push(x); total += x.length; }); };
    add(chunk('VP8X', [new Uint8Array([0x02 | (alpha ? 0x10 : 0), 0, 0, 0].concat(u24(w - 1), u24(h - 1)))]));
    add(chunk('ANIM', [new Uint8Array([0, 0, 0, 0, 0, 0])]));   // 背景の色（なし）・くり返し＝ずっと
    frames.forEach((f) => add(chunk('ANMF', [new Uint8Array([].concat(u24(0), u24(0), u24(w - 1), u24(h - 1), u24(ms), [0x02])), f])));
    const head = new Uint8Array(12);
    'RIFF'.split('').forEach((c, i) => { head[i] = c.charCodeAt(0); });
    head[4] = total & 255; head[5] = (total >> 8) & 255; head[6] = (total >> 16) & 255; head[7] = (total >>> 24) & 255;
    'WEBP'.split('').forEach((c, i) => { head[8 + i] = c.charCodeAt(0); });
    const all = flat([head].concat(parts));
    let s = '';
    for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));
    return 'data:image/webp;base64,' + btoa(s);
  }
  // ---------- 枠だけ付け直す：今のカードから絵を取り出す（2026-11-02） ----------
  //   この画面で保存したカードは、ページを開いたときの置き場所（assetBase）がまだ古いので、保存した絵をここでおぼえておく
  //   { url：保存した型なしの絵 } か { changed：true（型なしの絵はない。c.image から切りぬく） }
  const sessionPics = {};
  function rememberSaved(no, imgs) { if (imgs) sessionPics[String(no)] = imgs.source ? { url: imgs.source } : { changed: true }; }
  function assetUrl(path) { const cfg = window.KANJI_CONFIG || {}; return (cfg.assetBase || '') + path; }
  function fetchBytes(url) {
    return fetch(url, { mode: 'cors' }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); }).then((b) => new Uint8Array(b));
  }
  function bytesToDataUrl(b, mime) {
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return 'data:' + mime + ';base64,' + btoa(s);
  }
  function isAnimatedWebp(b) { try { return webpChunks(b).some((x) => x.id === 'ANIM' || x.id === 'ANMF'); } catch (e) { return false; } }
  // カードの画像の中の「絵の窓」（黒いふちの内がわ）を見つける。見つからない辺は、型の決まった場所（600×849 のカードで 73〜514）
  function findPictureWindow(img) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H).data;
    const sx = W / 600, sy = H / 849;
    const dark = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return px[i + 3] > 200 && px[i] + px[i + 1] + px[i + 2] < 150; };
    // (x,y) から (dx,dy) の向きに進み、3つ以上つづく暗い点（ふち）をこえたところを返す。ふちが太すぎる（絵も暗い）ときは、ふちの太さ12とみる
    const edge = (x, y, dx, dy, n, s) => {
      let i0 = 0;
      while (i0 < n && dark(x + dx * i0, y + dy * i0)) i0++;   // 始めが暗い所（名前の黒い帯のはしなど）なら、ぬけてからさがす
      for (let i = i0; i < n; i++) {
        const ax = x + dx * i, ay = y + dy * i;
        if (!(dark(ax, ay) && dark(ax + dx, ay + dy) && dark(ax + dx * 2, ay + dy * 2))) continue;
        let j = i;
        while (j < n + 30 * s && dark(x + dx * j, y + dy * j)) j++;
        if (j - i > 20 * s) j = i + Math.round(12 * s);
        return dx ? x + dx * j : y + dy * j;
      }
      return null;
    };
    const med = (a) => { const b = a.filter((v) => v !== null).sort((p, q) => p - q); return b.length ? b[Math.floor(b.length / 2)] : null; };
    const rows = [290, 340, 400].map((y) => y * sy), cols = [200, 300, 400].map((x) => x * sx);
    let x0 = med(rows.map((y) => edge(30 * sx, y, 1, 0, Math.round(110 * sx), sx)));
    let x1 = med(rows.map((y) => edge(570 * sx, y, -1, 0, Math.round(110 * sx), sx)));
    // 上の辺：窓のふちは横いっぱい（x 61〜526）に黒い。名前の帯（x 170 から）とまちがえないよう、横の 9 割以上が黒い行をさがす
    const xs = []; for (let x = 90; x <= 500; x += 10) xs.push(x * sx);
    const rowDark = (y) => xs.filter((x) => dark(x, y)).length / xs.length;
    let y0 = null;
    for (let y = Math.round(125 * sy); y < Math.round(205 * sy); y++) {
      if (rowDark(y) < 0.9) continue;
      let j = y;
      while (j < Math.round(230 * sy) && rowDark(j) >= 0.9) j++;
      const t = j - y > 20 * sy ? y + Math.round(12 * sy) : j;   // 帯が太すぎる（絵の上も暗い）ときは、ふちの太さ12とみる
      if (t < 140 * sy) { y = j; continue; }   // 窓の上はしは 151（N）〜185（LEGEND）。それより上の黒い行は名前の帯など
      y0 = t;
      break;
    }
    let y1 = med(cols.map((x) => edge(x, 570 * sy, 0, -1, Math.round(100 * sy), sy)));
    const found = x0 !== null && x1 !== null && y0 !== null && y1 !== null;
    if (x0 === null) x0 = 74 * sx;
    if (x1 === null) x1 = 513 * sx; else x1 = x1 + 1;
    if (y0 === null) y0 = 180 * sy;
    if (y1 === null) y1 = 513 * sy; else y1 = y1 + 1;
    const w = x1 - x0, h = y1 - y0;
    if (w < 300 * sx || w > 480 * sx || h < 250 * sy || h > 400 * sy) return { x: Math.round(74 * sx), y: Math.round(180 * sy), w: Math.round(439 * sx), h: Math.round(333 * sy), found: false };
    return { x: Math.round(x0), y: Math.round(y0), w: Math.round(w), h: Math.round(h), found: found };
  }
  // 型なしの絵：保存してある src があればそれ、なければ今のカードの窓の中を切りぬく（動くカードは切りぬけない）
  async function pictureFromCard(c) {
    const mem = sessionPics[String(c.no)];
    if (mem && mem.url) return { url: mem.url, note: 'この画面で保存した絵（型なし）を使います。' };
    if (!mem) {
      try {
        const b = await fetchBytes(assetUrl('assets/cards/src/' + encodeURIComponent(c.no) + '.webp'));
        return { url: bytesToDataUrl(b, 'image/webp'), note: '保存してある絵（型なし）を使います。' };
      } catch (e) { /* src がまだない：今のカードから切りぬく */ }
    }
    let b = null;
    const urls = mem ? [c.image] : [assetUrl('assets/cards/' + encodeURIComponent(c.no) + '.webp'), c.image];   // この画面で変えたカードは、新しい画像の URL から
    for (const u of urls.filter(Boolean)) {
      try { b = await fetchBytes(u); break; } catch (e) { b = null; }
    }
    if (!b) throw new Error('今のカードの画像を読めませんでした。');
    if (isAnimatedWebp(b)) throw new Error('動くカード（キラキラ）は、絵だけを取り出せません。「絵をえらぶ」で絵を差しかえてください。');
    const url = URL.createObjectURL(new Blob([b]));
    try {
      const img = await new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ng(new Error('今のカードの画像を読めませんでした。')); im.src = url; });
      const r = findPictureWindow(img);
      const cv = document.createElement('canvas'); cv.width = r.w; cv.height = r.h;
      cv.getContext('2d').drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      return { url: cv.toDataURL('image/png'), note: '今のカードの絵の窓の中を切りぬきました' + (r.found ? '' : '（ふちが見つからない所は、型の決まった場所で切りぬきました。はしを確かめてください）') + '。名前とセリフの箱の字は、上の「カード名」「セリフ」で書き直します。' };
    } finally { URL.revokeObjectURL(url); }
  }

  const KIRA_OUT_W = 480, KIRA_OUT_H = 679;   // 今あるキラキラカードと同じ大きさ
  const KIRA_MAX_B64 = 780000;                 // サーバーのカード画像の上限（Api.gs CARD_IMAGE_MAX_B64＝800000）より少し小さく
  const NAME_FONT = '"Yusei Magic", "Hiragino Maru Gothic ProN", sans-serif';
  const TEXT_FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';
  const imgCache = {};
  function frameAsset(file) {
    const cfg = window.KANJI_CONFIG || {};
    return (cfg.assetBase || '') + 'assets/frames/' + file + (cfg.assetVersion ? '?v=' + encodeURIComponent(cfg.assetVersion) : '');
  }
  function loadImg(src) {
    if (/^(data|blob):/.test(src)) {   // えらんだ絵・取り出した絵はためておかない（型・手の絵だけためる）
      return new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ng(new Error('画像を読めませんでした')); im.src = src; });
    }
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
  // どの型を使うか：ガチャの種類が「キラキラ」なら、絵が全体に広がるキラキラの型
  function layoutOf(f) {
    const r = FRAMES[f.rarity] ? f.rarity : 'N';
    return isKiraGacha(f.gachaType) ? KIRA_FRAMES[r] : FRAMES[r];
  }
  async function drawCard(ctx, scale, f, pic, view) {
    const L = layoutOf(f);
    const r = FRAMES[f.rarity] ? f.rarity : 'N';
    const hs = (L.kira ? KIRA_HAND_STYLE : HAND_STYLE)[r + '|' + f.hand] || {};
    const [frame, hand] = await Promise.all([loadImg(frameAsset(L.file)), loadImg(frameAsset(hs.file || HAND_FILES[f.hand] || HAND_FILES['グー']))]);
    await loadFonts({ name: f.name, line: f.line });
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    // 絵：はじめは全体が入る大きさ（zoom＝1）。ドラッグで動かせる。ふつうの型は窓の中だけ、キラキラの型はカード全体（型の下）
    const [x0, y0, x1, y1] = L.win, ww = x1 - x0 + 1, wh = y1 - y0 + 1;
    const drawPic = () => {
      if (!pic) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0, ww, wh); ctx.clip();
      const s = Math.min(ww / pic.width, wh / pic.height) * view.zoom;
      const dw = pic.width * s, dh = pic.height * s;
      ctx.drawImage(pic, x0 + (ww - dw) / 2 + view.x, y0 + (wh - dh) / 2 + view.y, dw, dh);
      ctx.restore();
    };
    if (L.kira) drawPic();
    const [hx, hy, hr] = L.hand;
    ctx.drawImage(hand, hx - hr - 3, hy - hr - 3, (hr + 3) * 2, (hr + 3) * 2);   // 手のマーク（型の丸い穴から見える。型が上に重なるので先に）
    if (hs.rim) { ctx.beginPath(); ctx.arc(hx, hy, hr - 8, 0, Math.PI * 2); ctx.lineWidth = 12; ctx.strokeStyle = hs.rim; ctx.stroke(); }
    ctx.drawImage(frame, 0, 0, FRAME_W, FRAME_H);
    if (!L.kira) drawPic();
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
    let mode = '', base = null, frameNo = 0, timer = 0, picSrc = '';   // キラキラ：星のない見本（base）に、0.1秒ごとに星を重ねて動かす
    const canvas = el('canvas', { width: String(FRAME_W / 2), height: String(FRAME_H / 2), title: 'ドラッグで絵を動かせます' });
    const use = el('input', { type: 'checkbox' });
    use.checked = true;
    const zoom = el('input', { type: 'range', min: '0.5', max: '3', step: '0.01', value: '1' });
    const info = el('div', { class: 'adm-sub' });
    const kiraNote = el('div', { class: 'adm-sub', hidden: '' });
    const btn = (t, fn) => el('button', { type: 'button', text: t, onclick: () => { fn(); refresh(); } });
    // 絵が枠（キラキラはカード全体）いっぱいになる大きさ
    const coverZoom = () => {
      const L = layoutOf(getFields()), ww = L.win[2] - L.win[0] + 1, wh = L.win[3] - L.win[1] + 1;
      return pic ? Math.max(ww / pic.width, wh / pic.height) / Math.min(ww / pic.width, wh / pic.height) : 1;
    };
    const setView = (z) => { view = { zoom: z, x: 0, y: 0 }; zoom.value = String(Math.min(3, z)); };
    const tools = el('div', { class: 'tools' }, [
      el('label', {}, [use, ' カードの型に入れる']),
      el('div', { text: '絵の大きさ' }), zoom,
      btn('全体を入れる', () => setView(1)),
      btn('わくいっぱい', () => { if (pic) setView(coverZoom()); }),
      kiraNote,
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
    // キラキラの見本を動かす（画面からはずれたら止める）
    function tick() {
      if (!root.isConnected || !root.offsetParent) { clearInterval(timer); timer = 0; return; }   // 画面からはずれた・かくれた（ログアウトなど）ら止める。refresh でまた動く
      if (busy || !base || mode !== 'kira') return;
      frameNo = (frameNo + 1) % KIRA_CYCLE;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(base, 0, 0);
      drawSparkles(ctx, 0.5, getFields().rarity, frameNo);
    }
    function refresh() {
      if (busy) { again = true; return; }
      busy = true;
      const f = getFields(), L = layoutOf(f), m = L.kira ? 'kira' : 'normal';
      if (m !== mode) {   // 型がかわったら、絵の大きさをその型のはじめに：キラキラはカード全体いっぱい、ふつうは全体が入る大きさ
        mode = m;
        if (pic) setView(m === 'kira' ? coverZoom() : 1);
      }
      kiraNote.hidden = m !== 'kira';
      kiraNote.textContent = '✨ ガチャの種類が「キラキラ」なので、キラキラのカードになります。絵はカード全体に広がり、保存すると星が光る動く画像（' + KIRA_OUT_W + '×' + KIRA_OUT_H + '・' + KIRA_CYCLE + 'コマ）になります。';
      // キラキラは、別の紙に描き終わってから入れかえる（描いているあいだに星が重なって残らないように）
      const nb = m === 'kira' ? document.createElement('canvas') : null;
      if (nb) { nb.width = canvas.width; nb.height = canvas.height; }
      drawCard((nb || canvas).getContext('2d'), 0.5, f, pic, view)
        .then(() => {
          info.textContent = f.rarity ? '' : 'レアリティをえらぶと、その型になります';
          if (m === 'kira') {
            base = nb;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base, 0, 0);
            drawSparkles(ctx, 0.5, f.rarity, frameNo);
            if (!timer) timer = setInterval(tick, KIRA_MS);
          }
        })
        .catch((e) => { info.textContent = '⚠️ 型の画像を読めませんでした（' + e.message + '）。このまま承認すると、申請の画像のままカードになります。'; })
        .then(() => { busy = false; if (again) { again = false; refresh(); } });
    }
    // キラキラ：12コマの動く WebP（480×679）と、止まった小さい画像（240×340・はじめのコマ）
    //   画像の大きさがサーバーの上限をこえるときは、画質を少しずつ下げて作り直す
    function exportKira(big, f) {
      const c = document.createElement('canvas'); c.width = KIRA_OUT_W; c.height = KIRA_OUT_H;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      const sc = KIRA_OUT_W / FRAME_W;
      const frameCanvas = (i) => {
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.drawImage(big, 0, 0, KIRA_OUT_W, KIRA_OUT_H);
        drawSparkles(x, sc, f.rarity, i);
      };
      const webp = (cv, q) => {
        const u = cv.toDataURL('image/webp', q);
        if (u.indexOf('data:image/webp') !== 0) throw new Error('このブラウザでは動くキラキラカードを作れません。Chrome で開いてください。');
        return u;
      };
      let full = null;
      for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const frames = [];
        for (let i = 0; i < KIRA_CYCLE; i++) { frameCanvas(i); frames.push(dataUrlBytes(webp(c, q))); }
        full = muxAnimatedWebp(frames, KIRA_OUT_W, KIRA_OUT_H, KIRA_MS);
        if (full.length - 23 <= KIRA_MAX_B64) break;   // 23＝'data:image/webp;base64,'
        full = null;
      }
      if (!full) throw new Error('キラキラカードの画像が大きくなりすぎました。絵を少し小さくするか、ちがう絵でためしてください。');
      frameCanvas(0);
      const t = document.createElement('canvas'); t.width = THUMB_W; t.height = THUMB_H;
      const tx = t.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(c, 0, 0, THUMB_W, THUMB_H);
      return { full: full, thumb: webp(t, 0.85), kira: true };
    }
    // 型に入れる前の絵（あとで枠だけ付け直すときに使う）。長い辺は1200まで・サーバーの上限に入る大きさ。作れないときは ''
    function sourceImage() {
      try { return sourceImageOrThrow(); } catch (e) { return ''; }   // 作れなくても、カードの保存は止めない
    }
    function sourceImageOrThrow() {
      // えらんだ絵が、もう大きすぎない WebP なら、そのまま（付け直すたびに画質が落ちないように）
      if (/^data:image\/webp;base64,/.test(picSrc) && picSrc.length - 23 <= KIRA_MAX_B64 && Math.max(pic.width, pic.height) <= 1200) return picSrc;
      const k = Math.min(1, 1200 / Math.max(pic.width, pic.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(pic.width * k)); c.height = Math.max(1, Math.round(pic.height * k));
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(pic, 0, 0, c.width, c.height);
      for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) {
        const u = c.toDataURL('image/webp', q);
        if (u.indexOf('data:image/webp') !== 0) return '';
        if (u.length - 23 <= KIRA_MAX_B64) return u;
      }
      return '';
    }
    return {
      el: root,
      refresh: refresh,
      hasPicture: () => !!pic,
      fail: (m) => { info.textContent = '⚠️ ' + m; },
      setPicture(src) {
        loadImg(src).then((im) => { pic = im; picSrc = String(src); mode = ''; root.hidden = false; refresh(); })
          .catch(() => { info.textContent = '⚠️ 絵を読めませんでした'; });
      },
      // 保存・承認のとき：型に入れた画像（600×849 と 240×340。キラキラは動く 480×679 と 240×340）。
      //   型を使わないときは null（編集で絵をえらんだときは、絵をそのまま切りぬく）
      exportImages() {
        if (!pic) return Promise.resolve(null);
        const big = document.createElement('canvas');
        const f = getFields();
        let job, noSource = false;
        if (use.checked) {
          big.width = FRAME_W; big.height = FRAME_H;
          job = drawCard(big.getContext('2d'), 1, f, pic, view);
          if (layoutOf(f).kira) return job.then(() => Object.assign(exportKira(big, f), { source: sourceImage() }));
        } else if (opts.optional) {
          big.width = OUT_W; big.height = OUT_H;
          const ctx = big.getContext('2d'), s = Math.max(OUT_W / pic.width, OUT_H / pic.height);
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUT_W, OUT_H);
          ctx.drawImage(pic, (OUT_W - pic.width * s) / 2, (OUT_H - pic.height * s) / 2, pic.width * s, pic.height * s);
          job = Promise.resolve().then(() => { noSource = true; });   // 型に入れないとき、えらんだ絵はできあがったカードかもしれないので、型なしの絵にしない
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
        return job.then(() => ({ full: shrink(OUT_W, OUT_H, 0.9), thumb: shrink(THUMB_W, THUMB_H, 0.85), source: noSource ? '' : sourceImage() }));
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
  //   属性の表：admin.cardRequests が送ってこない（今の Api.gs）ときは、カード一覧（admin.cards）から1回だけ借りる。借りられなければ、属性の欄は出さない
  let attrBorrowed = null;
  function withAttrs(d) {
    if (attrList(d) || !(d.pending || []).length) return Promise.resolve(d);
    const use = (x) => Object.assign(d, { attrs: x.attrs, attrCombos: x.attrCombos });
    if (attrBorrowed) return Promise.resolve(use(attrBorrowed));
    return app.call('admin.cards').then((x) => { if (attrList(x)) attrBorrowed = { attrs: x.attrs, attrCombos: x.attrCombos }; return attrBorrowed ? use(attrBorrowed) : d; }).catch(() => d);
  }
  function renderCards() {
    setBusy();
    app.call('admin.cardRequests', { all: true }).then(withAttrs).then((d) => {
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
    const rarIn = el('select', {}, [el('option', { value: '', text: 'えらぶ' })].concat(opt(d.rarities, '')));
    // ステップアップのスキル：空＝おまかせ（レアリティの段で自動）。手を変えたら、その手のスキルにえらび直す
    const effIn = el('select', {});
    //   段階4：子どもはえらばない。レアリティをえらぶと、その段（ふつう・つよい・イカサマ）のスキルだけ出る
    const fillEff = (h, sel) => {
      const t = tierName(d, tierOfRarity(d, rarIn.value));
      effIn.replaceChildren(...[el('option', { value: '', text: 'おまかせ（自動' + (t ? '・' + t + 'の段' : '') + '）' })].concat(skillsFor(d, h, rarIn.value).map((e) => {
        const o = el('option', { value: e.id, text: e.name + '（' + (tierName(d, e.tier) || '') + '）：' + skillWords(e.desc) });
        if (e.id === sel) o.selected = true;
        return o;
      })));
    };
    fillEff(r.hand, r.effect);
    handIn.addEventListener('change', () => fillEff(handIn.value, ''));
    rarIn.addEventListener('change', () => fillEff(handIn.value, effIn.value));
    const lineIn = el('input', { type: 'text', maxlength: '30', value: r.line });
    const gachaIn = el('select', {}, [el('option', { value: '', text: 'えらぶ' })].concat(opt(d.gachaTypes, '')));
    // 属性（2026-11-05）：先生がえらぶ（子どもはえらばない）。はじめは属性なし
    const attrIn = attrList(d) ? attrSelect(d, r.attr || '') : null;
    const attrHintEl = el('div', { class: 'adm-attr-hint' });
    const showAttrHint = () => {
      if (!attrIn) return;
      const chip = attrChipEl(d, attrIn.value);
      attrHintEl.replaceChildren(...(chip ? [chip, ' '] : []), ...attrHint(d, attrIn.value));
    };
    if (attrIn) { attrIn.addEventListener('change', showAttrHint); showAttrHint(); }
    const comIn = el('input', { type: 'text', maxlength: '100', placeholder: '子どもへのひとこと（なくてもよい）' });
    const msgEl = el('div', { class: 'adm-note' });
    const img = el('img', { src: r.thumb || '', alt: r.name, title: 'クリックで大きく見る' });
    img.addEventListener('click', () => {
      if (img.classList.contains('big')) { img.classList.remove('big'); return; }
      img.classList.add('big');
      if (!img.dataset.full) app.call('admin.cardImage', { id: r.id }).then((x) => { if (x.image) { img.dataset.full = '1'; img.src = x.image; } }).catch(() => {});
    });
    // カードの型に当てはめる（レアリティ・名前・手・セリフを変えると、見本もすぐ変わる）
    const comp = makeComposer(() => ({ rarity: rarIn.value || 'N', name: nameIn.value, hand: handIn.value, line: lineIn.value, gachaType: gachaIn.value }));
    app.call('admin.cardImage', { id: r.id }).then((x) => { if (x.image) comp.setPicture(x.image); }).catch(() => comp.fail('申請の画像を読めませんでした'));
    [nameIn, handIn, lineIn, rarIn, gachaIn].forEach((x) => { x.addEventListener('input', comp.refresh); x.addEventListener('change', comp.refresh); });
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
            attrIn && decision === 'approve' ? { attr: attrIn.value } : {}, imgs ? { composed: imgs.full, composedThumb: imgs.thumb, composedSource: imgs.source || '' } : {}));
        })
        .then((x) => {
          if (x.decided !== '承認') { msgEl.textContent = '見送りました。子どもの画面にコメントが表示されます。'; msgEl.className = 'adm-note adm-ok'; return; }
          msgEl.textContent = 'カード No.' + x.rank + ' として追加しました。' + (x.github === '自動' ? '（GitHub に自動で追加済み。絵が表示されるまで1〜10分かかります。すぐに開いて出ないときは、10分ほど待ってから Ctrl＋Shift＋R で開き直してください）' : '');
          msgEl.className = 'adm-note adm-ok';
          if (x.github !== '自動') manualDownloads(r.id, x.rank, msgEl, made);
          else rememberSaved(x.rank, made);
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
        el('div', { class: 'adm-form' }, [f('カード名', nameIn), f('手', handIn), f('ステップアップ効果', effIn), f('セリフ', lineIn), f('レアリティ', rarIn), f('ガチャの種類', gachaIn), attrIn ? f('属性', attrIn) : null, f('コメント', comIn)]),
        attrIn ? attrHintEl : null,
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
        link(x.thumb, '⬇ 小さい画像（' + rank + '.webp → web/assets/cards/thumb/）'),
        made && made.source ? link(made.source, '⬇ 絵だけ（' + rank + '.webp → web/assets/cards/src/。あとで枠だけ付け直すときに使う）') : null
      ].filter(Boolean)));
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
