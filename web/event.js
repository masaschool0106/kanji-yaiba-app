/* ===============================================================
   漢字の刃｜期間限定イベント「道場破り 〜LEGEND への道〜」（2026-11-07。マイページの知らせを押すと app.js が読み込む）
   ・N のカード3枚だけで、5つの道場（漢字・歴史・地理・政治・総本山）の師範とたたかう
   ・クイズ1問ごとに1回の攻撃：正解すると じゃんけん＋サイコロで攻撃、まちがえると ❤️−1。けずった師範の HP はのこる
   ・5つ破ると LEGEND 引換札 → まだ持っていない LEGEND を1枚えらぶ
   ・正解・師範の手・サイコロ・ダメージ・回数・LEGEND は、すべてサーバー（GAS の LegendEvent.gs・'event.*'）が決める。この画面は見せるだけ
   ・名前やカード名は textContent で出す（innerHTML に入れない）
   ・師範の絵は fx/fx.js の raidStage、LEGEND は gachaOpen（読めないときは絵文字と文字で動く）
   =============================================================== */
(function () {
  'use strict';
  let app = null, root = null, stage = null, stageName = '', stageBox = null, busy = false;
  let status = null, run = null, cur = null, pickIdx = -1;   // status：event.status の答え・run：とちゅうの挑戦・cur：今の道場
  const CARDS_KEY = 'kanji_event_cards_v1';   // えらんだ3枚（このブラウザだけ。持っているかはサーバーが毎回確かめる）
  const ICON = { 'グー': '✊', 'チョキ': '✌️', 'パー': '🖐️' };

  // 江戸風のドット絵（友だちと交換と同じ部品の形）：板は木の枠＋藍色の市松、見出しは木の札。背景（道場）は app.js が fx/pixel.js で出す
  const CSS = `
  body.view-event { padding: 16px 14px 110px; }
  #view-event .container { max-width: 880px; margin: 0 auto; }
  .ev-box { position: relative; padding: 16px 16px 14px; margin: 0 8px 22px; color: var(--white);
    background: repeating-conic-gradient(#1d2b53 0 25%, #18244a 0 50%) 0 0 / 16px 16px;
    box-shadow: 0 0 0 4px var(--brown), 0 0 0 8px var(--k), inset 0 4px 0 rgba(255, 255, 255, 0.12), inset 0 -4px 0 rgba(0, 0, 0, 0.3); }
  .ev-title { display: flex; align-items: center; gap: 12px; font-family: var(--px-font); font-size: 26px; line-height: 1.3; color: var(--white); text-shadow: 3px 3px 0 var(--k); margin: 0 0 6px; }
  .ev-stamp { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: var(--red); color: var(--white);
    font-size: 24px; text-shadow: none; box-shadow: inset 0 0 0 3px var(--white), 0 0 0 3px var(--red), 0 0 0 6px var(--k); }
  .ev-sub { font-size: 15px; line-height: 1.7; color: var(--lgray); }
  .ev-sub b { color: var(--yellow); }
  .ev-h { display: inline-block; font-family: var(--px-font); font-size: 19px; color: var(--white); text-shadow: 2px 2px 0 var(--k); margin: 0 0 12px; padding: 4px 14px;
    background: var(--brown); box-shadow: 0 0 0 3px var(--k), inset 0 3px 0 rgba(255, 255, 255, 0.2), inset 0 -3px 0 rgba(0, 0, 0, 0.3); }
  .ev-msg { margin: 0 8px 22px; padding: 10px 14px; font-size: 17px; font-weight: bold; background: var(--k); box-shadow: 0 0 0 4px var(--white); }
  .ev-msg:empty { display: none; }
  .ev-msg.error { color: var(--pink); } .ev-msg.ok { color: var(--lime); }
  .ev-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .ev-btn { font-family: var(--px-font); font-size: 17px; min-height: 48px; padding: 8px 16px; border: none; border-radius: 0; cursor: pointer;
    color: var(--white); background: var(--dblue); text-shadow: 2px 2px 0 var(--k); box-shadow: 0 4px 0 var(--k), inset 0 -4px 0 rgba(0, 0, 0, 0.25); touch-action: manipulation; }
  .ev-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--k); }
  .ev-btn:disabled { opacity: 0.45; cursor: default; transform: none; }
  .ev-btn.red { background: var(--red); font-size: 20px; min-height: 56px; padding: 10px 22px; }
  .ev-btn.green { background: var(--green); } .ev-btn.gray { background: var(--gray); }
  .ev-btn.gold { background: var(--yellow); color: var(--k); text-shadow: none; font-size: 20px; min-height: 56px; }
  .ev-map { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 4px 0 14px; }
  .ev-dojo { padding: 8px 4px; text-align: center; background: var(--gray); box-shadow: 0 0 0 3px var(--k); font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
  .ev-dojo .i { font-size: 26px; line-height: 1.2; }
  .ev-dojo .s { font-size: 12px; color: var(--lgray); }
  .ev-dojo.done { background: var(--green); } .ev-dojo.done .s { color: var(--white); }
  .ev-dojo.now { background: var(--red); box-shadow: 0 0 0 3px var(--yellow), 0 0 0 6px var(--k); } .ev-dojo.now .s { color: var(--yellow); }
  .ev-dojo.lock { opacity: 0.6; }
  .ev-master { display: flex; gap: 12px; align-items: center; padding: 10px 12px; background: rgba(0, 0, 0, 0.35); box-shadow: 0 0 0 2px var(--k); margin-bottom: 10px; }
  .ev-master .i { font-size: 40px; flex: none; }
  .ev-master .n { font-family: var(--px-font); font-size: 19px; color: var(--yellow); text-shadow: 2px 2px 0 var(--k); }
  .ev-master .t { font-size: 14px; color: var(--lgray); line-height: 1.5; }
  .ev-hp { position: relative; height: 26px; margin: 8px 0 4px; background: var(--gray); box-shadow: 0 0 0 3px var(--k); overflow: hidden; text-align: center; }
  .ev-hp i { position: absolute; left: 0; top: 0; bottom: 0; background: repeating-linear-gradient(90deg, var(--red) 0 12px, var(--plum) 12px 14px); transition: width 0.3s steps(6); }
  .ev-hp span { position: relative; font-size: 15px; color: var(--white); line-height: 26px; text-shadow: 2px 2px 0 var(--k); }
  .ev-rules { margin: 12px 0 0; padding-left: 1.3em; font-size: 14px; line-height: 1.7; color: var(--lgray); }
  .ev-rules b { color: var(--yellow); }
  /* 師範の絵は、画面の高さの 3割ほどまで（問題と答えが、スクロールしなくても見えるように） */
  .ev-stage { position: relative; width: min(100%, calc(30vh * 16 / 9)); aspect-ratio: 16 / 9; overflow: hidden; background: #1c0505; margin: 0 auto 10px; box-shadow: 0 0 0 3px var(--k);
    display: flex; align-items: center; justify-content: center; font-size: 64px; }
  .ev-kaa { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--px-font); font-size: 44px; color: var(--yellow);
    text-shadow: 3px 3px 0 var(--k), -3px -3px 0 var(--red); background: rgba(255, 0, 77, 0.25); pointer-events: none; animation: evKaa 0.6s steps(6) both; }
  @keyframes evKaa { 0% { transform: scale(1.6); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
  .ev-stat { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; justify-content: space-between; font-size: 16px; margin-bottom: 6px; }
  .ev-heart { font-size: 22px; letter-spacing: 2px; }
  .ev-combo { color: var(--orange); font-family: var(--px-font); text-shadow: 2px 2px 0 var(--k); }
  .ev-hand { display: flex; gap: 10px; justify-content: center; margin: 8px 0 12px; }
  .ev-card { position: relative; flex: 1 1 0; max-width: 150px; min-width: 0; padding: 6px; display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: var(--brown); color: var(--white); border: none; border-radius: 0; font: inherit; cursor: pointer; box-shadow: 0 0 0 3px var(--k), 0 5px 0 3px var(--k); touch-action: manipulation; }
  .ev-card.on { background: var(--red); box-shadow: 0 0 0 3px var(--yellow), 0 0 0 6px var(--k), 0 5px 0 6px var(--k); }
  .ev-card:disabled { opacity: 0.4; cursor: default; }
  .ev-card .h { font-size: 26px; line-height: 1.1; }
  .ev-card .n { font-size: 13px; line-height: 1.3; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 1px 1px 0 var(--k); }
  .ev-card .a { font-size: 12px; color: var(--yellow); }
  .ev-card .r { position: absolute; top: 4px; right: 4px; font-size: 12px; padding: 0 4px; background: var(--k); color: var(--pink); }
  .ev-card img { width: 64px; aspect-ratio: 600 / 849; object-fit: cover; display: block; box-shadow: 0 0 0 2px var(--k); }
  .ev-q { margin: 6px 0 12px; padding: 12px 14px; background: var(--white); color: var(--k); font-family: var(--px-font-read, sans-serif); font-size: 21px; font-weight: bold; line-height: 1.6;
    box-shadow: 0 0 0 3px var(--k), 5px 5px 0 3px rgba(0, 0, 0, 0.45); overflow-wrap: anywhere; }
  .ev-q small { display: block; font-size: 13px; color: var(--gray); font-weight: normal; }
  .ev-choices { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .ev-choices .ev-btn { font-family: var(--px-font-read, sans-serif); font-size: 18px; font-weight: bold; background: var(--navy); text-align: left; overflow-wrap: anywhere; box-shadow: 0 0 0 3px var(--lgray), 0 5px 0 3px var(--k); }
  .ev-choices .ev-btn .k { display: inline-block; min-width: 1.4em; color: var(--yellow); }
  .ev-res { margin: 0 0 10px; padding: 8px 12px; background: rgba(0, 0, 0, 0.45); box-shadow: 0 0 0 2px var(--k); font-size: 15px; line-height: 1.6; }
  .ev-res b { color: var(--yellow); font-size: 18px; }
  .ev-res .ok { color: var(--lime); font-weight: bold; } .ev-res .ng { color: var(--pink); font-weight: bold; }
  .ev-res .y { color: var(--peach); }
  .ev-res .ex { display: block; margin-top: 4px; color: var(--lgray); font-size: 14px; }
  .ev-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px; margin: 8px 0 12px; max-height: 56vh; overflow-y: auto; padding: 6px; }
  .ev-pick .ev-card { max-width: none; }
  .ev-pick .ev-card img { width: 84px; }
  .ev-pick .ev-card.legend { background: var(--plum); }
  .ev-pick .ev-card.legend.on { background: var(--red); }
  .ev-big { font-family: var(--px-font); font-size: 30px; line-height: 1.4; color: var(--yellow); text-shadow: 3px 3px 0 var(--k), -2px -2px 0 var(--red); text-align: center; margin: 6px 0 10px; }
  .ev-got { margin: 8px 0 0; padding-left: 1.3em; font-size: 15px; line-height: 1.7; }
  .ev-ov { position: fixed; inset: 0; z-index: 20000; background: rgba(0, 0, 0, 0.82); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .ev-ov > div { width: min(96vw, 900px); }
  #view-event .kbd { display: none; }
  @media (hover: hover) and (pointer: fine) { #view-event .ev-choices .kbd, #view-event .ev-card .kbd { display: inline-block; font-size: 11px; padding: 0 4px; margin-right: 4px; background: var(--k); color: var(--lgray); } }
  @media (max-width: 560px) { .ev-map { gap: 4px; } .ev-dojo { font-size: 11px; padding: 6px 2px; } .ev-dojo .i { font-size: 20px; } .ev-choices { grid-template-columns: 1fr; } .ev-title { font-size: 20px; } .ev-q { font-size: 18px; } }
  @media (prefers-reduced-motion: reduce) { .ev-kaa { animation: none; opacity: 0; } .ev-hp i { transition: none; } }
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
  const num = (v) => Math.max(0, Math.round(Number(v) || 0)).toLocaleString('ja-JP');
  const mulText = (m) => '×' + (Math.round(m * 10) / 10);

  function savedCards() {
    try { const v = JSON.parse(localStorage.getItem(CARDS_KEY) || '[]'); return Array.isArray(v) ? v.map(String).slice(0, 3) : []; } catch (e) { return []; }
  }
  function saveCards(ids) { try { localStorage.setItem(CARDS_KEY, JSON.stringify(ids)); } catch (e) { /* 保存できなくても、そのまま遊べる */ } }

  function bgm(fn, name) { try { if (window.KanjiBgm && typeof window.KanjiBgm[fn] === 'function') window.KanjiBgm[fn](name); } catch (e) { /* 音が出なくても止めない */ } }

  function build() {
    if (root) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('section', { id: 'view-event', class: 'app-view', hidden: '' }, [
      el('div', { class: 'container' }, [
        el('header', { class: 'ev-box' }, [
          el('h1', { class: 'ev-title' }, [el('span', { class: 'ev-stamp', text: '破' }), el('span', { text: '道場破り 〜LEGEND への道〜' })]),
          el('div', { class: 'ev-sub', id: 'evSub', text: '' })
        ]),
        el('div', { class: 'ev-msg', id: 'evMsg', role: 'status' }),
        el('div', { class: 'ev-box', id: 'evMain' }),
        el('div', { class: 'ev-btns', style: 'margin: 0 8px;' }, [el('button', { type: 'button', class: 'ev-btn gray', text: '← マイページへ', onclick: back })])
      ])
    ]);
    document.body.appendChild(root);
    document.addEventListener('keydown', onKey);
  }

  function back() {
    dropStage();
    app.openMypage();
  }
  function dropStage() { if (stage) { try { stage.destroy(); } catch (e) {} } stage = null; stageName = ''; stageBox = null; }

  function msg(text, type) { const m = $('evMsg'); m.textContent = text || ''; m.className = 'ev-msg' + (type ? ' ' + type : ''); }
  function main(children) { $('evMain').replaceChildren(...children.filter(Boolean)); }
  function errBox(err, retry) {
    main([el('p', { class: 'ev-sub', text: '⚠️ ' + ((err && err.message) || 'うまくいきませんでした') }),
      el('div', { class: 'ev-btns' }, [el('button', { type: 'button', class: 'ev-btn', text: 'もう一度', onclick: retry || refresh })])]);
  }

  // 上の板：期間・自分の進み
  function subLine() {
    const s = status, p = s && s.progress;
    const parts = [];
    if (s && s.period) parts.push('期間 ' + s.period + '・毎日 ' + s.hours);
    else if (s) parts.push('毎日 ' + s.hours);
    if (p) parts.push(p.done ? '🎉 5つの道場を制覇！' : '突破 ' + p.cleared + ' / ' + p.total + '・今日の挑戦 のこり ' + p.left + ' / ' + p.maxTries + '回');
    if (s && s.ticket > 0) parts.push('🎫 LEGEND 引換札 ' + s.ticket + '枚');
    $('evSub').textContent = parts.join('　');
  }

  function hpBar(dmg, hp) {
    const left = Math.max(0, hp - dmg);
    return el('div', { class: 'ev-hp' }, [el('i', { style: 'width:' + (hp ? Math.round(left / hp * 100) : 100) + '%' }), el('span', { text: '師範の HP ' + num(left) + ' / ' + num(hp) })]);
  }

  function masterBox(g) {
    return el('div', { class: 'ev-master' }, [
      el('div', { class: 'i', text: (g.look && g.look.emoji) || g.icon }),
      el('div', {}, [
        el('div', { class: 'n', text: g.icon + ' ' + g.name + '　師範「' + g.master + '」' }),
        el('div', { class: 't', text: g.text + '（' + g.subjectName + 'のクイズ）' }),
        el('div', { class: 't', text: g.fav ? '師範は ' + ICON[g.fav] + ' をよく出すぞ！' : '師範の手は気まぐれ…' })
      ])
    ]);
  }

  // ==================== 道場の地図（はじめの画面） ====================
  function refresh() {
    if (busy) return Promise.resolve();
    busy = true;
    app.showLoading('道場へ向かっています...');
    return app.call('event.status').then((s) => {
      busy = false; app.hideLoading();
      status = s; subLine();
      if (s.running && s.run) { run = s.run; cur = s.stages[s.run.stage]; }
      else run = null;
      renderHome();
    }).catch((err) => { busy = false; app.hideLoading(); errBox(err); });
  }

  function renderHome() {
    dropStage();
    const s = status, p = s.progress;
    const stages = s.stages || [];
    const map = el('div', { class: 'ev-map' }, stages.map((g, i) => {
      const done = p && (p.done || i < p.cleared), now = p && !p.done && i === p.cleared;
      return el('div', { class: 'ev-dojo' + (done ? ' done' : now ? ' now' : ' lock') }, [
        el('div', { class: 'i', text: done ? '✅' : (now ? g.icon : '🔒') }),
        el('div', { text: g.name }),
        el('div', { class: 's', text: done ? '破った！' : (now ? 'いまの道場' : g.subjectName) })
      ]);
    }));
    const kids = [el('h2', { class: 'ev-h', text: '🗺️ 道場の地図' }), map];
    if (p && !p.done) {
      const g = stages[p.cleared];
      kids.push(masterBox(g), hpBar(p.dmg, p.hp));
      if (p.dmg > 0) kids.push(el('div', { class: 'ev-sub', text: '前の挑戦でけずった HP はのこっているよ！ つづきからたたかおう' }));
    }
    const btns = el('div', { class: 'ev-btns' });
    if (p && p.done) {
      kids.push(el('div', { class: 'ev-big', text: '🎉 5つの道場を制覇した！' }));
      if (!(s.ticket > 0)) kids.push(el('p', { class: 'ev-sub', text: 'このイベントの挑戦はおしまい。次のイベントを待とう！' }));
    } else if (s.running && run) {
      btns.appendChild(el('button', { type: 'button', class: 'ev-btn red', text: '▶ 挑戦の続きから', onclick: start }));
    } else if (s.open && p) {
      const b = el('button', { type: 'button', class: 'ev-btn red', text: p.left > 0 ? '⚔️ 挑戦する（今日 のこり ' + p.left + '回）' : '今日の挑戦はおしまい（また明日）', onclick: start });
      b.disabled = !(p.left > 0);
      btns.appendChild(b);
      btns.appendChild(el('button', { type: 'button', class: 'ev-btn', text: '🃏 N のカードをえらぶ', onclick: openPicker }));
    } else {
      kids.push(el('p', { class: 'ev-sub', text: s.text || 'イベントはひらいていません。' }));
    }
    if (s.ticket > 0) btns.appendChild(el('button', { type: 'button', class: 'ev-btn gold', text: '🎫 LEGEND をえらぶ（引換札 ' + s.ticket + '枚）', onclick: openLegends }));
    kids.push(btns);
    if (s.got && s.got.length) {
      kids.push(el('h2', { class: 'ev-h', text: '🏆 もらったもの', style: 'margin-top: 16px;' }),
        el('ul', { class: 'ev-got' }, s.got.slice().reverse().map((g) => el('li', { text: g.pt ? '+' + g.pt + 'pt（LEGEND を全部持っていたので）' : '🌟 LEGEND「' + g.name + '」' }))));
    }
    const r = s.rules || {};
    kids.push(el('ul', { class: 'ev-rules' }, [
      ruleLi(['使えるのは ', el('b', { text: (r.rarities || ['N']).join('・') + ' のカード ' + (r.deck || 3) + '枚' }), ' だけ（持っていないときは、お試しカード）']),
      ruleLi(['クイズに正解すると、カードで ', el('b', { text: 'じゃんけん＋サイコロ' }), ' の攻撃！ れんぞく正解でダメージ アップ']),
      ruleLi(['まちがえると、師範の反撃で ❤️ が1つへる（1回の挑戦で ❤️' + (r.hearts || 3) + 'つ）']),
      ruleLi(['けずった師範の HP は のこる。挑戦は ', el('b', { text: '1日 ' + (r.daily || 3) + '回' }), ' まで']),
      ruleLi(['5つの道場を破ると ', el('b', { text: '🎫 LEGEND 引換札' }), '。まだ持っていない LEGEND を1枚えらべる（1つのイベントで1枚まで）'])
    ]));
    main(kids);
  }
  function ruleLi(parts) { return el('li', {}, parts); }

  // ==================== カードをえらぶ（N だけ） ====================
  function openPicker() {
    if (busy) return;
    busy = true;
    app.showLoading('カードを読みこんでいます...');
    app.call('event.cards').then((r) => {
      busy = false; app.hideLoading();
      const max = r.max || 3;
      const chosen = savedCards().filter((id) => r.cards.some((c) => c.id === id));
      const count = el('div', { class: 'ev-sub', text: '' });
      const grid = el('div', { class: 'ev-pick' });
      const draw = () => {
        grid.replaceChildren(...r.cards.map((c) => cardButton(c, chosen.indexOf(c.id) >= 0, false, () => {
          const i = chosen.indexOf(c.id);
          if (i >= 0) chosen.splice(i, 1); else if (chosen.length < max) chosen.push(c.id);
          draw();
        })));
        count.textContent = chosen.length + ' / ' + max + ' 枚';
      };
      draw();
      main([
        el('h2', { class: 'ev-h', text: '🃏 たたかう N のカードを ' + max + '枚' }),
        el('p', { class: 'ev-sub', text: 'ちがう手（✊✌️🖐️）を入れると役が作りやすい。' + max + '枚より少ないときは、ほかの N のカードやお試しカードで自動でうめるよ' }),
        r.cards.length ? grid : el('p', { class: 'ev-sub', text: 'N のカードを持っていないので、お試しカードでたたかうよ。' }),
        count,
        el('div', { class: 'ev-btns' }, [
          el('button', { type: 'button', class: 'ev-btn red', text: 'このカードで挑戦！', onclick: () => { saveCards(chosen); start(); } }),
          el('button', { type: 'button', class: 'ev-btn gray', text: 'もどる', onclick: renderHome })
        ])
      ]);
    }).catch((err) => { busy = false; app.hideLoading(); errBox(err); });
  }

  function cardButton(c, on, rest, onclick, key) {
    const kids = [];
    if (c.thumb || c.image) {
      const img = el('img', { src: c.thumb || c.image, alt: '', loading: 'lazy' });
      img.onerror = () => { if (c.imageFull && img.src !== c.imageFull) img.src = c.imageFull; else img.remove(); };
      kids.push(img);
    }
    kids.push(el('div', { class: 'h', text: ICON[c.hand] || '❓' }));
    kids.push(el('div', { class: 'n', text: c.name }));
    kids.push(el('div', { class: 'a' }, [key ? el('span', { class: 'kbd', text: key }) : null, (c.trial ? 'お試し' : c.rarity) + (c.atk ? '・ATK ' + c.atk : '')]));
    if (rest) kids.push(el('div', { class: 'r', text: '休み' }));
    const b = el('button', { type: 'button', class: 'ev-card' + (on ? ' on' : '') + (c.rarity === 'LEGEND' ? ' legend' : '') }, kids);
    b.disabled = !!rest;
    b.addEventListener('click', onclick);
    return b;
  }

  // ==================== たたかい ====================
  function start() {
    if (busy) return;
    busy = true;
    msg('');
    app.showLoading('道場の門をたたいています...');
    app.call('event.start', { cards: savedCards() }).then((r) => {
      busy = false; app.hideLoading();
      run = r.run; cur = r.stage;
      if (status) { status.progress = r.progress; subLine(); }
      if (r.resumed) msg('とちゅうの挑戦の続きからだよ。', 'ok');
      pickIdx = -1;
      battle(null, r.progress);
    }).catch((err) => {
      busy = false; app.hideLoading();
      msg('⚠️ ' + (err.message || 'はじめられませんでした'), 'error');
      refresh();
    });
  }

  // 師範の絵の入れ物は、同じ師範のあいだ使い回す（問題ごとに画面を作り直しても、絵と攻撃の演出が消えないように）
  function stageHolder(g) {
    if (!stageBox || stageName !== g.master) { dropStage(); stageBox = el('div', { class: 'ev-stage', id: 'evStage' }); }
    return stageBox;
  }
  function startStage(g) {
    if (stage && stageName === g.master) return;
    const box = stageHolder(g);
    box.textContent = '';
    if (window.KanjiFX && typeof KanjiFX.raidStage === 'function') {
      try { stage = KanjiFX.raidStage(box, { name: g.master, look: g.look || {} }); stageName = g.master; return; } catch (e) { console.error('raidStage', e); }
    }
    box.textContent = (g.look && g.look.emoji) || g.icon;   // 演出が読めないとき：絵文字の師範（攻撃はゆれで知らせる）
    stage = { hit: () => { if (box.animate) box.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], 240); return Promise.resolve(); }, destroy: () => {} };
    stageName = g.master;
  }

  function kaa() {   // まちがえたとき：師範の「喝！」（fx.js の演出ではなく、この画面の文字）
    const box = $('evStage');
    if (!box) return;
    const k = el('div', { class: 'ev-kaa', text: '喝！ ❤️−1' });
    box.appendChild(k);
    setTimeout(() => k.remove(), 700);
  }

  function hearts(n, max) { let t = ''; for (let i = 0; i < max; i++) t += i < n ? '❤️' : '🖤'; return t; }

  function handRow() {
    if (pickIdx < 0 || pickIdx === run.last) pickIdx = run.deck.findIndex((c, i) => i !== run.last);
    const row = el('div', { class: 'ev-hand' });
    const draw = () => row.replaceChildren(...run.deck.map((c, i) => cardButton(c, i === pickIdx, i === run.last, () => { pickIdx = i; draw(); }, i === run.last ? '' : '←→')));
    draw();
    row.redraw = draw;
    return row;
  }

  // result：前の問題の結果（ev-res の要素）か null。prog：今の道場の HP
  function battle(result, prog) {
    const q = run.question;
    const box = el('div', { class: 'ev-choices' });
    q.choices.forEach((c, i) => box.appendChild(el('button', { type: 'button', class: 'ev-btn', onclick: () => answer(c, box) }, [el('span', { class: 'k', text: (i + 1) + '' }), c])));
    const holder = stageHolder(cur);
    const hand = handRow();
    main([
      el('div', { class: 'ev-stat' }, [
        el('span', { text: cur.icon + ' ' + cur.name + '　師範「' + cur.master + '」' }),
        el('span', { class: 'ev-heart', text: hearts(run.hearts, run.maxHearts), 'aria-label': 'ハート ' + run.hearts }),
        el('span', { class: 'ev-combo', text: run.combo >= 2 ? '🔥 ' + run.combo + ' れんぞく正解中！' : '' })
      ]),
      hpBar(prog.dmg, prog.hp),
      holder,
      result,
      el('div', { class: 'ev-sub', text: cur.fav ? '師範は ' + ICON[cur.fav] + ' をよく出す。カードをえらんでから答えよう（前に使ったカードは休み）' : '師範の手は気まぐれ。カードをえらんでから答えよう（前に使ったカードは休み）' }),
      hand,
      el('div', { class: 'ev-q' }, [el('small', { text: '第' + q.qn + '問・' + q.subjectName + (q.era ? '（' + q.era + '）' : '') }), q.text]),
      box,
      el('div', { class: 'ev-btns' }, [el('button', { type: 'button', class: 'ev-btn gray', text: '⏸ ひと休み（続きはあとで）', onclick: () => { msg('ひと休み。続きは「挑戦の続きから」でできるよ（' + ((status && status.rules && status.rules.runHours) || 3) + '時間まで）。'); refresh(); } })])
    ]);
    root.handRow = hand;
    startStage(cur);
  }

  // 結果の1行：「✊ カード vs 師範 ✌️ → 勝ち！ 🎲5 →（500＋100）×3 ×1.2 ＝ 2,160」
  function hitBox(r) {
    const kids = [];
    if (r.correct) {
      const h = r.hit;
      const jw = h.jr === 1 ? '勝ち！ ×3' : (h.jr === 0 ? 'あいこ ×1.5' : '命中！ ×1');
      kids.push(el('div', {}, [el('span', { class: 'ok', text: '⭕ 正解！ ' }), (ICON[h.hand] || '') + ' ' + h.name + '  vs  師範 ' + (ICON[h.enemyHand] || '') + '  → ' + jw]));
      if (h.yaku) kids.push(el('div', { class: 'y', text: h.yaku.icon + ' ' + h.yaku.name + (h.yaku.fired ? ' ' + mulText(h.yaku.mul) + '！' : '（そろわなかった）') }));
      const mul = mulText(h.jankenMul) + (h.yaku && h.yaku.fired ? ' ' + mulText(h.yaku.mul) : '') + (h.comboMul > 1 ? ' ' + mulText(h.comboMul) + '（' + h.combo + 'れんぞく）' : '');
      kids.push(el('div', {}, ['🎲 出目' + h.dice + ' →（' + (h.dice * 100) + '＋ATK ' + h.atk + '）' + mul + ' ＝ ', el('b', { text: num(h.damage) + ' ダメージ' })]));
    } else {
      kids.push(el('div', {}, [el('span', { class: 'ng', text: '❌ ざんねん… ' }), '正解は「' + r.answer + '」。師範の反撃で ❤️ −1']));
    }
    if (r.explanation) kids.push(el('span', { class: 'ex', text: '📖 ' + r.explanation }));
    return el('div', { class: 'ev-res' }, kids);
  }

  function answer(choice, box) {
    if (busy || !run) return;
    busy = true;
    box.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    app.call('event.answer', { qn: run.question.qn, choice: choice, card: pickIdx }).then((r) => {
      busy = false;
      if (status && r.progress) { status.progress = r.progress; subLine(); }
      if (r.stale) { run = r.run; battle(el('div', { class: 'ev-res', text: 'その問題には、もう答えているよ。今の問題からつづけよう。' }), r.progress); return; }
      msg('');
      const res = hitBox(r);
      // 演出は 2.5秒まで待つ（タブをかくしていると演出が止まるので、結果の画面が出ないままにならないように）
      const fx = Promise.race([r.correct && stage ? stage.hit('-' + num(r.hit.damage) + (r.hit.yaku && r.hit.yaku.fired ? ' ' + r.hit.yaku.icon : '')) : Promise.resolve(),
        new Promise((ok) => setTimeout(ok, 2500))]);
      if (!r.correct) kaa();
      if (r.cleared) { fx.then(() => clearedPanel(r, res)); return; }
      if (r.lost) { setTimeout(() => lostPanel(r, res), 700); return; }
      run = r.run;
      if (pickIdx === run.last) pickIdx = -1;
      battle(res, { dmg: r.dmg, hp: r.hp });
    }).catch((err) => {
      busy = false;
      msg('⚠️ ' + (err.message || 'うまくいきませんでした'), 'error');
      if (err.code === 'NETWORK' || err.code === 'SERVER_ERROR') { box.querySelectorAll('button').forEach((b) => { b.disabled = false; }); return; }   // 同じ問題にもう一度答えられる
      run = null; refresh();
    });
  }

  function clearedPanel(r, res) {
    run = null;
    dropStage();
    if (r.done) bgm('jingle', 'fanfare'); else bgm('jingle', 'clear');
    const g = r.clearedStage, sm = r.summary || {};
    const kids = [
      el('div', { class: 'ev-big', text: r.done ? '🏯 総本山 突破！ 5つの道場を制覇した！' : '🎉 ' + g.name + ' 突破！' }),
      res,
      el('p', { class: 'ev-sub', text: 'この挑戦：正解 ' + (sm.hits || 0) + '問・まちがい ' + (sm.miss || 0) + '問・あたえたダメージ ' + num(sm.dealt) })
    ];
    const btns = el('div', { class: 'ev-btns' });
    if (r.done) {
      kids.push(el('p', { class: 'ev-sub', text: '🎫 LEGEND 引換札を手に入れた！ まだ持っていない LEGEND を1枚えらぼう！' }));
      if (status) { status.ticket = r.progress.ticket; subLine(); }
      btns.appendChild(el('button', { type: 'button', class: 'ev-btn gold', text: '🎫 LEGEND をえらぶ', onclick: openLegends }));
    } else {
      if (r.next) kids.push(el('p', { class: 'ev-sub', text: '次は ' + r.next.icon + ' ' + r.next.name + '（' + r.next.subjectName + '）。師範「' + r.next.master + '」が待っている！' }));
      const left = r.progress ? r.progress.left : 0;
      const b = el('button', { type: 'button', class: 'ev-btn red', text: left > 0 ? '⚔️ 次の道場へ（今日 のこり ' + left + '回）' : '今日の挑戦はおしまい（また明日）', onclick: start });
      b.disabled = !(left > 0);
      btns.appendChild(b);
    }
    btns.appendChild(el('button', { type: 'button', class: 'ev-btn gray', text: '🗺️ 道場の地図', onclick: refresh }));
    kids.push(btns);
    main(kids);
  }

  function lostPanel(r, res) {
    run = null;
    dropStage();
    bgm('jingle', 'lose');
    const sm = r.summary || {}, left = r.progress ? r.progress.left : 0;
    const b = el('button', { type: 'button', class: 'ev-btn red', text: left > 0 ? '⚔️ もう一度（今日 のこり ' + left + '回）' : '今日の挑戦はおしまい（また明日）', onclick: start });
    b.disabled = !(left > 0);
    main([
      el('div', { class: 'ev-big', text: '❤️ がなくなった… ひきあげ！' }),
      res,
      el('p', { class: 'ev-sub', text: 'この挑戦：正解 ' + (sm.hits || 0) + '問・あたえたダメージ ' + num(sm.dealt) + '。けずった HP は のこっているよ（あと ' + num(Math.max(0, r.hp - r.dmg)) + '）。' }),
      el('div', { class: 'ev-btns' }, [b, el('button', { type: 'button', class: 'ev-btn gray', text: '🗺️ 道場の地図', onclick: refresh })])
    ]);
  }

  // ==================== LEGEND をえらぶ（引換札） ====================
  function openLegends() {
    if (busy) return;
    busy = true;
    app.showLoading('LEGEND の蔵をあけています...');
    app.call('event.legends').then((r) => {
      busy = false; app.hideLoading();
      if (r.allOwned) {
        main([
          el('h2', { class: 'ev-h', text: '🎫 LEGEND 引換札' }),
          el('p', { class: 'ev-sub', text: 'すごい！ えらべる LEGEND を全部持っているよ。引換札は ' + r.points + 'pt にかえられる。' }),
          el('div', { class: 'ev-btns' }, [
            el('button', { type: 'button', class: 'ev-btn gold', text: '💰 ' + r.points + 'pt にかえる', onclick: () => claim({ points: true }) }),
            el('button', { type: 'button', class: 'ev-btn gray', text: 'もどる', onclick: refresh })
          ])
        ]);
        return;
      }
      let chosen = null;
      const okBtn = el('button', { type: 'button', class: 'ev-btn gold', text: 'カードをえらんでね', onclick: () => { if (chosen) claim({ card: chosen.id }, chosen); } });
      okBtn.disabled = true;
      const grid = el('div', { class: 'ev-pick' });
      const draw = () => grid.replaceChildren(...r.cards.map((c) => cardButton(c, chosen === c, false, () => {
        chosen = c; okBtn.disabled = false; okBtn.textContent = '🌟「' + c.name + '」にする！';
        draw();
      })));
      draw();
      main([
        el('h2', { class: 'ev-h', text: '🎫 LEGEND を1枚えらぼう（引換札 ' + r.ticket + '枚）' }),
        el('p', { class: 'ev-sub', text: 'ここに出るのは、まだ持っていない LEGEND だけ。えらんだら、もうかえられないよ。' }),
        grid,
        el('div', { class: 'ev-btns' }, [okBtn, el('button', { type: 'button', class: 'ev-btn gray', text: 'あとでえらぶ', onclick: refresh })])
      ]);
    }).catch((err) => { busy = false; app.hideLoading(); errBox(err); });
  }

  function claim(params, card) {
    if (busy) return;
    if (card && !window.confirm('「' + card.name + '」にする？（あとから かえられないよ）')) return;
    busy = true;
    app.showLoading('引換札をわたしています...');
    app.call('event.claim', params).then((r) => {
      busy = false; app.hideLoading();
      if (status) status.ticket = r.ticket;
      subLine();
      if (r.points) {
        bgm('jingle', 'get');
        main([el('div', { class: 'ev-big', text: '💰 +' + r.points + 'pt！' }), el('p', { class: 'ev-sub', text: '今のポイント：' + num(r.balance) + 'pt' }),
          el('div', { class: 'ev-btns' }, [el('button', { type: 'button', class: 'ev-btn', text: '🗺️ 道場の地図', onclick: refresh })])]);
        return;
      }
      reveal(r.card).then(() => {
        bgm('jingle', 'get');
        main([
          el('div', { class: 'ev-big', text: '🌟 LEGEND「' + r.card.name + '」を手に入れた！' }),
          el('div', { class: 'ev-pick', style: 'max-width: 180px; margin: 0 auto 10px;' }, [cardButton(r.card, true, false, () => {})]),
          el('p', { class: 'ev-sub', text: '図鑑やバトルで使えるよ（このイベントの道場では N のカードだけ）。' }),
          el('div', { class: 'ev-btns' }, [el('button', { type: 'button', class: 'ev-btn', text: '🗺️ 道場の地図', onclick: refresh })])
        ]);
      });
    }).catch((err) => { busy = false; app.hideLoading(); msg('⚠️ ' + (err.message || 'うまくいきませんでした'), 'error'); openLegends(); });
  }

  // パック開封の演出（fx.js の gachaOpen）。読めない・時間がかかりすぎるときは、とばす
  function reveal(c) {
    if (!(window.KanjiFX && typeof KanjiFX.gachaOpen === 'function')) return Promise.resolve();
    const ov = el('div', { class: 'ev-ov' }), host = el('div', {});
    ov.appendChild(host); document.body.appendChild(ov);
    const card = { name: c.name, rarity: c.rarity, hand: c.hand, imageUrl: c.image || c.imageFull || '', imageUrlFull: c.imageFull || '', isNew: true, line: c.line || '' };
    const open = Promise.resolve().then(() => KanjiFX.gachaOpen(host, { results: [card], packColor: '#ffec27', packName: 'LEGEND 引換札' })).catch((e) => console.error('gachaOpen', e));
    const limit = new Promise((ok) => setTimeout(ok, 120000));
    return Promise.race([open, limit]).then(() => { ov.remove(); });
  }

  // ==================== キーボード：1〜4 で答える・← → でカード ====================
  function onKey(e) {
    if (!root || root.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!run || !$('evStage')) return;
    if (/^[1-4]$/.test(e.key)) {
      const btn = root.querySelectorAll('.ev-choices .ev-btn')[+e.key - 1];
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && root.handRow) {
      e.preventDefault();
      const n = run.deck.length, step = e.key === 'ArrowRight' ? 1 : -1;
      let i = pickIdx;
      for (let k = 0; k < n; k++) { i = (i + step + n) % n; if (i !== run.last) break; }
      pickIdx = i; root.handRow.redraw();
    }
  }

  window.KanjiEvent = {
    open(api) {
      app = api;
      build();
      msg('');
      app.showView('event');
      refresh();
    }
  };
})();
