/**
 * gRPC Chatbot Service Implementation
 * 
 * Core Features:
 * - Natural language conversation handling
 * - Multi-step feedback collection
 * - Sentiment analysis
 * - Email notifications
 * - Ticket management
 * 
 * Service Methods:
 * 1. GetBotResponse - Unary RPC for single message responses
 * 2. LiveChat - Bidirectional streaming for conversational chat
 * 3. CreateTicket - Ticket creation endpoint
 * 4. StreamSuggestions - Server streaming for suggestions
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const Sentiment = require('sentiment');
const sentiment = new Sentiment(); // Initialize sentiment analyzer
const nodemailer = require('nodemailer');

// ==================================================================
// gRPC Service Configuration
// ==================================================================

// Load protocol buffer definition
const PROTO_PATH = path.resolve(__dirname, '../protos/chatbot.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const chatbotProto = grpc.loadPackageDefinition(packageDef).chatbot;

// API key for authentication (in production, use environment variables)
const API_KEY = "SECRET123";

// ==================================================================
// Core Chatbot Logic
// ==================================================================

/**
 * Handles user messages and maintains conversation state
 * @param {string} message - User input message
 * @param {string} [lastBotMessage=''] - Last message sent by bot
 * @param {Object} [session={}] - Conversation session state
 * @returns {string} Bot response
 * 
 * Conversation Flow:
 * 1. Main menu options
 * 2. Feedback collection (multi-step)
 * 3. Menu/hours/location queries
 * 4. Continuation prompts
 */
function handleUserMessage(message, lastBotMessage = '', session = {}) {
    const cleanMessage = message.toLowerCase().trim();

    // Handle conversation continuation logic
    if (session.awaitingContinuation) {
        if (cleanMessage === 'yes' || cleanMessage === 'y' || cleanMessage === 'continue') {
            session.awaitingContinuation = false;
            return "Great! What else can I help you with?\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n4. 📩 Help (Feedback and Complaint)\n\nWhat would you like?";
        } else if (cleanMessage === 'no' || cleanMessage === 'n' || cleanMessage === 'exit') {
            return "Thank you for chatting with us! Have a great day!";
        } else {
            return "Please answer with 'yes' to continue chatting or 'no' to end the conversation.";
        }
    }

    // Feedback collection workflow
    if (cleanMessage === 'help' || cleanMessage === 'feedback' || cleanMessage === 'complaint' || cleanMessage === '4') {
        session.currentStep = 'awaitingFeedbackType';
        if (session.currentStep === 'awaitingFeedbackType') {
            if (cleanMessage === 'feedback' || cleanMessage === 'complaint') {
                session.feedbackType = cleanMessage;
                session.currentStep = 'awaitingLocation';
                return "Please select a location:\n\n1. Millenium Walkway\n2. Charlotte Way\n3. Dundrum Shopping Centre\n4. Liffey Valley Shopping Centre";
            } else if (cleanMessage === 'help') {
                return "Would you like to provide feedback or report a complaint?";
            }
        }
    }

    // Location selection handling
    if (session.currentStep === 'awaitingLocation') {
        const locationMap = {
            '1': 'Millenium Walkway',
            'millenium': 'Millenium Walkway',
            'millennium': 'Millenium Walkway',
            'walkway': 'Millenium Walkway',
            '2': 'Charlotte Way',
            'charlotte': 'Charlotte Way',
            '3': 'Dundrum Shopping Centre',
            'dundrum': 'Dundrum Shopping Centre',
            'shopping': 'Dundrum Shopping Centre',
            '4': 'Liffey Valley Shopping Centre',
            'liffey': 'Liffey Valley Shopping Centre',
            'valley': 'Liffey Valley Shopping Centre'
        };

        // Find matching location using flexible input matching
        let selectedLocation = null;
        for (const [key, value] of Object.entries(locationMap)) {
            if (cleanMessage.includes(key)) {
                selectedLocation = value;
                break;
            }
        }

        if (selectedLocation) {
            session.location = selectedLocation;
            session.currentStep = 'awaitingMessage';
            return `Please describe your ${session.feedbackType} in detail:`;
        }
        return "Please select a valid location:\n\n1. Millenium Walkway\n2. Charlotte Way\n3. Dundrum Shopping Centre\n4. Liffey Valley Shopping Centre";
    }

    // Message collection with sentiment analysis
    if (session.currentStep === 'awaitingMessage') {
        session.message = message;
        const sentimentResult = sentiment.analyze(message);
        session.sentiment = sentimentResult.score > 0 ? 'positive' : 
                          sentimentResult.score < 0 ? 'negative' : 'neutral';
        
        session.currentStep = 'awaitingEmail';
        let response = "Thank you for your message. ";
        
        // Tailor response based on sentiment
        if (session.sentiment === 'negative') {
            response += "We're sorry to hear about your experience. ";
        } else if (session.sentiment === 'positive') {
            response += "We're happy you enjoyed your visit! ";
        }
        
        response += "Could you please provide your email so our manager can follow up?";
        return response;
    }

    // Email collection and ticket submission
    if (session.currentStep === 'awaitingEmail') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(cleanMessage)) {
            session.email = cleanMessage;

            // Create ticket object
            const ticket = {
                feedbackType: session.feedbackType,
                location: session.location,
                message: session.message,
                email: session.email,
                sentiment: session.sentiment
            };
            
            // Send email notification
            sendTicketEmail(ticket);

            const ticketId = 'T-' + Math.floor(Math.random() * 10000);
            
            // Prepare emoji for sentiment
            const sentimentEmoji = {
                'positive': '😊',
                'negative': '😞',
                'neutral': '😐'
            }[session.sentiment] || '';

            // Build comprehensive response
            const summary = `📨 Ticket #${ticketId} submitted.\n` +
                           `🗂️ Type: ${ticket.feedbackType}\n` +
                           `📍 Location: ${ticket.location}\n` +
                           `📝 Message: ${ticket.message}\n` +
                           `📧 Email: ${ticket.email}\n` +
                           `Sentiment: ${ticket.sentiment} ${sentimentEmoji}\n\n` +
                           `✅ Your ${ticket.feedbackType} has been sent to the branch manager. They'll contact you soon.\n\n` +
                           `Would you like to continue chatting? (yes/no)`;

            // Reset session state
            session.currentStep = null;
            session.feedbackType = null;
            session.location = null;
            session.message = null;
            session.email = null;
            session.sentiment = null;
            session.awaitingContinuation = true;

            return summary;
        } else {
            return "That doesn't look like a valid email. Please try again:";
        }
    }

    // Menu information response
    if (/(menu|food|eat|burger|tenders|wings|sides|fries|drinks|1)/.test(cleanMessage)) {
        return "Our delicious menu includes:\n\n" +
               "🍔 Chicken Burgers\n\n" +
               "OG €14.00\n" +
               "Nashville Hot Chick 14.95 \n" +
               "Wild Thing €14.95 \n" +
               "Honey Baby €14.95 \n" +
               "GOAT €14.95 \n" +
               "Heart Breaker €14.50 \n" +
               "Side Chick €14.00 \n\n" +
               "🍗 Tenders\n" +
               "Nashville Tender €10.95\n" +
               "Love Me Ranch Tender €10.95 \n" +
               "Love Me My Way €10.95 \n" +
               "Love Me Sweetie €10.95 \n" +
               "Double Stack €19.95 \n\n" +
               "🍟 Sides\n" +
               "Mac And Cheese €9.95\n" +
               "Fries €5.95 \n" +
               "Tator Tots €5.95 \n" +
               "Loaded Fries/Tots €9.95 \n" +
               "Crack Fries/tots €9.95 \n\n" +
               "🥤 Drinks\n" +
               "Coke €3.10\n" +
               "Coke Zero/Diet €3.00 \n" +
               "Fanta Orange/Lemon €3.00 \n" +
               "7UP €3.00 \n\n" +
               "Would you like to know our hours, location or help (feedback or complaint)?";
    }

    // Hours information response
    if (/(hour|time|open|close|schedule|when|2)/.test(cleanMessage)) {
        return "🕒 Our opening hours:\n\n" +
               "Sunday-Thursday: 12pm-9pm\n" +
               "Friday-Saturday: 12pm-10pm\n\n" +
               "Would you like to know our hours, location or help (feedback or complaint)?";
    }

    // Location information response
    if (/(location|address|where|find|map|directions|)/.test(cleanMessage)) {
        return "📍 Find us at:\n\n" +
               "Millenium Walkway\n" +
               "Charlotte Way\n" +
               "Dundrum Shopping Centre\n" +
               "Liffey Valley Shopping Centre\n\n" +
               "Would you like to know our hours, location or help (feedback or complaint)?";
    }

    // Default response
    return "I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n4. 📩 Help (Feedback and Complaint)\n\nWhat would you like?";
}

// ==================================================================
// gRPC Service Methods
// ==================================================================

/**
 * GetBotResponse - Unary RPC for single message responses
 * @param {grpc.ServerUnaryCall} call - gRPC call object
 * @param {grpc.sendUnaryData} callback - Response callback
 */
function GetBotResponse(call, callback) {
    try {
        // API key authentication
        if (call.request.api_key !== API_KEY) {
            return callback({ code: grpc.status.PERMISSION_DENIED });
        }
        
        const reply = handleUserMessage(call.request.message);
        callback(null, { reply });
    } catch (err) {
        console.error('GetBotResponse error:', err);
        callback({ 
            code: grpc.status.INTERNAL, 
            message: "Please try again." 
        });
    }
}

/**
 * LiveChat - Bidirectional streaming RPC for conversational chat
 * @param {grpc.ServerDuplexStream} call - Duplex stream
 */
function LiveChat(call) {
    let lastBotMessage = '';
    const session = {
        currentStep: null,
        feedbackType: null,
        location: null,
        message: null,
        sentiment: null,
        awaitingContinuation: false
    };

    // Send initial greeting
    call.write({
        user_id: "bot",
        text: "Hello! I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n4. 📩 Help (Feedback and Complaint)\n\nWhat would you like?"
    });

    // Handle incoming messages
    call.on('data', (message) => {
        try {
            const reply = handleUserMessage(message.text, lastBotMessage, session);
            lastBotMessage = reply;

            call.write({ user_id: "bot", text: reply });

            // End stream if conversation concluded
            if (reply.includes("Thank you for chatting")) {
                call.end();
            }
        } catch (err) {
            console.error('LiveChat error:', err);
            call.write({ user_id: "bot", text: "Please try again." });
        }
    });

    // Clean up on stream end
    call.on('end', () => call.end());
    call.on('error', (err) => console.error('LiveChat error:', err));
}

/**
 * CreateTicket - Ticket creation endpoint
 * @param {grpc.ServerUnaryCall} call - gRPC call object
 * @param {grpc.sendUnaryData} callback - Response callback
 */
function CreateTicket(call, callback) {
    const { user_id, location, feedback_type, message } = call.request;
    
    // Perform sentiment analysis
    const sentimentResult = sentiment.analyze(message);
    const sentimentLabel = sentimentResult.score > 0 ? 'positive' : 
                          sentimentResult.score < 0 ? 'negative' : 'neutral';

    // Generate ticket ID and assign staff based on sentiment
    const ticketId = 'T-' + Math.floor(Math.random() * 10000);
    const staffAssigned = sentimentLabel === 'negative' ? 'Senior Manager' : 'Team Member';

    console.log(`[Ticket Created] ${ticketId}: ${feedback_type.toUpperCase()} (${sentimentLabel}) - ${message}`);

    callback(null, {
        ticket_id: ticketId,
        status: 'Ticket submitted successfully',
        staff_assigned: staffAssigned,
        sentiment_score: sentimentResult.score,
        sentiment_label: sentimentLabel
    });
}

/**
 * StreamSuggestions - Server streaming RPC for suggestions
 * @param {grpc.ServerWritableStream} call - Writable stream
 */
function StreamSuggestions(call) {
    const suggestions = [
        "🍔 Ask about today's menu",
        "🕒 Check opening hours",
        "📍 Find your nearest Mad Egg location"
    ];

    // Stream each suggestion
    suggestions.forEach(suggestion => {
        call.write({ suggestion });
    });

    call.end();
}

// ==================================================================
// Email Notification System
// ==================================================================

// Configure nodemailer transporter (in production, use environment variables)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'grc290497@gmail.com',
        pass: 'gcsdawdbjyirwqgl'
    }
});

/**
 * Sends email notification for new tickets
 * @param {Object} ticket - Ticket object containing feedback details
 */
function sendTicketEmail(ticket) {
    const sentimentEmoji = {
        'positive': '😊',
        'negative': '😞',
        'neutral': '😐'
    }[ticket.sentiment] || '';
    
    const mailOptions = {
        from: 'grc290497@gmail.com',
        to: 'grc290497@gmail.com',
        subject: `${sentimentEmoji} New ${ticket.feedbackType} from ${ticket.location}`,
        text: `New customer ${ticket.feedbackType} received:

Location: ${ticket.location}
Message: ${ticket.message}
Customer Email: ${ticket.email}
Sentiment: ${ticket.sentiment} ${sentimentEmoji}

Please respond within ${ticket.sentiment === 'negative' ? '1 business day' : '2-3 business days'}.`
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.error('Error sending ticket email:', error);
        } else {
            console.log('Ticket email sent:', info.response);
        }
    });
}

// ==================================================================
// Module Exports
// ==================================================================

module.exports = {
    service: chatbotProto.ChatBotService.service, // gRPC service definition
    implementation: { // Implemented RPC methods
        GetBotResponse,
        LiveChat,
        CreateTicket,
        StreamSuggestions
    },
    sendTicketEmail // Exposed for testing
};