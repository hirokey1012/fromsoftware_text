import { FromSoftwareFlavorTextScraper } from './scraper.js';
import fs from 'fs-extra';
import iconv from 'iconv-lite';

const games = [
    { name: 'ダークソウル', url: 'https://kamikouryaku.net/darksouls/', limit: 50 },
    { name: 'ダークソウル2', url: 'https://kamikouryaku.net/darksouls2/', limit: 50 },
    { name: 'ダークソウル3', url: 'https://kamikouryaku.net/darksouls3/', limit: 50 },
    { name: 'ブラッドボーン', url: 'https://kamikouryaku.net/bloodborne/', limit: 50 },
    { name: 'SEKIRO', url: 'https://kamikouryaku.net/sekiro/', limit: 50 }
];

async function collectMultiGameData() {
    console.log('🎮 全FromSoftwareゲーム高速データ収集');
    console.log('=' .repeat(60));
    
    const allResults = [];
    
    // エルデンリングのデータを既存の進捗から取得
    try {
        const progressFiles = await fs.readdir('progress');
        const latestProgress = progressFiles
            .filter(file => file.startsWith('flavor_texts_progress_'))
            .sort()
            .pop();
        
        if (latestProgress) {
            const progressData = await fs.readJson(`progress/${latestProgress}`);
            const validEldenringResults = progressData.results.filter(item => {
                if (item.flavorText === '（フレーバーテキストなし）') return false;
                
                // 基本的な除外パターン
                const excludePatterns = [
                    /^編集$/, /^新規$/, /^MenuBar$/, /^コメント$/,
                    /^https?:\/\//, /^#[a-zA-Z0-9]+$/
                ];
                
                for (const pattern of excludePatterns) {
                    if (pattern.test(item.name) || pattern.test(item.flavorText)) {
                        return false;
                    }
                }
                
                return true;
            });
            
            // ゲーム名を正しく設定
            validEldenringResults.forEach(item => {
                item.game = 'エルデンリング';
            });
            
            allResults.push(...validEldenringResults);
            console.log(`✅ エルデンリング: ${validEldenringResults.length}件（進捗から取得）`);
        }
    } catch (error) {
        console.warn('⚠️ エルデンリングの進捗ファイル読み込みに失敗:', error.message);
    }
    
    // 他のゲームを個別に処理
    for (const game of games) {
        console.log(`\n🎯 ${game.name} を処理中...`);
        
        try {
            // 進捗をクリアして新しいゲーム用に準備
            await fs.remove('progress');
            await fs.ensureDir('progress');
            
            const scraper = new FromSoftwareFlavorTextScraper(game.url);
            
            // アイテムカテゴリを取得
            const itemLinks = await scraper.scrapeItemCategories();
            
            if (itemLinks.length === 0) {
                console.log(`⚠️ ${game.name}: アイテムが見つかりませんでした`);
                continue;
            }
            
            // 制限付きで処理
            const limitedLinks = itemLinks.slice(0, game.limit);
            console.log(`📋 ${limitedLinks.length}件を処理対象にします`);
            
            // フレーバーテキストを抽出
            await scraper.scrapeFlavorTexts(limitedLinks);
            
            // 有効なフレーバーテキストをフィルタリング
            const validResults = scraper.results.filter(item => {
                if (item.flavorText === '（フレーバーテキストなし）') return false;
                
                // 基本的な除外パターン
                const excludePatterns = [
                    /^編集$/, /^新規$/, /^MenuBar$/, /^コメント$/,
                    /^https?:\/\//, /^#[a-zA-Z0-9]+$/
                ];
                
                for (const pattern of excludePatterns) {
                    if (pattern.test(item.name) || pattern.test(item.flavorText)) {
                        return false;
                    }
                }
                
                return true;
            });
            
            // ゲーム名を正しく設定
            validResults.forEach(item => {
                item.game = game.name;
            });
            
            allResults.push(...validResults);
            console.log(`✅ ${game.name}: ${validResults.length}件の有効なフレーバーテキストを取得`);
            
        } catch (error) {
            console.error(`❌ ${game.name}の処理中にエラー:`, error.message);
        }
        
        // 短い待機
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log(`📊 総合計: ${allResults.length}件のフレーバーテキストを収集`);
    
    // 統計情報を表示
    const gameStats = {};
    allResults.forEach(item => {
        if (!gameStats[item.game]) {
            gameStats[item.game] = 0;
        }
        gameStats[item.game]++;
    });
    
    console.log('\n📈 ゲーム別統計:');
    Object.entries(gameStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([game, count]) => {
            console.log(`  - ${game}: ${count}件`);
        });
    
    // 最終出力ファイルを保存
    await saveAllResults(allResults);
    
    console.log('\n✅ 全ゲームの収集が完了しました！');
    return allResults;
}

async function saveAllResults(results) {
    await fs.ensureDir('output');
    
    // JSON形式で保存
    const jsonFilename = 'output/all_fromsoftware_flavor_texts.json';
    await fs.writeJson(jsonFilename, results, { spaces: 2 });
    
    // CSV形式で保存（UTF-8）
    const csvHeader = 'ゲーム,アイテム名,URL,フレーバーテキスト\n';
    const csvContent = results.map(item => 
        `"${item.game}","${item.name}","${item.url}","${item.flavorText.replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ).join('\n');
    
    const csvData = csvHeader + csvContent;
    const csvFilename = 'output/all_fromsoftware_flavor_texts.csv';
    await fs.writeFile(csvFilename, csvData, 'utf8');
    
    // Shift-JIS版も保存
    const csvBuffer = iconv.encode(csvData, 'shift_jis');
    const csvSjisFilename = 'output/all_fromsoftware_flavor_texts_sjis.csv';
    await fs.writeFile(csvSjisFilename, csvBuffer);
    
    console.log(`\n💾 統合結果を保存しました:`);
    console.log(`  - ${jsonFilename} (JSON形式, ${results.length}件)`);
    console.log(`  - ${csvFilename} (CSV形式, UTF-8, ${results.length}件)`);
    console.log(`  - ${csvSjisFilename} (CSV形式, Shift-JIS, ${results.length}件)`);
}

collectMultiGameData().catch(console.error);