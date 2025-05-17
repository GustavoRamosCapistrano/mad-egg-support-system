/**
 * gRPC Chatbot Service Implementation
 * 
 * Responsibilities:
 * 1. Handle ticket creation via gRPC
 * 2. Maintain in-memory ticket storage (for demo purposes)
 * 3. Validate incoming ticket requests
 * 4. Assign tickets to appropriate staff
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// ==================================================================
// Protocol Buffer Configuration
// ==================================================================

// Load and parse the protobuf definition file
const PROTO_PATH = path.join(__dirname, '../protos/chatbot.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const chatbotProto = grpc.loadPackageDefinition(packageDef).chatbot;

// ==================================================================
// Business Configuration
// ==================================================================

/**
 * Location ID to Name Mapping
 * @constant {Object.<string, string>}
 */
const LOCATIONS = {
  "1": "Dublin City Center",
  "2": "Dundrum Branch", 
  "3": "Blanchardstown Branch",
  "4": "Swords Branch"
};

/**
 * Staff Assignment Rules by Ticket Type
 * @constant {Object.<string, string[]>}
 */
const STAFF_ASSIGNMENTS = {
  complaint: ["manager1@madegg.com", "manager2@madegg.com"],
  feedback: ["support@madegg.com"]
};

// ==================================================================
// Data Storage
// ==================================================================

/**
 * In-memory ticket storage (for demo purposes)
 * In production, replace with a proper database
 * @type {Map<string, Object>}
 */
const ticketsDB = new Map();

// ==================================================================
// Service Implementation
// ==================================================================

/**
 * CreateTicket - gRPC Unary RPC Implementation
 * 
 * @param {grpc.ServerUnaryCall} call - gRPC call object containing request
 * @param {grpc.sendUnaryData} callback - Response callback
 * 
 * Expected Request Format:
 * {
 *   user_id: string,
 *   location: string (1-4),
 *   feedback_type: "complaint"|"feedback",
 *   message: string,
 *   sentiment?: string
 * }
 */
function CreateTicket(call, callback) {
  try {
    const { user_id, location, feedback_type, message, sentiment } = call.request;

    // ==============================================================
    // Input Validation
    // ==============================================================
    
    // Validate location exists
    if (!LOCATIONS[location]) {
      throw { 
        code: grpc.status.INVALID_ARGUMENT, 
        message: "Invalid location ID" 
      };
    }
    
    // Validate feedback type
    if (!["complaint", "feedback"].includes(feedback_type)) {
      throw { 
        code: grpc.status.INVALID_ARGUMENT, 
        message: "Invalid feedback type" 
      };
    }

    // ==============================================================
    // Ticket Creation Logic
    // ==============================================================
    
    // Generate unique ticket ID
    const ticketId = `TICKET-${Date.now()}`;
    
    // Get staff assignment based on ticket type
    const staff = STAFF_ASSIGNMENTS[feedback_type];
    
    // Create ticket object
    const ticket = {
      id: ticketId,
      user_id,
      location: LOCATIONS[location], // Convert ID to name
      type: feedback_type,
      message,
      sentiment: sentiment || 'neutral', // Default if not provided
      status: "open",
      assigned_to: staff[0], // Assign to first available staff
      created_at: new Date().toISOString()
    };

    // ==============================================================
    // Data Storage
    // ==============================================================
    
    // Store in memory (in production, persist to database)
    ticketsDB.set(ticketId, ticket);

    // Log for debugging (remove in production or use proper logging)
    console.log("New ticket created:", ticket);

    // ==============================================================
    // Response Formatting
    // ==============================================================
    
    callback(null, {
      ticket_id: ticket.id,
      status: ticket.status,
      staff_assigned: ticket.assigned_to
    });

  } catch (err) {
    console.error("Ticket creation error:", err);
    
    // Ensure error has proper gRPC error format
    const error = err.code 
      ? err 
      : { 
          code: grpc.status.INTERNAL, 
          message: "Internal server error" 
        };
    
    callback(error);
  }
}

// ==================================================================
// Module Exports
// ==================================================================

module.exports = {
  // gRPC service definition from protobuf
  service: chatbotProto.ChatBotService.service,
  
  // Implemented RPC methods
  implementation: { 
    CreateTicket 
  },
  
  // Debugging helper (not part of gRPC service)
  getTickets: () => Array.from(ticketsDB.values())
};