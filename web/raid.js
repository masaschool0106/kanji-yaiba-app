/* ===============================================================
   漢字の刃｜巨大レイドボス（週末・月末だけ。マイページの知らせを押すと app.js が読み込む）
   ・漢字クイズ（漢字ミサイル）に正解するたび、ボスに1ダメージ。クラスみんなのダメージで HP をけずる
   ・正解・ダメージ・ごほうびは、すべてサーバー（Api.gs の raid.*）が決める。この画面は見せるだけ
   ・ボスの絵とレーザーは fx/fx.js の raidStage（読めないときは絵文字のボスで動く）
   =============================================================== */
(function () {
  'use strict';
  let app = null, root = null, stage = null, token = null, busy = false, combo = 0, hits = 0, last = null;

  const CSS = `
  body.view-raid { padding: 14px 12px 60px; }
  #view-raid .container { max-width: 760px; margin: 0 auto; }
  .rd-head { padding: 14px 16px; margin-bottom: 10px; text-align: center; border: 2px solid #ef4444 !important; }
  .rd-title { font-size: 1.2rem; font-weight: 900; color: #fecaca; }
  .rd-sub { font-size: 0.85rem; color: #fca5a5; margin-top: 4px; }
  .rd-hp { position: relative; height: 24px; margin-top: 10px; border-radius: 999px; background: rgba(0, 0, 0, 0.55); border: 2px solid #7f1d1d; overflow: hidden; }
  .rd-hp i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #dc2626, #f97316); transition: width 0.4s ease; }
  .rd-hp span { position: relative; font-size: 0.85rem; font-weight: 900; color: #fff; line-height: 20px; text-shadow: 0 1px 2px #000; }
  .rd-stage { width: 100%; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; background: #1c0505; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; font-size: 80px; }
  .rd-panel { padding: 14px 16px; text-align: center; color: #e2e8f0; }
  .rd-q { font-size: 1.35rem; font-weight: 900; margin: 6px 0 12px; line-height: 1.5; }
  .rd-choices { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .rd-choices button, .rd-acts button { font: inherit; font-size: 1.1rem; font-weight: 800; padding: 12px; border-radius: 12px; border: 2px solid #f97316; background: rgba(0, 0, 0, 0.35); color: #fff; cursor: pointer; }
  .rd-choices button:hover { background: #f97316; }
  .rd-choices button:disabled { opacity: 0.6; cursor: default; }
  .rd-acts { display: flex; gap: 8px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
  .rd-acts .go { background: linear-gradient(135deg, #f97316, #dc2626); border-color: transparent; padding: 12px 24px; }
  .rd-msg { min-height: 1.6em; font-weight: 900; margin-top: 8px; }
  .rd-ok { color: #fde047; } .rd-ng { color: #fca5a5; }
  .rd-me { font-size: 0.9rem; color: #fde68a; margin-top: 6px; }
  .rd-top { margin-top: 12px; text-align: left; font-size: 0.9rem; }
  .rd-top li { padding: 3px 0; }
  .rd-top li.me { color: #fde047; font-weight: 900; }
  @media (max-width: 480px) { .rd-choices { grid-template-columns: 1fr; } }
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
  const $ = (id) => document.getElementById(id);

  function build() {
    if (root) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('section', { id: 'view-raid', class: 'app-view', hidden: '' }, [
      el('div', { class: 'container' }, [
        el('header', { class: 'rd-head hud-panel' }, [
          el('div', { class: 'rd-title', id: 'rdTitle', text: '⚠️ 巨大ボス' }),
          el('div', { class: 'rd-hp' }, [el('i', { id: 'rdHpBar' }), el('span', { id: 'rdHpText', text: '' })]),
          el('div', { class: 'rd-sub', id: 'rdSub', text: '' }),
          el('div', { class: 'rd-me', id: 'rdMe', text: '' })
        ]),
        el('div', { class: 'rd-stage', id: 'rdStage' }),
        el('div', { class: 'rd-panel hud-panel', id: 'rdPanel' }),
        el('div', { class: 'rd-acts' }, [el('button', { type: 'button', text: '← マイページへ', onclick: back })])
      ])
    ]);
    document.body.appendChild(root);
  }

  function back() {
    if (stage) { stage.destroy(); stage = null; }
    app.openMypage();
  }

  function setHp(d) {
    last = Object.assign(last || {}, d);
    const left = Math.max(0, (last.maxHp || 0) - (last.damage || 0));
    $('rdHpBar').style.width = (last.maxHp ? Math.round(left / last.maxHp * 100) : 100) + '%';
    $('rdHpText').textContent = 'HP ' + left + ' / ' + (last.maxHp || '?') + '（クラスのダメージ ' + (last.damage || 0) + '）';
  }

  function startStage(name) {
    if (stage) return;
    const box = $('rdStage');
    box.textContent = '';
    if (window.KanjiFX && typeof KanjiFX.raidStage === 'function') {
      try { stage = KanjiFX.raidStage(box, { name: name }); return; } catch (e) { console.error('raidStage', e); }
    }
    // 演出が読めないとき：絵文字のボス（攻撃はゆれで知らせる）
    box.textContent = '🦖';
    stage = {
      hit: () => { box.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], 240); return Promise.resolve(); },
      miss: () => Promise.resolve(), defeat: () => { box.textContent = '💥'; return Promise.resolve(); }, destroy: () => {}
    };
  }

  function panel(children) { $('rdPanel').replaceChildren(...children.filter(Boolean)); }

  function renderTop(s) {
    if (!s.top || !s.top.length) return null;
    return el('ol', { class: 'rd-top' }, s.top.map((p) => el('li', { class: p.isMe ? 'me' : '', text: p.nickname + '：' + p.damage + ' ダメージ' + (p.isMe ? '（あなた）' : '') })));
  }

  function refresh() {
    app.showLoading('ボスのようすを見ています...');
    return app.call('raid.status').then((s) => {
      app.hideLoading();
      if (!s.active) {
        $('rdTitle').textContent = 'ボスは来ていないよ';
        panel([el('p', { text: '巨大ボスが来るのは、週末（金・土・日）と月末だけ。次の襲来を待とう！' })]);
        return;
      }
      $('rdTitle').textContent = '⚠️ ' + s.label + '「' + s.boss + '」';
      $('rdSub').textContent = '参加した人 ' + s.participants + '人・倒したら1問でも正解した人に ' + s.reward + 'pt（トドメは +' + s.finishReward + 'pt）';
      $('rdMe').textContent = 'あなたのダメージ：' + s.my;
      setHp(s);
      startStage(s.boss);
      if (s.defeated) {
        panel([el('div', { class: 'rd-q', text: '🎉 ' + s.boss + ' を倒した！' }), el('p', { text: (s.finisher ? 'トドメ：' + s.finisher + (s.finisherIsMe ? '（あなた！）' : '') : '') }), renderTop(s)]);
        return;
      }
      panel([
        el('p', { text: 'じゃんけんでは勝てない…！ 漢字クイズに正解するたび「漢字ミサイル」が命中！' }),
        el('div', { class: 'rd-acts' }, [el('button', { type: 'button', class: 'go', text: '🚀 攻撃開始！', onclick: attack })]),
        renderTop(s)
      ]);
    }).catch((err) => { app.hideLoading(); panel([el('p', { class: 'rd-ng', text: '⚠️ ' + (err.message || '読みこめませんでした') })]); });
  }

  function attack() {
    if (busy) return;
    busy = true;
    app.call('raid.start').then((q) => {
      busy = false;
      token = q.token; combo = 0;
      setHp(q);
      question(q, '');
    }).catch((err) => { busy = false; panel([el('p', { class: 'rd-ng', text: '⚠️ ' + (err.message || 'はじめられませんでした') })]); });
  }

  function question(q, msg, cls) {
    const box = el('div', { class: 'rd-choices' });
    q.choices.forEach((c) => box.appendChild(el('button', { type: 'button', text: c, onclick: () => answer(c, box) })));
    panel([
      el('div', { class: 'rd-msg ' + (cls || ''), text: msg || (combo >= 2 ? '🔥 ' + combo + ' 連続命中中！' : '漢字ミサイル発射よーい！') }),
      el('div', { class: 'rd-q', text: q.question }),
      box,
      el('div', { class: 'rd-acts' }, [el('button', { type: 'button', text: '⏸ ひと休み', onclick: refresh })])
    ]);
  }

  function answer(choice, box) {
    if (busy) return;
    busy = true;
    box.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    app.call('raid.answer', { token: token, choice: choice }).then((r) => {
      busy = false;
      setHp(r);
      if (r.correct) { combo++; hits++; $('rdMe').textContent = 'この挑戦での命中：' + hits; }
      else combo = 0;
      const fx = r.correct ? stage.hit(combo >= 3 ? '-1 ×' + combo + '連続' : '-1') : stage.miss();
      if (r.defeated) {
        fx.then(() => stage.defeat()).then(() => {
          panel([
            el('div', { class: 'rd-q', text: r.finishedByMe ? '⚡ あなたがトドメをさした！' : '🎉 クラスのみんなでボスを倒した！' }),
            el('p', { text: r.finishedByMe && r.reward ? 'ごほうび ' + r.reward + 'pt！（参加した人みんなにもポイント）' : '1問でも正解した人には、ポイントのごほうび！' }),
            el('div', { class: 'rd-acts' }, [el('button', { type: 'button', class: 'go', text: '活やくランキングを見る', onclick: refresh })])
          ]);
        });
        return;
      }
      question(r, r.correct ? '💥 命中！ ボスに 1 ダメージ！' : '🛡️ はずれ…（正解は「' + r.answer + '」）', r.correct ? 'rd-ok' : 'rd-ng');
    }).catch((err) => {
      busy = false;
      panel([el('p', { class: 'rd-ng', text: '⚠️ ' + (err.message || 'うまくいきませんでした') }), el('div', { class: 'rd-acts' }, [el('button', { type: 'button', class: 'go', text: 'もう一度', onclick: refresh })])]);
    });
  }

  window.KanjiRaid = {
    open(api) {
      app = api;
      build();
      hits = 0;
      app.showView('raid');
      refresh();
    }
  };
})();
