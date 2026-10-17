import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { AtlasWidgetData } from "./atlas-widget-data";

const LILAC = "#cf9eff";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.55)";
const FAINT = "rgba(255, 255, 255, 0.34)";

function formatXp(xp: number): string {
  return String(Math.max(0, Math.floor(xp))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
}

/** ATLAS home-screen card: streak, level and rank at a glance. */
export function AtlasWidget({ data }: { data: AtlasWidgetData }) {
  const streakCaption = data.streak > 0 ? "day streak" : "start today";
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        justifyContent: "center",
        padding: 18,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(207, 158, 255, 0.18)",
        backgroundGradient: {
          from: "#161230",
          to: "#08070f",
          orientation: "TL_BR",
        },
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TextWidget
          text="ATLAS"
          style={{
            fontSize: 13,
            fontFamily: "CreateFuture",
            color: LILAC,
          }}
        />
        <TextWidget
          text={`LV ${data.level}`}
          style={{ fontSize: 10, fontWeight: "600", color: FAINT }}
          maxLines={1}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          marginTop: 10,
          flexGap: 8,
        }}
      >
        <TextWidget text="🔥" style={{ fontSize: 26, color: WHITE }} />
        <TextWidget
          text={`${data.streak}`}
          style={{ fontSize: 38, fontWeight: "bold", color: WHITE }}
          maxLines={1}
        />
        <TextWidget
          text={streakCaption}
          style={{ fontSize: 13, color: MUTED }}
          maxLines={1}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <TextWidget
          text={data.rankName}
          style={{ fontSize: 13, fontWeight: "600", color: LILAC }}
          maxLines={1}
        />
        <TextWidget
          text={`${formatXp(data.xp)} XP`}
          style={{ fontSize: 11, color: MUTED }}
          maxLines={1}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
