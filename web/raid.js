/* ===============================================================
   漢字の刃｜巨大レイドボス（週末・月末だけ。マイページの知らせを押すと app.js が読み込む）
   ・攻撃に使うカードを3枚えらぶ → 問題ごとに1枚えらんでから答える → 正解すると、じゃんけん＋サイコロで攻撃
     ダメージ＝（出目×100 ＋ カードの ATK）× じゃんけん（勝ち×3・あいこ×1.5・負け×1）× 役（3回の手の並び）
   ・正解・ボスの手・サイコロ・ダメージ・ごほうびは、すべてサーバー（Api.gs の raid.*）が決める。この画面は見せるだけ
   ・前の版で来たボス（サーバーが dice: false と返す）は、前のとおり 1問1ダメージ
   ・ボスの絵とレーザーは fx/fx.js の raidStage（読めないときは絵文字のボスで動く）
   =============================================================== */
(function () {
  'use strict';
  let app = null, root = null, stage = null, token = null, busy = false, combo = 0, hits = 0, last = null;
  let deck = null, rest = -1, pickIdx = -1, fav = '';
  const CARDS_KEY = 'kanji_raid_cards_v1';   // えらんだ3枚（このブラウザだけ。持っているかはサーバーが毎回確かめる）
  const ICON = { 'グー': '✊', 'チョキ': '✌️', 'パー': '🖐️' };

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
  .rd-hint { font-size: 0.85rem; color: #fcd34d; margin: 4px 0 8px; line-height: 1.5; }
  .rd-hand { display: flex; gap: 8px; justify-content: center; margin: 6px 0 10px; }
  .rd-card { position: relative; flex: 1 1 0; max-width: 150px; min-width: 0; padding: 8px 6px; border-radius: 12px; border: 2px solid #475569; background: rgba(15, 23, 42, 0.7); color: #fff; font: inherit; cursor: pointer; text-align: center; }
  .rd-card.on { border-color: #fde047; box-shadow: 0 0 0 3px rgba(253, 224, 71, 0.35); }
  .rd-card:disabled { opacity: 0.4; cursor: default; }
  .rd-card .h { font-size: 1.6rem; line-height: 1.2; }
  .rd-card .n { font-size: 0.78rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rd-card .a { font-size: 0.72rem; color: #fcd34d; }
  .rd-card .r { position: absolute; top: 4px; right: 6px; font-size: 0.65rem; color: #fca5a5; font-weight: 900; }
  .rd-card img { width: 100%; max-width: 72px; aspect-ratio: 1; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto 4px; }
  .rd-hit { margin: 6px 0 2px; padding: 8px 10px; border-radius: 10px; background: rgba(0, 0, 0, 0.35); font-size: 0.95rem; line-height: 1.6; }
  .rd-hit b { color: #fde047; font-size: 1.15rem; }
  .rd-yaku { color: #f0abfc; font-weight: 900; }
  .rd-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; max-height: 50vh; overflow-y: auto; margin: 8px 0; }
  .rd-pick .rd-card { max-width: none; }
  @media (max-width: 480px) { .rd-choices { grid-template-columns: 1fr; } .rd-card .n { font-size: 0.7rem; } }
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

  // 大きな数：1万2,345・1億2,345万
  function fmt(v) {
    v = Math.max(0, Math.round(Number(v) || 0));
    const units = [[1e12, '兆'], [1e8, '億'], [1e4, '万']];
    for (let i = 0; i < units.length; i++) {
      const u = units[i][0];
      if (v >= u) {
        const top = Math.floor(v / u), rest = Math.floor((v % u) / (u / 1e4));
        return top.toLocaleString('ja-JP') + units[i][1] + (rest ? rest.toLocaleString('ja-JP') + (units[i + 1] ? units[i + 1][1] : '') : '');
      }
    }
    return v.toLocaleString('ja-JP');
  }
  function mulText(m) { return '×' + (Math.round(m * 10) / 10); }

  function savedCards() {
    try { const v = JSON.parse(localStorage.getItem(CARDS_KEY) || '[]'); return Array.isArray(v) ? v.map(String).slice(0, 3) : []; } catch (e) { return []; }
  }
  function saveCards(ids) {
    try { localStorage.setItem(CARDS_KEY, JSON.stringify(ids)); } catch (e) { /* 保存できなくても、そのまま遊べる */ }
  }

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
    $('rdHpText').textContent = 'HP ' + fmt(left) + ' / ' + (last.maxHp ? fmt(last.maxHp) : '?') + '（クラスのダメージ ' + fmt(last.damage || 0) + '）';
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
    return el('ol', { class: 'rd-top' }, s.top.map((p) => el('li', {
      class: p.isMe ? 'me' : '',
      text: p.nickname + '：' + fmt(p.damage) + ' ダメージ' + (p.hits ? '（正解 ' + p.hits + '問）' : '') + (p.isMe ? '（あなた）' : '')
    })));
  }

  function hintText() {
    return (fav ? 'ボスは ' + ICON[fav] + ' をよく出すぞ！ ' : 'ボスの手は気まぐれ… ') + '3回の手の並びで役（✊→✌️→🖐️ 正順の輪 ×10 など）';
  }

  // 上の行：参加した人・正解のポイント（今日のぶん）・倒したときのごほうび
  let sub = null;
  function subText() {
    if (!sub) return;
    $('rdSub').textContent = '参加した人 ' + sub.participants + '人・正解1問 ' + sub.hitPt + 'pt（今日 ' + sub.dayPt + ' / ' + sub.dayMax + 'pt）・倒したら1問でも正解した人に ' + sub.reward + 'pt（トドメは +' + sub.finishReward + 'pt）';
  }

  function refresh() {
    app.showLoading('ボスのようすを見ています...');
    return app.call('raid.status').then((s) => {
      app.hideLoading();
      if (!s.active) {
        $('rdTitle').textContent = 'ボスは来ていないよ';
        panel([el('p', { text: '巨大ボスが来るのは、土・日と月末の3日間（' + (s.next && s.next.hours ? s.next.hours : '朝から夜まで') + '）。' }),
          el('div', { class: 'rd-q', text: s.next ? '次は ' + s.next.text + ' から！' : '次の襲来を待とう！' })]);
        return;
      }
      fav = s.fav || '';
      $('rdTitle').textContent = '⚠️ ' + s.label + '「' + s.boss + '」';
      sub = s; subText();
      $('rdMe').textContent = 'あなたのダメージ：' + fmt(s.my) + (s.myHits ? '（正解 ' + s.myHits + '問）' : '');
      setHp(s);
      startStage(s.boss);
      if (s.defeated) {
        panel([el('div', { class: 'rd-q', text: '🎉 ' + s.boss + ' を倒した！' }), el('p', { text: (s.finisher ? 'トドメ：' + s.finisher + (s.finisherIsMe ? '（あなた！）' : '') : '') }),
          s.next ? el('p', { text: '次の巨大ボスは ' + s.next.text + ' から！' }) : null, renderTop(s)]);
        return;
      }
      if (!s.dice) {   // 前の版で来たボス
        panel([
          el('p', { text: '漢字クイズに正解するたび「漢字ミサイル」が命中！' }),
          el('div', { class: 'rd-acts' }, [el('button', { type: 'button', class: 'go', text: '🚀 攻撃開始！', onclick: attack })]),
          renderTop(s)
        ]);
        return;
      }
      panel([
        el('p', { text: '問題の前に、攻撃するカードを1枚えらぼう。正解すると、じゃんけん＋サイコロで攻撃！（じゃんけんに負けても、正解ならダメージは入る）' }),
        el('div', { class: 'rd-hint', text: hintText() }),
        el('div', { class: 'rd-acts' }, [
          el('button', { type: 'button', class: 'go', text: '🚀 攻撃開始！', onclick: attack }),
          el('button', { type: 'button', text: '🃏 攻撃のカードをえらぶ', onclick: openPicker })
        ]),
        renderTop(s)
      ]);
    }).catch((err) => { app.hideLoading(); panel([el('p', { class: 'rd-ng', text: '⚠️ ' + (err.message || '読みこめませんでした') })]); });
  }

  // 攻撃に使う3枚をえらぶ（持っているカードはサーバーから）
  function openPicker() {
    if (busy) return;
    busy = true;
    app.showLoading('カードを読みこんでいます...');
    app.call('raid.cards').then((r) => {
      busy = false; app.hideLoading();
      const max = r.max || 3;
      const chosen = savedCards().filter((id) => r.cards.some((c) => c.id === id));
      const msg = el('div', { class: 'rd-msg', text: '' });
      const grid = el('div', { class: 'rd-pick' });
      const draw = () => {
        grid.replaceChildren(...r.cards.map((c) => {
          const on = chosen.indexOf(c.id) >= 0;
          return cardButton(c, on, false, () => {
            const i = chosen.indexOf(c.id);
            if (i >= 0) chosen.splice(i, 1);
            else if (chosen.length < max) chosen.push(c.id);
            msg.textContent = chosen.length + ' / ' + max + ' 枚';
            draw();
          });
        }));
        msg.textContent = chosen.length + ' / ' + max + ' 枚';
      };
      draw();
      panel([
        el('div', { class: 'rd-q', text: '🃏 攻撃に使うカードを ' + max + ' 枚えらぼう' }),
        el('div', { class: 'rd-hint', text: 'ちがう手（✊✌️🖐️）を入れると役が作りやすい。' + max + '枚より少ないときは、強いカードやお試しカードで自動でうめるよ' }),
        r.cards.length ? grid : el('p', { text: 'まだカードを持っていないので、お試しカードで戦うよ。' }),
        msg,
        el('div', { class: 'rd-acts' }, [
          el('button', { type: 'button', class: 'go', text: 'このカードで攻撃！', onclick: () => { saveCards(chosen); attack(); } }),
          el('button', { type: 'button', text: 'もどる', onclick: refresh })
        ])
      ]);
    }).catch((err) => { busy = false; app.hideLoading(); panel([el('p', { class: 'rd-ng', text: '⚠️ ' + (err.message || '読みこめませんでした') })]); });
  }

  function cardButton(c, on, disabled, onclick) {
    const kids = [];
    if (c.image) {
      const img = el('img', { src: c.image, alt: '', loading: 'lazy' });
      img.onerror = () => img.remove();
      kids.push(img);
    }
    kids.push(el('div', { class: 'h', text: ICON[c.hand] || '❓' }));
    kids.push(el('div', { class: 'n', text: c.name }));
    kids.push(el('div', { class: 'a', text: (c.trial ? 'お試し' : c.rarity) + '・ATK ' + c.atk }));
    if (disabled) kids.push(el('div', { class: 'r', text: '休み' }));
    const b = el('button', { type: 'button', class: 'rd-card' + (on ? ' on' : '') }, kids);
    b.disabled = !!disabled;
    b.addEventListener('click', onclick);
    return b;
  }

  function attack() {
    if (busy) return;
    busy = true;
    app.call('raid.start', { cards: savedCards() }).then((q) => {
      busy = false;
      token = q.token; combo = 0;
      deck = q.dice ? q.deck : null; rest = q.last === undefined ? -1 : q.last; pickIdx = -1;
      if (q.fav !== undefined) fav = q.fav;
      if (deck) saveCards(deck.filter((c) => !c.trial).map((c) => c.id));
      setHp(q);
      question(q, '');
    }).catch((err) => { busy = false; panel([el('p', { class: 'rd-ng', text: '⚠️ ' + (err.message || 'はじめられませんでした') })]); });
  }

  // 問題で使えるカード（前の問題で使ったカードは休み）
  function handRow() {
    if (!deck) return null;
    if (pickIdx < 0 || pickIdx === rest) pickIdx = deck.findIndex((c, i) => i !== rest);
    const row = el('div', { class: 'rd-hand' });
    const draw = () => row.replaceChildren(...deck.map((c, i) => cardButton(c, i === pickIdx, i === rest, () => { pickIdx = i; draw(); })));
    draw();
    return row;
  }

  function question(q, msg, cls, extra) {
    const box = el('div', { class: 'rd-choices' });
    q.choices.forEach((c) => box.appendChild(el('button', { type: 'button', text: c, onclick: () => answer(c, box) })));
    panel([
      el('div', { class: 'rd-msg ' + (cls || ''), text: msg || (combo >= 2 ? '🔥 ' + combo + ' 連続命中中！' : (deck ? '攻撃するカードをえらんで、答えよう！' : '漢字ミサイル発射よーい！')) }),
      extra || null,
      deck ? el('div', { class: 'rd-hint', text: hintText() }) : null,
      handRow(),
      el('div', { class: 'rd-q', text: q.question }),
      box,
      el('div', { class: 'rd-acts' }, [el('button', { type: 'button', text: '⏸ ひと休み', onclick: refresh })])
    ]);
  }

  // 攻撃の結果：「✊ vs ✌️ 勝ち！ 出目5 →（500＋300）×3 ＝ 2,400」
  function hitBox(h) {
    const jw = h.jr === 1 ? '勝ち！' : (h.jr === 0 ? 'あいこ' : '負け…でも命中！');
    const lines = [
      el('div', { text: (ICON[h.hand] || '') + ' ' + h.name + '  vs  ボス ' + (ICON[h.bossHand] || '') + '  → ' + jw })
    ];
    if (h.yaku) lines.push(el('div', { class: 'rd-yaku', text: h.yaku.icon + ' ' + h.yaku.name + (h.yaku.fired ? ' ' + mulText(h.yaku.mul) + '！' : '（そろわなかった）') }));
    const mul = mulText(h.jankenMul) + (h.yaku && h.yaku.fired ? ' ' + mulText(h.yaku.mul) : '');
    lines.push(el('div', {}, ['🎲 出目' + h.dice + ' →（' + (h.dice * 100) + '＋ATK ' + h.atk + '）' + mul + ' ＝ ', el('b', { text: fmt(h.damage) })]));
    return el('div', { class: 'rd-hit' }, lines);
  }

  function answer(choice, box) {
    if (busy) return;
    busy = true;
    box.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const params = { token: token, choice: choice };
    if (deck) params.card = pickIdx;
    app.call('raid.answer', params).then((r) => {
      busy = false;
      setHp(r);
      if (r.last !== undefined) rest = r.last;
      const dmg = r.hit ? r.hit.damage : 1;
      if (r.correct) { combo++; hits++; $('rdMe').textContent = 'この挑戦での命中：' + hits; }
      else combo = 0;
      const fx = r.correct ? stage.hit('-' + fmt(dmg) + (r.hit && r.hit.yaku && r.hit.yaku.fired ? ' ' + r.hit.yaku.icon : '')) : stage.miss();
      const extra = r.hit ? hitBox(r.hit) : null;
      if (r.defeated) {
        fx.then(() => stage.defeat()).then(() => {
          panel([
            el('div', { class: 'rd-q', text: r.finishedByMe ? '⚡ あなたがトドメをさした！' : '🎉 クラスのみんなでボスを倒した！' }),
            r.finishedByMe ? extra : null,
            el('p', { text: r.finishedByMe && r.reward ? 'ごほうび ' + r.reward + 'pt！（参加した人みんなにもポイント）' : '1問でも正解した人には、ポイントのごほうび！' }),
            el('div', { class: 'rd-acts' }, [el('button', { type: 'button', class: 'go', text: '活やくランキングを見る', onclick: refresh })])
          ]);
        });
        return;
      }
      if (sub && r.dayPt !== undefined) { sub.dayPt = r.dayPt; subText(); }
      const pt = r.point === undefined ? '' : (r.point > 0 ? ' ＋' + r.point + 'pt（今日 ' + r.dayPt + ' / ' + r.dayMax + 'pt）' : '（今日のポイントは上限。攻撃はできるよ）');
      question(r, r.correct ? '💥 命中！ ボスに ' + fmt(dmg) + ' ダメージ！' + pt : '🛡️ はずれ…（正解は「' + r.answer + '」）', r.correct ? 'rd-ok' : 'rd-ng', extra);
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
