/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Support standalone output for clean docker/cloud deployments
  output: "standalone",
};

export default nextConfig;
