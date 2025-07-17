class DemoMode {
    constructor(wsManager) {
        this.wsManager = wsManager;
        this.demoId = null;
        this.isActive = false;
        this.setupEventHandlers();
        this.setupCharacterDisplays();
    }

    setupCharacterDisplays() {
        // 賛成派キャラクターの表示
        this.forCharacterDisplay = new CharacterDisplay(
            document.getElementById('demoForCharacterImage'),
            document.getElementById('demoForCharacterEmoji')
        );
        
        // 反対派キャラクターの表示
        this.againstCharacterDisplay = new CharacterDisplay(
            document.getElementById('demoAgainstCharacterImage'),
            document.getElementById('demoAgainstCharacterEmoji')
        );
        
        // 初期表情を設定
        this.forCharacterDisplay.updateExpression('normal');
        this.againstCharacterDisplay.updateExpression('normal');
    }

    setupEventHandlers() {
        // 見本モード開始ボタン
        document.getElementById('demoBtnOpener').addEventListener('click', () => {
            this.startDemo();
        });

        // デモ停止ボタン
        document.getElementById('stopDemoBtn').addEventListener('click', () => {
            this.stopDemo();
        });

        // トップページに戻るボタン
        document.getElementById('returnFromDemoBtn').addEventListener('click', () => {
            this.returnHome();
        });
    }

    startDemo() {
        // 難易度を取得
        const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
        
        this.showDemoArea();
        this.updateDemoStatus('デモを開始しています...');
        
        // WebSocket接続
        this.wsManager.connect();
        
        setTimeout(() => {
            if (this.wsManager.isConnected()) {
                this.wsManager.send('start_demo', { 
                    difficulty: selectedDifficulty
                });
            }
        }, 1000);
    }

    stopDemo() {
        if (this.demoId && this.isActive) {
            this.wsManager.send('stop_demo', { demoId: this.demoId });
            this.isActive = false;
            this.updateDemoStatus('デモが停止されました');
        }
    }

    returnHome() {
        this.stopDemo();
        this.showGameSetup();
        this.resetDemo();
        
        if (this.wsManager.isConnected()) {
            this.wsManager.close();
        }
    }

    showDemoArea() {
        document.getElementById('gameSetup').style.display = 'none';
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('demoArea').style.display = 'block';
        document.getElementById('gameResult').style.display = 'none';
    }

    showGameSetup() {
        document.getElementById('gameSetup').style.display = 'block';
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('demoArea').style.display = 'none';
        document.getElementById('gameResult').style.display = 'none';
    }

    resetDemo() {
        this.demoId = null;
        this.isActive = false;
        this.clearDemoMessages();
        this.updateDemoScores(50, 50);
        this.updateDemoStatus('デモの準備中...');
    }

    handleDemoStarted(data) {
        this.demoId = data.demoId;
        this.isActive = true;
        
        this.updateDemoTopic(data.topic);
        this.updateDemoDifficulty(data.difficulty);
        this.updateDemoScores(data.forScore, data.againstScore);
        this.updateDemoStatus('デモが開始されました');
        
        // 初期表情を設定（賛成派がconfident、反対派がnormal）
        this.updateCharacterExpressions({
            for: 'confident',
            against: 'normal'
        });
        
        // 初期メッセージを表示
        this.addDemoMessage(data.initialMessage, 'for');
    }

    handleDemoMessage(data) {
        this.addDemoMessage(data.message, data.stance);
        this.updateDemoScores(data.forScore, data.againstScore);
        
        // 表情を更新
        if (data.expressions) {
            this.updateCharacterExpressions(data.expressions);
        }
        
        if (data.gameResult) {
            this.handleDemoEnd(data.gameResult);
        } else {
            const nextStance = data.stance === 'for' ? '反対派' : '賛成派';
            this.updateDemoStatus(`${nextStance}が反論を考えています...`);
        }
    }

    handleDemoEnd(result) {
        this.isActive = false;
        this.updateDemoStatus(result.message);
        
        // 勝利メッセージを追加
        const winnerMessage = document.createElement('div');
        winnerMessage.className = 'demo-message winner-message';
        winnerMessage.innerHTML = `
            <div class="demo-message-header">
                <div class="demo-stance-badge ${result.winner}">勝利</div>
                <div class="demo-message-time">${new Date().toLocaleTimeString()}</div>
            </div>
            <div class="demo-message-content">
                <strong>${result.message}</strong>
            </div>
        `;
        
        document.getElementById('demoMessages').appendChild(winnerMessage);
        this.scrollToBottom();
    }

    updateDemoTopic(topic) {
        document.getElementById('demoTopic').textContent = topic;
    }

    updateDemoDifficulty(difficulty) {
        const difficultyMap = {
            'easy': '初級',
            'normal': '中級',
            'hard': '上級'
        };
        document.getElementById('demoDifficultyIndicator').textContent = 
            `難易度: ${difficultyMap[difficulty] || '中級'}`;
    }

    updateDemoScores(forScore, againstScore) {
        document.getElementById('forScore').textContent = Math.round(forScore);
        document.getElementById('againstScore').textContent = Math.round(againstScore);
        
        // プログレスバーを更新
        const forProgress = document.getElementById('forProgress');
        const againstProgress = document.getElementById('againstProgress');
        
        forProgress.style.width = `${forScore}%`;
        againstProgress.style.width = `${againstScore}%`;
    }

    addDemoMessage(message, stance) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `demo-message ${stance}-stance`;
        
        const stanceText = stance === 'for' ? '賛成派' : '反対派';
        const stanceClass = stance === 'for' ? 'for' : 'against';
        
        messageDiv.innerHTML = `
            <div class="demo-message-header">
                <div class="demo-stance-badge ${stanceClass}">${stanceText}</div>
                <div class="demo-message-time">${new Date().toLocaleTimeString()}</div>
            </div>
            <div class="demo-message-content">${message}</div>
        `;
        
        document.getElementById('demoMessages').appendChild(messageDiv);
        this.scrollToBottom();
    }

    clearDemoMessages() {
        document.getElementById('demoMessages').innerHTML = '';
    }

    updateDemoStatus(status) {
        document.getElementById('demoStatus').textContent = status;
    }

    updateCharacterExpressions(expressions) {
        if (expressions.for) {
            this.forCharacterDisplay.updateExpression(expressions.for);
        }
        if (expressions.against) {
            this.againstCharacterDisplay.updateExpression(expressions.against);
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('demoMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}