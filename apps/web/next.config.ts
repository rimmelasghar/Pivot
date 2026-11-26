import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is used by the Docker image (symlinks fail on Windows hosts).
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  // Monorepo root, so standalone output includes workspace packages.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@pivot/protocol"],
  reactStrictMode: true,
  // The phone reaches the dev server through the tunnel host.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
