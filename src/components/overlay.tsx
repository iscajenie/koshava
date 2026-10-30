"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * A page shown over the current one (app/[locale]/@modal): the product card as a centred dialog (full screen on
 * phones), the cart as a panel sliding in from the right. Closing goes back to the page underneath; Esc and a click
 * outside close it too. The URL stays shareable: opened directly, the same address renders as a normal page.
 */
export function Overlay({ variant, closeLabel, children }: { variant: "dialog" | "panel"; closeLabel: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Otherwise the first button inside gets focus, which in the cart is "Clear cart".
    closeButton.current?.focus();
  }, []);
  const close = () => router.back();

  const frame =
    variant === "dialog"
      ? "m-0 h-dvh max-h-none w-screen max-w-none transition-[opacity,translate] duration-200 starting:translate-y-3 starting:opacity-0 md:m-auto md:h-auto md:max-h-[calc(100dvh-168px)] md:w-[min(1024px,calc(100vw-64px))] md:rounded-3xl"
      : "mr-0 ml-auto h-dvh max-h-none w-screen max-w-none transition-transform duration-300 ease-in-out starting:translate-x-full sm:w-[450px]";
  const closeAt = variant === "dialog" ? "top-4 left-4 md:top-5 md:right-6 md:left-auto" : "top-4 right-4";

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className={`overflow-hidden border-0 bg-white p-0 text-ink backdrop:bg-ink/50 ${frame}`}
    >
      <div className="h-full max-h-[inherit] overflow-y-auto overscroll-contain">{children}</div>
      <button ref={closeButton} type="button" onClick={close} className={`icon-btn absolute z-10 ${closeAt}`} aria-label={closeLabel}>
        <CloseIcon size={20} />
      </button>
    </dialog>
  );
}
