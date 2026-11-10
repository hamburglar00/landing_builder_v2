import type { Metadata, Viewport } from "next";
import "../globals.css";
import { CurrencyScopeProvider } from "@/components/currency/CurrencyScope";
import { LoginTransitionProvider } from "@/components/brand/LoginTransitionProvider";

export const metadata: Metadata = {
  title: "LandingBuilder",
  description:
    "LandingBuilder: panel para configurar y administrar landings multi-cuenta.",
  applicationName: "LandingBuilder",
  metadataBase: new URL("https://mkt.panelbotadmin.com"),
  openGraph: {
    type: "website",
    title: "LandingBuilder",
    description: "Gestioná landings, conversiones e integraciones desde un solo lugar.",
    siteName: "LandingBuilder",
    images: [{ url: "/brand/landingbuilder/og-image.png", width: 1200, height: 630, alt: "LandingBuilder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LandingBuilder",
    description: "Gestioná landings, conversiones e integraciones desde un solo lugar.",
    images: ["/brand/landingbuilder/og-image.png"],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=landingbuilder" },
      { url: "/favicon.svg?v=landingbuilder", sizes: "any", type: "image/svg+xml" },
      { url: "/favicon-16x16.png?v=landingbuilder", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=landingbuilder", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=landingbuilder", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0F12",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <CurrencyScopeProvider><LoginTransitionProvider>{children}</LoginTransitionProvider></CurrencyScopeProvider>
      </body>
    </html>
  );
}
