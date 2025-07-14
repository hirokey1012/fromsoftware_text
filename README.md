# FromSoftware Text Extractor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

**FromSoftware Text Extractor** は、FromSoftwareゲームWikiから味わい深いフレーバーテキストやアイテム説明を抽出するための高性能Webスクレイパーです。

## 🎮 対応ゲーム

- **エルデンリング** (Elden Ring)
- **ダークソウル** (Dark Souls)
- **ダークソウル2** (Dark Souls II)
- **ダークソウル3** (Dark Souls III)
- **ブラッドボーン** (Bloodborne)
- **SEKIRO** (Sekiro: Shadows Die Twice)

## 🚀 クイックスタート

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/hirokey1012/fromsoftware_text.git
cd fromsoftware_text

# 依存関係をインストール
npm install
```

### 基本的な使い方

```bash
# デフォルト（エルデンリング）
npm start

# 特定のゲーム
npm run scrape:eldenring
npm run scrape:darksouls
npm run scrape:darksouls2
npm run scrape:darksouls3
npm run scrape:bloodborne
npm run scrape:sekiro

# カスタムURL
node scraper.js https://kamikouryaku.net/[game]/
```

## 📁 出力形式

### JSON形式
```json
[
  {
    "game": "エルデンリング",
    "name": "ルーンの弧",
    "url": "https://kamikouryaku.net/eldenring/?...",
    "flavorText": "エルデンリングが砕けた破片\\n使用により、装備した大ルーンの恩恵をもたらす"
  }
]
```

### CSV形式
```csv
ゲーム,アイテム名,URL,フレーバーテキスト
"エルデンリング","ルーンの弧","https://kamikouryaku.net/eldenring/?...","エルデンリングが砕けた破片..."
```

## 🔧 主な機能

- **多ゲーム対応**: 複数のFromSoftwareタイトルをサポート
- **自動ゲーム検出**: URLから自動的にゲーム名を判定
- **インテリジェントフィルタリング**: Wiki編集機能や攻略解説を自動除外
- **レジューム機能**: 中断されたスクレイピングを再開可能
- **リトライ機能**: ネットワークエラー時の自動リトライ
- **進捗表示**: リアルタイムの進捗状況表示
- **Web UI**: 結果を美しく表示するビューワー

## 🎯 技術仕様

### 依存関係
- **Node.js**: >= 16.0.0
- **axios**: HTTP リクエスト
- **cheerio**: HTML パース
- **fs-extra**: ファイル操作
- **iconv-lite**: 文字エンコーディング

### アーキテクチャ
- **FromSoftwareFlavorTextScraper**: メインスクレイパークラス
- **動的ゲーム検出**: URL解析によるゲーム判定
- **バッチ処理**: 効率的な大量データ処理
- **レート制限**: サーバーへの負荷を配慮

## 🎨 Webビューワー

`viewer.html`を開くことで、抽出したJSONデータを美しく表示できます。

### 機能
- 📊 リアルタイム統計情報
- 🔍 高速検索・フィルタリング
- 📱 レスポンシブデザイン
- 🎮 ゲーム名自動表示

## 📊 データ構造

各アイテムには以下の情報が含まれます：

- **game**: ゲーム名
- **name**: アイテム名
- **url**: 元のURL
- **flavorText**: フレーバーテキスト

## 🤝 貢献

プルリクエストやイシューは大歓迎です！

## 📄 ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照してください。

## ⚠️ 注意事項

このツールは教育・研究目的で作成されています。使用時は対象サイトの利用規約を遵守し、サーバーに過度な負荷をかけないよう配慮してください。

---

<p align="center">
  <strong>Made with ❤️ for FromSoftware fans</strong>
</p>
