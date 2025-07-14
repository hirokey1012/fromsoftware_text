import { FromSoftwareFlavorTextScraper } from './scraper.js';
import fs from 'fs-extra';
import iconv from 'iconv-lite';

const games = [
    { name: 'ダークソウル', url: 'https://kamikouryaku.net/darksouls/' },
    { name: 'ダークソウル2', url: 'https://kamikouryaku.net/darksouls2/' },
    { name: 'ダークソウル3', url: 'https://kamikouryaku.net/darksouls3/' },
    { name: 'ブラッドボーン', url: 'https://kamikouryaku.net/bloodborne/' },
    { name: 'SEKIRO', url: 'https://kamikouryaku.net/sekiro/' }
];

async function quickScrapeGames() {
    console.log('🚀 軽量版全ゲームスクレイピング開始');
    console.log('=' .repeat(60));
    
    const allResults = [];
    
    for (const game of games) {
        console.log(`\n🎯 ${game.name} を処理中...`);
        
        try {
            const scraper = new FromSoftwareFlavorTextScraper(game.url);
            
            // アイテムカテゴリを取得（制限付き）
            const itemLinks = await scraper.scrapeItemCategories();
            
            // 最初の100件のみ処理（高速化）
            const limitedLinks = itemLinks.slice(0, 100);
            console.log(`📊 ${limitedLinks.length}件のアイテムを処理（制限付き）`);
            
            // フレーバーテキストを抽出
            await scraper.scrapeFlavorTexts(limitedLinks);
            
            // 有効なフレーバーテキストをフィルタリング
            const validResults = scraper.results.filter(item => {
                if (item.flavorText === '（フレーバーテキストなし）') return false;
                return scraper.isValidFlavorText(item.flavorText);
            });
            
            console.log(`✅ ${game.name}: ${validResults.length}件の有効なフレーバーテキストを取得`);
            allResults.push(...validResults);
            
        } catch (error) {
            console.error(`❌ ${game.name}の処理中にエラー:`, error.message);
        }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log(`📊 総合計: ${allResults.length}件のフレーバーテキストを取得`);
    
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
    
    // 保存
    await saveResults(allResults);
    
    console.log('\n✅ 軽量版スクレイピングが完了しました！');
    return allResults;
}

async function saveResults(results) {
    await fs.ensureDir('output');
    
    // JSON形式で保存
    const jsonFilename = 'output/multi_game_flavor_texts.json';
    await fs.writeJson(jsonFilename, results, { spaces: 2 });
    
    // CSV形式で保存（UTF-8）
    const csvHeader = 'ゲーム,アイテム名,URL,フレーバーテキスト\n';
    const csvContent = results.map(item => 
        `"${item.game}","${item.name}","${item.url}","${item.flavorText.replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ).join('\n');
    
    const csvData = csvHeader + csvContent;
    const csvFilename = 'output/multi_game_flavor_texts.csv';
    await fs.writeFile(csvFilename, csvData, 'utf8');
    
    // Shift-JIS版も保存
    const csvBuffer = iconv.encode(csvData, 'shift_jis');
    const csvSjisFilename = 'output/multi_game_flavor_texts_sjis.csv';
    await fs.writeFile(csvSjisFilename, csvBuffer);
    
    console.log(`\n💾 結果を保存しました:`);
    console.log(`  - ${jsonFilename} (JSON形式)`);
    console.log(`  - ${csvFilename} (CSV形式, UTF-8)`);
    console.log(`  - ${csvSjisFilename} (CSV形式, Shift-JIS)`);
}

quickScrapeGames().catch(console.error);