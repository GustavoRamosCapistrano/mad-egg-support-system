const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../protos/ticketing.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const ticketingProto = grpc.loadPackageDefinition(packageDef).ticketing;

const client = new ticketingProto.TicketingService(
  'localhost:50052',
  grpc.credentials.createInsecure()
);

// Client Streaming
function submitFeedback(messages, userId) {
  return new Promise((resolve, reject) => {
    const call = client.SubmitFeedback((err, response) => {
      if (err) return reject(err);
      resolve(response);
    });

    messages.forEach((message, i) => {
      setTimeout(() => {
        call.write({
          user_id: userId,
          content: message,
          api_key: "SECRET123"
        });
      }, i * 500);
    });

    setTimeout(() => call.end(), messages.length * 500);
  });
}

// Simple RPC
function getTicketStatus(ticketId) {
  return new Promise((resolve, reject) => {
    client.GetTicketStatus({ ticket_id: ticketId }, (err, response) => {
      if (err) return reject(err);
      resolve(response.status);
    });
  });
}

module.exports = { submitFeedback, getTicketStatus };