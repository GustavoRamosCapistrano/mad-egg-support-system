const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDef = protoLoader.loadSync('protos/ticketing.proto');
const ticketingProto = grpc.loadPackageDefinition(packageDef).ticketing;

function SubmitFeedback(call, callback) {
  let feedbackBatch = [];

  call.on('data', (feedback) => {
    console.log(`Received feedback from ${feedback.user_id}: ${feedback.content}`);
    feedbackBatch.push(feedback);
  });

  call.on('end', () => {
    const ticketId = `TICKET-${Math.floor(Math.random() * 10000)}`;
    console.log(`Creating ticket ${ticketId} for ${feedbackBatch.length} messages.`);

    callback(null, {
      ticket_id: ticketId,
      status: 'Received and being reviewed'
    });
  });
}

module.exports = {
  service: ticketingProto.TicketingService.service,
  implementation: { SubmitFeedback }
};
