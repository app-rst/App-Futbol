import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { EnvBanner } from "@/components/env-banner";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Fulbito", template: "%s · Fulbito" },
  description: "Organizá partidos de fútbol con amigos: anotate, armá equipos y votá el Premio Lio Messi.",
  applicationName: "Fulbito",
  appleWebApp: { capable: true, title: "Fulbito", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon/192" },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <EnvBanner />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
