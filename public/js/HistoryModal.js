class HistoryModal {
    constructor(modalElement, listElement, closeBtn, clearBtn, gameHistory) {
        this.modal = modalElement;
        this.list = listElement;
        this.closeBtn = closeBtn;
        this.clearBtn = clearBtn;
        this.gameHistory = gameHistory;
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        this.closeBtn.addEventListener('click', () => this.hide());
        this.clearBtn.addEventListener('click', () => this.clearHistory());
        
        // モーダル外クリックで閉じる
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }

    show() {
        this.modal.style.display = 'block';
        this.render();
    }

    hide() {
        this.modal.style.display = 'none';
    }

    clearHistory() {
        if (confirm('戦績をすべて削除しますか？')) {
            this.gameHistory.clear();
            this.render();
        }
    }

    render() {
        const history = this.gameHistory.getAll();
        
        if (history.length === 0) {
            this.list.innerHTML = '<p class="no-history">まだ戦績がありません</p>';
            return;
        }

        this.list.innerHTML = history.map(game => this.renderHistoryItem(game)).join('');
    }

    renderHistoryItem(game) {
        const date = new Date(game.date);
        const dateStr = date.toLocaleDateString('ja-JP') + ' ' + 
                       date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const resultIcon = game.winner === 'user' ? '🎉' : '😤';
        const resultText = game.winner === 'user' ? '勝利' : '敗北';
        const resultClass = game.winner === 'user' ? 'win' : 'lose';
        
        return `
            <div class="history-item ${resultClass}">
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
    }
}