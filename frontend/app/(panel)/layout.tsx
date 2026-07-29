import type { Metadata } from "next";
import "../globals.css";
import { CurrencyScopeProvider } from "@/components/currency/CurrencyScope";

export const metadata: Metadata = {
  title: "PBAdmin Landing Builder",
  description:
    "PBAdmin Landing Builder: panel para configurar y administrar landings multi-cuenta.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <CurrencyScopeProvider>{children}</CurrencyScopeProvider>
      </body>
    </html>
  );
}
