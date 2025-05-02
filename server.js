const grpc = require('@grpc/grpc-js');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

// Import services and client
const chatbot = require('./services/chatbotService');
const chatbotClient = require('./clients/chatbotClient');

const app = express();
app.use(express.static(path.join(__dirname, 'gui')));
app.use(express.json());

// Start gRPC server
const grpcServer = new grpc.Server();
grpcServer.addService(chatbot.service, chatbot.implementation);
grpcServer.bindAsync(
  '0.0.0.0:50051',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Chatbot service running on port 50051');
    grpcServer.start();
  }
);

// HTTP API endpoint
app.post('/api/chatbot', async (req, res) => {
  try {
    if (!req.body.message || typeof req.body.message !== 'string') {
      return res.status(400).json({ error: 'Valid message is required' });
    }
    
    const reply = await chatbotClient.getBotResponse(req.body.message.trim(), "web-user");
    res.json({ reply: reply.reply });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ 
      error: 'Sorry, we encountered an error. Please try again.' 
    });
  }
});

// Start HTTP server
const server = app.listen(3000, () => {
  console.log('GUI server running on http://localhost:3000');
  
  // WebSocket server
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    // Send initial message
    ws.send(JSON.stringify({
      sender: 'bot',
      text: "Hello! I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n\nWhat would you like?",
      timestamp: new Date().toISOString()
    }));

    let call;
    try {
      call = chatbotClient.liveChat("web-user");

      call.on('data', (message) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            sender: 'bot',
            text: message.text,
            timestamp: new Date().toISOString()
          }));
        }
      });

      call.on('end', () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      call.on('error', (err) => {
        console.error('gRPC call error:', err);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          if (call && msg.text && typeof msg.text === 'string') {
            call.write({
              user_id: "user",
              text: msg.text.trim()
            });
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        if (call) call.end();
      });

    } catch (err) {
      console.error('Connection setup error:', err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  });
});