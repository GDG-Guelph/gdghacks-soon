import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GDGHacks 2026 | Guelph's In-Person Hackathon",
  description: "Join us for GDGHacks 2026, a hackathon hosted in Guelph. Innovate, create, and collaborate.",
  openGraph: {
    title: "GDGHacks 2026",
    description: "Join us for GDGHacks 2026, a hackathon hosted in Guelph.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className}>{children}</body>
    </html>
  );
}
