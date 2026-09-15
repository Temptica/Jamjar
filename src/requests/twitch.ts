import { getCookie } from "@/helpers/cookie";
import { BASE_URL } from "./config";

function authHeaders() {
  return { authorization: `Bearer ${getCookie("token")}` };
}

export async function getTwitchAuthorizeUrl() {
  return fetch(`${BASE_URL}/twitch/authorize`, {
    headers: authHeaders(),
    credentials: "include",
  });
}

export async function unlinkTwitch() {
  return fetch(`${BASE_URL}/twitch/unlink`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
}
