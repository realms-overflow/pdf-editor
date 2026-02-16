# PDF Studio

A powerful, browser-based PDF manipulation tool built with **Next.js 14**, **TypeScript**, and **Fabric.js**.

![PDF Studio](https://placehold.co/800x400?text=PDF+Studio+Preview)

## 🚀 Features

### 1. Editor & Annotation
- **Draw**: Freehand drawing with customizable stroke width and color.
- **Highlight**: Translucent highlighter tool for text.
- **Shapes**: Add rectangles, circles, arrows, and lines.
- **Text**: Insert text annotations with adjustable size.
- **Eraser**: Remove annotations easily.
- **Undo/Redo**: Full history support for all actions.
- **Zoom**: Zoom in/out for precise editing.

### 2. PDF Management
- **Merge**: Combine multiple PDF files into a single document.
- **Split**: Extract specific pages or ranges from a PDF.
- **Client-Side Processing**: All PDF manipulation happens in your browser for maximum privacy.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Canvas Engine**: [Fabric.js](http://fabricjs.com/) (v5/v6)
- **PDF Manipulation**: [pdf-lib](https://pdf-lib.js.org/)
- **PDF Rendering**: [pdf.js](https://mozilla.github.io/pdf.js/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 📦 Getting Started

### Prerequisites
- Node.js 18.17 or later

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/realms-overflow/pdf-editor.git
    cd pdf-editor
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) (or the port shown in your terminal) with your browser.

## 🚀 Deployment

This project is optimized for deployment on **Vercel**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frealms-overflow%2Fpdf-editor)

1.  Push your code to a GitHub repository.
2.  Import the project into Vercel.
3.  Deploy!

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 🔒 Privacy & Security

PDF Studio is designed with privacy in mind. 
- **Local Processing**: Most operations (rendering, drawing, merging) happen entirely within your browser.
- **Secure Download**: For file exports, we use a secure, ephemeral server-side proxy to ensure compatibility across all devices and browsers. Files are processed in memory or temporary storage and are **not** permanently stored on any server.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

Built with ❤️ using Next.js.
