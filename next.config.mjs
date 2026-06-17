/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["sharp", "@prisma/client", "prisma"],
  },
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
      "./node_modules/@aws-sdk/**/*",
      "./node_modules/@aws-crypto/**/*",
      "./node_modules/@smithy/**/*",
    ],
  },
};

export default nextConfig;
