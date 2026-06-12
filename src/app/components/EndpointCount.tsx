"use client";

import { useEffect, useState } from "react";

export default function EndpointCount() {
  const [main, setMain] = useState<{ paid: number; free: number } | null>(null);
  const [solana, setSolana] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://gateway.spraay.app/")
      .then((r) => r.json())
      .then((d) =>
        setMain({
          paid: Object.keys(d?.endpoints?.paid ?? {}).length,
          free: Object.keys(d?.endpoints?.free ?? {}).length,
        })
      )
      .catch(() => {});
    fetch("https://gateway-solana.spraay.app/")
      .then((r) => r.json())
      .then((d) => {
        const eps = d?.endpoints ?? {};
        // nested shape (paid/free) or flat map of endpoint names
        const n =
          Object.keys(eps.paid ?? {}).length + Object.keys(eps.free ?? {}).length ||
          Object.keys(eps).length;
        if (n > 0) setSolana(n);
      })
      .catch(() => {});
  }, []);

  if (!main) return null;
  const total = main.paid + main.free + (solana ?? 0);

  return (
    <p className="text-xs font-mono tracking-wider text-[var(--text-muted)]">
      <span className="text-[var(--text-primary)]">{total}</span> endpoints live
      {" · "}
      <span className="text-[var(--spraay-blue)]">{main.paid}</span> paid
      {" · "}
      {solana != null ? (
        <>2 gateways <span className="text-[var(--noc-dim)]">
          (main {main.paid + main.free} · solana {solana})
        </span></>
      ) : (
        "1 gateway"
      )}
    </p>
  );
}