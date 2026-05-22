import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transaction Analysis — OFAC Alert Review",
  description: "Compliance transaction analysis and OFAC alert disposition",
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
