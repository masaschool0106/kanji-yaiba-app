/* ===============================================================
   漢字の刃｜先生の管理画面（出席番号 32 ＋ 先生の Google アカウントのときだけ app.js が読み込む）
   ・児童一覧／ポイントの記録（PointLog）／ログインの記録（LoginLog）／カードの承認（準備中）
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
          el('button', { type: 'button', class: 'adm-tab', disabled: '', title: '次の更新で使えるようになります', text: '🃏 カードの承認（準備中）' })
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
    else renderLogs(tab);
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
