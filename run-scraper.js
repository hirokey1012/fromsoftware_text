import { spawn } from 'child_process';
import fs from 'fs-extra';

class AutoRetryRunner {
    constructor() {
        this.maxRetries = 5;
        this.retryCount = 0;
    }

    async run() {
        console.log('🚀 自動再試行機能付きスクレイパーを開始します');
        
        while (this.retryCount < this.maxRetries) {
            try {
                console.log(`\n📍 実行試行 ${this.retryCount + 1}/${this.maxRetries}`);
                
                const success = await this.runScraper();
                if (success) {
                    console.log('✅ スクレイピングが正常に完了しました！');
                    return;
                }
                
                this.retryCount++;
                if (this.retryCount < this.maxRetries) {
                    console.log(`⏳ 3秒後に再試行します...`);
                    await this.sleep(3000);
                }
                
            } catch (error) {
                console.error(`❌ エラー発生:`, error.message);
                this.retryCount++;
                
                if (this.retryCount < this.maxRetries) {
                    console.log(`⏳ 3秒後に再試行します...`);
                    await this.sleep(3000);
                }
            }
        }
        
        console.log(`\n🔄 最大再試行回数 (${this.maxRetries}) に達しました`);
        console.log('💡 手動で npm start を実行して継続してください');
    }

    async runScraper() {
        return new Promise((resolve, reject) => {
            const child = spawn('node', ['scraper.js'], {
                stdio: 'inherit',
                cwd: process.cwd()
            });

            let completed = false;

            // 15分でタイムアウト
            const timeout = setTimeout(() => {
                if (!completed) {
                    console.log('\n⏰ タイムアウトが発生しました。再試行します...');
                    child.kill('SIGTERM');
                    completed = true;
                    resolve(false);
                }
            }, 15 * 60 * 1000); // 15分

            child.on('close', (code) => {
                if (!completed) {
                    clearTimeout(timeout);
                    completed = true;
                    
                    if (code === 0) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            });

            child.on('error', (error) => {
                if (!completed) {
                    clearTimeout(timeout);
                    completed = true;
                    reject(error);
                }
            });
        });
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 実行
const runner = new AutoRetryRunner();
runner.run().catch(console.error);