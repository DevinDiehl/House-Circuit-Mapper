import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circuit — Home electrical map",
  description: "Map outlets, appliances, breakers, and connections on your home floor plan.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
