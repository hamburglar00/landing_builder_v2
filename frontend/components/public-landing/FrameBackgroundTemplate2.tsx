type Props = {
  images: string[];
  responsiveImages?: Array<{
    mobile?: string;
    tablet?: string;
    desktop?: string;
  }>;
  rotateEveryHours?: number;
};

export default function FrameBackgroundTemplate2({
  images,
  responsiveImages = [],
  rotateEveryHours = 24,
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
  if (!currentImage) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentImage}
      srcSet={srcSet}
      sizes="(max-width: 430px) 100vw, 430px"
      alt=""
      className="frame__bg"
      data-public-landing-rotating-image={rotationImages.length > 0 ? "true" : undefined}
      data-public-landing-images={JSON.stringify(rotationImages)}
      data-public-landing-rotate-hours={rotateEveryHours}
      loading="eager"
      fetchPriority="high"
      decoding="async"
      width={430}
      height={780}
    />
  );
}
