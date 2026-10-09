import type { NextConfig } from 'next';

// Scope next/image to our specific Cloudinary account. Leaving the pathname
// unscoped would render any res.cloudinary.com URL — broadening the
// SSRF/image-loader surface if a stored URL is ever attacker-controlled
// (e.g. an admin pastes a malicious link, or a future feature accepts URLs).
// Falls back to '/**' if the env var is missing at build time so dev doesn't
// silently break — but production builds should always have it set.
const cloudinaryCloud = process.env.CLOUDINARY_CLOUD_NAME;
const cloudinaryPathname = cloudinaryCloud ? `/${cloudinaryCloud}/**` : '/**';

const nextConfig: NextConfig = {
  distDir: process.env.COMPANION_RECORDS_MODE === '1' ? '.next-records' : '.next',
  // The local demo runs under `next dev`; keep the dev badge out of screenshots and recordings.
  devIndicators: false,
  // The Bedrock SDK is loaded lazily on the server only; keep it out of the bundle.
  serverExternalPackages: ['@prisma/client', 'prisma', '@aws-sdk/client-bedrock-runtime'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: cloudinaryPathname,
      },
    ],
  },
};

export default nextConfig;
