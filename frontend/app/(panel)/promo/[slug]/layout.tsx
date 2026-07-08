import type { Metadata } from "next";
import { fetchPromotionBySlug } from "@/lib/promotionsDb";

type PromoLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

const DEFAULT_PROMOTIONS_PUBLIC_BASE_URL = "https://sorteosgolden.vercel.app";

function getPromotionsPublicBaseUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_PROMOTIONS_PUBLIC_BASE_URL || "";
  try {
    return new URL(configuredUrl || DEFAULT_PROMOTIONS_PUBLIC_BASE_URL);
  } catch {
    return new URL(DEFAULT_PROMOTIONS_PUBLIC_BASE_URL);
  }
}

function cleanText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildPromoUrl(slug: string, baseUrl: URL): string {
  return new URL(`/promo/${encodeURIComponent(slug)}`, baseUrl).toString();
}

function buildShareImageUrl(slug: string, version: string, baseUrl: URL): string {
  const imageUrl = new URL(`/promo/${encodeURIComponent(slug)}/share-image`, baseUrl);
  imageUrl.searchParams.set("v", version);
  return imageUrl.toString();
}

export async function generateMetadata({ params }: PromoLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = getPromotionsPublicBaseUrl();
  const promotion = await fetchPromotionBySlug(slug).catch(() => null);
  const title = promotion
    ? `Participá por ${cleanText(promotion.title, "un sorteo")}`
    : "Sorteo Golden";
  const description = promotion
    ? cleanText(promotion.message, "Completá tus datos y participá por premios exclusivos.")
    : "Participá por premios exclusivos en Sorteos Golden.";
  const pageUrl = buildPromoUrl(slug, baseUrl);
  const shareImageUrl = buildShareImageUrl(slug, promotion?.updated_at ?? slug, baseUrl);

  return {
    metadataBase: baseUrl,
    title,
    description,
    icons: {
      icon: [{ url: "/promo-favicon.svg", type: "image/svg+xml" }],
    },
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description,
      siteName: "Sorteos Golden",
      images: [
        {
          url: shareImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImageUrl],
    },
  };
}

export default function PromoLayout({ children }: PromoLayoutProps) {
  return children;
}
