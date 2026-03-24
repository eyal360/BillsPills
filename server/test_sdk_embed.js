const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function testSDK() {
  const modelName = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-2-preview';
  console.log(`Testing embedding with model: ${modelName}...`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.embedContent("Hello world");
    console.log('✅ SDK Success! Embedding length:', result.embedding.values.length);
  } catch (e) {
    console.error('❌ SDK Error:', e.message);
    if (e.stack) console.error(e.stack);
  }
}

testSDK();
