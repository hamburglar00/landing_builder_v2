import Image from "next/image";

const variants = {
  horizontal: { file: "landingbuilder-logo-dark.svg", width: 210.05, height: 64 },
  vertical: { file: "landingbuilder-logo-vertical-dark.svg", width: 143.05, height: 93.5 },
  mark: { file: "landingbuilder-isotipo-dark.svg", width: 64, height: 64 },
} as const;

export function LandingBuilderLogo({
  variant = "horizontal",
  className = "h-auto w-44 max-w-full",
}: {
  variant?: keyof typeof variants;
  className?: string;
}) {
  const { file, width, height } = variants[variant];

  return (
    <Image
      src={`/brand/landingbuilder/${file}`}
      alt="LandingBuilder"
      width={width}
      height={height}
      className={className}
      loading="eager"
      unoptimized
    />
  );
}
