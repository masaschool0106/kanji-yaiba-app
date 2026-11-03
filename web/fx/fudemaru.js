// ===============================================================
// 漢字の刃｜ドット絵のふでまる（KanjiFudemaru）
//   ・絵は「色の表」と「点のならび（文字の地図）」から、プログラムで描く（画像を読みこまない・生成AIは使わない）
//   ・部品（頭・耳・はちまき・筆・体・うで・足・しっぽ）を、ポーズごとに組み立てて1コマにする
//   ・大きさは2つ：L（48×48・マスコット・ステップアップ用）と S（20×20・クイズランナー用。忍者 16×16 と同じくらい）
//   ・向きは右むき（ランナーの進む向き）。左むきは flip
//   ・ページがない所（jsc のテスト）でも読みこめる。canvas を使うのは描くときだけ
//
//   KanjiFudemaru.draw(ctx, 動き, ミリ秒, x, y, opts)   … canvas に描く。x, y は「足もとのまん中」。opts { size:'L'|'S', scale, flip, tint }
//   KanjiFudemaru.frame(動き, コマ, size)               … 1コマの canvas（等倍・キャッシュ）
//   KanjiFudemaru.at(動き, ミリ秒, size)                … その時間のコマ { i, canvas, oy, done }
//   KanjiFudemaru.el(opts)                              … DOM 用：自分で動く <canvas>。{ size, scale, anim, flip }。.play(動き, { then }) .stop() .destroy()
//   KanjiFudemaru.sheet(size)                           … 全部のコマを並べた canvas（assets/img/fudemaru_L.png・fudemaru_S.png と同じならび）
//   KanjiFudemaru.layout(size)                          … シートの中の位置 { 動き: [{ x, y, w, h }] }
//   動き：idle 立ち・run 走る・jump 上がる・fall 落ちる・hop その場でジャンプ・joy よろこぶ・hurt ダメージ・attack 一閃・lose しょんぼり・wave 手をふる
// ===============================================================
(function (global) {
  'use strict';

  // ---------- 色の表（PICO-8 に近い色＋ふでまるの毛の色） ----------
  const PAL = {
    K: '#2a1a12',   // ふちどり（こげ茶）
    k: '#111111',   // 目・鼻・筆の先
    O: '#f09a3e',   // 毛（オレンジ）
    o: '#ffc06a',   // 毛の光
    D: '#c4682a',   // 毛のかげ
    W: '#fff4df',   // クリーム（顔・おなか・手足の先）
    c: '#ebcfa4',   // クリームのかげ
    E: '#a0522d',   // 耳（茶色）
    e: '#6f3518',   // 耳のかげ
    R: '#e8323c',   // はちまき（赤）
    r: '#a3182c',   // はちまきのかげ
    w: '#ffffff',   // 白（筆の毛・「漢」）
    g: '#c7c3d1',   // 筆の毛のかげ
    G: '#6c6a78',   // 筆の先のさかい
    P: '#ff8da1',   // ほお・舌
    u: '#5ec8ff',   // あせ・なみだ
    y: '#ffe14d'    // きらきら
  };

  // ---------- 文字の地図の道具 ----------
  function mirror(rows) { return rows.map((r) => r.split('').reverse().join('')); }
  function recolor(rows, from, to) { return rows.map((r) => r.split('').map((ch) => (ch === from ? to : ch)).join('')); }
  // 上ほど横にずらす（筆を後ろへかたむける）。k：1行あたりのずれ（マイナスで左）
  function shear(rows, k) {
    const h = rows.length, pad = Math.ceil(Math.abs(k) * h) + 1;
    return rows.map((r, y) => {
      const s = Math.round((h - 1 - y) * k);
      const line = '.'.repeat(pad) + r + '.'.repeat(pad);
      return s >= 0 ? '.'.repeat(s) + line.slice(0, line.length - s) : line.slice(-s) + '.'.repeat(-s);
    });
  }

  // =============================================================
  // L（48×48）の部品
  // =============================================================
  const L = {};
  L.head = [
    '........KKKKKKKKKK........',
    '......KKOoooooOOOOKK......',
    '....KKOooooOOOOOOOOOKK....',
    '...KOooOOOOOOOOOOOOOOOK...',
    '..KOoOOOOOOOOOOOOOOOOOOK..',
    '.KOOOOOOOOOOOOOOOOOOOOOOK.',
    '.KOOOOOOOOOOOOOOOOOOOOOOK.',
    'KOOOOOOOOOOOOOOOOOOOOOOOOK',
    'KOOOOOOOOOOOOOOOOOOOOOOOOK',
    'KOOOOOOOOOOOOOOOOOOOOOOOOK',
    'KOOOOOWWOOWWWWWWOOWWOOOOOK',
    'KOOOOOkkOOWWWWWWOOkkOOOOOK',
    'KOOOOOkkOWWWWWWWWOkkOOOOOK',
    'KOOOOWkkWWWWWWWWWWkkWOOOOK',
    'KOOOWWWWWWWkkkkWWWWWWWOOOK',
    'KOOWPPWWWWWWkkWWWWWWPPWOOK',
    'KOOWWWWWWKWWKKWWKWWWWWWOOK',
    'KOWWWWWWWWKKWWKKWWWWWWWWOK',
    '.KOWWWWWWWWWWWWWWWWWWWWOK.',
    '..KKWWWWWWWWWWWWWWWWWWKK..',
    '....KKKKKKKKKKKKKKKKKK....'
  ];
  // 目・口の差しかえ（頭の中の位置 x, y と、点のならび）
  const FACE = {
    eyes: {
      open: [],
      blink: [[5, 11, ['OOOO', 'KKKO', 'WWWW']], [17, 11, ['OOOO', 'OKKK', 'WWWW']]],
      happy: [[5, 11, ['OKKO', 'KOOK', 'WWWW']], [17, 11, ['OKKO', 'KOOK', 'WWWW']]],
      hurt: [[5, 11, ['KKOO', 'OOKO', 'KKWW']], [17, 11, ['OOKK', 'OKOO', 'WWKK']]],
      sad: [[5, 10, ['KKOO', 'OOOO', 'OkkO', 'WkkW']], [17, 10, ['OOKK', 'OOOO', 'OkkO', 'WkkW']]],
      focus: [[5, 10, ['OOKK', 'OOkk', 'OOkk', 'Wkkk']], [17, 10, ['KKOO', 'kkOO', 'kkOO', 'kkkW']]]
    },
    mouth: {
      smile: [],
      open: [[9, 16, ['WKKKKKKW', 'WKPPPPKW', 'WWKKKKWW']]],
      oh: [[9, 16, ['WWWKKWWW', 'WWKPPKWW', 'WWWKKWWW']]],
      flat: [[9, 16, ['WWWWWWWW', 'WWKKKKWW']]]
    }
  };
  L.earL = [
    '....KKKK',
    '..KKEEEK',
    '.KEEEEEK',
    'KEEEEEeK',
    'KEEEEEeK',
    'KEEEEEeK',
    'KEEEEeeK',
    'KEEEEeeK',
    'KEEEEeK.',
    'KEEEEeK.',
    'KEEEeeK.',
    '.KEEeK..',
    '.KEEeK..',
    '..KKK...'
  ];
  L.earFlapL = [
    '..KKKKK...',
    '.KEEEEEKK.',
    'KEEEEEEEEK',
    'KEEEEEEEeK',
    '.KEEEEEeeK',
    '..KKEEEeK.',
    '....KKKK..'
  ];
  L.band = [
    '...KKKKKKKKKKKKKKKKKKKKKK...',
    '..KRRRRRRRRwRRRwRwRRRRRRRK..',
    '.KRRRRRRRRRRRRwwwwwRRRRRRRK.',
    '.KRRRRRRRRwRRRRwwwRRRRRRRRK.',
    'KRRRRRRRRRRRRwwwwwRRRRRRRRRK',
    'KrrrrrrrrrwwrrrwrwrrrrrrrrrK',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKK'
  ];
  L.ribbon = [
    '....KK',
    '...KRK',
    '..KRrK',
    '.KRrK.',
    '.KRK..',
    '..K...'
  ];
  L.ribbonFly = [
    'KKK.....',
    'KRRKKK..',
    '.KKRRRKK',
    '...KKrrK',
    '.....KK.'
  ];
  L.brush = [
    '......KK.',
    '.....KkK.',
    '....KkkK.',
    '...KkkkK.',
    '..KkkkkK.',
    '..KkkkGK.',
    '.KwkkGgK.',
    '.KwwwwgK.',
    'KwwwwwwgK',
    'KwwwwwwgK',
    '.KwwwwgK.',
    '.KRRRRrK.',
    '..KRRrK..',
    '..KKKKK..'
  ];
  L.body = [
    '....KKKKKKKKKK....',
    '..KKOOOOOOOOOOKK..',
    '.KOOOOOWWWWOOOOOK.',
    '.KOOOOWWWWWWOOOOK.',
    'KOOOOWWWWWWWWOOOOK',
    'KOOOWWWWWWWWWWOOOK',
    'KOOOWWWWWWWWWWOOOK',
    'KOOOWWWWWWWWWWOOOK',
    'KDOOWWWWWWWWWWOODK',
    'KDOOOWWWWWWWWOOODK',
    '.KDOOOWWWWWWOOODK.',
    '.KDDOOOOOOOOOODDK.',
    '..KKKKKKKKKKKKKK..'
  ];
  // 足（hx, hy：つけね）
  const LEG = {
    down: { hx: 3, hy: 1, rows: ['.KOOK.', '.KOOK.', '.KOOK.', '.KOOK.', '.KOOK.', 'KWWWWK', 'KWWWWK', '.KKKK.'] },
    fwd: { hx: 2, hy: 1, rows: ['KOOOK...', '.KOOOK..', '..KOOOK.', '...KOWWK', '...KWWWK', '....KKK.'] },
    back: { hx: 5, hy: 1, rows: ['...KOOOK', '..KOOOK.', '.KOOOK..', 'KWWOK...', 'KWWWK...', '.KKK....'] },
    up: { hx: 2, hy: 1, rows: ['KOOOK..', 'KOOOOK.', '.KOOWWK', '..KWWWK', '...KKK.'] },
    tuck: { hx: 3, hy: 1, rows: ['.KOOK.', 'KOOOOK', 'KWWWWK', '.KKKK.'] }
  };
  // うで（sx, sy：かた）
  const ARM = {
    down: { sx: 2, sy: 1, rows: ['.KKK.', 'KOOOK', 'KOOOK', 'KOOOK', 'KOOOK', 'KWWWK', 'KWWWK', '.KKK.'] },
    fwd: { sx: 1, sy: 2, rows: ['.KKKKK..', 'KOOOOOKK', 'KOOOOWWK', '.KKKKWWK', '....KKK.'] },
    back: { sx: 5, sy: 1, rows: ['...KKK.', '..KOOOK', '.KOOOK.', 'KWOOK..', 'KWWK...', '.KK....'] },
    up: { sx: 1, sy: 6, rows: ['.....KK.', '....KWWK', '...KWWWK', '..KOOWK.', '.KOOOK..', 'KOOOK...', 'KOOK....', '.KK.....'] },
    high: { sx: 2, sy: 7, rows: ['.KKK.', 'KWWWK', 'KWWWK', 'KOOOK', 'KOOOK', 'KOOOK', 'KOOOK', 'KOOOK', '.KKK.'] }
  };
  // しっぽ（bx, by：つけね）
  const TAIL = {
    up: { bx: 6, by: 7, rows: ['.KK....', 'KWWK...', 'KWWK...', 'KOOK...', '.KOOK..', '.KOOK..', '..KOOKK', '...KOOO', '....KKK'] },
    wag: { bx: 7, by: 5, rows: ['KKK.....', 'KWWKK...', '.KWWOKK.', '..KOOOOK', '...KKOOO', '.....KKK'] },
    down: { bx: 6, by: 1, rows: ['....KKK', '...KOOO', '..KOOK.', '.KOOK..', 'KWWK...', 'KWK....', '.K.....'] }
  };
  const FXP = {
    sweat: ['.u.', '.u.', 'uuu', 'uwu', '.u.'],
    tear: ['u', 'u'],
    spark: ['..y..', '..y..', 'yywyy', '..y..', '..y..']
  };

  // ---------- ポーズ → 1コマ（L） ----------
  //   p = { dx, dy, hy, legF, legB, armF, armB, tail, ears, eyes, mouth, brush, ribbon, fx:[[名前, x, y]] }
  function poseL(p) {
    const out = [];
    const cx = 24 + (p.dx || 0), dy = p.dy || 0, hyy = dy + (p.hy || 0);
    const headX = cx - 13, headY = 10 + hyy;
    const put = (rows, x, y) => out.push([rows, x, y]);
    const leg = (name, hipX, dark) => { const l = LEG[name]; put(dark ? recolor(l.rows, 'O', 'D') : l.rows, hipX - l.hx, 41 - l.hy + (name === 'tuck' ? -2 + dy : Math.min(dy, 1) * 0)); };
    const arm = (name, x, y, left) => {
      const a = ARM[name];
      let rows = a.rows, sx = a.sx;
      if (left) { rows = mirror(rows); sx = rows[0].length - 1 - a.sx; }
      put(rows, x - sx, y - a.sy);
    };
    const t = TAIL[p.tail || 'up'];
    // うしろから順に
    put(t.rows, cx - 7 - t.bx, 37 + dy - t.by);
    leg(p.legB || 'down', cx - 3, true);
    arm(p.armB || 'down', cx - 8, 32 + dy, true);
    if (p.ribbon === 'fly') put(L.ribbonFly, headX - 7, headY + 5); else put(L.ribbon, headX - 4, headY + 7);
    const br = p.brush === 'tilt' ? shear(L.brush, -0.25) : p.brush === 'lean' ? shear(L.brush, 0.2) : L.brush;
    put(br, headX + 13 - Math.floor(br[0].length / 2) + (p.brush === 'tilt' ? 0 : 0), headY - 12);
    leg(p.legF || 'down', cx + 3, false);
    put(L.body, cx - 9, 29 + dy);
    // 頭
    put(L.head, headX, headY);
    FACE.eyes[p.eyes || 'open'].forEach((s) => put(s[2], headX + s[0], headY + s[1]));
    FACE.mouth[p.mouth || 'smile'].forEach((s) => put(s[2], headX + s[0], headY + s[1]));
    if (p.ears === 'flap') { put(L.earFlapL, headX - 8, headY + 3); put(mirror(L.earFlapL), headX + 24, headY + 3); }
    else { put(L.earL, headX - 4, headY + 3); put(mirror(L.earL), headX + 22, headY + 3); }
    put(L.band, headX - 1, headY + 3);
    arm(p.armF || 'down', cx + 8, 32 + dy, false);
    (p.fx || []).forEach((f) => put(FXP[f[0]], cx + f[1], f[2] + hyy));
    return out;
  }

  // =============================================================
  // S（20×20）の部品（クイズランナーの忍者と同じくらい）
  // =============================================================
  const S = {};
  S.head = [
    '....KKKKKK....',
    '..KKOOOOOOKK..',
    '.KRRRRwwRRRRK.',
    '.KrRRwRwRRRrK.',
    'KOOOOWWWWOOOOK',
    'KOOkOWWWWOkOOK',
    'KOOkWWkkWWkOOK',
    'KOWWWKWWKWWWOK',
    '.KWWWWWWWWWWK.',
    '..KKKKKKKKKK..'
  ];
  S.headFace = {
    open: [], blink: [[3, 5, ['O', 'K']], [10, 5, ['O', 'K']]],
    happy: [[2, 5, ['OKO', 'KOK']], [9, 5, ['OKO', 'KOK']]],
    hurt: [[2, 5, ['KOO', 'OKW']], [9, 5, ['OOK', 'WKO']]],
    sad: [[3, 5, ['O', 'k']], [10, 5, ['O', 'k']]]
  };
  S.ear = ['.KK', 'KEK', 'KEK', 'KeK', '.K.'];
  S.earFlap = ['KKK.', 'KEEK', '.KeK', '..K.'];
  S.brush = ['..KK.', '.KkK.', 'KwwwK', 'KwwgK', '.KRK.', '..K..'];
  S.body = ['.KKKKKKKK.', 'KOOWWWWOOK', 'KOOWWWWOOK', 'KDOOWWOODK', '.KKKKKKKK.'];
  S.armDown = ['KK', 'WK'];
  S.armUp = ['.K', 'KW', 'K.'];
  S.armFwd = ['KKK', 'OWK'];
  const S_LEGS = {
    stand: ['..KOK..KOK..', '..KWK..KWK..', '..KKK..KKK..'],
    run1: ['.KOK....KOK.', 'KWK......KWK', 'KK........KK'],
    run2: ['...KOK.KOK..', '...KWK.KWK..', '...KKK.KKK..'],
    run3: ['..KDK..KOK..', '.KWK....KWK.', '.KK......KK.'],
    run4: ['....KOKOK...', '....KWKWK...', '....KKKKK...'],
    tuck: ['..KWWKKWWK..', '...KK..KK...', '............'],
    fall: ['..KOK..KOK..', '.KWK....KWK.', '.KK......KK.']
  };
  const S_TAIL = { up: ['KK.', 'KWK', '.KO'], wag: ['.KK', 'KWK', 'KO.'], down: ['..K', '.KO', 'KW.'] };

  function poseS(p) {
    const out = [];
    const put = (rows, x, y) => out.push([rows, x, y]);
    const cx = 10 + (p.dx || 0), dy = p.dy || 0, hyy = dy + (p.hy || 0);
    const headX = cx - 7, headY = 5 + hyy;
    put(S_TAIL[p.tail || 'up'], cx - 7, 12 + dy);
    const br = p.brush === 'tilt' ? shear(S.brush, -0.25) : S.brush;
    put(br, headX + 7 - Math.floor(br[0].length / 2), headY - 5);
    put(S_LEGS[p.legs || 'stand'], cx - 6, 17 + (p.legs === 'tuck' ? -1 + dy : 0));
    put(S.body, cx - 5, 13 + dy);
    put(S.head, headX, headY);
    (S.headFace[p.eyes || 'open'] || []).forEach((s) => put(s[2], headX + s[0], headY + s[1]));
    if (p.ears === 'flap') { put(S.earFlap, headX - 3, headY + 2); put(mirror(S.earFlap), headX + 13, headY + 2); }
    else { put(S.ear, headX - 2, headY + 2); put(mirror(S.ear), headX + 13, headY + 2); }
    const a = p.arms || 'down';
    if (a === 'up') { put(S.armUp, cx - 7, 11 + dy); put(mirror(S.armUp), cx + 5, 11 + dy); }
    else if (a === 'fwd') put(S.armFwd, cx + 4, 14 + dy);
    else { put(mirror(S.armDown), cx - 6, 14 + dy); put(S.armDown, cx + 4, 14 + dy); }
    (p.fx || []).forEach((f) => put(FXP[f[0]], cx + f[1], f[2] + hyy));
    return out;
  }

  // =============================================================
  // 動き（コマのならび）。fps：1秒のコマ数、loop：くりかえす、oy：上下のずれ（コマの外へ。ジャンプの高さ）
  // =============================================================
  const ANIMS = {
    L: {
      idle: { fps: 4, loop: true, poses: [
        { tail: 'up' }, { tail: 'wag' }, { dy: 1, tail: 'up' }, { dy: 1, tail: 'wag' },
        { tail: 'up' }, { tail: 'wag', eyes: 'blink' }, { dy: 1, tail: 'up' }, { dy: 1, tail: 'wag' }] },
      run: { fps: 10, loop: true, poses: [
        { dy: 1, legF: 'fwd', legB: 'back', armF: 'back', armB: 'fwd', tail: 'wag', ears: 'flap', brush: 'tilt', ribbon: 'fly' },
        { dy: 0, legF: 'down', legB: 'up', armF: 'down', armB: 'down', tail: 'up', ears: 'down', brush: 'tilt', ribbon: 'fly' },
        { dy: 1, legF: 'back', legB: 'fwd', armF: 'fwd', armB: 'back', tail: 'wag', ears: 'flap', brush: 'tilt', ribbon: 'fly' },
        { dy: 0, legF: 'up', legB: 'down', armF: 'down', armB: 'down', tail: 'up', ears: 'down', brush: 'tilt', ribbon: 'fly' }] },
      jump: { fps: 8, loop: true, poses: [
        { legF: 'tuck', legB: 'tuck', armF: 'up', armB: 'up', ears: 'down', mouth: 'open', tail: 'up', brush: 'lean' },
        { legF: 'tuck', legB: 'tuck', armF: 'up', armB: 'up', ears: 'flap', mouth: 'open', tail: 'wag', brush: 'lean' }] },
      fall: { fps: 8, loop: true, poses: [
        { legF: 'down', legB: 'down', armF: 'high', armB: 'high', ears: 'flap', mouth: 'oh', tail: 'up', ribbon: 'fly' },
        { legF: 'down', legB: 'down', armF: 'high', armB: 'high', ears: 'flap', mouth: 'oh', tail: 'wag', ribbon: 'fly' }] },
      hop: { fps: 10, loop: false, poses: [
        { dy: 2, armF: 'down', armB: 'down' },
        { oy: -6, legF: 'tuck', legB: 'tuck', armF: 'up', armB: 'up', ears: 'flap', mouth: 'open' },
        { oy: -10, legF: 'tuck', legB: 'tuck', armF: 'up', armB: 'up', ears: 'flap', mouth: 'open' },
        { oy: -7, armF: 'high', armB: 'high', ears: 'down', mouth: 'open' },
        { oy: -2, ears: 'flap' },
        { dy: 2, eyes: 'happy' },
        { eyes: 'happy' }] },
      joy: { fps: 8, loop: true, poses: [
        { dy: 1, armF: 'down', armB: 'down', eyes: 'happy', mouth: 'open', tail: 'wag' },
        { oy: -4, armF: 'up', armB: 'up', eyes: 'happy', mouth: 'open', ears: 'flap', tail: 'up', fx: [['spark', -20, 6]] },
        { oy: -6, armF: 'up', armB: 'up', eyes: 'happy', mouth: 'open', ears: 'flap', tail: 'wag', fx: [['spark', 15, 2]] },
        { oy: -3, armF: 'up', armB: 'up', eyes: 'happy', mouth: 'open', tail: 'up' }] },
      hurt: { fps: 8, loop: true, poses: [
        { dx: -2, hy: 1, armF: 'high', armB: 'high', eyes: 'hurt', mouth: 'oh', ears: 'flap', legF: 'fwd', legB: 'down', fx: [['sweat', 12, 10]] },
        { dx: -1, hy: 0, armF: 'up', armB: 'up', eyes: 'hurt', mouth: 'oh', ears: 'flap', legF: 'fwd', legB: 'down', fx: [['sweat', 13, 12]] }] },
      attack: { fps: 10, loop: false, poses: [
        { dx: -2, dy: 2, legF: 'down', legB: 'back', armF: 'back', armB: 'down', eyes: 'focus', mouth: 'flat', brush: 'lean' },
        { dx: 3, dy: 1, legF: 'fwd', legB: 'back', armF: 'fwd', armB: 'back', eyes: 'focus', mouth: 'open', ears: 'flap', brush: 'tilt', ribbon: 'fly' },
        { dx: 4, dy: 1, legF: 'fwd', legB: 'back', armF: 'fwd', armB: 'back', eyes: 'focus', mouth: 'open', ears: 'flap', brush: 'tilt', ribbon: 'fly' },
        { dx: 1, legF: 'down', legB: 'down', armF: 'down', armB: 'down', eyes: 'open' }] },
      lose: { fps: 2, loop: true, poses: [
        { dy: 1, hy: 1, armF: 'down', armB: 'down', eyes: 'sad', mouth: 'flat', tail: 'down', fx: [['sweat', 12, 10]] },
        { dy: 1, hy: 2, armF: 'down', armB: 'down', eyes: 'sad', mouth: 'flat', tail: 'down', fx: [['sweat', 12, 11], ['tear', -7, 25]] }] },
      wave: { fps: 4, loop: true, poses: [
        { armF: 'up', eyes: 'open', mouth: 'open', tail: 'wag' },
        { armF: 'high', eyes: 'happy', mouth: 'open', tail: 'up' }] }
    },
    S: {
      idle: { fps: 3, loop: true, poses: [{ tail: 'up' }, { tail: 'wag' }, { dy: 1, tail: 'up' }, { dy: 1, tail: 'wag', eyes: 'blink' }] },
      run: { fps: 9, loop: true, poses: [
        { legs: 'run1', tail: 'wag', ears: 'flap', brush: 'tilt' }, { dy: -1, legs: 'run2', tail: 'up', brush: 'tilt' },
        { legs: 'run3', tail: 'wag', ears: 'flap', brush: 'tilt' }, { dy: -1, legs: 'run4', tail: 'up', brush: 'tilt' }] },
      jump: { fps: 8, loop: true, poses: [{ legs: 'tuck', arms: 'up', ears: 'flap', tail: 'up' }] },
      fall: { fps: 8, loop: true, poses: [{ legs: 'fall', arms: 'up', ears: 'flap', tail: 'wag' }] },
      hop: { fps: 10, loop: false, poses: [{ dy: 1 }, { oy: -3, legs: 'tuck', arms: 'up', ears: 'flap' }, { oy: -5, legs: 'tuck', arms: 'up', ears: 'flap' }, { oy: -2, legs: 'fall', arms: 'up' }, { dy: 1, eyes: 'happy' }, { eyes: 'happy' }] },
      joy: { fps: 6, loop: true, poses: [{ dy: 1, eyes: 'happy', tail: 'wag' }, { oy: -3, arms: 'up', eyes: 'happy', ears: 'flap', tail: 'up' }] },
      hurt: { fps: 8, loop: true, poses: [{ dx: -1, eyes: 'hurt', ears: 'flap', arms: 'up' }] },
      attack: { fps: 10, loop: false, poses: [{ dx: -1, dy: 1, legs: 'run2' }, { dx: 2, legs: 'run1', arms: 'fwd', ears: 'flap', brush: 'tilt' }, { dx: 2, legs: 'run1', arms: 'fwd', ears: 'flap', brush: 'tilt' }, { legs: 'stand' }] },
      lose: { fps: 2, loop: true, poses: [{ dy: 1, hy: 1, eyes: 'sad', tail: 'down' }] },
      wave: { fps: 4, loop: true, poses: [{ arms: 'up', eyes: 'happy', tail: 'wag' }, { eyes: 'open', tail: 'up' }] }
    }
  };
  const SIZES = { L: { w: 48, h: 48, footX: 24, footY: 48 }, S: { w: 20, h: 20, footX: 10, footY: 20 } };
  const NAMES = ['idle', 'run', 'jump', 'fall', 'hop', 'joy', 'hurt', 'attack', 'lose', 'wave'];

  // ---------- 組み立て（ページがなくても動く。点の色の文字の二次元のならびを返す） ----------
  function compose(size, anim, i) {
    const sz = SIZES[size], a = ANIMS[size][anim];
    const pose = a.poses[i];
    const parts = size === 'L' ? poseL(pose) : poseS(pose);
    const grid = [];
    for (let y = 0; y < sz.h; y++) grid.push(new Array(sz.w).fill('.'));
    parts.forEach(([rows, x0, y0]) => {
      rows.forEach((row, y) => {
        const gy = y0 + y;
        if (gy < 0 || gy >= sz.h) return;
        for (let x = 0; x < row.length; x++) {
          const ch = row[x], gx = x0 + x;
          if (ch === '.' || gx < 0 || gx >= sz.w) continue;
          grid[gy][gx] = ch;
        }
      });
    });
    return grid.map((r) => r.join(''));
  }
  function count(anim, size) { const a = ANIMS[size || 'L'][anim]; return a ? a.poses.length : 0; }
  // その時間（ミリ秒）のコマの番号。くりかえさない動きは、最後のコマで止まる
  function indexAt(anim, ms, size) {
    const a = ANIMS[size || 'L'][anim];
    if (!a) return { i: 0, done: true };
    const n = a.poses.length, k = Math.floor(Math.max(0, ms) * a.fps / 1000);
    if (a.loop) return { i: k % n, done: false };
    return { i: Math.min(k, n - 1), done: k >= n };
  }
  function offsetY(anim, i, size) { const a = ANIMS[size || 'L'][anim]; const p = a && a.poses[i]; return (p && p.oy) || 0; }

  // ---------- canvas に描く（ページがあるときだけ） ----------
  const cache = {};
  function makeCanvas(w, h) { const c = global.document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function paint(rows, tint) {
    const c = makeCanvas(rows[0].length, rows.length), g = c.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        g.fillStyle = (tint && ch !== 'K' && ch !== 'k' && ch !== 'w' && ch !== 'W') ? tint : (PAL[ch] || '#f0f');
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  }
  function frame(anim, i, size, tint) {
    size = size || 'L';
    if (!ANIMS[size][anim]) anim = 'idle';
    i = Math.max(0, Math.min(count(anim, size) - 1, i | 0));
    const key = size + anim + i + (tint || '');
    if (!cache[key]) cache[key] = paint(compose(size, anim, i), tint);
    return cache[key];
  }
  function at(anim, ms, size) {
    const r = indexAt(anim, ms, size);
    return { i: r.i, done: r.done, oy: offsetY(anim, r.i, size), canvas: frame(anim, r.i, size) };
  }
  // x, y は足もとのまん中（ランナーなら x = 忍者のまん中, y = GROUND）
  function draw(ctx, anim, ms, x, y, opts) {
    opts = opts || {};
    const size = opts.size || 'L', sz = SIZES[size], s = opts.scale || 1;
    const r = indexAt(anim, ms, size), img = frame(anim, r.i, size, opts.tint);
    const oy = offsetY(anim, r.i, size);
    const left = Math.round(x - sz.footX * s), top = Math.round(y - sz.footY * s + oy * s);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (opts.flip) {
      ctx.save(); ctx.translate(left + sz.w * s, top); ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, sz.w * s, sz.h * s);
      ctx.restore();
    } else ctx.drawImage(img, left, top, sz.w * s, sz.h * s);
    ctx.imageSmoothingEnabled = smooth;
    return r;
  }

  // ---------- スプライトシート（1行に1つの動き。左から順にコマ） ----------
  function layout(size) {
    size = size || 'L';
    const sz = SIZES[size], out = {};
    NAMES.forEach((name, row) => { out[name] = ANIMS[size][name].poses.map((_, i) => ({ x: i * sz.w, y: row * sz.h, w: sz.w, h: sz.h })); });
    return out;
  }
  function sheetSize(size) {
    const sz = SIZES[size || 'L'];
    return { w: Math.max.apply(null, NAMES.map((n) => count(n, size || 'L'))) * sz.w, h: NAMES.length * sz.h };
  }
  function sheet(size) {
    size = size || 'L';
    const d = sheetSize(size), c = makeCanvas(d.w, d.h), g = c.getContext('2d'), lay = layout(size);
    NAMES.forEach((name) => lay[name].forEach((r, i) => g.drawImage(frame(name, i, size), r.x, r.y)));
    return c;
  }

  // ---------- DOM 用：自分で動く <canvas> ----------
  //   ジャンプ（oy）のぶん、上にすきまを取る。ほかのタブ・画面の外では止まる。動きをへらす設定のときは、1コマ目で止まる
  const REDUCED = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const live = [];
  let ticking = false;
  function tick(now) {
    if (!live.length) { ticking = false; return; }
    live.forEach((c) => c._tick(now));
    global.requestAnimationFrame(tick);
  }
  function el(opts) {
    opts = opts || {};
    const size = opts.size || 'L', sz = SIZES[size], s = opts.scale || 2;
    const pad = size === 'L' ? 12 : 6;   // 上のすきま（ジャンプ用）
    const cv = makeCanvas(sz.w, sz.h + pad);
    cv.className = 'kfude' + (opts.className ? ' ' + opts.className : '');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', opts.label || 'ふでまる');
    Object.assign(cv.style, { width: sz.w * s + 'px', height: (sz.h + pad) * s + 'px', imageRendering: 'pixelated' });
    const g = cv.getContext('2d');
    const st = { anim: opts.anim || 'idle', base: opts.anim || 'idle', t0: 0, then: null, last: '', flip: !!opts.flip, visible: true };
    function render(now) {
      if (!st.t0) st.t0 = now;
      const ms = REDUCED ? 0 : now - st.t0;
      const r = indexAt(st.anim, ms, size);
      const oy = offsetY(st.anim, r.i, size);
      const key = st.anim + r.i + st.flip;
      if (key !== st.last) {
        st.last = key;
        g.clearRect(0, 0, cv.width, cv.height);
        const img = frame(st.anim, r.i, size);
        if (st.flip) { g.save(); g.translate(sz.w, 0); g.scale(-1, 1); g.drawImage(img, 0, pad + oy); g.restore(); }
        else g.drawImage(img, 0, pad + oy);
      }
      if (r.done) { const fn = st.then; st.then = null; ctl.play(st.base); if (fn) fn(); }
    }
    let io = null;
    if (global.IntersectionObserver) { io = new global.IntersectionObserver((es) => { st.visible = es[es.length - 1].isIntersecting; }); io.observe(cv); }
    cv._tick = (now) => { if (st.visible && !global.document.hidden && cv.isConnected) render(now); };
    const ctl = {
      el: cv,
      // play('joy') … 動きを変える。くりかえさない動き（hop・attack）は、終わると前の動きにもどって then を呼ぶ
      play(anim, o) {
        o = o || {};
        if (!ANIMS[size][anim]) return ctl;
        if (ANIMS[size][anim].loop && !o.once) st.base = anim;
        st.anim = anim; st.t0 = 0; st.last = ''; st.then = o.then || null;
        if (o.once && ANIMS[size][anim].loop) setTimeout(() => { if (st.anim === anim) { const fn = st.then; st.then = null; ctl.play(st.base); if (fn) fn(); } }, o.ms || 1200);
        return ctl;
      },
      flip(v) { st.flip = !!v; st.last = ''; return ctl; },
      get anim() { return st.anim; },
      stop() { const k = live.indexOf(cv); if (k >= 0) live.splice(k, 1); return ctl; },
      start() { if (live.indexOf(cv) < 0) live.push(cv); if (!ticking) { ticking = true; global.requestAnimationFrame(tick); } return ctl; },
      destroy() { ctl.stop(); if (io) io.disconnect(); if (cv.parentNode) cv.parentNode.removeChild(cv); }
    };
    render(global.performance ? global.performance.now() : 0);
    return ctl.start();
  }

  global.KanjiFudemaru = {
    version: '2026-11-03',
    PAL: PAL, SIZES: SIZES, names: NAMES.slice(), reducedMotion: REDUCED,
    count: count, indexAt: indexAt, offsetY: offsetY,
    frame: frame, at: at, draw: draw, el: el, sheet: sheet, layout: layout, sheetSize: sheetSize,
    debug: { compose: compose, ANIMS: ANIMS }
  };
})(typeof window !== 'undefined' ? window : this);
