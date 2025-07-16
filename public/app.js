class DebateGame {
    constructor() {
        this.ws = null;
        this.gameId = null;
        this.gameHistory = JSON.parse(localStorage.getItem('debateGameHistory') || '[]');
        this.initializeElements();
        this.attachEventListeners();
        this.initializeCharacterImage();
        this.updateHistoryDisplay();
    }

    initializeElements() {
        this.gameSetup = document.getElementById('gameSetup');
        this.gameArea = document.getElementById('gameArea');
        this.gameResult = document.getElementById('gameResult');
        this.startBtn = document.getElementById('startBtn');
        this.newGameBtn = document.getElementById('newGameBtn');
        this.currentTopic = document.getElementById('currentTopic');
        this.messages = document.getElementById('messages');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.status = document.getElementById('status');
        this.userScore = document.getElementById('userScore');
        this.aiScore = document.getElementById('aiScore');
        this.userProgress = document.getElementById('userProgress');
        this.aiProgress = document.getElementById('aiProgress');
        this.resultTitle = document.getElementById('resultTitle');
        this.resultMessage = document.getElementById('resultMessage');
        this.finalScores = document.getElementById('finalScores');
        this.historyBtn = document.getElementById('historyBtn');
        this.historyModal = document.getElementById('historyModal');
        this.historyList = document.getElementById('historyList');
        this.closeHistoryBtn = document.getElementById('closeHistoryBtn');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.characterImage = document.getElementById('characterImage');
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.newGameBtn.addEventListener('click', () => this.newGame());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.historyBtn.addEventListener('click', () => this.showHistory());
        this.closeHistoryBtn.addEventListener('click', () => this.hideHistory());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateStatus('接続が切断されました');
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('エラーが発生しました');
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'game_started':
                this.gameId = data.data.gameId;
                const userStanceText = data.data.userStance === 'for' ? '賛成' : '反対';
                const aiStanceText = data.data.aiStance === 'for' ? '賛成' : '反対';
                
                this.currentTopic.textContent = `${data.data.topic} (あなた: ${userStanceText}派 vs 四宮玲: ${aiStanceText}派)`;
                this.gameSetup.style.display = 'none';
                this.gameArea.style.display = 'block';
                this.updateScores(data.data.userScore, data.data.aiScore, data.data.maxScore);
                this.updateStatus(`四宮玲: 「さあ、始めましょうか。私は${aiStanceText}派として戦いますわ」`);
                break;

            case 'ai_response':
                this.addAiMessage(data.data.aiMessage);
                this.updateScores(data.data.userScore, data.data.aiScore, 100);
                this.updateCharacterExpression(data.data.expression);
                this.sendBtn.disabled = false;
                this.sendBtn.textContent = '送信';
                
                if (data.data.gameResult) {
                    this.showGameResult(data.data.gameResult);
                } else {
                    this.updateStatus('あなたの番です');
                }
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    }

    startGame() {
        const selectedStance = document.querySelector('input[name="stance"]:checked').value;
        
        this.startBtn.disabled = true;
        this.startBtn.textContent = 'ゲーム準備中...';
        this.messages.innerHTML = '';
        
        this.connectWebSocket();
        
        setTimeout(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'start_game',
                    userStance: selectedStance
                }));
            }
        }, 1000);
    }

    sendMessage() {
        const message = this.userInput.value.trim();
        
        if (!message) {
            alert('メッセージを入力してください');
            return;
        }

        this.addUserMessage(message);
        this.userInput.value = '';
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = '送信中...';
        this.updateStatus('四宮玲が考えています...');

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'user_message',
                gameId: this.gameId,
                message: message
            }));
        }
    }

    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.innerHTML = `
            <span>👤</span>
            <span>あなた</span>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        
        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(contentDiv);
        
        this.messages.appendChild(messageDiv);
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    addAiMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.innerHTML = `
            <span>👩‍💼</span>
            <span>四宮玲</span>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        
        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(contentDiv);
        
        this.messages.appendChild(messageDiv);
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    updateScores(userScore, aiScore, maxScore) {
        this.userScore.textContent = userScore;
        this.aiScore.textContent = aiScore;
        
        const userPercent = (userScore / maxScore) * 50;
        const aiPercent = (aiScore / maxScore) * 50;
        
        this.userProgress.style.width = `${userPercent}%`;
        this.aiProgress.style.width = `${aiPercent}%`;
    }

    showGameResult(result) {
        this.gameArea.style.display = 'none';
        this.gameResult.style.display = 'block';
        
        if (result.winner === 'user') {
            this.resultTitle.textContent = '🎉 勝利！';
            this.resultTitle.style.color = '#4caf50';
        } else {
            this.resultTitle.textContent = '😤 敗北...';
            this.resultTitle.style.color = '#f44336';
        }
        
        this.resultMessage.textContent = result.message;
        
        // 最終スコアを表示
        const userScore = parseInt(this.userScore.textContent);
        const aiScore = parseInt(this.aiScore.textContent);
        this.finalScores.innerHTML = `
            <div class="final-score">
                <span class="score-label">あなた:</span>
                <span class="score-value user-score">${userScore}</span>
            </div>
            <div class="final-score">
                <span class="score-label">四宮玲:</span>
                <span class="score-value ai-score">${aiScore}</span>
            </div>
        `;
        
        // 戦績を保存
        this.saveGameResult(result.winner, userScore, aiScore);
    }

    newGame() {
        this.gameResult.style.display = 'none';
        this.gameSetup.style.display = 'block';
        this.startBtn.disabled = false;
        this.startBtn.textContent = 'ゲーム開始';
        this.userInput.value = '';
        this.sendBtn.disabled = false;
        this.sendBtn.textContent = '送信';
        
        if (this.ws) {
            this.ws.close();
        }
    }

    updateStatus(text) {
        this.status.textContent = text;
    }

    updateCharacterExpression(expression) {
        if (!this.characterImage) return;
        
        const basePath = `images/${expression}/${expression}`;
        const supportedFormats = ['png', 'jpg', 'jpeg'];
        
        this.tryLoadImage(basePath, supportedFormats, 0);
    }

    tryLoadImage(basePath, formats, index) {
        if (index >= formats.length) {
            // すべての形式で失敗した場合、デフォルトの絵文字を表示
            this.characterImage.style.display = 'none';
            this.characterImage.nextElementSibling.style.display = 'block';
            return;
        }

        const testImage = new Image();
        const currentFormat = formats[index];
        const imagePath = `${basePath}.${currentFormat}`;
        
        testImage.onload = () => {
            // 画像の読み込み成功
            this.characterImage.src = imagePath;
            this.characterImage.style.display = 'block';
            this.characterImage.nextElementSibling.style.display = 'none';
            
            // 画像の切り替えエフェクト
            this.characterImage.style.opacity = '0.5';
            setTimeout(() => {
                this.characterImage.style.opacity = '1';
            }, 200);
        };
        
        testImage.onerror = () => {
            // 次の形式を試す
            this.tryLoadImage(basePath, formats, index + 1);
        };
        
        testImage.src = imagePath;
    }

    initializeCharacterImage() {
        // 初期画像をnormalに設定
        this.updateCharacterExpression('normal');
    }

    saveGameResult(winner, userScore, aiScore) {
        const gameResult = {
            date: new Date().toISOString(),
            winner: winner,
            userScore: userScore,
            aiScore: aiScore,
            topic: this.currentTopic.textContent
        };
        
        this.gameHistory.unshift(gameResult);
        
        // 最新50件まで保持
        if (this.gameHistory.length > 50) {
            this.gameHistory = this.gameHistory.slice(0, 50);
        }
        
        localStorage.setItem('debateGameHistory', JSON.stringify(this.gameHistory));
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        if (!this.historyBtn) return;
        
        const wins = this.gameHistory.filter(game => game.winner === 'user').length;
        const total = this.gameHistory.length;
        
        if (total === 0) {
            this.historyBtn.textContent = '戦績を見る';
        } else {
            this.historyBtn.textContent = `戦績を見る (${wins}勝${total - wins}敗)`;
        }
    }

    showHistory() {
        this.historyModal.style.display = 'block';
        this.renderHistoryList();
    }

    hideHistory() {
        this.historyModal.style.display = 'none';
    }

    clearHistory() {
        if (confirm('戦績をすべて削除しますか？')) {
            this.gameHistory = [];
            localStorage.removeItem('debateGameHistory');
            this.updateHistoryDisplay();
            this.renderHistoryList();
        }
    }

    renderHistoryList() {
        if (this.gameHistory.length === 0) {
            this.historyList.innerHTML = '<p class="no-history">まだ戦績がありません</p>';
            return;
        }

        this.historyList.innerHTML = this.gameHistory.map((game, index) => {
            const date = new Date(game.date);
            const dateStr = date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            const resultIcon = game.winner === 'user' ? '🎉' : '😤';
            const resultText = game.winner === 'user' ? '勝利' : '敗北';
            const resultClass = game.winner === 'user' ? 'win' : 'lose';
            
            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-result ${resultClass}">${resultIcon} ${resultText}</span>
                        <span class="history-date">${dateStr}</span>
                    </div>
                    <div class="history-topic">${game.topic}</div>
                    <div class="history-score">
                        <span class="user-score">あなた: ${game.userScore}</span>
                        <span class="ai-score">四宮玲: ${game.aiScore}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// アプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    new DebateGame();
});