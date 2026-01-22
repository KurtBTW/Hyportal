/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle node modules that don't work well in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  // Transpile wormhole-connect and other ESM packages
  transpilePackages: [
    "@wormhole-foundation/wormhole-connect",
  ],
};

export default nextConfig;
