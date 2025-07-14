import { FromSoftwareFlavorTextScraper } from './scraper.js';
import fs from 'fs-extra';
import iconv from 'iconv-lite';

const games = [
    { name: 'エルデンリング', url: 'https://kamikouryaku.net/eldenring/' },
    { name: 'ダークソウル', url: 'https://kamikouryaku.net/darksouls/' },
    { name: 'ダークソウル2', url: 'https://kamikouryaku.net/darksouls2/' },
    { name: 'ダークソウル3', url: 'https://kamikouryaku.net/darksouls3/' },
    { name: 'ブラッドボーン', url: 'https://kamikouryaku.net/bloodborne/' },
    { name: 'SEKIRO', url: 'https://kamikouryaku.net/sekiro/' }
];

async function scrapeAllGames() {
    console.log('🎮 全FromSoftwareゲームのフレーバーテキスト抽出開始');
    console.log('=' .repeat(60));
    
    const allResults = [];
    
    for (const game of games) {
        console.log(`\n🎯 ${game.name} の抽出を開始...`);
        
        try {
            const scraper = new FromSoftwareFlavorTextScraper(game.url);
            
            // アイテムカテゴリを取得
            const itemLinks = await scraper.scrapeItemCategories();
            if (itemLinks.length === 0) {
                console.log(`⚠️ ${game.name}: アイテムが見つかりませんでした`);
                continue;
            }
            
            // フレーバーテキストを抽出
            await scraper.scrapeFlavorTexts(itemLinks);
            
            // 有効なフレーバーテキストをフィルタリング
            const validResults = scraper.results.filter(item => {
                if (item.flavorText === '（フレーバーテキストなし）') return false;
                return scraper.isValidFlavorText(item.flavorText);
            });
            
            console.log(`✅ ${game.name}: ${validResults.length}件の有効なフレーバーテキストを取得`);
            allResults.push(...validResults);
            
        } catch (error) {
            console.error(`❌ ${game.name}の抽出中にエラーが発生:`, error.message);
        }
    }
    
    console.log('\n📊 全ゲーム抽出完了');
    console.log('=' .repeat(60));
    
    // 結果を保存
    await saveResults(allResults);
    
    // 統計情報を表示
    showStatistics(allResults);
}

async function saveResults(results) {
    // outputディレクトリを作成
    await fs.ensureDir('output');
    
    // JSON形式で保存
    const jsonFilename = 'output/all_fromsoftware_flavor_texts.json';
    await fs.writeJson(jsonFilename, results, { spaces: 2 });
    
    // CSV形式で保存（UTF-8）
    const csvHeader = 'ゲーム,アイテム名,URL,フレーバーテキスト\n';
    const csvContent = results.map(item => 
        `"${item.game}","${item.name}","${item.url}","${item.flavorText.replace(/"/g, '""').replace(/\n/g, '\\n')}"`
    ).join('\n');
    
    const csvData = csvHeader + csvContent;
    const csvFilename = 'output/all_fromsoftware_flavor_texts.csv';
    await fs.writeFile(csvFilename, csvData, 'utf8');
    
    // Shift-JIS版も保存
    const csvBuffer = iconv.encode(csvData, 'shift_jis');
    const csvSjisFilename = 'output/all_fromsoftware_flavor_texts_sjis.csv';
    await fs.writeFile(csvSjisFilename, csvBuffer);
    
    console.log(`\n💾 結果を保存しました:`);
    console.log(`  - ${jsonFilename} (JSON形式)`);
    console.log(`  - ${csvFilename} (CSV形式, UTF-8)`);
    console.log(`  - ${csvSjisFilename} (CSV形式, Shift-JIS)`);
}

function showStatistics(results) {
    const gameStats = {};
    
    results.forEach(item => {
        if (!gameStats[item.game]) {
            gameStats[item.game] = 0;
        }
        gameStats[item.game]++;
    });
    
    console.log(`\n📈 統計情報:`);
    console.log(`  - 総フレーバーテキスト数: ${results.length}件`);
    console.log(`  - 対象ゲーム数: ${Object.keys(gameStats).length}ゲーム`);
    console.log(`\n📊 ゲーム別統計:`);
    
    Object.entries(gameStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([game, count]) => {
            console.log(`  - ${game}: ${count}件`);
        });
}

// 実行
scrapeAllGames().catch(console.error);