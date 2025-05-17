/**
 * Main Server Application - Combines gRPC, REST API, and WebSocket services
 * 
 * Architecture:
 * 1. gRPC server for core chatbot service
 * 2. Express REST API for web client interactions
 * 3. WebSocket server for real-time chat
 * 4. Static file serving for GUI
 */

const grpc = require('@grpc/grpc-js');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

// Service and client imports
const chatbot = require('./services/chatbotService'); // gRPC service implementation
const ticketService = require('./services/ticketingService'); // Ticket business logic
const chatbotClient = require('./clients/chatbotClient'); // gRPC client wrapper

// Initialize Express application
const app = express();

// Middleware Configuration
app.use(express.static(path.join(__dirname, 'gui'))); // Serve static frontend files
app.use(express.json()); // Parse JSON request bodies

// ==================================================================
// gRPC Server Configuration
// ==================================================================
const grpcServer = new grpc.Server();

// Register gRPC service implementation
grpcServer.addService(chatbot.service, chatbot.implementation);

// Start gRPC server with insecure credentials (for development only)
grpcServer.bindAsync(
  '0.0.0.0:50051', 
  grpc.ServerCredentials.createInsecure(), 
  (error, port) => {
    if (error) {
      console.error('❌ gRPC server failed to start:', error);
      return;
    }
    console.log('✅ gRPC services running on port 50051');
    grpcServer.start();
  }
);

// ==================================================================
// REST API Endpoints
// ==================================================================

/**
 * Chatbot Message Endpoint
 * POST /api/chatbot
 * 
 * Expected body format:
 * {
 *   "message": "string"
 * }
 */
app.post('/api/chatbot', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Input validation
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message is required' });
    }

    // Process through gRPC client
    const reply = await chatbotClient.getBotResponse(
      message.trim(), 
      'web-user' // Default user ID for web clients
    );
    
    // Return formatted response
    res.json({ reply: reply.reply });
  } catch (err) {
    console.error('API Error (chatbot):', err);
    res.status(500).json({ 
      error: 'Server error. Please try again.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Ticket Creation Endpoint
 * POST /api/create-ticket
 * 
 * Expected body format:
 * {
 *   "type": "string",  // e.g. "complaint", "feedback"
 *   "message": "string"
 * }
 */
app.post('/api/create-ticket', async (req, res) => {
  const { type, message } = req.body;

  // Required field validation
  if (!type || !message) {
    return res.status(400).json({ error: 'Missing ticket details' });
  }

  try {
    // Create ticket via gRPC client
    const ticket = await chatbotClient.createTicket({
      userId: 'web-user',       // Default web user ID
      location: 'Mad Egg, Dublin', // Hardcoded for demo
      type,                     // From request
      message,                  // From request
      sentiment: 'unknown',     // Default value
    });

    res.json(ticket);
  } catch (err) {
    console.error('Ticket creation failed:', err);
    res.status(500).json({ 
      error: 'Could not create ticket',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Ticket Listing Endpoint
 * GET /api/tickets
 * 
 * Returns: Array of ticket objects
 */
app.get('/api/tickets', (req, res) => {
  // Safely handle missing getTickets method
  res.json(ticketService.getTickets ? ticketService.getTickets() : []);
});

// ==================================================================
// GUI & WebSocket Server
// ==================================================================

// Start Express server
const server = app.listen(3000, () => {
  console.log('✅ GUI server running on http://localhost:3000');

  // Initialize WebSocket server on the same port
  const wss = new WebSocket.Server({ server });

  /**
   * WebSocket Connection Handler
   * 
   * Manages:
   * - Initial bot greeting message
   * - Bi-directional message streaming
   * - Connection cleanup
   */
  wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    let initialMessageSent = false;
    let call; // gRPC streaming call reference

    try {
      // Initialize gRPC streaming connection
      call = chatbotClient.liveChat('web-user');

      // Handle incoming messages from gRPC server
      call.on('data', (message) => {
        if (!initialMessageSent) {
          // Send initial bot greeting
          ws.send(JSON.stringify({
            sender: 'bot',
            text: "Hello! I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n4. 📩 Help (Feedback and Complaint)\n\nWhat would you like?",
            timestamp: new Date().toISOString(),
          }));
          initialMessageSent = true;
        } else if (ws.readyState === WebSocket.OPEN) {
          // Forward subsequent messages
          ws.send(JSON.stringify({
            sender: 'bot',
            text: message.text,
            timestamp: new Date().toISOString(),
          }));
        }
      });

      // Clean up on gRPC stream end
      call.on('end', () => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });

      // Handle gRPC errors
      call.on('error', (err) => {
        console.error('Live chat error:', err);
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });

      // Handle messages from WebSocket client
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          
          // Validate and forward messages to gRPC stream
          if (call && msg.text && typeof msg.text === 'string') {
            call.write({
              user_id: 'web-user',
              text: msg.text.trim(), // Sanitize input
            });
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      });

      // Clean up on WebSocket close
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

// ==================================================================
// Error Handling for Uncaught Exceptions
// ==================================================================
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Consider implementing proper shutdown logic here
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});