import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Increase serverless function timeout for notification-heavy routes
    // Requires Vercel Pro plan for values > 10
  },
  // Set max duration per route via route segment config instead (see route files)
};

export default nextConfig;