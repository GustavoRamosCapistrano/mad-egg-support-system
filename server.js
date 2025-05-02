const grpc = require('@grpc/grpc-js');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const chatbot = require('./services/chatbotService');
const ticketService = require('./services/ticketingService');
const chatbotClient = require('./clients/chatbotClient');

const app = express();
app.use(express.static(path.join(__dirname, 'gui')));
app.use(express.json());

// --- gRPC Server Setup ---
const grpcServer = new grpc.Server();

grpcServer.addService(chatbot.service, chatbot.implementation);

grpcServer.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
  console.log('✅ gRPC services running on port 50051');
  grpcServer.start();
});

// --- REST API Endpoints ---

// Chatbot - Unary
app.post('/api/chatbot', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message is required' });
    }

    const reply = await chatbotClient.getBotResponse(message.trim(), 'web-user');
    res.json({ reply: reply.reply });
  } catch (err) {
    console.error('API Error (chatbot):', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Ticket creation
app.post('/api/create-ticket', async (req, res) => {
  const { type, message } = req.body;

  if (!type || !message) {
    return res.status(400).json({ error: 'Missing ticket details' });
  }

  try {
    const ticket = await chatbotClient.createTicket({
      userId: 'web-user',
      location: 'Mad Egg, Dublin',
      type,
      message,
      sentiment: 'unknown',
    });

    res.json(ticket);
  } catch (err) {
    console.error('Ticket creation failed:', err);
    res.status(500).json({ error: 'Could not create ticket' });
  }
});

// Optional - for viewing stored tickets if supported
app.get('/api/tickets', (req, res) => {
  res.json(ticketService.getTickets ? ticketService.getTickets() : []);
});

// --- GUI & WebSocket Server ---
const server = app.listen(3000, () => {
  console.log('✅ GUI server running on http://localhost:3000');

  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    let initialMessageSent = false;
    let call;

    try {
      call = chatbotClient.liveChat('web-user');

      call.on('data', (message) => {
        if (!initialMessageSent) {
          ws.send(JSON.stringify({
            sender: 'bot',
            text: "Hello! I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n4. 📩 Help (Feedback and Complaint)\n\nWhat would you like?",
            timestamp: new Date().toISOString(),
          }));
          initialMessageSent = true;
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            sender: 'bot',
            text: message.text,
            timestamp: new Date().toISOString(),
          }));
        }
      });

      call.on('end', () => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });

      call.on('error', (err) => {
        console.error('Live chat error:', err);
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          if (call && msg.text && typeof msg.text === 'string') {
            call.write({
              user_id: 'web-user',
              text: msg.text.trim(),
            });
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      });

      ws.on('close', () => {
        console.log('❌ WebSocket closed');
        if (call) call.end();
      });

    } catch (err) {
      console.error('Connection setup error:', err);
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
  });
});
