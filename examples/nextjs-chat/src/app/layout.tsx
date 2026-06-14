import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turing Chat Chat",
  description: "Example application for @turing-chat/react",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ margin: 0, padding: 0, height: "100%" }}>
      <body style={{ margin: 0, padding: 0, height: "100%", background: "#0a0a0f" }}>
        {children}
      </body>
    </html>
  );
}
