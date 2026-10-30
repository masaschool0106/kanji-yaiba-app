// ===============================================================
// 漢字の刃（1ページ型）の画面の動き
//   GitHub Pages に置き、GAS の外枠（App.html）から読み込まれる。
//   データはすべて google.script.run の api() 経由。個人情報・正解・確率はこのファイルに書かない。
// ===============================================================
(function () {
  'use strict';

  // ==================== 設定 ====================
  const SESSION_STORE_KEY = 'kanji_app_session';   // { token, exp }
  const LEGACY_NUM_KEY = 'kanji_num';
  const FINISHER_FORM_URL = 'https://forms.gle/KDEHoS8UNkS6uB8a6';   // 決め技・柱名を変えたいときのフォーム
  const BUG_FORM_URL = 'https://forms.gle/ZRoicHDGxMdQQU4R7';        // バグ報告のフォーム              // 今の画面（Gacha.html など）が使う出席番号
  const REFRESH_MS = 300000;                       // マイページを5分ごとに読み直す（今のマイページと同じ）
  const CONFIG = window.KANJI_CONFIG || {};        // App.html が入れる { assetBase, assetVersion, nav }

  const state = { token: null, player: null, settings: {}, view: null, refreshTimer: null, jamaicaDone: false };
  const $ = (id) => document.getElementById(id);

  // ==================== 素材（画像・効果音）のURL ====================
  // 例：KanjiAssets.url('assets/sound/gacha_open.mp3')
  //   版の番号を付けるので、GAS のスクリプトのプロパティ ASSET_VERSION を上げるとすぐ新しいファイルに切り替わる
  function assetUrl(path) {
    const v = CONFIG.assetVersion ? (String(path).indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(CONFIG.assetVersion) : '';
    return (CONFIG.assetBase || '') + String(path).replace(/^\//, '') + v;
  }
  window.KanjiAssets = { url: assetUrl };

  // ==================== 保存（使えない端末でも止まらないようにする） ====================
  function storeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function storeSet(key, v) { try { localStorage.setItem(key, v); } catch (e) {} try { sessionStorage.setItem(key, v); } catch (e) {} }
  function storeRemove(key) { try { localStorage.removeItem(key); } catch (e) {} try { sessionStorage.removeItem(key); } catch (e) {} }

  function loadSession() {
    try {
      const s = JSON.parse(storeGet(SESSION_STORE_KEY) || 'null');
      if (s && s.token && Date.parse(s.exp) > Date.now()) return s;
    } catch (e) {}
    return null;
  }
  function saveSession(token, exp, studentId) {
    state.token = token;
    try { localStorage.setItem(SESSION_STORE_KEY, JSON.stringify({ token: token, exp: exp })); } catch (e) {}
    storeSet(LEGACY_NUM_KEY, studentId);
  }
  function clearSession() {
    state.token = null;
    state.player = null;
    state.jamaicaDone = false;
    try { localStorage.removeItem(SESSION_STORE_KEY); } catch (e) {}
    storeRemove(LEGACY_NUM_KEY);
  }

  // ==================== 通信（サーバーの窓口は api() ひとつだけ） ====================
  function call(action, params) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.ok) return resolve(res.data || {});
          const err = (res && res.error) || { code: 'SERVER_ERROR', message: 'うまくいきませんでした。' };
          if (err.code === 'AUTH_EXPIRED') {
            clearSession();
            showView('login');
            showMessage('loginMessage', err.message, 'error');
          }
          reject(err);
        })
        .withFailureHandler(() => {
          reject({ code: 'NETWORK', message: '通信できませんでした。インターネットのつながりをたしかめて、もう一度ためしてね。' });
        })
        .api(action, state.token, params || {});
    });
  }

  // ==================== 表示の切り替え ====================
  function showLoading(text) { $('appLoadingText').textContent = text || '読み込み中...'; $('appLoading').hidden = false; }
  function hideLoading() { $('appLoading').hidden = true; }

  function showView(name) {
    state.view = name;
    document.querySelectorAll('.app-view').forEach((v) => { v.hidden = (v.id !== 'view-' + name); });
    document.body.className = 'view-' + name;
    $('globalNav').hidden = (name === 'login');
    $('globalNavMenu').classList.remove('show');
    // 城下町の背景は、ログイン・マイページのときだけ（雲が流れるのはマイページだけ）
    if (pixelBg) {
      if (name === 'mypage' || name === 'login') { pixelBg.show(); pixelBg.set({ clouds: name === 'mypage' }); }
      else pixelBg.hide();
    }
    if (name !== 'mypage') stopRefresh();
    window.scrollTo(0, 0);
  }

  function showMessage(id, text, type) {
    const el = $(id);
    el.textContent = text;
    el.className = 'message ' + (type || 'info');
    if (type === 'success') setTimeout(() => { if (el.textContent === text) el.className = 'message'; }, 5000);
  }
  function hideMessage(id) { const el = $(id); el.textContent = ''; el.className = 'message'; }

  function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ==================== ログイン ====================
  function setupLogin() {
    $('loginForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const btn = $('loginBtn');
      if (btn.disabled) return;
      hideMessage('loginMessage');
      btn.disabled = true;
      btn.textContent = '🔄 確認中...';
      call('auth.login', { number: $('loginNumber').value, password: $('loginPassword').value })
        .then((data) => {
          saveSession(data.sessionToken, data.expiresAt, data.player.studentId);
          $('loginPassword').value = '';
          showMessage('loginMessage', '✅ ログイン成功！', 'success');
          state.player = data.player;
          openMypage();
        })
        .catch((err) => {
          showMessage('loginMessage', '❌ ' + err.message, 'error');
          if (err.code === 'WRONG_PASSWORD') $('loginPassword').select();
        })
        .finally(() => {
          btn.disabled = false;
          btn.textContent = '🚀 ログイン';
        });
    });
  }

  // ==================== マイページ ====================
  function openMypage() {
    showView('mypage');
    if (state.player) renderPlayer(state.player);
    loadMypage(true);
    startRefresh();
  }

  function loadMypage(withSpinner) {
    if (withSpinner) showLoading('読み込み中...');
    return call('boot')
      .then((data) => {
        if (data.role === 'teacher') { openTeacher(); return; }   // 先生（32番＋先生のアカウント）は管理画面へ
        if (data.teacherNote) showMessage('mypageMessage', data.teacherNote, 'error');   // 先生用の番号なのに開かない理由
        state.player = data.player;
        state.settings = data.settings || {};
        renderPlayer(data.player);
        renderRanking(data.ranking);
        renderRaid(data.raid);
        if (!state.jamaicaDone) { state.jamaicaDone = true; syncJamaica(); }
      })
      .catch((err) => { if (err.code !== 'AUTH_EXPIRED') showMessage('mypageMessage', 'データの読み込みに失敗しました：' + err.message, 'error'); })
      .finally(() => { if (withSpinner) hideLoading(); });
  }

  function renderPlayer(p) {
    $('playerNickname').textContent = p.nickname;
    // 名前の横は、出席番号ではなくテストの点数（Students の I列）を「Lv.」として出す
    // （GAS の App.html が前の版で「No.」の形のままでも、ここで書きかえる）
    const lv = document.querySelector('.player-id');
    if (lv) lv.textContent = 'Lv.' + p.testScore;
    $('specialMoveText').textContent = p.finisher;
    $('specialMoveEditIcon').hidden = !state.settings.finisherEditable;
    $('totalPoints').textContent = p.points;
    $('battleCount').textContent = p.randomBattleCount;
    $('testScore').textContent = p.testScore;
    $('totalRecord').textContent = p.recordTotal;
  }

  function renderRanking(r) {
    $('myStreakRank').textContent = r.streak.myRank ? r.streak.myRank + '位' : '記録なし';
    $('myStepupRank').textContent = r.stepup.myRank ? r.stepup.myRank + '位' : '記録なし';
    $('totalPlayers').textContent = r.totalPlayers + '人';
    renderRankingList('streakRankingList', r.streak.top, (p) => p.value + ' 連勝', (p) => '累計戦績 ' + p.totalRecord);
    renderRankingList('stepupRankingList', r.stepup.top, (p) => '第' + p.value + '階層', (p) => (p.score > 0 ? 'ベストスコア ' + p.score : '挑戦中'));
  }

  function renderRankingList(elId, list, valueText, subText) {
    const el = $(elId);
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="ranking-empty">まだ記録がありません</div>';
      return;
    }
    el.innerHTML = list.map((p) => {
      const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank + '.';
      return '<div class="ranking-item' + (p.isMe ? ' is-me' : '') + '">' +
        '<span class="rank-number rank-' + Number(p.rank) + '">' + medal + '</span>' +
        '<div class="player-info"><div class="player-nickname">' + escapeHtml(p.nickname) + (p.isMe ? '（あなた）' : '') + '</div>' +
        '<div class="player-stats"><span>' + escapeHtml(subText(p)) + '</span></div></div>' +
        '<div class="player-points">' + escapeHtml(valueText(p)) + '</div></div>';
    }).join('');
  }

  function switchRanking(type, tab) {
    document.querySelectorAll('#view-mypage .ranking-tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('#view-mypage .ranking-content').forEach((c) => c.classList.toggle('active', c.id === type + 'RankingContent'));
  }

  // ジャマイカ計算で獲得したポイントを反映（失敗しても画面には出さない。ジャマイカ未連携の児童もいるため）
  function syncJamaica() {
    call('jamaica.sync')
      .then((res) => {
        if (res.synced && res.bonusPoints > 0) {
          showMessage('mypageMessage', '🇯🇲 ジャマイカ計算で ' + res.bonusPoints + ' pt 獲得！', 'success');
          loadMypage(false);
        }
      })
      .catch(() => {});
  }

  function startRefresh() { stopRefresh(); state.refreshTimer = setInterval(() => { if (state.token && state.view === 'mypage') loadMypage(false); }, REFRESH_MS); }
  function stopRefresh() { if (state.refreshTimer) clearInterval(state.refreshTimer); state.refreshTimer = null; }

  // 決め技
  function openFinisherEditor() {
    if (!state.settings.finisherEditable) {
      // フォームへのリンクを出す（新しいタブで開く）
      const el = $('mypageMessage');
      const a = document.createElement('a');
      a.href = FINISHER_FORM_URL; a.target = '_blank'; a.rel = 'noopener'; a.className = 'msg-link';
      a.textContent = '📝 決め技・柱名の変更フォームを開く';
      el.replaceChildren(document.createTextNode('決め技や柱名を変えたいときは、フォームで先生に送ってね。 '), a);
      el.className = 'message info';
      return;
    }
    $('newSpecialMove').value = state.player ? state.player.finisher : '';
    $('editModal').classList.add('show');
    $('newSpecialMove').focus();
  }
  function closeFinisherEditor() { $('editModal').classList.remove('show'); }
  function saveFinisher() {
    const text = $('newSpecialMove').value.trim();
    if (!text) return alert('決め技を入力してください');
    if (Array.from(text).length > 30) return alert('30文字以内で入力してください');
    showLoading('保存中...');
    call('player.setFinisher', { finisher: text })
      .then((res) => {
        if (state.player) state.player.finisher = res.finisher;
        $('specialMoveText').textContent = res.finisher;
        closeFinisherEditor();
        showMessage('mypageMessage', '決め技を更新しました！', 'success');
      })
      .catch((err) => alert(err.message))
      .finally(hideLoading);
  }

  function logout() {
    const token = state.token;
    stopRefresh();
    if (token) call('auth.logout').catch(() => {});
    clearSession();
    hideMessage('mypageMessage');
    showView('login');
    $('loginNumber').focus();
  }

  // ==================== 行き先のタイル（2026-10-30 から。前は 3D の回転） ====================
  //   タップ1回でその画面へ移動する。スワイプはしない（iPad では、なぞる操作がブラウザの「戻る」と取りあいになるため）
  //   キーボード：数字キー（1〜8）でその行き先へ・矢印キーでとなりのタイルへ・Enter で決める
  //   App.html の .cz-card（前の 3D の部品）をそのまま使い、見た目は app.css で大きなタイルにする
  const TILE_COLORS = { gacha: '#7e2553', battle: '#ff004d', roguelike: '#1d2b53', quiz: '#008751', zukan: '#065ab5',
    quizrunner: '#5f574f', jamaica: '#ab5236', cardmake: '#83769c' };
  const tiles = [];

  function setupTiles() {
    const ring = $('carouselRing');
    if (!ring) return;
    // 「カードを作る」は GAS の App.html にないので、ここで足す
    if (!ring.querySelector('[data-page="cardmake"]')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cz-card'; b.setAttribute('data-page', 'cardmake'); b.setAttribute('aria-label', 'カードを作る');
      b.innerHTML = '<span class="cz-icon">🎨</span><span class="cz-name">カードを作る</span><span class="cz-desc">自分の絵をカードにしよう！</span>';
      ring.appendChild(b);
    }
    ring.querySelectorAll('.cz-card').forEach((card, i) => {
      tiles.push(card);
      card.style.setProperty('--c', TILE_COLORS[card.dataset.page] || '#065ab5');
      const desc = card.querySelector('.cz-desc');
      if (desc) card.title = desc.textContent;
      if (i < 9) { const k = document.createElement('span'); k.className = 'kbd'; k.textContent = String(i + 1); card.insertBefore(k, card.firstChild); }
      card.addEventListener('click', () => navigate(card.dataset.page));
    });
    const title = document.querySelector('#view-mypage .carousel-title');
    if (title) { const k = document.createElement('span'); k.className = 'kbd'; k.textContent = '1〜' + Math.min(9, tiles.length); title.appendChild(k); }
    // 決め技・柱名とバグ報告は、フォームを新しいタブで開く（小さなボタン）
    const sub = document.createElement('div');
    sub.className = 'tile-sub';
    [['finisherform', '✏️ 決め技・柱名の変更'], ['bugreport', '🐞 バグ報告']].forEach(([page, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-page', page); b.textContent = label;
      b.addEventListener('click', () => navigate(page));
      sub.appendChild(b);
    });
    $('carousel').appendChild(sub);
    document.addEventListener('keydown', onMypageKey);
  }

  function tileCols() { return getComputedStyle($('carouselRing')).gridTemplateColumns.split(' ').length || 1; }

  function onMypageKey(e) {
    if (state.view !== 'mypage' || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('editModal').classList.contains('show')) { if (e.key === 'Escape') closeFinisherEditor(); return; }
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if ($('globalNavMenu').classList.contains('show')) return;   // メニューを開いているときは、メニューのキー
    if (/^[1-9]$/.test(e.key) && tiles[+e.key - 1]) {
      e.preventDefault();
      tiles[+e.key - 1].focus();
      navigate(tiles[+e.key - 1].dataset.page);
      return;
    }
    const i = tiles.indexOf(document.activeElement);
    const onPage = !document.activeElement || document.activeElement === document.body;
    if (i < 0) {   // まだタイルを選んでいないとき：← → で1つ目のタイルへ（↑↓ はふつうに画面を動かす）
      if (onPage && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { tiles[0].focus(); e.preventDefault(); }
      return;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: tileCols(), ArrowUp: -tileCols() }[e.key];
    if (!step) return;
    const n = i + step;
    if (n >= 0 && n < tiles.length) { tiles[n].focus(); e.preventDefault(); }
  }

  // ==================== 右下のメニュー（キーボード：M で開く・Esc でとじる・↑↓ でえらぶ） ====================
  function toggleMenu(focusFirst, force) {
    const menu = $('globalNavMenu');
    const open = (force === undefined) ? !menu.classList.contains('show') : force;
    menu.classList.toggle('show', open);
    $('globalNavToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && focusFirst) { const first = menu.querySelector('button'); if (first) first.focus(); }
  }
  function setupMenu() {
    const toggle = $('globalNavToggle'), menu = $('globalNavMenu');
    // GAS の App.html の「☰ メニュー」は div なので、ボタンとして使えるようにする
    toggle.setAttribute('role', 'button'); toggle.tabIndex = 0; toggle.setAttribute('aria-expanded', 'false'); toggle.title = 'メニュー（M）';
    const k = document.createElement('span'); k.className = 'kbd'; k.textContent = 'M'; toggle.appendChild(k);
    toggle.addEventListener('click', () => toggleMenu(false));
    toggle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(true); } });
    document.addEventListener('keydown', (e) => {
      if ($('globalNav').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if ($('editModal').classList.contains('show')) return;
      const open = menu.classList.contains('show');
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMenu(true); if (open) toggle.focus(); return; }
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); toggleMenu(false, false); toggle.focus(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = Array.from(menu.querySelectorAll('button'));
        const i = list.indexOf(document.activeElement);
        list[(i < 0) ? 0 : (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
        e.preventDefault();
      }
    }, true);
  }

  // ==================== ドット絵の部品（fx/pixel.js：点のアイコン・城下町の背景・画面を出るときのタイル） ====================
  //   読み込めなくても、絵文字のアイコンと無地の背景で動く
  let pixelBg = null;
  function loadPixel() {
    if (!document.getElementById('kpx-font')) {   // 字（DotGothic16）。描くのを止めないように、あとから読みこむ
      const l = document.createElement('link');
      l.id = 'kpx-font'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap';
      document.head.appendChild(l);
    }
    if (window.KanjiPixel) { decoratePixel(); return; }
    const sc = document.createElement('script');
    sc.src = assetUrl('fx/pixel.js');
    sc.onload = decoratePixel;
    document.head.appendChild(sc);
  }
  function decoratePixel() {
    const P = window.KanjiPixel;
    if (!P) return;
    tiles.forEach((card) => {
      const ic = card.querySelector('.cz-icon'), cv = P.icon(card.dataset.page, 48);
      if (ic && cv) ic.replaceChildren(cv);
    });
    // メニューと小さなボタン：前の絵文字を、点のアイコンにかえる
    document.querySelectorAll('#globalNavMenu button, #view-mypage .tile-sub button').forEach((b) => {
      const cv = P.icon(b.getAttribute('data-nav') || b.getAttribute('data-page'), 24);
      if (cv) b.replaceChildren(cv, document.createTextNode(b.textContent.replace(/^\S+\s*/, '')));
    });
    pixelBg = P.background('castle', { clouds: state.view === 'mypage', raid: document.documentElement.classList.contains('raid-on') });
    if (state.view !== 'mypage' && state.view !== 'login') pixelBg.hide();
  }

  // ==================== カードを作る（cardmake.js は開いたときだけ読み込む） ====================
  function openCardMake() {
    stopRefresh();
    const api = { call: call, showView: showView, showLoading: showLoading, hideLoading: hideLoading, openMypage: openMypage };
    const go = () => { hideLoading(); window.KanjiCardMake.open(api); };
    if (window.KanjiCardMake) { go(); return; }
    showLoading('読み込み中...');
    const cfg = window.KANJI_CONFIG || {};
    const sc = document.createElement('script');
    sc.src = (cfg.assetBase || '') + 'cardmake.js' + (cfg.assetVersion ? '?v=' + encodeURIComponent(cfg.assetVersion) : '');
    sc.onload = go;
    sc.onerror = () => { hideLoading(); showMessage('mypageMessage', '「カードを作る」を読み込めませんでした。', 'error'); };
    document.head.appendChild(sc);
  }

  // ==================== 巨大レイドボス ====================
  // 週末・月末だけ、マイページの空が赤くなり、ボスの知らせが出る。押すと raid.js を読みこんで、漢字ミサイルの画面へ
  function renderRaid(r) {
    const on = !!(r && r.active);
    document.documentElement.classList.toggle('raid-on', on && !r.defeated);
    if (pixelBg) pixelBg.set({ raid: on && !r.defeated });   // 城下町の空が赤くなる
    let box = $('raidBanner');
    if (!on) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('section');
      box.id = 'raidBanner'; box.className = 'raid-banner hud-panel';
      const anchor = document.querySelector('#view-mypage .carousel-wrap');
      if (anchor) anchor.parentNode.insertBefore(box, anchor); else $('view-mypage').appendChild(box);
    }
    const left = Math.max(0, r.maxHp - r.damage);
    const pct = r.maxHp ? Math.round(left / r.maxHp * 100) : 100;
    box.innerHTML = r.defeated
      ? `<div class="raid-title">🎉 ${escapeHtml(r.boss)} をクラスみんなで倒した！</div><div class="raid-sub">${escapeHtml(r.label)}・次の襲来を待とう</div>`
      : `<div class="raid-title">⚠️ ${escapeHtml(r.label)}「${escapeHtml(r.boss)}」襲来！</div>
         <div class="raid-hp"><i style="width:${pct}%"></i><span>HP ${left.toLocaleString('ja-JP')} / ${r.maxHp ? r.maxHp.toLocaleString('ja-JP') : '?'}</span></div>
         <div class="raid-sub">${r.dice ? '漢字クイズに正解すると、カードで「じゃんけん＋サイコロ」の攻撃！' : '漢字クイズに正解するたび「漢字ミサイル」でダメージ！'} クラスみんなで倒そう</div>
         <button type="button" class="raid-go" id="raidGo">🚀 漢字ミサイルで攻撃！</button>`;
    const go = $('raidGo');
    if (go) go.addEventListener('click', openRaid);
  }
  function openRaid() {
    stopRefresh();
    const api = { call: call, showView: showView, showLoading: showLoading, hideLoading: hideLoading, openMypage: openMypage, escapeHtml: escapeHtml };
    const go = () => { hideLoading(); window.KanjiRaid.open(api); };
    if (window.KanjiRaid) { go(); return; }
    showLoading('ボスに近づいています...');
    const cfg = window.KANJI_CONFIG || {};
    const sc = document.createElement('script');
    sc.src = (cfg.assetBase || '') + 'raid.js' + (cfg.assetVersion ? '?v=' + encodeURIComponent(cfg.assetVersion) : '');
    sc.onload = go;
    sc.onerror = () => { hideLoading(); showMessage('mypageMessage', 'レイドの画面を読み込めませんでした。', 'error'); };
    document.head.appendChild(sc);
  }

  // ==================== 先生の管理画面 ====================
  // admin.js は先生のときだけ読み込む（子どもの画面の速さに影響しない）。
  // 先生かどうかは、管理画面の操作のたびにサーバーが確かめる
  function openTeacher() {
    stopRefresh();
    const api = { call: call, logout: logout, showView: showView, showLoading: showLoading, hideLoading: hideLoading };
    const go = () => { hideLoading(); window.KanjiAdmin.open(api); };
    if (window.KanjiAdmin) { go(); return; }
    const cfg = window.KANJI_CONFIG || {};
    const sc = document.createElement('script');
    sc.src = (cfg.assetBase || '') + 'admin.js' + (cfg.assetVersion ? '?v=' + encodeURIComponent(cfg.assetVersion) : '');
    sc.onload = go;
    sc.onerror = () => { hideLoading(); showView('mypage'); showMessage('mypageMessage', '管理画面を読み込めませんでした。', 'error'); };
    document.head.appendChild(sc);
  }

  // ==================== 画面の移動 ====================
  // iPad の Safari は「タップした直後」しか画面全体を移動させてくれない（あとからだと The operation is insecure. になる）。
  //   そこで、移動先はページを作るときにサーバーが用意した URL（KANJI_CONFIG.nav）を使い、タップした瞬間に移動する。
  //   作り方はサーバーの getNavigationUrl と同じなので、移動先は今までと同じ URL
  function legacyUrl(page) {
    const t = (CONFIG.nav || {})[page];
    const num = String((state.player && state.player.studentId) || storeGet(LEGACY_NUM_KEY) || '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).trim();   // サーバーの toHalfWidth_ と同じ
    if (!t || !num) return '';
    return t.split('__NUM__').join(encodeURIComponent(num));
  }
  // 画面全体を移動する。止められたら「▶ タップして移動」を出す（このボタンを押すと、止められずに移動できる）
  function moveTop(url) {
    try { window.top.location.href = url; }
    catch (e) { showNavTap(url); return; }
    // 止められても知らせてこないブラウザのために：5秒たっても画面が変わらなければボタンを出す
    setTimeout(() => showNavTap(url), 5000);
  }
  function showNavTap(url) {
    if (document.querySelector('.nav-tap')) return;
    const box = document.createElement('div');
    box.className = 'nav-tap';
    box.setAttribute('role', 'dialog');
    box.innerHTML = '<div class="nav-tap-box"><p>画面を移動します。<br>下のボタンをタップしてね。</p>' +
      '<a class="nav-tap-go" target="_top">▶ タップして移動</a><button type="button" class="nav-tap-close">とじる</button></div>';
    box.querySelector('.nav-tap-go').href = url;
    box.querySelector('.nav-tap-close').addEventListener('click', () => { box.remove(); hideLoading(); });
    document.body.appendChild(box);
  }

  // まだ1ページ型に移していない画面は、今の画面へ移動する（移行のあいだだけ）
  function navigate(page) {
    $('globalNavMenu').classList.remove('show');
    if (page === 'mypage') {
      if (state.view !== 'mypage') openMypage();
      return;
    }
    if (page === 'cardmake') { openCardMake(); return; }
    if (page === 'bugreport') { window.open(BUG_FORM_URL, '_blank', 'noopener'); return; }
    if (page === 'finisherform') { window.open(FINISHER_FORM_URL, '_blank', 'noopener'); return; }
    showLoading('移動中...');
    if (window.KanjiPixel) window.KanjiPixel.wipe();   // 黒いタイルで閉じる（飾り。移動は待たない）
    const direct = legacyUrl(page);
    if (direct) { moveTop(direct); return; }
    call('nav.legacyUrl', { page: page })   // 移動先が用意されていないとき（GAS が前の版など）は、今までどおりサーバーに聞く
      .then((res) => { moveTop(res.url); })
      .catch((err) => {
        hideLoading();
        if (err.code !== 'AUTH_EXPIRED') showMessage('mypageMessage', err.message, 'error');
      });
  }

  // ==================== 起動 ====================
  function setupEvents() {
    setupLogin();
    // メニューに「クイズ・ランナー」「カードを作る」「バグ報告」などを足す（GAS の App.html が前の版でも出るように、ここで足す）
    [['quizrunner', '🏃 クイズ・ランナー'], ['cardmake', '🎨 カードを作る'], ['finisherform', '✏️ 決め技・柱名の変更'], ['bugreport', '🐞 バグ報告']].forEach(([key, label]) => {
      if ($('globalNavMenu') && !$('globalNavMenu').querySelector('[data-nav="' + key + '"]')) {
        const nb = document.createElement('button');
        nb.type = 'button'; nb.setAttribute('data-nav', key); nb.textContent = label;
        $('globalNavMenu').appendChild(nb);
      }
    });
    document.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.getAttribute('data-nav'))));
    document.querySelectorAll('#view-mypage .ranking-tab').forEach((tab) => tab.addEventListener('click', () => switchRanking(tab.getAttribute('data-ranking'), tab)));
    setupMenu();
    $('specialMoveBox').addEventListener('click', openFinisherEditor);
    $('specialMoveBox').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFinisherEditor(); } });
    setupTiles();
    $('newSpecialMove').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveFinisher(); } });
    $('saveSpecialMoveBtn').addEventListener('click', saveFinisher);
    $('cancelSpecialMoveBtn').addEventListener('click', closeFinisherEditor);
    $('editModal').addEventListener('click', function (e) { if (e.target === this) closeFinisherEditor(); });
    $('logoutBtn').addEventListener('click', logout);
  }

  function start() {
    setupEvents();
    hideLoading();
    loadPixel();
    // タップの粒（fx.js が読み込めたときだけ。App.html で fx.js を先に読み込んでいる）
    if (window.KanjiFX && window.KanjiFX.enableTapSparkles) window.KanjiFX.enableTapSparkles();
    const saved = loadSession();
    if (saved) {
      state.token = saved.token;
      openMypage();
      // ほかの画面のメニューから「カードを作る」で来たとき（?page=cardmake）は、そのまま開く
      try {
        if (window.google && google.script && google.script.url) {
          google.script.url.getLocation((loc) => { if (loc && loc.parameter && loc.parameter.page === 'cardmake') openCardMake(); });
        }
      } catch (e) {}
    } else {
      clearSession();
      showView('login');
      $('loginNumber').focus();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
