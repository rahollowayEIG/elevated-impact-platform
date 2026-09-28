import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function calculateAgeOnDate(dateOfBirth: string | null, eventDate: string | null) {
  if (!dateOfBirth || !eventDate) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  const [eventYear, eventMonth, eventDay] = eventDate.split("-").map(Number);
  if (![birthYear, birthMonth, birthDay, eventYear, eventMonth, eventDay].every(Number.isFinite)) return null;
  let age = eventYear - birthYear;
  if (eventMonth < birthMonth || (eventMonth === birthMonth && eventDay < birthDay)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

async function syncRoster(supabaseUrl: string, serviceRoleKey: string, eventKey: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-google-roster`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_key: eventKey }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Automatic roster sync failed:", response.status, detail);
    }
  } catch (error) {
    console.error("Automatic roster sync failed:", error);
  }
}

async function ensurePassenger(admin: any, user: any, seed: Record<string, any> = {}) {
  const { data: existing, error: findError } = await admin
    .from("passengers")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (findError) throw findError;

  const metadata = user.user_metadata || {};
  const firstName = String(seed.first_name || existing?.first_name || metadata.first_name || "").trim() || null;
  const lastName = String(seed.last_name || existing?.last_name || metadata.last_name || "").trim() || null;
  const dateOfBirth = String(seed.date_of_birth || existing?.date_of_birth || "").trim() || null;
  const gender = String(seed.gender || existing?.gender || "").trim() || null;
  const ghinNumber = String(seed.ghin_number || existing?.ghin_number || "").trim() || null;

  let passenger = existing;
  if (!passenger) {
    const { data, error } = await admin
      .from("passengers")
      .insert({
        auth_user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        preferred_name: String(metadata.preferred_name || "").trim() || null,
        date_of_birth: dateOfBirth,
        gender,
        ghin_number: ghinNumber,
        status: "claimed",
        claimed_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    passenger = data;
  } else {
    const patch: Record<string, any> = {};
    if (!passenger.first_name && firstName) patch.first_name = firstName;
    if (!passenger.last_name && lastName) patch.last_name = lastName;
    if (!passenger.date_of_birth && dateOfBirth) patch.date_of_birth = dateOfBirth;
    if (!passenger.gender && gender) patch.gender = gender;
    if (!passenger.ghin_number && ghinNumber) patch.ghin_number = ghinNumber;
    if (passenger.status !== "claimed") {
      patch.status = "claimed";
      patch.claimed_at = passenger.claimed_at || new Date().toISOString();
    }
    if (Object.keys(patch).length) {
      const { data, error } = await admin.from("passengers").update(patch).eq("id", passenger.id).select("*").single();
      if (error) throw error;
      passenger = data;
    }
  }

  await admin.from("passenger_profiles").upsert(
    { passenger_id: passenger.id },
    { onConflict: "passenger_id", ignoreDuplicates: true }
  );

  const contactSeeds = [
    { type: "email", value: String(seed.email || user.email || "").trim().toLowerCase() },
    { type: "phone", value: String(seed.phone || "").trim() },
  ].filter((item) => item.value);

  for (const item of contactSeeds) {
    const normalized = item.type === "email"
      ? item.value.toLowerCase()
      : item.value.replace(/\D/g, "");
    if (!normalized) continue;

    const { data: sameContact } = await admin
      .from("passenger_contacts")
      .select("id")
      .eq("passenger_id", passenger.id)
      .eq("contact_type", item.type)
      .eq("normalized_value", normalized)
      .maybeSingle();

    if (!sameContact) {
      const { data: primaryContact } = await admin
        .from("passenger_contacts")
        .select("id")
        .eq("passenger_id", passenger.id)
        .eq("contact_type", item.type)
        .eq("is_primary", true)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      const { error: contactError } = await admin.from("passenger_contacts").insert({
        passenger_id: passenger.id,
        contact_type: item.type,
        contact_value: item.value,
        normalized_value: normalized,
        label: "Personal",
        is_primary: !primaryContact,
        is_verified: item.type === "email" ? Boolean(user.email_confirmed_at) : false,
        verified_at: item.type === "email" && user.email_confirmed_at ? user.email_confirmed_at : null,
        is_active: true,
        source: "golf_registration",
      });
      if (contactError) throw contactError;
    }
  }

  return passenger;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Registration server is not configured." }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "profile_defaults") {
      const authorization = req.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in required." }, 401);
      const token = authorization.slice("Bearer ".length);
      const { data: authData, error: authError } = await admin.auth.getUser(token);
      const user = authData?.user;
      if (authError || !user) return json({ error: "Invalid session." }, 401);

      const { data: basicProfile } = await admin
        .from("profiles")
        .select("first_name,last_name,phone")
        .eq("id", user.id)
        .maybeSingle();

      const passenger = await ensurePassenger(admin, user, {
        first_name: basicProfile?.first_name,
        last_name: basicProfile?.last_name,
        email: user.email,
        phone: basicProfile?.phone,
      });

      const { data: reusableProfile } = await admin
        .from("passenger_profiles")
        .select("*")
        .eq("passenger_id", passenger.id)
        .maybeSingle();

      return json({
        passenger_id: passenger.id,
        values: {
          "First name": passenger.first_name || basicProfile?.first_name || "",
          "Last name": passenger.last_name || basicProfile?.last_name || "",
          "Email": user.email || "",
          "Phone": basicProfile?.phone || "",
          "Date of Birth": passenger.date_of_birth || "",
          "Gender": passenger.gender || "",
          "GHIN #": passenger.ghin_number || "",
          "Home Course": reusableProfile?.home_course || "",
          "Handedness": reusableProfile?.handedness || "",
          "Player Status": reusableProfile?.player_status || "",
        }
      });
    }

    if (action === "event_payment_options") {
      const eventKey = String(body?.event_key || "").trim();
      if (!eventKey) return json({ error: "Missing event." }, 400);
      const { data: eventRow, error: eventError } = await admin
        .from("golf_registration_events")
        .select("id,event_key,status")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (eventError || !eventRow) return json({ error: "Event not found." }, 404);

      const { data: settings, error: settingsError } = await admin
        .from("golf_event_payment_settings")
        .select("allow_online,allow_clubhouse,convenience_fee_type,convenience_fee_value,currency,team_payment_mode,allow_split_team_payments")
        .eq("event_id", eventRow.id)
        .maybeSingle();
      if (settingsError) return json({ error: "Unable to load payment options." }, 500);

      return json({
        event_key: eventRow.event_key,
        payment: settings || {
          allow_online: false,
          allow_clubhouse: false,
          convenience_fee_type: "none",
          convenience_fee_value: 0,
          currency: "usd",
          team_payment_mode: "captain_all",
          allow_split_team_payments: false,
        },
      });
    }

    if (action === "my_registration") {
      const authorization = req.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in required." }, 401);
      const token = authorization.slice("Bearer ".length);
      const { data: authData, error: authError } = await admin.auth.getUser(token);
      const user = authData?.user;
      if (authError || !user) return json({ error: "Invalid session." }, 401);

      const eventKey = String(body?.event_key || "").trim();
      if (!eventKey) return json({ error: "Missing event." }, 400);

      const { data: registration, error } = await admin.from("golf_registrations")
        .select("id,event_id,event_key,event_name,first_name,last_name,email,phone,membership_status,price,payment_status,payment_reference,payment_method,registration_status,passenger_claim_status,passenger_id,user_id,team_id")
        .eq("user_id", user.id)
        .eq("event_key", eventKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return json({ error: "Unable to load your registration." }, 500);
      return json({ registration: registration || null });
    }

    if (action === "create_pending") {
      const registration = body?.registration || {};
      const eventKey = String(registration.event_key || "").trim();
      if (!eventKey) return json({ error: "Missing event." }, 400);

      let user = null;
      const authorization = req.headers.get("Authorization");
      if (authorization?.startsWith("Bearer ")) {
        const token = authorization.slice("Bearer ".length);
        const { data, error } = await admin.auth.getUser(token);
        if (!error && data?.user) user = data.user;
      }

      if (!user) {
        const userId = String(body?.user_id || "").trim();
        const signupToken = String(body?.signup_token || "").trim();
        if (!userId || !signupToken) return json({ error: "Account verification context is missing." }, 401);
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error || !data?.user) return json({ error: "Account not found." }, 404);
        const savedToken = String(data.user.user_metadata?.pending_registration_token || "");
        if (!savedToken || savedToken !== signupToken) return json({ error: "Registration handoff could not be verified." }, 403);
        user = data.user;
      }

      const { data: eventRow, error: eventError } = await admin
        .from("golf_registration_events")
        .select("*")
        .eq("event_key", eventKey)
        .single();
      if (eventError || !eventRow) return json({ error: "Event not found." }, 404);

      const values = registration.values || {};
      const firstName = String(values["First name"] || "").trim();
      const lastName = String(values["Last name"] || "").trim();
      const email = String(values["Email"] || user.email || "").trim();
      const phone = String(values["Phone"] || "").trim();
      const dob = String(values["Date of Birth"] || "").trim();
      const gender = String(values["Gender"] || "").trim();
      const division = String(values["Division"] || "").trim();
      const membership = String(values["Member status"] || "Member").trim();
      const ghin = String(values["GHIN #"] || "").trim();

      if (!firstName || !lastName || !email || !phone) return json({ error: "Please complete first name, last name, email and phone." }, 400);
      if (user.email && email.toLowerCase() !== user.email.toLowerCase()) return json({ error: "Registration email must match the EIG account email." }, 400);
      if (!["Member", "Non-Member"].includes(membership)) return json({ error: "Invalid member status." }, 400);

      const passenger = await ensurePassenger(admin, user, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        date_of_birth: dob,
        gender,
        ghin_number: ghin,
      });

      const settings = eventRow.field_settings || {};
      const requiredMap: Record<string, string> = { dob, gender, division, membership, ghin };
      for (const key of ["dob", "gender", "division", "membership", "ghin"]) {
        if (settings[key] === "required" && !String(requiredMap[key] || "").trim()) return json({ error: "Please complete all required fields." }, 400);
      }

      const customFields: Record<string, unknown> = {};
      for (const field of Array.isArray(settings.custom_fields) ? settings.custom_fields : []) {
        const value = values[field.label];
        customFields[field.id] = value ?? "";
        if (field.required) {
          const missing = field.type === "checkbox" ? value !== true : !String(value ?? "").trim();
          if (missing) return json({ error: `Please complete ${field.label}.` }, 400);
        }
      }

      const eventDate = Array.isArray(eventRow.event_dates) ? eventRow.event_dates[0] || null : null;
      const age = dob ? calculateAgeOnDate(dob, eventDate) : null;
      if (dob && age === null) return json({ error: "Please enter a valid date of birth." }, 400);

      const requestedOfferId = String(registration.offer_id || "").trim();
      let offerQuery = admin.from("event_offers")
        .select("id,name,price,charge_by,is_default,status,sort_order")
        .eq("golf_event_id", eventRow.id)
        .eq("offer_type", "registration")
        .eq("status", "active");
      offerQuery = requestedOfferId
        ? offerQuery.eq("id", requestedOfferId)
        : offerQuery.order("is_default", { ascending: false }).order("sort_order", { ascending: true }).limit(1);
      const { data: offerRows, error: offerError } = await offerQuery;
      if (offerError) return json({ error: "Unable to load event registration pricing." }, 500);
      const registrationOffer = Array.isArray(offerRows) ? offerRows[0] : null;
      if (requestedOfferId && !registrationOffer) return json({ error: "That registration option is no longer available." }, 409);

      const configuredPrice = registrationOffer
        ? Number(registrationOffer.price || 0)
        : membership === "Non-Member"
          ? Number(eventRow.non_member_price || 0)
          : Number(eventRow.member_price || 0);

      const { data: existing } = await admin
        .from("golf_registrations")
        .select("id,payment_status,price,registration_source,passenger_id,passenger_claim_status")
        .eq("user_id", user.id)
        .eq("event_key", eventRow.event_key)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (["paid", "comp"].includes(existing?.payment_status || "")) {
        return json({
          error: existing?.payment_status === "comp"
            ? "This event registration is already complete as a complimentary registration."
            : "This event registration is already paid and complete.",
          registration_id: existing.id,
          complete: true,
        }, 409);
      }

      const snapshotPrice = existing?.price !== null && existing?.price !== undefined
        ? Number(existing.price)
        : configuredPrice;
      const claimedAt = new Date().toISOString();
      const row = {
        event_id: eventRow.id,
        event_key: eventRow.event_key,
        event_name: eventRow.name,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob || null,
        age,
        gender: gender || null,
        division: division || null,
        membership_status: membership,
        price: snapshotPrice,
        email,
        phone,
        ghin_number: ghin || null,
        custom_fields: customFields,
        payment_status: "pending",
        user_id: user.id,
        passenger_id: passenger.id,
        passenger_claim_status: "claimed",
        passenger_claimed_at: claimedAt,
        ...(existing?.id ? {} : { registration_source: "public" }),
      };

      let saved;
      if (existing?.id) {
        const { data, error } = await admin.from("golf_registrations").update(row).eq("id", existing.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await admin.from("golf_registrations").insert(row).select().single();
        if (error) throw error;
        saved = data;
      }

      await syncRoster(supabaseUrl, serviceRoleKey, eventRow.event_key);
      return json({ registration: saved });
    }

    if (action === "select_payment") {
      const authorization = req.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in required." }, 401);
      const token = authorization.slice("Bearer ".length);
      const { data: authData, error: authError } = await admin.auth.getUser(token);
      const user = authData?.user;
      if (authError || !user) return json({ error: "Invalid session." }, 401);

      const registrationId = String(body?.registration_id || "").trim();
      const paymentMethod = String(body?.payment_method || "").trim();
      if (!registrationId || !["online", "clubhouse"].includes(paymentMethod)) return json({ error: "Invalid payment selection." }, 400);

      const { data: registration, error: findError } = await admin
        .from("golf_registrations")
        .select("id,user_id,event_id,event_key,payment_status")
        .eq("id", registrationId)
        .single();
      if (findError || !registration) return json({ error: "Registration not found." }, 404);
      if (registration.user_id !== user.id) return json({ error: "Not authorized for this registration." }, 403);
      if (registration.payment_status === "paid") return json({ error: "Registration is already paid." }, 409);

      const { data: paymentSettings, error: paymentSettingsError } = await admin
        .from("golf_event_payment_settings")
        .select("allow_online,allow_clubhouse")
        .eq("event_id", registration.event_id)
        .maybeSingle();
      if (paymentSettingsError || !paymentSettings) return json({ error: "Event payment settings are not configured." }, 409);
      if (paymentMethod === "online" && paymentSettings.allow_online !== true) return json({ error: "Online payment is not enabled for this event." }, 409);
      if (paymentMethod === "clubhouse" && paymentSettings.allow_clubhouse !== true) return json({ error: "Clubhouse payment is not enabled for this event." }, 409);

      const { data: updated, error: updateError } = await admin
        .from("golf_registrations")
        .update({ payment_status: "pending", payment_reference: paymentMethod, payment_method: paymentMethod })
        .eq("id", registrationId)
        .select()
        .single();
      if (updateError) throw updateError;

      await syncRoster(supabaseUrl, serviceRoleKey, registration.event_key);
      return json({ registration: updated });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("Golf registration flow error:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to process registration." }, 500);
  }
});