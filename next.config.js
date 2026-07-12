/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Next's minimal-footprint production build for Docker: emits a
  // self-contained server (only the deps actually used at runtime traced in)
  // into .next/standalone, instead of requiring the full node_modules tree
  // in the final image.
  output: "standalone",
  images: {
    remotePatterns: [
      ...(process.env.R2_PUBLIC_URL
        ? [
            {
              protocol: "https",
              hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
              port: "",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "openweathermap.org",
        port: "",
      },
    ],
  },
};

module.exports = nextConfig;
