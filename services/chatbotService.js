const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const PROTO_PATH = path.resolve(__dirname, '../protos/chatbot.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const chatbotProto = grpc.loadPackageDefinition(packageDef).chatbot;
const nodemailer = require('nodemailer');

const API_KEY = "SECRET123";

function handleUserMessage(message, lastBotMessage = '', session = {}) {
    const cleanMessage = message.toLowerCase().trim();

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

        // Find the best matching location
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

    if (session.currentStep === 'awaitingMessage') {
        session.message = message;
        const sentimentResult = sentiment.analyze(message);
        session.sentiment = sentimentResult.score > 0 ? 'positive' : 
                          sentimentResult.score < 0 ? 'negative' : 'neutral';
        
        session.currentStep = 'awaitingEmail';
        let response = "Thank you for your message. ";
        
        if (session.sentiment === 'negative') {
            response += "We're sorry to hear about your experience. ";
        } else if (session.sentiment === 'positive') {
            response += "We're happy you enjoyed your visit! ";
        }
        
        response += "Could you please provide your email so our manager can follow up?";
        return response;
    }

    if (session.currentStep === 'awaitingEmail') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(cleanMessage)) {
            session.email = cleanMessage;

            const ticket = {
                feedbackType: session.feedbackType,
                location: session.location,
                message: session.message,
                email: session.email,
                sentiment: session.sentiment
            };
            sendTicketEmail(ticket);

            const ticketId = 'T-' + Math.floor(Math.random() * 10000);
            
            // Get correct emoji for sentiment
            const sentimentEmoji = {
                'positive': '😊',
                'negative': '😞',
                'neutral': '😐'
            }[session.sentiment] || '';

            const summary = `📨 Ticket #${ticketId} submitted.\n` +
                           `🗂️ Type: ${ticket.feedbackType}\n` +
                           `📍 Location: ${ticket.location}\n` +
                           `📝 Message: ${ticket.message}\n` +
                           `📧 Email: ${ticket.email}\n` +
                           `Sentiment: ${ticket.sentiment} ${sentimentEmoji}\n\n` +
                           `✅ Your ${ticket.feedbackType} has been sent to the branch manager. They'll contact you soon.\n\n` +
                           `Would you like to continue chatting? (yes/no)`;

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
               "🍟 Sides\n" +
               "🥤 Drinks\n\n" +
               "Would you like to know our hours or location?";
    }

    if (/(hour|time|open|close|schedule|when|2)/.test(cleanMessage)) {
        return "🕒 Our opening hours:\n\n" +
               "Sunday-Thursday: 12pm-9pm\n" +
               "Friday-Saturday: 12pm-10pm\n\n" +
               "Can I help with anything else?";
    }

    if (/(location|address|where|find|map|directions|)/.test(cleanMessage)) {
        return "📍 Find us at:\n\n" +
               "Millenium Walkway\n" +
               "Charlotte Way\n" +
               "Dundrum Shopping Centre\n" +
               "Liffey Valley Shopping Centre\n\n" +
               "Need our menu or hours?";
    }

    return "I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n4. 📩 Help (Feedback and Complaint)\n\nWhat would you like?";
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
        message: null,
        sentiment: null,
        awaitingContinuation: false
    };

    call.write({
        user_id: "bot",
        text: "Hello! I can help with:\n\n1. 🍔 Menu\n2. 🕒 Hours\n3. 📍 Location\n4. 📩 Help (Feedback and Complaint)\n\nWhat would you like?"
    });

    call.on('data', (message) => {
        try {
            const reply = handleUserMessage(message.text, lastBotMessage, session);
            lastBotMessage = reply;

            call.write({ user_id: "bot", text: reply });

            if (reply.includes("Thank you for chatting")) {
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

function CreateTicket(call, callback) {
    const { user_id, location, feedback_type, message } = call.request;
    
    const sentimentResult = sentiment.analyze(message);
    const sentimentLabel = sentimentResult.score > 0 ? 'positive' : 
                          sentimentResult.score < 0 ? 'negative' : 'neutral';

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

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'grc290497@gmail.com',
        pass: 'gcsdawdbjyirwqgl'
    }
});

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

module.exports = {
    service: chatbotProto.ChatBotService.service,
    implementation: {
        GetBotResponse,
        LiveChat,
        CreateTicket,
        StreamSuggestions
    },
    sendTicketEmail
};