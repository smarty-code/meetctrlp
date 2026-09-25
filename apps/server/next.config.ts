import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ctrlp/firebase", "@ctrlp/types", "@ctrlp/schemas"],
};

export default nextConfig;
