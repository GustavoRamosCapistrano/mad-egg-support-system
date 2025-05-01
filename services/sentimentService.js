const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDef = protoLoader.loadSync('protos/sentiment.proto');
const sentimentProto = grpc.loadPackageDefinition(packageDef).sentiment;

// Very basic keyword-based sentiment scoring
function AnalyzeFeedback(call) {
  const text = call.request.text.toLowerCase();

  const sentiments = [
    { category: 'Positive', keywords: ['good', 'great', 'love', 'excellent'], confidence: 0.9 },
    { category: 'Negative', keywords: ['bad', 'terrible', 'hate', 'slow'], confidence: 0.85 },
    { category: 'Neutral', keywords: ['okay', 'fine', 'average'], confidence: 0.7 }
  ];

  let matched = false;

  for (const s of sentiments) {
    for (const keyword of s.keywords) {
      if (text.includes(keyword)) {
        call.write({
          category: s.category,
          confidence: s.confidence
        });
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    call.write({ category: 'Neutral', confidence: 0.5 });
  }

  call.end();
}

module.exports = {
  service: sentimentProto.SentimentAnalysisService.service,
  implementation: { AnalyzeFeedback }
};
