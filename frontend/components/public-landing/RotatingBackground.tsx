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

  if (currentImage) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage}
          alt=""
          className="background-layer background-layer__image"
          data-public-landing-rotating-image="true"
          data-public-landing-images={JSON.stringify(safeImages)}
          data-public-landing-rotate-hours={rotateEveryHours}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          width={1080}
          height={1920}
        />
        {overlay ? <div className="overlay" /> : null}
      </>
    );
  }

  return (
    <div
      className="background-layer"
    >
      {overlay ? <div className="overlay" /> : null}
    </div>
  );
}
