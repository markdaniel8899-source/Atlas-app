import * as Sentry from "@sentry/react-native";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    enableTracing: true,
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    debug: !__DEV__,
    environment: __DEV__ ? "development" : "production",
    beforeSend(event) {
      if (__DEV__) return null;
      return event;
    },
  });
}

export { Sentry };