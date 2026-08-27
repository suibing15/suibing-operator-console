import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import ServiceWorkerRegister from "@/lib/ServiceWorkerRegister";

const SITE_URL = "https://suibingitservices.online";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SUIBING IT Services — School Software & Digital Solutions in Nigeria",
    template: "%s | SUIBING IT Services",
  },
  description:
    "SUIBING LIMITED builds school records, examination, and management software for Nigerian schools, plus custom web and app development for businesses. Digital solutions for education and beyond.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SUIBING",
  },
  openGraph: {
    siteName: "SUIBING IT Services",
    locale: "en_NG",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "SUIBING IT Services" }],
  },
  twitter: {
    card: "summary",
    images: ["/icon-512.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1B2A4A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
