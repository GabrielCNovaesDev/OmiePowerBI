import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(__dirname, "..", ".env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: resolve(__dirname),
  serverExternalPackages: ["pg"],
  experimental: {
    optimizePackageImports: ["lucide-react", "echarts", "echarts/core"],
  },
};

export default nextConfig;
