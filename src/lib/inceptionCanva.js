import { supabase } from "./supabase";

// Deliberately disabled unless EIG explicitly enables its Canva OAuth pilot.
// This browser flag grants no authority; the Edge function independently verifies
// the current signed-in platform account and EIG admin membership.
export const canvaPilotEnabled =
  import.meta.env.VITE_INCEPTION_CANVA_CONNECT_ENABLED === "true";

async function callCanvaOAuth(action) {
  if (!supabase)
    throw new Error("The InceptionApex connection is unavailable.");
  const { data: { session } = {}, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError || !session?.access_token)
    throw new Error("Sign in to your ElevationPilot account first.");

  const { data, error } = await supabase.functions.invoke("inception-canva-oauth", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.access_token },
    body: { action },
  });
  if (error) {
    let message;
    try {
      const context = await error.context?.json();
      if (typeof context?.error === "string") message = context.error;
    } catch {
      // Network errors and gateway responses aren't guaranteed to contain JSON.
    }
    throw new Error(message || "Canva is not connected yet. Try again later.");
  }
  return data;
}
export async function getCanvaConnectionStatus() {
  const status = await callCanvaOAuth("status");
  if (typeof status?.connected !== "boolean")
    throw new Error("Canva returned an unexpected connection status.");
  return { connected: status.connected };
}
export async function beginCanvaConnection() {
  const response = await callCanvaOAuth("connect");
  if (typeof response?.authorization_url !== "string")
    throw new Error("Canva authorization is not ready yet.");
  let url;
  try {
    url = new URL(response.authorization_url);
  } catch {
    throw new Error("Canva returned an invalid authorization address.");
  }
  if (url.origin !== "https://www.canva.com" ||
      url.pathname !== "/api/oauth/authorize" ||
      url.searchParams.get("response_type") !== "code")
    throw new Error("Canva authorization could not be verified.");
  return url.href;
}
