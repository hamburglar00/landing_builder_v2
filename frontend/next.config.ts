import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/gateway-landings/**": ["./public/public-assets/template-entry/*", "./public/public-assets/template9/*", "./public/vendor/meta-capi-param-builder/1.3.1/*", "./public/vendor/atrio-meta-click/v1/*"],
  },
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
