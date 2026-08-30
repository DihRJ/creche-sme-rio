import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fila Única — uma criança, uma fila, uma vaga",
  description:
    "Painel para a SME-Rio: 4.477 crianças a mais na creche em 2025 sem abrir uma vaga nova, trocando a classificação por opção pela classificação por criança.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
