const DebateGameManager = require('./DebateGameManager');
const ClaudeApiClient = require('./ClaudeApiClient');
const ArgumentEvaluator = require('./ArgumentEvaluator');

class GameHandler {
    constructor() {
        this.gameManager = new DebateGameManager();
        this.claudeClient = new ClaudeApiClient(process.env.ANTHROPIC_API_KEY);
        this.evaluator = new ArgumentEvaluator(this.claudeClient);
    }

    async startGame(ws, userStance, difficulty) {
        try {
            const game = await this.gameManager.createGame(ws, userStance, difficulty);
            
            return {
                gameId: game.id,
                topic: game.topic,
                userStance: game.userStance,
                aiStance: game.aiStance,
                difficulty: game.difficulty,
                userScore: game.userScore,
                aiScore: game.aiScore,
                maxScore: game.maxScore
            };
        } catch (error) {
            console.error('Error starting game:', error);
            throw error;
        }
    }

    async handleUserMessage(gameId, userMessage) {
        try {
            const game = this.gameManager.getGame(gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            // メッセージ数をカウント
            game.messageCount++;

            // ユーザーメッセージを保存
            game.messages.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date().toISOString()
            });

            // 遅延を削除してレスポンス高速化
            // await this.gameManager.sleep(2000 + Math.random() * 1000);

            // AIの応答を生成
            const aiResponse = await this.claudeClient.sendMessage(
                userMessage, 
                game.topic, 
                game.messages, 
                game
            );
            
            game.messages.push({
                role: 'ai',
                content: aiResponse,
                timestamp: new Date().toISOString()
            });

            // 評価を実行
            const evaluation = await this.evaluator.evaluate(
                userMessage, 
                aiResponse, 
                game.messages.slice(0, -1), // 最新のメッセージを除いた履歴
                game.topic,
                game.userStance,
                game.aiStance
            );
            const previousUserScore = game.userScore;
            const previousAiScore = game.aiScore;
            
            // スコアを更新（通常の変動幅に戻す）
            // 評価ポイントに基づいて適度な変動を計算
            const userChange = (evaluation.userPoints - evaluation.aiPoints) * 0.5; // 変動幅を0.5倍に調整
            const aiChange = (evaluation.aiPoints - evaluation.userPoints) * 0.5;
            
            game.userScore = Math.min(100, Math.max(0, game.userScore + userChange));
            game.aiScore = Math.min(100, Math.max(0, game.aiScore + aiChange));
            
            // 合計が100になるように調整
            const total = game.userScore + game.aiScore;
            if (total !== 100) {
                const adjustment = (100 - total) / 2;
                game.userScore += adjustment;
                game.aiScore += adjustment;
            }

            // 勝敗判定
            let gameResult = null;
            let expression = null;
            
            // 条件1: スコアに大差がついた場合（20点以上の差）
            if (Math.abs(game.userScore - game.aiScore) >= 20) {
                if (game.userScore > game.aiScore) {
                    gameResult = { winner: 'user', message: 'あなたの勝利です！見事な論破でした！' };
                    expression = 'losing'; // 負けた時の表情
                } else {
                    gameResult = { winner: 'ai', message: '四宮玲の勝利です。「完璧な論理展開でしたわ♪」' };
                    expression = 'winning'; // 勝った時の表情
                }
                this.gameManager.deleteGame(gameId);
            }
            // 条件2: メッセージ数上限に達した場合
            else if (game.messageCount >= game.maxMessages) {
                if (game.userScore > game.aiScore) {
                    gameResult = { winner: 'user', message: 'あなたの勝利です！最終スコアで勝利しました！' };
                    expression = 'losing'; // 負けた時の表情
                } else if (game.aiScore > game.userScore) {
                    gameResult = { winner: 'ai', message: '四宮玲の勝利です。「最終スコアで勝たせていただきました♪」' };
                    expression = 'winning'; // 勝った時の表情
                } else {
                    gameResult = { winner: 'draw', message: '引き分けです。「互角の戦いでしたわ」' };
                    expression = 'normal'; // 引き分けの時の表情
                }
                this.gameManager.deleteGame(gameId);
            }
            
            // 勝敗が決まっていない場合は通常の表情決定
            if (!expression) {
                expression = this.evaluator.determineExpression(
                    game.userScore, 
                    game.aiScore, 
                    previousUserScore, 
                    previousAiScore
                );
            }

            return {
                aiMessage: aiResponse,
                userScore: game.userScore,
                aiScore: game.aiScore,
                evaluation,
                gameResult,
                expression,
                messageCount: game.messageCount,
                maxMessages: game.maxMessages
            };
        } catch (error) {
            console.error('Error handling user message:', error);
            throw error;
        }
    }

    async getUsageInfo() {
        try {
            const usageInfo = await this.claudeClient.getUsageInfo();
            return usageInfo;
        } catch (error) {
            console.error('Error getting usage info:', error);
            return null;
        }
    }

    cleanup() {
        // 古いゲームをクリーンアップ（実装は省略）
        // 実際の運用では、一定時間後にゲームを削除する処理を追加
    }
}

module.exports = GameHandler;