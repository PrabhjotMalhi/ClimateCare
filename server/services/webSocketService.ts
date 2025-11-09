import { WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { CommunitySubmission } from '@shared/schema';

const WS_PORT = 3001; // Separate port for WebSocket server

export function setupWebSocketServer() {
  const wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established on port', WS_PORT);

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  console.log(`WebSocket server running on port ${WS_PORT}`);

  return {
    broadcastNewSubmission: (submission: CommunitySubmission) => {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'new_submission',
            submission
          }));
        }
      });
    }
  };
}