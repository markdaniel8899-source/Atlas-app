import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { listen } from "../lib/events";

/**
 * Runs `handler` for `event` only while this screen is focused. Events that
 * arrive while the screen is hidden are coalesced into one refresh on the next
 * focus, so a burst (roadmap generation, quiz save) no longer makes every
 * mounted tab refetch its data in the background.
 */
export function useFocusedEvent(event: string, handler: () => void): void {
  const handlerRef = useRef(handler);
  const focusedRef = useRef(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (dirtyRef.current) {
        dirtyRef.current = false;
        handlerRef.current();
      }
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );

  useEffect(
    () =>
      listen(event, () => {
        if (focusedRef.current) handlerRef.current();
        else dirtyRef.current = true;
      }),
    [event],
  );
}
