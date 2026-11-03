// ===============================================================
// 漢字の刃｜ドット絵のふでまる（KanjiFudemaru）
//   ・絵は「色の表」と「点のならび（文字の地図）」から、プログラムで描く（画像を読みこまない・生成AIは使わない）
//   ・部品（頭・耳・はちまき・筆・体・うで・足・しっぽ）を、ポーズごとに組み立てて1コマにする
//   ・大きさは2つ：L（48×48・マスコット・ステップアップ用）と S（20×20・クイズランナー用。忍者 16×16 と同じくらい）
//   ・向きは右むき（ランナーの進む向き）。左むきは flip（絵は裏返すが、はちまきの「漢」は鏡文字にしない）
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
    '..........KKKKKKKK..........',
    '.......KKKOoooooOOKKK.......',
    '.....KKOOooooOOOOOOOOKK.....',
    '....KOOooOOOOOOOOOOOOOOK....',
    '...KOooOOOOOOOOOOOOOOOOOK...',
    '..KKKKKKKKKKKKKKKKKKKKKKKK..',
    '.KRRRRRRRRRRRRRRRRRRRRRRRRK.',
    '.KRRRRRRRRRRRRRRRRRRRRRRRRK.',
    'KRRRRRRRRRRRRRRRRRRRRRRRRRRK',
    'KRRRRRRRRRRRRRRRRRRRRRRRRRRK',
    'KrrrrrrrrrrrrrrrrrrrrrrrrrrK',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKK',
    'KOOOOOOWWOOOWWWWOOOWWOOOOOOK',
    'KOOOOOOwkOOWWWWWWOOwkOOOOOOK',
    'KOOOOOOkkOWWWWWWWWOkkOOOOOOK',
    'KOOOOOWkkWWWWWWWWWWkkWOOOOOK',
    'KOOOOWWWWWWWkkkkWWWWWWWOOOOK',
    'KOOOWPPWWWWWWkkWWWWWWPPWOOOK',
    'KOOWWWWWWWKWWKKWWKWWWWWWWOOK',
    'KOOWWWWWWWWKKWWKKWWWWWWWWOOK',
    '.KKWWWWWWWWWWWWWWWWWWWWWWKK.',
    '...KKKKKKKKKKKKKKKKKKKKKK...'
  ];
  // はちまきの「漢」（8×5。頭の x10, y6 に重ねる）
  L.kanji = [
    'w...w.w.',
    '...wwwww',
    'w...www.',
    '.w.wwwww',
    'w..w.w.w'
  ];
  // 目・口の差しかえ（頭の中の位置 x, y と、点のならび）
  const FACE = {
    eyes: {
      open: [],
      blink: [[6, 13, ['OOOO', 'KKKK', 'WWWW']], [18, 13, ['OOOO', 'KKKK', 'WWWW']]],
      happy: [[6, 13, ['OKKO', 'KOOK', 'WWWW']], [18, 13, ['OKKO', 'KOOK', 'WWWW']]],
      hurt: [[6, 13, ['KKOO', 'OOKK', 'KKWW']], [18, 13, ['OOKK', 'KKOO', 'WWKK']]],
      sad: [[6, 12, ['OOKK', 'OOOO', 'OkkO', 'WkkW']], [18, 12, ['KKOO', 'OOOO', 'OkkO', 'WkkW']]],
      focus: [[6, 12, ['KKOO', 'OOKK', 'OkkO', 'WkkW']], [18, 12, ['OOKK', 'KKOO', 'OkkO', 'WkkW']]]
    },
    mouth: {
      smile: [],
      open: [[10, 18, ['WKKKKKKW', 'WKPPPPKW', 'WWKKKKWW']]],
      oh: [[10, 18, ['WWWKKWWW', 'WWKPPKWW', 'WWWKKWWW']]],
      flat: [[10, 18, ['WWWWWWWW', 'WWKKKKWW', 'WWWWWWWW']]]
    }
  };
  L.earL = [
    '....KKKK',
    '..KKEEEK',
    '.KEEEEEK',
    'KEEEEEEK',
    'KEEEEEeK',
    'KEEEEEeK',
    'KEEEEEeK',
    'KEEEEeeK',
    'KEEEEeeK',
    'KEEEEeeK',
    'KEEEEeK.',
    'KEEEEeK.',
    '.KEEEeK.',
    '.KEEeK..',
    '..KKK...'
  ];
  L.earFlapL = [
    '....KKKK..',
    '..KKEEEEK.',
    '.KEEEEEEEK',
    'KEEEEEEEeK',
    'KEEEEEEeeK',
    '.KEEEEEeK.',
    '..KKEEeK..',
    '....KKK...'
  ];
  L.ribbon = [
    '....KK',
    '...KRK',
    '..KRrK',
    '.KRrK.',
    'KRrK..',
    'KRK...',
    '.K....'
  ];
  L.ribbonFly = [
    'KK.....',
    'KRKKK..',
    '.KRRRKK',
    '..KKrrK',
    '....KK.'
  ];
  L.brush = [
    '.....KK.',
    '....KkK.',
    '...KkkK.',
    '..KkkkK.',
    '..KkkGK.',
    '.KwkGgK.',
    'KwwwwwgK',
    'KwwwwwgK',
    'KwwwwwgK',
    '.KwwwgK.',
    '.KRRRrK.',
    '..KKKK..'
  ];
  L.body = [
    '....KKKKKKKKKKKKKK....',
    '..KKOOOOOOOOOOOOOOKK..',
    '.KOOOOOOWWWWWWOOOOOOK.',
    '.KOOOOOWWWWWWWWOOOOOK.',
    'KOOOOOWWWWWWWWWWOOOOOK',
    'KDOOOWWWWWWWWWWWWOOODK',
    'KDOOOWWWWWWWWWWWWOOODK',
    'KDDOOOWWWWWWWWWWOOODDK',
    '.KDDOOOWWWWWWWWOOODDK.',
    '..KKDDOOOOOOOOOODDKK..',
    '....KKKKKKKKKKKKKK....'
  ];
  // 足（hx, hy：つけね）
  const LEG = {
    down: { hx: 3, hy: 0, rows: ['KOOOOOK', 'KOOOOOK', 'KOOOOOK', 'KOOOOOK', 'KWWWWWK', 'KWWWWWK', '.KKKKK.'] },
    fwd: { hx: 2, hy: -1, rows: ['KOOOOK...', 'KOOOOOK..', '.KOOOOWK.', '..KOWWWWK', '..KWWWWWK', '...KKKKK.'] },
    back: { hx: 6, hy: -1, rows: ['...KOOOOK', '..KOOOOOK', '.KWOOOOK.', 'KWWWOOK..', 'KWWWWK...', '.KKKK....'] },
    up: { hx: 2, hy: 0, rows: ['KOOOOK..', 'KOOOOWWK', '.KOWWWWK', '..KKKKK.'] },
    tuck: { hx: 3, hy: 0, rows: ['KOOOOOK', 'KWWWWWK', '.KKKKK.'] }
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
  //   体のまん中 cx=24・足の下 y=47。筆 y0〜・頭 28×22（y11〜）・体 22×11（y31〜）・足（y41〜）
  function poseL(p) {
    const out = [];
    const cx = 24 + (p.dx || 0), dy = p.dy || 0, hyy = dy + (p.hy || 0);
    const headX = cx - 14, headY = 11 + hyy;
    const put = (rows, x, y) => out.push([rows, x, y]);
    const leg = (name, hipX, dark) => {
      const l = LEG[name];
      put(dark ? recolor(l.rows, 'O', 'D') : l.rows, hipX - l.hx, (name === 'tuck' ? 40 + dy : 41) - l.hy);
    };
    const arm = (name, x, y, left) => {
      const a = ARM[name];
      let rows = a.rows, sx = a.sx;
      if (left) { rows = mirror(rows); sx = rows[0].length - 1 - a.sx; }
      put(rows, x - sx, y - a.sy);
    };
    const t = TAIL[p.tail || 'up'];
    // うしろから順に
    put(t.rows, cx - 12 - t.bx, 39 + dy - t.by);
    leg(p.legB || 'down', cx - 4, true);
    arm(p.armB || 'down', cx - 10, 34 + dy, true);
    if (p.ribbon === 'fly') put(L.ribbonFly, headX - 10, headY + 5); else put(L.ribbon, headX - 8, headY + 6);
    const br = p.brush === 'tilt' ? shear(L.brush, -0.25) : p.brush === 'lean' ? shear(L.brush, 0.2) : L.brush;
    put(br, headX + 14 - Math.floor(br[0].length / 2), headY - 11);
    leg(p.legF || 'down', cx + 4, false);
    put(L.body, cx - 11, 31 + dy);
    // 頭
    put(L.head, headX, headY);
    out.push([L.kanji, headX + 10, headY + 6, true]);   // 字（左むきでも裏返さない）
    FACE.eyes[p.eyes || 'open'].forEach((s) => put(s[2], headX + s[0], headY + s[1]));
    FACE.mouth[p.mouth || 'smile'].forEach((s) => put(s[2], headX + s[0], headY + s[1]));
    if (p.ears === 'flap') { put(L.earFlapL, headX - 7, headY + 4); put(mirror(L.earFlapL), headX + 25, headY + 4); }
    else { put(L.earL, headX - 5, headY + 4); put(mirror(L.earL), headX + 25, headY + 4); }
    arm(p.armF || 'down', cx + 10, 34 + dy, false);
    (p.fx || []).forEach((f) => put(FXP[f[0]], cx + f[1], f[2] + hyy));
    return out;
  }

  // =============================================================
  // S（20×20）の部品（クイズランナーの忍者と同じくらい）
  //   筆 y0〜3・頭 14×10（y4〜13）・体（y13〜16）・足（y16〜19）
  // =============================================================
  const S = {};
  S.head = [
    '...KKKKKKKK...',
    '..KRRRwwRRRK..',
    '.KRrrrwwrrrRK.',
    'KOOOOOOOOOOOOK',
    'KOOkOOWWOOkOOK',
    'KOOkWWkkWWkOOK',
    'KOPWWKWWKWWPOK',
    'KOWWWWKKWWWWOK',
    '.KWWWWWWWWWWK.',
    '..KKKKKKKKKK..'
  ];
  S.face = {
    open: [], blink: [[3, 4, ['O', 'K']], [10, 4, ['O', 'K']]],
    happy: [[2, 4, ['OKO', 'KWK']], [9, 4, ['OKO', 'KWK']]],
    hurt: [[2, 4, ['KOO', 'OKW']], [9, 4, ['OOK', 'WKO']]],
    sad: [[3, 4, ['O', 'k']], [10, 4, ['O', 'k']]]
  };
  S.ear = ['.KK', 'KEK', 'KEK', 'KEK', 'KeK', '.K.'];
  S.earFlap = ['.KKK', 'KEEK', 'KeK.', '.K..'];
  S.brush = ['..kk.', '.KwwK', 'KwwwK', '.KRK.'];
  S.body = ['.KKKKKKKK.', 'KOOWWWWOOK', 'KDOWWWWODK', '.KKKKKKKK.'];
  S.arm = { down: ['OK', 'WK'], up: ['.KK', 'KWK', 'KO.'], fwd: ['KKKK', 'OOWK', '.KK.'] };
  const S_LEGS = {
    stand: ['...KOOOOK...', '...KOKKOK...', '..KWWKKWWK..', '..KKK..KKK..'],
    run1: ['...KOOOOK...', '..KOOKKOOK..', '.KOOK..KOOK.', '.KWK....KWK.'],
    run2: ['...KOOOOK...', '....KOOOK...', '...KOOKKOK..', '...KWK.KWK..'],
    run3: ['...KOOOOK...', '..KDDKKOOK..', '.KDDK..KOOK.', '.KWK....KWK.'],
    run4: ['...KOOOOK...', '....KOOOK...', '....KOKKOOK.', '....KWK.KWK.'],
    tuck: ['...KOOOOK...', '...KWWWWK...', '....KKKK....'],
    fall: ['...KOOOOK...', '..KOOKKOOK..', '..KOK..KOK..', '..KWK..KWK..']
  };
  const S_TAIL = { up: ['KK.', 'KWK', '.KO'], wag: ['.KK', 'KWK', 'KO.'], down: ['..K', '.KO', 'KW.'] };

  function poseS(p) {
    const out = [];
    const put = (rows, x, y) => out.push([rows, x, y]);
    const cx = 10 + (p.dx || 0), dy = p.dy || 0, hyy = dy + (p.hy || 0);
    const headX = cx - 7, headY = 4 + hyy;
    put(S_TAIL[p.tail || 'up'], cx - 7, 11 + dy);
    const br = p.brush === 'tilt' ? shear(S.brush, -0.34) : S.brush;
    put(br, headX + 7 - Math.floor(br[0].length / 2), headY - 4);
    put(S_LEGS[p.legs || 'stand'], cx - 6, 16 + (p.legs === 'tuck' ? -1 + dy : 0));
    put(S.body, cx - 5, 13 + dy);
    put(S.head, headX, headY);
    (S.face[p.eyes || 'open'] || []).forEach((s) => put(s[2], headX + s[0], headY + s[1]));
    if (p.ears === 'flap') { put(S.earFlap, headX - 3, headY + 1); put(mirror(S.earFlap), headX + 13, headY + 1); }
    else { put(S.ear, headX - 2, headY + 1); put(mirror(S.ear), headX + 13, headY + 1); }
    const a = p.arms || 'down';
    if (a === 'up') { put(mirror(S.arm.up), cx - 8, 10 + dy); put(S.arm.up, cx + 5, 10 + dy); }
    else if (a === 'fwd') { put(mirror(S.arm.down), cx - 6, 14 + dy); put(S.arm.fwd, cx + 4, 14 + dy); }
    else { put(mirror(S.arm.down), cx - 6, 14 + dy); put(S.arm.down, cx + 4, 14 + dy); }
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
        { dy: 1, legF: 'fwd', legB: 'back', armF: 'fwd', armB: 'down', tail: 'wag', ears: 'flap', brush: 'tilt', ribbon: 'fly' },
        { dy: 0, legF: 'down', legB: 'up', armF: 'down', armB: 'down', tail: 'up', ears: 'down', brush: 'tilt', ribbon: 'fly' },
        { dy: 1, legF: 'back', legB: 'fwd', armF: 'down', armB: 'fwd', tail: 'wag', ears: 'flap', brush: 'tilt', ribbon: 'fly' },
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
        { dx: -2, dy: 2, legF: 'down', legB: 'back', armF: 'down', armB: 'fwd', eyes: 'focus', mouth: 'flat', brush: 'lean' },
        { dx: 2, dy: 1, legF: 'fwd', legB: 'back', armF: 'fwd', armB: 'fwd', eyes: 'focus', mouth: 'open', ears: 'flap', brush: 'tilt', ribbon: 'fly' },
        { dx: 3, dy: 1, legF: 'fwd', legB: 'back', armF: 'fwd', armB: 'fwd', eyes: 'focus', mouth: 'open', ears: 'flap', brush: 'tilt', ribbon: 'fly' },
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
        { dy: 1, legs: 'run1', tail: 'wag', ears: 'flap', brush: 'tilt' }, { legs: 'run2', tail: 'up', brush: 'tilt' },
        { dy: 1, legs: 'run3', tail: 'wag', ears: 'flap', brush: 'tilt' }, { legs: 'run4', tail: 'up', brush: 'tilt' }] },
      jump: { fps: 8, loop: true, poses: [{ legs: 'tuck', arms: 'up', ears: 'flap', tail: 'up' }] },
      fall: { fps: 8, loop: true, poses: [{ legs: 'fall', arms: 'up', ears: 'flap', tail: 'wag' }] },
      hop: { fps: 10, loop: false, poses: [{ dy: 1 }, { oy: -3, legs: 'tuck', arms: 'up', ears: 'flap' }, { oy: -5, legs: 'tuck', arms: 'up', ears: 'flap' }, { oy: -2, legs: 'fall', arms: 'up' }, { dy: 1, eyes: 'happy' }, { eyes: 'happy' }] },
      joy: { fps: 6, loop: true, poses: [{ dy: 1, eyes: 'happy', tail: 'wag' }, { oy: -3, arms: 'up', eyes: 'happy', ears: 'flap', tail: 'up' }] },
      hurt: { fps: 8, loop: true, poses: [{ eyes: 'hurt', ears: 'flap', arms: 'up', fx: [['tear', 6, 5]] }] },
      attack: { fps: 10, loop: false, poses: [{ dx: -1, dy: 1, legs: 'run2' }, { dx: 1, legs: 'run1', arms: 'fwd', brush: 'tilt' }, { dx: 1, dy: 1, legs: 'run1', arms: 'fwd', brush: 'tilt' }, { legs: 'stand' }] },
      lose: { fps: 2, loop: true, poses: [{ dy: 1, hy: 1, eyes: 'sad', tail: 'down' }] },
      wave: { fps: 4, loop: true, poses: [{ arms: 'up', eyes: 'happy', tail: 'wag' }, { eyes: 'open', tail: 'up' }] }
    }
  };
  const SIZES = { L: { w: 48, h: 48, footX: 24, footY: 48 }, S: { w: 20, h: 20, footX: 10, footY: 20 } };
  const NAMES = ['idle', 'run', 'jump', 'fall', 'hop', 'joy', 'hurt', 'attack', 'lose', 'wave'];

  // ---------- 組み立て（ページがなくても動く。点の色の文字の二次元のならびを返す） ----------
  let clipped = 0;   // コマの外にはみ出した点の数（テスト用）
  //   flip：左むき。部品を左右反対の位置に、裏返して置く（字の部品だけは裏返さない）
  function compose(size, anim, i, flip) {
    const sz = SIZES[size], a = ANIMS[size][anim];
    const pose = a.poses[i];
    const parts = size === 'L' ? poseL(pose) : poseS(pose);
    const grid = [];
    for (let y = 0; y < sz.h; y++) grid.push(new Array(sz.w).fill('.'));
    clipped = 0;
    parts.forEach(([rows, x0, y0, text]) => {
      if (flip) {
        const pw = Math.max.apply(null, rows.map((r) => r.length));
        x0 = sz.w - x0 - pw;
        if (!text) rows = mirror(rows.map((r) => r + '.'.repeat(pw - r.length)));
      }
      rows.forEach((row, y) => {
        const gy = y0 + y;
        for (let x = 0; x < row.length; x++) {
          const ch = row[x], gx = x0 + x;
          if (ch === '.') continue;
          if (gx < 0 || gx >= sz.w || gy < 0 || gy >= sz.h) { clipped++; continue; }
          grid[gy][gx] = ch;
        }
      });
    });
    return grid.map((r) => r.join(''));
  }
  // 絵の目印（色の表とすべてのコマから作る数。assets/img の PNG に書きこみ、テストで PNG が古くないか確かめる）
  function hash(size) {
    let str = size + '|' + Object.keys(PAL).map((k) => k + PAL[k]).join(',');
    NAMES.forEach((n) => { ANIMS[size][n].poses.forEach((_, i) => { str += '|' + n + i + '@' + offsetY(n, i, size) + ':' + compose(size, n, i).join('/'); }); });
    let h = 0x811c9dc5;
    for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
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
  function frame(anim, i, size, tint, flip) {
    size = size || 'L';
    if (!ANIMS[size][anim]) anim = 'idle';
    i = Math.max(0, Math.min(count(anim, size) - 1, i | 0));
    const key = size + anim + i + (tint || '') + (flip ? '<' : '');
    if (!cache[key]) cache[key] = paint(compose(size, anim, i, flip), tint);
    return cache[key];
  }
  function at(anim, ms, size, flip) {
    const r = indexAt(anim, ms, size);
    return { i: r.i, done: r.done, oy: offsetY(anim, r.i, size), canvas: frame(anim, r.i, size, null, flip) };
  }
  // x, y は足もとのまん中（ランナーなら x = 忍者のまん中, y = GROUND）
  function draw(ctx, anim, ms, x, y, opts) {
    opts = opts || {};
    const size = opts.size || 'L', sz = SIZES[size], s = opts.scale || 1;
    const r = indexAt(anim, ms, size), img = frame(anim, r.i, size, opts.tint, opts.flip);
    const oy = offsetY(anim, r.i, size);
    const left = Math.round(x - sz.footX * s), top = Math.round(y - sz.footY * s + oy * s);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, left, top, sz.w * s, sz.h * s);
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
      const ms = REDUCED ? (ANIMS[size][st.anim].loop ? 0 : 1e9) : now - st.t0;   // 動きをへらす設定：1回の動きはすぐ終える
      const r = indexAt(st.anim, ms, size);
      const oy = offsetY(st.anim, r.i, size);
      const key = st.anim + r.i + st.flip;
      if (key !== st.last) {
        st.last = key;
        g.clearRect(0, 0, cv.width, cv.height);
        g.drawImage(frame(st.anim, r.i, size, null, st.flip), 0, pad + oy);
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
    debug: { compose: compose, ANIMS: ANIMS, hash: hash, clipped: (size, anim, i) => { compose(size, anim, i); return clipped; } }
  };
})(typeof window !== 'undefined' ? window : this);
