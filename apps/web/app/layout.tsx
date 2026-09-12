import type { Metadata } from "next";
import "./globals.css";
import { jsonLd, SERVICE } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const env = oracleEnv();
  const baseUrl = env.publicBaseUrl;

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: "x402 Oracle — 402 is the answer | A2A & MCP Wisdom Market",
      template: "%s | x402 Oracle",
    },
    description:
      "Paid & Free MCP + HTTP 402 wisdom market for x402, MCP, A2A, and Bazaar agents on Base USDC (eip155:8453). Autonomous state verification, attestation, and diagnostics.",
    applicationName: SERVICE.name,
    authors: [{ name: "Local AI Integrations", url: baseUrl }],
    creator: "Local AI Integrations",
    publisher: "x402 Oracle",
    category: "technology",
    classification: "Autonomous Agent Wisdom Market & Blockchain Attestation",
    keywords: [
      "x402",
      "x402 protocol",
      "HTTP 402",
      "payment required",
      "MCP",
      "Model Context Protocol",
      "A2A",
      "agent to agent",
      "oracle",
      "blockchain oracle",
      "Base",
      "USDC",
      "eip155:8453",
      "smart contracts",
      "attestation",
      "bazaar",
      "CDP",
      "Coinbase Developer Platform",
      "web crawler",
      "AI agent swarm",
      "LLM discoverability",
      "machine payments",
    ],
    alternates: {
      canonical: "/",
      types: {
        "text/plain": [
          { url: "/llms.txt", title: "LLMs.txt" },
          { url: "/llms-full.txt", title: "LLMs Full Technical Reference" },
          { url: "/agents.txt", title: "Agents.txt" },
        ],
        "application/json": [
          { url: "/openapi.json", title: "OpenAPI 3.1 Specification" },
          { url: "/.well-known/x402", title: "x402 Protocol Manifest" },
          { url: "/.well-known/agent-card.json", title: "A2A Agent Card" },
          { url: "/.well-known/agents.json", title: "Agents Registry" },
          { url: "/.well-known/mcp.json", title: "MCP Server Manifest" },
          { url: "/.well-known/funding.json", title: "Funding & PayTo Manifest" },
        ],
        "application/ld+json": [
          { url: "/jsonld", title: "Schema.org JSON-LD Structured Graph" },
        ],
      },
    },
    openGraph: {
      title: "x402 Oracle — 402 is the answer | A2A & MCP Wisdom Market",
      description:
        "Paid & Free MCP + HTTP 402 wisdom market for autonomous agents on Base USDC (eip155:8453). Autonomous state verification, attestation, and diagnostics.",
      url: baseUrl,
      siteName: "x402 Oracle",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "x402 Oracle — 402 is the answer | A2A & MCP Wisdom Market",
      description:
        "Paid & Free MCP + HTTP 402 wisdom market for autonomous agents on Base USDC (eip155:8453).",
      creator: "@x402oracle",
    },
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: false,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      apple: "/icon.svg",
    },
    other: {
      x402: `x402_version=2; network=${env.network}`,
      "x402:network": env.network,
      "x402:payTo": env.payTo,
      "x402:catalog": `${baseUrl}/.well-known/x402`,
      "mcp:endpoint": `${baseUrl}/mcp`,
      "mcp:manifest": `${baseUrl}/.well-known/mcp.json`,
      "a2a:agent-card": `${baseUrl}/.well-known/agent-card.json`,
      "ai:llms-txt": `${baseUrl}/llms.txt`,
      "ai:llms-full": `${baseUrl}/llms-full.txt`,
      "ai:agents-txt": `${baseUrl}/agents.txt`,
      "ai:openapi": `${baseUrl}/openapi.json`,
      "ai:funding": `${baseUrl}/.well-known/funding.json`,
      "ai:jsonld": `${baseUrl}/jsonld`,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const env = oracleEnv();
  const ld = jsonLd(env);

  return (
    <html lang="en">
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLMs Full Technical Reference" />
        <link rel="alternate" type="text/plain" href="/agents.txt" title="Agents.txt" />
        <link rel="alternate" type="application/json" href="/openapi.json" title="OpenAPI Specification" />
        <link rel="alternate" type="application/json" href="/.well-known/x402" title="x402 Protocol Manifest" />
        <link rel="alternate" type="application/json" href="/.well-known/agent-card.json" title="A2A Agent Card" />
        <link rel="alternate" type="application/json" href="/.well-known/mcp.json" title="MCP Server Manifest" />
        <link rel="alternate" type="application/ld+json" href="/jsonld" title="Schema.org JSON-LD" />
        <link rel="service" type="application/json" href="/mcp" title="MCP Streamable HTTP Endpoint" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
