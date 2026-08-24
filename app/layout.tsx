import type { Metadata } from "next";
import "./globals.css";
import "./brand-system.css";
import "./public-pages.css";
import "./internal-unified.css";
import "./workspace-pattern.css";
import "./system-shell-v3.css";
import "./system-refinement-v4.css";
import "./transactional-refinement-v5.css";

export const metadata: Metadata = {
  title: "BeYou — Seja você. Na sua melhor versão.",
  description: "Ciência, tecnologia, acompanhamento e comunidade em uma única plataforma de saúde e bem-estar.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
