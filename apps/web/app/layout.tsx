import type { Metadata } from "next";
import "./globals.css";
import { jsonLd } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../lib/env";

export const metadata: Metadata = {
  title: "x402 Oracle — 402 is the answer",
  description: "402 is the answer. The Oracle is how you ask.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const env = oracleEnv();
  const ld = jsonLd(env);
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
