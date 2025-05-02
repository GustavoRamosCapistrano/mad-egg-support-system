const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../protos/chatbot.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const chatbotProto = grpc.loadPackageDefinition(packageDef).chatbot;

const client = new chatbotProto.ChatBotService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

function getBotResponse(message, userId) {
  return new Promise((resolve, reject) => {
    client.GetBotResponse({
      message: message,
      user_id: userId,
      api_key: "SECRET123"
    }, (err, response) => {
      if (err) {
        console.error('gRPC GetBotResponse error:', err);
        return reject('Failed to get bot response');
      }
      resolve(response);
    });
  });
}

function liveChat(userId) {
  const call = client.LiveChat();
  call.on('error', (err) => console.error('Live chat error:', err));
  return call;
}


function createTicket(ticketData) {
  return new Promise((resolve, reject) => {
    client.CreateTicket({
      user_id: ticketData.userId,
      location: ticketData.location,
      feedback_type: ticketData.type,
      message: ticketData.message,
      sentiment: ticketData.sentiment,
      api_key: "SECRET123"
    }, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

// Add to exports
module.exports = { getBotResponse, liveChat, createTicket };