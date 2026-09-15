import { useEffect, useState } from "react";
import { addToast, Button, Card, Icon, Text, Vstack } from "bioloom-ui";

import { UserType } from "@/types/UserType";
import { readItem } from "@/requests/helpers";
import {
  getStreamerAlertStatus,
  notifyDevsOfStream,
} from "@/requests/streamerAlerts";

type StreamerAlertStatus = {
  eligible: boolean;
  alreadyNotified: boolean;
  alert: {
    startedAt: string;
    vodUrl: string | null;
    vodTimestampSeconds: number | null;
  } | null;
};

export default function StreamerNotifyButton({
  gameId,
  user,
}: {
  gameId: number;
  user: UserType | null;
}) {
  const [status, setStatus] = useState<StreamerAlertStatus | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user?.twitchUserId) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    getStreamerAlertStatus(gameId).then(async (response) => {
      if (!response.ok || cancelled) return;
      const data = await readItem<StreamerAlertStatus>(response);
      if (!cancelled && data) setStatus(data);
    });

    return () => {
      cancelled = true;
    };
  }, [gameId, user?.twitchUserId]);

  if (!user || !user.twitchUserId) return null;

  async function handleClick() {
    setSending(true);
    try {
      const response = await notifyDevsOfStream(gameId);
      if (response.ok) {
        addToast({ title: "Devs notified that you're live!" });
        const data = await readItem<StreamerAlertStatus["alert"]>(response);
        setStatus({ eligible: true, alreadyNotified: true, alert: data });
      } else {
        const body = await response.json().catch(() => ({}));
        addToast({
          title: body?.message ?? "Could not notify the devs right now",
        });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="order-5">
      <Vstack align="start" className="gap-2">
        <Text color="text" size="sm">
          Live on Twitch?
        </Text>
        {status?.alreadyNotified ? (
          <Vstack align="start" gap={0}>
            <Text color="textFaded" size="xs">
              You already let the devs know you&apos;re streaming this game.
            </Text>
            {status.alert?.vodUrl && (
              <a
                href={status.alert.vodUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline"
              >
                Watch the VOD from when you went live
              </a>
            )}
          </Vstack>
        ) : (
          <>
            <Text color="textFaded" size="xs">
              Let the devs know you&apos;re live playing this game. You can only
              do this once per game.
            </Text>
            <Button
              size="sm"
              icon="sitwitch"
              onClick={handleClick}
              disabled={sending}
            >
              {sending ? "Notifying..." : "I'm streaming this!"}
            </Button>
          </>
        )}
      </Vstack>
    </Card>
  );
}
