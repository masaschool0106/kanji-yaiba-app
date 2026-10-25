/* ===============================================================
   漢字の刃｜ステップアップの「時代の背景」
   ・240×135 の小さなキャンバスに描いて、拡大して表示する（ドット絵）
   ・空のグラデーション、ゆれるマスコット、光の粒（アニメ風）
   ・1秒に20コマまで。画面が見えていないときは止まる。「動きを減らす」設定のときは止まった絵
   使い方：KanjiEras.show(階層 1〜10) / KanjiEras.hide()
   =============================================================== */
(function () {
  'use strict';
  const W = 240, H = 135, FPS = 20;
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let canvas = null, ctx = null, bg = null, bgCtx = null, era = 0, raf = 0, last = 0, t0 = 0, scene = null;

  // ---------- 小さな道具 ----------
  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function disc(c, cx, cy, r, col) {
    c.fillStyle = col;
    for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  }
  function tri(c, x1, x2, yTop, yBase, col) {   // 二等辺三角形（屋根・山）
    c.fillStyle = col;
    const h = yBase - yTop, mid = (x1 + x2) / 2;
    for (let i = 0; i <= h; i++) { const half = ((x2 - x1) / 2) * (i / h); c.fillRect(Math.round(mid - half), Math.round(yTop + i), Math.round(half * 2) + 1, 1); }
  }
  function sky(c, top, bottom) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  function hills(c, y, amp, col, seed) {
    c.fillStyle = col;
    for (let x = 0; x < W; x++) { const h = Math.round(amp * (Math.sin(x / 23 + seed) * 0.6 + Math.sin(x / 9 + seed * 2) * 0.25)); c.fillRect(x, y - h, 1, H - y + h); }
  }
  function ground(c, y, col, line) { R(c, 0, y, W, H - y, col); if (line) R(c, 0, y, W, 1, line); }
  function cloud(c, x, y, col) { disc(c, x, y, 5, col); disc(c, x + 7, y - 2, 6, col); disc(c, x + 14, y, 5, col); R(c, x - 4, y, 23, 5, col); }

  // ---------- マスコット（下から上へ描く。b = ゆれの量） ----------
  const M = {
    haniwa(c, x, y, b, wave) {                    // かわいい埴輪：筒の体・丸い頭・穴の目と口
      const yy = y + b;
      R(c, x - 5, yy - 16, 10, 16, '#c8733f'); R(c, x - 5, yy - 16, 2, 16, '#e0915a');
      disc(c, x, yy - 21, 6, '#c8733f'); disc(c, x - 2, yy - 23, 2, '#e0915a');
      R(c, x - 3, yy - 23, 2, 2, '#3b1f12'); R(c, x + 1, yy - 23, 2, 2, '#3b1f12'); R(c, x - 1, yy - 19, 2, 2, '#3b1f12');
      R(c, x - 4, yy - 20, 1, 1, '#f3a6a0'); R(c, x + 3, yy - 20, 1, 1, '#f3a6a0');   // ほっぺ
      R(c, x - 9, yy - 12, 4, 3, '#c8733f');
      if (wave) R(c, x + 5, yy - 17 - (wave > 0 ? 3 : 0), 3, 6, '#c8733f'); else R(c, x + 5, yy - 12, 4, 3, '#c8733f');
    },
    deer(c, x, y, b) {
      const yy = y + Math.abs(b) * 0.5;
      R(c, x - 7, yy - 10, 14, 6, '#a0673a'); R(c, x - 6, yy - 4, 2, 4, '#7a4a28'); R(c, x + 4, yy - 4, 2, 4, '#7a4a28');
      R(c, x + 5, yy - 15 + b * 0.3, 5, 5, '#a0673a'); R(c, x + 6, yy - 18 + b * 0.3, 1, 3, '#6b3f1f'); R(c, x + 9, yy - 18 + b * 0.3, 1, 3, '#6b3f1f');
      R(c, x + 8, yy - 13 + b * 0.3, 1, 1, '#1f1209'); R(c, x - 4, yy - 9, 1, 1, '#f5e6d0'); R(c, x, yy - 8, 1, 1, '#f5e6d0'); R(c, x + 2, yy - 9, 1, 1, '#f5e6d0');
    },
    hime(c, x, y, b) {                              // 十二単の小さな人形
      const yy = y + b * 0.5;
      tri(c, x - 8, x + 8, yy - 14, yy, '#b4327a'); tri(c, x - 6, x + 6, yy - 14, yy - 2, '#e9a23b'); tri(c, x - 4, x + 4, yy - 14, yy - 4, '#3a8f5c');
      disc(c, x, yy - 17, 3, '#fbe3cf'); R(c, x - 4, yy - 21, 8, 3, '#1b1b1b'); R(c, x - 5, yy - 18, 2, 12, '#1b1b1b'); R(c, x + 3, yy - 18, 2, 12, '#1b1b1b');
    },
    kabuto(c, x, y, b) {                            // かぶとの子
      const yy = y + b * 0.6;
      R(c, x - 4, yy - 10, 8, 10, '#3a4a6b'); disc(c, x, yy - 13, 4, '#fbe3cf');
      R(c, x - 6, yy - 17, 12, 3, '#2b2b36'); R(c, x - 5, yy - 22, 2, 5, '#e8c14a'); R(c, x + 3, yy - 22, 2, 5, '#e8c14a');
      R(c, x - 2, yy - 13, 1, 1, '#1b1b1b'); R(c, x + 1, yy - 13, 1, 1, '#1b1b1b');
    },
    noh(c, x, y, b) {                               // 能面
      const yy = y + b * 0.5;
      disc(c, x, yy - 10, 7, '#f4efe4'); R(c, x - 7, yy - 18, 14, 3, '#1b1b1b');
      R(c, x - 4, yy - 12, 2, 1, '#1b1b1b'); R(c, x + 2, yy - 12, 2, 1, '#1b1b1b'); R(c, x - 2, yy - 6, 4, 1, '#c0392b');
      R(c, x - 5, yy - 9, 1, 1, '#f3b0b0'); R(c, x + 4, yy - 9, 1, 1, '#f3b0b0');
    },
    ashigaru(c, x, y, b) {                          // 足軽（陣笠）
      const yy = y + b * 0.6;
      R(c, x - 3, yy - 10, 6, 10, '#5b3a29'); disc(c, x, yy - 13, 3, '#fbe3cf'); tri(c, x - 7, x + 7, yy - 19, yy - 15, '#2b2b2b');
      R(c, x + 4, yy - 22, 1, 22, '#8b6a3e'); R(c, x + 2, yy - 24, 5, 2, '#c9c9c9');
    },
    neko(c, x, y, b, wave) {                        // 招き猫
      R(c, x - 6, yy0(y) - 12, 12, 12, '#fbfbf5'); disc(c, x, y - 16, 6, '#fbfbf5');
      R(c, x - 6, y - 23, 3, 3, '#fbfbf5'); R(c, x + 3, y - 23, 3, 3, '#fbfbf5');
      R(c, x - 3, y - 17, 1, 1, '#1b1b1b'); R(c, x + 2, y - 17, 1, 1, '#1b1b1b'); R(c, x - 1, y - 14, 2, 1, '#e88a8a');
      R(c, x - 6, y - 9, 12, 2, '#d33b3b'); disc(c, x, y - 6, 2, '#e8c14a');
      R(c, x + 6, y - 14 - (wave > 0 ? 4 : 0), 3, 5, '#fbfbf5');
    },
    terakoya(c, x, y, b) {                          // 本を読む寺子屋の子
      const yy = y + b * 0.4;
      R(c, x - 4, yy - 9, 8, 9, '#5b7a99'); disc(c, x, yy - 12, 3, '#fbe3cf'); R(c, x - 3, yy - 16, 6, 2, '#1b1b1b');
      R(c, x - 5, yy - 8, 10, 4, '#f4efe4'); R(c, x, yy - 8, 1, 4, '#b0a58f');
    },
    shosei(c, x, y, b) {                            // 書生（学生帽）
      const yy = y + b * 0.5;
      R(c, x - 4, yy - 11, 8, 11, '#2b3a55'); disc(c, x, yy - 14, 3, '#fbe3cf'); R(c, x - 4, yy - 18, 8, 2, '#141414'); R(c, x - 5, yy - 16, 7, 1, '#141414');
    },
    dove(c, x, y, b) {                              // 平和のハト（はばたく）
      const up = b > 0;
      R(c, x - 4, y - 3, 8, 3, '#fbfbf5'); R(c, x + 3, y - 5, 3, 3, '#fbfbf5'); R(c, x + 6, y - 4, 2, 1, '#e8a23b');
      if (up) R(c, x - 3, y - 8, 4, 5, '#e6e6e0'); else R(c, x - 3, y, 4, 4, '#e6e6e0');
    }
  };
  function yy0(y) { return y; }

  // ---------- 時代ごとの景色（static：最初に1回だけ描く / anim：毎コマ） ----------
  const SCENES = {
    1: { // 縄文・弥生・古墳
      sky: ['#9fd3f0', '#f6e2b8'], glow: '#fff4c8',
      draw(c) {
        hills(c, 92, 6, '#9cc47a', 1);
        // 前方後円墳（かぎあなの形）
        for (let x = 52; x <= 96; x++) { const hh = 6 + (x - 52) * 0.28; R(c, x, 88 - hh, 1, hh * 2, '#5f9a4a'); }   // 前の四角い部分（前に向かって広がる）
        disc(c, 48, 88, 14, '#5f9a4a'); disc(c, 45, 83, 5, '#78b55e'); R(c, 60, 81, 30, 1, '#78b55e');   // 後ろの丸い部分
        R(c, 30, 101, 70, 2, '#6fa8c7');   // まわりの堀
        // 高床倉庫
        R(c, 186, 78, 26, 14, '#b07a44'); tri(c, 180, 218, 64, 79, '#d9b36a'); R(c, 189, 92, 3, 10, '#7a4f28'); R(c, 207, 92, 3, 10, '#7a4f28'); R(c, 196, 84, 6, 8, '#6b4423');
        ground(c, 100, '#d9b779', '#c79f5c');
        for (let i = 0; i < 6; i++) R(c, 110 + i * 11, 104, 9, 3, '#8fbf5a');   // 田んぼ
      },
      mascots: [['haniwa', 26, 128, 1], ['haniwa', 132, 124, 0], ['haniwa', 226, 128, 1]]
    },
    2: { // 飛鳥・奈良
      sky: ['#a8d8ea', '#fde9d9'], glow: '#ffe9c8',
      draw(c) {
        hills(c, 90, 8, '#8fbf7a', 3);
        // 五重塔
        for (let i = 0; i < 5; i++) { const y = 40 + i * 11, w = 16 + i * 4; tri(c, 196 - w, 196 + w, y - 4, y + 2, '#5a3328'); R(c, 192 - i, y + 2, 8 + i * 2, 7, '#c0392b'); }
        R(c, 195, 30, 2, 10, '#c9a227');
        // 大仏殿の屋根
        tri(c, 20, 96, 66, 82, '#5a3328'); R(c, 30, 82, 56, 12, '#c0392b'); R(c, 50, 86, 16, 8, '#e8c14a');
        ground(c, 100, '#cdb88a', '#b89f6a');
      },
      mascots: [['deer', 118, 126, 0], ['deer', 160, 128, 0], ['deer', 40, 128, 0]]
    },
    3: { // 平安
      sky: ['#c9b6e4', '#fde1ea'], glow: '#fff0f5', petals: true,
      draw(c) {
        disc(c, 206, 26, 10, '#fff8dc'); disc(c, 206, 26, 7, '#fffbe8');   // 望月
        hills(c, 92, 5, '#a8c99a', 5);
        // 寝殿造
        tri(c, 70, 170, 62, 78, '#5a4a3a'); R(c, 80, 78, 80, 14, '#f3e7d3'); for (let i = 0; i < 6; i++) R(c, 84 + i * 14, 78, 3, 14, '#c0392b');
        // 桜
        R(c, 30, 70, 4, 30, '#6b4423'); disc(c, 32, 64, 14, '#f7b6c8'); disc(c, 22, 70, 8, '#f9c9d6'); disc(c, 44, 70, 9, '#f4a3bb');
        R(c, 0, 100, W, 12, '#7fb3c9'); ground(c, 112, '#cbb58e', '#b39b70');   // 池
      },
      mascots: [['hime', 120, 130, 0], ['hime', 200, 130, 0]]
    },
    4: { // 鎌倉
      sky: ['#8ec5e8', '#e4f1f7'], glow: '#f0faff', waves: true,
      draw(c) {
        hills(c, 84, 10, '#7aa06a', 7);
        // 鳥居
        R(c, 168, 52, 50, 4, '#c0392b'); R(c, 172, 60, 42, 3, '#c0392b'); R(c, 176, 56, 4, 40, '#c0392b'); R(c, 206, 56, 4, 40, '#c0392b'); R(c, 164, 50, 58, 3, '#2b2b2b');
        // 元の船（遠く）
        R(c, 40, 82, 30, 4, '#4a3a2a'); R(c, 54, 66, 2, 16, '#4a3a2a'); tri(c, 46, 64, 66, 80, '#e7dcc6');
        R(c, 0, 90, W, 12, '#3d7fb3'); ground(c, 102, '#d8c79a', '#c2ad78');
      },
      mascots: [['kabuto', 100, 130, 0], ['kabuto', 140, 128, 0]]
    },
    5: { // 室町
      sky: ['#d9d4c7', '#f4f1ea'], glow: '#ffffff',
      draw(c) {
        tri(c, 0, 90, 30, 92, '#9b9b95'); tri(c, 50, 150, 44, 92, '#7d7d78'); tri(c, 150, 240, 38, 92, '#aaa9a2');   // 水墨画の山
        // 金閣
        R(c, 98, 78, 44, 12, '#d9a521'); tri(c, 92, 148, 70, 78, '#3a2a1a'); R(c, 104, 62, 32, 8, '#e8b931'); tri(c, 100, 140, 54, 62, '#3a2a1a'); R(c, 110, 46, 20, 8, '#f0c63f'); tri(c, 106, 134, 38, 46, '#3a2a1a'); R(c, 119, 32, 2, 6, '#f0c63f');
        R(c, 0, 92, W, 16, '#7fa7b0');
        for (let y = 0; y < 14; y += 2) R(c, 100, 94 + y, 40, 1, 'rgba(232,185,49,0.35)');   // 池にうつる金閣
        ground(c, 108, '#c9c3b2', '#b0a990');
      },
      mascots: [['noh', 40, 128, 0], ['noh', 200, 128, 0]]
    },
    6: { // 戦国・安土桃山
      sky: ['#f6b26b', '#fbe2c0'], glow: '#fff1d6', flags: true,
      draw(c) {
        hills(c, 90, 8, '#8a9a5b', 9);
        // 天守
        R(c, 90, 82, 60, 12, '#7a7a7a'); R(c, 96, 66, 48, 16, '#f6f3ea'); tri(c, 88, 152, 58, 68, '#3a3a44');
        R(c, 104, 46, 32, 12, '#f6f3ea'); tri(c, 98, 142, 38, 48, '#3a3a44'); R(c, 112, 30, 16, 9, '#f6f3ea'); tri(c, 108, 132, 22, 31, '#3a3a44');
        R(c, 108, 20, 3, 3, '#e8c14a'); R(c, 129, 20, 3, 3, '#e8c14a');   // しゃちほこ
        ground(c, 100, '#c9a96e', '#b08f55');
      },
      mascots: [['ashigaru', 36, 130, 0], ['ashigaru', 60, 128, 0], ['ashigaru', 196, 130, 0]]
    },
    7: { // 江戸前〜中期
      sky: ['#9ccbe8', '#fdf0d5'], glow: '#fff8e1',
      draw(c) {
        tri(c, 70, 190, 22, 86, '#5b7fa6'); tri(c, 108, 152, 22, 38, '#f7f9fb');   // 富士山
        for (let i = 0; i < 8; i++) { const x = i * 32 - 6; R(c, x, 86, 28, 14, '#ece2cc'); tri(c, x - 3, x + 31, 78, 87, '#4a4a52'); R(c, x + 10, 90, 8, 10, '#6b4423'); }
        ground(c, 100, '#d6c49a', '#bfa874');
      },
      mascots: [['neko', 120, 130, 1], ['neko', 30, 130, 1]]
    },
    8: { // 江戸後期〜幕末
      sky: ['#7fa8c9', '#e8eef2'], glow: '#f5fbff', smoke: [168, 52],
      draw(c) {
        R(c, 0, 84, W, 18, '#2f5f8a');
        // 北斎ふうの波
        for (let i = 0; i < 3; i++) { disc(c, 30 + i * 22, 86, 10, '#e9f1f7'); disc(c, 30 + i * 22, 88, 9, '#2f5f8a'); }
        // 黒船
        R(c, 140, 70, 64, 10, '#1b1b22'); R(c, 146, 64, 52, 6, '#2b2b33'); R(c, 164, 52, 6, 12, '#2b2b33'); R(c, 182, 44, 2, 20, '#5a4a3a'); tri(c, 176, 190, 44, 60, '#e7dcc6');
        disc(c, 156, 78, 2, '#7a5a3a');
        ground(c, 102, '#d8c79a', '#c2ad78');
      },
      mascots: [['terakoya', 50, 130, 0], ['terakoya', 90, 130, 0]]
    },
    9: { // 明治
      sky: ['#b9c7d6', '#f1e6d2'], glow: '#fff3dc', train: true,
      draw(c) {
        // レンガの建物
        R(c, 150, 46, 70, 46, '#b5523b'); for (let y = 50; y < 92; y += 4) R(c, 150, y, 70, 1, '#9a4430'); tri(c, 146, 224, 34, 46, '#5a5a62');
        for (let i = 0; i < 4; i++) R(c, 156 + i * 16, 56, 8, 12, '#f1e6d2');
        // ガス灯
        R(c, 40, 58, 2, 34, '#2b2b2b'); R(c, 37, 54, 8, 6, '#ffe7a3');
        R(c, 0, 92, W, 3, '#7a6a5a'); R(c, 0, 96, W, 2, '#5a4a3a');   // 線路
        ground(c, 100, '#cbb994', '#b3a072');
      },
      mascots: [['shosei', 110, 130, 0], ['shosei', 210, 130, 0]]
    },
    10: { // 大正・昭和〜現代
      sky: ['#7ec8f0', '#e6f6ff'], glow: '#ffffff', shinkansen: true, birds: true,
      draw(c) {
        // 東京タワー
        tri(c, 176, 212, 18, 92, '#e2533b'); tri(c, 184, 204, 40, 92, '#e6f6ff'); R(c, 186, 50, 16, 3, '#f7f7f7'); R(c, 182, 70, 24, 3, '#f7f7f7');
        for (let i = 0; i < 6; i++) R(c, 10 + i * 24, 70 - (i % 3) * 8, 20, 30 + (i % 3) * 8, i % 2 ? '#9fb3c8' : '#b8c8d8');   // ビル
        R(c, 0, 92, W, 3, '#8a8a8a');
        ground(c, 100, '#a9c98a', '#8fb36e');
      },
      mascots: [['dove', 60, 120, 0], ['dove', 130, 114, 0]]
    }
  };

  // ---------- 描く ----------
  function buildBackground(n) {
    scene = SCENES[n] || SCENES[1];
    bgCtx.clearRect(0, 0, W, H);
    sky(bgCtx, scene.sky[0], scene.sky[1]);
    scene.draw(bgCtx);
  }

  function frame(ms) {
    const t = (ms - t0) / 1000;
    ctx.drawImage(bg, 0, 0);
    // 雲（ゆっくり流れる）
    for (let i = 0; i < 3; i++) cloud(ctx, ((t * (4 + i * 2) + i * 90) % (W + 40)) - 30, 14 + i * 9, 'rgba(255,255,255,0.75)');
    // 光の粒（アニメ風のきらめき。点滅ではなく、ゆっくり明るさが変わる）
    for (let i = 0; i < 10; i++) {
      const a = 0.25 + 0.25 * Math.sin(t * 1.5 + i * 1.7);
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
      ctx.fillRect(Math.round((i * 53 + t * 3) % W), Math.round(20 + ((i * 37) % 60) + Math.sin(t + i) * 2), 1, 1);
    }
    if (scene.petals) for (let i = 0; i < 12; i++) R(ctx, (i * 29 + t * 12) % W, (i * 17 + t * 18) % 110, 2, 1, '#f9c0d0');
    if (scene.waves) for (let x = 0; x < W; x += 12) R(ctx, x + Math.sin(t * 2 + x) * 2, 92 + Math.sin(t * 2 + x / 7), 6, 1, '#e9f1f7');
    if (scene.flags) for (let i = 0; i < 4; i++) { const x = 20 + i * 62, sway = Math.round(Math.sin(t * 3 + i) * 2); R(ctx, x, 70, 1, 30, '#5a4a3a'); R(ctx, x + 1, 71, 6 + sway, 12, i % 2 ? '#c0392b' : '#f6f3ea'); }
    if (scene.smoke) for (let i = 0; i < 5; i++) disc(ctx, scene.smoke[0] + i * 3, scene.smoke[1] - ((t * 8 + i * 6) % 30), 2 + (i % 2), 'rgba(90,90,100,0.45)');
    if (scene.train) {
      const x = ((t * 22) % (W + 120)) - 100;
      R(ctx, x, 82, 30, 10, '#2b2b33'); R(ctx, x + 22, 76, 8, 6, '#2b2b33'); R(ctx, x + 32, 84, 24, 8, '#6b3a2a'); R(ctx, x + 58, 84, 24, 8, '#6b3a2a');
      for (let i = 0; i < 3; i++) disc(ctx, x + 25 - i * 5, 70 - i * 4, 2 + i, 'rgba(240,240,240,0.6)');
    }
    if (scene.shinkansen) {
      const x = W - ((t * 40) % (W + 140));
      R(ctx, x, 84, 120, 8, '#f7f7f7'); R(ctx, x, 89, 120, 2, '#2a5db0'); tri(ctx, x - 10, x + 10, 84, 92, '#f7f7f7');
    }
    if (scene.birds) for (let i = 0; i < 3; i++) M.dove(ctx, ((t * 15 + i * 70) % (W + 20)) - 10, 30 + i * 8, Math.sin(t * 8 + i));
    // マスコット（ぴょこぴょこゆれる。手をふる子もいる）
    scene.mascots.forEach((m, i) => {
      const b = Math.round(Math.sin(t * 3 + i * 1.3) * 1.5);
      const wave = m[3] ? (Math.sin(t * 5 + i) > 0 ? 1 : -1) : 0;
      M[m[0]](ctx, m[1], m[2], b, wave);
    });
  }

  function loop(ms) {
    raf = requestAnimationFrame(loop);
    if (ms - last < 1000 / FPS) return;
    last = ms;
    frame(ms);
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.className = 'kanji-era-bg';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:cover;image-rendering:pixelated;image-rendering:crisp-edges;z-index:0;pointer-events:none;opacity:0;transition:opacity .5s';
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');
    bg = document.createElement('canvas'); bg.width = W; bg.height = H; bgCtx = bg.getContext('2d');
  }

  function show(n) {
    ensureCanvas();
    n = Math.min(10, Math.max(1, parseInt(n, 10) || 1));
    if (n !== era) { era = n; buildBackground(n); }
    canvas.style.opacity = '1';
    document.body.classList.add('has-era-bg');
    cancelAnimationFrame(raf);
    t0 = performance.now();
    if (reduced) { frame(t0 + 1000); return; }
    raf = requestAnimationFrame(loop);
  }

  function hide() {
    if (!canvas) return;
    cancelAnimationFrame(raf); raf = 0;
    canvas.style.opacity = '0';
    document.body.classList.remove('has-era-bg');
  }

  window.KanjiEras = { show: show, hide: hide, eras: Object.keys(SCENES).length };
})();
