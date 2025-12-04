import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gaia Parking",
  description: "Camera-grounded parking occupancy detector",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
