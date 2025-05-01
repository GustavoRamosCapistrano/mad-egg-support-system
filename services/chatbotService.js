const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const packageDef = protoLoader.loadSync('protos/chatbot.proto');
const chatbotProto = grpc.loadPackageDefinition(packageDef).chatbot;

function GetBotResponse(call, callback) {
  const message = call.request.message.toLowerCase();
  let reply = "Sorry, I didn’t get that.";

  if (message.includes("menu")) reply = "Our menu includes Chicken Burgers, Tenders, and Sides!";
  else if (message.includes("hours")) reply = "We’re open 12pm to 10pm, 7 days a week.";
  else if (message.includes("location")) reply = "We’re located in Dublin, Ireland.";

  callback(null, { reply });
}

module.exports = {
  service: chatbotProto.ChatBotService.service,
  implementation: { GetBotResponse }
};
