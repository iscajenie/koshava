"use client";

import { useState } from "react";
import { ProductImage, StockPhotoTag } from "./product-image";

export function ProductGallery({ images, alt, stockPhoto }: { images: string[]; alt: string; stockPhoto?: { label: string; hint: string } }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return (
      <div className="card aspect-square p-6">
        <ProductImage src={null} alt={alt} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="card relative flex aspect-square items-center justify-center p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[active]} alt={alt} className="h-full w-full object-contain" />
        {stockPhoto && <StockPhotoTag {...stockPhoto} className="bottom-3 left-3 text-xs" />}
      </div>
      {images.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              className={`card h-16 w-16 shrink-0 p-1 ${i === active ? "border-brand ring-2 ring-brand/30" : ""}`}
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
