import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

class ScrapingTester {
    constructor() {
        this.delay = 2000; // 2秒待機（テスト用は長めに設定）
        
        this.testTargets = [
            {
                game: 'エルデンリング',
                url: 'https://kamikouryaku.net/eldenring/?聖杯瓶',
                expectedText: 'フレーバーテキスト'
            },
            {
                game: 'ブラッドボーン',
                url: 'https://kamikouryaku.net/bloodborne/?道具',
                expectedText: 'アイテム'
            },
            {
                game: 'ダークソウル3',
                url: 'https://seesaawiki.jp/fromsoft_flavor-text/',
                expectedText: 'DARK SOULS'
            },
            {
                game: 'ダークソウル1',
                url: 'https://seesaawiki.jp/fromsoft_flavor-text/',
                expectedText: 'DSR'
            },
            {
                game: 'デモンズソウル',
                url: 'https://seesaawiki.jp/fromsoft_flavor-text/',
                expectedText: 'Demon'
            }
        ];
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async testSiteAccess(target) {
        console.log(`\n=== ${target.game} テスト ===`);
        console.log(`URL: ${target.url}`);
        
        try {
            // リクエスト前に待機
            await this.sleep(this.delay);
            
            const startTime = Date.now();
            const response = await axios.get(target.url, {
                timeout: 15000,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            
            const responseTime = Date.now() - startTime;
            
            console.log(`✅ アクセス成功`);
            console.log(`📊 ステータス: ${response.status}`);
            console.log(`⏱️ レスポンス時間: ${responseTime}ms`);
            console.log(`📦 データサイズ: ${(response.data.byteLength / 1024).toFixed(2)}KB`);
            
            // エンコーディング処理
            const decodedData = this.decodeResponse(response);
            
            // HTMLパース確認
            const $ = cheerio.load(decodedData);
            const title = $('title').text().trim();
            console.log(`📄 ページタイトル: ${title}`);
            
            // 期待するテキストの存在確認
            const pageText = decodedData;
            const hasExpectedText = pageText.includes(target.expectedText);
            console.log(`🔍 期待テキスト「${target.expectedText}」: ${hasExpectedText ? '✅ 発見' : '❌ 未発見'}`);
            
            // リンク数確認
            const linkCount = $('a').length;
            console.log(`🔗 リンク数: ${linkCount}個`);
            
            // レート制限ヘッダーチェック
            const headers = response.headers;
            if (headers['x-ratelimit-remaining']) {
                console.log(`🚦 レート制限残り: ${headers['x-ratelimit-remaining']}`);
            }
            if (headers['retry-after']) {
                console.log(`⏳ リトライ推奨間隔: ${headers['retry-after']}秒`);
            }
            
            return {
                success: true,
                responseTime,
                hasExpectedText,
                linkCount,
                title
            };
            
        } catch (error) {
            console.log(`❌ アクセス失敗`);
            console.log(`🚨 エラー: ${error.message}`);
            
            if (error.response) {
                console.log(`📊 ステータス: ${error.response.status}`);
                console.log(`📄 レスポンス: ${error.response.statusText}`);
                
                // アクセス禁止の兆候チェック
                if (error.response.status === 403) {
                    console.log(`🚫 アクセス禁止 - IPブロックの可能性`);
                } else if (error.response.status === 429) {
                    console.log(`🚦 レート制限 - アクセス頻度が高すぎます`);
                } else if (error.response.status === 503) {
                    console.log(`🔧 サービス一時停止 - サーバーメンテナンス中の可能性`);
                }
            }
            
            return {
                success: false,
                error: error.message,
                status: error.response?.status
            };
        }
    }

    async testFlavorTextExtraction() {
        console.log(`\n=== フレーバーテキスト抽出テスト ===`);
        
        // エルデンリングの聖杯瓶でテスト
        const testUrl = 'https://kamikouryaku.net/eldenring/?聖杯瓶';
        
        try {
            await this.sleep(this.delay);
            const response = await axios.get(testUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            
            // フレーバーテキストセクションを探す
            let flavorText = '';
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
            
            if (flavorText) {
                console.log(`✅ フレーバーテキスト抽出成功`);
                console.log(`📝 抽出内容（最初の100文字）:`);
                console.log(`"${flavorText.substring(0, 100)}..."`);
            } else {
                console.log(`❌ フレーバーテキスト抽出失敗`);
            }
            
        } catch (error) {
            console.log(`❌ フレーバーテキスト抽出テストエラー: ${error.message}`);
        }
    }

    async runSafetyCheck() {
        console.log(`\n=== アクセス安全性チェック ===`);
        
        // robots.txtチェック
        const robotsUrls = [
            'https://kamikouryaku.net/robots.txt',
            'https://seesaawiki.jp/robots.txt'
        ];
        
        for (const robotsUrl of robotsUrls) {
            try {
                await this.sleep(1000);
                const response = await axios.get(robotsUrl, { timeout: 10000 });
                console.log(`\n📋 ${robotsUrl}:`);
                console.log(response.data.substring(0, 500));
            } catch (error) {
                console.log(`\n📋 ${robotsUrl}: アクセスできません`);
            }
        }
    }

    generateRecommendations(results) {
        console.log(`\n=== 推奨設定 ===`);
        
        const successCount = results.filter(r => r.success).length;
        const avgResponseTime = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.responseTime, 0) / successCount;
        
        console.log(`✅ 成功率: ${successCount}/${results.length} (${((successCount/results.length)*100).toFixed(1)}%)`);
        console.log(`⏱️ 平均レスポンス時間: ${avgResponseTime.toFixed(0)}ms`);
        
        // 推奨待機時間の計算
        let recommendedDelay;
        if (avgResponseTime < 500) {
            recommendedDelay = 1500; // 高速サイト
        } else if (avgResponseTime < 1000) {
            recommendedDelay = 2000; // 中速サイト
        } else {
            recommendedDelay = 3000; // 低速サイト
        }
        
        console.log(`\n🔧 推奨設定:`);
        console.log(`   リクエスト間隔: ${recommendedDelay}ms以上`);
        console.log(`   タイムアウト: 20000ms`);
        console.log(`   バッチサイズ: 10-20件ごとに保存`);
        console.log(`   User-Agentの変更: 推奨`);
        
        if (successCount < results.length) {
            console.log(`\n⚠️ 注意事項:`);
            console.log(`   - 失敗したサイトは手動確認が必要`);
            console.log(`   - VPN使用を検討`);
            console.log(`   - 時間帯を変えて再試行`);
        }
    }

    decodeResponse(response) {
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
            
            console.log(`🔤 文字エンコーディング: ${charset}`);
            
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
            console.log(`⚠️ エンコーディング処理エラー: ${error.message}`);
            // フォールバック: UTF-8として処理
            return Buffer.from(response.data).toString('utf-8');
        }
    }

    async run() {
        console.log('🧪 フロム・ソフトウェア サイトアクセステスト開始');
        console.log('===================================================');
        
        // robots.txtチェック
        await this.runSafetyCheck();
        
        // 各サイトのアクセステスト
        const results = [];
        for (const target of this.testTargets) {
            const result = await this.testSiteAccess(target);
            results.push(result);
        }
        
        // フレーバーテキスト抽出テスト
        await this.testFlavorTextExtraction();
        
        // 推奨設定の生成
        this.generateRecommendations(results);
        
        console.log('\n✅ テスト完了');
    }
}

const tester = new ScrapingTester();
tester.run();