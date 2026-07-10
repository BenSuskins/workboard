import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workboard/core"],
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config) => {
    // @workboard/core uses NodeNext-style ".js" imports that resolve to .ts sources
    config.resolve.extensionAlias = { ".js": [".js", ".ts"], ".jsx": [".jsx", ".tsx"] };
    return config;
  },
};

export default nextConfig;
