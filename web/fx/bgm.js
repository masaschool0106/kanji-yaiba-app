// ===============================================================
// 漢字の刃｜ゲームの音楽（KanjiBgm）
//   ・音のファイルは使わない。Web Audio で、その場で音を作る
//       江戸風：三味線・篠笛・琴・和太鼓（大太鼓・締太鼓）・拍子木・鉦ふう
//       ファミコン風：矩形波2つ・三角波・ノイズの4音まで（江戸の音階をファミコンの音色で鳴らす「まぜ」もある）
//   ・曲はすべてこのファイルで作ったオリジナル。五音音階などの「レシピ」（TRACKS の1行）から、
//     決まった種（seed）で毎回同じ曲を組み立てる。ジングルは手で書いた短い楽譜（JINGLES）
//   ・最初のタップで鳴りはじめる（ブラウザの決まり）。音は小さめ。左下の 🔊/🔇 と 🎚（音量）は端末に覚える
//   ・0.1秒ごとに 0.3秒先までの音を予約する。ページが隠れたら止める。オフの端末では音の部品を作らない
//   ・fx.js の演出（効果音）のあいだは、音楽を少し下げる（ボス登場のあいだは止める）
//
//   KanjiBgm.start('mypage')   … ページの音楽を始める（ふつうは自動：読みこむとページを見分けて始める）
//   KanjiBgm.play('boss')      … 場面を切りかえる（場面の名前は SCENES）
//   KanjiBgm.jingle('win')     … 短いジングル（win・lose・draw・clear・fanfare・get）。終わるとページの音楽にもどる
//   KanjiBgm.home()            … ページの音楽にもどる
//   KanjiBgm.next()            … 同じ場面の次の曲
//   KanjiBgm.setOn(真偽) / toggle() / isOn() / setVolume(0〜1) / volume()
//   KanjiBgm.duck(ミリ秒)      … しばらく音楽を下げる
//   KanjiBgm.tempo(1.2)        … 速さの倍率（クイズ・ランナーのフィーバー）
//   KanjiBgm.state()           … いまの様子（確かめる用）
//
//   ページを足すとき：PAGES に1行（例 newpage: 'mypage'）。ページの側は <body data-bgm="newpage"> か
//   KanjiBgm.start('newpage') の1行（FxBridge を読んでいれば、ほかはいらない）。目印の id で見分けるなら MARKS に1行
// ===============================================================
(function (global) {
  'use strict';
  if (global.KanjiBgm) return;   // 2回読みこんでも1つだけ

  const VERSION = '2026-10-31';
  const DEFAULT_ON = true;   // はじめて開いた端末で鳴らすか（教室で一斉に鳴るのがこまるときは false にして Push）
  const DEFAULT_VOL = 0.4;   // はじめの音量（0〜1）
  const MASTER = 0.32;       // 全体の大きさ（音量 100% でも効果音より小さめ）
  const DUCK = 0.35;         // 効果音（fx.js の演出）のあいだの大きさ
  const LOOKAHEAD = 0.3;     // 何秒先まで予約するか
  const TICK_MS = 100;       // 何ミリ秒ごとに予約するか
  const KEY_ON = 'kanji_bgm', KEY_VOL = 'kanji_bgm_vol';
  const LEAD = 0.24, CT = 0.11, BASSV = 0.3;   // 旋律・合いの手・低音の大きさ
  const GAIN = { p50: 0.85, p25: 0.9, p12: 1, tri: 1, shami: 1.1, fue: 0.95, koto: 1 };

  // ---------------- 音階（半音の数） ----------------
  const SCALES = {
    miyako: { name: '都節', s: [0, 1, 5, 7, 8], prog: 'miyako', arp: [0, 7, 12, 7] },
    yo:     { name: '陽音階', s: [0, 2, 5, 7, 9], prog: 'bright', arp: [0, 7, 12, 7] },
    minyo:  { name: '民謡音階', s: [0, 3, 5, 7, 10], prog: 'dark', arp: [0, 3, 7, 12] },
    hira:   { name: '平調子', s: [0, 2, 3, 7, 8], prog: 'dark', arp: [0, 7, 12, 7] },
    majp:   { name: '長調の五音', s: [0, 2, 4, 7, 9], prog: 'bright', arp: [0, 4, 7, 12] },
    major:  { name: '長調', s: [0, 2, 4, 5, 7, 9, 11], prog: 'bright', arp: [0, 4, 7, 12] },
    minor:  { name: '短調', s: [0, 2, 3, 5, 7, 8, 10], prog: 'dark', arp: [0, 3, 7, 12] },
    hmin:   { name: '和声短調', s: [0, 2, 3, 5, 7, 8, 11], prog: 'hmin', arp: [0, 3, 7, 12] }
  };
  // 低音の進み方（4小節。主音からの半音。音階にない音は近い音に寄せる）
  const PROG = {
    bright: [[0, 0, 5, 7], [0, 9, 5, 7], [0, 5, 0, 7], [0, 7, 9, 5], [0, 5, 7, 0], [9, 5, 7, 0]],
    dark:   [[0, 0, 8, 7], [0, 8, 5, 7], [0, 5, 8, 7], [0, 0, 5, 7], [0, 10, 8, 7]],
    miyako: [[0, 1, 0, 7], [0, 8, 5, 7], [0, 5, 1, 0], [0, 0, 8, 7]],   // 半音上（1）へ行くのが都節らしい
    hmin:   [[0, 8, 5, 7], [0, 5, 7, 0], [0, 8, 7, 7], [0, 5, 8, 7]]
  };
  // 旋律のリズム（1小節＝16。x：音を出す・-：のばす・.：休み）
  const RHY = {
    calm:  ['x---x---x-x-x---', 'x-----x-x-------', 'x---x-x-x---x---', 'x--x--x-x-------', 'x-------x---x---'],
    walk:  ['x-x-x---x-x-x---', 'x--x--x-x-x-x---', 'x-xx-x--x---x-x-', 'x---x-x-x-x-x---', 'x-x-x-x-x---x---'],
    march: ['x--xx---x--xx---', 'x-x-x-x-x---x---', 'x--xx-x-x-x-x---', 'x---x--xx---x---'],
    drive: ['x-x-x-xxx-x-x-x-', 'x-xxx-x-x-xxx-x-', 'xx-xx-x-x-x-xx--', 'x-x-xx-xx-x-x-x-', 'x--x--x-x-xxx-x-'],
    fest:  ['x-xxx-x-x-xxx-x-', 'x-x-xxx-x-x-x---', 'xxx-x-x-xxx-x---', 'x-x-x-x-xx-xx---'],
    tense: ['x-x-x-x-xxxxx-x-', 'x--x--x--x--x-x-', 'xxx-xxx-x-x-x---', 'x-xx-xx-x-xx-x--', 'x--x--x-xxxx-x-x'],
    epic:  ['x-----x-x---x---', 'x---x---x-x-x-x-', 'x--x--x-x-------', 'x-x-x---x-----x-']
  };
  // 4小節目（おわり）のリズム
  const CAD = {
    calm: ['x---x---x-------', 'x-x-x-----------'], walk: ['x-x-x-x-x-------', 'x---x-x-x-------'], march: ['x--xx---x-------', 'x-x-x---x-------'],
    drive: ['x-x-x-x-x---x---', 'x-xxx-x-x-------'], fest: ['x-xxx-x-x---x---', 'xxx-x-x-x-------'],
    tense: ['x-x-x-x-x---x---', 'xxx-xxx-x-------'], epic: ['x---x---x-------', 'x-x-x---x-------']
  };
  // 低音の形（R：根音・O：1オクターブ上・F：5度上）
  const BASS = {
    oct: 'R.O.R.O.R.O.R.O.', walk: 'R---F---O---F---', gallop: 'R.RR.RR.R.RR.RO.', pulse: 'R.R.R.R.R.R.R.R.',
    tsun: 'R---..R-F---R-..', drone: 'R---------------', calm: 'R-----F-R-------', march: 'R---F---R---F-O-', drive: 'R.RO.RR.R.RO.RF.'
  };
  // 打楽器（2つの列。a：ふだん・f：4小節目のおかず）
  //   ファミコン風（ノイズだけ）：k キック・K 太鼓ふう・s スネア・h ハイハット・o 開いたハイハット・C 拍子木ふう
  //   江戸風：D 大太鼓・d 締太鼓・c 拍子木・g 鉦
  const KITS = {
    fcLight:  { a: ['k.......s.......', '....h.......h...'], f: ['k.......s...s.s.', '....h.......h...'] },
    fcWalk:   { a: ['k...s...k.k.s...', '..h...h...h...h.'], f: ['k...s...k.s.s.ss', '..h...h.........'] },
    fcDrive:  { a: ['k...s..kk.k.s...', '.h.h.h.h.h.h.h.h'], f: ['k...s..kk.s.ssss', '.h.h.h..........'] },
    fcMarch:  { a: ['k...s...k...s.s.', '..h...h...h...h.'], f: ['k.s.s.s.k.s.ssss', '................'] },
    fcBoss:   { a: ['k.k.s..kk.k.s.k.', '.h.h.h.h.h.h.h.o'], f: ['k.k.s.s.kss.ssss', '.h.h.h.o........'] },
    mixDrive: { a: ['K...s..KK.K.s...', '..C...C...C...C.'], f: ['K...s..KK.s.ssss', '..C...C.CCCC....'] },
    mixTaiko: { a: ['K...K...K.K.s...', '..C...C...C...C.'], f: ['K.K.K.K.KKKKs.ss', '..C...C.........'] },
    matsuri:  { a: ['D...d.d.D..dd.d.', 'c.......c...g...'], f: ['D.d.D.d.DdDdD.DD', 'c...c...c.c.c.c.'] },
    hayashi:  { a: ['D.dd.dD.D.dd.dd.', 'g...g...g...g...'], f: ['D.dd.dD.DdddDDDD', 'g...g...g.g.g.g.'] },
    jin:      { a: ['D...D...D...DD..', '....c.......c...'], f: ['D...D...D.D.DDDD', '....c.......c...'] },
    shizuka:  { a: ['D...............', '........c.......'], f: ['D.......D.......', '........c...c...'] },
    kabuki:   { a: ['D.....D.D.....D.', 'c.c.....c.c.c...'], f: ['D.....D.D.D.DDDD', 'c.c.c.c.cccccccc'] },
    none:     { a: ['................', '................'], f: ['................', '................'] }
  };

  // ---------------- 曲のレシピ（1曲1行） ----------------
  //   n 名前・k 種類（edo 江戸／fc ファミコン／mix 江戸の音階をファミコンの音色で）・sc 音階・r 主音（MIDI の番号）・bpm 速さ
  //   f 感じ（RHY の名前）・ld 旋律の楽器・ct 合いの手（echo こだま／harm 下のハモり／arp 分散和音／koto 琴／fue 笛の長い音／none）
  //   bs 低音の形（bi：低音の楽器。ないときは fc・mix は三角波、edo は三味線）・kit 打楽器・seed 種・sw はね（0〜0.2）・v 旋律の大きさ
  const TRACKS = {
    title1: { n: '刃の目覚め', k: 'mix', sc: 'miyako', r: 69, bpm: 112, f: 'epic', ld: 'p50', ct: 'echo', bs: 'march', kit: 'mixTaiko', seed: 101 },
    title2: { n: '朝焼けの城', k: 'edo', sc: 'yo', r: 74, bpm: 84, f: 'calm', ld: 'fue', ct: 'koto', bs: 'drone', bi: 'koto', kit: 'shizuka', seed: 102 },
    town1:  { n: '城下町の朝', k: 'edo', sc: 'yo', r: 67, bpm: 100, f: 'walk', ld: 'shami', ct: 'fue', bs: 'tsun', kit: 'matsuri', seed: 201, sw: 0.12 },
    town2:  { n: 'てらこや通り', k: 'fc', sc: 'majp', r: 72, bpm: 120, f: 'walk', ld: 'p50', ct: 'echo', bs: 'oct', kit: 'fcWalk', seed: 202 },
    town3:  { n: '茶屋でひとやすみ', k: 'mix', sc: 'minyo', r: 69, bpm: 92, f: 'calm', ld: 'p25', ct: 'harm', bs: 'calm', kit: 'fcLight', seed: 203 },
    gacha1: { n: '福引き太鼓', k: 'edo', sc: 'yo', r: 69, bpm: 132, f: 'fest', ld: 'shami', ct: 'fue', bs: 'tsun', kit: 'hayashi', seed: 301, sw: 0.15 },
    gacha2: { n: 'くじ引きピコピコ', k: 'fc', sc: 'majp', r: 76, bpm: 140, f: 'drive', ld: 'p25', ct: 'arp', bs: 'oct', kit: 'fcDrive', seed: 302 },
    menu1:  { n: '出陣のしたく', k: 'fc', sc: 'yo', r: 72, bpm: 116, f: 'march', ld: 'p50', ct: 'harm', bs: 'march', kit: 'fcMarch', seed: 401 },
    menu2:  { n: '陣太鼓', k: 'edo', sc: 'minyo', r: 67, bpm: 104, f: 'march', ld: 'fue', ct: 'none', bs: 'walk', kit: 'jin', seed: 402 },
    lobby1: { n: '控えの間', k: 'fc', sc: 'minor', r: 69, bpm: 110, f: 'walk', ld: 'p25', ct: 'echo', bs: 'walk', kit: 'fcWalk', seed: 501 },
    lobby2: { n: '果たし状', k: 'edo', sc: 'miyako', r: 64, bpm: 100, f: 'walk', ld: 'shami', ct: 'koto', bs: 'tsun', kit: 'kabuki', seed: 502 },
    pvp1:   { n: '一騎打ち', k: 'fc', sc: 'minor', r: 72, bpm: 150, f: 'drive', ld: 'p50', ct: 'echo', bs: 'drive', kit: 'fcBoss', seed: 601 },
    pvp2:   { n: 'つばぜり合い', k: 'mix', sc: 'miyako', r: 69, bpm: 144, f: 'tense', ld: 'p25', ct: 'harm', bs: 'gallop', kit: 'mixTaiko', seed: 602 },
    zukan1: { n: '巻物の間', k: 'edo', sc: 'hira', r: 69, bpm: 76, f: 'calm', ld: 'koto', ct: 'fue', bs: 'drone', bi: 'koto', kit: 'shizuka', seed: 701, v: 0.85 },
    zukan2: { n: 'カード蔵', k: 'fc', sc: 'majp', r: 72, bpm: 96, f: 'calm', ld: 'p12', ct: 'arp', bs: 'calm', kit: 'fcLight', seed: 702, v: 0.85 },
    quiz1:  { n: '筆と硯', k: 'edo', sc: 'yo', r: 74, bpm: 88, f: 'calm', ld: 'koto', ct: 'none', bs: 'drone', bi: 'koto', kit: 'none', seed: 801, v: 0.7 },
    quiz2:  { n: '考えるピコ', k: 'fc', sc: 'majp', r: 72, bpm: 100, f: 'calm', ld: 'p12', ct: 'none', bs: 'calm', kit: 'fcLight', seed: 802, v: 0.7 },
    run0:   { n: 'スタート地点', k: 'fc', sc: 'major', r: 72, bpm: 108, f: 'walk', ld: 'p50', ct: 'echo', bs: 'oct', kit: 'fcLight', seed: 901 },
    run1:   { n: '街道ダッシュ', k: 'mix', sc: 'minyo', r: 72, bpm: 156, f: 'drive', ld: 'p50', ct: 'echo', bs: 'drive', kit: 'mixDrive', seed: 902 },
    run2:   { n: '飛脚の道', k: 'edo', sc: 'yo', r: 74, bpm: 150, f: 'fest', ld: 'fue', ct: 'koto', bs: 'pulse', kit: 'hayashi', seed: 903, sw: 0.1 },
    step0:  { n: '旅じたく', k: 'edo', sc: 'yo', r: 67, bpm: 96, f: 'walk', ld: 'shami', ct: 'koto', bs: 'calm', kit: 'jin', seed: 1001 },
    sgx:    { n: 'さいころ街道', k: 'fc', sc: 'yo', r: 72, bpm: 118, f: 'walk', ld: 'p25', ct: 'echo', bs: 'oct', kit: 'fcWalk', seed: 1002 },
    sg1:    { n: 'みやこのすごろく', k: 'edo', sc: 'hira', r: 74, bpm: 92, f: 'calm', ld: 'fue', ct: 'koto', bs: 'calm', bi: 'koto', kit: 'shizuka', seed: 1101 },
    sg2:    { n: '戦国すごろく', k: 'mix', sc: 'minyo', r: 69, bpm: 120, f: 'march', ld: 'p50', ct: 'harm', bs: 'march', kit: 'mixTaiko', seed: 1102 },
    sg3:    { n: 'お江戸すごろく', k: 'edo', sc: 'yo', r: 69, bpm: 116, f: 'fest', ld: 'shami', ct: 'fue', bs: 'tsun', kit: 'matsuri', seed: 1103, sw: 0.14 },
    sg4:    { n: '文明開化すごろく', k: 'fc', sc: 'major', r: 72, bpm: 126, f: 'march', ld: 'p50', ct: 'harm', bs: 'march', kit: 'fcMarch', seed: 1104 },
    ura1:   { n: '裏街道', k: 'edo', sc: 'miyako', r: 64, bpm: 100, f: 'walk', ld: 'shami', ct: 'fue', bs: 'tsun', kit: 'kabuki', seed: 1201 },
    ura2:   { n: '影ふみ', k: 'mix', sc: 'miyako', r: 69, bpm: 112, f: 'tense', ld: 'p12', ct: 'echo', bs: 'pulse', kit: 'mixDrive', seed: 1202 },
    boss1:  { n: '偉人見参', k: 'fc', sc: 'hmin', r: 69, bpm: 152, f: 'tense', ld: 'p50', ct: 'echo', bs: 'gallop', kit: 'fcBoss', seed: 1301 },
    boss2:  { n: '天下分け目', k: 'mix', sc: 'miyako', r: 67, bpm: 160, f: 'tense', ld: 'p25', ct: 'harm', bs: 'drive', kit: 'mixTaiko', seed: 1302 },
    boss3:  { n: '最後の大勝負', k: 'mix', sc: 'hmin', r: 72, bpm: 164, f: 'epic', ld: 'p50', ct: 'arp', bs: 'gallop', kit: 'fcBoss', seed: 1303 },
    uboss1: { n: '闇の舞', k: 'edo', sc: 'miyako', r: 69, bpm: 168, f: 'tense', ld: 'shami', ct: 'fue', bs: 'drive', kit: 'hayashi', seed: 1401 },
    uboss2: { n: '百鬼夜行', k: 'mix', sc: 'miyako', r: 64, bpm: 150, f: 'tense', ld: 'p50', ct: 'echo', bs: 'gallop', kit: 'mixTaiko', seed: 1402 },
    raid1:  { n: '大怪獣あらわる', k: 'fc', sc: 'minor', r: 67, bpm: 140, f: 'epic', ld: 'p50', ct: 'harm', bs: 'gallop', kit: 'fcBoss', seed: 1501 },
    raid2:  { n: '総がかり', k: 'edo', sc: 'minyo', r: 69, bpm: 132, f: 'fest', ld: 'fue', ct: 'koto', bs: 'drive', kit: 'matsuri', seed: 1502 },
    work1:  { n: '職人の工房', k: 'edo', sc: 'hira', r: 67, bpm: 80, f: 'calm', ld: 'koto', ct: 'none', bs: 'calm', bi: 'koto', kit: 'shizuka', seed: 1601, v: 0.85 },
    kou1:   { n: '両替商', k: 'mix', sc: 'yo', r: 72, bpm: 108, f: 'walk', ld: 'p25', ct: 'arp', bs: 'oct', kit: 'mixDrive', seed: 1701 },
    kou2:   { n: '市の日', k: 'edo', sc: 'yo', r: 69, bpm: 112, f: 'fest', ld: 'shami', ct: 'fue', bs: 'tsun', kit: 'matsuri', seed: 1702, sw: 0.12 },
    rest1:  { n: 'ひとやすみ', k: 'edo', sc: 'yo', r: 74, bpm: 72, f: 'calm', ld: 'fue', ct: 'koto', bs: 'drone', bi: 'koto', kit: 'none', seed: 1801, v: 0.8 }
  };

  // ---------------- ジングル（手で書いた短い楽譜） ----------------
  //   v：[楽器, 主音からの半音, 楽譜, 大きさ]。楽譜の 0〜9・a〜z は音階の何番目の音か（0 が主音）、- はのばす、. は休み
  //   d：打楽器の列（KITS と同じ文字）
  const JINGLES = {
    win:     { n: '勝ち', bpm: 160, sc: 'majp', r: 72, v: [['p50', 0, '0.1.2.3.5---3-5-7-----------'], ['p25', -12, '2.3.4.5.7---5-7-9-----------', CT * 1.5], ['tri', -24, '0.......3.......5-----------', BASSV]], d: ['k...s...k.s.k...o...........'] },
    lose:    { n: '負け', bpm: 100, sc: 'miyako', r: 69, v: [['p25', 0, '4-3-2---1-0-------------'], ['p12', -12, '2-------1-------0-------', CT * 1.5], ['tri', -24, '0-------2-------0-------', BASSV]], d: [] },
    draw:    { n: '引き分け', bpm: 140, sc: 'majp', r: 72, v: [['p50', 0, '3.3.....3.2.3-------'], ['tri', -24, '0.......0...0-------', BASSV]], d: ['s.s.....s.s.s.......'] },
    clear:   { n: '撃破', bpm: 140, sc: 'yo', r: 74, v: [['p50', 0, '0.0.0.3---2.3.5-------4-3-5-------------'], ['p25', -12, '3.3.3.5---4.5.7-------6-5-5-------------', CT * 1.5], ['tri', -24, '0.......2.......3.......0---------------', BASSV]], d: ['k...s...k...s...k.k.s.s.k.......o.......'] },
    fanfare: { n: '完全制覇', bpm: 132, sc: 'major', r: 72, v: [['p50', 0, '4.4.4.7-----5.7-----6.7.9-------7---------------'], ['p25', 0, '2.2.2.4-----3.4-----4.4.7-------4---------------', CT * 1.4], ['tri', -24, '0.......0...3.......4...0-------0---------------', BASSV]], d: ['k.k.k.s-----k.s-----k.k.s.......o...............', 'h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.................'] },
    get:     { n: 'ゲット', bpm: 180, sc: 'majp', r: 72, v: [['p50', 0, '0.2.3.5-------'], ['p12', 12, '....0.2.3.5---', CT * 1.4]], d: [] }
  };

  // ---------------- 場面（場面 → 曲の一覧。jingle があれば、はじめに1回） ----------------
  const SCENES = {
    login: ['title1', 'title2'], mypage: ['town1', 'town2', 'town3'], gacha: ['gacha1', 'gacha2'], menu: ['menu1', 'menu2'],
    lobby: ['lobby1', 'lobby2'], pvp: ['pvp1', 'pvp2'], zukan: ['zukan1', 'zukan2'], quiz: ['quiz1', 'quiz2'],
    runnerTitle: ['run0'], runner: ['run1', 'run2'], stepupMenu: ['step0', 'sgx'],
    sugoroku1: ['sg1', 'sgx'], sugoroku2: ['sg2', 'sgx'], sugoroku3: ['sg3', 'sgx'], sugoroku4: ['sg4', 'sgx'],
    urasugoroku: ['ura1', 'ura2'], boss: ['boss1', 'boss2'], lastboss: ['boss3', 'boss2'], uraboss: ['uboss1', 'uboss2'],
    raid: ['raid1', 'raid2'], workshop: ['work1', 'zukan1'], koukan: ['kou1', 'kou2'], rest: ['rest1'],
    stepClear: { jingle: 'clear', list: ['rest1'] }, stepAllClear: { jingle: 'fanfare', list: ['rest1'] }, stepLose: { jingle: 'lose', list: ['rest1'] }
  };
  Object.keys(SCENES).forEach((k) => { if (Array.isArray(SCENES[k])) SCENES[k] = { list: SCENES[k] }; });

  // ---------------- ページ（ページ → 場面、または場面を見分ける係） ----------------
  //   目印（MARKS）：そのページにしかない id。上から順に見る
  const MARKS = [['app', 'view-login'], ['quizrunner', 'ovTitle'], ['koukan', 'crushModal'], ['gacha', 'costNormalView'],
    ['randombattle', 'lblPower'], ['privatebattle', 'opponentIdInput'], ['battle', 'battleMenu'], ['zukan', 'zukanGrid'],
    ['quiz', 'streakBar'], ['stepup', 'sugorokuBoard']];
  const PAGES = {
    app: watchApp, login: 'login', mypage: 'mypage', cardmake: 'workshop', raid: 'raid',
    gacha: 'gacha', koukan: 'koukan', battle: 'menu', randombattle: 'lobby', privatebattle: 'lobby', pvp: 'pvp',
    zukan: 'zukan', quiz: 'quiz', quizrunner: 'runnerTitle', stepup: watchStepUp, roguelike: watchStepUp
  };

  // ---------------- 曲を組み立てる（音を鳴らす前に1回だけ。毎回同じ曲） ----------------
  function rand(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  function semi(sc, x) { const L = sc.s.length; return 12 * Math.floor(x / L) + sc.s[((x % L) + L) % L]; }
  // 音階にない音を、近い音に寄せる（同じ高さ → 半音下 → 半音上 → 全音下 → 全音上）
  function toScale(sc, rel) {
    const pc = ((rel % 12) + 12) % 12, base = rel - pc;
    const d = [0, -1, 1, -2, 2].find((x) => sc.s.indexOf((pc + x + 12) % 12) >= 0);
    return base + pc + (d === undefined ? 0 : d);
  }
  function onsets(rh) {
    const a = [];
    for (let p = 0; p < rh.length; p++) {
      if (rh[p] !== 'x') continue;
      let l = 1;
      while (p + l < rh.length && rh[p + l] === '-') l++;
      a.push([p, l]);
    }
    return a;
  }
  const MOVES = [-3, -2, -2, -1, -1, -1, 0, 1, 1, 1, 2, 2, 3];
  function walk(R, n, start, lo, hi, center) {
    const out = [];
    let cur = start;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        let mv = pick(R, MOVES);
        if ((cur > center + 2 && mv > 0) || (cur < center - 2 && mv < 0)) { if (R() < 0.7) mv = -mv; }
        if (mv === 0 && i > 1 && out[i - 1] === out[i - 2]) mv = R() < 0.5 ? 1 : -1;
        let nx = cur + mv;
        if (nx > hi || nx < lo) nx = cur - mv;   // 端ではね返る（同じ高い音が続かないように）
        cur = Math.max(lo, Math.min(hi, nx));
      }
      out.push(cur);
    }
    return out;
  }
  // 強い拍は、低音の和音の音（根音・3度・5度）に寄せる
  function snap(sc, x, root) {
    const ok = (i) => [0, 3, 4, 7].indexOf((((semi(sc, i) - root) % 12) + 12) % 12) >= 0;
    return ok(x) ? x : ok(x + 1) ? x + 1 : ok(x - 1) ? x - 1 : x;
  }
  // from に近い「root と同じ音」の段（音階にないときは主音）
  function nearestDegree(sc, from, root) {
    const L = sc.s.length;
    let best = null;
    for (let x = from - L; x <= from + L; x++) {
      if ((((semi(sc, x) - root) % 12) + 12) % 12 === 0 && (best === null || Math.abs(x - from) < Math.abs(best - from))) best = x;
    }
    return best === null ? Math.round(from / L) * L : best;
  }

  // 旋律（4小節）：動機 → 少し変えた動機 → 新しい動機 → 主音（低音の音）へ下りて終わる
  function melody(R, d, sc, prog, upper) {
    const L = sc.s.length, lo = -2, hi = L + 3, center = Math.round(L * 0.6) + (upper ? 2 : 0);
    const clamp = (x) => Math.max(lo, Math.min(hi, x));
    const rh = RHY[d.f] || RHY.walk, cd = CAD[d.f] || CAD.walk;
    const oA = onsets(pick(R, rh)), oB = onsets(pick(R, rh)), oC = onsets(pick(R, cd));
    const mA = walk(R, oA.length, clamp(center + pick(R, [-1, 0, 0, 1])), lo, hi, center);
    const sh = pick(R, [1, -1, 2, -2, 1]);
    const mA2 = mA.map((x, i) => (i === 0 ? x : clamp(x + sh)));
    if (mA2.length > 2) mA2[mA2.length - 1] = clamp(mA2[mA2.length - 1] + pick(R, [-1, 1]));
    const mB = walk(R, oB.length, clamp(mA2[mA2.length - 1] + pick(R, [-1, 1])), lo, hi, center + 1);
    const last = mB.length ? mB[mB.length - 1] : center;
    const target = clamp(nearestDegree(sc, last, prog[3]));
    let dir = last >= target ? 1 : -1;
    if (target + 2 > hi) dir = -1; else if (target - 2 < lo) dir = 1;   // 端のときは、あいている側から近づく
    const mC = oC.map((o, i) => { const left = oC.length - 1 - i; return left >= 3 ? clamp(last + pick(R, [-1, 0, 1])) : clamp(target + dir * left); });
    const out = [];
    [[oA, mA], [oA, mA2], [oB, mB], [oC, mC]].forEach(([os, ms], bar) => {
      os.forEach(([p, l], i) => {
        let x = ms[i];
        if (bar < 3 && (p === 0 || p === 8)) x = clamp(snap(sc, x, prog[bar]));
        out.push([bar * 16 + p, x, l]);
      });
    });
    // 同じ音が3回つづいたら、3回目をとなりの音にずらす（いちばん最後の音はそのまま）
    for (let i = 2; i < out.length - 1; i++) {
      const x = out[i][1];
      if (x === out[i - 1][1] && x === out[i - 2][1]) out[i][1] = clamp(x + (x > center ? -1 : 1));
    }
    return out;
  }

  function section(R, d, sc, upper) {
    const fc = d.k !== 'edo', out = [];
    const prog = pick(R, PROG[sc.prog]).map((x) => toScale(sc, x));
    const add = (s, e) => { if (s >= 0 && s < 64) out.push([s, e]); };
    // 旋律
    const lead = melody(R, d, sc, prog, upper);
    const lv = LEAD * (d.v || 1) * GAIN[d.ld];
    lead.forEach(([s, x, l]) => add(s, { i: d.ld, m: d.r + semi(sc, x), l: l, v: lv * (s % 4 === 0 ? 1 : 0.82), L: 1 }));   // L：旋律の印（テスト用）
    // 合いの手
    const ct = d.ct || 'none';
    const edoBase = 47 + ((d.r - 47) % 12), fcBase = 40 + ((d.r - 40) % 12);
    if (ct === 'echo') lead.forEach(([s, x, l]) => add(s + 3, { i: 'p12', m: d.r + semi(sc, x), l: Math.min(l, 4), v: CT * 0.9 }));
    if (ct === 'harm') { const ci = d.ld === 'p50' ? 'p25' : 'p12'; lead.forEach(([s, x, l]) => add(s, { i: ci, m: d.r + semi(sc, x - 2), l: l, v: CT * 1.05 * GAIN[ci] })); }
    if (ct === 'arp') {
      const n = (d.f === 'drive' || d.f === 'tense' || d.f === 'epic') ? 1 : 2, ch = sc.arp;
      for (let bar = 0; bar < 4; bar++) for (let p = 0; p < 16; p += n) add(bar * 16 + p, { i: 'p12', m: d.r - 12 + toScale(sc, prog[bar] + ch[(p / n) % ch.length]), l: n, v: CT * 0.7 });
    }
    if (ct === 'koto') {
      const pos = d.f === 'calm' ? [0, 8] : [0, 4, 8, 12], up = [0, 7, 12, 7];
      for (let bar = 0; bar < 4; bar++) pos.forEach((p, i) => add(bar * 16 + p, { i: 'koto', m: edoBase + 12 + toScale(sc, prog[bar] + up[i % 4]), l: 4, v: CT * 1.2 }));
    }
    if (ct === 'fue') {
      for (let bar = 0; bar < 4; bar++) {
        let m = d.r + toScale(sc, prog[bar] + (bar % 2 ? 7 : 12));
        while (m > d.r + 10) m -= 12;
        while (m < d.r - 2) m += 12;
        add(bar * 16, { i: 'fue', m: m, l: 14, v: CT * 0.85 });
      }
    }
    // 低音
    const bi = d.bi || (fc ? 'tri' : 'shami'), base = fc ? fcBase : edoBase, pat = BASS[d.bs] || BASS.walk;
    for (let bar = 0; bar < 4; bar++) {
      onsets(pat.replace(/[ROF]/g, 'x')).forEach(([p, l]) => {
        const off = pat[p] === 'O' ? 12 : pat[p] === 'F' ? 7 : 0;
        add(bar * 16 + p, { i: bi, m: base + toScale(sc, prog[bar] + off), l: l, v: BASSV * GAIN[bi] * (p === 0 ? 1 : 0.85) });
      });
    }
    // 打楽器（ファミコン風は、ノイズが1つずつしか鳴らないように1列目を先に）
    const kit = KITS[d.kit] || KITS.none;
    for (let bar = 0; bar < 4; bar++) {
      const lanes = bar === 3 ? kit.f : kit.a;
      for (let p = 0; p < 16; p++) {
        const v = p === 0 ? 1 : p % 4 === 0 ? 0.85 : 0.7;
        const a = lanes[0][p], b = lanes[1][p];
        if (a !== '.') add(bar * 16 + p, { d: a, v: v });
        if (b !== '.' && (!fc || a === '.')) add(bar * 16 + p, { d: b, v: v });
      }
    }
    return out;
  }

  function buildTrack(id, d) {
    const sc = SCALES[d.sc], order = d.ord || 'AABA', secs = {}, ev = [];
    order.split('').forEach((ch, i) => {
      if (!secs[ch]) secs[ch] = section(rand((d.seed || 1) * 131 + ch.charCodeAt(0)), d, sc, ch !== 'A');
      secs[ch].forEach(([s, e]) => { const at = i * 64 + s; (ev[at] || (ev[at] = [])).push(e); });
    });
    return { id: id, n: d.n, dur: 60 / d.bpm / 4, len: order.length * 64, ev: ev, sw: d.sw || 0, loops: d.loops || 2 };
  }
  function buildJingle(id, j) {
    const sc = SCALES[j.sc], ev = [];
    let len = 0;
    const put = (at, e) => { (ev[at] || (ev[at] = [])).push(e); };
    j.v.forEach(([inst, off, pat, vv]) => {
      len = Math.max(len, pat.length);
      for (let p = 0; p < pat.length; p++) {
        const c = pat[p];
        if (c === '-' || c === '.') continue;
        let l = 1;
        while (p + l < pat.length && pat[p + l] === '-') l++;
        put(p, { i: inst, m: j.r + off + semi(sc, parseInt(c, 36)), l: l, v: (vv || LEAD) * (GAIN[inst] || 1) });
      }
    });
    (j.d || []).forEach((lane) => {
      len = Math.max(len, lane.length);
      for (let p = 0; p < lane.length; p++) if (lane[p] !== '.' && lane[p] !== '-') put(p, { d: lane[p], v: p === 0 ? 1 : 0.8 });
    });
    return { id: id, n: j.n, dur: 60 / j.bpm / 4, len: len + 2, ev: ev, sw: 0, loops: 1, jingle: true };
  }
  const built = {};
  function compile(id) {
    if (!built[id]) {
      if (TRACKS[id]) built[id] = buildTrack(id, TRACKS[id]);
      else if (JINGLES[id]) built[id] = buildJingle(id, JINGLES[id]);
      else return null;
    }
    return built[id];
  }

  // ---------------- 音を鳴らす部品 ----------------
  let ac = null, master = null, duckG = null, NB = null, lfoG = null;
  const W = {};
  function waveOf(re, im) { return ac.createPeriodicWave(new Float32Array(re), new Float32Array(im)); }
  function pulseWave(duty) {   // 矩形波（50%・25%・12.5%）
    const re = [0], im = [0];
    for (let n = 1; n < 32; n++) { re.push(Math.sin(2 * Math.PI * n * duty) / (Math.PI * n)); im.push((1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n)); }
    return waveOf(re, im);
  }
  function harmonics(list) { return waveOf(list.map(() => 0), list); }
  function ensureCtx() {
    if (ac) return ac;
    const C = global.AudioContext || global.webkitAudioContext;
    if (!C) return null;
    try { ac = new C({ latencyHint: 'playback' }); } catch (e) { try { ac = new C(); } catch (e2) { ac = null; return null; } }
    master = ac.createGain(); master.gain.value = P.on ? P.vol * MASTER : 0; master.connect(ac.destination);
    duckG = ac.createGain(); duckG.connect(master);
    W.p50 = pulseWave(0.5); W.p25 = pulseWave(0.25); W.p12 = pulseWave(0.125);
    const sh = [0]; for (let n = 1; n < 24; n++) sh.push((n === 2 || n === 3 ? 1.3 : 1) / n);
    W.shami = harmonics(sh);                                       // 三味線：明るい弦（すぐにこもらせて、はじく音に）
    W.fue = harmonics([0, 1, 0.18, 0.06, 0.03]);                   // 篠笛：ほとんどまるい音
    W.koto = harmonics([0, 1, 0.5, 0.33, 0.15, 0.1, 0.05, 0.03]);  // 琴
    NB = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);          // ノイズは1秒分を1回だけ作る
    const nd = NB.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const lfo = ac.createOscillator(); lfo.frequency.value = 5.2;  // 笛のゆれ（1つを使い回す）
    lfoG = ac.createGain(); lfoG.gain.value = 4;
    lfo.connect(lfoG); lfo.start();
    ac.onstatechange = function () { if (ac.state === 'running') kick(); updateUi(); };
    return ac;
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function voice(e, t, sec, out) {
    const f = hz(e.m), o = ac.createOscillator(), g = ac.createGain(), v = e.v;
    let stopAt;
    if (e.i === 'shami') {
      o.setPeriodicWave(W.shami);
      o.frequency.setValueAtTime(f * 1.015, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035);   // はじいた瞬間に少し高い（さわり）
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(Math.min(9000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), t + 0.22);
      const dk = Math.min(Math.max(sec, 0.1) + 0.12, 0.65);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dk);
      o.connect(lp); lp.connect(g); stopAt = t + dk + 0.02;
    } else if (e.i === 'koto') {
      o.setPeriodicWave(W.koto); o.frequency.setValueAtTime(f, t);
      const dk = Math.min(Math.max(sec, 0.25) + 0.5, 1.4);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0008, t + dk);
      o.connect(g); stopAt = t + dk + 0.02;
    } else if (e.i === 'fue') {
      o.setPeriodicWave(W.fue);
      o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);    // 下からすり上げる
      if (sec > 0.3) { lfoG.connect(o.frequency); o.onended = function () { try { lfoG.disconnect(o.frequency); } catch (x) {} }; }
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.05);
      g.gain.setValueAtTime(v, t + Math.max(0.06, sec - 0.06)); g.gain.linearRampToValueAtTime(0.0001, t + sec + 0.04);
      o.connect(g); stopAt = t + sec + 0.06;
    } else {   // p50・p25・p12（矩形波）・tri（三角波）
      if (e.i === 'tri') o.type = 'triangle'; else o.setPeriodicWave(W[e.i] || W.p50);
      o.frequency.setValueAtTime(f, t);
      const gate = Math.max(0.03, sec * (e.i === 'tri' ? 0.95 : 0.86));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004);
      if (e.i !== 'tri') g.gain.setTargetAtTime(v * 0.72, t + 0.03, 0.09);
      g.gain.setTargetAtTime(0.0001, t + gate, 0.012);
      o.connect(g); stopAt = t + gate + 0.08;
    }
    g.connect(out); o.start(t); o.stop(stopAt);
  }
  function nz(t, len, v, type, fq, out) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = NB; fl.type = type; fl.frequency.value = fq;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5, len + 0.03);
  }
  function sweep(type, f0, f1, t, len, v, out) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.8);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  function drum(ch, t, v, out) {
    switch (ch) {
      case 'k': nz(t, 0.08, v * 1.4, 'lowpass', 420, out); break;
      case 'K': nz(t, 0.22, v * 1.8, 'lowpass', 230, out); break;
      case 's': nz(t, 0.1, v * 0.5, 'bandpass', 1800, out); break;
      case 'h': nz(t, 0.03, v * 0.09, 'highpass', 7000, out); break;
      case 'o': nz(t, 0.16, v * 0.07, 'highpass', 5500, out); break;
      case 'C': nz(t, 0.018, v * 0.16, 'highpass', 3200, out); break;
      case 'D': sweep('sine', 118, 48, t, 0.45, v * 0.6, out); nz(t, 0.05, v * 0.2, 'lowpass', 600, out); break;      // 大太鼓
      case 'd': sweep('sine', 330, 230, t, 0.12, v * 0.26, out); nz(t, 0.025, v * 0.1, 'bandpass', 2600, out); break; // 締太鼓
      case 'c': sweep('triangle', 2350, 2350, t, 0.04, v * 0.2, out); sweep('triangle', 3500, 3500, t, 0.025, v * 0.1, out); break;   // 拍子木
      case 'g': sweep('sine', 1180, 1180, t, 0.28, v * 0.08, out); sweep('sine', 3050, 3050, t, 0.16, v * 0.05, out); break;         // 鉦
    }
  }

  // ---------------- 予約して鳴らす ----------------
  function load(k) { try { return global.localStorage ? global.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function store(k, v) { try { if (global.localStorage) global.localStorage.setItem(k, v); } catch (e) {} }
  const P = {
    on: (function () { const v = load(KEY_ON); return v === null ? DEFAULT_ON : v === 'on'; })(),
    vol: (function () { const s = load(KEY_VOL), v = Number(s); return s !== null && s !== '' && isFinite(v) ? Math.max(0, Math.min(1, v / 100)) : DEFAULT_VOL; })(),
    page: '', base: '', scene: '', list: [], li: 0, song: null, curId: '', once: false, loops: 0, step: 0, nextT: 0,
    timer: 0, tempo: 1, tg: null, jDone: false, jToken: 0
  };
  const running = () => !!(ac && ac.state === 'running');
  const hidden = () => !!(global.document && global.document.hidden);

  function startTimer() { if (!P.timer) P.timer = setInterval(tick, TICK_MS); }
  function stopTimer() { if (P.timer) { clearInterval(P.timer); P.timer = 0; } }
  function fadeOut() {
    if (!P.tg) return;
    const g = P.tg, t = ac.currentTime;
    P.tg = null;
    try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.45); } catch (e) {}
    setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 1000);
  }
  function startTrack(id, once, seamless) {
    const song = compile(id);
    if (!song || !ac) return;
    let at = ac.currentTime + 0.08;
    if (seamless && P.tg && P.nextT > ac.currentTime) at = P.nextT + song.dur * 4;   // 同じ場面の次の曲：1拍あけてつなぐ
    else {
      fadeOut();
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.linearRampToValueAtTime(1, ac.currentTime + 0.3);
      g.connect(duckG); P.tg = g;
    }
    P.song = song; P.curId = id; P.once = !!once; P.loops = song.loops; P.step = 0; P.nextT = at;
    startTimer(); tick(); updateUi();
  }
  function startScene() {
    const sc = SCENES[P.scene];
    if (!sc || !running()) return;
    if (sc.jingle && !P.jDone) { P.jDone = true; startTrack(sc.jingle, true); return; }
    const list = sc.list || [];
    if (!list.length) { fadeOut(); P.song = null; P.curId = ''; updateUi(); return; }
    let i = Math.floor(Math.random() * list.length);   // はじめの曲はランダム（そのあとは順番）
    if (list.length > 1 && list[i] === P.curId) i = (i + 1) % list.length;
    P.list = list; P.li = i;
    startTrack(list[i], false);
  }
  function tick() {
    if (!running() || !P.song || !P.tg) return;
    const now = ac.currentTime;
    if (P.nextT < now - 0.25) P.nextT = now + 0.05;   // 遅れたら（重い画面・タブの切りかえ）、とばして今から
    while (P.nextT < now + LOOKAHEAD) {
      const song = P.song, dur = song.dur / P.tempo;
      if (P.step >= song.len) {
        if (--P.loops > 0) { P.step = 0; continue; }
        if (P.once) { afterJingle(Math.max(0, P.nextT - now)); return; }
        if (P.list.length > 1) { P.li = (P.li + 1) % P.list.length; startTrack(P.list[P.li], false, true); return; }
        P.loops = song.loops; P.step = 0; continue;
      }
      const t = P.nextT + ((P.step & 1) ? song.sw * dur : 0), evs = song.ev[P.step];
      if (evs) {
        for (let k = 0; k < evs.length; k++) {
          const e = evs[k];
          try { if (e.d) drum(e.d, t, e.v, P.tg); else voice(e, t, e.l * dur, P.tg); } catch (x) {}
        }
      }
      P.step++; P.nextT += dur;
    }
  }
  function afterJingle(delay) {
    P.song = null; P.curId = '';
    const tk = ++P.jToken;
    setTimeout(function () { if (tk === P.jToken && !P.song) startScene(); }, delay * 1000 + 250);
  }
  // 鳴らせるなら鳴らす（オン・タップのあと・ページがまた見えたとき）
  function kick() {
    if (!P.on || !running() || hidden()) return;
    startTimer();
    if (!P.song && P.scene) startScene();
  }
  // 最初のタップ：ブラウザは、タップの中でしか音を出させてくれない（iPad は無音を1つ鳴らすと確実）
  function unlock() {
    if (!P.on || hidden()) return;
    hookFx();
    if (!ensureCtx()) return;
    if (ac.state !== 'running') { try { const p = ac.resume(); if (p && p.then) p.then(kick, function () {}); } catch (e) {} }
    try { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); } catch (e) {}
    kick();
  }
  let armed = false;
  function arm() {
    if (armed || !global.document) return;
    armed = true;
    const on = function (e) {
      const t = e && e.target;
      if (t && t.closest && t.closest('.kbgm')) return;   // 左下のボタンは、ボタンの中で決める（🔊 を押して消すときに一瞬鳴らない）
      if (P.on && !running()) unlock();
    };
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) { global.document.addEventListener(ev, on, { capture: true, passive: true }); });
    global.document.addEventListener('visibilitychange', function () {
      if (!ac) return;
      if (hidden()) { stopTimer(); if (ac.state === 'running') ac.suspend(); }   // 隠れたら止める（音も予約も）
      else if (P.on) { try { const p = ac.resume(); if (p && p.then) p.then(kick, function () {}); } catch (e) {} }
    });
  }

  // ---------------- 効果音（fx.js の演出）のあいだは下げる ----------------
  let duckN = 0, deepN = 0, duckUntil = 0;
  function setDuck() {
    if (!duckG) return;
    const lvl = deepN > 0 ? 0.0001 : (duckN > 0 || Date.now() < duckUntil) ? DUCK : 1;
    try { duckG.gain.setTargetAtTime(lvl, ac.currentTime, lvl < 1 ? 0.05 : 0.3); } catch (e) {}
  }
  function fxBegin(deep) {
    if (deep) deepN++; else duckN++;
    setDuck();
    let done = false;
    const end = function () { if (done) return; done = true; if (deep) deepN--; else duckN--; setDuck(); };
    setTimeout(end, 45000);   // 演出が終わらなくても、45秒でもどす
    return end;
  }
  const FX_NAMES = ['janken', 'dice', 'diceDuel', 'gachaOpen', 'treasure', 'multiply', 'roulette', 'misfortune', 'bossIntro', 'allOut', 'awaken', 'raidStage', 'attackFx'];
  function hookFx() {
    const F = global.KanjiFX;
    if (!F || F.__bgm) return;
    FX_NAMES.forEach(function (name) {
      const fn = F[name];
      if (typeof fn !== 'function') return;
      F[name] = function () {
        const end = fxBegin(name === 'bossIntro');   // ボス登場のあいだは音楽を止めて静かに
        let r;
        try { r = fn.apply(this, arguments); } catch (e) { end(); throw e; }
        if (r && typeof r.then === 'function') r.then(end, end); else end();
        return r;
      };
    });
    try { F.__bgm = true; } catch (e) {}
  }

  // ---------------- 左下のボタン（🔊/🔇 と 🎚） ----------------
  const CSS = '.kbgm{position:fixed;left:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:9990;display:flex;gap:8px;' +
    'font-family:"DotGothic16","Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}' +
    '.kbgm .kbgm-b{-webkit-appearance:none;appearance:none;margin:4px;width:48px;height:48px;padding:0;border:0;border-radius:0;background:#1d2b53;color:#fff1e8;' +
    'font:inherit;font-size:22px;line-height:48px;text-align:center;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;' +
    'box-shadow:0 4px 0 #000,-4px 0 0 #000,4px 0 0 #000,0 -4px 0 #000}' +
    '.kbgm .kbgm-b:active{transform:translateY(3px)}.kbgm .kbgm-b.off{background:#5f574f}.kbgm .kbgm-b:focus-visible{outline:3px solid #ffec27;outline-offset:6px}' +
    '.kbgm .kbgm-p{position:absolute;left:4px;bottom:68px;width:240px;max-width:calc(100vw - 48px);box-sizing:border-box;padding:12px;background:#1d2b53;color:#fff1e8;font-size:15px;line-height:1.5;' +
    'box-shadow:0 4px 0 #000,-4px 0 0 #000,4px 0 0 #000,0 -4px 0 #000}' +
    '.kbgm .kbgm-p[hidden]{display:none}.kbgm .kbgm-t{color:#ffec27;margin-bottom:4px}.kbgm .kbgm-s{font-size:12px;color:#c2c3c7}' +
    '.kbgm .kbgm-r{display:flex;align-items:center;gap:8px;margin-top:10px}.kbgm .kbgm-r input{flex:1;min-width:0;height:28px;accent-color:#ffec27}' +
    '.kbgm .kbgm-c{flex-direction:column;align-items:stretch;gap:6px}' +
    '.kbgm .kbgm-p .kbgm-b{display:block;width:auto;height:40px;line-height:40px;font-size:15px;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    'body.playing .kbgm.kbgm-qr{display:none}@media print{.kbgm{display:none}}';
  let ui = null;
  function el(tag, cls, text) { const e = global.document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function buildUi() {
    const doc = global.document;
    if (ui || !doc || !doc.body) return;
    const st = el('style'); st.textContent = CSS; (doc.head || doc.body).appendChild(st);
    const box = el('div', 'kbgm');
    const btn = el('button', 'kbgm-b'); btn.type = 'button';
    const more = el('button', 'kbgm-b', '🎚'); more.type = 'button'; more.setAttribute('aria-label', '音量と曲'); more.setAttribute('aria-expanded', 'false');
    const pan = el('div', 'kbgm-p'); pan.hidden = true; pan.setAttribute('role', 'dialog'); pan.setAttribute('aria-label', '音楽');
    const title = el('div', 'kbgm-t'), sub = el('div', 'kbgm-s');
    const r1 = el('label', 'kbgm-r'); r1.appendChild(el('span', '', '音量'));
    const range = el('input'); range.type = 'range'; range.min = '0'; range.max = '100'; range.step = '5'; range.setAttribute('aria-label', '音楽の音量');
    r1.appendChild(range);
    const r2 = el('div', 'kbgm-r kbgm-c');
    const nextB = el('button', 'kbgm-b', '⏭ つぎの曲'); nextB.type = 'button';
    const sfxB = el('button', 'kbgm-b'); sfxB.type = 'button';
    r2.appendChild(nextB); r2.appendChild(sfxB);
    pan.appendChild(title); pan.appendChild(sub); pan.appendChild(r1); pan.appendChild(r2);
    box.appendChild(btn); box.appendChild(more); box.appendChild(pan);
    if (P.page === 'quizrunner') box.classList.add('kbgm-qr');   // クイズ・ランナーは、走っている間は上の帯の 🎵 を使う
    doc.body.appendChild(box);
    btn.addEventListener('click', function () { setOn(!P.on); });
    more.addEventListener('click', function () { if (P.on && !running()) unlock(); pan.hidden = !pan.hidden; more.setAttribute('aria-expanded', String(!pan.hidden)); updateUi(); });
    range.addEventListener('input', function () { setVolume(Number(range.value) / 100); });
    nextB.addEventListener('click', function () { if (!P.on) setOn(true); next(); });
    sfxB.addEventListener('click', function () { const F = global.KanjiFX; if (F && F.setSound) { F.setSound(!F.soundOn()); updateUi(); } });
    doc.addEventListener('pointerdown', function (e) { if (!pan.hidden && !box.contains(e.target)) { pan.hidden = true; more.setAttribute('aria-expanded', 'false'); } }, true);
    ui = { btn: btn, pan: pan, title: title, sub: sub, range: range, sfxB: sfxB };
    updateUi();
  }
  function updateUi() {
    if (!ui) return;
    ui.btn.textContent = P.on ? '🔊' : '🔇';
    ui.btn.classList.toggle('off', !P.on);
    ui.btn.setAttribute('aria-label', P.on ? '音楽をとめる' : '音楽をならす');
    ui.btn.setAttribute('aria-pressed', String(P.on));
    if (ui.pan.hidden) return;
    const t = P.curId && TRACKS[P.curId], sc = t && SCALES[t.sc];
    ui.title.textContent = !P.on ? '♪ 音楽はオフ（🔇をタップ）' : t ? '♪ ' + t.n : running() ? '♪ …' : '♪ 画面をタップすると鳴ります';
    ui.sub.textContent = t ? ({ edo: '江戸', fc: 'ファミコン', mix: '江戸×ファミコン' })[t.k] + '・' + sc.name + '・' + t.bpm : '';
    ui.range.value = String(Math.round(P.vol * 100));
    const F = global.KanjiFX;
    ui.sfxB.hidden = !(F && F.setSound && F.soundOn);
    if (!ui.sfxB.hidden) ui.sfxB.textContent = '効果音 ' + (F.soundOn() ? 'オン' : 'オフ');
  }

  // ---------------- 場面を見分ける係 ----------------
  let watcher = null;
  function observe(fn, targets) {
    if (!global.MutationObserver) return;
    let queued = false;
    const ob = new global.MutationObserver(function () { if (queued) return; queued = true; setTimeout(function () { queued = false; fn(); }, 30); });
    targets.forEach(function (t) { if (t) ob.observe(t, { attributes: true, attributeFilter: ['class'] }); });
    watcher = ob;
  }
  // App（ログイン・マイページ・カードを作る・レイド・管理画面）：app.js が body に view-○○ をつける
  function watchApp() {
    const map = { login: 'login', mypage: 'mypage', cardmake: 'workshop', admin: 'workshop', raid: 'raid', koukan: 'koukan' };
    const look = function () { const m = /(?:^|\s)view-([a-z]+)/.exec(global.document.body.className || ''); if (m && map[m[1]]) setBase(map[m[1]]); };
    observe(look, [global.document.body]);
    look();
  }
  // ステップアップ：画面（道えらび・デッキ・すごろく・ボス戦）・裏（body.theme-ura）・階（gameState.floor）・結果の小窓
  function watchStepUp() {
    const doc = global.document, $ = function (id) { return doc.getElementById(id); };
    const floor = function () { try { return (typeof gameState !== 'undefined' && gameState && Number(gameState.floor)) || 1; } catch (e) { return 1; } };   // eslint-disable-line no-undef
    const look = function () {
      const ura = doc.body.classList.contains('theme-ura'), cur = doc.querySelector('.screen.show'), id = cur ? cur.id : '', f = floor();
      const res = $('resultModal'), rt = $('resultTitle');
      if (res && res.classList.contains('show')) {
        const s = rt ? rt.textContent : '';
        setBase(s.indexOf('敗北') >= 0 ? 'stepLose' : s.indexOf('完全制覇') >= 0 ? 'stepAllClear' : 'stepClear');
      } else if (id === 'bossBattleScreen') setBase(ura ? 'uraboss' : f >= 9 ? 'lastboss' : 'boss');
      else if (id === 'sugorokuScreen') setBase(ura ? 'urasugoroku' : 'sugoroku' + (f <= 3 ? 1 : f <= 6 ? 2 : f <= 8 ? 3 : 4));
      else setBase('stepupMenu');
    };
    observe(look, [doc.body, $('resultModal')].concat(Array.prototype.slice.call(doc.querySelectorAll('.screen'))));
    look();
  }

  // ---------------- 外から使う ----------------
  function setBase(scene) { P.base = scene; play(scene); }
  function play(scene, force) {
    if (!SCENES[scene]) return false;
    if (scene === P.scene && !force) return true;
    P.scene = scene; P.jDone = false; P.jToken++;
    if (running() && P.on) startScene();
    else { P.song = null; P.curId = ''; }
    updateUi();
    return true;
  }
  function jingle(name, then) {
    if (!JINGLES[name]) return false;
    P.scene = (then && SCENES[then]) ? then : (P.base || P.scene);
    P.jDone = true; P.jToken++;
    if (running() && P.on) startTrack(name, true); else { P.song = null; P.curId = ''; }
    return true;
  }
  function next() {
    if (!running()) return;
    if (P.list.length > 1 && !P.once) { P.li = (P.li + 1) % P.list.length; startTrack(P.list[P.li], false); }
    else if (P.curId) startTrack(P.curId, P.once);
  }
  function setOn(on) {
    P.on = !!on;
    store(KEY_ON, P.on ? 'on' : 'off');
    if (P.on) {
      unlock();
      if (master) master.gain.setTargetAtTime(P.vol * MASTER, ac.currentTime, 0.05);
    } else if (ac) {
      master.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      stopTimer();
      setTimeout(function () { if (!P.on && ac.state === 'running') ac.suspend(); }, 300);   // オフのあいだは音の部品も止める
    }
    updateUi();
    return P.on;
  }
  function setVolume(v) {
    P.vol = Math.max(0, Math.min(1, Number(v) || 0));
    store(KEY_VOL, String(Math.round(P.vol * 100)));
    if (master && P.on) master.gain.setTargetAtTime(P.vol * MASTER, ac.currentTime, 0.05);
    return P.vol;
  }
  function start(page) {
    page = String(page || '').toLowerCase();
    const p = PAGES[page];
    if (!p || !global.document || !global.document.body) return false;
    if (watcher) { watcher.disconnect(); watcher = null; }
    P.page = page;
    buildUi(); arm(); hookFx();
    if (typeof p === 'function') p(); else setBase(p);
    return true;
  }
  function auto() {
    const doc = global.document;
    if (P.page || !doc || !doc.body) return P.page;
    let page = doc.body.getAttribute('data-bgm') || '';
    if (!page) for (let i = 0; i < MARKS.length; i++) { if (doc.getElementById(MARKS[i][1])) { page = MARKS[i][0]; break; } }
    if (page) start(page);
    return page;
  }

  global.KanjiBgm = {
    version: VERSION,
    start: start, auto: auto, play: play, jingle: jingle, next: next,
    home: function () { return P.base ? play(P.base) : false; },
    setOn: setOn, toggle: function () { return setOn(!P.on); }, isOn: function () { return P.on; },
    setVolume: setVolume, volume: function () { return P.vol; },
    duck: function (ms) { duckUntil = Date.now() + (ms || 600); setDuck(); setTimeout(setDuck, (ms || 600) + 30); },
    tempo: function (x) { P.tempo = Math.max(0.5, Math.min(1.5, Number(x) || 1)); return P.tempo; },
    state: function () {
      return { version: VERSION, page: P.page, base: P.base, scene: P.scene, track: P.curId, trackName: P.curId ? (TRACKS[P.curId] || JINGLES[P.curId]).n : '',
        audio: ac ? ac.state : 'none', on: P.on, volume: P.vol, tempo: P.tempo, ducked: duckN + deepN > 0 };
    },
    debug: { compile: compile, TRACKS: TRACKS, JINGLES: JINGLES, SCENES: SCENES, SCALES: SCALES, PAGES: PAGES, MARKS: MARKS }
  };

  // 読みこんだら、ページを見分けて始める（鳴るのは最初のタップのあと）
  if (global.document && !global.KANJI_BGM_MANUAL) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', auto);
    else setTimeout(auto, 0);
  }
})(typeof window !== 'undefined' ? window : this);
