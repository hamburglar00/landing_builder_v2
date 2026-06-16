type Props = {
  images: string[];
  responsiveImages?: Array<{
    mobile?: string;
    tablet?: string;
    desktop?: string;
  }>;
  rotateEveryHours?: number;
  overlay?: boolean;
};

export default function RotatingBackground({
  images,
  responsiveImages = [],
  rotateEveryHours = 24,
  overlay = true,
}: Props) {
  const safeImages = images.filter(Boolean);
  const mobileImages = responsiveImages
    .map((image) => image.mobile)
    .filter((image): image is string => Boolean(image));
  const rotationImages = mobileImages.length ? mobileImages : safeImages;
  const firstResponsiveImage = responsiveImages[0];
  const currentImage = firstResponsiveImage?.mobile || safeImages[0];
  const srcSet = firstResponsiveImage
    ? [
        firstResponsiveImage.mobile ? `${firstResponsiveImage.mobile} 640w` : "",
        firstResponsiveImage.tablet ? `${firstResponsiveImage.tablet} 1024w` : "",
        firstResponsiveImage.desktop ? `${firstResponsiveImage.desktop} 1600w` : "",
      ]
        .filter(Boolean)
        .join(", ")
    : undefined;

  if (currentImage) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage}
          srcSet={srcSet}
          sizes="100vw"
          alt=""
          className="background-layer background-layer__image"
          data-public-landing-rotating-image="true"
          data-public-landing-images={JSON.stringify(rotationImages)}
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
