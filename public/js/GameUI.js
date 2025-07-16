class GameUI {
    constructor() {
        this.elements = this.initializeElements();
        this.gameHistory = new GameHistory();
        this.characterDisplay = new CharacterDisplay(
            this.elements.characterImage,
            this.elements.characterEmoji
        );
        this.historyModal = new HistoryModal(
            this.elements.historyModal,
            this.elements.historyList,
            this.elements.closeHistoryBtn,
            this.elements.clearHistoryBtn,
            this.gameHistory
        );
        
        this.attachEventListeners();
        this.updateHistoryButton();
    }

    initializeElements() {
        return {
            gameSetup: document.getElementById('gameSetup'),
            gameArea: document.getElementById('gameArea'),
            gameResult: document.getElementById('gameResult'),
            startBtn: document.getElementById('startBtn'),
            newGameBtn: document.getElementById('newGameBtn'),
            historyBtn: document.getElementById('historyBtn'),
            currentTopic: document.getElementById('currentTopic'),
            messages: document.getElementById('messages'),
            userInput: document.getElementById('userInput'),
            sendBtn: document.getElementById('sendBtn'),
            returnHomeBtn: document.getElementById('returnHomeBtn'),
            status: document.getElementById('status'),
            userScore: document.getElementById('userScore'),
            aiScore: document.getElementById('aiScore'),
            userProgress: document.getElementById('userProgress'),
            aiProgress: document.getElementById('aiProgress'),
            resultTitle: document.getElementById('resultTitle'),
            resultMessage: document.getElementById('resultMessage'),
            finalScores: document.getElementById('finalScores'),
            historyModal: document.getElementById('historyModal'),
            historyList: document.getElementById('historyList'),
            closeHistoryBtn: document.getElementById('closeHistoryBtn'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),
            characterImage: document.getElementById('characterImage'),
            characterEmoji: document.querySelector('.character-emoji'),
            difficultyIndicator: document.getElementById('difficultyIndicator')
        };
    }

    attachEventListeners() {
        this.elements.historyBtn.addEventListener('click', () => this.showHistory());
        this.elements.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.sendMessageCallback) {
                    this.sendMessageCallback();
                }
            }
        });
        
        this.elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                if (this.sendMessageCallback) {
                    this.sendMessageCallback();
                }
            }
        });
    }

    // セッター（コールバック登録）
    onStartGame(callback) {
        this.elements.startBtn.addEventListener('click', callback);
    }

    onNewGame(callback) {
        this.elements.newGameBtn.addEventListener('click', callback);
    }

    onSendMessage(callback) {
        this.elements.sendBtn.addEventListener('click', callback);
        this.sendMessageCallback = callback;
    }

    onReturnHome(callback) {
        this.elements.returnHomeBtn.addEventListener('click', callback);
    }

    // 画面遷移
    showGameSetup() {
        this.elements.gameSetup.style.display = 'block';
        this.elements.gameArea.style.display = 'none';
        this.elements.gameResult.style.display = 'none';
    }

    showGameArea() {
        this.elements.gameSetup.style.display = 'none';
        this.elements.gameArea.style.display = 'block';
        this.elements.gameResult.style.display = 'none';
    }

    showGameResult() {
        this.elements.gameSetup.style.display = 'none';
        this.elements.gameArea.style.display = 'none';
        this.elements.gameResult.style.display = 'block';
    }

    // UI更新
    updateTopic(topic, userStance, aiStance) {
        this.elements.currentTopic.textContent = topic;
        
        // VS表示の更新
        const userStanceElement = document.getElementById('userStance');
        const aiStanceElement = document.getElementById('aiStance');
        
        if (userStanceElement && aiStanceElement) {
            userStanceElement.textContent = userStance;
            aiStanceElement.textContent = aiStance;
        }
    }
    
    updateDifficultyDisplay(difficulty) {
        const difficultyNames = {
            easy: '初級',
            normal: '中級',
            hard: '上級'
        };
        
        if (this.elements.difficultyIndicator) {
            this.elements.difficultyIndicator.textContent = `難易度: ${difficultyNames[difficulty] || '中級'}`;
        }
    }

    updateStatus(text) {
        this.elements.status.textContent = text;
    }

    updateScores(userScore, aiScore, maxScore = 100) {
        this.elements.userScore.textContent = userScore;
        this.elements.aiScore.textContent = aiScore;
        
        // 競合形式のバー表示（合計100%で分割）
        const totalScore = userScore + aiScore;
        const userPercent = totalScore > 0 ? (userScore / totalScore) * 100 : 50;
        const aiPercent = totalScore > 0 ? (aiScore / totalScore) * 100 : 50;
        
        this.elements.userProgress.style.width = `${userPercent}%`;
        this.elements.aiProgress.style.width = `${aiPercent}%`;
    }

    updateCharacterExpression(expression) {
        this.characterDisplay.updateExpression(expression);
    }

    // メッセージ
    addUserMessage(message, userStance = 'for') {
        const stanceText = userStance === 'for' ? '賛成' : '反対';
        const messageDiv = this.createMessageElement('user', '👤', `あなた (${stanceText}派)`, message);
        this.elements.messages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addAiMessage(message, expression = 'normal', aiStance = 'against') {
        const stanceText = aiStance === 'for' ? '賛成' : '反対';
        const messageDiv = this.createAiMessageElement('👩‍💼', `四宮玲 (${stanceText}派)`, message, expression);
        this.elements.messages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    createMessageElement(type, icon, name, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span>${icon}</span>
                <span>${name}</span>
            </div>
            <div class="message-content">${content}</div>
        `;
        
        return messageDiv;
    }
    
    createAiMessageElement(icon, name, content, expression) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        
        const expressionImagePath = `/images/${expression}/${expression}.png`;
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">
                    <img src="${expressionImagePath}" alt="四宮玲" class="message-expression" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                    <span class="message-emoji" style="display: none;">${icon}</span>
                </div>
                <span>${name}</span>
            </div>
            <div class="message-content">${content}</div>
        `;
        
        return messageDiv;
    }

    scrollToBottom() {
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }

    clearMessages() {
        this.elements.messages.innerHTML = '';
    }

    // 入力関連
    getUserInput() {
        return this.elements.userInput.value.trim();
    }

    clearUserInput() {
        this.elements.userInput.value = '';
    }

    getSelectedStance() {
        return document.querySelector('input[name="stance"]:checked').value;
    }

    getSelectedDifficulty() {
        return document.querySelector('input[name="difficulty"]:checked').value;
    }

    // ボタン状態
    setStartButtonState(disabled, text) {
        this.elements.startBtn.disabled = disabled;
        this.elements.startBtn.textContent = text;
    }

    setSendButtonState(disabled, text) {
        this.elements.sendBtn.disabled = disabled;
        this.elements.sendBtn.textContent = text;
    }

    setNewGameButtonState(disabled, text) {
        this.elements.newGameBtn.disabled = disabled;
        this.elements.newGameBtn.textContent = text;
    }

    // 結果表示
    showResult(result, userScore, aiScore) {
        if (result.winner === 'user') {
            this.elements.resultTitle.textContent = '🎉 勝利！';
            this.elements.resultTitle.style.color = '#4caf50';
        } else {
            this.elements.resultTitle.textContent = '😤 敗北...';
            this.elements.resultTitle.style.color = '#f44336';
        }
        
        this.elements.resultMessage.textContent = result.message;
        
        this.elements.finalScores.innerHTML = `
            <div class="final-score">
                <span class="score-label">あなた:</span>
                <span class="score-value user-score">${userScore}</span>
            </div>
            <div class="final-score">
                <span class="score-label">四宮玲:</span>
                <span class="score-value ai-score">${aiScore}</span>
            </div>
        `;
        
        this.gameHistory.save(result.winner, userScore, aiScore, this.elements.currentTopic.textContent);
        this.updateHistoryButton();
    }

    // 戦績関連
    updateHistoryButton() {
        const stats = this.gameHistory.getStats();
        if (stats.total === 0) {
            this.elements.historyBtn.textContent = '戦績を見る';
        } else {
            this.elements.historyBtn.textContent = `戦績を見る (${stats.wins}勝${stats.total - stats.wins}敗)`;
        }
    }

    showHistory() {
        this.historyModal.show();
    }

    // リセット
    resetGame() {
        this.clearUserInput();
        this.setSendButtonState(false, '送信');
        this.setStartButtonState(false, 'ゲーム開始');
        this.setNewGameButtonState(false, '新しいゲーム');
    }
}