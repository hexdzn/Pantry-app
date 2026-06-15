import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Pantry — Family Kitchen",
  description: "One shared list for the whole family — groceries, sabzi & fruits.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pantry" },
  icons: { apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  themeColor: "#3A6B4E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><RegisterSW />{children}</body>
    </html>
  );
}
