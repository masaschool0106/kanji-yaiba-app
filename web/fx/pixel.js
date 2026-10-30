// ===============================================================
// 漢字の刃｜ドット絵の見た目の部品（KanjiPixel）
//   ・色は PICO-8 の16色（クイズ・ランナーと同じ）。絵は小さく描いて、整数倍に大きくする（くっきり）
//   ・ライブラリなし。背景は、はじめに1回描くだけ（雲を動かすときも 1秒に8コマ・ほかのタブでは止める）
//   ・見た目だけ。ポイント・答え合わせ・画面の移動のしかたは変えない（移動を待たせない）
//
//   KanjiPixel.icon(名前, 大きさ)        … 12×12 の点のアイコン（gacha・battle・roguelike・quiz・zukan・quizrunner …）
//   KanjiPixel.background(場面, opts)     … 画面いっぱいの背景（いまは castle＝城下町）。{ clouds: true, raid: true }
//   KanjiPixel.wipe()                     … 画面を出るとき、黒い四角のタイルで閉じる（飾り。呼んだらすぐ移動してよい）
//   KanjiPixel.flashOk()                  … 光らせてよいか（光の点滅は1秒に2回まで）
//   KanjiPixel.wants(画面) / apply(画面)  … FxBridge の画面をドット絵にする（PAGES にある画面だけ）
// ===============================================================
(function (global) {
  'use strict';

  // ドット絵にする画面（FxBridge が見分けた名前）。ここに足して Push すると、その画面がドット絵になる。
  //   gacha・randombattle・privatebattle・battle・zukan・quiz・stepup
  //   （マイページ・ログインは app.js と app.css がドット絵にしている）
  const PAGES = [];

  const REDUCED = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PAL = { k: '#000000', n: '#1d2b53', p: '#7e2553', G: '#008751', b: '#ab5236', g: '#5f574f', l: '#c2c3c7', w: '#fff1e8',
    r: '#ff004d', o: '#ffa300', y: '#ffec27', e: '#00e436', u: '#29adff', v: '#83769c', P: '#ff77a8', s: '#ffccaa' };

  function sprite(rows) {
    const c = document.createElement('canvas');
    c.width = Math.max.apply(null, rows.map((r) => r.length)); c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = PAL[ch] || '#f0f'; g.fillRect(x, y, 1, 1); } });
    return c;
  }

  // ---------- 12×12 の点のアイコン（行き先とメニュー。絵文字のかわり） ----------
  const ICONS = {
    gacha: ['....kkkk....', '..kkrrrrkk..', '.krrrwwrrrk.', '.krrwwrrrrk.', 'krrrrrrrrrrk', 'kkkkkkkkkkkk', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '..kkwwwwkk..', '....kkkk....'],
    battle: ['..........kk', '.........kwk', '........kwlk', '.......kwlk.', '......kwlk..', '.k...kwlk...', '.kk.kwlk....', '..kkwlk.....', '...kyk......', '..kykkk.....', '.kyk..k.....', '.kk.........'],
    roguelike: ['............', '........kkkk', '........kook', '....kkkkkook', '....kooooook', 'kkkkkooooook', 'kooooooooook', 'kooooooooook', 'kbbbbbbbbbbk', 'kbbbbbbbbbbk', 'kkkkkkkkkkkk', '............'],
    quiz: ['kkkkkkkkkkkk', 'kyyyyyyyyyyk', 'kyyykkkkyyyk', 'kyykyyyykyyk', 'kyyyyyyykyyk', 'kyyyyyykyyyk', 'kyyyyykyyyyk', 'kyyyyykyyyyk', 'kyyyyyyyyyyk', 'kyyyyykyyyyk', 'kooooooooook', 'kkkkkkkkkkkk'],
    zukan: ['..kkkkkkkk..', '.kuuuuuuuuk.', '.kuwwwwwwuk.', '.kuuuuuuuuk.', '.kuwwwwwuuk.', '.kuuuuuuuuk.', '.kuuuuuuuuk.', '.kuuuuuuuuk.', '.kuuuuuuuuk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............'],
    quizrunner: ['............', 'kk....kk....', 'kek...kek...', '.kek...kek..', '..kek...kek.', '...kek...kek', '...kek...kek', '..kek...kek.', '.kek...kek..', 'kek...kek...', 'kk....kk....', '............'],
    jamaica: ['............', '....kkkk....', '....kook....', '....kook....', 'kkkkkookkkkk', 'kooooooooook', 'kooooooooook', 'kkkkkookkkkk', '....kook....', '....kook....', '....kkkk....', '............'],
    cardmake: ['.........kk.', '........kPPk', '.......kyPk.', '......kyyk..', '.....kyyk...', '....kyyk....', '...kyyk.....', '..ksyk......', '.kssk.......', '.kkk........', '............', '............'],
    finisherform: ['............', '.kkkkkkkkk..', '.kwwwwwwwk..', '.kwkkkkkwk..', '.kwwwwwwwk..', '.kwkkkkkwk..', '.kwwwwwwwk..', '.kwkkkwwwk..', '.kwwwwwwwk..', '.kkkkkkkkk..', '............', '............'],
    bugreport: ['............', '..k......k..', '...k....k...', '....kkkk....', 'k..kGGGGk..k', '.kkGGGGGGkk.', '...kGGGGk...', '.kkGGGGGGkk.', 'k..kGGGGk..k', '....kkkk....', '............', '............'],
    mypage: ['.....kk.....', '....krrk....', '...krrrrk...', '..krrrrrrk..', '.krrrrrrrrk.', 'kkkkkkkkkkkk', '.kwwwwwwwwk.', '.kuuwwkkwwk.', '.kuuwwkbkwk.', '.kwwwwkbkwk.', '.kkkkkkkkkk.', '............']
  };
  ICONS.stepup = ICONS.roguelike;
  const iconCache = {};
  function icon(name, size) {
    const rows = ICONS[name];
    if (!rows) return null;
    if (!iconCache[name]) iconCache[name] = sprite(rows);
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    c.getContext('2d').drawImage(iconCache[name], 0, 0);
    const px = (size || 48) + 'px';
    c.className = 'kpx-icon';
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { width: px, height: px, imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle' });
    return c;
  }

  // ---------- 背景の場面（160×90） ----------
  const W = 160, H = 90;
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  const SCENES = {
    // 城下町の夜明け（マイページ・ログイン）。raid のときは空が赤い
    castle(g, o) {
      const sky = o.raid ? ['#000000', '#7e2553', '#ff004d', '#ab5236'] : ['#1d2b53', '#7e2553', '#ff004d', '#ffa300'];
      const bh = 12;
      sky.forEach((c, i) => R(g, 0, i * bh, W, bh, c));
      for (let i = 1; i < sky.length; i++) for (let y = i * bh; y < i * bh + 3; y++) for (let x = y % 2; x < W; x += 2) R(g, x, y, 1, 1, sky[i - 1]);   // 帯の境目は市松（ディザ）
      R(g, 0, 48, W, 42, sky[3]);
      const sun = o.raid ? '#ff004d' : '#ffec27';
      R(g, 110, 34, 14, 2, sun); R(g, 108, 36, 18, 6, sun); R(g, 110, 42, 14, 2, sun);
      for (let x = 0; x < W; x++) { const h = Math.round(46 + Math.sin(x * 0.07) * 4 + Math.sin(x * 0.19 + 1) * 2); R(g, x, h, 1, H - h, '#83769c'); }   // 遠くの山
      // お城
      R(g, 64, 30, 32, 4, '#1d2b53'); R(g, 60, 34, 40, 2, '#000000'); R(g, 68, 36, 24, 6, '#1d2b53'); R(g, 62, 42, 36, 2, '#000000'); R(g, 66, 44, 28, 10, '#1d2b53');
      R(g, 74, 24, 12, 6, '#1d2b53'); R(g, 72, 23, 16, 1, '#000000'); R(g, 79, 21, 2, 2, '#ffec27');
      for (let x = 70; x < 92; x += 6) R(g, x, 46, 2, 3, '#ffec27');
      R(g, 54, 54, 52, 6, '#5f574f');
      // 家なみ
      for (let i = 0; i < 12; i++) {
        const x = i * 14 - 4, h = 6 + (i * 5) % 6;
        R(g, x, 66 - h, 12, h + 2, '#000000'); R(g, x - 1, 64 - h, 14, 2, '#1d2b53');
        if (i % 3 === 0) R(g, x + 4, 66 - h, 2, 2, '#ffa300');
      }
      R(g, 0, 66, W, 24, '#000000');
      for (let y = 70; y < H; y += 4) for (let x = (y / 4) % 2 * 4; x < W; x += 8) R(g, x, y, 4, 2, '#1d2b53');   // 石だたみ
      // 雲（o.t で横に流れる）
      const cloud = o.raid ? '#7e2553' : '#ff77a8';
      [[0, 8, 22], [60, 16, 16], [110, 6, 26]].forEach(([x, y, w]) => {
        const cx = Math.round((x + (o.t || 0)) % 190) - 20;
        R(g, cx, y, w, 3, cloud); R(g, cx + 3, y - 2, w - 8, 2, cloud);
      });
    }
  };

  // ---------- 画面いっぱいの背景（整数倍で画面をおおう） ----------
  let bgCtl = null;
  function background(name, opts) {
    if (bgCtl) { bgCtl.set(Object.assign({ scene: name }, opts || {})); bgCtl.show(); return bgCtl; }
    const o = Object.assign({ scene: name, t: 0 }, opts || {});
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H; cv.id = 'kpx-bg'; cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', imageRendering: 'pixelated', zIndex: '-1', pointerEvents: 'none' });
    const g = cv.getContext('2d');
    let timer = 0;
    function draw() { R(g, 0, 0, W, H, '#000000'); (SCENES[o.scene] || SCENES.castle)(g, o); }
    function fit() {
      const s = Math.ceil(Math.max(global.innerWidth / W, global.innerHeight / H));
      cv.style.width = (W * s) + 'px'; cv.style.height = (H * s) + 'px';
    }
    function loop() {   // 雲：1秒に8コマ。ほかのタブ・隠れているときは描かない
      clearInterval(timer); timer = 0;
      if (!o.clouds || REDUCED || cv.style.display === 'none') return;
      timer = setInterval(() => { if (document.hidden) return; o.t = (o.t || 0) + 1; draw(); }, 125);
    }
    (document.body || document.documentElement).insertBefore(cv, (document.body || document.documentElement).firstChild);
    draw(); fit();
    global.addEventListener('resize', fit);
    loop();
    bgCtl = {
      set(next) { const before = JSON.stringify([o.scene, o.raid, o.clouds]); Object.assign(o, next || {}); draw(); if (before !== JSON.stringify([o.scene, o.raid, o.clouds])) loop(); },
      show() { if (cv.style.display === 'none') { cv.style.display = ''; loop(); } },
      hide() { cv.style.display = 'none'; clearInterval(timer); timer = 0; }
    };
    return bgCtl;
  }

  // ---------- 画面を出るとき：黒い四角のタイルが左上から6コマで閉じる ----------
  //   飾りだけ。呼んだあと、すぐに画面を移動してよい（iPad はタップした瞬間に移動するため、待たせない）
  //   「読み込み中」の箱（z-index 20000）と「▶ タップして移動」より下に出す
  function wipe() {
    if (REDUCED || document.getElementById('kpx-wipe')) return;
    const GW = 32, GH = 18, cv = document.createElement('canvas');
    cv.width = GW; cv.height = GH; cv.id = 'kpx-wipe'; cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '19999', pointerEvents: 'none', imageRendering: 'pixelated' });
    document.body.appendChild(cv);
    const g = cv.getContext('2d'), FRAMES = 6;
    let f = 0;
    const timer = setInterval(() => {
      f++;
      g.fillStyle = '#000000';
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (x + y < f * (GW + GH) / FRAMES) g.fillRect(x, y, 1, 1);
      if (f >= FRAMES) clearInterval(timer);
    }, 50);
    const done = () => { clearInterval(timer); if (cv.parentNode) cv.parentNode.removeChild(cv); };
    setTimeout(done, 4000);   // 移動が止められたときも、ずっと黒いままにしない
    global.addEventListener('pageshow', (e) => { if (e.persisted) done(); }, { once: true });   // 「戻る」でこの画面にもどったとき
  }

  // ---------- 光の点滅は1秒に2回まで ----------
  let lastFlash = 0;
  function flashOk() {
    const now = Date.now();
    if (now - lastFlash < 500) return false;
    lastFlash = now; return true;
  }

  // ---------- 字（DotGothic16）。描くのを止めないように、あとから読みこむ ----------
  function loadFont() {
    if (document.getElementById('kpx-font')) return;
    const l = document.createElement('link');
    l.id = 'kpx-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap';
    document.head.appendChild(l);
  }

  // ---------- FxBridge の画面をドット絵にする ----------
  //   FxBridge が、画面を見分けたあとに呼ぶ。未来風の見た目（theme.css）はやめて、pixel.css の見た目にする
  const SCENE_OF = {};   // 画面ごとの背景（足していく）。ないときは城下町
  function wants(page) { return !!page && PAGES.indexOf(page) >= 0; }
  function apply(page, opts) {
    opts = opts || {};
    loadFont();
    const hud = document.getElementById('kanji-theme-css');
    if (hud) hud.disabled = true;
    document.querySelectorAll('.hud-bg').forEach((el) => el.parentNode.removeChild(el));
    document.documentElement.classList.add('px-theme');
    document.body.classList.add('px-theme');
    document.body.setAttribute('data-page', page);
    background(SCENE_OF[page] || 'castle');
    if (opts.enter) document.querySelectorAll(opts.enter).forEach((el, n) => { el.classList.add('kpx-enter'); el.style.animationDelay = (Math.min(n, 8) * 0.05) + 's'; });
    document.addEventListener('click', (e) => {   // メニューからほかの画面へ移るとき（新しいタブで開くものは除く）
      const t = e.target.closest ? e.target.closest('.global-nav-menu button') : null;
      if (t && !t.hasAttribute('data-external')) wipe();
    }, true);
  }

  global.KanjiPixel = {
    version: '2026-10-30',
    PAL: PAL, pages: PAGES, reducedMotion: REDUCED,
    sprite: sprite, icon: icon, hasIcon: (name) => !!ICONS[name],
    background: background, wipe: wipe, flashOk: flashOk, loadFont: loadFont,
    wants: wants, apply: apply
  };
})(window);
