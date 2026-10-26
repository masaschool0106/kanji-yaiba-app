/* ===============================================================
   漢字の刃｜先生の管理画面（出席番号 32 ＋ 先生の Google アカウントのときだけ app.js が読み込む）
   ・児童一覧／ポイントの記録（PointLog）／ログインの記録（LoginLog）／カードの承認（CardRequests）／説明書（「説明書」シート）
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
  @media (max-width: 600px) { .adm-card { grid-template-columns: 1fr; } .adm-card img { width: 160px; } }
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
          tabBtn('cards', '🃏 カードの承認'), tabBtn('readme', '📘 説明書')
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
    const yes = el('button', { type: 'button', class: 'adm-yes', text: '✅ 承認してカードにする' });
    const no = el('button', { type: 'button', class: 'adm-no', text: '見送る' });
    const decide = (decision) => {
      if (decision === 'approve' && (!rarIn.value || !gachaIn.value)) { msgEl.textContent = 'レアリティとガチャの種類をえらんでください。'; msgEl.className = 'adm-note adm-ng'; return; }
      if (decision === 'reject' && !confirm('この申請を見送りますか？（画像はドライブのごみ箱に入ります）')) return;
      yes.disabled = no.disabled = true;
      msgEl.textContent = decision === 'approve' ? '追加しています...' : '記録しています...'; msgEl.className = 'adm-note';
      app.call('admin.cardDecide', { id: r.id, decision: decision, rarity: rarIn.value, gachaType: gachaIn.value, name: nameIn.value, hand: handIn.value, effect: effIn.value, line: lineIn.value, comment: comIn.value })
        .then((x) => {
          if (x.decided !== '承認') { msgEl.textContent = '見送りました。子どもの画面にコメントが表示されます。'; msgEl.className = 'adm-note adm-ok'; return; }
          msgEl.textContent = 'カード No.' + x.rank + ' として追加しました。' + (x.github === '自動' ? '（GitHub に自動で追加済み。絵が表示されるまで1〜10分かかります。すぐに開いて出ないときは、10分ほど待ってから Ctrl＋Shift＋R で開き直してください）' : '');
          msgEl.className = 'adm-note adm-ok';
          if (x.github !== '自動') manualDownloads(r.id, x.rank, msgEl);
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
        el('div', { class: 'adm-acts' }, [yes, no]),
        msgEl
      ])
    ]);
  }

  // 手動のとき：GitHub Desktop で入れる2つの画像（ファイル名＝カード番号）
  function manualDownloads(id, rank, msgEl) {
    app.call('admin.cardImage', { id: id }).then((x) => {
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
