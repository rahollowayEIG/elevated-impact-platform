// Client-side presentation helper only. Not a security boundary.
// Any new Build Lab endpoint must enforce the exact owner/session/role on
// the server, even if this method returned allowed=true earlier.
export function ownerPreviewVisible({ previewEnabled, eigWorkspace, activeEIGAdmin, userId, serverGrant }) {
  return previewEnabled === true && eigWorkspace === true && activeEIGAdmin === true &&
    typeof userId === "string" && userId.length > 0 &&
    serverGrant?.userId === userId && serverGrant?.allowed === true;
}

export async function requestOwnerBuildLabAccess(client) {
  if (!client?.functions?.invoke) return false;
  try {
    const { data, error } = await client.functions.invoke("eig-build-lab-access", {
      body: { action: "check" },
    });
    return !error && data?.allowed === true && data?.access === "build_lab_owner_only";
  } catch {
    return false;
  }
}
