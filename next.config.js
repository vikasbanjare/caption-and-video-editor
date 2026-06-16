/** @type {import('next').NextConfig} */

// When NEXT_PUBLIC_STATIC_EXPORT=true we build a fully static, browser-only
// version for GitHub Pages (no server / API routes). basePath matches the
// project-pages URL: https://<user>.github.io/caption-and-video-editor/
const isStatic = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";
const repo = "caption-and-video-editor";

const nextConfig = {
  reactStrictMode: true,

  // transformers.js (used in the Whisper Web Worker) references some Node-only
  // modules that aren't needed in the browser build — stub them out.
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node": false,
      sharp: false,
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },

  ...(isStatic
    ? {
        output: "export",
        basePath: `/${repo}`,
        assetPrefix: `/${repo}/`,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

module.exports = nextConfig;
