const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Fixed path resolution
const PROTO_PATH = path.resolve(__dirname, '../protos/ticketing.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const ticketingProto = grpc.loadPackageDefinition(packageDef).ticketing;

const API_KEY = "SECRET123";
const tickets = {};

function SubmitFeedback(call, callback) {
  let feedbackBatch = [];
  let valid = true;

  call.on('data', (feedback) => {
    try {
      if (feedback.api_key !== API_KEY) {
        valid = false;
        return;
      }
      console.log(`Received feedback from ${feedback.user_id}: ${feedback.content}`);
      feedbackBatch.push(feedback);
    } catch (err) {
      console.error("Error processing feedback:", err);
      valid = false;
    }
  });

  call.on('end', () => {
    try {
      if (!valid) {
        callback({ 
          code: grpc.status.PERMISSION_DENIED,
          message: "Invalid API key"
        });
        return;
      }

      const ticketId = `TICKET-${Math.floor(Math.random() * 10000)}`;
      tickets[ticketId] = {
        feedback: feedbackBatch,
        createdAt: new Date().toISOString()
      };
      
      console.log(`Created ticket ${ticketId} with ${feedbackBatch.length} messages`);

      callback(null, {
        ticket_id: ticketId,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Ticket creation error:", err);
      callback({
        code: grpc.status.INTERNAL,
        message: "Failed to create ticket"
      });
    }
  });

  call.on('error', (err) => {
    console.error("Feedback stream error:", err);
  });
}

function GetTicketStatus(call, callback) {
  try {
    const ticketId = call.request.ticket_id;
    if (!tickets[ticketId]) {
      callback({ 
        code: grpc.status.NOT_FOUND,
        message: "Ticket not found"
      });
      return;
    }

    const status = Math.random() > 0.3 ? "Open" : "Resolved";
    callback(null, { 
      status,
      createdAt: tickets[ticketId].createdAt,
      messageCount: tickets[ticketId].feedback.length
    });
  } catch (err) {
    console.error("Ticket status error:", err);
    callback({
      code: grpc.status.INTERNAL,
      message: "Failed to get ticket status"
    });
  }
}

module.exports = {
  service: ticketingProto.TicketingService.service,
  implementation: { SubmitFeedback, GetTicketStatus }
};