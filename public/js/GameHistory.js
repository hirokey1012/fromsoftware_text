class GameHistory {
    constructor() {
        this.history = JSON.parse(localStorage.getItem('debateGameHistory') || '[]');
    }

    save(winner, userScore, aiScore, topic) {
        const gameResult = {
            date: new Date().toISOString(),
            winner: winner,
            userScore: userScore,
            aiScore: aiScore,
            topic: topic
        };
        
        this.history.unshift(gameResult);
        
        // 最新50件まで保持
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }
        
        localStorage.setItem('debateGameHistory', JSON.stringify(this.history));
    }

    getStats() {
        const wins = this.history.filter(game => game.winner === 'user').length;
        const total = this.history.length;
        return { wins, total };
    }

    getAll() {
        return this.history;
    }

    clear() {
        this.history = [];
        localStorage.removeItem('debateGameHistory');
    }
}