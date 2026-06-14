type Props = {
  images: string[];
  rotateEveryHours?: number;
  overlay?: boolean;
};

export default function RotatingBackground({
  images,
  rotateEveryHours = 24,
  overlay = true,
}: Props) {
  const safeImages = images.filter(Boolean);
  const currentImage = safeImages[0];

  return (
    <div
      className="background-layer"
      data-public-landing-rotating-background={safeImages.length > 0 ? "true" : undefined}
      data-public-landing-images={JSON.stringify(safeImages)}
      data-public-landing-rotate-hours={rotateEveryHours}
      style={
        currentImage
          ? {
              backgroundImage: `url(${currentImage})`,
            }
          : undefined
      }
    >
      {overlay ? <div className="overlay" /> : null}
    </div>
  );
}
