import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { getAiBaseUrl } from "../lib/api-config";

export type AiStatus = "unknown" | "online" | "offline";

export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>("unknown");
  const checking = useRef(false);
  const lastCheck = useRef(0);
  const currentBaseUrl = useRef(getAiBaseUrl());

  const check = useCallback(async (): Promise<void> => {
    if (checking.current) return;
    const now = Date.now();
    if (now - lastCheck.current < 15_000) return;

    const base = getAiBaseUrl();
    currentBaseUrl.current = base;
    if (!base) {
      setStatus("offline");
      return;
    }

    checking.current = true;
    lastCheck.current = now;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4_000);

      const response = await fetch(`${base}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timer);
      setStatus(response.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") check();
    });
    return () => subscription.remove();
  }, [check]);

  return status;
}