"use client";

import { useState } from "react";
import { ProductImage, StockPhotoTag } from "./product-image";

/** The product's photo with thumbnails underneath when there are several, as in Everli's product card. */
export function ProductGallery({ images, alt, stockPhoto }: { images: string[]; alt: string; stockPhoto?: { label: string; hint: string; source?: string } }) {
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      <div className="relative flex aspect-square items-center justify-center p-2 md:p-6">
        {images.length === 0 ? (
          <ProductImage src={null} alt={alt} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[active]} alt={alt} className="h-full w-full object-contain" />
        )}
        {stockPhoto && <StockPhotoTag {...stockPhoto} className="absolute bottom-2 left-2" />}
      </div>
      {images.length > 1 && (
        <div className="scrollbar-none flex justify-center gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              className={`h-11 w-11 shrink-0 rounded-lg border-2 bg-white p-1 transition-colors ${i === active ? "border-ink" : "border-line hover:border-faint"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
