// Client-side presentation helper only. Not a security boundary.
// Any new Build Lab endpoint must enforce the exact owner/session/role on
// the server, even if this method returned allowed=true earlier.
export function ownerPreviewVisible({ previewEnabled, eigWorkspace, activeEIGAdmin, userId, serverGrant }) {
  return previewEnabled === true && eigWorkspace === true && activeEIGAdmin === true &&
    typeof userId === "string" && userId.length > 0 &&
    serverGrant?.userId === userId && serverGrant?.allowed === true;
}

export async function requestOwnerBuildLabAccess(client, http = fetch) {
  if (!client?.auth?.getSession || typeof http !== "function") return false;
  try {
    const { data, error } = await client.auth.getSession();
    const token = data?.session?.access_token;
    if (error || !token || typeof token !== "string") return false;
    // This route exists only on the draft Vercel branch deployment. It
    // validates Auth credentials and owner membership server-side on every
    // call. Never send a JWT in the URL or local export.
    const result = await http("/api/eig-build-lab-access", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!result.ok) return false;
    const grant = await result.json();
    return grant?.allowed === true && grant?.access === "build_lab_owner_only";
  } catch {
    return false;
  }
}
