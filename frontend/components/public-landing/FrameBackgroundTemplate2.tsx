"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  images: string[];
  rotateEveryHours?: number;
};

export default function FrameBackgroundTemplate2({
  images,
  rotateEveryHours = 24,
}: Props) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (safeImages.length <= 1) return;

    const everyMs = Math.max(1, rotateEveryHours) * 60 * 60 * 1000;
    const initialIndex = Math.floor(Date.now() / everyMs) % safeImages.length;
    setIndex(initialIndex);

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeImages.length);
    }, everyMs);

    return () => window.clearInterval(interval);
  }, [safeImages, rotateEveryHours]);

  const currentImage = safeImages[index];
  if (!currentImage) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentImage}
      alt=""
      className="frame__bg"
      loading="eager"
      fetchPriority="high"
      decoding="async"
    />
  );
}
