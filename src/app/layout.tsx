import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mica | Personal image library",
  description: "A quiet home for your visual archive.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
