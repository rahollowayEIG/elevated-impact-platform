// Event inquiry lifecycle: shared, reviewable rules for account ownership,
// public status views and notifications. No database or network calls here.
// IMPORTANT: callers must verify JWT/roles on the SERVER. This is not an
// authorization mechanism by itself.
export const INQUIRY_STATES = Object.freeze({
  submitted: { label: "Submitted", detail: "Your request has reached the Hangar." },
  new: { label: "Received", detail: "Your request has been received." },
  needs_response: { label: "Action Needed", detail: "The Hangar has a question or needs information." },
  awaiting_coordinator: { label: "Under Review", detail: "The Hangar is coordinating your request." },
  tentative: { label: "Tentative", detail: "The Hangar has proposed tentative arrangements." },
  hold: { label: "Date on Hold", detail: "A temporary hold has been placed. Check the deadline." },
  confirmed: { label: "Confirmed", detail: "Your event request has been confirmed." },
  hold_expired: { label: "Hold Expired", detail: "The temporary date hold has expired." },
  declined: { label: "Declined", detail: "The Hangar cannot accommodate this request." },
  cancelled: { label: "Cancelled", detail: "This event request has been cancelled." },
});
const allowedStatusKeys = new Set(Object.keys(INQUIRY_STATES));
const CONTACT_EMAIL = /^\S+@\S+\.\S+$/;
const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MUTABLE_PUBLIC_FIELDS = Object.freeze([
  "status", "confirmed_date", "confirmed_start_type", "confirmed_start_time",
  "confirmed_capacity", "confirmed_package", "venue_response",
  "hold_expires_at", "contract_status", "deposit_status", "deposit_due_at",
]);
export function normalizedInquiryEmail(value) {
  return String(value || "").trim().toLowerCase();
}
export function isVerifiedInquiryAccount(user, contactEmail) {
  return Boolean(user?.id && VALID_UUID.test(user.id) &&
    user.email_confirmed_at &&
    normalizedInquiryEmail(user.email) === normalizedInquiryEmail(contactEmail) &&
    CONTACT_EMAIL.test(normalizedInquiryEmail(user.email)));
}
export function validateInquirySubmission(form) {
  if (!form || typeof form !== "object" || Array.isArray(form)) return "Complete the event request first.";
  if (!String(form.contact_full_name || "").trim()) return "Enter the contact's full name.";
  if (String(form.contact_full_name).trim().length > 160) return "Contact name is too long.";
  if (!CONTACT_EMAIL.test(normalizedInquiryEmail(form.contact_email))) return "Enter a valid contact email.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form.preferred_date || "")) ||
    !Number.isFinite(Date.parse(form.preferred_date + "T00:00:00Z")))
    return "Select a valid first-choice event date.";
  if (form.estimated_participants != null && form.estimated_participants !== "" &&
    (!Number.isInteger(Number(form.estimated_participants)) ||
      Number(form.estimated_participants) < 1 || Number(form.estimated_participants) > 20000))
    return "Enter a valid estimated participant count.";
  const limits = {
    group_name: 180, contact_phone: 45, unavailable_date_notes: 1500,
    preferred_start_type: 100, event_type: 120, golf_format: 120,
    special_requests: 4000,
  };
  for (const [field, max] of Object.entries(limits))
    if (String(form[field] || "").length > max) return "One or more request fields exceed the allowed length.";
  return null;
}
// An identity verified on the server, not just a client JWT claim, must be used
// when finalizing. The server independently resolves the active Hangar.
export function authorizedInquiryPayload(form, verifiedUser, organizationId) {
  const validationError = validateInquirySubmission(form);
  if (validationError) throw new Error(validationError);
  if (!VALID_UUID.test(String(organizationId || ""))) throw new Error("Choose an active Hangar.");
  if (!isVerifiedInquiryAccount(verifiedUser, form.contact_email))
    throw new Error("Sign in with and verify the email used on this request.");
  return {
    organization_id: organizationId,
    submitted_by_user_id: verifiedUser.id,
    status: "submitted",
    event_type: String(form.event_type || "Charity / Fundraiser").trim(),
    preferred_date: form.preferred_date,
    alternate_date: form.alternate_date || null,
    second_alternate_date: form.second_alternate_date || null,
    estimated_participants: form.estimated_participants ? Number(form.estimated_participants) : null,
    contact_full_name: String(form.contact_full_name).trim(),
    group_name: String(form.group_name || "").trim(),
    contact_phone: String(form.contact_phone || "").trim(),
    contact_email: normalizedInquiryEmail(verifiedUser.email),
    unavailable_date_notes: String(form.unavailable_date_notes || "").trim(),
    preferred_start_type: String(form.preferred_start_type || "Not Sure").trim(),
    preferred_start_time: form.preferred_start_time || null,
    golf_format: String(form.golf_format || "Not Sure").trim(),
    food_needed: form.food_needed === "Yes" ? true : form.food_needed === "No" ? false : null,
    special_requests: String(form.special_requests || "").trim(),
    requested_details: {
      source: "public_inquiry_account",
      first_choice_date: form.preferred_date,
      second_choice_date: form.alternate_date || null,
      third_choice_date: form.second_alternate_date || null,
      food_needed: form.food_needed || "Not Sure",
    },
  };
}
export function inquiryStatusLabel(status) {
  return INQUIRY_STATES[status]?.label || "Under Review";
}
// Whitelist ONLY customer-safe columns. Never expose venue_internal_notes,
// staff audit material, provider identifiers or private payment records.
export function publicInquiryView(row) {
  if (!row || typeof row !== "object") return null;
  const status = allowedStatusKeys.has(row.status) ? row.status : "submitted";
  return {
    id: row.id,
    organization_id: row.organization_id,
    organization_name: row.organization_name || "",
    status,
    status_label: inquiryStatusLabel(status),
    group_name: row.group_name || "",
    event_type: row.event_type || "",
    preferred_date: row.preferred_date || null,
    confirmed_date: row.confirmed_date || null,
    confirmed_start_type: row.confirmed_start_type || null,
    confirmed_start_time: row.confirmed_start_time || null,
    confirmed_capacity: row.confirmed_capacity || null,
    confirmed_package: row.confirmed_package || null,
    venue_response: row.venue_response || null,
    hold_expires_at: row.hold_expires_at || null,
    contract_status: row.contract_status || "not_sent",
    deposit_status: row.deposit_status || "not_required",
    deposit_due_at: row.deposit_due_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}
function normalizedValue(value) {
  return value instanceof Date ? value.toISOString() :
    value === undefined || value === null ? "" : String(value);
}
// Include ONLY changes visible to requester. Internal note edits, staff audit
// updates, and system-only edits must never trigger external notifications.
export function requesterVisibleChanges(before, after) {
  if (!before || !after) return [];
  return MUTABLE_PUBLIC_FIELDS.filter(name => normalizedValue(before[name]) !== normalizedValue(after[name]))
    .map(field => ({field, previous: normalizedValue(before[field]), current: normalizedValue(after[field])}));
}
export function inquiryNotificationDecision(before, after) {
  const changed = requesterVisibleChanges(before, after);
  if (!changed.length) return {notify:false,changes:[],subject:"",body:""};
  const statusChanged = changed.some(x=>x.field==="status");
  const status = allowedStatusKeys.has(after.status) ? after.status : "submitted";
  const subject = statusChanged
    ? "Your event request: " + inquiryStatusLabel(status)
    : "Your event request has an update";
  const body = statusChanged
    ? "The Hangar updated your request to " + inquiryStatusLabel(status) + ". Sign in to ElevationPilot to review the latest details."
    : "Your Hangar updated the details of your event request. Sign in to ElevationPilot to review the change.";
  return {notify:true,changes:changed.map(x=>x.field),subject,body};
}
export function inquiryAccountStep({attemptedSubmit,sessionUser,contactEmail}={}) {
  if(!attemptedSubmit)return "editing";
  if(!sessionUser)return "authenticate";
  return isVerifiedInquiryAccount(sessionUser,contactEmail)?"ready_to_finalize":"identity_mismatch";
}
