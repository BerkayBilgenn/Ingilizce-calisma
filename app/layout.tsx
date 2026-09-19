import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kelime Kartları",
  description: "İki kişilik günlük kelime tekrarı",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
