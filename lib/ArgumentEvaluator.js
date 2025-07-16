class ArgumentEvaluator {
    constructor(claudeApiClient) {
        this.claudeClient = claudeApiClient;
    }

    async evaluate(userMessage, aiMessage, conversationHistory, topic, userStance, aiStance) {
        try {
            const evaluationPrompt = this.buildEvaluationPrompt(
                userMessage, 
                aiMessage, 
                conversationHistory, 
                topic, 
                userStance, 
                aiStance
            );
            
            const response = await this.claudeClient.sendEvaluationRequest(evaluationPrompt);
            return this.parseEvaluationResponse(response);
        } catch (error) {
            console.error('Evaluation error:', error);
            // フォールバック評価
            return this.fallbackEvaluation(userMessage, aiMessage);
        }
    }

    buildEvaluationPrompt(userMessage, aiMessage, conversationHistory, topic, userStance, aiStance) {
        const historyText = conversationHistory.map(msg => 
            `${msg.role === 'user' ? 'ユーザー' : '四宮玲'}: ${msg.content}`
        ).join('\n');
        
        const userStanceText = userStance === 'for' ? '賛成' : '反対';
        const aiStanceText = aiStance === 'for' ? '賛成' : '反対';
        
        return `あなたは議論の公正な審判です。以下の議論を評価してください。

議題: ${topic}
ユーザーの立場: ${userStanceText}派
四宮玲の立場: ${aiStanceText}派

過去の議論履歴:
${historyText}

最新の発言:
ユーザー: ${userMessage}
四宮玲: ${aiMessage}

評価基準:
1. 論理的な一貫性と根拠の明確さ
2. 相手の論点への適切な反駁
3. 新しい視点や証拠の提示
4. 論理的な構造と説得力
5. 議論の文脈での適切性

以下の形式で評価してください：
{
  "userPoints": [0-30の数値],
  "aiPoints": [0-30の数値],
  "reasoning": "評価の理由を簡潔に説明"
}

公正で客観的な評価をお願いします。`;
    }

    parseEvaluationResponse(response) {
        try {
            // JSON形式のレスポンスを解析
            const jsonMatch = response.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
                // 改行文字や特殊文字をクリーンアップ
                const cleanJson = jsonMatch[0]
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t')
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                
                console.log('Attempting to parse JSON:', cleanJson);
                const evaluation = JSON.parse(cleanJson);
                return {
                    userPoints: Math.max(0, Math.min(30, evaluation.userPoints || 0)),
                    aiPoints: Math.max(0, Math.min(30, evaluation.aiPoints || 0)),
                    reasoning: evaluation.reasoning || 'No reasoning provided'
                };
            }
        } catch (error) {
            console.error('Failed to parse evaluation response:', error);
            console.error('Response was:', response);
        }
        
        // パース失敗時のフォールバック
        return this.fallbackEvaluation();
    }
    
    fallbackEvaluation(userMessage = '', aiMessage = '') {
        // 簡単なフォールバック評価 - より劇的な変動幅
        const userPoints = Math.floor(Math.random() * 26); // 0-25
        const aiPoints = Math.floor(Math.random() * 26); // 0-25
        
        return {
            userPoints,
            aiPoints,
            reasoning: 'フォールバック評価が使用されました'
        };
    }

    determineExpression(userScore, aiScore, prevUserScore, prevAiScore) {
        const userScoreDiff = userScore - prevUserScore;
        const aiScoreDiff = aiScore - prevAiScore;
        const userAdvantage = userScore - aiScore;
        
        // 劣勢（ユーザーが大きく得点、またはAIが大きく負けている）
        if (userScoreDiff >= 8 || userAdvantage >= 25) {
            return 'losing';
        }
        
        // 優勢（AIが大きく得点、またはユーザーを大きく上回っている）
        if (aiScoreDiff >= 8 || userAdvantage <= -25) {
            return 'winning';
        }
        
        // 余裕の笑み（AIが少し有利）
        if (userAdvantage <= -8) {
            return 'smug';
        }
        
        // 少し不利（ユーザーが少し有利）
        if (userAdvantage >= 8) {
            return 'worried';
        }
        
        // 通常の表情
        return 'normal';
    }
}

module.exports = ArgumentEvaluator;