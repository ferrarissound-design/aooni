# 鴉羽邸 ― 大首の館 ―

深夜の洋館に閉じ込められた主人公が、巨大な顔の怪物「大首」から逃げながら謎を解き、はぐれた友人と脱出する2D見下ろし型ホラーアドベンチャー（プレイ時間 20〜40分）。

- TypeScript + Phaser 3 + Vite
- グラフィックはすべてCanvasで生成したオリジナルのドット絵、サウンドはWeb Audio APIで合成（外部素材なし）
- PCブラウザ / iPhone / iPad 対応（タッチ操作UIあり）
- セーブは localStorage（チェックサム＋バックアップ、鍵の消失などは読み込み時に自動修復）

## 遊び方

`npm run build` のあとは、`dist/index.html` をダブルクリックして直接開いても動きます（サーバー不要）。
公開する場合は `dist/` の中身をそのまま静的ホスティングに置いてください。リポジトリ直下の `index.html`（ソース）をそのまま配信しても動きません（TypeScriptがブラウザで実行できず、画面が真っ白になります）。

```bash
npm install
npm run dev      # 開発サーバ
npm run build    # 本番ビルド（dist/）
```

| | PC | スマホ / タブレット |
|---|---|---|
| 移動 | WASD / 矢印 | 画面左をドラッグ（仮想スティック） |
| 走る | Shift | 「走る」ボタン |
| 調べる | E / Enter / Space | 「調べる」ボタン |
| メニュー | Esc | 「MENU」ボタン |

## テスト

```bash
npm run build && npx vite preview --port 4173 &
npm run test:e2e     # 最初から脱出までの自動プレイテスト
npm run test:mobile  # iPhoneサイズでのタッチ操作テスト
```

設計は `docs/DESIGN.md`、進捗は `PROGRESS.md` を参照。
