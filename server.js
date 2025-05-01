const grpc = require('@grpc/grpc-js');
const chatbot = require('./services/chatbotService');
const ticketing = require('./services/ticketingService');
const sentiment = require('./services/sentimentService');

function startService(service, implementation, port) {
  const server = new grpc.Server();
  server.addService(service, implementation);
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`Service running on port ${port}`);
    server.start();
  });
}

// Start each service on a different port
startService(chatbot.service, chatbot.implementation, 50051);
startService(ticketing.service, ticketing.implementation, 50052);
startService(sentiment.service, sentiment.implementation, 50053);
