"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";

export function AuthRecoveryBridge() {
  const router = useRouter();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const recoveryCode = query.get("code");

    if (recoveryCode) {
      window.location.replace(
        `/auth/callback?code=${encodeURIComponent(recoveryCode)}&next=%2Fredefinir-senha`,
      );
      return;
    }

    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.get("type") !== "recovery") return;

    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname);

    if (!accessToken || !refreshToken) {
      router.replace("/recuperar-senha?error=invalid-link");
      return;
    }

    void createBrowserSupabaseClient().auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        router.replace(error ? "/recuperar-senha?error=invalid-link" : "/redefinir-senha");
      });
  }, [router]);

  return null;
}
