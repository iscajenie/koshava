"use client";

import { useActionState, useState } from "react";
import { placeOrder, type CheckoutState } from "@/actions/checkout";
import type { AddressFields } from "@/db/schema";
import type { DeliveryDay } from "@/lib/delivery";
import { fmt } from "@/i18n";
import { shop } from "@/config/shop";
import { formatDate, slotLabel } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { formatAddress } from "@/lib/address";
import { useShop } from "./shop-provider";

type SavedAddress = { id: number; fields: AddressFields; isDefault: boolean };

export function CheckoutForm({
  defaults,
  addresses,
  days,
}: {
  defaults: { name: string; phone: string };
  addresses: SavedAddress[];
  days: DeliveryDay[];
}) {
  const { locale, t } = useShop();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, {});
  const initialAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [addressId, setAddressId] = useState(initialAddress ? String(initialAddress.id) : "new");
  const [date, setDate] = useState(days[0]?.date ?? "");
  const slots = days.find((d) => d.date === date)?.slots ?? [];
  const invalid = (field: string) => (state.fields?.includes(field) ? true : undefined);
  const errorText = state.error
    ? state.error === "minOrder"
      ? fmt(t.checkout.errors.minOrder, { min: formatPrice(shop.minOrderMinor, locale) })
      : t.checkout.errors[state.error]
    : null;

  function dayLabel(d: DeliveryDay) {
    const label = formatDate(d.date, locale);
    if (d.offset === 0) return `${t.checkout.today}, ${label}`;
    if (d.offset === 1) return `${t.checkout.tomorrow}, ${label}`;
    return label;
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="locale" value={locale} />

      <fieldset className="card space-y-4 p-5">
        <legend className="float-left mb-2 w-full text-lg font-bold">{t.checkout.contacts}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">{t.checkout.name}</label>
            <input id="name" name="name" required autoComplete="name" defaultValue={defaults.name} className="field" aria-invalid={invalid("name")} />
          </div>
          <div>
            <label className="label" htmlFor="phone">{t.checkout.phone}</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder={t.checkout.phonePlaceholder}
              defaultValue={defaults.phone}
              className="field"
              aria-invalid={invalid("phone")}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="float-left mb-2 w-full text-lg font-bold">{t.checkout.address}</legend>
        <div className="clear-both text-sm text-muted">
          {t.checkout.city}: <span className="font-semibold text-ink">{shop.city}</span>
        </div>
        {addresses.length > 0 && (
          <div className="space-y-2">
            {addresses.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-light">
                <input type="radio" name="addressId" value={a.id} checked={addressId === String(a.id)} onChange={() => setAddressId(String(a.id))} className="mt-1 accent-brand" />
                <span className="text-[15px]">{formatAddress(a.fields, t)}</span>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-3 rounded border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-light">
              <input type="radio" name="addressId" value="new" checked={addressId === "new"} onChange={() => setAddressId("new")} className="accent-brand" />
              <span className="text-[15px] font-medium">{t.checkout.newAddress}</span>
            </label>
          </div>
        )}
        {addressId === "new" && (
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-4">
              <label className="label" htmlFor="street">{t.checkout.street}</label>
              <input id="street" name="street" required autoComplete="address-line1" className="field" aria-invalid={invalid("street")} />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="house">{t.checkout.house}</label>
              <input id="house" name="house" required className="field" aria-invalid={invalid("house")} />
            </div>
            {(["apartment", "entrance", "floor"] as const).map((f) => (
              <div key={f} className="col-span-2">
                <label className="label" htmlFor={f}>{t.checkout[f]}</label>
                <input id={f} name={f} className="field" />
              </div>
            ))}
            <div className="col-span-3">
              <label className="label" htmlFor="intercom">{t.checkout.intercom}</label>
              <input id="intercom" name="intercom" className="field" />
            </div>
            <div className="col-span-3">
              <label className="label" htmlFor="municipality">{t.checkout.municipality}</label>
              <input id="municipality" name="municipality" className="field" placeholder="Vračar, Novi Beograd…" />
            </div>
            <label className="col-span-6 flex items-center gap-2 text-sm">
              <input type="checkbox" name="saveAddress" value="1" defaultChecked className="h-4 w-4 accent-brand" />
              {t.checkout.saveAddress}
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="float-left mb-2 w-full text-lg font-bold">{t.checkout.when}</legend>
        <div className="clear-both grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="deliveryDate">{t.checkout.date}</label>
            <select id="deliveryDate" name="deliveryDate" value={date} onChange={(e) => setDate(e.target.value)} className="field">
              {days.map((d) => (
                <option key={d.date} value={d.date}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">{t.checkout.slot}</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-invalid={invalid("deliverySlot")}>
              {slots.map((s, i) => (
                <label key={`${date}-${s}`} className="flex cursor-pointer items-center justify-center rounded border border-line py-2.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white">
                  <input type="radio" name="deliverySlot" value={s} defaultChecked={i === 0} className="sr-only" />
                  {slotLabel(s)}
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="card space-y-3 p-5">
        <legend className="float-left mb-2 w-full text-lg font-bold">{t.checkout.payment}</legend>
        <div className="clear-both grid gap-2 sm:grid-cols-2">
          {(["cash", "card"] as const).map((m, i) => (
            <label key={m} className="flex cursor-pointer items-center gap-3 rounded border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-light">
              <input type="radio" name="paymentMethod" value={m} defaultChecked={i === 0} className="accent-brand" />
              <span className="font-medium">{m === "cash" ? t.checkout.paymentCash : t.checkout.paymentCard}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">{t.checkout.paymentNote}</p>
        <div>
          <label className="label" htmlFor="comment">{t.checkout.comment}</label>
          <textarea id="comment" name="comment" rows={3} maxLength={1000} placeholder={t.checkout.commentPlaceholder} className="field" />
        </div>
      </fieldset>

      {errorText && (
        <div className="rounded border border-sale bg-sale/5 p-3 text-sm font-medium text-sale" role="alert" data-testid="checkout-error">
          {errorText}
        </div>
      )}
      <div className="space-y-2">
        <button type="submit" disabled={pending} className="btn-primary w-full py-4 text-base" data-testid="place-order">
          {pending ? t.common.loading : t.checkout.placeOrder}
        </button>
        <p className="text-center text-xs text-muted">{t.checkout.agree}</p>
      </div>
    </form>
  );
}
