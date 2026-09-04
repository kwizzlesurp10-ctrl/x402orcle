import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@x402orcle/oracle-brain"],
  poweredByHeader: false,
};

export default nextConfig;
