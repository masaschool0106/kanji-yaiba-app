/* ===============================================================
   漢字の刃｜友だちとカードを交換（app.js が、開いたときだけ読み込む。2026-11-04）
   ・申しこみ → 相手が「交換する」を押すと成立。同じレアリティどうしだけ・1人1日の上限あり
   ・だれが交換するかは、ログインの合言葉からサーバーが決める。この画面は、えらんだものを送るだけ
     （持っているか・レアリティ・上限・成立は、全部サーバーが確かめる）
   ・名前やカード名は textContent で出す（innerHTML に入れない）
   =============================================================== */
(function () {
  'use strict';
  let app = null, root = null, home = null, pick = null, busy = false;
  // pick：{ friend, data（trade.cards の答え）, rarity, give, get }

  // 江戸風のドット絵（2026-11-05）：板は木の枠＋藍色の市松もよう、見出しは木の札、申しこみは和紙の手紙、小窓は巻物。
  //   背景の絵（夕ぐれの太鼓橋）は app.js が fx/pixel.js で出す。色は PICO-8 の16色だけ・角は四角・ぼかしなし
  const CSS = `
  body.view-trade { padding: 16px 14px 110px; }
  #view-trade .container { max-width: 880px; margin: 0 auto; }
  .tr-box { position: relative; padding: 18px 18px 16px; margin: 0 8px 26px; color: var(--white);
    background: repeating-conic-gradient(#1d2b53 0 25%, #18244a 0 50%) 0 0 / 16px 16px;
    box-shadow: 0 0 0 4px var(--brown), 0 0 0 8px var(--k), inset 0 4px 0 rgba(255, 255, 255, 0.12), inset 0 -4px 0 rgba(0, 0, 0, 0.3);
    animation: pxEnter 0.28s steps(4) both; }
  .tr-box::before, .tr-box::after { content: ''; position: absolute; top: -8px; width: 12px; height: 12px; background: var(--lgray); box-shadow: inset -3px -3px 0 var(--gray); pointer-events: none; }
  .tr-box::before { left: -8px; } .tr-box::after { right: -8px; }
  .tr-head { margin-top: 34px; }
  .tr-head::before { left: -18px; right: -18px; top: -34px; width: auto; height: 18px; background: repeating-linear-gradient(90deg, var(--gray) 0 10px, var(--k) 10px 12px);
    box-shadow: 0 -4px 0 var(--k), 0 4px 0 var(--k), inset 0 -4px 0 rgba(0, 0, 0, 0.35), inset 0 4px 0 rgba(255, 255, 255, 0.2); }
  .tr-head::after { display: none; }
  .tr-title { display: flex; align-items: center; gap: 14px; font-family: var(--px-font); font-size: 28px; color: var(--white); text-shadow: 3px 3px 0 var(--k); margin: 0 0 10px; }
  .tr-stamp { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: var(--red); color: var(--white);
    font-size: 26px; text-shadow: none; box-shadow: inset 0 0 0 3px var(--white), 0 0 0 3px var(--red), 0 0 0 6px var(--k); }
  .tr-h { display: inline-block; font-family: var(--px-font); font-size: 20px; font-weight: normal; color: var(--white); text-shadow: 2px 2px 0 var(--k); margin: 0 0 14px; padding: 4px 14px;
    background: var(--brown); box-shadow: 0 0 0 3px var(--k), inset 0 3px 0 rgba(255, 255, 255, 0.2), inset 0 -3px 0 rgba(0, 0, 0, 0.3); }
  .tr-note { font-size: 15px; line-height: 1.7; color: var(--lgray); }
  .tr-note b { color: var(--yellow); }
  .tr-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .tr-btn { font-family: var(--px-font); font-size: 17px; min-height: 48px; padding: 8px 16px; border: none; border-radius: 0; cursor: pointer;
    color: var(--white); background: var(--dblue); text-shadow: 2px 2px 0 var(--k); box-shadow: 0 4px 0 var(--k), inset 0 -4px 0 rgba(0, 0, 0, 0.25); touch-action: manipulation; }
  .tr-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--k); }
  .tr-btn:disabled { opacity: 0.45; cursor: default; transform: none; }
  .tr-btn.green { background: var(--green); } .tr-btn.gray { background: var(--gray); } .tr-btn.plum { background: var(--plum); }
  .tr-btn.orange { background: var(--orange); color: var(--k); text-shadow: none; }
  .tr-msg { margin: 0 8px 26px; padding: 10px 14px; font-size: 17px; font-weight: bold; background: var(--k); box-shadow: 0 0 0 4px var(--white); }
  .tr-msg:empty { display: none; }
  .tr-msg.error { color: var(--pinkpx); } .tr-msg.ok { color: var(--lime); }
  .tr-empty { color: var(--lgray); font-size: 15px; padding: 6px 0; }
  .tr-offer { position: relative; background: var(--white); color: var(--k); padding: 12px 14px; margin-bottom: 16px; box-shadow: 0 0 0 3px var(--k), 5px 5px 0 3px rgba(0, 0, 0, 0.45); }
  .tr-offer::after { content: '文'; position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    font-family: var(--px-font); font-size: 17px; color: var(--white); background: var(--red); box-shadow: inset 0 0 0 2px var(--white); }
  .tr-offer .tr-who { padding-right: 36px; }
  .tr-who { font-size: 17px; margin-bottom: 8px; overflow-wrap: anywhere; }
  .tr-pair { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; max-width: 420px; }
  .tr-arrow { font-size: 26px; color: var(--yellow); }
  .tr-offer .tr-arrow, .tr-mbox .tr-arrow { color: var(--red); }
  .tr-lab { font-size: 13px; color: var(--lgray); text-align: center; margin-bottom: 4px; }
  .tr-offer .tr-lab, .tr-mbox .tr-lab { color: var(--gray); }
  .tr-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; width: 100%; box-sizing: border-box;
    background: var(--brown); color: var(--white); border: none; border-radius: 0; font: inherit; box-shadow: 0 0 0 3px var(--k); }
  button.tr-card { cursor: pointer; box-shadow: 0 0 0 3px var(--k), 0 5px 0 3px var(--k); touch-action: manipulation; }
  button.tr-card:active { transform: translateY(3px); box-shadow: 0 0 0 3px var(--k), 0 2px 0 3px var(--k); }
  button.tr-card.on { background: var(--red); box-shadow: 0 0 0 3px var(--yellow), 0 0 0 6px var(--k), 0 5px 0 6px var(--k); }
  .tr-pic { width: 84px; aspect-ratio: 600 / 849; background: var(--gray); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--white); box-shadow: 0 0 0 2px var(--k); }
  .tr-pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tr-name { font-size: 14px; line-height: 1.3; text-align: center; overflow-wrap: anywhere; text-shadow: 1px 1px 0 var(--k); }
  .tr-rar { display: inline-block; font-size: 12px; padding: 1px 6px; background: var(--gray); color: var(--white); }
  .tr-rar.r { background: var(--dblue); } .tr-rar.sr { background: var(--lav); } .tr-rar.ssr { background: var(--pinkpx); color: var(--k); }
  .tr-rar.ur { background: var(--red); } .tr-rar.legend { background: var(--yellow); color: var(--k); }
  .tr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px; margin-bottom: 14px; }
  .tr-friends { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .tr-friends .tr-btn { text-align: left; overflow-wrap: anywhere; background: var(--peach); color: var(--k); text-shadow: none; }
  .tr-friends small { display: block; font-size: 12px; color: var(--gray); }
  .tr-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 14px; }
  .tr-chips .tr-btn { font-size: 16px; min-height: 44px; background: var(--gray); }
  .tr-chips .tr-btn.on { background: var(--orange); color: var(--k); text-shadow: none; }
  .tr-step { font-size: 16px; margin: 10px 0 10px; color: var(--yellow); text-shadow: 2px 2px 0 var(--k); }
  .tr-sum { margin-top: 4px; padding: 12px 14px; background: var(--white); color: var(--k); font-size: 16px; line-height: 1.6; box-shadow: 0 0 0 3px var(--k); }
  .tr-res { padding: 8px 10px 8px 18px; background: var(--white); color: var(--k); margin-bottom: 10px; font-size: 15px; line-height: 1.5; overflow-wrap: anywhere;
    box-shadow: inset 6px 0 0 var(--red), 0 0 0 2px var(--k); }
  .tr-modal { position: fixed; inset: 0; z-index: 10002; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; padding: 34px 20px; box-sizing: border-box; }
  .tr-modal[hidden] { display: none; }
  .tr-mbox { width: 100%; max-width: 480px; max-height: calc(100vh - 68px); overflow-y: auto; background: var(--white); color: var(--k); padding: 20px 18px; text-align: center;
    box-shadow: 0 0 0 4px var(--k), 0 -14px 0 4px var(--brown), 0 14px 0 4px var(--brown), 0 -14px 0 8px var(--k), 0 14px 0 8px var(--k); font-size: 17px; line-height: 1.6; }
  .tr-mbox .tr-title { justify-content: center; color: var(--red); text-shadow: 2px 2px 0 var(--k); }
  .tr-mbox .tr-pic { width: 150px; margin: 10px auto; }
  .tr-mbox > .tr-card { width: auto; max-width: 190px; margin: 8px auto 14px; }
  .tr-mbox .tr-pair { margin: 0 auto 8px; } .tr-mbox .tr-pair .tr-pic { width: 96px; margin: 0 auto; }
  .tr-mbox .tr-btns { justify-content: center; }
  @media (max-width: 600px) { .tr-pic { width: 64px; } .tr-grid { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); } .tr-title { font-size: 22px; } .tr-box { padding: 14px 12px; } }
  @media (prefers-reduced-motion: reduce) { .tr-btn:active, button.tr-card:active { transform: none; } .tr-box { animation: none; } }
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
  const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };
  const rarClass = (r) => { const s = String(r || '').toUpperCase().replace(/\+/g, ''); return ({ R: 'r', SR: 'sr', SSR: 'ssr', UR: 'ur', LEGEND: 'legend' })[s] || ''; };

  // カード1枚（小さい画像 → 大きい画像 → 番号の順に出す）
  function cardEl(c, onclick, on) {
    const box = el(onclick ? 'button' : 'div', { class: 'tr-card' + (on ? ' on' : '') });
    if (onclick) { box.type = 'button'; box.addEventListener('click', onclick); box.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    const pic = el('div', { class: 'tr-pic' });
    const srcs = [c.thumb, c.image].filter(Boolean);
    if (srcs.length) {
      let k = 0;
      const img = el('img', { alt: '', loading: 'lazy', decoding: 'async' });
      img.addEventListener('error', () => { k++; if (k < srcs.length) img.src = srcs[k]; else { img.remove(); pic.textContent = 'No.' + c.no; } });
      img.src = srcs[0];
      pic.appendChild(img);
    } else pic.textContent = 'No.' + c.no;
    box.appendChild(pic);
    box.appendChild(el('div', { class: 'tr-name', text: c.name }));
    if (c.rarity) box.appendChild(el('span', { class: 'tr-rar ' + rarClass(c.rarity), text: c.rarity }));
    return box;
  }

  function pairEl(leftLab, left, rightLab, right) {
    return el('div', { class: 'tr-pair' }, [
      el('div', {}, [el('div', { class: 'tr-lab', text: leftLab }), cardEl(left)]),
      el('div', { class: 'tr-arrow', text: '⇄', 'aria-hidden': 'true' }),
      el('div', {}, [el('div', { class: 'tr-lab', text: rightLab }), cardEl(right)])
    ]);
  }

  function msg(text, kind) {
    const m = $('trMsg');
    m.textContent = text || '';
    m.className = 'tr-msg' + (kind ? ' ' + kind : '');
  }

  // 確かめの小窓。buttons：[{ text, cls, fn }]
  function modal(children, buttons) {
    const box = clear($('trModalBox'));
    children.forEach((c) => { if (c) box.appendChild(typeof c === 'string' ? el('p', { text: c }) : c); });
    const row = el('div', { class: 'tr-btns' });
    buttons.forEach((b) => row.appendChild(el('button', { type: 'button', class: 'tr-btn ' + (b.cls || ''), text: b.text, onclick: () => { closeModal(); if (b.fn) b.fn(); } })));
    box.appendChild(row);
    $('trModal').hidden = false;
    const first = row.querySelector('button');
    if (first) first.focus();
  }
  function closeModal() { $('trModal').hidden = true; }

  function build() {
    if (root) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('section', { id: 'view-trade', class: 'app-view', hidden: '' }, [
      el('div', { class: 'container' }, [
        el('div', { class: 'tr-box tr-head' }, [
          el('h2', { class: 'tr-title' }, [el('span', { class: 'tr-stamp', text: '交', 'aria-hidden': 'true' }), '友だちと交換']),
          el('div', { class: 'tr-note', id: 'trNote' }),
          el('div', { class: 'tr-btns' }, [
            el('button', { type: 'button', class: 'tr-btn', text: '🔄 さいしんにする', onclick: () => load() }),
            el('button', { type: 'button', class: 'tr-btn orange', text: '🔁 交換のページへ', onclick: () => app.navigate('koukan') }),
            el('button', { type: 'button', class: 'tr-btn gray', text: '🏠 マイページへ', onclick: () => app.openMypage() })
          ])
        ]),
        el('div', { class: 'tr-msg', id: 'trMsg', role: 'status', 'aria-live': 'polite' }),
        el('div', { class: 'tr-box', id: 'trIn' }),
        el('div', { class: 'tr-box', id: 'trNew' }),
        el('div', { class: 'tr-box', id: 'trOut' }),
        el('div', { class: 'tr-box', id: 'trRes' })
      ]),
      el('div', { class: 'tr-modal', id: 'trModal', hidden: '', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target.id === 'trModal') closeModal(); } }, [
        el('div', { class: 'tr-mbox', id: 'trModalBox' })
      ])
    ]);
    document.body.appendChild(root);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root && !$('trModal').hidden) { e.preventDefault(); closeModal(); } });
  }

  // ---------- サーバーとのやりとり ----------
  function send(action, params, then) {
    if (busy) return;
    busy = true;
    app.showLoading('通信中...');
    app.call(action, params || {})
      .then((res) => { if (then) then(res); })
      .catch((err) => { if (err.code !== 'AUTH_EXPIRED') msg(err.message, 'error'); })
      .finally(() => { busy = false; app.hideLoading(); });
  }

  function load() {
    msg('');
    send('trade.home', {}, (res) => { home = res; render(); });
  }

  function after(res, kind) {
    if (res.home) { home = res.home; }
    if (res.result === 'done' && res.card) {
      if (window.KanjiBgm && window.KanjiBgm.jingle) window.KanjiBgm.jingle('get');   // 交換成立の短い音楽。終わると交換の画面の音楽にもどる
      modal([el('div', { class: 'tr-title', text: '🎉 交換成立！' }), cardEl(res.card), res.msg], [{ text: 'やったね！', cls: 'green' }]);
      msg(res.msg, 'ok');
    } else msg(res.msg || '', res.result === 'void' ? 'error' : (kind || 'ok'));
    render();
  }

  // ---------- 画面 ----------
  function render() {
    if (!home) return;
    const left = Math.max(0, home.max - home.done);
    const note = clear($('trNote'));
    if (!home.on) {
      note.textContent = '今は、友だちとの交換はお休みです。';
    } else {
      note.append('同じレアリティのカードどうしで交換できるよ。1日 ', el('b', { text: String(home.max) }), ' 回まで（きょう あと ', el('b', { text: String(left) }),
        ' 回）。申しこみは、その日のうちだけ。', el('br'), '⚠️ 交換すると、出したカードは手元からなくなるよ。よく考えてね。');
    }
    renderIn();
    renderNew();
    renderOut();
    renderRes();
  }

  function renderIn() {
    const box = clear($('trIn'));
    box.appendChild(el('h3', { class: 'tr-h', text: '📨 とどいた申しこみ（' + home.incoming.length + '）' }));
    if (!home.incoming.length) { box.appendChild(el('div', { class: 'tr-empty', text: 'いまは、ありません。' })); return; }
    home.incoming.forEach((o) => {
      box.appendChild(el('div', { class: 'tr-offer' }, [
        el('div', { class: 'tr-who', text: o.friend.nickname + ' さんから（' + o.rarity + ' どうし）' }),
        pairEl('あなたが出す', o.myCard, 'もらえる', o.friendCard),
        el('div', { class: 'tr-btns' }, [
          el('button', { type: 'button', class: 'tr-btn green', text: '✅ 交換する', onclick: () => confirmAccept(o) }),
          el('button', { type: 'button', class: 'tr-btn gray', text: '✖ ことわる', onclick: () => send('trade.answer', { id: o.id, accept: false }, (r) => after(r)) })
        ])
      ]));
    });
  }

  function confirmAccept(o) {
    modal([
      el('div', { class: 'tr-h', text: '交換する？' }),
      pairEl('あなたが出す', o.myCard, 'もらえる', o.friendCard),
      '「' + o.myCard.name + '」を ' + o.friend.nickname + ' さんにわたして、「' + o.friendCard.name + '」をもらうよ。わたしたカードは、手元からなくなるよ。'
    ], [
      { text: '✅ 交換する', cls: 'green', fn: () => send('trade.answer', { id: o.id, accept: true }, (r) => after(r)) },
      { text: 'やめる', cls: 'gray' }
    ]);
  }

  function renderOut() {
    const box = clear($('trOut'));
    box.appendChild(el('h3', { class: 'tr-h', text: '📤 送った申しこみ（' + home.outgoing.length + ' ／ ' + home.pendingMax + '）' }));
    if (!home.outgoing.length) { box.appendChild(el('div', { class: 'tr-empty', text: 'いまは、ありません。' })); return; }
    home.outgoing.forEach((o) => {
      box.appendChild(el('div', { class: 'tr-offer' }, [
        el('div', { class: 'tr-who', text: o.friend.nickname + ' さんへ（返事まち）' }),
        pairEl('あなたが出す', o.myCard, 'もらう', o.friendCard),
        el('div', { class: 'tr-btns' }, [
          el('button', { type: 'button', class: 'tr-btn gray', text: '↩ とりけす', onclick: () => send('trade.cancel', { id: o.id }, (r) => after(r)) })
        ])
      ]));
    });
  }

  function renderRes() {
    const box = clear($('trRes'));
    box.hidden = !home.results.length;
    if (!home.results.length) return;
    box.appendChild(el('h3', { class: 'tr-h', text: '📝 きょうの結果' }));
    home.results.forEach((o) => {
      const n = o.friend.nickname + ' さん';
      let t = '';
      if (o.status === '成立') t = '✅ ' + n + 'と交換した：「' + o.myCard.name + '」→「' + o.friendCard.name + '」';
      else if (o.status === 'ことわり') t = o.sent ? '✖ ' + n + 'に、ことわられた（「' + o.friendCard.name + '」）' : '✖ ' + n + 'の申しこみを、ことわった';
      else if (o.status === 'とりけし') t = o.sent ? '↩ ' + n + 'への申しこみを、とりけした' : '↩ ' + n + 'が、申しこみをとりけした';
      else t = '⚠️ ' + n + 'との交換は取りやめ：' + (o.memo || '');
      box.appendChild(el('div', { class: 'tr-res', text: t }));
    });
  }

  function renderNew() {
    const box = clear($('trNew'));
    box.hidden = !home.on;
    if (!home.on) return;
    box.appendChild(el('h3', { class: 'tr-h', text: '✨ 新しく申しこむ' }));
    if (home.done >= home.max) { box.appendChild(el('div', { class: 'tr-empty', text: '今日の交換は、もう ' + home.max + ' 回したよ。また明日ね。' })); return; }
    if (home.outgoing.length >= home.pendingMax) { box.appendChild(el('div', { class: 'tr-empty', text: '返事を待っている申しこみが ' + home.pendingMax + ' つあるよ。返事を待つか、とりけしてね。' })); return; }
    if (pick && pick.data) { renderPick(box); return; }
    box.appendChild(el('div', { class: 'tr-step', text: '① 交換したい友だちをえらぼう' }));
    if (!home.friends.length) { box.appendChild(el('div', { class: 'tr-empty', text: '交換できる友だちがいません。' })); return; }
    const grid = el('div', { class: 'tr-friends' });
    home.friends.forEach((f) => {
      const b = el('button', { type: 'button', class: 'tr-btn plum', onclick: () => chooseFriend(f) }, [f.nickname, el('small', { text: f.id + '番' + (f.full ? '・今日はいっぱい' : '') })]);
      if (f.full) b.disabled = true;
      grid.appendChild(b);
    });
    box.appendChild(grid);
  }

  function chooseFriend(f) {
    send('trade.cards', { friend: f.id }, (res) => {
      pick = { friend: res.friend, data: res, rarity: '', give: null, get: null };
      const ok = usable(res);
      if (ok.length === 1) pick.rarity = ok[0];
      msg('');
      renderNew();
      $('trNew').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  // 同じレアリティで、もらえるカードと出せるカードが1枚ずつあるレアリティ
  function usable(d) {
    const has = (list, r) => list.some((c) => c.rarity === r);
    return d.rarities.filter((r) => has(d.give, r) && has(d.get, r));
  }

  function renderPick(box) {
    const d = pick.data, name = d.friend.nickname;
    box.appendChild(el('div', { class: 'tr-who', text: '🤝 ' + name + ' さんと交換' }));
    box.appendChild(el('div', { class: 'tr-btns' }, [el('button', { type: 'button', class: 'tr-btn gray', text: '← 友だちをえらびなおす', onclick: () => { pick = null; renderNew(); } })]));
    if (d.friendDone >= d.max) { box.appendChild(el('div', { class: 'tr-empty', text: name + ' さんは、今日の交換がもういっぱいだよ。また明日ね。' })); return; }
    const ok = usable(d);
    if (!ok.length) {
      box.appendChild(el('p', { class: 'tr-note', text: '同じレアリティで交換できるカードがないよ。（' + name + ' さんが出せて、あなたが持っていないカードと、あなたが出せて、' + name + ' さんが持っていないカードが、同じレアリティで1枚ずつ要るよ）' }));
      box.appendChild(el('p', { class: 'tr-note', text: '防御デッキのカード・覚醒したカード・特別なカードは出せないよ。' }));
      return;
    }
    box.appendChild(el('div', { class: 'tr-step', text: '② レアリティをえらぼう' }));
    const chips = el('div', { class: 'tr-chips' });
    ok.forEach((r) => {
      chips.appendChild(el('button', { type: 'button', class: 'tr-btn' + (pick.rarity === r ? ' on' : ''), 'aria-pressed': pick.rarity === r ? 'true' : 'false', text: r,
        onclick: () => { pick.rarity = r; pick.give = null; pick.get = null; renderNew(); } }));
    });
    box.appendChild(chips);
    if (!pick.rarity) return;
    const getList = d.get.filter((c) => c.rarity === pick.rarity), giveList = d.give.filter((c) => c.rarity === pick.rarity);
    box.appendChild(el('div', { class: 'tr-step', text: '③ もらいたいカード（' + name + ' さんのカード）' }));
    const g1 = el('div', { class: 'tr-grid' });
    getList.forEach((c) => g1.appendChild(cardEl(c, () => { pick.get = c; renderNew(); }, pick.get && pick.get.no === c.no)));
    box.appendChild(g1);
    box.appendChild(el('div', { class: 'tr-step', text: '④ 出すカード（あなたのカード）' }));
    const g2 = el('div', { class: 'tr-grid' });
    giveList.forEach((c) => g2.appendChild(cardEl(c, () => { pick.give = c; renderNew(); }, pick.give && pick.give.no === c.no)));
    box.appendChild(g2);
    box.appendChild(el('p', { class: 'tr-note', text: '防御デッキのカード・覚醒したカード・特別なカードは出せないよ。' }));
    const ready = pick.give && pick.get;
    box.appendChild(el('div', { class: 'tr-sum', text: ready
      ? 'あなたの「' + pick.give.name + '」と、' + name + ' さんの「' + pick.get.name + '」を交換したい、と申しこむよ。' + name + ' さんが「交換する」を押すと、交換されるよ。'
      : 'もらいたいカードと、出すカードを1枚ずつえらんでね。' }));
    const go = el('button', { type: 'button', class: 'tr-btn green', text: '📨 申しこむ', onclick: () => {
      send('trade.offer', { friend: d.friend.id, give: pick.give.no, get: pick.get.no }, (r) => { pick = null; after(r); });
    } });
    go.disabled = !ready;
    box.appendChild(el('div', { class: 'tr-btns' }, [go]));
  }

  function open(api) {
    app = api;
    build();
    app.showView('trade');
    pick = null;
    home = null;
    ['trIn', 'trNew', 'trOut', 'trRes'].forEach((id) => clear($(id)));
    load();
  }

  window.KanjiTrade = { open: open };
})();
