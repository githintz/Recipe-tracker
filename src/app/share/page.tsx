"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { routeForShared } from "@/lib/share";

function ShareHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    router.replace(
      routeForShared({ text: params.get("text"), url: params.get("url") }),
    );
  }, [router, params]);

  return <Spinner label="Opening what you shared…" />;
}

/** Where the browser's share target lands when the app is installed as a PWA. */
export default function SharePage() {
  return (
    <main>
      <Suspense fallback={<Spinner />}>
        <ShareHandler />
      </Suspense>
    </main>
  );
}
