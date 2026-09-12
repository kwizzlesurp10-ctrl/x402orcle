import type { MetadataRoute } from 'next';
import { oracleEnv } from '../lib/env';

export default function robots(): MetadataRoute.Robots {
  const env = oracleEnv();
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/.well-known/',
          '/llms.txt',
          '/agents.txt',
          '/openapi.json',
          '/api/health',
          '/api/pricing',
        ],
      },
      {
        userAgent: [
          'GPTBot',
          'ClaudeBot',
          'PerplexityBot',
          'ExaBot',
          'FirecrawlAgent',
          'Googlebot',
          'bingbot',
        ],
        allow: '/',
      }
    ],
    sitemap: `${env.publicBaseUrl}/sitemap.xml`,
  };
}
