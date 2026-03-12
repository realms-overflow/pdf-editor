<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/file-pen.svg" width="80" height="80" alt="PDF Royale Logo"/>
  <h1>PDF Royale 👑</h1>
  <p><strong>A Premium, Privacy-First Browser-Based PDF Editor</strong></p>
  <p>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
  </p>
</div>

---

Welcome to **PDF Royale**, the ultimate tool for viewing, annotating, merging, and manipulating your PDF documents directly in your browser. Built with a stunning modern glassmorphic interface and a heavy focus on user privacy—everything runs locally on your machine.

No subscriptions. No uploading documents to mysterious servers. Just pure, unadulterated PDF power at your fingertips.

## ✨ Why PDF Royale?

1. **🔒 100% Client-Side Privacy:** Your highly confidential PDFs never leave your device. All rendering, annotating, and merging operations happen locally using WebAssembly and canvas technologies.
2. **🎨 Beautiful Modern UI:** Experience a carefully crafted interface featuring glassmorphism, dynamic animations, and gorgeous curated color palettes.
3. **⚡ Lightning Fast:** Powered by Next.js 14 and optimized PDF.js workers to handle massive documents with ease.

## 🛠️ Powerful Features

### 🖍️ Studio-Grade Annotations
- **Intelligent Brush Engine**: Draw naturally with customizable stroke widths and stunning colors.
- **Smart Shapes**: Instantly drop perfectly drawn rectangles, circles/ellipses, precise lines, and arrows.
- **Highlighter Mode**: A built-in translucent highlighter to emphasize what's important.
- **Eraser Tool**: Pixel-perfect erasure of your strokes or entire shape deletions.
- **Infinite Undo/Redo**: Never worry about making a mistake. Every action is tracked and reversible.

### 📄 Document Manipulation
- **Merge Power**: Combine multiple massive PDFs into a single continuous document effortlessly. Just drag, drop, reorder, and merge.
- **Surgical Page Removal**: An interactive visual grid showing all pages in your document. Click the ones you don't want, and export the newly trimmed result.

### 🖼️ Seamless Interface
- **Infinite Pan & Zoom**: A highly optimized rendering layer that keeps your drawn annotations perfectly pinned to the text, regardless of how far you zoom in out or pan across the document.
- **Responsive Navigation**: Sidebar page thumbnails and a bottom floating action bar ensure you never lose your place.

## 🚀 Getting Started

Experience PDF Royale locally in seconds:

### Prerequisites
- Node.js 18.17+ 

### Installation

1. **Clone the royal codebase:**
   ```bash
   git clone https://github.com/realms-overflow/pdf-editor.git
   cd pdf-editor
   ```

2. **Equip the dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the royal engine:**
   ```bash
   npm run dev
   ```

4. **Enter the Studio:**
   Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

## 🌍 Tech Stack

PDF Royale stands on the shoulders of giants:
- **[Next.js 14 App Router](https://nextjs.org/)** - The React architecture.
- **[Fabric.js](http://fabricjs.com/)** - The powerhouse behind the annotation canvas layer.
- **[PDF.js](https://mozilla.github.io/pdf.js/)** - Industry-standard PDF rendering and workers.
- **[pdf-lib](https://pdf-lib.js.org/)** - For robust document merging and page manipulation.
- **[Lucide Icons](https://lucide.dev/)** - Beautiful, consistent iconography.

## 📜 License

PDF Royale is proudly open-source under the [MIT License](LICENSE). 

---
<div align="center">
  <i>Built with absolute precision and ❤️ by <a href="https://github.com/realms-overflow">Melih Kayhan</a></i>
</div>
