/* ===============================================================
   漢字の刃｜カードを作る（子どもの申請画面。app.js が、開いたときだけ読み込む）
   ・画像はこの Chromebook の中でカードの形（600×849）に切りぬき、小さくしてから送る
   ・先生が承認すると、カードリストに入り、作った子に1枚プレゼントされる
   ・審査中の申請は1人1枚まで
   ・ステップアップのスキルはえらばない（段階4：レアリティの段で自動。先生が承認のときに変えられる）
   =============================================================== */
(function () {
  'use strict';
  const FULL_W = 600, FULL_H = 849, THUMB_W = 240, THUMB_H = 340;
  let app = null, root = null, picked = null, hand = '';

  const CSS = `
  body.view-cardmake { padding: 16px 14px 110px; }
  #view-cardmake .container { max-width: 760px; margin: 0 auto; }
  .cm-box { padding: 18px 20px; margin-bottom: 14px; color: #e2e8f0; }
  .cm-title { font-size: 22px; font-weight: 900; color: #f8fafc; margin-bottom: 4px; }
  .cm-note { font-size: 14px; line-height: 1.7; color: #cbd5e1; }
  .cm-warn { margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.4); font-size: 14px; line-height: 1.6; color: #fde68a; }
  .cm-grid { display: grid; grid-template-columns: 200px 1fr; gap: 18px; align-items: start; }
  .cm-preview { width: 200px; aspect-ratio: 600 / 849; border-radius: 14px; border: 2px dashed rgba(56, 189, 248, 0.5); background: rgba(2, 6, 23, 0.6); display: flex; align-items: center; justify-content: center; overflow: hidden; color: #94a3b8; font-size: 13px; text-align: center; padding: 8px; }
  .cm-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cm-field { margin-bottom: 14px; }
  .cm-field label, .cm-label { display: block; font-size: 14px; font-weight: 800; margin-bottom: 6px; color: #e0f2fe; }
  .cm-field input[type=text] { width: 100%; font: inherit; font-size: 16px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.4); background: #0f172a; color: #f8fafc; }
  .cm-file { font: inherit; font-size: 15px; color: #e2e8f0; }
  .cm-hands { display: flex; gap: 8px; }
  .cm-hand { flex: 1; font: inherit; font-size: 18px; font-weight: 900; padding: 12px 6px; border-radius: 12px; cursor: pointer; color: #e2e8f0; background: rgba(15, 23, 42, 0.8); border: 2px solid rgba(56, 189, 248, 0.3); }
  .cm-hand.active { border-color: #fbbf24; background: rgba(251, 191, 36, 0.18); color: #fff; }
  .cm-send { width: 100%; font: inherit; font-size: 18px; font-weight: 900; padding: 14px; border: none; border-radius: 999px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #14b8a6, #7c3aed); }
  .cm-send:disabled { opacity: 0.5; cursor: default; }
  .cm-back { font: inherit; font-size: 15px; font-weight: 800; padding: 10px 18px; border-radius: 999px; cursor: pointer; color: #e2e8f0; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.35); }
  .cm-status { display: flex; gap: 14px; align-items: center; }
  .cm-status img { width: 90px; aspect-ratio: 600 / 849; object-fit: cover; border-radius: 10px; border: 2px solid rgba(56, 189, 248, 0.4); }
  .cm-badge { display: inline-block; font-size: 13px; font-weight: 900; padding: 3px 12px; border-radius: 999px; margin-bottom: 6px; }
  .cm-badge.wait { background: rgba(56, 189, 248, 0.2); color: #7dd3fc; }
  .cm-badge.ok { background: rgba(74, 222, 128, 0.2); color: #86efac; }
  .cm-badge.ng { background: rgba(248, 113, 113, 0.2); color: #fca5a5; }
  .cm-msg { margin-top: 10px; font-size: 14px; font-weight: 800; min-height: 1.4em; }
  .cm-msg.error { color: #fca5a5; } .cm-msg.ok { color: #86efac; }
  .cm-eff-note { font-size: 13px; color: #94a3b8; margin: 6px 0 12px; line-height: 1.6; }
  @media (max-width: 600px) { .cm-grid { grid-template-columns: 1fr; } .cm-preview { margin: 0 auto; } }
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
    root = el('section', { id: 'view-cardmake', class: 'app-view', hidden: '' }, [
      el('div', { class: 'container' }, [
        el('div', { class: 'cm-box hud-panel' }, [
          el('div', { class: 'cm-title', text: '🎨 カードを作る' }),
          el('div', { class: 'cm-note', text: '自分でかいた絵をカードにできるよ。先生がたしかめて「承認」すると、ガチャから出るようになって、作った人には1枚プレゼント！' }),
          el('div', { class: 'cm-warn', text: '⚠️ 自分や友だちの顔写真・名前・学校名は入れないでね。インターネットに公開されるので、自分でかいた絵だけにしよう。' })
        ]),
        el('div', { class: 'cm-box hud-panel', id: 'cmStatus', hidden: '' }),
        el('div', { class: 'cm-box hud-panel', id: 'cmForm', hidden: '' }, [
          el('div', { class: 'cm-grid' }, [
            el('div', { class: 'cm-preview', id: 'cmPreview', text: 'ここに絵が出るよ' }),
            el('div', {}, [
              el('div', { class: 'cm-field' }, [
                el('label', { for: 'cmFile', text: '① 絵をえらぶ' }),
                el('input', { type: 'file', id: 'cmFile', class: 'cm-file', accept: 'image/png,image/jpeg,image/webp', onchange: onPick })
              ]),
              el('div', { class: 'cm-field' }, [
                el('label', { for: 'cmName', text: '② カードの名前（12文字まで）' }),
                el('input', { type: 'text', id: 'cmName', maxlength: '12', placeholder: '例：いかずちの剣士', autocomplete: 'off' })
              ]),
              el('div', { class: 'cm-field' }, [
                el('span', { class: 'cm-label', text: '③ 手をえらぶ' }),
                el('div', { class: 'cm-hands', id: 'cmHands' }, [['グー', '✊ グー'], ['チョキ', '✌️ チョキ'], ['パー', '🖐️ パー']].map((h) =>
                  el('button', { type: 'button', class: 'cm-hand', 'data-hand': h[0], text: h[1], onclick: () => pickHand(h[0]) })))
              ]),
              el('div', { class: 'cm-field' }, [
                el('label', { for: 'cmLine', text: '④ セリフ（なくてもよい・30文字まで）' }),
                el('input', { type: 'text', id: 'cmLine', maxlength: '30', placeholder: '例：雷のように、すばやく！', autocomplete: 'off' })
              ]),
              el('div', { class: 'cm-eff-note', text: '⚔️ ステップアップバトルのスキルは、先生が決めるレアリティで自動で決まるよ（ふつう・つよい・⚡イカサマ）。図鑑で見てみよう！' }),
              el('button', { type: 'button', class: 'cm-send', id: 'cmSend', text: '📮 先生に送る', onclick: send }),
              el('div', { class: 'cm-msg', id: 'cmMsg', role: 'status' })
            ])
          ])
        ]),
        el('div', { style: 'text-align:center' }, [el('button', { type: 'button', class: 'cm-back', text: '🏠 マイページへ戻る', onclick: () => app.openMypage() })])
      ])
    ]);
    document.body.appendChild(root);
  }

  function msg(text, type) { const m = $('cmMsg'); m.textContent = text || ''; m.className = 'cm-msg' + (type ? ' ' + type : ''); }

  function pickHand(h) {
    hand = h;
    document.querySelectorAll('#cmHands .cm-hand').forEach((b) => b.classList.toggle('active', b.getAttribute('data-hand') === h));
  }

  // 画像を読みこんで、カードの形にまん中から切りぬく
  function onPick(e) {
    const file = e.target.files && e.target.files[0];
    picked = null;
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { msg('PNG・JPEG・WebP の画像をえらんでね。', 'error'); return; }
    if (file.size > 15 * 1024 * 1024) { msg('画像が大きすぎます（15MBまで）。', 'error'); return; }
    msg('絵を準備中...');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        picked = { full: cut(img, FULL_W, FULL_H, 0.85), thumb: cut(img, THUMB_W, THUMB_H, 0.8) };
        $('cmPreview').replaceChildren(el('img', { src: picked.full, alt: 'えらんだ絵' }));
        msg('');
      } catch (err) {
        msg('この画像は使えませんでした。ほかの画像をえらんでね。', 'error');
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); msg('画像を読みこめませんでした。', 'error'); };
    img.src = url;
  }

  function cut(img, w, h, quality) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale, sh = h / scale;
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
    let out = c.toDataURL('image/webp', quality);
    if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', quality);   // WebP が作れないとき
    return out;
  }

  function send() {
    const name = $('cmName').value.trim();
    if (!picked) { msg('① 絵をえらんでね。', 'error'); return; }
    if (!name) { msg('② カードの名前を入れてね。', 'error'); return; }
    if (!hand) { msg('③ 手をえらんでね。', 'error'); return; }
    $('cmSend').disabled = true;
    msg('送っています...');
    app.call('card.submit', { name: name, hand: hand, line: $('cmLine').value.trim(), image: picked.full, thumb: picked.thumb })
      .then(() => { msg('送ったよ！先生が見るまで待ってね。', 'ok'); return loadStatus(); })
      .catch((err) => { msg(err.message || '送れませんでした。', 'error'); })
      .finally(() => { $('cmSend').disabled = false; });
  }

  function loadStatus() {
    app.showLoading('読み込み中...');
    return app.call('card.myStatus').then((d) => {
      const box = $('cmStatus');
      const req = d.request;
      const pending = req && req.status === '審査中';
      $('cmForm').hidden = pending || !d.ready;
      if (!d.ready) {
        box.hidden = false;
        box.replaceChildren(el('div', { class: 'cm-note', text: 'カードの申請は、先生がまだ準備中です。もう少し待ってね。' }));
        return;
      }
      if (!req) { box.hidden = true; return; }
      box.hidden = false;
      const badge = req.status === '承認' ? el('span', { class: 'cm-badge ok', text: '🎉 承認されたよ！' })
        : req.status === '見送り' ? el('span', { class: 'cm-badge ng', text: '今回は見送り' })
        : el('span', { class: 'cm-badge wait', text: '⏳ 先生が見ているところ' });
      const lines = [badge, el('div', { class: 'cm-note', text: '「' + req.name + '」（' + req.hand + '）　' + req.time })];
      if (req.status === '承認') lines.push(el('div', { class: 'cm-note', text: 'カード No.' + req.rank + ' になったよ。図鑑を見てみよう！ ガチャからも出るよ。（絵が出るまで10分ほどかかることがあるよ）' }));
      if (req.status === '見送り' && req.comment) lines.push(el('div', { class: 'cm-note', text: '先生から：' + req.comment }));
      if (req.status !== '審査中') lines.push(el('div', { class: 'cm-note', text: '下から、新しいカードを送れるよ。' }));
      box.replaceChildren(el('div', { class: 'cm-status' }, [req.thumb ? el('img', { src: req.thumb, alt: '' }) : null, el('div', {}, lines)]));
    }).catch((err) => {
      $('cmStatus').hidden = false;
      $('cmStatus').replaceChildren(el('div', { class: 'cm-msg error', text: err.message || '読み込めませんでした。' }));
    }).finally(() => app.hideLoading());
  }

  window.KanjiCardMake = {
    open(api) {
      app = api;
      build();
      app.showView('cardmake');
      picked = null; hand = '';
      $('cmFile').value = ''; $('cmName').value = ''; $('cmLine').value = '';
      $('cmPreview').replaceChildren(document.createTextNode('ここに絵が出るよ'));
      pickHand('');
      msg('');
      loadStatus();
    }
  };
})();
