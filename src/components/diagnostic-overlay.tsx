import { Component, useEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  clearDiagError,
  diag,
  diagError,
  getDiagLog,
  getLastDiagError,
  getPreviousDiagLog,
  hydrateDiagnostics,
  previousRunCrashed,
  subscribeDiagnostics,
} from "../lib/diagnostics";
import type { DiagEntry } from "../lib/diagnostics";
import { colors, fonts } from "../theme/theme";

function clock(t: number): string {
  if (!t) return "--:--:--";
  const date = new Date(t);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function logText(entries: DiagEntry[]): string {
  return entries
    .map(
      (entry) =>
        `${clock(entry.t)}  ${entry.tag}${entry.extra ? `  ${entry.extra}` : ""}`,
    )
    .join("\n");
}

function DiagnosticScreen({
  title,
  subtitle,
  message,
  stack,
  entries,
  onDismiss,
  dismissLabel,
}: {
  title: string;
  subtitle: string;
  message: string;
  stack: string | null;
  entries: DiagEntry[];
  onDismiss: () => void;
  dismissLabel: string;
}) {
  const insets = useSafeAreaInsets();
  const tail = entries.slice(-24);
  const report = [
    title,
    subtitle,
    "",
    message,
    stack ? `\n${stack}` : "",
    "",
    "Recent activity:",
    logText(tail),
  ]
    .filter(Boolean)
    .join("\n");

  const share = () => {
    void Share.share({ message: report }).catch(() => undefined);
  };

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.message} selectable>
          {message}
        </Text>
        {stack ? (
          <Text style={styles.stack} selectable>
            {stack}
          </Text>
        ) : null}
        {tail.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Recent activity</Text>
            <Text style={styles.log} selectable>
              {logText(tail)}
            </Text>
          </>
        ) : null}
      </ScrollView>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={share}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryText}>Share details</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>{dismissLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function DiagnosticOverlay() {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void hydrateDiagnostics();
    return subscribeDiagnostics(() => force((value) => value + 1));
  }, []);

  const error = getLastDiagError();
  const crashed = error ? null : previousRunCrashed();
  const shownKey = error ? `error:${error.t}` : crashed ? `crash:${crashed.t}` : null;

  useEffect(() => {
    setDismissed(false);
  }, [shownKey]);

  if (dismissed || !shownKey) return null;

  if (error) {
    return (
      <DiagnosticScreen
        title="ATLAS hit an error"
        subtitle={`${error.source} · ${clock(error.t)}`}
        message={error.message}
        stack={error.stack}
        entries={error.log.length > 0 ? error.log : getDiagLog()}
        dismissLabel="Continue"
        onDismiss={() => {
          clearDiagError();
          setDismissed(true);
        }}
      />
    );
  }

  if (crashed) {
    return (
      <DiagnosticScreen
        title="Previous session ended unexpectedly"
        subtitle={`Last step: ${crashed.tag} · ${clock(crashed.t)}`}
        message={
          "The app stopped during the previous run before it could record an error. " +
          "The activity trail below shows where it was. Share it with support to fix the cause."
        }
        stack={null}
        entries={getPreviousDiagLog()}
        dismissLabel="Dismiss"
        onDismiss={() => setDismissed(true)}
      />
    );
  }

  return null;
}

interface BoundaryState {
  error: Error | null;
}

export class DiagnosticBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    diag("react:component-stack", { stack: info.componentStack });
    diagError(error, "react");
  }

  render() {
    if (this.state.error) {
      return (
        <DiagnosticScreen
          title="ATLAS hit an error"
          subtitle="The screen could not render"
          message={this.state.error.message || this.state.error.name}
          stack={this.state.error.stack ?? null}
          entries={getDiagLog()}
          dismissLabel="Try again"
          onDismiss={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 40,
    backgroundColor: "#05050a",
    paddingHorizontal: 22,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.white,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.lilac70,
  },
  scroll: {
    marginTop: 18,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.w80,
  },
  stack: {
    marginTop: 14,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 17,
    color: colors.w50,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 6,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.w40,
  },
  log: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.w60,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w15,
    backgroundColor: colors.w05,
  },
  secondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.w80,
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.lilac,
  },
  primaryText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primaryText,
  },
  pressed: {
    opacity: 0.75,
  },
});
