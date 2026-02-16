import { useState, useEffect } from "react";

interface PWAStatus {
  needsUpdate: boolean;
  offlineReady: boolean;
  update: () => void;
}

export function usePWA(): PWAStatus {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({
        onNeedRefresh() {
          setNeedsUpdate(true);
        },
        onOfflineReady() {
          setOfflineReady(true);
        },
        onRegisteredSW(_url, r) {
          if (r) setRegistration(r);
        },
      });
    }).catch(() => {
      // PWA not available in dev
    });
  }, []);

  const update = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
  };

  return { needsUpdate, offlineReady, update };
}
