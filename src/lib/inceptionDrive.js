import { supabase } from "./supabase";

export async function saveResizeToDrive({ blob, filename, requestId }) {
  if (!supabase)
    throw new Error(
      "Google Drive is unavailable here. Download your file instead.",
    );
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session)
    throw new Error(
      "Sign in with an active EIG team account to save to Google Drive.",
    );
  const body = new FormData();
  body.append("file", blob, filename);
  body.append("request_id", requestId);
  const { data, error: invokeError } = await supabase.functions.invoke(
    "inception-drive-export",
    {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );
  if (invokeError) {
    let message;
    try {
      message = (await invokeError.context?.json())?.error;
    } catch {
      /* Gateway/network response may not be JSON. */
    }
    throw new Error(
      message ||
        "Google Drive could not save this file. Your download is still available.",
    );
  }
  if (!data?.file_id || !/^https:\/\/drive\.google\.com\//.test(data.url || ""))
    throw new Error(
      "Drive has not confirmed this export. Keep your download and try again.",
    );
  return data;
}
