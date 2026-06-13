import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicLanding from "@/components/public-landing/Landing";
import { getPublicLandingConfig } from "@/components/public-landing/getLandingConfig";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = false;
export const dynamic = "force-static";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = await getPublicLandingConfig(slug);

  if (!config) {
    return {
      title: "Landing no encontrada",
    };
  }

  return {
    title: config.name,
    description: config.comment || config.content?.subtitle?.join(" ") || config.name,
  };
}

export default async function PublicLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const config = await getPublicLandingConfig(slug);

  if (!config) notFound();

  const firstBackground = config.background?.images?.[0];
  const secondBackground = config.background?.images?.[1];
  const supabaseOrigin = (() => {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    try {
      return raw ? new URL(raw).origin : "";
    } catch {
      return "";
    }
  })();

  return (
    <>
      {supabaseOrigin ? (
        <>
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />
          <link rel="dns-prefetch" href={supabaseOrigin} />
        </>
      ) : null}
      <link rel="preconnect" href="https://www.facebook.com" />
      <link rel="preconnect" href="https://connect.facebook.net" />
      {firstBackground ? <link rel="preload" as="image" href={firstBackground} fetchPriority="high" /> : null}
      {secondBackground ? <link rel="preload" as="image" href={secondBackground} /> : null}
      <PublicLanding slug={slug} config={config} />
    </>
  );
}
