import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { TabBar } from "@/components/TabBar";
import { ShareListener } from "@/components/ShareListener";

export const metadata: Metadata = {
  title: "Ladle — your recipe box",
  description:
    "Save recipes from Instagram, TikTok and any website, and read them in a clean, ad-free format you can actually cook from.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Ladle" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0e" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Suspense fallback={null}>
          <ShareListener />
        </Suspense>
        <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-28 sm:px-6">{children}</div>
        <TabBar />
      </body>
    </html>
  );
}
