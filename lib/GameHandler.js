const DebateGameManager = require('./DebateGameManager');
const ClaudeApiClient = require('./ClaudeApiClient');
const ArgumentEvaluator = require('./ArgumentEvaluator');
const DemoModeManager = require('./DemoModeManager');

class GameHandler {
    constructor() {
        this.gameManager = new DebateGameManager();
        this.claudeClient = new ClaudeApiClient(process.env.ANTHROPIC_API_KEY);
        this.evaluator = new ArgumentEvaluator(this.claudeClient);
        this.demoManager = new DemoModeManager();
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
            const userChange = evaluation.userPoints - evaluation.aiPoints;
            const aiChange = evaluation.aiPoints - evaluation.userPoints;
            
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
            
            // 条件1: スコアに大差がついた場合（50点以上の差）
            if (Math.abs(game.userScore - game.aiScore) >= 50) {
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

    async generateInitialMessage(gameId) {
        try {
            const game = this.gameManager.getGame(gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            // 初期メッセージ生成用のプロンプト
            const initialPrompt = `あなたは四宮玲として、以下の議論を開始します。

議題: ${game.topic}
あなたの立場: ${game.aiStance === 'for' ? '賛成' : '反対'}派
相手の立場: ${game.userStance === 'for' ? '賛成' : '反対'}派

四宮玲のキャラクター設定：
- 知的で洗練された女性
- 論理的思考を得意とする
- 時に挑発的だが、品格を保つ
- 議論に対して情熱的

議論の開始として、あなたの立場を明確にしつつ、相手に対して論理的な挑戦を投げかけてください。
長すぎず（150文字以内）、興味深い議論のきっかけとなるような発言をしてください。`;

            const aiMessage = await this.claudeClient.sendEvaluationRequest(initialPrompt);
            
            return {
                aiMessage: aiMessage,
                userScore: game.userScore,
                aiScore: game.aiScore,
                expression: 'normal',
                messageCount: 0,
                maxMessages: game.maxMessages
            };
        } catch (error) {
            console.error('Error generating initial message:', error);
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

    async startDemo(ws, difficulty) {
        try {
            const demo = await this.demoManager.startDemo(ws, difficulty);
            return demo;
        } catch (error) {
            console.error('Error starting demo:', error);
            throw error;
        }
    }

    stopDemo(demoId) {
        try {
            this.demoManager.stopDemo(demoId);
        } catch (error) {
            console.error('Error stopping demo:', error);
            throw error;
        }
    }

    cleanup() {
        // 古いゲームをクリーンアップ（実装は省略）
        // 実際の運用では、一定時間後にゲームを削除する処理を追加
        this.demoManager.cleanup();
    }
}

module.exports = GameHandler;