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

async function collectAllGames() {
    console.log('🎮 全FromSoftwareゲームからフレーバーテキストを収集中...');
    console.log('=' .repeat(70));
    
    const allResults = [];
    
    for (const game of games) {
        console.log(`\n🎯 ${game.name} の収集開始...`);
        
        try {
            // 進捗とoutputをクリア（各ゲーム毎に独立させるため）
            await fs.remove('progress');
            await fs.ensureDir('progress');
            
            const scraper = new FromSoftwareFlavorTextScraper(game.url);
            
            // アイテムカテゴリを取得
            const itemLinks = await scraper.scrapeItemCategories();
            
            if (itemLinks.length === 0) {
                console.log(`⚠️ ${game.name}: アイテムが見つかりませんでした`);
                continue;
            }
            
            console.log(`📊 ${itemLinks.length}件のアイテムを発見`);
            
            // 制限付きで処理（各ゲーム200件まで）
            const limitedLinks = itemLinks.slice(0, 200);
            console.log(`📋 ${limitedLinks.length}件を処理対象にします`);
            
            // フレーバーテキストを抽出
            await scraper.scrapeFlavorTexts(limitedLinks);
            
            // 有効なフレーバーテキストをフィルタリング
            const validResults = scraper.results.filter(item => {
                if (item.flavorText === '（フレーバーテキストなし）') return false;
                return scraper.isValidFlavorText(item.flavorText);
            });
            
            console.log(`✅ ${game.name}: ${validResults.length}件の有効なフレーバーテキストを取得`);
            
            // ゲーム名が正しく設定されているか確認
            validResults.forEach(item => {
                if (item.game !== game.name) {
                    console.log(`🔧 ゲーム名を修正: ${item.game} → ${game.name}`);
                    item.game = game.name;
                }
            });
            
            allResults.push(...validResults);
            
            // 各ゲームの個別保存
            await fs.ensureDir('temp');
            await fs.writeJson(`temp/${game.name}_results.json`, validResults, { spaces: 2 });
            
        } catch (error) {
            console.error(`❌ ${game.name}の収集中にエラー:`, error.message);
        }
        
        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '=' .repeat(70));
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

collectAllGames().catch(console.error);