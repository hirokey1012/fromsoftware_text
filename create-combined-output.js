import fs from 'fs-extra';
import iconv from 'iconv-lite';

async function createCombinedOutput() {
    console.log('📦 統合出力ファイルを作成中...');
    
    // 利用可能な最新のプログレスファイルを探す
    const progressFiles = await fs.readdir('progress');
    const latestProgress = progressFiles
        .filter(file => file.startsWith('flavor_texts_progress_'))
        .sort()
        .pop();
    
    if (!latestProgress) {
        console.log('❌ プログレスファイルが見つかりません');
        return;
    }
    
    console.log(`📄 使用するファイル: ${latestProgress}`);
    const data = await fs.readJson(`progress/${latestProgress}`);
    
    // 有効なフレーバーテキストをフィルタリング
    const validResults = data.results.filter(item => {
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
    
    console.log(`✅ フィルタリング完了: ${data.results.length}件 → ${validResults.length}件`);
    
    // 出力ディレクトリを作成
    await fs.ensureDir('output');
    
    // JSON形式で保存
    const jsonFilename = 'output/fromsoftware_flavor_texts.json';
    await fs.writeJson(jsonFilename, validResults, { spaces: 2 });
    
    // CSV形式で保存（UTF-8）
    const csvHeader = 'ゲーム,アイテム名,URL,フレーバーテキスト\\n';
    const csvContent = validResults.map(item => 
        `"${item.game}","${item.name}","${item.url}","${item.flavorText.replace(/"/g, '""').replace(/\\n/g, '\\\\n')}"`
    ).join('\\n');
    
    const csvData = csvHeader + csvContent;
    const csvFilename = 'output/fromsoftware_flavor_texts.csv';
    await fs.writeFile(csvFilename, csvData, 'utf8');
    
    // Shift-JIS版も保存
    const csvBuffer = iconv.encode(csvData, 'shift_jis');
    const csvSjisFilename = 'output/fromsoftware_flavor_texts_sjis.csv';
    await fs.writeFile(csvSjisFilename, csvBuffer);
    
    console.log(`\\n💾 結果を保存しました:`);
    console.log(`  - ${jsonFilename} (JSON形式)`);
    console.log(`  - ${csvFilename} (CSV形式, UTF-8)`);
    console.log(`  - ${csvSjisFilename} (CSV形式, Shift-JIS)`);
    
    // 統計情報を表示
    const gameStats = {};
    validResults.forEach(item => {
        if (!gameStats[item.game]) {
            gameStats[item.game] = 0;
        }
        gameStats[item.game]++;
    });
    
    console.log(`\\n📊 統計情報:`);
    console.log(`  - 総フレーバーテキスト数: ${validResults.length}件`);
    console.log(`  - 対象ゲーム数: ${Object.keys(gameStats).length}ゲーム`);
    console.log(`\\n📈 ゲーム別統計:`);
    
    Object.entries(gameStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([game, count]) => {
            console.log(`  - ${game}: ${count}件`);
        });
}

createCombinedOutput().catch(console.error);