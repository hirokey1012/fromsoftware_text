import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';

class QuickScraper {
    constructor() {
        this.baseUrl = 'https://kamikouryaku.net/eldenring/';
        this.results = [];
        this.delay = 500; // 500ms待機
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchPage(url) {
        try {
            await this.sleep(this.delay);
            const response = await axios.get(url, {
                timeout: 10000,
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
                    if (text && text.length > 10) {
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

    async scrapeSpecificItems() {
        // 有名なアイテムのサンプル
        const testItems = [
            { name: '聖杯瓶', url: this.baseUrl + '?聖杯瓶' },
            { name: 'ルーンの弧', url: this.baseUrl + '?ルーンの弧' },
            { name: '星光の欠片', url: this.baseUrl + '?星光の欠片' },
            { name: '微睡の枝', url: this.baseUrl + '?微睡の枝' },
            { name: '霊馬の指笛', url: this.baseUrl + '?霊馬の指笛' }
        ];

        console.log(`${testItems.length}個のテストアイテムを処理中...`);
        
        for (let i = 0; i < testItems.length; i++) {
            const item = testItems[i];
            console.log(`${i + 1}/${testItems.length}: ${item.name}`);
            
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
                    console.log(`  "${flavorText.substring(0, 50)}..."`);
                } else {
                    console.log(`  - フレーバーテキストなし`);
                }
            }
        }
    }

    async saveResults() {
        await fs.writeJson('./sample_flavor_texts.json', this.results, { spaces: 2 });
        
        const csvHeader = 'アイテム名,URL,フレーバーテキスト\n';
        const csvContent = this.results.map(item => 
            `"${item.name}","${item.url}","${item.flavorText.replace(/"/g, '""')}"`
        ).join('\n');
        
        await fs.writeFile('./sample_flavor_texts.csv', csvHeader + csvContent, 'utf8');
        
        console.log(`\nサンプル結果を保存: ${this.results.length}件`);
        console.log('  - sample_flavor_texts.json');
        console.log('  - sample_flavor_texts.csv');
    }

    async run() {
        try {
            console.log('クイックテスト開始');
            await this.scrapeSpecificItems();
            await this.saveResults();
            console.log('テスト完了！');
        } catch (error) {
            console.error('エラー:', error);
        }
    }
}

const scraper = new QuickScraper();
scraper.run();