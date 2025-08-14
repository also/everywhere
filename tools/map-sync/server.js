const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const requiredPath = process.env.SHARED_SECRET
  ? `/${process.env.SHARED_SECRET}`
  : '/map-sync';

const portArg = process.argv[2];

const port = portArg ? parseInt(portArg) : 8081;

// Create HTTP server
const server = http.createServer((req, res) => {
  // Send 404 for all non-upgrade requests
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Create WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Handle upgrade requests manually
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  if (pathname === requiredPath) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port);

console.log(`WebSocket server listening on port ${port}`);

// Store all connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      // Convert back to string to ensure it's sent as text, not blob
      const messageString = JSON.stringify(message);

      // Broadcast the location to all other connected clients
      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(messageString);
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
