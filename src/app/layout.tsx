import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSO7 Beta — Maison Sacko",
  description:
    "Preset video studio for Maison Sacko. Upload clips, craft captions, export.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MSO7",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@1,300,400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="app-root antialiased">{children}</body>
    </html>
  );
}
