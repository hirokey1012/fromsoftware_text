const DebateGameManager = require('./DebateGameManager');
const ClaudeApiClient = require('./ClaudeApiClient');
const ArgumentEvaluator = require('./ArgumentEvaluator');

class DemoModeManager {
    constructor() {
        this.gameManager = new DebateGameManager();
        this.claudeClient = new ClaudeApiClient(process.env.ANTHROPIC_API_KEY);
        this.evaluator = new ArgumentEvaluator(this.claudeClient);
        this.activeDemos = new Map();
        this.messageDelay = 3000; // 3秒間隔
    }

    async startDemo(ws, difficulty = 'normal') {
        try {
            const demoId = Date.now().toString();
            const topic = await this.gameManager.generateRandomTopic();
            
            // 見本モードでは賛成派と反対派の2つのAIを作成
            const demo = {
                id: demoId,
                topic: topic,
                difficulty: difficulty,
                forScore: 50,
                againstScore: 50,
                messages: [],
                messageCount: 0,
                maxMessages: 16, // 見本モードでは少し短めに
                ws: ws,
                isActive: true,
                currentTurn: 'for' // 'for' or 'against'
            };

            this.activeDemos.set(demoId, demo);
            
            // 初期メッセージを生成
            const initialMessage = await this.generateInitialMessage(demo);
            demo.messages.push({
                role: 'ai_for',
                content: initialMessage,
                timestamp: new Date().toISOString()
            });
            demo.messageCount++;
            demo.currentTurn = 'against';

            // 自動進行開始
            this.startAutoProgress(demoId);

            return {
                demoId: demo.id,
                topic: demo.topic,
                difficulty: demo.difficulty,
                forScore: demo.forScore,
                againstScore: demo.againstScore,
                initialMessage: initialMessage,
                maxMessages: demo.maxMessages
            };
        } catch (error) {
            console.error('Error starting demo:', error);
            throw error;
        }
    }

    async generateInitialMessage(demo) {
        const prompt = `あなたは四宮玲（賛成派）として、以下の議論を開始します。

議題: ${demo.topic}
あなたの立場: 賛成派
相手の立場: 反対派（もう一人の四宮玲）

四宮玲のキャラクター設定：
- 知的で洗練された女性
- 論理的思考を得意とする
- 時に挑発的だが、品格を保つ
- 議論に対して情熱的

議論の開始として、賛成派の立場から説得力のある論理的な主張を行ってください。
相手に対して挑戦的でありながら、建設的な議論を促すような発言をしてください。
150文字以内で簡潔に述べてください。`;

        return await this.claudeClient.sendEvaluationRequest(prompt);
    }

    async startAutoProgress(demoId) {
        const demo = this.activeDemos.get(demoId);
        if (!demo || !demo.isActive) return;

        setTimeout(async () => {
            await this.processNextMessage(demoId);
        }, this.messageDelay);
    }

    async processNextMessage(demoId) {
        const demo = this.activeDemos.get(demoId);
        if (!demo || !demo.isActive) return;

        try {
            // 現在のターンに応じてメッセージを生成
            const stance = demo.currentTurn;
            const message = await this.generateAIMessage(demo, stance);
            
            demo.messages.push({
                role: stance === 'for' ? 'ai_for' : 'ai_against',
                content: message,
                timestamp: new Date().toISOString()
            });
            demo.messageCount++;

            // 評価を実行
            const evaluation = await this.evaluateArguments(demo, message, stance);
            this.updateScores(demo, evaluation, stance);

            // 勝敗判定
            const gameResult = this.checkGameEnd(demo);
            
            // 両方のキャラクターの表情を決定
            const expressions = this.determineBothExpressions(demo, stance);

            // WebSocketで結果を送信
            if (demo.ws && demo.ws.readyState === 1) {
                demo.ws.send(JSON.stringify({
                    type: 'demo_message',
                    data: {
                        message: message,
                        stance: stance,
                        forScore: demo.forScore,
                        againstScore: demo.againstScore,
                        evaluation: evaluation,
                        gameResult: gameResult,
                        expressions: expressions,
                        messageCount: demo.messageCount,
                        maxMessages: demo.maxMessages
                    }
                }));
            }

            if (gameResult) {
                demo.isActive = false;
                this.activeDemos.delete(demoId);
                return;
            }

            // ターンを切り替え
            demo.currentTurn = stance === 'for' ? 'against' : 'for';

            // 次のメッセージを予約
            setTimeout(async () => {
                await this.processNextMessage(demoId);
            }, this.messageDelay);

        } catch (error) {
            console.error('Error processing demo message:', error);
            demo.isActive = false;
            this.activeDemos.delete(demoId);
        }
    }

    async generateAIMessage(demo, stance) {
        const stanceText = stance === 'for' ? '賛成' : '反対';
        const oppositeStance = stance === 'for' ? '反対' : '賛成';
        
        // メッセージ履歴を構築
        const messageHistory = demo.messages.map(msg => {
            const role = msg.role === 'ai_for' ? '賛成派の四宮玲' : '反対派の四宮玲';
            return `${role}: ${msg.content}`;
        }).join('\n\n');

        const prompt = `あなたは四宮玲（${stanceText}派）として、以下の議論に参加しています。

議題: ${demo.topic}
あなたの立場: ${stanceText}派
相手の立場: ${oppositeStance}派（もう一人の四宮玲）

これまでの議論:
${messageHistory}

四宮玲のキャラクター設定：
- 知的で洗練された女性
- 論理的思考を得意とする
- 時に挑発的だが、品格を保つ
- 議論に対して情熱的

相手の主張を踏まえて、${stanceText}派の立場から論理的で説得力のある反論または補強を行ってください。
新しい視点や具体例を交えて、議論を深めてください。
150文字以内で簡潔に述べてください。`;

        return await this.claudeClient.sendEvaluationRequest(prompt);
    }

    async evaluateArguments(demo, message, stance) {
        // 既存の評価システムを活用
        const previousMessage = demo.messages[demo.messages.length - 1];
        const topic = demo.topic;
        
        return await this.evaluator.evaluate(
            message,
            previousMessage ? previousMessage.content : '',
            demo.messages.slice(0, -1),
            topic,
            stance,
            stance === 'for' ? 'against' : 'for'
        );
    }

    updateScores(demo, evaluation, stance) {
        const scoreChange = evaluation.userPoints - evaluation.aiPoints;
        
        if (stance === 'for') {
            demo.forScore = Math.min(100, Math.max(0, demo.forScore + scoreChange));
            demo.againstScore = Math.min(100, Math.max(0, demo.againstScore - scoreChange));
        } else {
            demo.againstScore = Math.min(100, Math.max(0, demo.againstScore + scoreChange));
            demo.forScore = Math.min(100, Math.max(0, demo.forScore - scoreChange));
        }

        // 合計が100になるように調整
        const total = demo.forScore + demo.againstScore;
        if (total !== 100) {
            const adjustment = (100 - total) / 2;
            demo.forScore += adjustment;
            demo.againstScore += adjustment;
        }
    }

    checkGameEnd(demo) {
        // スコアに大差がついた場合
        if (Math.abs(demo.forScore - demo.againstScore) >= 50) {
            if (demo.forScore > demo.againstScore) {
                return { 
                    winner: 'for', 
                    message: '賛成派の四宮玲の勝利です！「論理的な勝利ですわ♪」' 
                };
            } else {
                return { 
                    winner: 'against', 
                    message: '反対派の四宮玲の勝利です！「完璧な反駁でした♪」' 
                };
            }
        }

        // メッセージ数上限に達した場合
        if (demo.messageCount >= demo.maxMessages) {
            if (demo.forScore > demo.againstScore) {
                return { 
                    winner: 'for', 
                    message: '賛成派の四宮玲の勝利です！「最終スコアで勝利しました♪」' 
                };
            } else if (demo.againstScore > demo.forScore) {
                return { 
                    winner: 'against', 
                    message: '反対派の四宮玲の勝利です！「最終スコアで勝利しました♪」' 
                };
            } else {
                return { 
                    winner: 'draw', 
                    message: '引き分けです！「互角の戦いでしたわ」' 
                };
            }
        }

        return null;
    }

    determineBothExpressions(demo, activeStance) {
        // 両方のキャラクターの表情を決定
        const forScore = demo.forScore;
        const againstScore = demo.againstScore;
        const scoreDiff = forScore - againstScore;
        
        let forExpression, againstExpression;
        
        // スコア差に基づいて表情を決定
        if (scoreDiff > 20) {
            // 賛成派が有利
            forExpression = 'winning';
            againstExpression = 'losing';
        } else if (scoreDiff < -20) {
            // 反対派が有利
            forExpression = 'losing';
            againstExpression = 'winning';
        } else {
            // 僅差または同点
            forExpression = 'normal';
            againstExpression = 'normal';
        }
        
        // 発言したキャラクターは少し自信を持った表情にする
        if (activeStance === 'for' && forExpression === 'normal') {
            forExpression = 'confident';
        } else if (activeStance === 'against' && againstExpression === 'normal') {
            againstExpression = 'confident';
        }
        
        return {
            for: forExpression,
            against: againstExpression
        };
    }

    stopDemo(demoId) {
        const demo = this.activeDemos.get(demoId);
        if (demo) {
            demo.isActive = false;
            this.activeDemos.delete(demoId);
        }
    }

    getDemo(demoId) {
        return this.activeDemos.get(demoId);
    }

    cleanup() {
        // 古いデモをクリーンアップ
        for (const [demoId, demo] of this.activeDemos) {
            if (!demo.isActive) {
                this.activeDemos.delete(demoId);
            }
        }
    }
}

module.exports = DemoModeManager;