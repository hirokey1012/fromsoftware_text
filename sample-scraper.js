import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

class SampleScraper {
    constructor() {
        this.results = [];
        this.delay = 2000; // 2秒待機
        this.requestCount = 0;
        this.startTime = Date.now();
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchPage(url, retryCount = 0) {
        try {
            await this.sleep(this.delay);
            this.requestCount++;
            console.log(`  📡 リクエスト #${this.requestCount}`);
            
            const response = await axios.get(url, {
                timeout: 20000,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            console.log(`  ✅ 成功 (${response.status})`);
            return this.decodeResponse(response, url);
            
        } catch (error) {
            console.log(`  ❌ エラー: ${error.message}`);
            return null;
        }
    }

    decodeResponse(response, url) {
        try {
            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || '';
            let charset = null;
            
            const charsetMatch = contentType.match(/charset=([^;]+)/i);
            if (charsetMatch) {
                charset = charsetMatch[1].toLowerCase();
            }
            
            if (!charset) {
                const htmlPreview = buffer.toString('ascii', 0, 1024);
                const metaCharsetMatch = htmlPreview.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i);
                if (metaCharsetMatch) {
                    charset = metaCharsetMatch[1].toLowerCase();
                }
            }
            
            if (!charset) {
                const detected = jschardet.detect(buffer);
                if (detected && detected.encoding && detected.confidence > 0.8) {
                    charset = detected.encoding.toLowerCase();
                }
            }
            
            if (!charset) {
                charset = 'utf-8';
            }
            
            console.log(`  🔤 エンコーディング: ${charset}`);
            
            if (charset === 'shift_jis' || charset === 'shift-jis' || charset === 'sjis') {
                return iconv.decode(buffer, 'shift_jis');
            } else if (charset === 'euc-jp' || charset === 'eucjp') {
                return iconv.decode(buffer, 'euc-jp');
            } else {
                return buffer.toString('utf-8');
            }
            
        } catch (error) {
            console.log(`  ⚠️ エンコーディング処理エラー: ${error.message}`);
            return Buffer.from(response.data).toString('utf-8');
        }
    }

    async sampleKamikouryaku(gameName, baseUrl, sampleUrls) {
        console.log(`\n=== ${gameName} サンプル抽出 ===`);
        
        for (let i = 0; i < sampleUrls.length && i < 10; i++) {
            const item = sampleUrls[i];
            console.log(`${i + 1}/10: ${item.name}`);
            
            const html = await this.fetchPage(item.url);
            if (html) {
                const flavorText = this.extractKamikouryakuFlavorText(html, item.name);
                
                this.results.push({
                    game: gameName,
                    category: item.category || 'その他',
                    name: item.name,
                    url: item.url,
                    flavorText: flavorText || ''
                });
                
                if (flavorText) {
                    console.log(`  ✅ フレーバーテキスト取得成功`);
                    console.log(`  📝 "${flavorText.substring(0, 50)}..."`);
                } else {
                    console.log(`  ❌ フレーバーテキストなし`);
                }
            }
        }
    }

    extractKamikouryakuFlavorText(html, itemName) {
        const $ = cheerio.load(html);
        let flavorText = '';
        
        // 複数の見出しパターンでフレーバーテキストを探す
        const headingPatterns = ['フレーバーテキスト', '説明', 'アイテム説明', '効果'];
        
        $('h1, h2, h3, h4, h5, h6').each((i, element) => {
            const heading = $(element).text().trim();
            
            // いずれかのパターンにマッチするかチェック
            const matchesPattern = headingPatterns.some(pattern => heading.includes(pattern));
            
            if (matchesPattern) {
                let nextElement = $(element).next();
                let textContent = '';
                
                while (nextElement.length && !nextElement.is('h1, h2, h3, h4, h5, h6')) {
                    const text = nextElement.text().trim();
                    if (text && text.length > 10) {
                        textContent += text + '\n';
                    }
                    nextElement = nextElement.next();
                }
                
                if (textContent.trim()) {
                    flavorText = textContent.trim();
                    return false; // 最初に見つかったものを使用
                }
            }
        });
        
        // 見出しが見つからない場合、表形式のデータから抽出を試行
        if (!flavorText) {
            $('table').each((i, table) => {
                $(table).find('tr').each((j, row) => {
                    const cells = $(row).find('td, th');
                    if (cells.length >= 2) {
                        const label = $(cells[0]).text().trim();
                        const content = $(cells[1]).text().trim();
                        
                        if ((label.includes('説明') || label.includes('フレーバー') || label.includes('効果')) && 
                            content.length > 20) {
                            flavorText = content;
                            return false;
                        }
                    }
                });
                
                if (flavorText) return false;
            });
        }
        
        return flavorText;
    }

    async sampleSwiki(gameName, baseUrl, sampleUrls) {
        console.log(`\n=== ${gameName} サンプル抽出 ===`);
        
        for (let i = 0; i < sampleUrls.length && i < 10; i++) {
            const item = sampleUrls[i];
            console.log(`${i + 1}/10: ${item.name}`);
            
            const html = await this.fetchPage(item.url);
            if (html) {
                const flavorText = this.extractSwikiFlavorText(html, item.name);
                
                this.results.push({
                    game: gameName,
                    category: item.category || 'その他',
                    name: item.name,
                    url: item.url,
                    flavorText: flavorText || ''
                });
                
                if (flavorText) {
                    console.log(`  ✅ フレーバーテキスト取得成功`);
                    console.log(`  📝 "${flavorText.substring(0, 50)}..."`);
                } else {
                    console.log(`  ❌ フレーバーテキストなし`);
                }
            }
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
            
            // 英語のフレーバーテキストは除外（日本語優先）
            
            // 最大10個まで抽出
            return flavorTexts.slice(0, 10).join('\n\n---\n\n');
        }
        
        // 個別アイテムページの場合（従来のロジック）
        let flavorText = '';
        
        $('#body').find('p, div').each((i, element) => {
            const text = $(element).text().trim();
            if (text.length > 30 && text.length < 1000) {
                if ((text.includes('。') || text.includes('である') || text.includes('という') || 
                     text.includes('のだ') || text.includes('ための') || text.includes('による')) &&
                    !text.includes('編集') && !text.includes('更新') && 
                    !text.includes('コメント') && !text.includes('wiki') &&
                    !text.includes('目次') && !text.includes('メニュー')) {
                    flavorText = text;
                    return false;
                }
            }
        });
        
        return flavorText;
    }

    async sampleSeesaaWiki(gameName) {
        console.log(`\n=== ${gameName} サンプル抽出 ===`);
        
        // ゲーム別のカテゴリページを取得
        let categoryUrl = '';
        switch (gameName) {
            case 'デモンズソウル':
                categoryUrl = 'https://seesaawiki.jp/fromsoft_flavor-text/d/Demon%27s%a5%a2%a5%a4%a5%c6%a5%e0%bc%ef%ce%e0%ca%cc%cd%f7';
                break;
            case 'ダークソウル1':
                categoryUrl = 'https://seesaawiki.jp/fromsoft_flavor-text/d/DSR%a5%a2%a5%a4%a5%c6%a5%e0%bc%ef%ce%e0%ca%cc%cd%f7';
                break;
            case 'ダークソウル3':
                categoryUrl = 'https://seesaawiki.jp/fromsoft_flavor-text/d/DS3%a5%a2%a5%a4%a5%c6%a5%e0%bc%ef%ce%e0%ca%cc%cd%f7';
                break;
            default:
                console.log(`  ⚠️ 未知のゲーム名: ${gameName}`);
                return;
        }
        
        console.log(`  🔍 カテゴリページ取得: ${categoryUrl}`);
        const categoryHtml = await this.fetchPage(categoryUrl);
        if (!categoryHtml) {
            console.log(`  ❌ カテゴリページの取得に失敗`);
            return;
        }
        
        // カテゴリページからアイテムリンクを抽出
        const sampleUrls = this.extractSeesaaItemLinks(categoryHtml);
        
        if (sampleUrls.length === 0) {
            console.log(`  ⚠️ アイテムリンクが見つかりませんでした`);
            return;
        }
        
        // テンプレートページなどを除外
        const filteredUrls = sampleUrls.filter(item => 
            !item.name.includes('テンプレート') && 
            !item.name.includes('Template') &&
            !item.name.includes('その他') &&
            item.name.length < 20
        );
        
        const urlsToProcess = filteredUrls.length > 0 ? filteredUrls : sampleUrls;
        
        for (let i = 0; i < urlsToProcess.length && i < 10; i++) {
            const item = urlsToProcess[i];
            console.log(`${i + 1}/${Math.min(urlsToProcess.length, 10)}: ${item.name}`);
            
            const html = await this.fetchPage(item.url);
            if (html) {
                const flavorText = this.extractSeesaaFlavorText(html, item.name);
                
                this.results.push({
                    game: gameName,
                    category: 'その他',
                    name: item.name,
                    url: item.url,
                    flavorText: flavorText || ''
                });
                
                if (flavorText) {
                    console.log(`  ✅ フレーバーテキスト取得成功`);
                    console.log(`  📝 "${flavorText.substring(0, 50)}..."`);
                } else {
                    console.log(`  ❌ フレーバーテキストなし`);
                }
            }
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
                            flavorTexts.push(`${text}（アイテム: 不明）`);
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
                            flavorTexts.push(`${text}（アイテム: 不明）`);
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
            if (itemLinks.length >= 10) return false;
            
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

    generateSampleCSV() {
        const csvHeader = '作品名,アイテムカテゴリ,アイテム名,フレーバーテキスト,取得先URL\n';
        const csvContent = this.results.map(item => {
            const escapedGame = `"${item.game.replace(/"/g, '""')}"`;
            const escapedCategory = `"${item.category.replace(/"/g, '""')}"`;
            const escapedName = `"${item.name.replace(/"/g, '""')}"`;
            const escapedFlavor = `"${item.flavorText.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
            const escapedUrl = `"${item.url}"`;
            return `${escapedGame},${escapedCategory},${escapedName},${escapedFlavor},${escapedUrl}`;
        }).join('\n');
        
        return csvHeader + csvContent;
    }

    async run() {
        try {
            console.log('🎯 フロム・ソフトウェア サンプル抽出開始');
            console.log('各ゲームから10個ずつのアイテムをサンプル取得します\n');
            
            // エルデンリング サンプル
            const eldenRingSamples = [
                { name: '聖杯瓶', url: 'https://kamikouryaku.net/eldenring/?聖杯瓶', category: '道具' },
                { name: 'ルーンの弧', url: 'https://kamikouryaku.net/eldenring/?ルーンの弧', category: '道具' },
                { name: '星光の欠片', url: 'https://kamikouryaku.net/eldenring/?星光の欠片', category: '道具' },
                { name: '微睡の枝', url: 'https://kamikouryaku.net/eldenring/?微睡の枝', category: '道具' },
                { name: '霊馬の指笛', url: 'https://kamikouryaku.net/eldenring/?霊馬の指笛', category: '道具' },
                { name: '毒の苔薬', url: 'https://kamikouryaku.net/eldenring/?毒の苔薬', category: '道具' },
                { name: '火炎壺', url: 'https://kamikouryaku.net/eldenring/?火炎壺', category: '道具' },
                { name: '調香瓶', url: 'https://kamikouryaku.net/eldenring/?調香瓶', category: '道具' },
                { name: '遠眼鏡', url: 'https://kamikouryaku.net/eldenring/?遠眼鏡', category: '道具' },
                { name: '骨の投げ矢', url: 'https://kamikouryaku.net/eldenring/?骨の投げ矢', category: '道具' }
            ];
            
            await this.sampleKamikouryaku('エルデンリング', 'https://kamikouryaku.net/eldenring/', eldenRingSamples);
            
            // ブラッドボーン サンプル（メインアイテムページから抽出）
            const bloodborneSamples = [
                { name: 'アイテム一覧', url: 'https://bloodborne.swiki.jp/index.php?%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0', category: '全アイテム' }
            ];
            
            await this.sampleSwiki('ブラッドボーン', 'https://bloodborne.swiki.jp/', bloodborneSamples);
            
            // Seesaa Wiki サンプル（各ゲーム）
            await this.sampleSeesaaWiki('デモンズソウル');
            await this.sampleSeesaaWiki('ダークソウル1');
            await this.sampleSeesaaWiki('ダークソウル3');
            
            // 結果保存
            const csvContent = this.generateSampleCSV();
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            const filename = `fromsoft_sample_${timestamp}.csv`;
            
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
            
            console.log(`\n=== サンプル抽出完了 ===`);
            console.log(`ファイル名: ${filename}`);
            console.log(`総アイテム数: ${this.results.length}`);
            console.log('\nゲーム別統計:');
            for (const [game, count] of Object.entries(gameStats)) {
                const withFlavor = withFlavorStats[game] || 0;
                console.log(`  ${game}: ${count}件 (フレーバーテキスト有り: ${withFlavor}件)`);
            }
            
        } catch (error) {
            console.error('エラーが発生しました:', error);
        }
    }
}

const scraper = new SampleScraper();
scraper.run();