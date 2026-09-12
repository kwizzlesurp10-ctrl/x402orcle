import type { MetadataRoute } from 'next';
import { oracleEnv } from '../lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const env = oracleEnv();
  const baseUrl = env.publicBaseUrl;
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/llms.txt`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/agents.txt`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/openapi.json`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/.well-known/x402`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/.well-known/agent-card.json`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/.well-known/mcp.json`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/.well-known/funding.json`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/api/health`, lastModified: now, changeFrequency: 'hourly', priority: 0.6 },
    { url: `${baseUrl}/api/pricing`, lastModified: now, changeFrequency: 'hourly', priority: 0.7 },
  ];
}
