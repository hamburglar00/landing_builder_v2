import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/pbadmin/callback", headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ] },
      { source: "/public-assets/template-entry/:path*", headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ] },
      {
        source: "/vendor/meta-capi-param-builder/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
