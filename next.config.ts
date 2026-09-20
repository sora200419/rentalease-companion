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
  serverExternalPackages: ['@prisma/client', 'prisma'],
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
