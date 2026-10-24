"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type AuthState } from "@/actions/auth";
import { useShop } from "./shop-provider";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const { locale, t } = useShop();
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : register, {});
  const a = t.auth;
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="card mx-auto max-w-md p-6 md:p-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{mode === "login" ? a.loginTitle : a.registerTitle}</h1>
      {next?.includes("/checkout") && <p className="mb-2 text-sm text-muted">{a.loginToContinue}</p>}
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="name">{a.name}</label>
            <input id="name" name="name" autoComplete="name" className="field" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">{a.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.email}
            className="field"
            aria-invalid={state.error === "invalidEmail" || state.error === "emailTaken" ? true : undefined}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">{a.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="field"
            aria-invalid={state.error === "weakPassword" ? true : undefined}
          />
          {mode === "register" && <p className="mt-1 text-xs text-muted">{a.passwordHint}</p>}
        </div>
        {state.error && (
          <div className="rounded border border-sale bg-sale/5 p-3 text-sm font-medium text-sale" role="alert" data-testid="auth-error">
            {a[state.error]}
          </div>
        )}
        {mode === "register" && (
          <p className="text-xs text-muted">
            {a.privacyNotice}{" "}
            <Link href={`/${locale}/privacy`} target="_blank" className="font-medium text-brand underline">
              {a.privacyLink}
            </Link>
            .
          </p>
        )}
        <button type="submit" disabled={pending} className="btn-primary w-full" data-testid="auth-submit">
          {pending ? t.common.loading : mode === "login" ? a.submitLogin : a.submitRegister}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {mode === "login" ? a.noAccount : a.haveAccount}{" "}
        <Link href={`/${locale}/${mode === "login" ? "register" : "login"}${nextQuery}`} className="font-semibold text-brand hover:underline">
          {mode === "login" ? a.toRegister : a.toLogin}
        </Link>
      </p>
    </div>
  );
}
