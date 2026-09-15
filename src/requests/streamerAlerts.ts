import { getCookie } from "@/helpers/cookie";
import { BASE_URL } from "./config";

function authHeaders(contentType = false) {
  return {
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    authorization: `Bearer ${getCookie("token")}`,
  };
}

export async function getStreamerAlertStatus(gameId: number) {
  return fetch(`${BASE_URL}/streamer-alerts/status?gameId=${gameId}`, {
    headers: authHeaders(),
    credentials: "include",
  });
}

export async function notifyDevsOfStream(gameId: number) {
  return fetch(`${BASE_URL}/streamer-alerts`, {
    method: "POST",
    body: JSON.stringify({ gameId }),
    headers: authHeaders(true),
    credentials: "include",
  });
}
