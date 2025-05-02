const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, '../protos/chatbot.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const chatbotProto = grpc.loadPackageDefinition(packageDef).chatbot;

const API_KEY = "SECRET123";

function handleUserMessage(message, lastBotMessage = '') {
  const cleanMessage = message.toLowerCase().replace(/[^\w\s]/gi, '').trim();
  
  // Response patterns
  const isAffirmative = /^(yes|yeah|yep|yup|sure|ok|okay)$/.test(cleanMessage);
  const isNegative = /^(no|nope|nah|exit|quit|bye|goodbye)$/.test(cleanMessage);
  
  // Context handling
  if (lastBotMessage.includes('Would you like to know our hours or location?')) {
    if (isAffirmative) return "Great! Please specify:\n\n1. Hours\n2. Location";
    if (isNegative) return "Thank you for chatting with us! Have a wonderful day! 😊";
  }

  if (lastBotMessage.includes('Can I help with anything else?')) {
    if (isNegative) return "Thank you for chatting with us! Have a great day! 😊";
    if (isAffirmative) return "What would you like information about?\n\n1. Menu\n2. Hours\n3. Location";
  }

  // Menu
  if (/(menu|food|eat|burger|tenders|wings|sides|fries|drinks|shake)/.test(cleanMessage)) {
    return "Our delicious menu includes:\n\n" +
           "🍔 Chicken Burgers\n" +
           "🍗 Tenders & Wings\n" +
           "🍟 Sides & Fries\n" +
           "🥤 Drinks & Shakes\n\n" +
           "Would you like to know our hours or location?";
  }

  // Hours
  if (/(hour|time|open|close|schedule|when)/.test(cleanMessage)) {
    return "🕒 Our opening hours:\n\n" +
           "Sunday-Thursday: 12pm-10pm\n" +
           "Friday-Saturday: 12pm-11pm\n\n" +
           "Can I help with anything else?";
  }

  // Location
  if (/(location|address|where|find|map|directions)/.test(cleanMessage)) {
    return "📍 Find us at:\n\n" +
           "123 Main Street\n" +
           "Dublin, Ireland\n" +
           "(Near Central Park)\n\n" +
           "Need our menu or hours?";
  }

  // Thanks
  if (/(thank|thanks|cheers|appreciate)/.test(cleanMessage)) {
    return "You're welcome! 😊\n\nIs there anything else I can help with?";
  }

  // Default
  return "I can help with:\n\n" +
         "1. 🍔 Menu\n" +
         "2. 🕒 Hours\n" +
         "3. 📍 Location\n\n" +
         "What would you like information about?";
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
  
  // Initial message
  call.write({
    user_id: "bot",
    text: "Hello! I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n\nWhat would you like?"
  });

  call.on('data', (message) => {
    try {
      const reply = handleUserMessage(message.text, lastBotMessage);
      lastBotMessage = reply;
      
      if (reply.includes('Thank you for chatting')) {
        call.write({ user_id: "bot", text: reply });
        call.end();
        return;
      }
      
      call.write({ user_id: "bot", text: reply });
    } catch (err) {
      console.error('LiveChat error:', err);
      call.write({ user_id: "bot", text: "Please try again." });
    }
  });

  call.on('end', () => call.end());
  call.on('error', (err) => console.error('LiveChat error:', err));
}

module.exports = {
  service: chatbotProto.ChatBotService.service,
  implementation: { GetBotResponse, LiveChat }
};