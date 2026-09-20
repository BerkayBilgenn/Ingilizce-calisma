import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "İkra & Berkay İngilizce öğreniyor",
  description: "İkra ve Berkay'ın ortak İngilizce kelime çalışma alanı",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5a1830",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
