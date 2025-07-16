class WebSocketManager {
    constructor() {
        this.ws = null;
        this.messageHandlers = new Map();
    }

    connect() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.handleMessage({ type: 'connection_established' });
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.handleMessage({ type: 'connection_lost' });
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handleMessage({ type: 'connection_error', error });
        };
    }

    handleMessage(data) {
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data.data || data);
        }
    }
    
    emit(eventType, data = {}) {
        this.handleMessage({ type: eventType, data });
    }

    on(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
    }

    send(messageType, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: messageType,
                ...data
            }));
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}