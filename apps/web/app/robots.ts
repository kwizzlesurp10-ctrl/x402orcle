import type { MetadataRoute } from "next";
import { oracleEnv } from "../lib/env";

export default function robots(): MetadataRoute.Robots {
  const env = oracleEnv();
  const baseUrl = env.publicBaseUrl;

  const discoveryEndpoints = [
    "/",
    "/.well-known/",
    "/.well-known/x402",
    "/.well-known/agent-card.json",
    "/.well-known/agents.json",
    "/.well-known/mcp.json",
    "/.well-known/mcp",
    "/.well-known/funding.json",
    "/llms.txt",
    "/llms-full.txt",
    "/agents.txt",
    "/openapi.json",
    "/mcp",
    "/jsonld",
    "/health",
    "/api/health",
    "/api/pricing",
    "/api/consult/",
  ];

  const aiBots = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "ExaBot",
    "FirecrawlAgent",
    "Googlebot",
    "Google-Extended",
    "bingbot",
    "CCBot",
    "Meta-ExternalAgent",
    "Cohere-ai",
    "Applebot",
    "Applebot-Extended",
    "Bytespider",
    "Diffbot",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: discoveryEndpoints,
        disallow: ["/v1/demo/mint-payment"],
      },
      {
        userAgent: aiBots,
        allow: ["/", ...discoveryEndpoints],
        disallow: ["/v1/demo/mint-payment"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
