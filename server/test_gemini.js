const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function testOCR() {
    try {
        console.log('Testing with model: ' + (process.env.GEMINI_MODEL || 'gemini-1.5-flash (default test)'));
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
        const result = await model.generateContent('Say hello');
        console.log('Result:', result.response.text());
    } catch (err) {
        console.error('Error:', err);
    }
}

testOCR();
