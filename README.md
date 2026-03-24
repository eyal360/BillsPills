# 🛡️ BillsPills
### The Medicine for your Bills' Mess 💊

**BillsPills** is a modern Progressive Web App (PWA) designed to simplify property expense management. It leverages AI-powered OCR to analyze bills, track payments, and organize financial data for multiple properties in one beautiful, streamlined interface.

---

## ✨ Key Features
- **🤖 AI-Powered OCR**: Upload images or PDFs of bills. Google Gemini automatically extracts the bill type, amount, dates, and account details.
- **🏠 Smart Property Matching**: Automatic association of uploaded bills with your registered properties based on address detection.
- **📈 Bill Timeline**: Trace the history of every expense, from initial upload to final payment, with automatic event logging.
- **💸 Flexible Payment Tracking**: Support for partial payments, credit tracking, and clear "Waiting/Paid" status management.
- **📊 Real-time Stats**: High-level dashboards showing total spending per property, category, and time period.
- **📱 PWA Ready**: Installable on iOS and Android for a native app experience without an app store.

---

## 🚀 Technology Stack
- **Frontend**: React (Vite) + TypeScript + TailwindCSS-inspired Vanilla CSS.
- **Backend**: Node.js + Express (Serverless on Vercel).
- **Database**: Supabase (PostgreSQL) + Row Level Security (RLS).
- **AI Engine**: Google Gemini.

---

## 🤖 Gemini AI Models Comparison

The system is designed to use Google Gemini for OCR and Chatbot capabilities. Below is a comparison of the latest models. **For consistency and optimal performance, Gemini 3 Flash is recommended for all use cases in this app.**

| Model | Intelligence | Cost (1M tokens) | Ideal Use Case |
|-------|--------------|------------------|----------------|
| **Gemini 3.1 Pro** | 🏆 Highest | ~$2.00 in / $12.00 out | Deep financial reasoning & complex reporting |
| **Gemini 3 Flash** | ⚡ Balanced | ~$0.50 in / $3.00 out | **Default**: OCR, RAG, and everyday assistant chat |
| **Gemini 3.1 Flash-Lite** | 📉 Lowest | ~$0.10 in / $0.40 out | Basic text classification & simple status checks |

---
**Built for smart property owners who value their time.**
