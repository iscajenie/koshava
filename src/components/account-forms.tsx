"use client";

import { useActionState, useTransition } from "react";
import { deleteAddress, makeDefaultAddress, updateProfile, type ProfileState } from "@/actions/account";
import { useShop } from "./shop-provider";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const { t } = useShop();
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <span className="label">{t.auth.email}</span>
        <div className="py-1 text-[15px] text-muted">{email}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">{t.checkout.name}</label>
          <input id="name" name="name" defaultValue={name} autoComplete="name" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="phone">{t.checkout.phone}</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={phone}
            placeholder={t.checkout.phonePlaceholder}
            className="field"
            aria-invalid={state.error ? true : undefined}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {t.account.save}
        </button>
        {state.saved && !pending && <span className="text-sm font-medium text-success">{t.account.saved}</span>}
        {state.error && <span className="text-sm font-medium text-sale">{t.checkout.errors.invalidPhone}</span>}
      </div>
    </form>
  );
}

export function AddressActions({ id, isDefault }: { id: number; isDefault: boolean }) {
  const { t } = useShop();
  const [pending, start] = useTransition();
  return (
    <div className={`flex shrink-0 gap-3 text-sm ${pending ? "opacity-50" : ""}`}>
      {!isDefault && (
        <button type="button" onClick={() => start(() => makeDefaultAddress(id))} className="font-medium text-brand hover:underline">
          {t.account.makeDefault}
        </button>
      )}
      <button type="button" onClick={() => start(() => deleteAddress(id))} className="text-muted hover:text-sale">
        {t.account.delete}
      </button>
    </div>
  );
}
