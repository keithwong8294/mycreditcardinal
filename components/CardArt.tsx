"use client";

import { useState } from "react";
import { cardImageSrc } from "@/lib/cardImages";
import { cardGradient, cn } from "@/lib/utils";

/**
 * The card's face: issuer card art when we have it, otherwise the card's
 * color gradient. The gradient also sits behind the image while it loads
 * and stays if the image fails.
 */
export function CardArt({
  card,
  className,
  children,
}: {
  card: { id: string; name: string; color_json: string[] };
  className?: string;
  /** Shown over the gradient only when there is no image (e.g. the card name). */
  children?: React.ReactNode;
}) {
  const src = cardImageSrc(card.id);
  const [failed, setFailed] = useState(false);
  const showImage = src !== null && !failed;

  return (
    <div
      className={cn("relative overflow-hidden shrink-0", className)}
      style={{ background: cardGradient(card.color_json) }}
    >
      {showImage ? (
        // Small static webp files in public/; next/image would add nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${card.name} card`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        children
      )}
    </div>
  );
}
