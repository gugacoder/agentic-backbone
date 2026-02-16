declare module "virtual:pwa-register" {
  export function registerSW(options?: {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, r?: ServiceWorkerRegistration) => void;
  }): (reloadPage?: boolean) => Promise<void>;
}
