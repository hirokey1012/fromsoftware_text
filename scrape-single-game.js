import { FromSoftwareFlavorTextScraper } from './scraper.js';
import fs from 'fs-extra';

const gameUrls = {
    'eldenring': 'https://kamikouryaku.net/eldenring/',
    'darksouls': 'https://kamikouryaku.net/darksouls/',
    'darksouls2': 'https://kamikouryaku.net/darksouls2/',
    'darksouls3': 'https://kamikouryaku.net/darksouls3/',
    'bloodborne': 'https://kamikouryaku.net/bloodborne/',
    'sekiro': 'https://kamikouryaku.net/sekiro/'
};

const gameNames = {
    'eldenring': 'エルデンリング',
    'darksouls': 'ダークソウル',
    'darksouls2': 'ダークソウル2',
    'darksouls3': 'ダークソウル3',
    'bloodborne': 'ブラッドボーン',
    'sekiro': 'SEKIRO'
};

async function scrapeSingleGame(gameKey) {
    const gameUrl = gameUrls[gameKey];
    const gameName = gameNames[gameKey];
    
    if (!gameUrl || !gameName) {
        console.error(`❌ 無効なゲームキー: ${gameKey}`);
        console.log('利用可能なゲーム:', Object.keys(gameUrls).join(', '));
        return;
    }
    
    console.log(`🎯 ${gameName} の抽出を開始...`);
    console.log(`📍 URL: ${gameUrl}`);
    console.log('=' .repeat(60));
    
    try {
        const scraper = new FromSoftwareFlavorTextScraper(gameUrl);
        
        // アイテムカテゴリを取得
        const itemLinks = await scraper.scrapeItemCategories();
        if (itemLinks.length === 0) {
            console.log(`⚠️ ${gameName}: アイテムが見つかりませんでした`);
            return;
        }
        
        console.log(`📊 ${itemLinks.length}個のアイテムを発見`);
        
        // フレーバーテキストを抽出
        await scraper.scrapeFlavorTexts(itemLinks);
        
        // 有効なフレーバーテキストをフィルタリング
        const validResults = scraper.results.filter(item => {
            if (item.flavorText === '（フレーバーテキストなし）') return false;
            return scraper.isValidFlavorText(item.flavorText);
        });
        
        console.log(`✅ ${gameName}: ${validResults.length}件の有効なフレーバーテキストを取得`);
        
        // 個別ファイルとして保存
        await fs.ensureDir('output');
        const filename = `output/${gameKey}_flavor_texts.json`;
        await fs.writeJson(filename, validResults, { spaces: 2 });
        
        console.log(`💾 ${filename} に保存完了`);
        console.log('=' .repeat(60));
        
        return validResults;
        
    } catch (error) {
        console.error(`❌ ${gameName}の抽出中にエラーが発生:`, error.message);
        return [];
    }
}

// コマンドライン引数からゲームキーを取得
const gameKey = process.argv[2];
if (!gameKey) {
    console.log('使用方法: node scrape-single-game.js <ゲームキー>');
    console.log('利用可能なゲーム:', Object.keys(gameUrls).join(', '));
    process.exit(1);
}

scrapeSingleGame(gameKey).catch(console.error);