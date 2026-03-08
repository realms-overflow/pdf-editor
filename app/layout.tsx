import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Royale — Edit, Annotate & Merge PDFs",
  description:
    "A premium PDF editor with annotation, merge, and split tools. All processing happens in your browser.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
