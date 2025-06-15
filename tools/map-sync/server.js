const WebSocket = require('ws');

const port = 8081;
const wss = new WebSocket.Server({ port });

console.log(`WebSocket server listening on port ${port}`);

// Store all connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message);
      
      // Broadcast the location to all other connected clients
      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});