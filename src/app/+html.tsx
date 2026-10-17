import type { PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

/**
 * Web-only document shell (Expo Router). Adds the SEO/social metadata that
 * the exported web build renders, plus the dark app background so the
 * pre-hydration paint never flashes white.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#04040a" />
        <meta name="color-scheme" content="dark" />

        <title>ATLAS — Turn studying into a game you want to win</title>
        <meta
          name="description"
          content="ATLAS is a gamified study companion: focus sessions, courses, roadmaps, quizzes, a weekly leaderboard and an AI tutor that keeps your streak alive."
        />
        <meta name="application-name" content="ATLAS" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ATLAS" />
        <meta
          property="og:title"
          content="ATLAS — Gamified study companion"
        />
        <meta
          property="og:description"
          content="Focus sessions, courses, roadmaps, quizzes and an AI tutor in one app. Climb the leaderboard and keep your streak alive."
        />

        <meta name="twitter:card" content="summary" />
        <meta
          name="twitter:title"
          content="ATLAS — Gamified study companion"
        />
        <meta
          name="twitter:description"
          content="Focus sessions, courses, roadmaps, quizzes and an AI tutor in one app."
        />

        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body { background-color: #04040a; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
