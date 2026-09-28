import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/extract": ["./fixtures/kettle/**/*"],
  },
};

export default nextConfig;
