import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import iconv from 'iconv-lite';

class EldenRingFlavorTextScraper {
    constructor() {
        this.baseUrl = 'https://kamikouryaku.net/eldenring/';
        this.results = [];
        this.delay = 300; // 0.3秒待機 (レート制限を緩和)
        this.batchSize = 50; // バッチ処理用
        this.resumeFile = 'scraper_resume.json';
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchPage(url) {
        try {
            await this.sleep(this.delay);
            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`エラー: ${url} - ${error.message}`);
            return null;
        }
    }

    extractItemLinks(html) {
        const $ = cheerio.load(html);
        const links = [];
        
        // アイテムページへのリンクを抽出
        $('a[href*="?"]').each((i, element) => {
            const href = $(element).attr('href');
            const title = $(element).attr('title') || $(element).text().trim();
            
            if (href && href.startsWith('./?' || href.startsWith('?')) && title) {
                const fullUrl = href.startsWith('./') ? 
                    this.baseUrl + href.substring(2) : 
                    this.baseUrl + href;
                
                links.push({
                    name: title,
                    url: fullUrl
                });
            }
        });
        
        return links;
    }

    extractFlavorText(html, itemName) {
        const $ = cheerio.load(html);
        let flavorText = '';
        
        // フレーバーテキストセクションを探す
        $('h1, h2, h3, h4, h5, h6').each((i, element) => {
            const heading = $(element).text().trim();
            if (heading.includes('フレーバーテキスト') || heading.includes('flavor') || heading.includes('説明')) {
                // 次の要素からフレーバーテキストを抽出
                let nextElement = $(element).next();
                let textContent = '';
                
                while (nextElement.length && !nextElement.is('h1, h2, h3, h4, h5, h6')) {
                    const text = nextElement.text().trim();
                    if (text) {
                        textContent += text + '\n';
                    }
                    nextElement = nextElement.next();
                }
                
                if (textContent.trim()) {
                    flavorText = textContent.trim();
                    return false; // break
                }
            }
        });
        
        // 代替方法：特定のパターンで説明文を探す
        if (!flavorText) {
            $('p, div').each((i, element) => {
                const text = $(element).text().trim();
                // 日本語の詩的な表現っぽいパターンを探す
                if (text.length > 20 && text.length < 500 && 
                    (text.includes('という') || text.includes('である') || text.includes('のだ'))) {
                    flavorText = text;
                    return false; // break
                }
            });
        }
        
        return flavorText;
    }

    async scrapeItemCategories() {
        console.log('アイテムカテゴリを取得中...');
        
        const categories = [
            '道具',
            'アイテム製作素材', 
            '強化素材',
            '鈴玉',
            '貴重品',
            '絵画'
        ];
        
        const allLinks = [];
        
        for (const category of categories) {
            console.log(`カテゴリ「${category}」を処理中...`);
            const encodedCategory = encodeURIComponent(category);
            const categoryUrl = `${this.baseUrl}?${encodedCategory}`;
            
            const html = await this.fetchPage(categoryUrl);
            if (html) {
                const links = this.extractItemLinks(html);
                allLinks.push(...links);
                console.log(`  ${links.length}個のアイテムリンクを発見`);
            }
        }
        
        // 重複を除去
        const uniqueLinks = allLinks.filter((link, index, self) => 
            index === self.findIndex(l => l.url === link.url)
        );
        
        console.log(`合計 ${uniqueLinks.length}個のユニークなアイテムを発見`);
        return uniqueLinks;
    }

    async loadResumeData() {
        try {
            if (await fs.pathExists(this.resumeFile)) {
                const data = await fs.readJson(this.resumeFile);
                this.results = data.results || [];
                console.log(`🔄 再開データ読み込み: ${this.results.length}件の結果を復元`);
                return data.lastProcessedIndex + 1;
            }
        } catch (error) {
            console.log('再開データの読み込みに失敗、最初から開始します');
        }
        return 0;
    }

    async scrapeFlavorTexts(itemLinks) {
        console.log('フレーバーテキストを抽出中...');
        
        // 再開位置を取得
        const startIndex = await this.loadResumeData();
        if (startIndex > 0) {
            console.log(`📍 ${startIndex + 1}件目から再開します`);
        }
        
        for (let i = startIndex; i < itemLinks.length; i++) {
            const item = itemLinks[i];
            console.log(`${i + 1}/${itemLinks.length}: ${item.name}`);
            
            const html = await this.fetchPage(item.url);
            if (html) {
                const flavorText = this.extractFlavorText(html, item.name);
                
                this.results.push({
                    name: item.name,
                    url: item.url,
                    flavorText: flavorText || '（フレーバーテキストなし）'
                });
                
                if (flavorText) {
                    console.log(`  ✓ フレーバーテキスト取得成功`);
                } else {
                    console.log(`  - フレーバーテキストなし`);
                }
            }
            
            // バッチごとに中間保存
            if ((i + 1) % this.batchSize === 0) {
                await this.saveIntermediateResults(i + 1);
            }
        }
    }

    async saveIntermediateResults(processedCount) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `flavor_texts_progress_${timestamp}.json`;
        
        // 進捗保存
        await fs.writeJson(filename, {
            processed: processedCount,
            total: this.results.length,
            timestamp: new Date().toISOString(),
            results: this.results
        }, { spaces: 2 });
        
        // 再開用データ保存
        await fs.writeJson(this.resumeFile, {
            lastProcessedIndex: processedCount - 1,
            results: this.results,
            timestamp: new Date().toISOString()
        }, { spaces: 2 });
        
        console.log(`  📝 中間保存完了 (${processedCount}件処理済み) - ${filename}`);
    }

    getJapanTimestamp() {
        const now = new Date();
        const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
        const year = japanTime.getFullYear();
        const month = String(japanTime.getMonth() + 1).padStart(2, '0');
        const day = String(japanTime.getDate()).padStart(2, '0');
        const hours = String(japanTime.getHours()).padStart(2, '0');
        const minutes = String(japanTime.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}_${hours}_${minutes}`;
    }

    async saveResults() {
        const timestamp = this.getJapanTimestamp();
        
        // JSON形式で保存
        const jsonFilename = `flavor_texts_${timestamp}.json`;
        await fs.writeJson(jsonFilename, this.results, { spaces: 2 });
        
        // CSV形式で保存（Shift-JIS）
        const csvHeader = 'アイテム名,URL,フレーバーテキスト\n';
        const csvContent = this.results.map(item => 
            `"${item.name}","${item.url}","${item.flavorText.replace(/"/g, '""')}"`
        ).join('\n');
        
        const csvData = csvHeader + csvContent;
        const csvBuffer = iconv.encode(csvData, 'shift_jis');
        const csvFilename = `flavor_texts_${timestamp}.csv`;
        await fs.writeFile(csvFilename, csvBuffer);
        
        console.log(`結果を保存しました: ${this.results.length}件`);
        console.log(`  - ${jsonFilename} (JSON形式)`);
        console.log(`  - ${csvFilename} (CSV形式, Shift-JIS)`);
    }

    async run() {
        try {
            console.log('エルデンリング フレーバーテキスト抽出開始');
            
            const itemLinks = await this.scrapeItemCategories();
            if (itemLinks.length === 0) {
                console.log('アイテムが見つかりませんでした');
                return;
            }
            
            await this.scrapeFlavorTexts(itemLinks);
            await this.saveResults();
            
            // 最終的な統計情報を表示
            const successCount = this.results.filter(r => r.flavorText !== '（フレーバーテキストなし）').length;
            console.log(`\n📊 統計情報:`);
            console.log(`  - 総アイテム数: ${this.results.length}`);
            console.log(`  - フレーバーテキスト取得成功: ${successCount}`);
            console.log(`  - 成功率: ${((successCount / this.results.length) * 100).toFixed(1)}%`);
            
            // 再開ファイルを削除
            if (await fs.pathExists(this.resumeFile)) {
                await fs.remove(this.resumeFile);
                console.log('🧹 再開データを削除しました');
            }
            
            console.log('抽出完了！');
            
        } catch (error) {
            console.error('エラーが発生しました:', error);
            console.log('\n💡 再開するには再度 npm start を実行してください');
        }
    }
}

// 実行
const scraper = new EldenRingFlavorTextScraper();
scraper.run();