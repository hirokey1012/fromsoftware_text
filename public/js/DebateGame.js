class DebateGame {
    constructor() {
        this.gameId = null;
        this.userStance = null;
        this.aiStance = null;
        this.ui = new GameUI();
        this.wsManager = new WebSocketManager();
        this.usageMonitor = new UsageMonitor(this.wsManager);
        
        this.setupEventHandlers();
        this.setupWebSocketHandlers();
    }

    setupEventHandlers() {
        this.ui.onStartGame(() => this.startGame());
        this.ui.onNewGame(() => this.newGame());
        this.ui.onSendMessage(() => this.sendMessage());
        this.ui.onReturnHome(() => this.returnHome());
    }

    setupWebSocketHandlers() {
        this.wsManager.on('game_started', (data) => {
            this.gameId = data.gameId;
            this.userStance = data.userStance;
            this.aiStance = data.aiStance;
            const userStanceText = data.userStance === 'for' ? '賛成' : '反対';
            const aiStanceText = data.aiStance === 'for' ? '賛成' : '反対';
            
            this.ui.updateTopic(`${data.topic}`, `あなた: ${userStanceText}派`, `四宮玲: ${aiStanceText}派`);
            this.ui.updateDifficultyDisplay(data.difficulty);
            this.ui.showGameArea();
            this.ui.updateScores(data.userScore, data.aiScore, data.maxScore);
            this.ui.updateStatus(`四宮玲: 「さあ、始めましょうか。私は${aiStanceText}派として戦います」`);
        });

        this.wsManager.on('ai_response', (data) => {
            this.ui.addAiMessage(data.aiMessage, data.expression, this.aiStance);
            this.ui.updateScores(data.userScore, data.aiScore, 100);
            this.ui.updateCharacterExpression(data.expression);
            this.ui.setSendButtonState(false, '送信');
            
            if (data.gameResult) {
                this.handleGameEnd(data.gameResult, data.userScore, data.aiScore);
            } else {
                this.ui.updateStatus('あなたの番です');
            }
        });

        this.wsManager.on('connection_lost', () => {
            this.ui.updateStatus('接続が切断されました');
        });

        this.wsManager.on('connection_error', () => {
            this.ui.updateStatus('エラーが発生しました');
        });
    }

    startGame() {
        const selectedStance = this.ui.getSelectedStance();
        const selectedDifficulty = this.ui.getSelectedDifficulty();
        
        this.ui.setStartButtonState(true, 'ゲーム準備中...');
        this.ui.clearMessages();
        
        this.wsManager.connect();
        
        setTimeout(() => {
            if (this.wsManager.isConnected()) {
                this.wsManager.send('start_game', { 
                    userStance: selectedStance,
                    difficulty: selectedDifficulty
                });
            }
        }, 1000);
    }

    sendMessage() {
        const message = this.ui.getUserInput();
        
        if (!message) {
            alert('メッセージを入力してください');
            return;
        }

        this.ui.addUserMessage(message, this.userStance);
        this.ui.clearUserInput();
        this.ui.setSendButtonState(true, '送信中...');
        this.ui.updateStatus('四宮玲が考えています...');

        if (this.wsManager.isConnected()) {
            this.wsManager.send('user_message', {
                gameId: this.gameId,
                message: message
            });
        }
    }

    handleGameEnd(result, userScore, aiScore) {
        this.ui.showResult(result, userScore, aiScore);
        this.ui.showGameResult();
    }

    newGame() {
        this.ui.showGameSetup();
        this.ui.resetGame();
        
        if (this.wsManager.isConnected()) {
            this.wsManager.close();
        }
    }

    returnHome() {
        this.ui.showGameSetup();
        this.ui.resetGame();
        
        if (this.wsManager.isConnected()) {
            this.wsManager.close();
        }
    }
}

// アプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    new DebateGame();
});