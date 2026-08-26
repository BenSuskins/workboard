import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workboard/core"],
  webpack: (config) => {
    // @workboard/core uses NodeNext-style ".js" imports that resolve to .ts sources
    config.resolve.extensionAlias = { ".js": [".js", ".ts"], ".jsx": [".jsx", ".tsx"] };
    return config;
  },
};

export default nextConfig;
