type Props = {
  images: string[];
  rotateEveryHours?: number;
};

export default function FrameBackgroundTemplate2({
  images,
  rotateEveryHours = 24,
}: Props) {
  const safeImages = images.filter(Boolean);
  const currentImage = safeImages[0];
  if (!currentImage) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentImage}
      alt=""
      className="frame__bg"
      data-public-landing-rotating-image={safeImages.length > 0 ? "true" : undefined}
      data-public-landing-images={JSON.stringify(safeImages)}
      data-public-landing-rotate-hours={rotateEveryHours}
      loading="eager"
      fetchPriority="high"
      decoding="async"
    />
  );
}
