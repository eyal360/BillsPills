# 🚀 Deployment Guide: BillsPills

Follow these steps to deploy your project to **GitHub** and **Vercel** as a production-ready PWA.

## 1. Prepare Your GitHub Repository
1.  **Create a new repository** on GitHub (e.g., `BillsPills`).
2.  **Initialize Git** (if not already done):
    ```bash
    git init
    git add .
    git commit -m "Initial production-ready commit"
    ```
3.  **Push to GitHub**:
    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/BillsPills.git
    git branch -M main
    git push -u origin main
    ```

## 2. Deploy to Vercel
Vercel is the recommended hosting for this monorepo as it handles both the React frontend and the Express (Node.js) API automatically.

1.  **Login to [Vercel](https://vercel.com/)** using your GitHub account.
2.  Click **"Add New"** > **"Project"**.
3.  **Import** your `BillsPills` repository.
4.  **Configure Project**:
    *   **Framework Preset**: Vite.
    *   **Root Directory**: Leave as `./` (Root).
    *   **Build Command**: `npm run build`.
    *   **Output Directory**: `client/dist`.
5.  **Environment Variables**:
    You MUST add the following variables in the Vercel dashboard:
    *   `GEMINI_API_KEY`: Your Google AI key.
    *   `SUPABASE_URL`: Your project URL.
    *   `SUPABASE_ANON_KEY`: Your project anon key.
    *   `JWT_SECRET`: (If used, otherwise matches Supabase project secret).
    *   `PORT`: `3001` (Optional, Vercel handles this).
6.  Click **Deploy**.

## 3. Post-Deployment (PWA)
1.  Vercel will provide a URL (e.g., `billspills.vercel.app`).
2.  Open this URL on your phone browser.
3.  **iOS**: Tap "Share" > "Add to Home Screen".
4.  **Android**: Tap "Add to Home Screen" or "Install".
5.  The app will now work as a standalone PWA with its own icon and splash screen.

## 4. Continuous Deployment
Every time you `git push origin main`, Vercel will:
*   Build your frontend.
*   Coldboot your serverless functions (Express API).
*   Live-update your changes within ~1-2 minutes.

---

### 💡 Pro Tips
*   **Database**: Ensure your Supabase migrations are applied to your production database in the Supabase Dashboard.
*   **CORS**: The provided `server/src/index.ts` uses `cors()`, which allows access from your Vercel domains automatically.
*   **Logs**: Check Vercel's "Logs" tab if the OCR or API fails in production.
