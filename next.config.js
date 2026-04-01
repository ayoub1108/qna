/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle these on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    // Exclude native node modules from webpack
    config.externals = [...(config.externals || []), 
      "onnxruntime-node",
      "@xenova/transformers",
    ];
    return config;
  },
};

module.exports = nextConfig;