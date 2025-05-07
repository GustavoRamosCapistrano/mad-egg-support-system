const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, '../protos/chatbot.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const chatbotProto = grpc.loadPackageDefinition(packageDef).chatbot;
const nodemailer = require('nodemailer');

const API_KEY = "SECRET123";

function handleUserMessage(message, lastBotMessage = '', session = {}) {
  const cleanMessage = message.toLowerCase().trim();

  // Step: Ask for feedback or complaint
  if (cleanMessage === 'help' || cleanMessage === 'feedback' || cleanMessage === 'complaint') {
    session.currentStep = 'awaitingFeedbackType';
    if (session.currentStep === 'awaitingFeedbackType') {
      if (cleanMessage === 'feedback' || cleanMessage === 'complaint') {
        session.feedbackType = cleanMessage;
        session.currentStep = 'awaitingLocation';
        return "Please select a location:\n\n" +
               "1. Millenium Walkway\n" +
               "2. Charlotte Way\n" +
               "3. Dundrum Shopping Centre\n" +
               "4. Liffey Valley Shopping Centre";
      } else if (cleanMessage === 'help') {
        return "Would you like to provide feedback or report a complaint?";
      }
    }
  }

  if (session.currentStep === 'awaitingLocation') {
    const branches = {
      '1': 'Millenium Walkway',
      '2': 'Charlotte Way',
      '3': 'Dundrum Shopping Centre',
      '4': 'Liffey Valley Shopping Centre'
    };

    if (branches[cleanMessage]) {
      session.location = branches[cleanMessage];
      session.currentStep = 'awaitingMessage';
      return `Please describe your ${session.feedbackType} in detail:`;
    }
  }

  if (session.currentStep === 'awaitingMessage') {
    session.message = message;
    session.currentStep = 'awaitingEmail';
    return "Thank you for your message. Could you please provide your email so our manager can follow up?";
  }

  if (session.currentStep === 'awaitingEmail') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(cleanMessage)) {
      session.email = cleanMessage;

      // Send the email now
      const ticket = {
        feedbackType: session.feedbackType,
        location: session.location,
        message: session.message,
        email: session.email
      };
      sendTicketEmail(ticket);

      const ticketId = 'T-' + Math.floor(Math.random() * 10000);
      const summary = `📨 Ticket #${ticketId} submitted.\n` +
                      `🗂️ Type: ${ticket.feedbackType}\n` +
                      `📍 Location: ${ticket.location}\n` +
                      `📝 Message: ${ticket.message}\n` +
                      `📧 Email: ${ticket.email}\n\n` +
                      `✅ Your complaint has been sent to the branch manager. They'll contact you soon.`;

      // Reset session
      session.currentStep = null;
      session.feedbackType = null;
      session.location = null;
      session.message = null;
      session.email = null;

      return summary;
    } else {
      return "That doesn't look like a valid email. Please try again:";
    }
  }

  // Default logic if no feedback session is active
  if (/(menu|food|eat|burger|tenders|wings|sides|fries|drinks|shake)/.test(cleanMessage)) {
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
           "🍟 Sides\n" +
           "🥤 Drinks\n\n" +
           "Would you like to know our hours or location?";
  }

  if (/(hour|time|open|close|schedule|when)/.test(cleanMessage)) {
    return "🕒 Our opening hours:\n\n" +
           "Sunday-Thursday: 12pm-9pm\n" +
           "Friday-Saturday: 12pm-10pm\n\n" +
           "Can I help with anything else?";
  }

  if (/(location|address|where|find|map|directions)/.test(cleanMessage)) {
    return "📍 Find us at:\n\n" +
           "Millenium Walkway\n" +
           "Charlotte Way\n" +
           "Dundrum Shopping Centre\n" +
           "Liffey Valley Shopping Centre\n\n" +
           "Need our menu or hours?";
  }

  return "I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\nOr type 'help' to leave feedback.";
}

function GetBotResponse(call, callback) {
  try {
    if (call.request.api_key !== API_KEY) {
      return callback({ code: grpc.status.PERMISSION_DENIED });
    }
    const reply = handleUserMessage(call.request.message);
    callback(null, { reply });
  } catch (err) {
    console.error('GetBotResponse error:', err);
    callback({ code: grpc.status.INTERNAL, message: "Please try again." });
  }
}

function LiveChat(call) {
  let lastBotMessage = '';
  const session = {
    currentStep: null,
    feedbackType: null,
    location: null,
    message: null
  };

  call.write({
    user_id: "bot",
    text: "Hello! I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n4. Help (Feedback and Complaint)\n\nWhat would you like?"
  });

  call.on('data', (message) => {
    try {
      const reply = handleUserMessage(message.text, lastBotMessage, session);
      lastBotMessage = reply;

      call.write({ user_id: "bot", text: reply });

      if (reply.includes('Thank you for chatting')) {
        call.end();
      }
    } catch (err) {
      console.error('LiveChat error:', err);
      call.write({ user_id: "bot", text: "Please try again." });
    }
  });

  call.on('end', () => call.end());
  call.on('error', (err) => console.error('LiveChat error:', err));
}


// ✅ Add CreateTicket function
function CreateTicket(call, callback) {
  const { user_id, location, feedback_type, message, sentiment } = call.request;

  const ticketId = 'T-' + Math.floor(Math.random() * 10000);
  const staffAssigned = 'Team Member A'; // or generate dynamically

  console.log(`[Ticket Created] ${ticketId}: ${feedback_type.toUpperCase()} - ${message}`);

  callback(null, {
    ticket_id: ticketId,
    status: 'Ticket submitted successfully',
    staff_assigned: staffAssigned
  });
}

// ✅ Optional: Stub for StreamSuggestions
function StreamSuggestions(call) {
  const suggestions = [
    "🍔 Ask about today's menu",
    "🕒 Check opening hours",
    "📍 Find your nearest Mad Egg location"
  ];

  suggestions.forEach(suggestion => {
    call.write({ suggestion });
  });

  call.end();
}

module.exports = {
  service: chatbotProto.ChatBotService.service,
  implementation: {
    GetBotResponse,
    LiveChat,
    CreateTicket,
    StreamSuggestions
  }
};

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for 465, false for 587
  auth: {
    user: 'grc290497@gmail.com',
    pass: 'gcsdawdbjyirwqgl'
  }
});
function sendTicketEmail(ticket) {
  const mailOptions = {
    from: 'grc290497@gmail.com',
    to: 'grc290497@gmail.com', 
    subject: `New ${ticket.feedbackType} submitted for ${ticket.location}`,
    text: `New customer ${ticket.feedbackType} received:

Location: ${ticket.location}
Message: ${ticket.message}
Customer Email: ${ticket.email}

Please respond accordingly.`
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.error('Error sending ticket email:', error);
    } else {
      console.log('Ticket email sent:', info.response);
    }
  });
}