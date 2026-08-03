import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "beyou-teste-nine.vercel.app" },
    ],
  },
};

export default nextConfig;
