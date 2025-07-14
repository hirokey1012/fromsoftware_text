import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import path from 'path';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

class FromSoftwareScraper {
    constructor() {
        this.results = [];
        this.processedItems = new Set();
        this.delay = 2000; // 2秒待機（安全性重視）
        this.progressFile = 'fromsoft_progress.csv';
        this.outputFile = 'fromsoft_flavor_texts.csv';
        this.maxRetries = 3;
        this.retryDelay = 5000; // 失敗時は5秒待機
        this.requestCount = 0;
        this.startTime = Date.now();
        
        this.games = {
            'demons-souls': {
                name: 'デモンズソウル',
                type: 'seesaa',
                categoryUrl: 'https://seesaawiki.jp/fromsoft_flavor-text/d/Demon%27s%a5%a2%a5%a4%a5%c6%a5%e0%bc%ef%ce%e0%ca%cc%cd%f7'
            },
            'dark-souls-1': {
                name: 'ダークソウル1',
                type: 'seesaa',
                categoryUrl: 'https://seesaawiki.jp/fromsoft_flavor-text/d/DSR%a5%a2%a5%a4%a5%c6%a5%e0%bc%ef%ce%e0%ca%cc%cd%f7'
            },
            'dark-souls-3': {
                name: 'ダークソウル3',
                type: 'seesaa',
                categoryUrl: 'https://seesaawiki.jp/fromsoft_flavor-text/d/DS3%a5%a2%a5%a4%a5%c6%a5%e0%bc%ef%ce%e0%ca%cc%cd%f7'
            },
            'bloodborne': {
                name: 'ブラッドボーン',
                type: 'swiki',
                categoryUrl: 'https://bloodborne.swiki.jp/index.php?%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0'
            },
            'elden-ring': {
                name: 'エルデンリング',
                type: 'kamikouryaku',
                baseUrl: 'https://kamikouryaku.net/eldenring/',
                categories: ['道具', 'アイテム製作素材', '強化素材', '鈴玉', '貴重品', '絵画']
            }
        };
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchPage(url, retryCount = 0) {
        try {
            // レート制限を考慮した動的待機時間
            const dynamicDelay = this.delay + (this.requestCount % 10) * 200; // リクエスト数に応じて待機時間を微調整
            await this.sleep(dynamicDelay);
            
            this.requestCount++;
            console.log(`  📡 リクエスト #${this.requestCount} (${retryCount > 0 ? `retry ${retryCount}` : 'initial'})`);
            
            // エンコーディング対応のため responseTypeを指定
            const response = await axios.get(url, {
                timeout: 20000,
                responseType: 'arraybuffer', // バイナリデータとして取得
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            // レスポンス状況のログ
            const elapsed = ((Date.now() - this.startTime) / 1000 / 60).toFixed(1);
            console.log(`  ✅ 成功 (${response.status}) - 経過時間: ${elapsed}分`);
            
            // エンコーディング自動検出とデコード
            return this.decodeResponse(response, url);
            
        } catch (error) {
            console.log(`  ❌ エラー: ${error.message}`);
            
            // アクセス禁止やレート制限の検出
            if (error.response) {
                const status = error.response.status;
                if (status === 403) {
                    console.log(`  🚫 アクセス禁止 - 長時間待機後にリトライ`);
                    await this.sleep(30000); // 30秒待機
                } else if (status === 429) {
                    console.log(`  🚦 レート制限 - 待機時間を増加`);
                    await this.sleep(60000); // 1分待機
                } else if (status === 503) {
                    console.log(`  🔧 サーバー過負荷 - 待機後リトライ`);
                    await this.sleep(15000); // 15秒待機
                }
            }
            
            // リトライ機能
            if (retryCount < this.maxRetries) {
                console.log(`  🔄 リトライ ${retryCount + 1}/${this.maxRetries}`);
                await this.sleep(this.retryDelay * (retryCount + 1)); // 指数バックオフ
                return this.fetchPage(url, retryCount + 1);
            }
            
            console.error(`  💀 最大リトライ回数に達しました: ${url}`);
            return null;
        }
    }

    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    decodeResponse(response, url) {
        try {
            const buffer = Buffer.from(response.data);
            
            // Content-Typeヘッダーからcharsetを確認
            const contentType = response.headers['content-type'] || '';
            let charset = null;
            
            const charsetMatch = contentType.match(/charset=([^;]+)/i);
            if (charsetMatch) {
                charset = charsetMatch[1].toLowerCase();
            }
            
            // HTMLからcharsetを確認
            if (!charset) {
                const htmlPreview = buffer.toString('ascii', 0, 1024);
                const metaCharsetMatch = htmlPreview.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i);
                if (metaCharsetMatch) {
                    charset = metaCharsetMatch[1].toLowerCase();
                }
            }
            
            // 自動検出を使用
            if (!charset) {
                const detected = jschardet.detect(buffer);
                if (detected && detected.encoding && detected.confidence > 0.8) {
                    charset = detected.encoding.toLowerCase();
                }
            }
            
            // デフォルトはutf-8
            if (!charset) {
                charset = 'utf-8';
            }
            
            console.log(`  🔤 文字エンコーディング: ${charset}`);
            
            // charsetに応じてデコード
            if (charset === 'shift_jis' || charset === 'shift-jis' || charset === 'sjis') {
                return iconv.decode(buffer, 'shift_jis');
            } else if (charset === 'euc-jp' || charset === 'eucjp') {
                return iconv.decode(buffer, 'euc-jp');
            } else if (charset === 'iso-2022-jp') {
                return iconv.decode(buffer, 'iso-2022-jp');
            } else {
                // UTF-8として処理
                return buffer.toString('utf-8');
            }
            
        } catch (error) {
            console.log(`  ⚠️ エンコーディング処理エラー: ${error.message}`);
            // フォールバック: UTF-8として処理
            return Buffer.from(response.data).toString('utf-8');
        }
    }

    async loadProgress() {
        try {
            if (await fs.pathExists(this.progressFile)) {
                const csvContent = await fs.readFile(this.progressFile, 'utf8');
                const lines = csvContent.split('\n').slice(1); // ヘッダーをスキップ
                
                for (const line of lines) {
                    if (line.trim()) {
                        const [game, category, name, flavorText] = this.parseCSVLine(line);
                        if (name) {
                            this.processedItems.add(`${game}:${name}`);
                            this.results.push({
                                game: game,
                                category: category || 'その他',
                                name: name,
                                url: '', // URLはCSVから削除
                                flavorText: flavorText || ''
                            });
                        }
                    }
                }
                
                console.log(`進捗読み込み: ${this.results.length}件の処理済みアイテムを発見`);
            }
        } catch (error) {
            console.error('進捗読み込みエラー:', error.message);
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    async scrapeSeesaaWiki(gameKey) {
        const game = this.games[gameKey];
        console.log(`  🔍 カテゴリページ取得: ${game.categoryUrl}`);
        
        try {
            // カテゴリページを取得
            const categoryHtml = await this.fetchPage(game.categoryUrl);
            if (!categoryHtml) {
                console.log(`  ❌ カテゴリページの取得に失敗`);
                return;
            }
            
            // アイテムリンクを抽出
            const itemLinks = this.extractSeesaaItemLinks(categoryHtml);
            console.log(`  📋 ${itemLinks.length}個のアイテムカテゴリを発見`);
            
            // テンプレートページなどを除外
            const filteredLinks = itemLinks.filter(item => 
                !item.name.includes('テンプレート') && 
                !item.name.includes('Template') &&
                item.name.length < 20
            );
            
            const linksToProcess = filteredLinks.length > 0 ? filteredLinks : itemLinks;
            
            for (let i = 0; i < linksToProcess.length; i++) {
                const item = linksToProcess[i];
                const itemKey = `${game.name}:${item.name}`;
                
                if (this.processedItems.has(itemKey)) {
                    console.log(`  (${i+1}/${linksToProcess.length}) ${item.name} - スキップ済み`);
                    continue;
                }
                
                console.log(`  (${i+1}/${linksToProcess.length}) ${item.name}`);
                
                const itemHtml = await this.fetchPage(item.url);
                if (!itemHtml) {
                    console.log(`    ❌ ページ取得失敗`);
                    continue;
                }
                
                const flavorText = this.extractSeesaaFlavorText(itemHtml, item.name);
                
                this.results.push({
                    game: game.name,
                    category: item.category || 'その他',
                    name: item.name,
                    url: item.url,
                    flavorText: flavorText || ''
                });
                
                this.processedItems.add(itemKey);
                
                if (flavorText) {
                    console.log(`    ✅ フレーバーテキスト取得成功`);
                } else {
                    console.log(`    ❌ フレーバーテキストなし`);
                }
                
                // 定期保存とレート制限対策
                if (i % 5 === 0 && i > 0) {
                    await this.saveProgress();
                    console.log(`    💾 進捗保存 (${i}件処理済み)`);
                }
            }
            
        } catch (error) {
            console.error(`${game.name} スクレイピングエラー:`, error.message);
        }
    }

    extractSeesaaFlavorText(html, itemName) {
        const $ = cheerio.load(html);
        const flavorTexts = [];
        
        // Seesaa Wikiの構造では、カテゴリページに複数のアイテムが含まれている
        // 個別のアイテムセクションを探す
        if (itemName.includes('アイテム') || itemName.includes('消耗品') || itemName.includes('投擲') || 
            itemName.includes('ソウル') || itemName.includes('強化素材') || itemName.includes('貴重品') ||
            itemName.includes('矢') || itemName.includes('ボルト') || itemName.includes('短剣') ||
            itemName.includes('直剣') || itemName.includes('大剣') || itemName.includes('盾') ||
            itemName.includes('指輪') || itemName.includes('魔術') || itemName.includes('奇跡') ||
            itemName.includes('防具') || itemName.includes('ツール') || itemName.includes('マルチプレイ') ||
            itemName.includes('誓約') || itemName.includes('ボス') || itemName.includes('その他')) {
            
            // ページ内のテーブルセルから日本語のフレーバーテキストを抽出
            $('td').each((i, cell) => {
                const text = $(cell).text().trim();
                
                // 日本語のフレーバーテキストと思われるテキストを判定（より幅広いパターンに対応）
                if (text.length > 10 && text.length < 400 &&
                    (text.includes('である') || text.includes('という') || text.includes('のだ') ||
                     text.includes('ための') || text.includes('による') || text.includes('用の') ||
                     text.includes('持つ') || text.includes('られた') || text.includes('された') ||
                     text.includes('する') || text.includes('。') || text.includes('、') ||
                     text.includes('でき') || text.includes('作ら') || text.includes('使用') ||
                     text.includes('攻撃') || text.includes('防御') || text.includes('効果') ||
                     text.includes('威力') || text.includes('比較') || text.includes('劣っ') ||
                     text.includes('優れ') || text.includes('特別') || text.includes('強力') ||
                     text.includes('軽い') || text.includes('重い') || text.includes('鋭い') ||
                     text.includes('硬い') || text.includes('ダメージ') || text.includes('材料') ||
                     text.includes('素材') || text.includes('製') || text.includes('作り') ||
                     text.includes('の矢') || text.includes('の剣') || text.includes('の盾') ||
                     text.includes('魔法') || text.includes('呪文') || text.includes('祈り') ||
                     text.includes('力を') || text.includes('能力') || text.includes('技') ||
                     text.includes('古い') || text.includes('新し') || text.includes('伝説') ||
                     text.includes('神') || text.includes('聖') || text.includes('闇') ||
                     text.includes('光') || text.includes('炎') || text.includes('氷') ||
                     text.includes('毒') || text.includes('血') || text.includes('骨') ||
                     /[一-龯]/.test(text))) { // 漢字が含まれている
                    
                    // 明らかにフレーバーテキストではないものを除外
                    if (!text.includes('編集') && !text.includes('更新') && 
                        !text.includes('コメント') && !text.includes('wiki') &&
                        !text.includes('http') && !text.includes('Ver') &&
                        !text.includes('Remake') && !text.includes('English') &&
                        !text.includes('Japanese') && !text.includes('リンク') &&
                        !text.includes('カテゴリ') && !text.includes('メニュー') &&
                        !text.includes('ページ') && !text.includes('名前') &&
                        !text.match(/^[A-Za-z\s\.\,\!\?\(\)]+$/)) { // 英語のみのテキストを除外
                        
                        // 重複チェック
                        if (!flavorTexts.some(existing => existing.includes(text.substring(0, 10)))) {
                            flavorTexts.push(`${text}`);
                        }
                    }
                }
            });
            
            // 段落からも抽出を試行（幅広いパターンに対応）
            $('p, div, span').each((i, element) => {
                const text = $(element).text().trim();
                
                if (text.length > 8 && text.length < 400 &&
                    (text.includes('である') || text.includes('という') || text.includes('のだ') ||
                     text.includes('ための') || text.includes('による') || text.includes('用の') ||
                     text.includes('でき') || text.includes('作ら') || text.includes('使用') ||
                     text.includes('攻撃') || text.includes('防御') || text.includes('効果') ||
                     text.includes('威力') || text.includes('比較') || text.includes('劣っ') ||
                     text.includes('優れ') || text.includes('特別') || text.includes('強力') ||
                     text.includes('軽い') || text.includes('重い') || text.includes('鋭い') ||
                     text.includes('硬い') || text.includes('ダメージ') || text.includes('材料') ||
                     text.includes('素材') || text.includes('製') || text.includes('作り') ||
                     text.includes('の矢') || text.includes('の剣') || text.includes('の盾') ||
                     text.includes('魔法') || text.includes('呪文') || text.includes('祈り') ||
                     text.includes('力を') || text.includes('能力') || text.includes('技') ||
                     text.includes('古い') || text.includes('新し') || text.includes('伝説') ||
                     text.includes('神') || text.includes('聖') || text.includes('闇') ||
                     text.includes('光') || text.includes('炎') || text.includes('氷') ||
                     text.includes('毒') || text.includes('血') || text.includes('骨') ||
                     /[一-龯]/.test(text))) { // 漢字が含まれている
                    
                    if (!text.includes('編集') && !text.includes('更新') && 
                        !text.includes('コメント') && !text.includes('wiki') &&
                        !text.includes('http') && !text.includes('Ver') &&
                        !text.includes('Remake') && !text.includes('カテゴリ') &&
                        !text.includes('メニュー') && !text.includes('ページ') &&
                        !text.includes('リンク') && !text.includes('一覧') &&
                        !text.match(/^[A-Za-z\s\.\,\!\?\(\)\"]+$/)) { // 英語のみを除外
                        
                        if (!flavorTexts.some(existing => existing.includes(text.substring(0, 8)))) {
                            flavorTexts.push(`${text}`);
                        }
                    }
                }
            });
            
            // 最大10個まで抽出
            return flavorTexts.slice(0, 10).join('\n\n---\n\n');
        }
        
        // 個別アイテムページの場合（従来のロジック）
        let flavorText = '';
        
        $('.main_body, .main').each((i, element) => {
            let textContent = '';
            
            // 段落や表からテキストを抽出
            $(element).find('p, div, td').each((j, textElement) => {
                const text = $(textElement).text().trim();
                if (text.length > 20 && text.length < 500) {
                    // フレーバーテキストらしい文章を判定
                    if (text.includes('という') || text.includes('である') || text.includes('のだ') || 
                        text.includes('ための') || text.includes('による') || text.includes('持つ')) {
                        if (!text.includes('編集') && !text.includes('更新') && 
                            !text.includes('コメント') && !text.includes('wiki')) {
                            textContent = text;
                            return false; // 最初に見つかったものを使用
                        }
                    }
                }
            });
            
            if (textContent) {
                flavorText = textContent;
                return false;
            }
        });
        
        return flavorText;
    }

    extractSeesaaItemLinks(html) {
        const $ = cheerio.load(html);
        const itemLinks = [];
        
        // Seesaa Wikiのアイテムリンクを抽出（最大10個まで）
        $('a[href*="/d/"]').each((i, link) => {
            if (itemLinks.length >= 15) return false;
            
            const href = $(link).attr('href');
            const text = $(link).text().trim();
            
            // アイテム名らしいリンクをフィルタリング
            if (text && text.length > 0 && text.length < 50 && 
                !text.includes('カテゴリ') && !text.includes('一覧') &&
                !text.includes('編集') && !text.includes('コメント') &&
                !text.includes('トップ') && !text.includes('メニュー')) {
                
                let fullUrl = href;
                if (href.startsWith('/')) {
                    fullUrl = 'https://seesaawiki.jp/fromsoft_flavor-text' + href;
                }
                
                itemLinks.push({
                    name: text,
                    url: fullUrl,
                    category: 'その他'
                });
            }
        });
        
        console.log(`  📋 ${itemLinks.length}個のアイテムリンクを抽出`);
        return itemLinks;
    }

    async scrapeSwiki(gameKey) {
        const game = this.games[gameKey];
        console.log(`  🔍 カテゴリページ取得: ${game.categoryUrl}`);
        
        try {
            const categoryHtml = await this.fetchPage(game.categoryUrl);
            if (!categoryHtml) {
                console.log(`  ❌ カテゴリページの取得に失敗`);
                return;
            }
            
            const flavorText = this.extractSwikiFlavorText(categoryHtml, 'アイテム一覧');
            
            this.results.push({
                game: game.name,
                category: '全アイテム',
                name: 'アイテム一覧',
                url: game.categoryUrl,
                flavorText: flavorText || ''
            });
            
            if (flavorText) {
                console.log(`  ✅ フレーバーテキスト取得成功`);
            } else {
                console.log(`  ❌ フレーバーテキストなし`);
            }
            
        } catch (error) {
            console.error(`${game.name} スクレイピングエラー:`, error.message);
        }
    }

    extractSwikiFlavorText(html, itemName) {
        const $ = cheerio.load(html);
        const flavorTexts = [];
        
        // アイテム一覧ページから複数のフレーバーテキストを抽出
        if (itemName === 'アイテム一覧') {
            // 日本語のフレーバーテキストを優先して抽出
            $('body').find('*').each((i, element) => {
                const text = $(element).text().trim();
                
                if (text.length > 30 && text.length < 800 &&
                    (text.includes('である') || text.includes('という') || text.includes('のだ') ||
                     text.includes('ための') || text.includes('による') || text.includes('。') ||
                     text.includes('される') || text.includes('された') || text.includes('なる') ||
                     text.includes('れる') || text.includes('もの') || text.includes('こと')) &&
                    !text.includes('編集') && !text.includes('更新') &&
                    !text.includes('コメント') && !text.includes('wiki') &&
                    !text.includes('目次') && !text.includes('メニュー') &&
                    !text.includes('http') && !text.includes('www') &&
                    !text.includes('ページ') && !text.includes('サイト')) {
                    
                    // 重複チェック
                    if (!flavorTexts.some(existing => existing.includes(text.substring(0, 15)))) {
                        flavorTexts.push(text);
                    }
                }
            });
            
            // 最大10個まで抽出
            return flavorTexts.slice(0, 10).join('\n\n---\n\n');
        }
        
        return '';
    }

    async scrapeKamikouryaku(gameKey) {
        const game = this.games[gameKey];
        console.log(`\n=== ${game.name} (Kamikouryaku) ===`);
        
        const allLinks = [];
        
        for (const category of game.categories) {
            console.log(`カテゴリ「${category}」を処理中...`);
            const encodedCategory = encodeURIComponent(category);
            const categoryUrl = `${game.baseUrl}?${encodedCategory}`;
            
            const html = await this.fetchPage(categoryUrl);
            if (html) {
                const links = this.extractKamikouryakuLinks(html, game);
                // カテゴリ情報を各リンクに追加
                links.forEach(link => link.category = category);
                allLinks.push(...links);
                console.log(`  ${links.length}個のアイテムリンクを発見`);
            }
        }
        
        // 重複除去と未処理フィルタリング
        const uniqueLinks = allLinks.filter((link, index, self) => 
            index === self.findIndex(l => l.url === link.url) &&
            !this.processedItems.has(`${game.name}:${link.name}`)
        );
        
        console.log(`${uniqueLinks.length}個の新しいアイテムを処理予定`);
        
        for (let i = 0; i < uniqueLinks.length; i++) {
            const item = uniqueLinks[i];
            console.log(`${i + 1}/${uniqueLinks.length}: ${item.name}`);
            
            const html = await this.fetchPage(item.url);
            if (html) {
                const flavorText = this.extractKamikouryakuFlavorText(html, item.name);
                
                this.results.push({
                    game: game.name,
                    category: item.category || 'その他',
                    name: item.name,
                    url: item.url,
                    flavorText: flavorText || ''
                });
                
                this.processedItems.add(`${game.name}:${item.name}`);
                
                if (flavorText) {
                    console.log(`  ✓ フレーバーテキスト取得成功`);
                } else {
                    console.log(`  - フレーバーテキストなし`);
                }
                
                // 定期保存とレート制限対策
                if (i % 10 === 0 && i > 0) {
                    await this.saveProgress();
                    console.log(`  💾 進捗保存完了 - 10秒間休憩`);
                    await this.sleep(10000); // 10秒間の長時間休憩
                }
            }
        }
    }

    extractKamikouryakuLinks(html, game) {
        const $ = cheerio.load(html);
        const links = [];
        
        $('a[href*="?"]').each((i, element) => {
            const href = $(element).attr('href');
            const title = $(element).attr('title') || $(element).text().trim();
            
            if (href && (href.startsWith('./') || href.startsWith('?')) && title) {
                const fullUrl = href.startsWith('./') ? 
                    game.baseUrl + href.substring(2) : 
                    game.baseUrl + href;
                
                // システムページを除外
                if (!title.match(/^(編集|新規|一覧|差分|履歴|凍結|MenuBar|コメント|[a-f0-9]{8})$/)) {
                    links.push({ name: title, url: fullUrl });
                }
            }
        });
        
        return links;
    }

    extractKamikouryakuFlavorText(html, itemName) {
        const $ = cheerio.load(html);
        let flavorText = '';
        
        // フレーバーテキストセクションを探す
        $('h1, h2, h3, h4, h5, h6').each((i, element) => {
            const heading = $(element).text().trim();
            if (heading.includes('フレーバーテキスト')) {
                let nextElement = $(element).next();
                let textContent = '';
                
                while (nextElement.length && !nextElement.is('h1, h2, h3, h4, h5, h6')) {
                    const text = nextElement.text().trim();
                    if (text && text.length > 5) {
                        textContent += text + '\n';
                    }
                    nextElement = nextElement.next();
                }
                
                if (textContent.trim()) {
                    flavorText = textContent.trim();
                    return false;
                }
            }
        });
        
        return flavorText;
    }

    async saveProgress() {
        const csvContent = this.generateCSV();
        await fs.writeFile(this.progressFile, csvContent, 'utf8');
        console.log(`  進捗保存: ${this.results.length}件`);
    }

    generateCSV() {
        const csvHeader = '作品名,アイテムカテゴリ,アイテム名,フレーバーテキスト\n';
        const csvContent = this.results.map(item => {
            const escapedGame = `"${item.game.replace(/"/g, '""')}"`;
            const escapedCategory = `"${item.category.replace(/"/g, '""')}"`;
            const escapedName = `"${item.name.replace(/"/g, '""')}"`;
            const escapedFlavor = `"${item.flavorText.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
            return `${escapedGame},${escapedCategory},${escapedName},${escapedFlavor}`;
        }).join('\n');
        
        return csvHeader + csvContent;
    }

    async saveResults() {
        const csvContent = this.generateCSV();
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const filename = `fromsoft_flavor_texts_${timestamp}.csv`;
        
        await fs.writeFile(filename, csvContent, 'utf8');
        
        // 統計情報
        const gameStats = {};
        const withFlavorStats = {};
        
        for (const item of this.results) {
            gameStats[item.game] = (gameStats[item.game] || 0) + 1;
            if (item.flavorText.length > 0) {
                withFlavorStats[item.game] = (withFlavorStats[item.game] || 0) + 1;
            }
        }
        
        console.log(`\n=== 抽出完了 ===`);
        console.log(`ファイル名: ${filename}`);
        console.log(`総アイテム数: ${this.results.length}`);
        console.log('\nゲーム別統計:');
        for (const [game, count] of Object.entries(gameStats)) {
            const withFlavor = withFlavorStats[game] || 0;
            console.log(`  ${game}: ${count}件 (フレーバーテキスト有り: ${withFlavor}件)`);
        }
    }

    async run() {
        try {
            console.log('フロム・ソフトウェア フレーバーテキスト統合抽出開始');
            console.log('宮崎英高ディレクション作品: デモンズソウル, ダークソウル1, ダークソウル3, ブラッドボーン, エルデンリング\n');
            
            // 進捗読み込み
            await this.loadProgress();
            
            // 各ゲームのスクレイピング
            for (const [gameKey, gameConfig] of Object.entries(this.games)) {
                console.log(`\n=== ${gameConfig.name} スクレイピング開始 ===`);
                
                if (gameConfig.type === 'seesaa') {
                    await this.scrapeSeesaaWiki(gameKey);
                } else if (gameConfig.type === 'swiki') {
                    await this.scrapeSwiki(gameKey);
                } else if (gameConfig.type === 'kamikouryaku') {
                    await this.scrapeKamikouryaku(gameKey);
                }
            }
            
            // 最終結果保存
            await this.saveResults();
            
            console.log('\n抽出完了！');
            
        } catch (error) {
            console.error('エラーが発生しました:', error);
            if (this.results.length > 0) {
                console.log('部分的な結果を保存します...');
                await this.saveResults();
            }
        }
    }
}

const scraper = new FromSoftwareScraper();
scraper.run();