import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HyPortal - Solana to HyperEVM Bridge",
  description: "Non-custodial bridge from Solana to HyperEVM with HypurrFi deposits",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0a0a0c] text-white min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
