import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LandingBuilder",
    short_name: "LandingBuilder",
    description: "Panel para configurar y administrar landings multi-cuenta.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0F12",
    theme_color: "#0A0F12",
    icons: [
      {
        src: "/icon-192.png?v=landingbuilder",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png?v=landingbuilder",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png?v=landingbuilder",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

