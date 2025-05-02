const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../protos/sentiment.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const sentimentProto = grpc.loadPackageDefinition(packageDef).sentiment;

const client = new sentimentProto.SentimentAnalysisService(
  'localhost:50053',
  grpc.credentials.createInsecure()
);

// Server Streaming
function analyzeFeedback(text) {
  const call = client.AnalyzeFeedback({
    text,
    api_key: "SECRET123"
  });

  call.on('data', (score) => {
    console.log(`Sentiment: ${score.category} (${score.confidence.toFixed(2)})`);
  });

  call.on('end', () => console.log('Analysis complete'));
  call.on('error', (err) => console.error('Error:', err));
}

// Simple RPC
function getSingleSentiment(text) {
  return new Promise((resolve, reject) => {
    client.GetSingleSentiment({
      text,
      api_key: "SECRET123"
    }, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

module.exports = { analyzeFeedback, getSingleSentiment };