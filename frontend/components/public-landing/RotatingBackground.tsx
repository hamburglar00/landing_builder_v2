"use client";

import { useEffect, useMemo, useState } from "react";

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

  return (
    <div
      className="background-layer"
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
