import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteTitle = "PC-SPA — A cleaner, clearer Windows PC";
const siteDescription =
  "Join the controlled PC-SPA beta and safely understand, clean, and improve your Windows PC.";
const siteUrl = "https://getpcspa.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: siteTitle,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/pc-spa-hero.png",
        width: 1024,
        height: 1024,
        alt: "Illustration of a modern PC workstation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/pc-spa-hero.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f1e7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
