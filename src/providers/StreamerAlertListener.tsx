import { useEffect } from "react";
import { addToast } from "bioloom-ui";

import { getCookie, hasCookie } from "@/helpers/cookie";
import { BASE_URL } from "@/requests/config";

const DEFAULT_ALERT_SOUND_URL = "/sounds/streamer-alert-default.wav";
const RECONNECT_DELAY_MS = 5000;

type StreamerAlertEvent = {
  type: "STREAMER_LIVE";
  gameName: string;
  gameSlug: string;
  streamerTwitchLogin: string;
  twitchUrl: string;
  soundUrl: string | null;
};

function isStreamerAlertEvent(payload: unknown): payload is StreamerAlertEvent {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { type?: unknown }).type === "STREAMER_LIVE"
  );
}

// Mounted once near the app root. Opens a long-lived connection so devs get
// a sound + toast the moment a streamer notifies them, without polling.
export default function StreamerAlertListener() {
  useEffect(() => {
    if (typeof window === "undefined" || !hasCookie("token")) return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function connect() {
      const token = getCookie("token");
      if (!token || stopped) return;

      source = new EventSource(
        `${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`,
      );

      source.onmessage = (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        if (!isStreamerAlertEvent(payload)) return;

        addToast({
          title: `${payload.streamerTwitchLogin} is live playing ${payload.gameName}!`,
        });

        try {
          const audio = new Audio(payload.soundUrl ?? DEFAULT_ALERT_SOUND_URL);
          void audio.play().catch(() => {
            // Autoplay can be blocked before the visitor interacts with the page.
          });
        } catch {
          // Ignore playback failures (unsupported format, etc).
        }
      };

      source.onerror = () => {
        source?.close();
        if (!stopped) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, []);

  return null;
}
