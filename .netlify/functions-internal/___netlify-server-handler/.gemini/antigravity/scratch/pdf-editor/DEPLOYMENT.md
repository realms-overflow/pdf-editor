# Deploying the PDF Editor

This guide explains how to deploy your Next.js PDF Editor application. The recommended platform for Next.js apps is **Vercel**, but you can also use **Netlify** or any Node.js hosting.

## Option 1: Deploy with Vercel (Recommended)

Vercel is the easiest way to deploy Next.js apps.

### Prerequisites
- A GitHub, GitLab, or Bitbucket account.
- A Vercel account (free).

### Steps via Git Integration (Best Practice)
1.  **Push your code to GitHub/GitLab:**
    Since this project is already a Git repository, push it to a new repository on your Git provider.
    ```bash
    git remote add origin https://github.com/your-username/your-repo-name.git
    git push -u origin main
    ```
2.  **Import to Vercel:**
    - Go to [vercel.com](https://vercel.com) and log in.
    - Click "Add New..." -> "Project".
    - Import your Git repository.
    - Vercel will auto-detect Next.js.
    - Click **Deploy**.

### Steps via Vercel CLI (Quickest)
If you don't want to use Git, you can deploy directly from your terminal.

1.  **Install Vercel CLI:**
    ```bash
    npm i -g vercel
    ```
2.  **Deploy:**
    Run this command in the project root:
    ```bash
    vercel
    ```
    Follow the prompts to log in and deploy.

## Option 2: Deploy with Netlify

1.  **Install Netlify CLI:**
    ```bash
    npm i -g netlify-cli
    ```
2.  **Deploy:**
    ```bash
    netlify deploy
    ```
    Follow the prompts. For production deployment, use `netlify deploy --prod`.

## Environment Variables

This application does not currently require any environment variables (API keys, database URLs, etc.). If you add features later that need them, configure them in your deployment platform settings.

## Troubleshooting

- **Build Errors:** If deployment fails, run `npm run build` locally to debug.
- **API Issues:** Ensure your API routes (like `/api/download`) are working correctly. Vercel handles API routes automatically as serverless functions.
