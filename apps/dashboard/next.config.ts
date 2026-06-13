import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing the @swarm/shared workspace package (TS source) directly.
  transpilePackages: ["@swarm/shared"],
};

export default nextConfig;
