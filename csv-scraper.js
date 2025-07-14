import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';

class CSVScraper {
    constructor() {
        this.baseUrl = 'https://kamikouryaku.net/eldenring/';
        this.results = [];
        this.delay = 800; // 800ms待機（サーバー負荷軽減）
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchPage(url) {
        try {
            await this.sleep(this.delay);
            const response = await axios.get(url, {
                timeout: 15000,
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
        
        $('a[href*="?"]').each((i, element) => {
            const href = $(element).attr('href');
            const title = $(element).attr('title') || $(element).text().trim();
            
            if (href && (href.startsWith('./') || href.startsWith('?')) && title) {
                const fullUrl = href.startsWith('./') ? 
                    this.baseUrl + href.substring(2) : 
                    this.baseUrl + href;
                
                // システムページやナビゲーション要素を除外
                if (!title.match(/^(編集|新規|一覧|差分|履歴|凍結|MenuBar|コメント|n[0-9a-f]{8}|[a-f0-9]{8})$/)) {
                    links.push({
                        name: title,
                        url: fullUrl
                    });
                }
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

    async scrapeFlavorTexts(itemLinks) {
        console.log('フレーバーテキストを抽出中...');
        
        for (let i = 0; i < itemLinks.length; i++) {
            const item = itemLinks[i];
            console.log(`${i + 1}/${itemLinks.length}: ${item.name}`);
            
            const html = await this.fetchPage(item.url);
            if (html) {
                const flavorText = this.extractFlavorText(html, item.name);
                
                this.results.push({
                    name: item.name,
                    url: item.url,
                    flavorText: flavorText || ''
                });
                
                if (flavorText) {
                    console.log(`  ✓ フレーバーテキスト取得成功`);
                } else {
                    console.log(`  - フレーバーテキストなし`);
                }
            }
            
            // 進捗を定期的に保存
            if (i % 50 === 0 && i > 0) {
                await this.saveProgressCSV(i);
            }
        }
    }

    async saveProgressCSV(currentIndex) {
        const csvContent = this.generateCSV();
        await fs.writeFile(`./progress_${currentIndex}.csv`, csvContent, 'utf8');
        console.log(`  進捗保存: ${currentIndex}件完了`);
    }

    generateCSV() {
        const csvHeader = 'アイテム名,URL,フレーバーテキスト\n';
        const csvContent = this.results.map(item => {
            const escapedName = `"${item.name.replace(/"/g, '""')}"`;
            const escapedUrl = `"${item.url}"`;
            const escapedFlavor = `"${item.flavorText.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
            return `${escapedName},${escapedUrl},${escapedFlavor}`;
        }).join('\n');
        
        return csvHeader + csvContent;
    }

    async saveResults() {
        const csvContent = this.generateCSV();
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const filename = `elden_ring_flavor_texts_${timestamp}.csv`;
        
        await fs.writeFile(`./${filename}`, csvContent, 'utf8');
        
        // 統計情報
        const withFlavor = this.results.filter(item => item.flavorText.length > 0).length;
        
        console.log(`\n=== 抽出完了 ===`);
        console.log(`ファイル名: ${filename}`);
        console.log(`総アイテム数: ${this.results.length}`);
        console.log(`フレーバーテキスト有り: ${withFlavor}`);
        console.log(`フレーバーテキスト無し: ${this.results.length - withFlavor}`);
    }

    async run() {
        try {
            console.log('エルデンリング フレーバーテキスト CSV抽出開始');
            console.log('進捗は50件ごとに自動保存されます\n');
            
            const itemLinks = await this.scrapeItemCategories();
            if (itemLinks.length === 0) {
                console.log('アイテムが見つかりませんでした');
                return;
            }
            
            await this.scrapeFlavorTexts(itemLinks);
            await this.saveResults();
            
        } catch (error) {
            console.error('エラーが発生しました:', error);
            if (this.results.length > 0) {
                console.log('部分的な結果を保存します...');
                await this.saveResults();
            }
        }
    }
}

const scraper = new CSVScraper();
scraper.run();