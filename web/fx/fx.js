// ===============================================================
// 漢字の刃 演出エンジン（KanjiFX）
//   ・320×180 の小さな画面に描いて、拡大して表示する → 自然にドット絵の見た目になる
//   ・動きはアニメの手法（ため→一気に動く、残像、集中線、衝撃の一瞬止め、画面のゆれ）
//   ・ライブラリなし（このファイルだけ。約70KB）。演出が終わると描画を止めるので、待っている間は負荷ゼロ
//   ・勝ち負け・出目はサーバー（または今の画面の処理）が決めた値を受け取って見せるだけ
//
//   KanjiFX.janken(要素, round)          … じゃんけん1回戦（RandomBattle の log の1件をそのまま渡せる）
//   KanjiFX.dice(要素, { value })         … すごろくのサイコロ。value は数字か Promise（サーバーの返事を待ちながら転がす）
//   KanjiFX.diceDuel(要素, { … })         … 偉人（ボス）とのサイコロ勝負
//   KanjiFX.gachaOpen(要素, { results })  … ガチャ開封（昇格・シルエット・サインつき）
//   KanjiFX.treasure(要素, { icon, label }) … 宝箱（タップで開けると中身が飛び出す）
//   KanjiFX.enableTapSparkles()           … 画面のどこをタップしても星が散る
//   KanjiFX.setSound(true / false)        … 効果音のオン・オフ（端末に記憶）
// ===============================================================
(function (global) {
  'use strict';

  const W = 320, H = 180;
  const FONT = '"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans","Yu Gothic",sans-serif';
  const REDUCED = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const HAND = { 'グー': '✊', 'チョキ': '✌️', 'パー': '🖐️' };
  const RARITY = {
    'N': { c: '#94a3b8', r: 1 }, 'N+': { c: '#cbd5e1', r: 2 }, 'R': { c: '#3b82f6', r: 3 }, 'R+': { c: '#60a5fa', r: 4 },
    'SR': { c: '#a855f7', r: 5 }, 'SR+': { c: '#c084fc', r: 6 }, 'SSR': { c: '#f59e0b', r: 7 }, 'UR': { c: '#ec4899', r: 8 },
    'UR+': { c: '#f472b6', r: 9 }, 'LEGEND': { c: '#ef4444', r: 10 }
  };
  const rarityOf = (r) => RARITY[String(r || 'N').trim()] || RARITY.N;

  // ---------------- 動きの速さの変化（イージング） ----------------
  const E = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inBack: (t) => 2.7 * t * t * t - 1.7 * t * t,
    outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
    outElastic: (t) => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1
  };

  // ---------------- 効果音（ファイルなし。ピコピコ音をその場で作る） ----------------
  const Sound = {
    on: (function () { try { return localStorage.getItem('kanji_fx_sound') !== 'off'; } catch (e) { return true; } })(),
    ctx: null,
    vol: 0.12,
    ac() {
      if (!this.on) return null;
      try {
        if (!this.ctx) this.ctx = new (global.AudioContext || global.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      } catch (e) { return null; }
    },
    tone(freq, dur, type, when, vol, slide) {
      const ac = this.ac(); if (!ac) return;
      const t0 = ac.currentTime + (when || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime((vol || 1) * this.vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise(dur, when, vol) {
      const ac = this.ac(); if (!ac) return;
      const t0 = ac.currentTime + (when || 0);
      const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ac.createBufferSource(), g = ac.createGain();
      s.buffer = buf; g.gain.value = (vol || 1) * this.vol;
      s.connect(g); g.connect(ac.destination); s.start(t0);
    },
    play(name) {
      switch (name) {
        case 'tick': this.tone(880 + Math.random() * 300, 0.03, 'square', 0, 0.5); break;
        case 'whoosh': this.noise(0.18, 0, 0.5); break;
        case 'thud': this.tone(140, 0.12, 'triangle', 0, 1.2, 60); break;
        case 'jan': this.tone(523, 0.08, 'square'); break;
        case 'ken': this.tone(659, 0.08, 'square'); break;
        case 'pon': this.tone(784, 0.06, 'square'); this.tone(1047, 0.12, 'square', 0.06); break;
        case 'clash': this.noise(0.25, 0, 1.4); this.tone(220, 0.2, 'sawtooth', 0, 0.8, 80); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', i * 0.09)); break;
        case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.18, 'triangle', i * 0.14, 1.2)); break;
        case 'draw': this.tone(440, 0.1, 'square'); this.tone(440, 0.1, 'square', 0.15); break;
        case 'land': this.tone(330, 0.08, 'square', 0, 0.8); this.tone(660, 0.1, 'square', 0.05, 0.6); break;
        case 'six': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.1, 'square', i * 0.06)); break;
        case 'beam': this.tone(1200, 0.25, 'sawtooth', 0, 0.6, 200); break;
        case 'hit': this.noise(0.15, 0, 1.2); this.tone(110, 0.15, 'square', 0, 0.9, 55); break;
        case 'tear': this.noise(0.35, 0, 1.3); this.tone(900, 0.25, 'sawtooth', 0, 0.4, 300); break;
        case 'flip': this.tone(600, 0.04, 'square', 0, 0.6); this.tone(900, 0.05, 'square', 0.04, 0.6); break;
        case 'rumble': this.tone(70, 0.5, 'sawtooth', 0, 1.2, 50); break;
        case 'reveal1': this.tone(660, 0.1, 'square'); break;
        case 'reveal2': [523, 659, 784].forEach((f, i) => this.tone(f, 0.1, 'square', i * 0.07)); break;
        case 'reveal3': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.12, 'square', i * 0.07)); break;
        case 'legend':
          [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.12, 'square', i * 0.06));
          [1047, 1319, 1568].forEach((f) => this.tone(f, 0.6, 'triangle', 0.5, 0.8));
          break;
        case 'thunder': this.noise(0.45, 0, 1.6); this.tone(60, 0.4, 'sawtooth', 0, 1.2, 40); break;
        case 'sign': this.tone(1400, 0.18, 'sine', 0, 0.8, 2800); this.tone(2800, 0.12, 'triangle', 0.15, 0.5); break;
        case 'slam': this.noise(0.12, 0, 1.4); this.tone(180, 0.18, 'square', 0, 1, 90); break;
        case 'chest': this.tone(120, 0.14, 'triangle', 0, 1.2, 70); break;
        case 'open': this.noise(0.1, 0, 0.8); [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.12, 'square', 0.05 + i * 0.07)); break;
        case 'line': this.tone(520 + Math.random() * 80, 0.03, 'square', 0, 0.35); break;
      }
    }
  };

  // ---------------- 画像の読み込み（同じ画像は1回だけ） ----------------
  const imageCache = {};
  function loadImage(url, fallback) {
    if (!url) return Promise.resolve(null);
    if (!imageCache[url]) {
      imageCache[url] = new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => { if (fallback && fallback !== url) loadImage(fallback).then(resolve); else resolve(null); };
        img.src = url;
      });
    }
    return imageCache[url];
  }

  // ---------------- 背景（帯とドットのぼかしで、ドット絵らしく） ----------------
  const bgCache = {};
  function background(theme) {
    if (bgCache[theme]) return bgCache[theme];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const bands = theme === 'board'
      ? ['#1e1b4b', '#312e81', '#4338ca', '#6d28d9', '#9333ea']
      : ['#0b1020', '#111a33', '#1b2550', '#28306b', '#3b2a73'];
    const bh = 120 / bands.length;
    bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, Math.floor(i * bh), W, Math.ceil(bh)); });
    // 帯の境目を市松模様でなじませる（ドット絵のディザ）
    for (let i = 1; i < bands.length; i++) {
      const y0 = Math.floor(i * bh);
      g.fillStyle = bands[i - 1];
      for (let y = y0; y < y0 + 4; y++) for (let x = (y % 2); x < W; x += 2) if ((y - y0) < 2 || (x + y) % 4 === 0) g.fillRect(x, y, 1, 1);
    }
    // 床
    g.fillStyle = theme === 'board' ? '#2a1f4f' : '#141a2e'; g.fillRect(0, 120, W, 60);
    g.fillStyle = theme === 'board' ? '#3a2d6b' : '#1f2742';
    for (let y = 124, step = 3; y < H; y += step, step += 2) g.fillRect(0, y, W, 1);
    for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(160 + i * 6, 120); g.lineTo(160 + i * 60, H); g.strokeStyle = g.fillStyle; g.lineWidth = 1; g.stroke(); }
    // 星
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = (i * 53) % 110; g.globalAlpha = 0.25 + (i % 3) * 0.2; g.fillRect(x, y, 1, 1); }
    g.globalAlpha = 1;
    bgCache[theme] = c;
    return c;
  }

  // ---------------- 舞台 ----------------
  class Stage {
    constructor(host, opts) {
      opts = opts || {};
      this.host = host;
      this.theme = opts.theme || 'arena';
      this.canvas = document.createElement('canvas');
      this.canvas.width = W; this.canvas.height = H;
      this.canvas.className = 'kfx-canvas';
      Object.assign(this.canvas.style, { width: '100%', aspectRatio: '16 / 9', display: 'block', imageRendering: 'pixelated', borderRadius: '12px', background: '#000', cursor: 'pointer', touchAction: 'manipulation' });
      host.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.items = []; this.tweens = []; this.particles = [];
      this.speed = 1; this.stopUntil = 0;
      this.shakeAmt = 0; this.flashA = 0; this.flashColor = '#fff';
      this.lines = 0; this.linesX = 160; this.linesY = 90; this.linesSeed = [];
      this.inverted = 0;
      this.closed = false; this.last = 0;
      this.frame = this.frame.bind(this);
      // 画面をタップすると早送り。ただし「タップを待っている」とき（ガチャのパックなど）はそちらを優先
      this.onTap = null;
      this.skipHandler = () => {
        if (this.onTap) { const f = this.onTap; this.onTap = null; f(); }
        else this.speed = 4;
      };
      this.canvas.addEventListener('pointerdown', this.skipHandler);
      requestAnimationFrame(this.frame);
    }
    frame(now) {
      if (this.closed) return;
      const real = this.last ? Math.min(50, now - this.last) : 16;
      this.last = now;
      const dt = (now < this.stopUntil) ? 0 : real * this.speed;
      // 動き
      for (let i = this.tweens.length - 1; i >= 0; i--) {
        const tw = this.tweens[i];
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.ms), e = tw.ease(k);
        for (const p in tw.to) tw.obj[p] = tw.from[p] + (tw.to[p] - tw.from[p]) * e;
        if (k >= 1) { this.tweens.splice(i, 1); tw.done(); }
      }
      for (const it of this.items) {
        if (it.follow) { it.x = it.follow.x + (it.ox || 0); it.y = it.follow.y + (it.oy || 0); }
        if (it.update) it.update(dt, this);
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        const s = dt / 16;
        p.vy += p.g * s; p.vx *= p.drag; p.vy *= p.drag;
        p.x += p.vx * s; p.y += p.vy * s;
      }
      this.shakeAmt = Math.max(0, this.shakeAmt - real * 0.02);
      this.flashA = Math.max(0, this.flashA - real * 0.004);
      this.inverted = Math.max(0, this.inverted - real);
      this.lines = Math.max(0, this.lines - real);
      this.draw(now);
      requestAnimationFrame(this.frame);
    }
    draw(now) {
      const g = this.ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(background(this.theme), 0, 0);
      if (this.shakeAmt > 0 && !REDUCED) {
        g.translate(Math.round((Math.random() * 2 - 1) * this.shakeAmt), Math.round((Math.random() * 2 - 1) * this.shakeAmt));
      }
      if (this.lines > 0 && !REDUCED) this.drawLines(g, now);
      const list = this.items.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
      for (const it of list) {
        if (it.alpha === 0 || it.hidden) continue;
        g.save();
        g.globalAlpha = it.alpha === undefined ? 1 : it.alpha;
        it.draw(g, this, now);
        g.restore();
      }
      for (const p of this.particles) {
        g.globalAlpha = Math.min(1, p.life / 200);
        g.fillStyle = p.color;
        const x = Math.round(p.x), y = Math.round(p.y), s = p.size;
        if (p.shape === 'star') { g.fillRect(x - s, y, s * 2 + 1, 1); g.fillRect(x, y - s, 1, s * 2 + 1); }
        else g.fillRect(x, y, s, s);
      }
      g.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
      // 衝撃の一瞬：白黒を反転したようなコマ（アニメの「インパクトフレーム」）
      if (this.inverted > 0 && !REDUCED) {
        g.globalCompositeOperation = 'difference'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
      }
      if (this.flashA > 0 && !REDUCED) { g.globalAlpha = this.flashA; g.fillStyle = this.flashColor; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    }
    drawLines(g, now) {
      // 集中線：中心に向かう細い三角形を、2コマごとに描き直す
      if (!this.linesSeed.length || Math.floor(now / 50) !== this.linesFrame) {
        this.linesFrame = Math.floor(now / 50);
        this.linesSeed = [];
        for (let i = 0; i < 46; i++) this.linesSeed.push([Math.random() * Math.PI * 2, 70 + Math.random() * 40, 0.01 + Math.random() * 0.025]);
      }
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [a, r, w] of this.linesSeed) {
        g.beginPath();
        g.moveTo(this.linesX + Math.cos(a) * r, this.linesY + Math.sin(a) * r);
        g.lineTo(this.linesX + Math.cos(a - w) * 260, this.linesY + Math.sin(a - w) * 260);
        g.lineTo(this.linesX + Math.cos(a + w) * 260, this.linesY + Math.sin(a + w) * 260);
        g.fill();
      }
    }
    add(it) { this.items.push(it); return it; }
    remove(it) { const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); }
    tween(obj, to, ms, ease) {
      return new Promise((done) => {
        const from = {};
        for (const p in to) from[p] = obj[p] === undefined ? 0 : obj[p];
        // 同じものの同じ値を動かしている途中の動きは、そこで終わらせる（新しい動きを優先）
        this.tweens = this.tweens.filter((tw) => {
          const overlap = tw.obj === obj && Object.keys(to).some((p) => p in tw.to);
          if (overlap) tw.done();
          return !overlap;
        });
        this.tweens.push({ obj, from, to, ms: Math.max(1, ms), t: 0, ease: ease || E.outCubic, done });
      });
    }
    wait(ms) { return this.tween({ v: 0 }, { v: 1 }, ms, E.linear); }
    // タップを待つ。ms たってもタップがなければ先へ進む（止まったままにしない）
    waitTap(ms) {
      return new Promise((resolve) => {
        let done = false;
        const finish = (how) => { if (done) return; done = true; if (this.onTap === tapped) this.onTap = null; resolve(how); };
        const tapped = () => finish('tap');
        this.onTap = tapped;
        setTimeout(() => finish('timeout'), ms);
      });
    }
    shake(px) { this.shakeAmt = Math.max(this.shakeAmt, px); }
    flash(color, a) { this.flashColor = color || '#fff'; this.flashA = Math.max(this.flashA, Math.min(0.6, a || 0.5)); }
    impact() { this.inverted = 70; }
    hitstop(ms) { this.stopUntil = performance.now() + ms; }
    speedLines(ms, x, y) { this.lines = ms; this.linesX = x === undefined ? 160 : x; this.linesY = y === undefined ? 90 : y; }
    burst(x, y, o) {
      o = o || {};
      const n = REDUCED ? Math.ceil((o.n || 20) / 3) : (o.n || 20);
      const colors = o.colors || ['#ffffff', '#fde68a', '#f59e0b'];
      for (let i = 0; i < n; i++) {
        const a = (o.angle === undefined ? Math.random() * Math.PI * 2 : o.angle + (Math.random() - 0.5) * (o.spread || 1));
        const sp = (o.speed || 3) * (0.4 + Math.random() * 0.8);
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), g: o.g === undefined ? 0.12 : o.g, drag: o.drag || 0.96,
          life: (o.life || 600) * (0.6 + Math.random() * 0.6), size: o.size || (Math.random() < 0.3 ? 2 : 1), color: colors[i % colors.length], shape: o.shape });
      }
    }
    dust(x, y) { this.burst(x, y, { n: 10, colors: ['#cbd5e1', '#94a3b8'], speed: 1.4, g: -0.01, up: 0.4, life: 400, size: 2 }); }
    destroy() {
      this.closed = true;
      this.canvas.removeEventListener('pointerdown', this.skipHandler);
      if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  // ---------------- 描くもの ----------------
  function outlinedText(g, text, x, y, size, color, outline, align) {
    g.font = `900 ${size}px ${FONT}`;
    g.textAlign = align || 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, Math.round(size / 6)); g.strokeStyle = outline || '#000';
    g.strokeText(text, x, y);
    g.fillStyle = color || '#fff';
    g.fillText(text, x, y);
  }

  class Card {
    constructor(img, rarity) {
      this.img = img; this.rar = rarityOf(rarity); this.rarity = String(rarity || 'N');
      this.x = 0; this.y = 0; this.w = 58; this.h = 80; this.sx = 1; this.sy = 1; this.rot = 0; this.z = 2;
      this.trail = []; this.trailOn = false; this.glow = 0;
      this.glowColor = '#ffffff';
      this.back = false;   // true：裏向き（ガチャでめくる前）
      this.holo = 0;       // 1：光沢が流れる（高レア）
      this.rainbow = 0;    // 1：ふちが虹色（LEGEND）
    }
    update(dt, st) {
      if (this.trailOn) { this.trail.unshift({ x: this.x, y: this.y, sx: this.sx, sy: this.sy }); if (this.trail.length > 4) this.trail.pop(); }
      else if (this.trail.length) this.trail.pop();
      // レアリティが高いカードは、ときどききらめく（裏向きのときは、めくるまでわからないように光らせない）
      if (!this.back && this.rar.r >= 7 && Math.random() < 0.04 * (dt / 16)) {
        st.burst(this.x + (Math.random() - 0.5) * this.w, this.y + (Math.random() - 0.5) * this.h, { n: 1, colors: [this.rar.c, '#ffffff'], speed: 0.2, g: -0.01, life: 500, shape: 'star', size: 2 });
      }
    }
    body(g, now) {
      const w = this.w, h = this.h;
      // 勝ったカードは白く光る（ゆっくり明滅。点滅にはしない）
      if (this.glow) {
        const pulse = (0.45 + 0.35 * Math.sin(now / 160)) * this.glow;
        g.save(); g.globalAlpha *= pulse; g.fillStyle = this.glowColor || '#ffffff'; g.fillRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8); g.restore();
      }
      g.fillStyle = '#000'; g.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
      if (this.back) { cardBack(g, w, h, now); return; }
      g.fillStyle = this.rainbow ? `hsl(${Math.floor(now / 6) % 360}, 90%, 60%)` : this.rar.c;
      g.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
      g.fillStyle = '#0f172a'; g.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      this.drawImage(g, w, h);
      if (this.holo) holoShine(g, w, h, now);
    }
    drawImage(g, w, h) {
      if (this.img) {
        // 絵を小さい画面に縮めて描く → 拡大表示でドット絵風になる（動くカードは動いたまま）
        const iw = this.img.naturalWidth || this.img.width, ih = this.img.naturalHeight || this.img.height;
        const s = Math.max((w - 4) / iw, (h - 4) / ih), dw = iw * s, dh = ih * s;
        g.save(); g.beginPath(); g.rect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4); g.clip();
        g.drawImage(this.img, -dw / 2, -dh / 2, dw, dh);
        g.restore();
      } else {
        outlinedText(g, '？', 0, 0, 28, '#475569', '#0f172a');
      }
    }
    draw(g, st, now) {
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const t = this.trail[i];
        g.save(); g.globalAlpha *= 0.25 * (1 - i / this.trail.length);
        g.translate(Math.round(t.x), Math.round(t.y)); g.scale(t.sx, t.sy);
        g.fillStyle = this.rar.c; g.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        g.restore();
      }
      g.translate(Math.round(this.x), Math.round(this.y)); g.rotate(this.rot); g.scale(this.sx, this.sy);
      this.body(g, now);
    }
  }

  // カードの裏：紺地に金のふち、まん中に「刃」
  function cardBack(g, w, h, now) {
    g.fillStyle = '#b45309'; g.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
    g.fillStyle = '#fbbf24'; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = '#1e1b4b'; g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
    g.fillStyle = '#312e81';
    for (let y = -h / 2 + 5; y < h / 2 - 5; y += 6) for (let x = -w / 2 + 5 + ((y / 6) % 2 ? 3 : 0); x < w / 2 - 5; x += 6) g.fillRect(Math.round(x), Math.round(y), 2, 2);
    g.fillStyle = '#4c1d95'; g.beginPath(); g.arc(0, 0, Math.min(w, h) * 0.28, 0, Math.PI * 2); g.fill();
    outlinedText(g, '刃', 0, 1, Math.round(Math.min(w, h) * 0.38), '#fde68a', '#78350f');
  }

  // 高レアのカードに、ななめの光が流れる
  function holoShine(g, w, h, now) {
    const t = (now % 1600) / 1600, x = -w + t * w * 2.4;
    g.save();
    g.beginPath(); g.rect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4); g.clip();
    g.globalCompositeOperation = 'lighter';
    const grd = g.createLinearGradient(x - 14, -h / 2, x + 14, h / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
  }

  class Text {
    constructor(text, size, color, outline) { this.text = text; this.size = size; this.color = color; this.outline = outline; this.x = 160; this.y = 90; this.sx = 1; this.sy = 1; this.rot = 0; this.z = 6; }
    draw(g) { g.translate(Math.round(this.x), Math.round(this.y)); g.rotate(this.rot); g.scale(this.sx, this.sy); outlinedText(g, this.text, 0, 0, this.size, this.color, this.outline); }
  }

  // 手（絵文字）を小さく描いて拡大 → ドット絵風の手になる。黒いふちは、絵文字の形を黒くぬったものを上下左右にずらして作る
  const glyphCache = {};
  function glyphSprite(ch, size) {
    const key = ch + size;
    if (glyphCache[key]) return glyphCache[key];
    const pad = 3, s = Math.ceil(size * 1.3) + pad * 2;
    const make = () => { const c = document.createElement('canvas'); c.width = c.height = s; return c; };
    const emoji = make(), eg = emoji.getContext('2d');
    eg.font = `${size}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    eg.textAlign = 'center'; eg.textBaseline = 'middle';
    eg.fillText(ch, s / 2, s / 2);
    const sil = make(), sg = sil.getContext('2d');
    sg.drawImage(emoji, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, s, s);
    const out = make(), og = out.getContext('2d');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) og.drawImage(sil, dx, dy);
    og.drawImage(emoji, 0, 0);
    glyphCache[key] = out;
    return out;
  }
  class Glyph {
    constructor(ch, size) { this.ch = ch; this.size = size; this.x = 0; this.y = 0; this.sx = 1; this.sy = 1; this.rot = 0; this.z = 5; this.flip = false; }
    draw(g) {
      const spr = glyphSprite(this.ch, this.size);
      g.translate(Math.round(this.x), Math.round(this.y)); g.rotate(this.rot); g.scale(this.sx * (this.flip ? -1 : 1), this.sy);
      g.drawImage(spr, -spr.width / 2, -spr.height / 2);
    }
  }

  class Banner {
    constructor(text, color) { this.text = text; this.color = color || '#7c3aed'; this.x = -200; this.y = 34; this.z = 7; this.sy = 1; }
    draw(g) {
      g.translate(Math.round(this.x), this.y); g.scale(1, this.sy);
      g.fillStyle = '#000'; g.fillRect(-170, -15, 340, 30);
      g.fillStyle = this.color; g.fillRect(-170, -13, 340, 26);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-170, -13, 340, 4);
      outlinedText(g, this.text, 0, 1, 18, '#ffffff', '#000');
    }
  }

  // サイコロ：日本のサイコロらしく「1」は赤い大きな目
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  class Die {
    constructor(golden, size) { this.golden = !!golden; this.s = size || 26; this.face = 1; this.x = 0; this.y = 0; this.rot = 0; this.sx = 1; this.sy = 1; this.z = 4; this.rolling = false; this.flick = 0; this.ground = 150; this.trail = []; }
    update(dt) {
      if (this.rolling) { this.flick += dt; if (this.flick > 70) { this.flick = 0; let f; do { f = 1 + Math.floor(Math.random() * 6); } while (f === this.face); this.face = f; } }
      this.trail.unshift({ x: this.x, y: this.y, rot: this.rot }); if (this.trail.length > (this.rolling ? 3 : 0)) this.trail.length = this.rolling ? 3 : 0;
    }
    shape(g, s, fill, dark) {
      const h = s / 2;
      g.fillStyle = '#000'; g.fillRect(-h - 1, -h + 2, s + 2, s - 4); g.fillRect(-h + 2, -h - 1, s - 4, s + 2); g.fillRect(-h, -h, s, s);
      g.fillStyle = dark; g.fillRect(-h + 1, -h + 1, s - 2, s - 2);
      g.fillStyle = fill; g.fillRect(-h + 1, -h + 1, s - 4, s - 4);
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-h + 3, -h + 2, s / 3, 2);
    }
    draw(g, st, now) {
      // 影
      const air = Math.max(0, this.ground - this.y);
      g.save(); g.globalAlpha *= Math.max(0.15, 0.5 - air / 200); g.fillStyle = '#000';
      const sw = this.s * (1 - Math.min(0.5, air / 160));
      g.fillRect(Math.round(this.x - sw / 2), Math.round(this.ground + this.s / 2 - 2), Math.round(sw), 3);
      g.restore();
      for (let i = this.trail.length - 1; i >= 1; i--) {
        const t = this.trail[i];
        g.save(); g.globalAlpha *= 0.2; g.translate(Math.round(t.x), Math.round(t.y)); g.rotate(t.rot);
        g.fillStyle = this.golden ? '#fbbf24' : '#ffffff'; g.fillRect(-this.s / 2, -this.s / 2, this.s, this.s); g.restore();
      }
      // つぶれ（sx・sy）は画面の縦横に対してかける。回転より先にかけないと、90度回ったときに向きが入れかわる
      g.translate(Math.round(this.x), Math.round(this.y)); g.scale(this.sx, this.sy); g.rotate(this.rot);
      const fill = this.golden ? '#fcd34d' : '#f8fafc', dark = this.golden ? '#b45309' : '#94a3b8';
      this.shape(g, this.s, fill, dark);
      const gap = Math.round(this.s * 0.27), p = Math.max(2, Math.round(this.s / 9));
      for (const [px, py] of PIPS[this.face] || PIPS[1]) {
        if (this.face === 1) { g.fillStyle = '#dc2626'; g.fillRect(-p - 1, -p - 1, p * 2 + 2, p * 2 + 2); }
        else { g.fillStyle = this.golden ? '#7c2d12' : '#1e293b'; g.fillRect(px * gap - p / 2 - 1, py * gap - p / 2 - 1, p, p); }
      }
    }
  }

  class Ring {
    constructor(x, y, color) { this.x = x; this.y = y; this.r = 4; this.alpha = 1; this.color = color || '#fff'; this.z = 3; }
    draw(g) { g.strokeStyle = this.color; g.lineWidth = 2; g.beginPath(); g.arc(Math.round(this.x), Math.round(this.y), this.r, 0, Math.PI * 2); g.stroke(); }
  }

  class Portrait {
    constructor(img, name) { this.img = img; this.name = name || ''; this.x = 248; this.y = 58; this.s = 58; this.z = 2; this.whiten = 0; this.sx = 1; this.sy = 1; this.rot = 0; }
    draw(g) {
      g.translate(Math.round(this.x), Math.round(this.y)); g.rotate(this.rot); g.scale(this.sx, this.sy);
      const s = this.s, h = s / 2;
      g.fillStyle = '#000'; g.fillRect(-h - 2, -h - 2, s + 4, s + 4);
      g.fillStyle = '#ef4444'; g.fillRect(-h - 1, -h - 1, s + 2, s + 2);
      g.fillStyle = '#1f2937'; g.fillRect(-h + 1, -h + 1, s - 2, s - 2);
      if (this.img) {
        const iw = this.img.naturalWidth, ih = this.img.naturalHeight, k = Math.max((s - 2) / iw, (s - 2) / ih);
        g.save(); g.beginPath(); g.rect(-h + 1, -h + 1, s - 2, s - 2); g.clip();
        g.drawImage(this.img, -iw * k / 2, -ih * k / 2 + (ih * k - s) * 0.25, iw * k, ih * k); g.restore();
      }
      if (this.whiten > 0) { g.globalAlpha *= this.whiten; g.fillStyle = '#fff'; g.fillRect(-h, -h, s, s); g.globalAlpha /= this.whiten; }
      outlinedText(g, this.name, 0, h + 9, 10, '#fecaca', '#000');
    }
  }

  class Beam {
    constructor(x1, y1, x2, y2, color) { this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; this.k = 0; this.w = 6; this.color = color || '#fde047'; this.z = 5; }
    draw(g) {
      const x = this.x1 + (this.x2 - this.x1) * this.k, y = this.y1 + (this.y2 - this.y1) * this.k;
      g.lineCap = 'square';
      g.strokeStyle = '#000'; g.lineWidth = this.w + 2; g.beginPath(); g.moveTo(this.x1, this.y1); g.lineTo(x, y); g.stroke();
      g.strokeStyle = this.color; g.lineWidth = this.w; g.beginPath(); g.moveTo(this.x1, this.y1); g.lineTo(x, y); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, this.w / 3); g.beginPath(); g.moveTo(this.x1, this.y1); g.lineTo(x, y); g.stroke();
    }
  }

  // ---------------- 演出の部品（雷・暗転・シルエット・サイン・叩きつける文字・宝箱・オーラ） ----------------
  class Bolt {    // 稲妻（ジグザグの線）
    constructor(x1, y1, x2, y2, color) {
      this.pts = []; this.z = 8; this.color = color || '#fde047';
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        this.pts.push([x1 + (x2 - x1) * k + (i && i < n ? (Math.random() - 0.5) * 22 : 0), y1 + (y2 - y1) * k]);
      }
    }
    draw(g) {
      g.lineJoin = 'miter';
      for (const [w, c] of [[5, '#000'], [3, this.color], [1, '#ffffff']]) {
        g.strokeStyle = c; g.lineWidth = w; g.beginPath();
        this.pts.forEach(([x, y], i) => (i ? g.lineTo(Math.round(x), Math.round(y)) : g.moveTo(Math.round(x), Math.round(y))));
        g.stroke();
      }
    }
  }
  // 光るのは times 回（最大2回）。前後の光と合わせて、1秒に3回をこえないように使う
  async function lightning(st, x, y, color, times) {
    Sound.play('thunder');
    for (let i = 0; i < Math.min(2, times || 2); i++) {
      const b = st.add(new Bolt(x + (Math.random() - 0.5) * 60, -4, x + (Math.random() - 0.5) * 16, y, color));
      st.flash('#ffffff', 0.45); st.shake(6);
      await st.wait(90);
      st.remove(b);
      await st.wait(110);   // 2回まで。1秒に3回以上は光らせない
    }
  }

  class Dim {     // 画面を暗くする
    constructor() { this.alpha = 0; this.z = 5; }
    draw(g) { g.fillStyle = '#05030f'; g.fillRect(0, 0, W, H); }
  }

  // シルエット：カードの絵を暗く、白黒をはっきりさせて紫に染める（カードの絵は四角いので、形が うっすら見える影にする）
  function silhouetteOf(img, w, h, rim) {
    const c = document.createElement('canvas'); c.width = w + 6; c.height = h + 6;
    const g = c.getContext('2d');
    g.fillStyle = rim; g.fillRect(0, 0, w + 6, h + 6);   // ふちの光
    g.fillStyle = '#05030f'; g.fillRect(3, 3, w, h);
    if (img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, s = Math.max(w / iw, h / ih);
      g.save(); g.beginPath(); g.rect(3, 3, w, h); g.clip();
      g.filter = 'grayscale(1) brightness(0.6) contrast(2.4)';
      g.drawImage(img, 3 + (w - iw * s) / 2, 3 + (h - ih * s) / 2, iw * s, ih * s);
      g.filter = 'none';
      g.globalCompositeOperation = 'multiply'; g.fillStyle = '#5b21b6'; g.fillRect(3, 3, w, h);
      g.restore();
    }
    return c;
  }
  class Sprite {
    constructor(canvas) { this.c = canvas; this.x = 160; this.y = 90; this.sx = 1; this.sy = 1; this.z = 6; }
    draw(g) { g.translate(Math.round(this.x), Math.round(this.y)); g.scale(this.sx, this.sy); g.drawImage(this.c, -this.c.width / 2, -this.c.height / 2); }
  }

  class TypeLine {   // セリフを1文字ずつ表示する帯
    constructor(text) { this.text = text; this.n = 0; this.z = 7; }
    draw(g) {
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, 140, W, 30);
      g.fillStyle = '#fbbf24'; g.fillRect(0, 140, W, 1); g.fillRect(0, 169, W, 1);
      outlinedText(g, Array.from(this.text).slice(0, Math.floor(this.n)).join(''), 160, 155, 12, '#ffffff', '#000');
    }
  }

  class Signature {  // カードの上に、名前をサインのように書き込む
    constructor(text) { this.text = text; this.k = 0; this.x = 160; this.y = 120; this.z = 7; }
    draw(g) {
      g.translate(Math.round(this.x), Math.round(this.y)); g.transform(1, 0, -0.35, 1, 0, 0); g.rotate(-0.12);
      g.font = `italic 900 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(this.text).width, left = -tw / 2 - 4;
      g.save(); g.beginPath(); g.rect(left, -14, (tw + 8) * this.k, 28); g.clip();
      g.lineWidth = 3; g.strokeStyle = '#1e1b4b'; g.strokeText(this.text, 0, 0);
      const grd = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
      grd.addColorStop(0, '#fde68a'); grd.addColorStop(0.5, '#ffffff'); grd.addColorStop(1, '#f9a8d4');
      g.fillStyle = grd; g.fillText(this.text, 0, 0);
      g.restore();
      if (this.k > 0 && this.k < 1) { g.fillStyle = '#ffffff'; const px = left + (tw + 8) * this.k; g.fillRect(px - 1, -6, 3, 3); g.fillRect(px, -9, 1, 9); }
    }
  }

  class Slam {   // ななめの帯に大きな文字を叩きつける
    constructor(main, sub, color) { this.main = main; this.sub = sub; this.color = color || '#dc2626'; this.x = 420; this.y = 74; this.sx = 1; this.z = 9; }
    draw(g) {
      g.translate(Math.round(this.x), this.y); g.rotate(-0.16); g.scale(this.sx, 1);
      g.fillStyle = '#000'; g.fillRect(-240, -22, 480, 44);
      g.fillStyle = this.color; g.fillRect(-240, -18, 480, 36);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = -12; i < 12; i++) g.fillRect(i * 20, -18, 6, 36);
      outlinedText(g, this.main, -6, -2, 26, '#ffffff', '#000');
      if (this.sub) outlinedText(g, this.sub, 96, 14, 11, '#fde047', '#000');
    }
  }
  async function slam(st, main, sub, color) {
    const s = st.add(new Slam(main, sub, color));
    s.sx = 1.5;
    Sound.play('slam');
    await st.tween(s, { x: 160, sx: 1 }, 120, E.outQuad);
    st.shake(6); st.hitstop(60);
    st.burst(160, 74, { n: 18, colors: ['#ffffff', '#fde047'], speed: 4, g: 0.05, life: 400 });
    await st.wait(620);
    await st.tween(s, { x: -260 }, 160, E.inQuad);
    st.remove(s);
  }

  class Aura {   // 強くなっている間、まわりに炎の粒をまとう
    constructor(target, w, h) { this.t = target; this.w = w; this.h = h; this.z = 0; this.acc = 0; this.on = true; }
    update(dt, st) {
      if (!this.on || REDUCED || st.particles.length > 260) return;
      this.acc += dt;
      while (this.acc > 28) {
        this.acc -= 28;
        const side = Math.random();
        const x = this.t.x + (side < 0.5 ? (Math.random() - 0.5) * this.w : (side < 0.75 ? -1 : 1) * this.w / 2);
        const y = this.t.y + this.h / 2 - Math.random() * this.h * (side < 0.5 ? 0.2 : 1);
        st.particles.push({ x, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.6 - Math.random() * 0.6, g: -0.02, drag: 0.98,
          life: 420 + Math.random() * 260, size: Math.random() < 0.4 ? 2 : 1, color: ['#f97316', '#fbbf24', '#ef4444', '#fde68a'][Math.floor(Math.random() * 4)] });
      }
    }
    draw() {}
  }

  class Chest {   // 宝箱
    constructor() { this.x = 160; this.y = -40; this.sx = 1; this.sy = 1; this.lid = 0; this.z = 4; this.shine = 0; }
    draw(g, st, now) {
      g.translate(Math.round(this.x), Math.round(this.y)); g.scale(this.sx, this.sy);
      // 影
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-30, 22, 60, 4);
      // 本体
      g.fillStyle = '#000'; g.fillRect(-29, -3, 58, 27);
      g.fillStyle = '#92400e'; g.fillRect(-28, -2, 56, 25);
      g.fillStyle = '#b45309'; g.fillRect(-28, -2, 56, 6);
      g.fillStyle = '#fbbf24'; g.fillRect(-28, 8, 56, 3); g.fillRect(-24, -2, 4, 25); g.fillRect(20, -2, 4, 25);
      g.fillStyle = '#fde68a'; g.fillRect(-4, 4, 8, 9); g.fillStyle = '#78350f'; g.fillRect(-1, 7, 2, 4);
      // ふた（開くと上に回る）
      g.save(); g.translate(0, -2); g.rotate(-this.lid * 1.9);
      g.fillStyle = '#000'; g.fillRect(-29, -17, 58, 16);
      g.fillStyle = '#b45309'; g.fillRect(-28, -16, 56, 14);
      g.fillStyle = '#d97706'; g.fillRect(-28, -16, 56, 4);
      g.fillStyle = '#fbbf24'; g.fillRect(-24, -16, 4, 14); g.fillRect(20, -16, 4, 14); g.fillRect(-28, -4, 56, 2);
      g.restore();
      if (this.shine) { g.globalAlpha *= this.shine; g.fillStyle = '#fef9c3'; g.fillRect(-26, -6, 52, 6); }
    }
  }

  // ---------------- よく使う動き ----------------
  async function pop(st, item, ms) {
    item.sx = 2.2; item.sy = 2.2; item.alpha = 1;
    await st.tween(item, { sx: 1, sy: 1 }, ms || 260, E.outBack);
  }
  async function popText(st, text, o) {
    o = o || {};
    const t = st.add(new Text(text, o.size || 30, o.color || '#ffffff', o.outline || '#000'));
    t.x = o.x === undefined ? 160 : o.x; t.y = o.y === undefined ? 40 : o.y;
    await pop(st, t, o.ms);
    if (o.hold) { await st.wait(o.hold); st.remove(t); }
    return t;
  }
  async function fadeOut(st, item, ms) { await st.tween(item, { alpha: 0 }, ms || 200, E.linear); st.remove(item); }
  function confetti(st, x, y) {
    st.burst(x, y, { n: 50, colors: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#ffffff'], speed: 4, up: 2.5, g: 0.1, drag: 0.98, life: 1400, size: 2 });
  }

  // ===============================================================
  // じゃんけん1回戦
  //   round = { round, p1:{ name, rarity, hand, imageUrl }, p2:{ … }, winner: 1（あなた）| -1（相手）| 0（引き分け） }
  // ===============================================================
  async function janken(host, round, opts) {
    opts = opts || {};
    const st = new Stage(host, { theme: 'arena' });
    try {
      const [im1, im2] = await Promise.all([loadImage(round.p1.imageUrl, round.p1.imageUrlFull), loadImage(round.p2.imageUrl, round.p2.imageUrlFull)]);
      // 第○回戦
      const banner = st.add(new Banner(`第${round.round || 1}回戦`));
      Sound.play('whoosh');
      await st.tween(banner, { x: 160 }, 320, E.outBack);
      await st.wait(260);
      st.tween(banner, { x: 520 }, 240, E.inBack).then(() => st.remove(banner));

      // カード登場
      const c1 = st.add(new Card(im1, round.p1.rarity)), c2 = st.add(new Card(im2, round.p2.rarity));
      c1.x = -40; c1.y = 104; c2.x = 360; c2.y = 104;
      const n1 = st.add(new Text(opts.youLabel || 'あなた', 10, '#93c5fd')); n1.follow = c1; n1.oy = 50;
      const n2 = st.add(new Text(opts.enemyLabel || '相手', 10, '#fca5a5')); n2.follow = c2; n2.oy = 50;
      Sound.play('whoosh');
      await Promise.all([st.tween(c1, { x: 84 }, 380, E.outBack), st.tween(c2, { x: 236 }, 380, E.outBack)]);
      st.dust(84, 144); st.dust(236, 144); st.shake(2); Sound.play('thud');

      // じゃん・けん（手をふる）
      const h1 = st.add(new Glyph('✊', 26)), h2 = st.add(new Glyph('✊', 26));
      h1.follow = c1; h1.oy = -58; h2.follow = c2; h2.oy = -58; h2.flip = true;
      for (const [word, snd] of [['じゃん', 'jan'], ['けん', 'ken']]) {
        Sound.play(snd);
        const t = st.add(new Text(word, 22, '#fde68a')); t.y = 30; pop(st, t, 200);
        await Promise.all([
          st.tween(h1, { oy: -50 }, 120, E.outQuad).then(() => st.tween(h1, { oy: -58 }, 160, E.outBack)),
          st.tween(h2, { oy: -50 }, 120, E.outQuad).then(() => st.tween(h2, { oy: -58 }, 160, E.outBack)),
          st.tween(c1, { sy: 0.9 }, 120).then(() => st.tween(c1, { sy: 1 }, 160, E.outBack)),
          st.tween(c2, { sy: 0.9 }, 120).then(() => st.tween(c2, { sy: 1 }, 160, E.outBack))
        ]);
        st.remove(t);
      }

      // ぽん！
      h1.ch = HAND[round.p1.hand] || '✊'; h2.ch = HAND[round.p2.hand] || '✊';
      Sound.play('pon');
      st.speedLines(420, 160, 50); st.flash('#ffffff', 0.35); st.shake(3);
      const pon = st.add(new Text('ぽん！', 30, '#ffffff', '#7c3aed')); pon.y = 30;
      await Promise.all([pop(st, h1, 220), pop(st, h2, 220), pop(st, pon, 220)]);
      await st.wait(380);
      st.remove(pon);

      const sameHand = round.p1.hand === round.p2.hand;
      const winner = Number(round.winner) || 0;
      if (sameHand) {
        // あいこ → レアリティ勝負
        Sound.play('draw');
        await popText(st, 'あいこ！', { size: 26, color: '#e2e8f0', hold: 380 });
        await popText(st, 'レアリティ勝負！', { size: 20, color: '#fde68a', outline: '#9a3412', hold: 300 });
        const r1 = st.add(new Text(String(round.p1.rarity), 14, rarityOf(round.p1.rarity).c)); r1.follow = c1; r1.oy = -30;
        const r2 = st.add(new Text(String(round.p2.rarity), 14, rarityOf(round.p2.rarity).c)); r2.follow = c2; r2.oy = -30;
        h1.hidden = true; h2.hidden = true;
        Sound.play('tick'); await Promise.all([pop(st, r1), pop(st, r2)]);
        await st.wait(300);
        if (winner === 0) {
          await clash(st, c1, c2, true);
          await popText(st, 'ひきわけ', { size: 28, color: '#e2e8f0', y: 44 });
          Sound.play('draw');
          await st.wait(900);
          return winner;
        }
        (winner === 1 ? c1 : c2).glow = 1;
        await st.wait(250);
      }
      await clash(st, c1, c2, winner === 0);
      if (winner === 1) {
        st.tween(c2, { x: 330, y: 70, rot: 1.2 }, 420, E.outCubic).then(() => st.tween(c2, { y: 200, rot: 2.4 }, 380, E.inQuad));
        st.tween(c1, { x: 128 }, 300, E.outBack);
        c1.glow = 1;
        // 有利な手で勝った →「こうかばつぐん！」、あいこからレアリティで勝った →「レアリティの差！」
        await slam(st, sameHand ? 'レアリティの差！' : 'こうかばつぐん！', sameHand ? 'CRITICAL!' : 'WEAK!', sameHand ? '#7c3aed' : '#dc2626');
        Sound.play('win'); confetti(st, 128, 60);
        await popText(st, opts.winText || 'WIN!', { size: 40, color: '#fde047', outline: '#9a3412', y: 44 });
      } else if (winner === -1) {
        st.tween(c1, { x: -10, y: 70, rot: -1.2 }, 420, E.outCubic).then(() => st.tween(c1, { y: 200, rot: -2.4 }, 380, E.inQuad));
        st.tween(c2, { x: 192 }, 300, E.outBack);
        c2.glow = 1;
        Sound.play('lose');
        const t = await popText(st, opts.loseText || 'LOSE…', { size: 34, color: '#93c5fd', outline: '#1e3a8a', y: 44 });
        st.tween(t, { y: 52, rot: 0.08 }, 700, E.outQuad);
      } else {
        Sound.play('draw');
        await popText(st, 'ひきわけ', { size: 28, color: '#e2e8f0', y: 44 });
      }
      await st.wait(950);
      return winner;
    } finally {
      if (!opts.keep) st.destroy();
    }
  }

  // ため → 一気にぶつかる → 一瞬止まる → はね返る
  async function clash(st, c1, c2, bounceBoth) {
    await Promise.all([st.tween(c1, { x: c1.x - 22, sx: 0.9 }, 140, E.outQuad), st.tween(c2, { x: c2.x + 22, sx: 0.9 }, 140, E.outQuad)]);
    c1.trailOn = c2.trailOn = true;
    Sound.play('whoosh');
    await Promise.all([st.tween(c1, { x: 131, sx: 1.25, sy: 0.85 }, 130, E.inQuad), st.tween(c2, { x: 189, sx: 1.25, sy: 0.85 }, 130, E.inQuad)]);
    c1.trailOn = c2.trailOn = false;
    st.impact(); st.hitstop(110); st.shake(7); st.speedLines(300, 160, 104);
    st.burst(160, 104, { n: 40, colors: ['#ffffff', '#fde68a', '#fb923c'], speed: 5, g: 0.05, life: 500 });
    const ring = st.add(new Ring(160, 104, '#ffffff'));
    st.tween(ring, { r: 60, alpha: 0 }, 400, E.outCubic).then(() => st.remove(ring));
    Sound.play('clash');
    await st.wait(40);
    if (bounceBoth) {
      await Promise.all([st.tween(c1, { x: 84, sx: 1, sy: 1 }, 380, E.outBack), st.tween(c2, { x: 236, sx: 1, sy: 1 }, 380, E.outBack)]);
    } else {
      c1.sx = c1.sy = c2.sx = c2.sy = 1;
    }
  }

  // ===============================================================
  // すごろくのサイコロ
  //   opts.value  … 出目（数字）か、出目を返す Promise（サーバーの返事を待つ間も転がり続ける）
  //                 2個のときは [出目1, 出目2] でもよい（合計を進む）
  //   opts.count  … サイコロの数（1 か 2。ダブルダイスは 2）
  //   opts.golden … 確定6ダイスなら true（金色）
  //   opts.bonus  … 出目に足す数（アイテム・レリック）。表示だけ
  // ===============================================================
  async function dice(host, opts) {
    opts = opts || {};
    const st = new Stage(host, { theme: 'board' });
    const n = opts.count === 2 ? 2 : 1;
    let value, faces;
    let settled = false, failed = null;
    Promise.resolve(opts.value).then((v) => {
      faces = (Array.isArray(v) ? v : [v]).map(Number);
      value = faces.reduce((a, b) => a + b, 0);
      settled = true;
    }, (e) => { failed = e || new Error('roll failed'); settled = true; });
    try {
      const dies = [];
      for (let k = 0; k < n; k++) {
        const d = st.add(new Die(opts.golden, 36));
        if (opts.bonus) st.add(new Aura(d, 40, 40));   // 出目が上がっているときは炎のオーラ
        d.ground = 132; d.x = 30 - k * 26; d.y = d.ground; d.rolling = true;
        dies.push(d);
      }
      const all = (f) => Promise.all(dies.map(f));
      const endX = n === 2 ? [126, 194] : [160];
      Sound.play('whoosh');
      // 投げる（放物線）
      dies.forEach((d, k) => st.tween(d, { x: 130 - k * 26 + (n === 2 ? 20 : 0), rot: d.rot + 9 + k }, 520, E.linear));
      await all((d) => st.tween(d, { y: 40 }, 260, E.outQuad));
      await all((d) => st.tween(d, { y: d.ground }, 260, E.inQuad));
      dies.forEach((d) => st.dust(d.x, d.ground + 14)); Sound.play('tick'); st.shake(2);
      // 返事が来るまで、その場で小さくはね続ける（最大10秒）
      let hops = 0;
      while (!settled && hops < 30) {
        hops++;
        dies.forEach((d) => st.tween(d, { rot: d.rot + 3 }, 300, E.linear));
        await all((d) => st.tween(d, { y: d.ground - 26 }, 150, E.outQuad));
        await all((d) => st.tween(d, { y: d.ground }, 150, E.inQuad));
        dies.forEach((d) => st.dust(d.x, d.ground + 14)); Sound.play('tick');
      }
      if (!settled || failed) {
        dies.forEach((d) => { d.rolling = false; });
        await popText(st, '…', { size: 30, color: '#e2e8f0', y: 60, hold: 500 });
        throw failed || new Error('timeout');
      }
      // 最後の2回のバウンドで中央へ
      for (const [hy, ms, step] of [[46, 220, 0], [18, 150, 1]]) {
        dies.forEach((d, k) => st.tween(d, { x: step ? endX[k] : (endX[k] - 10), rot: d.rot + 2.5 }, ms * 2, E.linear));
        await all((d) => st.tween(d, { y: d.ground - hy }, ms, E.outQuad));
        await all((d) => st.tween(d, { y: d.ground }, ms, E.inQuad));
        dies.forEach((d) => st.dust(d.x, d.ground + 14)); Sound.play('tick');
      }
      // 着地：目を決めて、つぶれて戻る
      const big = n === 2 ? faces[0] === faces[1] : value === 6;   // 6 か、2個のときはゾロ目
      dies.forEach((d, k) => {
        d.rolling = false; d.face = Math.min(6, Math.max(1, faces[k] || 1));
        d.rot = Math.round(d.rot / (Math.PI / 2)) * (Math.PI / 2);
        d.sx = 1.3; d.sy = 0.7;
        const ring = st.add(new Ring(d.x, d.y, big ? '#fde047' : '#ffffff'));
        st.tween(ring, { r: 70, alpha: 0 }, 500, E.outCubic).then(() => st.remove(ring));
      });
      st.hitstop(80); st.shake(big ? 6 : 3); st.flash(big ? '#fde047' : '#ffffff', 0.3);
      Sound.play(big ? 'six' : 'land');
      await all((d) => st.tween(d, { sx: 1, sy: 1 }, 300, E.outElastic));
      dies.forEach((d) => st.tween(d, { y: d.ground - 4 }, 200, E.outQuad));
      if (n === 2) {
        if (big) { st.speedLines(600, 160, 60); confetti(st, 160, 70); }
        await popText(st, `${faces[0]} + ${faces[1]} = ${value}` + (big ? '！' : ''), { size: 32, color: big ? '#fde047' : '#ffffff', outline: big ? '#9a3412' : '#4c1d95', y: 58 });
      } else if (value === 6) {
        st.speedLines(600, 160, 60); confetti(st, 160, 70);
        await popText(st, '6！！', { size: 44, color: '#fde047', outline: '#9a3412', y: 58 });
      } else {
        await popText(st, String(value), { size: 44, color: '#ffffff', outline: '#4c1d95', y: 58 });
      }
      if (opts.bonus) {
        await st.wait(220);
        Sound.play('tick');
        await popText(st, `+${opts.bonus}`, { size: 22, color: '#86efac', outline: '#14532d', x: 214 + (n === 2 ? 40 : 0), y: 58 });
        await st.wait(200);
        await popText(st, `${value + opts.bonus}マス すすむ！`, { size: 18, color: '#ffffff', outline: '#000', y: 100 });
      } else {
        await popText(st, `${value}マス すすむ！`, { size: 18, color: '#ffffff', outline: '#000', y: 100 });
      }
      await st.wait(750);
      return value;
    } finally {
      if (!opts.keep) st.destroy();
    }
  }

  // ===============================================================
  // 偉人（ボス）とのサイコロ勝負
  //   o.player = { value, bonus }        … value は補正前、bonus は能力・レリックの合計
  //   o.boss   = { value, bonus, name, imageUrl }
  //   o.result = 1（あなたの勝ち）| -1（ボスの勝ち）| 0（互角）
  //   o.damage = ダメージ量、o.critical = 会心なら true
  // ===============================================================
  async function diceDuel(host, o) {
    o = o || {};
    const st = new Stage(host, { theme: 'arena' });
    try {
      const bossImg = await loadImage(o.boss && o.boss.imageUrl, o.boss && o.boss.imageUrlFull);
      const boss = st.add(new Portrait(bossImg, o.boss && o.boss.name));
      boss.x = 360; boss.y = 44;
      const you = st.add(new Text(o.youLabel || 'あなた', 14, '#93c5fd')); you.x = 72; you.y = 30;
      Sound.play('whoosh');
      await st.tween(boss, { x: 248 }, 400, E.outBack);
      st.shake(3); Sound.play('thud');
      await popText(st, 'サイコロ勝負！', { size: 20, color: '#fde68a', outline: '#7c2d12', y: 96, hold: 450 });

      const d1 = st.add(new Die(false, 26)), d2 = st.add(new Die(false, 26));
      // 能力やレリックで出目が上がっているときは、自分のサイコロに炎のオーラ
      if (o.player && Number(o.player.bonus) > 0) st.add(new Aura(d1, 30, 30));
      d1.ground = d2.ground = 140; d1.x = 20; d2.x = 300; d1.y = d2.y = 140; d1.rolling = d2.rolling = true;
      Sound.play('whoosh');
      const throwDie = async (d, x) => {
        st.tween(d, { x, rot: d.rot + 10 }, 560, E.linear);
        await st.tween(d, { y: 60 }, 280, E.outQuad); await st.tween(d, { y: d.ground }, 280, E.inQuad);
        st.dust(d.x, d.ground + 13); Sound.play('tick');
        await st.tween(d, { y: d.ground - 20 }, 140, E.outQuad); await st.tween(d, { y: d.ground }, 140, E.inQuad);
        st.dust(d.x, d.ground + 13);
      };
      await Promise.all([throwDie(d1, 92), throwDie(d2, 228)]);

      const land = async (d, v, bonus, x, color) => {
        d.rolling = false; d.face = Math.min(6, Math.max(1, v)); d.rot = 0; d.sx = 1.3; d.sy = 0.7;
        st.hitstop(60); st.shake(3); Sound.play('land');
        await st.tween(d, { sx: 1, sy: 1 }, 260, E.outElastic);
        const t = await popText(st, String(v + (bonus || 0)), { size: 30, color, outline: '#000', x, y: 104 });
        if (bonus) { const b = st.add(new Text(bonus > 0 ? `(+${bonus})` : `(−${-bonus})`, 10, bonus > 0 ? '#86efac' : '#fca5a5')); b.x = x; b.y = 120; await pop(st, b, 200); }   // 時の砂時計などで下がったときは −
        return t;
      };
      const p = o.player || {}, b = o.boss || {};
      await land(d1, Number(p.value) || 1, Number(p.bonus) || 0, 92, '#93c5fd');
      await st.wait(350);   // ボスの目は少しためてから
      await land(d2, Number(b.value) || 1, Number(b.bonus) || 0, 228, '#fca5a5');
      await st.wait(300);

      const res = Number(o.result) || 0;
      if (res === 1) {
        const beam = st.add(new Beam(d1.x, d1.y, boss.x, boss.y, '#fde047'));
        Sound.play('beam');
        await st.tween(beam, { k: 1 }, 200, E.inQuad);
        st.impact(); st.hitstop(120); st.shake(8); Sound.play('hit');
        st.burst(boss.x, boss.y, { n: 40, colors: ['#ffffff', '#fde047', '#f97316'], speed: 4.5 });
        boss.whiten = 1; st.tween(boss, { whiten: 0 }, 400, E.linear);
        st.tween(boss, { rot: 0.15 }, 80, E.outQuad).then(() => st.tween(boss, { rot: 0 }, 400, E.outElastic));
        fadeOut(st, beam, 250);
        await damageNumber(st, boss.x, boss.y + 6, o.damage);
        if (o.critical) await slam(st, 'CRITICAL!', '会心の一撃！', '#ea580c');
        else if (o.damage >= 40) await slam(st, 'こうかばつぐん！', 'WEAK!', '#dc2626');
      } else if (res === -1) {
        const beam = st.add(new Beam(d2.x, d2.y, 72, 50, '#f87171'));
        Sound.play('beam');
        await st.tween(beam, { k: 1 }, 200, E.inQuad);
        st.hitstop(100); st.shake(7); st.flash('#ef4444', 0.35); Sound.play('hit');
        st.burst(72, 50, { n: 30, colors: ['#fecaca', '#ef4444', '#ffffff'], speed: 4 });
        fadeOut(st, beam, 250);
        await damageNumber(st, 72, 56, o.damage);
      } else {
        await Promise.all([st.tween(d1, { x: 148 }, 160, E.inQuad), st.tween(d2, { x: 172 }, 160, E.inQuad)]);
        st.impact(); st.hitstop(90); st.shake(5); Sound.play('clash');
        st.burst(160, 140, { n: 30, speed: 4 });
        await Promise.all([st.tween(d1, { x: 92 }, 300, E.outBack), st.tween(d2, { x: 228 }, 300, E.outBack)]);
        await popText(st, '互角！', { size: 30, color: '#e2e8f0', y: 96 });
      }
      await st.wait(900);
      return res;
    } finally {
      if (!o.keep) st.destroy();
    }
  }

  // ===============================================================
  // ガチャ開封
  //   o.results  … [{ id, name, rarity, imageUrl, imageUrlFull, isNew }]（サーバーの抽選結果をそのまま見せる）
  //   o.packName … パックに書く名前（例：キラキラレアガチャ）
  //   o.packColor… パックの色（例：'#a855f7'）
  //   パックをタップでやぶる → 光（いちばん高いレアリティの色）→ 1枚ずつタップでめくる → 一覧 → タップで閉じる
  //   タップしなくても、少し待てば自動で進む
  // ===============================================================
  const TIER_COLOR = ['#e2e8f0', '#60a5fa', '#c084fc', '#fbbf24', '#f43f5e'];
  const tierOf = (rarity) => { const r = rarityOf(rarity).r; return r >= 10 ? 4 : r >= 7 ? 3 : r >= 5 ? 2 : r >= 3 ? 1 : 0; };

  function shade(hex, k) {   // k > 0 で明るく、k < 0 で暗く
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
    const n = parseInt(m[1], 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  function crimp(g, w, y, dir, color) {   // パックのギザギザのふち
    g.fillStyle = color;
    for (let x = -w / 2; x < w / 2; x += 4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y + 3 * dir); g.lineTo(x + 4, y); g.fill(); }
  }

  class Pack {
    constructor(color, name) {
      this.color = color || '#3b82f6'; this.name = name || 'ガチャ';
      this.x = 160; this.y = 92; this.w = 84; this.h = 116; this.sx = 1; this.sy = 1; this.rot = 0; this.z = 3;
      this.cut = false; this.glow = 0; this.glowColor = '#ffffff'; this.rainbow = false; this.bob = true;
    }
    draw(g, st, now) {
      const bob = this.bob ? Math.round(Math.sin(now / 400) * 2) : 0;
      g.translate(Math.round(this.x), Math.round(this.y) + bob); g.rotate(this.rot); g.scale(this.sx, this.sy);
      const w = this.w, h = this.h, top = this.cut ? -h / 2 + 12 : -h / 2;
      if (this.glow) {
        const p = (0.45 + 0.3 * Math.sin(now / 150)) * this.glow;
        g.save(); g.globalAlpha *= p;
        g.fillStyle = this.rainbow ? `hsl(${Math.floor(now / 5) % 360}, 90%, 60%)` : this.glowColor;
        g.fillRect(-w / 2 - 6, top - 6, w + 12, h / 2 - top + 12); g.restore();
      }
      g.fillStyle = '#000'; g.fillRect(-w / 2 - 1, top - 1, w + 2, h / 2 - top + 2);
      const grd = g.createLinearGradient(0, -h / 2, 0, h / 2);
      grd.addColorStop(0, shade(this.color, 0.35)); grd.addColorStop(0.5, this.color); grd.addColorStop(1, shade(this.color, -0.45));
      g.fillStyle = grd; g.fillRect(-w / 2, top, w, h / 2 - top);
      if (!this.cut) crimp(g, w, -h / 2, -1, shade(this.color, 0.35));
      crimp(g, w, h / 2, 1, shade(this.color, -0.45));
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 22 - 6, top); g.lineTo(i * 22 + 4, top); g.lineTo(i * 22 + 4 - 30, h / 2); g.lineTo(i * 22 - 6 - 30, h / 2); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(-w / 2, -20, w, 40);
      outlinedText(g, '漢字の刃', 0, -7, 15, '#ffffff', '#000');
      outlinedText(g, this.name, 0, 10, 8, '#fde68a', '#000');
      // 光が流れる
      const t = (now % 2200) / 2200, x = -w + t * w * 2.4;
      g.save(); g.beginPath(); g.rect(-w / 2, top, w, h / 2 - top); g.clip(); g.globalCompositeOperation = 'lighter';
      const s = g.createLinearGradient(x - 16, -h / 2, x + 16, h / 2);
      s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.35)'); s.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = s; g.fillRect(-w / 2, -h / 2, w, h); g.restore();
    }
  }

  class Strip {   // やぶれて飛んでいくパックの上の部分
    constructor(color, w) { this.color = color; this.w = w; this.x = 0; this.y = 0; this.rot = 0; this.z = 4; }
    draw(g) {
      g.translate(Math.round(this.x), Math.round(this.y)); g.rotate(this.rot);
      g.fillStyle = '#000'; g.fillRect(-this.w / 2 - 1, -7, this.w + 2, 14);
      g.fillStyle = shade(this.color, 0.35); g.fillRect(-this.w / 2, -6, this.w, 12);
      crimp(g, this.w, -6, -1, shade(this.color, 0.35));
    }
  }

  class Rays {    // 開け口からあふれる光
    constructor(x, y, color, rainbow) { this.x = x; this.y = y; this.color = color; this.rainbow = rainbow; this.len = 0; this.rot = 0; this.z = 1; }
    draw(g, st, now) {
      g.translate(Math.round(this.x), Math.round(this.y)); g.rotate(this.rot + now / 1500);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        g.fillStyle = this.rainbow ? `hsla(${(i * 26 + now / 8) % 360}, 90%, 65%, 0.55)` : this.color;
        if (!this.rainbow) g.globalAlpha *= 0.5;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.09) * this.len, Math.sin(a - 0.09) * this.len); g.lineTo(Math.cos(a + 0.09) * this.len, Math.sin(a + 0.09) * this.len); g.fill();
        if (!this.rainbow) g.globalAlpha /= 0.5;
      }
    }
  }

  function shortLabel(s, n) { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); }

  // 最高レアの登場前：暗転 → シルエットが浮かび上がる → セリフが1文字ずつ → 白く光って登場
  //   セリフはスプレッドシート（Characters の「セリフ」列）にあればそれを使い、なければ決まった文
  async function silhouetteIntro(st, img, c) {
    const dim = st.add(new Dim());
    await st.tween(dim, { alpha: 0.85 }, 300, E.linear);
    Sound.play('rumble');
    const sil = st.add(new Sprite(silhouetteOf(img, 92, 126, '#fbbf24')));
    sil.y = 76; sil.sx = sil.sy = 0.6; sil.alpha = 0;
    await st.tween(sil, { alpha: 1, sx: 1, sy: 1 }, 500, E.outCubic);
    const text = c.line ? `「${shortLabel(c.line, 22)}」` : `「${shortLabel(c.name, 12)}、ここに参上！」`;
    const line = st.add(new TypeLine(text));
    const total = Array.from(text).length;
    for (let i = 1; i <= total; i++) { line.n = i; if (i % 2) Sound.play('line'); await st.wait(55); }
    await st.waitTap(1800);
    st.flash('#ffffff', 0.6);
    [dim, sil, line].forEach((it) => st.remove(it));
  }

  async function gachaOpen(host, o) {
    o = o || {};
    const cards = (o.results || []).filter((c) => c && !c.miss);
    const st = new Stage(host, { theme: 'arena' });
    try {
      if (!cards.length) return;
      const imagesReady = Promise.all(cards.map((c) => loadImage(c.imageUrl, c.imageUrlFull)));
      const bestTier = Math.max.apply(null, cards.map((c) => tierOf(c.rarity)));

      // 1. パック登場（いちばん高いレアリティほど、強く光る）
      const pack = st.add(new Pack(o.packColor, o.packName));
      pack.y = 240;
      // 昇格演出：高レアが入っていても、ときどき最初は青く光らせ、やぶる直前に雷で本当の色に変える（見せ方だけ。中身は最初から決まっている）
      const promote = bestTier >= 3 && Math.random() < 0.6;
      const shownTier = promote ? 1 : bestTier;
      pack.glow = shownTier >= 2 ? 1 : 0.5; pack.glowColor = TIER_COLOR[shownTier]; pack.rainbow = shownTier >= 4;
      Sound.play('whoosh');
      await st.tween(pack, { y: 88 }, 520, E.outBack);
      const hint = st.add(new Text('タップしてパックをやぶろう！', 11, '#fde68a'));
      hint.y = 166; hint.update = function (dt, s) { this.alpha = 0.55 + 0.45 * Math.sin(performance.now() / 260); };
      await st.waitTap(7000);
      st.remove(hint);

      // 2. ため → やぶる
      pack.bob = false;
      if (shownTier >= 3) Sound.play('rumble');
      for (let i = 0; i < (shownTier >= 3 ? 4 : 2); i++) {
        await st.tween(pack, { rot: 0.07 }, 60, E.outQuad);
        await st.tween(pack, { rot: -0.07 }, 90, E.outQuad);
        if (shownTier >= 3) st.shake(2);
      }
      await st.tween(pack, { rot: 0 }, 60, E.outQuad);
      if (promote) {
        await lightning(st, pack.x, pack.y - pack.h / 2);
        pack.glow = 1; pack.glowColor = TIER_COLOR[bestTier]; pack.rainbow = bestTier >= 4;
        await popText(st, bestTier >= 4 ? '虹色に変わった！？' : '金色に変わった！？', { size: 14, color: TIER_COLOR[bestTier], y: 20, hold: 450 });
      }
      const strip = st.add(new Strip(pack.color, pack.w));
      strip.x = pack.x; strip.y = pack.y - pack.h / 2 + 6;
      pack.cut = true;
      Sound.play('tear');
      st.tween(strip, { x: strip.x + 90, y: strip.y - 70, rot: 1.4, alpha: 0 }, 520, E.outCubic).then(() => st.remove(strip));
      const rays = st.add(new Rays(pack.x, pack.y - pack.h / 2 + 12, TIER_COLOR[bestTier], bestTier >= 4));
      st.tween(rays, { len: 220 }, 400, E.outCubic);
      st.flash(TIER_COLOR[bestTier], 0.4); st.shake(bestTier >= 3 ? 6 : 3);
      st.burst(pack.x, pack.y - pack.h / 2 + 12, { n: 24 + bestTier * 10, colors: [TIER_COLOR[bestTier], '#ffffff'], speed: 3.5, up: 1.5, life: 900 });
      if (bestTier >= 3) st.speedLines(600, pack.x, pack.y - 40);
      if (bestTier >= 4) confetti(st, 160, 40);
      await st.wait(650);
      await imagesReady;
      st.tween(pack, { y: 260 }, 400, E.inQuad).then(() => st.remove(pack));
      await st.tween(rays, { alpha: 0 }, 400, E.linear);
      st.remove(rays);

      // 3. 1枚ずつめくる（高いレアリティのカードを最大10枚、低い順に。いちばん高いカードが最後）
      const byScore = cards.map((c, i) => ({ c, i })).sort((a, b) => (rarityOf(b.c.rarity).r - rarityOf(a.c.rarity).r) || (a.i - b.i)).map((x) => x.c);
      const top = byScore.slice(0, 10);
      const order = top.slice().reverse();
      for (let i = 0; i < order.length; i++) {
        const c = order[i], tier = tierOf(c.rarity);
        const img = await loadImage(c.imageUrl, c.imageUrlFull);
        const card = st.add(new Card(img, c.rarity));
        card.w = 74; card.h = 102; card.back = true; card.x = 160; card.y = 240;
        const count = st.add(new Text(`${i + 1} / ${order.length}`, 9, '#cbd5e1')); count.x = 22; count.y = 10;
        Sound.play('flip');
        await st.tween(card, { y: 86 }, 260, E.outBack);
        if (tier >= 3) {   // 高レア：めくる前に青く光ってふるえる → 雷で本当の色に（昇格）
          card.glow = 1; card.glowColor = TIER_COLOR[1];
          for (let k = 0; k < 3; k++) { Sound.play('tick'); await st.tween(card, { rot: 0.06 }, 70); await st.tween(card, { rot: -0.06 }, 70); }
          card.rot = 0;
          await lightning(st, card.x, card.y - card.h / 2, null, 1);
          card.glowColor = tier >= 4 ? '#f9a8d4' : TIER_COLOR[tier];
          await st.wait(400);
        }
        if (tier >= 4) await silhouetteIntro(st, img, c);   // 最高レア：暗転 → シルエットとセリフ
        await st.tween(card, { sx: 0 }, 110, E.inQuad);
        card.back = false; card.glow = 0;
        card.holo = tier >= 3 ? 1 : 0; card.rainbow = tier >= 4 ? 1 : 0;
        Sound.play(tier >= 4 ? 'legend' : tier >= 3 ? 'reveal3' : tier >= 1 ? 'reveal2' : 'reveal1');
        await st.tween(card, { sx: 1 }, 180, E.outBack);
        const rlabel = st.add(new Text(String(c.rarity), tier >= 3 ? 18 : 14, TIER_COLOR[tier], '#000')); rlabel.y = 22;
        const name = st.add(new Text(shortLabel(c.name, 14), 10, '#ffffff')); name.y = 150;
        pop(st, rlabel, 220);
        if (tier >= 2) st.burst(160, 86, { n: 14 + tier * 8, colors: [TIER_COLOR[tier], '#ffffff'], speed: 3, life: 700 });
        if (tier >= 3) { st.flash(TIER_COLOR[tier], 0.3); st.speedLines(500, 160, 86); st.shake(4); }
        if (tier >= 4) confetti(st, 160, 50);
        let badge = null;
        if (c.isNew) { badge = st.add(new Text('NEW!', 11, '#ffffff', '#dc2626')); badge.x = 196; badge.y = 40; badge.rot = 0.25; pop(st, badge, 240); }
        let sign = null;
        if (tier >= 4) {   // 最高レア：サインがシュピーンと書き込まれる
          sign = st.add(new Signature(shortLabel(c.name, 10)));
          sign.y = card.y + 30;
          await st.wait(250);
          Sound.play('sign');
          await st.tween(sign, { k: 1 }, 650, E.outQuad);
          st.burst(sign.x + 30, sign.y - 4, { n: 10, colors: ['#ffffff', '#fde68a'], speed: 2, life: 500, shape: 'star', size: 2 });
        }
        await st.waitTap(tier >= 3 ? 3500 : 1500);
        if (sign) { sign.follow = card; sign.oy = 30; }
        await st.tween(card, { x: -60, rot: -0.4 }, 160, E.inQuad);
        [card, count, rlabel, name, badge, sign].forEach((it) => it && st.remove(it));
      }

      // 4. 一覧（高い順に最大10枚）
      const title = st.add(new Text('ゲットしたカード', 14, '#fde68a')); title.y = 13; pop(st, title, 200);
      const small = await Promise.all(top.map((c) => loadImage(c.imageUrl, c.imageUrlFull)));
      top.forEach((c, i) => {
        const col = i % 5, row = Math.floor(i / 5), rows = Math.ceil(top.length / 5);
        const m = st.add(new Card(small[i], c.rarity));
        m.w = 40; m.h = 55; m.x = 160 + (col - (Math.min(top.length, 5) - 1) / 2) * 50; m.y = (rows === 1 ? 90 : 60 + row * 64);
        m.holo = tierOf(c.rarity) >= 3 ? 1 : 0; m.rainbow = tierOf(c.rarity) >= 4 ? 1 : 0;
        m.sx = m.sy = 0; st.tween(m, { sx: 1, sy: 1 }, 220 + i * 40, E.outBack);
        if (c.isNew) { const b = st.add(new Text('NEW', 7, '#ffffff', '#dc2626')); b.x = m.x + 14; b.y = m.y - 26; }
      });
      if (cards.length > top.length) { const more = st.add(new Text(`ほか ${cards.length - top.length} 枚`, 10, '#cbd5e1')); more.y = 158; }
      const close = st.add(new Text('タップでとじる', 10, '#94a3b8')); close.y = 172;
      Sound.play('reveal2');
      await st.waitTap(9000);
    } finally {
      if (!o.keep) st.destroy();
    }
  }

  // ===============================================================
  // 宝箱（すごろくの良いマス、アイテムを手に入れたとき）
  //   o.title … 上に出す文（例：【平安】良い出来事！）
  //   o.icon  … 中から出てくるもの（絵文字。例：'❤️'）
  //   o.label … 下に出す文（例：HPが 15 回復！）
  //   落ちてくる → タップで開ける → 光とともに中身が飛び出す（タップしなくても自動で進む）
  // ===============================================================
  async function treasure(host, o) {
    o = o || {};
    const st = new Stage(host, { theme: 'board' });
    try {
      if (o.title) { const t = st.add(new Text(shortLabel(o.title, 20), 13, '#fde68a')); t.y = 16; pop(st, t, 220); }
      const chest = st.add(new Chest());
      Sound.play('whoosh');
      await st.tween(chest, { y: 110 }, 420, E.inQuad);
      chest.sx = 1.25; chest.sy = 0.8;
      st.dust(chest.x - 20, 134); st.dust(chest.x + 20, 134); st.shake(3); Sound.play('chest');
      await st.tween(chest, { sx: 1, sy: 1 }, 260, E.outElastic);
      const hint = st.add(new Text('タップしてあけよう！', 11, '#ffffff'));
      hint.y = 160; hint.update = function () { this.alpha = 0.55 + 0.45 * Math.sin(performance.now() / 260); };
      await st.waitTap(5000);
      st.remove(hint);
      for (let i = 0; i < 2; i++) { await st.tween(chest, { sx: 1.08, sy: 0.92 }, 70); await st.tween(chest, { sx: 0.95, sy: 1.05 }, 70); }
      chest.sx = chest.sy = 1;
      Sound.play('open');
      const rays = st.add(new Rays(chest.x, chest.y - 4, '#fde68a', false));
      st.tween(rays, { len: 200 }, 360, E.outCubic);
      st.tween(chest, { lid: 1, shine: 1 }, 260, E.outBack);
      st.flash('#fef9c3', 0.35); st.shake(3);
      st.burst(chest.x, chest.y - 6, { n: 30, colors: ['#fde68a', '#ffffff', '#fbbf24'], speed: 3.2, up: 2, life: 800 });
      const item = st.add(new Glyph(o.icon || '🎁', 26));
      item.x = chest.x; item.y = chest.y - 6; item.sx = item.sy = 0.3; item.z = 6;
      await st.tween(item, { y: 54, sx: 1.3, sy: 1.3 }, 420, E.outBack);
      st.burst(item.x, item.y, { n: 12, colors: ['#ffffff', '#fde68a'], speed: 2, life: 600, shape: 'star', size: 2 });
      if (o.label) await popText(st, shortLabel(o.label, 18), { size: 15, color: '#ffffff', outline: '#7c2d12', y: 154 });
      await st.waitTap(3000);
    } finally {
      if (!o.keep) st.destroy();
    }
  }

  // ===============================================================
  // タップの粒：画面のどこをタップしても、小さな星がふわっと散る
  //   画面全体に透明なキャンバスを重ねる（タップの邪魔はしない）。粒があるときだけ描くので、ふだんは負荷ゼロ
  // ===============================================================
  let tapLayer = null;
  function enableTapSparkles() {
    if (tapLayer || !document.body) return;
    const c = document.createElement('canvas');
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '30000' });
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const g = c.getContext('2d');
    const parts = [];
    let running = false, last = 0;
    const fit = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    fit();
    window.addEventListener('resize', fit);
    const colors = ['#fde68a', '#f9a8d4', '#a5f3fc', '#c4b5fd', '#ffffff'];
    function tick(now) {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      g.clearRect(0, 0, c.width, c.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        const s = dt / 16;
        p.vy += 0.05 * s; p.x += p.vx * s; p.y += p.vy * s;
        g.globalAlpha = Math.min(1, p.life / 250); g.fillStyle = p.color;
        const x = Math.round(p.x), y = Math.round(p.y), r = p.size;
        g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1);   // 十字の星
        if (r > 1) g.fillRect(x - 1, y - 1, 3, 3);
      }
      g.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(tick);
      else { running = false; g.clearRect(0, 0, c.width, c.height); }
    }
    document.addEventListener('pointerdown', (e) => {
      const n = REDUCED ? 3 : 10;
      for (let i = 0; i < n && parts.length < 120; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2;
        parts.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 380 + Math.random() * 300,
          size: 1 + Math.floor(Math.random() * 3), color: colors[i % colors.length] });
      }
      if (!running) { running = true; last = 0; requestAnimationFrame(tick); }
    }, { capture: true, passive: true });
    tapLayer = c;
  }

  async function damageNumber(st, x, y, dmg) {
    if (!dmg) return;
    const t = st.add(new Text(`-${dmg}`, 26, '#ffffff', '#b91c1c'));
    t.x = x; t.y = y;
    await pop(st, t, 220);
    await st.tween(t, { y: y - 10 }, 160, E.outQuad);
    await st.tween(t, { y: y + 2 }, 240, E.outElastic);
  }

  global.KanjiFX = {
    janken: janken,
    dice: dice,
    diceCount: 2,   // dice() が2個のサイコロ（ダブルダイス）に対応している印
    diceDuel: diceDuel,
    gachaOpen: gachaOpen,
    treasure: treasure,
    enableTapSparkles: enableTapSparkles,
    preload: (urls) => Promise.all((urls || []).map((u) => loadImage(u))),
    setSound: (on) => { Sound.on = !!on; try { localStorage.setItem('kanji_fx_sound', on ? 'on' : 'off'); } catch (e) {} },
    soundOn: () => Sound.on,
    reducedMotion: REDUCED
  };
})(window);
