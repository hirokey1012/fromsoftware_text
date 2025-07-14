import fs from 'fs-extra';
import iconv from 'iconv-lite';

async function convertCsvToShiftJis() {
    try {
        console.log('既存のCSVファイルをShift-JISに変換中...');
        
        // 元のUTF-8ファイルを読み込み
        const utf8Content = await fs.readFile('./flavor_texts.csv', 'utf8');
        
        // Shift-JISにエンコード
        const sjisBuffer = iconv.encode(utf8Content, 'shift_jis');
        
        // 元のファイルをバックアップ
        await fs.copy('./flavor_texts.csv', './flavor_texts_utf8_backup.csv');
        
        // Shift-JISで保存
        await fs.writeFile('./flavor_texts.csv', sjisBuffer);
        
        console.log('✅ 変換完了！');
        console.log('  - flavor_texts.csv → Shift-JIS形式に変換');
        console.log('  - flavor_texts_utf8_backup.csv → UTF-8バックアップ作成');
        
    } catch (error) {
        console.error('❌ 変換エラー:', error.message);
    }
}

// 実行
convertCsvToShiftJis();