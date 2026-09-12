import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@x402orcle/oracle-brain"],
  poweredByHeader: false,
  outputFileTracingRoot: path.join(here, "../.."),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS, HEAD" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, Payment-Signature, PAYMENT-SIGNATURE, X-Payment, x402-version",
          },
          {
            key: "Access-Control-Expose-Headers",
            value: "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Payment-Required, Payment-Response, x402-version",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
