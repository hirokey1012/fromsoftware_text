const axios = require('axios');

class ClaudeApiClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.anthropic.com/v1';
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
    }

    async sendMessage(userMessage, topic, context, game) {
        const stanceText = game.aiStance === 'for' ? '賛成' : '反対';
        const userStanceText = game.userStance === 'for' ? '賛成' : '反対';
        const difficultySettings = this.getDifficultySettings(game.difficulty);
        
        const systemPrompt = `あなたは四宮玲（しのみや れい）という名前の親しみやすいAIキャラクターです。

キャラクター設定:
- 知識豊富で議論が好きだが、攻撃的すぎない
- 相手の意見も尊重しながら、自分の立場を説明する
- 時には論理的でない発言もする、等身大のキャラクター
- 親しみやすい敬語で話す

議題: ${topic}

あなたの立場: ${stanceText}派
相手の立場: ${userStanceText}派

難易度設定: ${difficultySettings.name}
- ${difficultySettings.description}
- 反論の強さ: ${difficultySettings.strength}
- 論理レベル: ${difficultySettings.logicLevel}

あなたは${stanceText}の立場から議論しますが、相手を論破することが目的ではありません。
難易度に応じて以下のように対話してください：
- 初級：優しく、時には論理的でない発言も含めて親しみやすく
- 中級：論理的だが相手の意見も認めつつ
- 上級：しっかりとした論理で、でも攻撃的にならずに

【重要】100文字以内で回答してください。文字数が多い場合は要約してください。親しみやすい敬語で話してください。`;

        const conversationHistory = context.map(msg => 
            `${msg.role === 'user' ? 'ユーザー' : '四宮玲'}: ${msg.content}`
        ).join('\n');

        return await this.makeRequestWithRetry(async () => {
            if (!this.apiKey) {
                throw new Error('ANTHROPIC_API_KEY not found');
            }

            const messages = [
                {
                    role: 'user',
                    content: systemPrompt
                }
            ];

            // 過去の会話履歴を追加
            context.forEach(msg => {
                if (msg.role === 'user') {
                    messages.push({
                        role: 'user',
                        content: `ユーザーの発言: ${msg.content}`
                    });
                } else {
                    messages.push({
                        role: 'assistant',
                        content: msg.content
                    });
                }
            });

            // 最新のユーザー発言を追加
            messages.push({
                role: 'user',
                content: `ユーザーの発言: ${userMessage}\n\nあなたの立場から、この発言に対して意見を述べてください。攻撃的にならず、親しみやすく話してください。`
            });

            const response = await axios.post(`${this.baseURL}/messages`, {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 600,
                messages: messages
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 10000
            });

            let aiResponse = response.data.content[0].text;
            
            // 使用量を記録
            if (response.data.usage) {
                this.totalInputTokens += response.data.usage.input_tokens || 0;
                this.totalOutputTokens += response.data.usage.output_tokens || 0;
            }
            
            // 文字数が100文字を超える場合は要約
            if (aiResponse.length > 100) {
                aiResponse = aiResponse.substring(0, 97) + '...';
            }
            
            return aiResponse;
        }, userMessage, topic);
    }
    
    async sendEvaluationRequest(prompt) {
        return await this.makeRequestWithRetry(async () => {
            if (!this.apiKey) {
                throw new Error('ANTHROPIC_API_KEY not found');
            }

            const response = await axios.post(`${this.baseURL}/messages`, {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 200,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 8000
            });

            const result = response.data.content[0].text;
            
            // 使用量を記録
            if (response.data.usage) {
                this.totalInputTokens += response.data.usage.input_tokens || 0;
                this.totalOutputTokens += response.data.usage.output_tokens || 0;
            }
            
            return result;
        });
    }

    async getUsageInfo() {
        try {
            if (!this.apiKey) {
                throw new Error('ANTHROPIC_API_KEY not found');
            }

            // 実際の使用量を返す（制限値は仮設定）
            return {
                usage: {
                    input_tokens: this.totalInputTokens,
                    output_tokens: this.totalOutputTokens,
                    limit: 1000000 // 月間制限（実際の値に合わせて調整）
                },
                period: 'monthly'
            };
        } catch (error) {
            console.error('Claude API Usage Error:', error.response?.data || error.message);
            return null;
        }
    }

    getDifficultySettings(difficulty) {
        const settings = {
            easy: {
                name: "初級",
                description: "親しみやすく、時には論理的でない発言も含める",
                strength: "優しめ",
                logicLevel: "感覚的なレベル"
            },
            normal: {
                name: "中級",
                description: "論理的だが相手の意見も認める",
                strength: "バランス型",
                logicLevel: "適度な論理レベル"
            },
            hard: {
                name: "上級",
                description: "しっかりした論理で、でも攻撃的にならない",
                strength: "論理的",
                logicLevel: "高論理レベル"
            }
        };
        
        return settings[difficulty] || settings.normal;
    }

    async makeRequestWithRetry(requestFn, userMessage = '', topic = '') {
        const maxRetries = 3;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                console.error(`Claude API attempt ${attempt + 1} failed:`, error.response?.data || error.message);
                
                if (attempt === maxRetries) {
                    break;
                }
                
                // 指数バックオフで待機
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                await this.sleep(delay);
            }
        }
        
        console.error('All retry attempts failed, using fallback response');
        return this.getFallbackResponse(userMessage, topic);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getFallbackResponse(userMessage = '', topic = '') {
        const fallbackResponses = [
            `「${userMessage}」について、私はちょっと違う意見があります。`,
            `${topic}については、私は別の見方をしています。`,
            `その考え方も分かりますが、私は少し違う視点で考えています。`,
            `興味深いご意見ですね。私はこう思うのですが、いかがでしょうか？`,
            `その点については、私もう少し考えてみる必要があるかもしれません。`
        ];
        
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
    
    // 議論開始時の四宮玲の発言を生成
    async generateInitialStatement(topic, stance) {
        const stanceText = stance === 'for' ? '賛成' : '反対';
        const prompt = `議題「${topic}」について、${stanceText}の立場から親しみやすく簡潔な意見を述べてください。攻撃的にならず、100文字以内で話してください。`;
        
        try {
            return await this.sendEvaluationRequest(prompt);
        } catch (error) {
            return `${topic}について、私は${stanceText}の立場です。よろしくお願いします。`;
        }
    }
}

module.exports = ClaudeApiClient;