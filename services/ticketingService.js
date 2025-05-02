const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../protos/chatbot.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const chatbotProto = grpc.loadPackageDefinition(packageDef).chatbot;

const LOCATIONS = {
  "1": "Dublin City Center",
  "2": "Dundrum Branch", 
  "3": "Blanchardstown Branch",
  "4": "Swords Branch"
};

const STAFF_ASSIGNMENTS = {
  complaint: ["manager1@madegg.com", "manager2@madegg.com"],
  feedback: ["support@madegg.com"]
};

const ticketsDB = new Map(); // In-memory storage for tickets

function CreateTicket(call, callback) {
  try {
    const { user_id, location, feedback_type, message, sentiment } = call.request;

    // Validate input
    if (!LOCATIONS[location]) {
      throw { code: grpc.status.INVALID_ARGUMENT, message: "Invalid location ID" };
    }
    if (!["complaint", "feedback"].includes(feedback_type)) {
      throw { code: grpc.status.INVALID_ARGUMENT, message: "Invalid feedback type" };
    }

    // Create ticket
    const ticketId = `TICKET-${Date.now()}`;
    const staff = STAFF_ASSIGNMENTS[feedback_type];
    
    const ticket = {
      id: ticketId,
      user_id,
      location: LOCATIONS[location],
      type: feedback_type,
      message,
      sentiment,
      status: "open",
      assigned_to: staff[0],
      created_at: new Date().toISOString()
    };

    // Store ticket (in production, use a database)
    ticketsDB.set(ticketId, ticket);

    console.log("New ticket created:", ticket); // Log to console for demo

    callback(null, {
      ticket_id: ticket.id,
      status: ticket.status,
      staff_assigned: ticket.assigned_to
    });

  } catch (err) {
    console.error("Ticket creation error:", err);
    callback(err);
  }
}

module.exports = {
  service: chatbotProto.ChatBotService.service,
  implementation: { CreateTicket },
  getTickets: () => Array.from(ticketsDB.values()) // For debugging
};