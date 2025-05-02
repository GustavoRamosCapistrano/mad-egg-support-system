const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Fixed path resolution
const PROTO_PATH = path.resolve(__dirname, '../protos/sentiment.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH);
const sentimentProto = grpc.loadPackageDefinition(packageDef).sentiment;

const API_KEY = "SECRET123";

function AnalyzeFeedback(call) {
  if (call.request.api_key !== API_KEY) {
    call.emit('error', { 
      code: grpc.status.PERMISSION_DENIED,
      message: "Invalid API key" 
    });
    return;
  }

  const text = call.request.text.toLowerCase();
  const sentiments = [
    { category: 'Positive', keywords: ['good', 'great', 'love', 'excellent'], confidence: 0.9 },
    { category: 'Negative', keywords: ['bad', 'terrible', 'hate', 'slow'], confidence: 0.85 },
    { category: 'Neutral', keywords: ['okay', 'fine', 'average'], confidence: 0.7 }
  ];

  let matched = false;
  
  try {
    sentiments.forEach(sentiment => {
      if (sentiment.keywords.some(keyword => text.includes(keyword))) {
        call.write({
          category: sentiment.category,
          confidence: sentiment.confidence
        });
        matched = true;
      }
    });

    if (!matched) {
      call.write({ 
        category: 'Neutral', 
        confidence: 0.5 
      });
    }
    
    call.end();
  } catch (err) {
    console.error("Analysis error:", err);
    call.emit('error', {
      code: grpc.status.INTERNAL,
      message: "Analysis failed"
    });
  }
}

function GetSingleSentiment(call, callback) {
  if (call.request.api_key !== API_KEY) {
    callback({ 
      code: grpc.status.PERMISSION_DENIED,
      message: "Authentication failed"
    });
    return;
  }

  try {
    const text = call.request.text.toLowerCase();
    let result = { category: 'Neutral', confidence: 0.5 };

    if (text.includes('good') || text.includes('great')) {
      result = { category: 'Positive', confidence: 0.9 };
    } else if (text.includes('bad') || text.includes('terrible')) {
      result = { category: 'Negative', confidence: 0.85 };
    }

    callback(null, result);
  } catch (err) {
    console.error("Sentiment analysis error:", err);
    callback({
      code: grpc.status.INTERNAL,
      message: "Analysis failed"
    });
  }
}

module.exports = {
  service: sentimentProto.SentimentAnalysisService.service,
  implementation: { AnalyzeFeedback, GetSingleSentiment }
};