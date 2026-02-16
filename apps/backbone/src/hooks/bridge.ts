import { eventBus } from "../events/index.js";
import { triggerHook } from "./registry.js";

export function wireEventBusToHooks(): void {
  eventBus.on("heartbeat:status", (payload) => {
    triggerHook({
      ts: payload.ts,
      hookEvent: "heartbeat:after",
      agentId: payload.agentId,
      status: payload.status,
      preview: payload.preview,
      durationMs: payload.durationMs,
      reason: payload.reason,
    }).catch((err) => {
      console.error("[hooks] heartbeat:after bridge error:", err);
    });
  });

  eventBus.on("registry:agents", (payload) => {
    triggerHook({
      ts: payload.ts,
      hookEvent: "registry:changed",
      kind: payload.kind,
      reason: payload.reason,
      changedPath: payload.changedPath,
    }).catch((err) => {
      console.error("[hooks] registry:changed bridge error:", err);
    });
  });

  eventBus.on("registry:channels", (payload) => {
    triggerHook({
      ts: payload.ts,
      hookEvent: "registry:changed",
      kind: payload.kind,
      reason: payload.reason,
      changedPath: payload.changedPath,
    }).catch((err) => {
      console.error("[hooks] registry:changed bridge error:", err);
    });
  });

  console.log("[hooks] event bus bridge wired");
}
