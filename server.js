const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
require('dotenv').config();

const GameHandler = require('./lib/GameHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });
const gameHandler = new GameHandler();

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'start_game') {
        const gameData = await gameHandler.startGame(ws, data.userStance, data.difficulty);
        ws.send(JSON.stringify({
          type: 'game_started',
          data: gameData
        }));
        
        // 初期メッセージを送信（Claude APIを使用）
        setTimeout(async () => {
          try {
            const initialMessage = await gameHandler.generateInitialMessage(gameData.gameId);
            ws.send(JSON.stringify({
              type: 'ai_response',
              data: initialMessage
            }));
          } catch (error) {
            console.error('Error generating initial message:', error);
            // フォールバック用の定型メッセージ
            ws.send(JSON.stringify({
              type: 'ai_response',
              data: {
                aiMessage: `さあ、始めましょうか。私は${gameData.aiStance === 'for' ? '賛成' : '反対'}派として戦います。`,
                userScore: gameData.userScore,
                aiScore: gameData.aiScore,
                expression: 'normal',
                messageCount: 0,
                maxMessages: 20
              }
            }));
          }
        }, 1000);
      }
      
      if (data.type === 'user_message') {
        const result = await gameHandler.handleUserMessage(data.gameId, data.message);
        if (result) {
          ws.send(JSON.stringify({
            type: 'ai_response',
            data: result
          }));
        }
      }
      
      if (data.type === 'get_usage') {
        const usageInfo = await gameHandler.getUsageInfo();
        ws.send(JSON.stringify({
          type: 'usage_info',
          data: usageInfo
        }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'サーバーエラーが発生しました' }
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});