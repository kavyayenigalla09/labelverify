import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabelVerify | Alcohol Label Compliance Assistant",
  description:
    "AI-assisted alcohol beverage label verification proof-of-concept.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
