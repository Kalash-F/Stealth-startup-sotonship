import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets parallel dev servers use separate build folders (NEXT_DIST_DIR=.next-a).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Local dev only: send /api/* to the FastAPI backend (`make api`, port 8000, no /api prefix).
  // On Vercel, vercel.json routes /api/* to the backend service instead.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const target = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${target}/:path*` }];
  },
};

export default nextConfig;
