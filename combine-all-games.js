import fs from 'fs-extra';
import iconv from 'iconv-lite';

async function combineAllGames() {
    console.log('🎮 全ゲームのフレーバーテキストを統合中...');
    console.log('=' .repeat(60));
    
    const allResults = [];
    
    // 個別ゲームファイルを読み込み
    const gameFiles = [
        'darksouls_flavor_texts.json',
        'darksouls2_flavor_texts.json', 
        'darksouls3_flavor_texts.json',
        'bloodborne_flavor_texts.json',
        'sekiro_flavor_texts.json'
    ];
    
    for (const file of gameFiles) {
        const filePath = `output/${file}`;
        try {
            if (await fs.pathExists(filePath)) {
                const data = await fs.readJson(filePath);
                console.log(`📄 ${file}: ${data.length}件`);
                allResults.push(...data);
            }
        } catch (error) {
            console.warn(`⚠️ ${file}の読み込みに失敗:`, error.message);
        }
    }
    
    // エルデンリングのデータを進捗ファイルから取得
    try {
        const progressFiles = await fs.readdir('progress');
        const eldenringProgress = progressFiles
            .filter(file => file.startsWith('flavor_texts_progress_'))
            .sort()
            .pop();
        
        if (eldenringProgress) {
            const progressData = await fs.readJson(`progress/${eldenringProgress}`);
            
            // 有効なフレーバーテキストをフィルタリング
            const validEldenringResults = progressData.results.filter(item => {
                if (item.flavorText === '（フレーバーテキストなし）') return false;
                
                // 除外パターンをチェック
                const excludePatterns = [
                    /^編集$/, /^新規$/, /^名前変更$/, /^添付$/, /^一覧$/, /^差分$/, /^履歴$/, /^凍結$/,
                    /^MenuBar$/, /^コメント$/, /^アップデート情報$/, /^実績・トロフィー$/, /^ビルド$/,
                    /^用語集$/, /^更新履歴$/, /^Edit MenuBar$/,
                    /^https?:\/\//, /^#[a-zA-Z0-9]+$/, /^[a-zA-Z0-9]{8}$/,
                    /^コメント\//, /ちなみに|続いて注意点|呪剣士は視界察知型/
                ];
                
                for (const pattern of excludePatterns) {
                    if (pattern.test(item.name) || pattern.test(item.flavorText)) {
                        return false;
                    }
                }
                
                // 攻略解説らしい長いテキストを除外
                if (item.flavorText.length > 200 && 
                    (item.flavorText.includes('攻撃') || item.flavorText.includes('ダメージ') || 
                     item.flavorText.includes('効果') || item.flavorText.includes('注意') || 
                     item.flavorText.includes('対策') || item.flavorText.includes('戦略'))) {
                    return false;
                }
                
                return true;
            });
            
            console.log(`📄 エルデンリング(進捗): ${validEldenringResults.length}件`);
            allResults.push(...validEldenringResults);
        }
    } catch (error) {
        console.warn('⚠️ エルデンリングの進捗ファイル読み込みに失敗:', error.message);
    }
    
    console.log('=' .repeat(60));
    console.log(`📊 総合計: ${allResults.length}件のフレーバーテキストを統合`);
    
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
    
    console.log('\n✅ 全ゲームの統合が完了しました！');
}

async function saveResults(results) {
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
    console.log(`  - ${jsonFilename} (JSON形式)`);
    console.log(`  - ${csvFilename} (CSV形式, UTF-8)`);
    console.log(`  - ${csvSjisFilename} (CSV形式, Shift-JIS)`);
}

combineAllGames().catch(console.error);