import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "expo-router";
import { NavigationDrawer } from "./navigation-drawer";
import {
  closeDrawer,
  isDrawerOpen,
  subscribeDrawer,
} from "../lib/drawer-store";

/** Pathname -> drawer row label for the section screens. */
const SECTION_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/roadmap": "Roadmap",
  "/courses": "Courses",
  "/notes": "Notes",
  "/quiz": "Quiz",
  "/timer": "Timer",
  "/friends": "Friends",
  "/leaderboard": "Leaderboard",
  "/assistant": "Assistant",
  "/settings": "Settings",
};

/**
 * Single drawer instance rendered above the tab navigator. Keeping it out of
 * the individual screens means tapping a row starts the section crossfade
 * underneath the closing panel - the user never sees the outgoing tab first.
 */
export function GlobalDrawer() {
  const open = useSyncExternalStore(
    subscribeDrawer,
    isDrawerOpen,
    () => false,
  );
  const pathname = usePathname();
  // Snapshot the highlight while opening; the route changes during the close
  // animation and the active row must not jump on the way out.
  const [activeLabel, setActiveLabel] = useState("");
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (open) setActiveLabel(SECTION_LABELS[pathname] ?? "");
  }, [open, pathname]);

  // A route change (drawer row, deep link, session redirect) hides the panel.
  useEffect(() => {
    if (openRef.current) closeDrawer();
  }, [pathname]);

  return (
    <NavigationDrawer
      open={open}
      onClose={closeDrawer}
      activeLabel={activeLabel}
    />
  );
}
