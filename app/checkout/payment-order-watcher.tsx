"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type StatusPayload = { order?: { id:string } | null };

export function PaymentOrderWatcher({ paymentId }: Readonly<{ paymentId:string }>) {
  const router = useRouter();

  useEffect(() => {
    let active=true;
    let timer:ReturnType<typeof setTimeout> | undefined;
    let attempts=0;

    async function check() {
      try {
        const response=await fetch(`/api/orders/status?paymentId=${encodeURIComponent(paymentId)}`, { cache:"no-store" });
        const payload=await response.json() as StatusPayload;
        if (active && response.ok && payload.order?.id) {
          router.replace(`/pedido/confirmado?pedido=${encodeURIComponent(payload.order.id)}`);
          return;
        }
      } catch {
        // A falha transitória será tentada novamente sem alterar o pagamento.
      }
      attempts += 1;
      if (active && attempts < 100) timer=setTimeout(check, 3000);
    }

    void check();
    return () => { active=false; if (timer) clearTimeout(timer); };
  }, [paymentId, router]);

  return <p className="payment-waiting" role="status"><span aria-hidden="true" /> Aguardando a confirmação segura do pagamento…</p>;
}
