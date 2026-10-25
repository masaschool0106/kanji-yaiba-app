# 漢字の刃（画面のプログラムと素材）

このリポジトリは GitHub Pages で公開し、漢字の刃（GAS）の外枠 `App.html` から読み込まれます。
**個人情報・スプレッドシートのID・クイズの正解・ガチャの確率は置かないでください。**（公開リポジトリは誰でも見られます）

| ファイル | 中身 |
|---|---|
| `app.js` | 画面の動き（ログイン・マイページなど） |
| `app.css` | 見た目 |
| `assets/img/` | 新しく作る画像 |
| `assets/sound/` | 効果音 |
| `index.html` | このURLを直接開いた人への案内だけ（ゲームは動かない） |
| `robots.txt` | 検索エンジンに載せない |

## はじめての公開

1. GitHub で新しいリポジトリを作る（例：`kanji-yaiba-app`、**Public**）。
2. 「Add file」→「Upload files」で、このフォルダの中身をすべてドラッグして「Commit changes」。
3. 「Settings」→「Pages」→ Source を「Deploy from a branch」、Branch を「main」「/ (root)」にして「Save」。
4. 1〜2分待って `https://（ユーザー名）.github.io/kanji-yaiba-app/app.js` が開けば公開できています。
5. GAS のエディタ →「プロジェクトの設定」→「スクリプト プロパティ」に次の2つを追加。
   - `ASSET_BASE_URL` … `https://（ユーザー名）.github.io/kanji-yaiba-app/`
   - `ASSET_VERSION` … `1`

## 更新するとき

1. GitHub で `app.js` などを編集（またはアップロード）して「Commit changes」。
2. 「Actions」タブで緑のチェックが付くまで待つ（1〜2分）。
3. GAS のスクリプト プロパティ `ASSET_VERSION` の数字を1つ上げる。
   - 上げると、次に開いたときから新しいファイルになります。
   - 上げ忘れても、最大10分ほどで新しいファイルに切り替わります（GitHub Pages が10分間ファイルを覚えているため）。

## カード・偉人の画像

画像は今のリポジトリ（`kanji-yaiba-2025`、`kannji-yaiba-2026`、`kannji-sugoroku`）にあるまま使います。
（シートにある `-` は `kanji-yaiba-2025` の古い名前です。新しい画面では自動で新しい名前に置きかえます）
それぞれのリポジトリで「Settings」→「Pages」を上と同じように有効にしてください。
新しい画面では、シートの画像URLを自動で GitHub Pages のURLに置きかえて表示します（シートは書き換えません）。
