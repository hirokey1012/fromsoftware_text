class DebateGameManager {
    constructor() {
        this.games = new Map();
        this.topics = [
            "AIの発展は人類にとって良いことか？",
            "リモートワークは従来の働き方より優れているか？",
            "SNSは社会に有益か？",
            "ベーシックインカムは導入すべきか？",
            "電子書籍は紙の本に勝るか？",
            "自動運転車は早急に普及させるべきか？",
            "オンライン授業は対面授業より効果的か？",
            "暗号通貨は従来の通貨に取って代わるか？",
            "人工知能に芸術作品は作れるか？",
            "宇宙開発に多額の投資をするべきか？",
            "核エネルギーは持続可能なエネルギー源か？",
            "遺伝子編集技術は医療に積極的に活用すべきか？",
            "死刑制度は維持されるべきか？",
            "グローバル化は発展途上国にとって有益か？",
            "メタバースは現実世界の代替になりうるか？",
            "完全自動化社会は実現すべきか？",
            "プライバシーは安全保障より重要か？",
            "人工肉は従来の畜産業に取って代わるべきか？",
            "月面基地建設は優先すべき事業か？",
            "量子コンピューターは現代社会を根本的に変えるか？"
        ];
    }

    getRandomTopic() {
        return this.topics[Math.floor(Math.random() * this.topics.length)];
    }

    async createGame(ws, userStance, difficulty) {
        const gameId = Date.now().toString();
        const topic = this.getRandomTopic();
        
        const game = {
            id: gameId,
            topic,
            userStance: userStance || 'for',
            aiStance: userStance === 'for' ? 'against' : 'for',
            difficulty: difficulty || 'normal',
            messages: [],
            userScore: 50,
            aiScore: 50,
            maxScore: 100,
            messageCount: 0,
            maxMessages: 20,
            ws
        };
        
        this.games.set(gameId, game);
        return game;
    }

    getGame(gameId) {
        return this.games.get(gameId);
    }

    deleteGame(gameId) {
        this.games.delete(gameId);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = DebateGameManager;