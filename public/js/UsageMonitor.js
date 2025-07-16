class UsageMonitor {
    constructor(wsManager) {
        this.wsManager = wsManager;
        this.usageElement = document.getElementById('usageText');
        this.usageDisplay = document.getElementById('usageDisplay');
        this.lastUsageInfo = null;
        this.updateInterval = null;
        
        this.setupEventListeners();
        this.startMonitoring();
    }
    
    setupEventListeners() {
        this.wsManager.on('usage_info', (data) => {
            this.updateUsageDisplay(data);
        });
        
        this.wsManager.on('connection_established', () => {
            this.requestUsageInfo();
        });
    }
    
    startMonitoring() {
        // 初回取得
        this.requestUsageInfo();
        
        // 30秒ごとに更新
        this.updateInterval = setInterval(() => {
            this.requestUsageInfo();
        }, 30000);
    }
    
    stopMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    requestUsageInfo() {
        if (this.wsManager.isConnected()) {
            this.wsManager.send('get_usage', {});
        }
    }
    
    updateUsageDisplay(usageInfo) {
        if (!usageInfo || !this.usageElement) return;
        
        this.lastUsageInfo = usageInfo;
        
        // 使用量を計算
        const usage = this.calculateUsage(usageInfo);
        
        // 表示を更新
        this.usageElement.textContent = usage.text;
        this.updateUsageStyle(usage.level);
    }
    
    calculateUsage(usageInfo) {
        // Claude APIの使用量情報を解析
        // 実際のAPIレスポンス構造に合わせて調整が必要
        
        if (!usageInfo.usage) {
            return {
                text: 'クレジット情報を取得できません',
                level: 'unknown'
            };
        }
        
        const current = usageInfo.usage.input_tokens + usageInfo.usage.output_tokens;
        const limit = usageInfo.usage.limit || 100000; // デフォルト制限
        
        const remaining = Math.max(0, limit - current);
        const percentage = (remaining / limit) * 100;
        
        // 推定ゲーム数を計算（1ゲーム平均2000トークン想定）
        const estimatedGames = Math.floor(remaining / 2000);
        
        let level = 'high';
        if (percentage < 20) level = 'low';
        else if (percentage < 50) level = 'medium';
        
        return {
            text: `残り約${estimatedGames}ゲーム (${Math.round(percentage)}%)`,
            level: level
        };
    }
    
    updateUsageStyle(level) {
        if (!this.usageDisplay) return;
        
        // 既存のクラスを削除
        this.usageDisplay.classList.remove('usage-low', 'usage-medium', 'usage-high');
        
        // 新しいクラスを追加
        if (level !== 'unknown') {
            this.usageDisplay.classList.add(`usage-${level}`);
        }
    }
    
    // エラー表示
    showError() {
        if (this.usageElement) {
            this.usageElement.textContent = 'クレジット情報を取得できません';
        }
    }
}