import { useEffect, useRef, useState } from "react";
import { addToast, Button, Card, Hstack, Icon, Input, Switch, Text, Vstack } from "bioloom-ui";

import { getCookie } from "@/helpers/cookie";
import { BASE_URL } from "@/requests/config";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/requests/notification";
import { getTwitchAuthorizeUrl, unlinkTwitch } from "@/requests/twitch";
import { readItem } from "@/requests/helpers";
import { UserType } from "@/types/UserType";
import { useRouter } from "@/compat/next-navigation";

const MAX_ALERT_SOUND_SECONDS = 5;

type NotificationPreferences = {
  mutedTypes: string[];
  emailEnabled: boolean;
  streamerAlertEmailOptOut: boolean;
  streamerAlertSoundOptOut: boolean;
  streamerAlertSoundUrl: string | null;
  streamerAlertSoundDurationMs: number | null;
};

function readAudioDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error("Could not read audio file"));
    };
    audio.src = URL.createObjectURL(file);
  });
}

export default function StreamerAlertSettings({
  user,
  onUserChange,
}: {
  user: UserType;
  onUserChange: (user: UserType) => void;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [connectingTwitch, setConnectingTwitch] = useState(false);
  const [uploadingSound, setUploadingSound] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const twitchStatus = params.get("twitch");
    if (twitchStatus === "linked") {
      addToast({ title: "Twitch account connected" });
      router.replace("/settings");
    } else if (twitchStatus === "error") {
      addToast({ title: "Could not connect your Twitch account" });
      router.replace("/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPreferences();
    async function loadPreferences() {
      const response = await getNotificationPreferences();
      if (response.ok) {
        const data = await readItem<NotificationPreferences>(response);
        if (data) setPreferences(data);
      }
    }
  }, []);

  async function connectTwitch() {
    setConnectingTwitch(true);
    try {
      const response = await getTwitchAuthorizeUrl();
      if (!response.ok) {
        addToast({ title: "Could not start Twitch connection" });
        return;
      }
      const data = await readItem<{ url: string }>(response);
      if (data?.url) {
        window.location.href = data.url;
      }
    } finally {
      setConnectingTwitch(false);
    }
  }

  async function disconnectTwitch() {
    const response = await unlinkTwitch();
    if (response.ok) {
      const updated = await readItem<Partial<UserType>>(response);
      onUserChange({ ...user, twitch: "", twitchUserId: null, ...updated });
      addToast({ title: "Disconnected Twitch account" });
    } else {
      addToast({ title: "Could not disconnect Twitch account" });
    }
  }

  async function savePreferences(next: NotificationPreferences) {
    setSaving(true);
    try {
      const response = await updateNotificationPreferences(next);
      if (response.ok) {
        const data = await readItem<NotificationPreferences>(response);
        if (data) setPreferences(data);
      } else {
        addToast({ title: "Could not save notification settings" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSoundFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !preferences) return;

    let durationSeconds: number;
    try {
      durationSeconds = await readAudioDurationSeconds(file);
    } catch {
      addToast({ title: "Could not read that audio file" });
      return;
    }

    if (durationSeconds > MAX_ALERT_SOUND_SECONDS + 0.25) {
      addToast({ title: `Alert sounds must be ${MAX_ALERT_SOUND_SECONDS} seconds or shorter` });
      return;
    }

    setUploadingSound(true);
    try {
      const formData = new FormData();
      formData.append("upload", file);
      const response = await fetch(`${BASE_URL}/music`, {
        method: "POST",
        body: formData,
        headers: { authorization: `Bearer ${getCookie("token")}` },
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        addToast({ title: "Could not upload that sound" });
        return;
      }

      const uploadedUrl = data?.data as string | undefined;
      if (!uploadedUrl) {
        addToast({ title: "Could not upload that sound" });
        return;
      }

      await savePreferences({
        ...preferences,
        streamerAlertSoundUrl: uploadedUrl,
        streamerAlertSoundDurationMs: Math.round(durationSeconds * 1000),
      });
      addToast({ title: "Custom alert sound saved" });
    } finally {
      setUploadingSound(false);
    }
  }

  if (!preferences) return null;

  return (
    <Card>
      <Vstack align="start" className="gap-4">
        <div>
          <Text color="text">Streamer live alerts</Text>
          <Text color="textFaded" size="xs">
            Get notified when a streamer with a connected Twitch account tells you
            they&apos;re live playing your game.
          </Text>
        </div>

        <Vstack align="start" gap={0} className="w-full">
          <Text color="text" size="sm">
            Twitch account
          </Text>
          {user.twitchUserId ? (
            <Hstack className="gap-2">
              <Icon name="sitwitch" color="text" />
              <Text color="textFaded" size="xs">
                Connected as {user.twitch}
              </Text>
              <Button size="sm" onClick={disconnectTwitch}>
                Disconnect
              </Button>
            </Hstack>
          ) : (
            <Hstack className="gap-2">
              <Text color="textFaded" size="xs">
                Connect your Twitch account to notify devs when you&apos;re live.
              </Text>
              <Button size="sm" onClick={connectTwitch} disabled={connectingTwitch}>
                {connectingTwitch ? "Connecting..." : "Connect Twitch"}
              </Button>
            </Hstack>
          )}
        </Vstack>

        <Hstack align="start" className="w-full gap-3">
          <Switch
            checked={!preferences.streamerAlertEmailOptOut}
            onChange={(checked) =>
              savePreferences({ ...preferences, streamerAlertEmailOptOut: !checked })
            }
            disabled={saving}
            className="shrink-0 mt-1"
          />
          <Vstack align="start" gap={0} className="min-w-0 flex-1">
            <Text color="text">Email me when a streamer goes live</Text>
            <Text color="textFaded" size="xs">
              Sent to devs of a game when a connected streamer notifies you.
            </Text>
          </Vstack>
        </Hstack>

        <Hstack align="start" className="w-full gap-3">
          <Switch
            checked={!preferences.streamerAlertSoundOptOut}
            onChange={(checked) =>
              savePreferences({ ...preferences, streamerAlertSoundOptOut: !checked })
            }
            disabled={saving}
            className="shrink-0 mt-1"
          />
          <Vstack align="start" gap={0} className="min-w-0 flex-1">
            <Text color="text">Play a sound while I&apos;m on the site</Text>
            <Text color="textFaded" size="xs">
              Plays in your browser tab when a streamer notifies you, live.
            </Text>
          </Vstack>
        </Hstack>

        <Vstack align="start" gap={1} className="w-full">
          <Text color="text" size="sm">
            Alert sound
          </Text>
          <Hstack className="gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingSound}
            >
              {uploadingSound ? "Uploading..." : "Upload custom sound"}
            </Button>
            {preferences.streamerAlertSoundUrl && (
              <>
                <Button
                  size="sm"
                  onClick={() => new Audio(preferences.streamerAlertSoundUrl!).play()}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    savePreferences({
                      ...preferences,
                      streamerAlertSoundUrl: null,
                      streamerAlertSoundDurationMs: null,
                    })
                  }
                >
                  Reset to default
                </Button>
              </>
            )}
          </Hstack>
          <Text color="textFaded" size="xs">
            Max {MAX_ALERT_SOUND_SECONDS} seconds. MP3, WAV, or OGG.
          </Text>
          <Input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg"
            onChange={handleSoundFileChange}
            className="hidden"
          />
        </Vstack>
      </Vstack>
    </Card>
  );
}
