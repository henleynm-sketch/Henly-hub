/** @type {import('next').NextConfig} */
const allowedOrigins = ["*.app.github.dev", "*.github.dev", "localhost:3000"];

if (process.env.CODESPACE_NAME) {
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
  allowedOrigins.push(`${process.env.CODESPACE_NAME}-3000.${domain}`);
}

if (process.env.VERCEL_URL) {
  allowedOrigins.push(process.env.VERCEL_URL);
}
if (process.env.VERCEL_BRANCH_URL) {
  allowedOrigins.push(process.env.VERCEL_BRANCH_URL);
}

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/db"],
  experimental: {
    serverActions: { allowedOrigins },
  },
};

export default nextConfig;
