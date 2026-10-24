"use client";

import { useTransition } from "react";
import { setOrderStatus } from "@/actions/admin";
import { useShop } from "./shop-provider";

const statuses = ["new", "confirmed", "assembling", "delivering", "delivered", "cancelled"] as const;

export function OrderStatusButtons({ orderId, current }: { orderId: number; current: string }) {
  const { t } = useShop();
  const [pending, start] = useTransition();
  return (
    <div className={`flex flex-wrap gap-2 ${pending ? "opacity-60" : ""}`}>
      {statuses.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending || s === current}
          onClick={() => start(() => setOrderStatus(orderId, s))}
          className={`rounded border px-3 py-1.5 text-sm font-semibold ${
            s === current ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand hover:text-brand"
          }`}
          data-testid={`status-${s}`}
        >
          {t.order.statuses[s]}
        </button>
      ))}
    </div>
  );
}
