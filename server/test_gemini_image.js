const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function testOCR() {
    try {
        const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        console.log('Testing with model: ' + modelName);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Use a dummy base64 if no file exists, or just a small one
        const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='; // Tiny PNG
        
        const result = await model.generateContent([
            'Extract text from this image',
            {
                inlineData: {
                    data: base64Data,
                    mimeType: 'image/png'
                }
            }
        ]);
        console.log('Result:', result.response.text());
    } catch (err) {
        console.error('Error details:', err);
    }
}

testOCR();
