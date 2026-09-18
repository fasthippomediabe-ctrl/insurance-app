import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      // Self-hosted behind the Cloudflare tunnel: the Host header arrives as
      // triplej.ascendryx.net, so it must be listed or every Server Action is
      // rejected. The old Vercel and ascendryxdigital entries stay until that
      // deployment is retired.
      allowedOrigins: [
        "triplej.ascendryx.net",
        "triplej.ascendryxdigital.com",
        "localhost:3000",
        "localhost:3006",
        "*.vercel.app",
      ],
    },
  },
};

export default nextConfig;
