import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const DEFAULT_GOLFER_FIELDS = [
  {
    field_key: 'first_name',
    label: 'First Name',
    field_type: 'short_text',
    applies_to: 'golfer',
    requirement_status: 'required',
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: true,
    sort_order: 10,
  },
  {
    field_key: 'last_name',
    label: 'Last Name',
    field_type: 'short_text',
    applies_to: 'golfer',
    requirement_status: 'required',
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: true,
    sort_order: 20,
  },
  {
    field_key: 'email',
    label: 'Email',
    field_type: 'email',
    applies_to: 'golfer',
    requirement_status: 'required',
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: true,
    sort_order: 30,
  },
  {
    field_key: 'phone',
    label: 'Phone',
    field_type: 'phone',
    applies_to: 'golfer',
    requirement_status: 'required',
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: false,
    sort_order: 40,
  },
  {
    field_key: 'gender',
    label: 'Gender',
    field_type: 'single_select',
    applies_to: 'golfer',
    requirement_status: 'required',
    options: ['Male', 'Female'],
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: true,
    sort_order: 50,
  },
  {
    field_key: 'date_of_birth',
    label: 'Date of Birth',
    field_type: 'date',
    applies_to: 'golfer',
    requirement_status: 'required',
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: false,
    sort_order: 60,
  },
  {
    field_key: 'ghin_number',
    label: 'GHIN Number',
    field_type: 'short_text',
    applies_to: 'golfer',
    requirement_status: 'optional',
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: true,
    sort_order: 70,
  },
  {
    field_key: 'handicap_index',
    label: 'Handicap Index',
    field_type: 'number',
    applies_to: 'golfer',
    requirement_status: 'optional',
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: true,
    sort_order: 80,
  },
  {
    field_key: 'tee',
    label: 'Tee',
    field_type: 'short_text',
    applies_to: 'golfer',
    requirement_status: 'optional',
    is_system_field: true,
    include_in_internal_export: true,
    include_in_golf_genius_export: true,
    sort_order: 90,
  },
];

export function useEventSystemData() {
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [contributions, setContributions] = useState([]);

  const [registrationTypes, setRegistrationTypes] = useState([]);
  const [teamRegistrations, setTeamRegistrations] = useState([]);
  const [golfers, setGolfers] = useState([]);
  const [registrationFields, setRegistrationFields] = useState([]);
  const [registrationFieldValues, setRegistrationFieldValues] = useState([]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [
        eventsRes,
        productsRes,
        sponsorsRes,
        purchasesRes,
        volunteersRes,
        requestsRes,
        contributionsRes,
        registrationTypesRes,
        teamRegistrationsRes,
        golfersRes,
        registrationFieldsRes,
        registrationFieldValuesRes,
      ] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('sponsorship_products').select('*').order('created_at', { ascending: false }),
        supabase.from('sponsors').select('*').order('created_at', { ascending: false }),
        supabase.from('sponsor_purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('volunteers').select('*').order('created_at', { ascending: false }),
        supabase.from('event_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('contributions').select('*').order('created_at', { ascending: false }),
        supabase.from('registration_types').select('*').order('sort_order', { ascending: true }),
        supabase.from('team_registrations').select('*').order('created_at', { ascending: false }),
        supabase.from('golfers').select('*').order('created_at', { ascending: true }),
        supabase.from('event_registration_fields').select('*').order('sort_order', { ascending: true }),
        supabase.from('registration_field_values').select('*').order('created_at', { ascending: true }),
      ]);

      const responses = [
        eventsRes,
        productsRes,
        sponsorsRes,
        purchasesRes,
        volunteersRes,
        requestsRes,
        contributionsRes,
        registrationTypesRes,
        teamRegistrationsRes,
        golfersRes,
        registrationFieldsRes,
        registrationFieldValuesRes,
      ];

      const firstError = responses.find((response) => response.error)?.error;
      if (firstError) throw firstError;

      const eventRows = eventsRes.data ?? [];

      setEvents(eventRows);
      setProducts(productsRes.data ?? []);
      setSponsors(sponsorsRes.data ?? []);
      setPurchases(purchasesRes.data ?? []);
      setVolunteers(volunteersRes.data ?? []);
      setRequests(requestsRes.data ?? []);
      setContributions(contributionsRes.data ?? []);
      setRegistrationTypes(registrationTypesRes.data ?? []);
      setTeamRegistrations(teamRegistrationsRes.data ?? []);
      setGolfers(golfersRes.data ?? []);
      setRegistrationFields(registrationFieldsRes.data ?? []);
      setRegistrationFieldValues(registrationFieldValuesRes.data ?? []);

      setSelectedEventId((current) => current || eventRows[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load event system data.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function createDefaultRegistrationFields(eventId) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const rows = DEFAULT_GOLFER_FIELDS.map((field) => ({
      event_id: eventId,
      ...field,
      options: field.options ?? [],
      status: 'active',
    }));

    const { data, error } = await supabase
      .from('event_registration_fields')
      .upsert(rows, { onConflict: 'event_id,field_key' })
      .select();

    if (error) throw error;
    return data ?? [];
  }

  async function createEvent(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('events')
      .insert({
        name: payload.name,
        event_type: payload.event_type ?? 'Golf Outing',
        event_date: payload.event_date || null,
        location: payload.location || null,
        golfer_count: payload.golfer_count ?? 0,
        revenue_goal: payload.revenue_goal ?? 0,
        status: payload.status ?? 'pending_review',
        notes: payload.notes ?? null,

        slug: payload.slug ?? null,
        description: payload.description ?? null,
        start_time: payload.start_time || null,
        registration_deadline: payload.registration_deadline || null,
        max_golfers: payload.max_golfers ?? payload.golfer_count ?? null,
        registration_status: payload.registration_status ?? 'closed',
        is_published: payload.is_published ?? false,
        banner_url: payload.banner_url ?? null,
        organizer_name: payload.organizer_name ?? null,
        organizer_email: payload.organizer_email ?? null,
        organizer_phone: payload.organizer_phone ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    await createDefaultRegistrationFields(data.id);
    await loadData();
    setSelectedEventId(data.id);

    return data;
  }

  async function createEventRequest(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('event_requests')
      .insert({
        event_id: payload.event_id,
        request_type: payload.request_type,
        title: payload.title,
        base_quantity: payload.base_quantity ?? 0,
        additional_quantity: payload.additional_quantity ?? 0,
        status: payload.status ?? 'submitted',
        notes: payload.notes ?? null,
        details: payload.details ?? {},
      })
      .select()
      .single();

    if (error) throw error;
    await loadData();
    return data;
  }

  async function createSponsor(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('sponsors')
      .insert({
        event_id: payload.event_id,
        business_name: payload.business_name,
        contact_name: payload.contact_name ?? null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        status: payload.status ?? 'lead',
        logo_status: payload.logo_status ?? 'needed',
        notes: payload.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    await loadData();
    return data;
  }

  async function createVolunteer(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('volunteers')
      .insert({
        event_id: payload.event_id,
        name: payload.name,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        preferred_role: payload.preferred_role ?? null,
        assigned_role: payload.assigned_role ?? payload.preferred_role ?? null,
        availability: payload.availability ?? null,
        status: payload.status ?? 'new',
        notes: payload.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    await loadData();
    return data;
  }

  async function createRegistrationType(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('registration_types')
      .insert({
        event_id: payload.event_id,
        name: payload.name,
        description: payload.description ?? null,
        registration_kind: payload.registration_kind ?? 'team',
        team_size: payload.team_size ?? 4,
        price: payload.price ?? 0,
        quantity_available: payload.quantity_available ?? null,
        quantity_sold: payload.quantity_sold ?? 0,
        status: payload.status ?? 'active',
        sort_order: payload.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    await loadData();
    return data;
  }

  async function createTeamRegistration(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const registrationSource = payload.registration_source ?? 'direct';

    if (registrationSource === 'comp') {
      if (!payload.comp_reason?.trim()) {
        throw new Error('A reason is required for a comp team.');
      }
      if (!payload.comp_approved_by?.trim()) {
        throw new Error('Approved by is required for a comp team.');
      }
    }

    if (registrationSource === 'sponsorship' && !payload.sponsor_purchase_id) {
      throw new Error('A sponsor purchase must be linked to a sponsorship-included team.');
    }

    const paymentStatus =
      registrationSource === 'comp'
        ? 'complimentary'
        : registrationSource === 'sponsorship'
          ? 'included'
          : payload.payment_status ?? 'pending';

    const { data, error } = await supabase
      .from('team_registrations')
      .insert({
        event_id: payload.event_id,
        registration_type_id: payload.registration_type_id ?? null,
        team_name: payload.team_name ?? null,
        captain_name: payload.captain_name,
        captain_email: payload.captain_email ?? null,
        captain_phone: payload.captain_phone ?? null,
        registered_golfer_count: payload.registered_golfer_count ?? 0,
        roster_status: payload.roster_status ?? 'incomplete',
        registration_source: registrationSource,
        payment_status: paymentStatus,
        amount_charged: payload.amount_charged ?? 0,
        sponsor_purchase_id: payload.sponsor_purchase_id ?? null,
        comp_reason: registrationSource === 'comp' ? payload.comp_reason.trim() : null,
        comp_approved_by: registrationSource === 'comp' ? payload.comp_approved_by.trim() : null,
        comp_approved_at:
          registrationSource === 'comp'
            ? payload.comp_approved_at ?? new Date().toISOString()
            : null,
        notes: payload.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    await loadData();
    return data;
  }

  async function createCompTeam(payload) {
    return createTeamRegistration({
      ...payload,
      registration_source: 'comp',
      payment_status: 'complimentary',
      amount_charged: 0,
    });
  }

  async function createSponsorIncludedTeam(payload) {
    return createTeamRegistration({
      ...payload,
      registration_source: 'sponsorship',
      payment_status: 'included',
      amount_charged: 0,
    });
  }

  async function createGolfer(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('golfers')
      .insert({
        event_id: payload.event_id,
        team_registration_id: payload.team_registration_id ?? null,
        first_name: payload.first_name ?? null,
        last_name: payload.last_name ?? null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        gender: payload.gender ?? null,
        date_of_birth: payload.date_of_birth || null,
        ghin_number: payload.ghin_number ?? null,
        handicap_index: payload.handicap_index ?? null,
        tee: payload.tee ?? null,
        handicap: payload.handicap ?? null,
        shirt_size: payload.shirt_size ?? null,
        dietary_notes: payload.dietary_notes ?? null,
        rental_clubs_needed: payload.rental_clubs_needed ?? false,
        is_team_captain: payload.is_team_captain ?? false,
        status: payload.status ?? 'registered',
        notes: payload.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    if (payload.team_registration_id) {
      await refreshTeamRosterStatus(payload.team_registration_id);
    } else {
      await loadData();
    }

    return data;
  }

  async function refreshTeamRosterStatus(teamRegistrationId) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data: team, error: teamError } = await supabase
      .from('team_registrations')
      .select('id, registration_type_id')
      .eq('id', teamRegistrationId)
      .single();

    if (teamError) throw teamError;

    const { count, error: countError } = await supabase
      .from('golfers')
      .select('*', { count: 'exact', head: true })
      .eq('team_registration_id', teamRegistrationId)
      .neq('status', 'cancelled');

    if (countError) throw countError;

    let expectedTeamSize = 4;

    if (team.registration_type_id) {
      const { data: registrationType, error: typeError } = await supabase
        .from('registration_types')
        .select('team_size')
        .eq('id', team.registration_type_id)
        .single();

      if (!typeError && registrationType?.team_size) {
        expectedTeamSize = registrationType.team_size;
      }
    }

    const golferCount = count ?? 0;
    const rosterStatus =
      golferCount === 0
        ? 'empty'
        : golferCount >= expectedTeamSize
          ? 'complete'
          : 'incomplete';

    const { error: updateError } = await supabase
      .from('team_registrations')
      .update({
        registered_golfer_count: golferCount,
        roster_status: rosterStatus,
      })
      .eq('id', teamRegistrationId);

    if (updateError) throw updateError;
    await loadData();
  }

  async function createRegistrationField(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('event_registration_fields')
      .insert({
        event_id: payload.event_id,
        field_key: payload.field_key,
        label: payload.label,
        field_type: payload.field_type ?? 'short_text',
        applies_to: payload.applies_to ?? 'golfer',
        requirement_status: payload.requirement_status ?? 'optional',
        options: payload.options ?? [],
        placeholder: payload.placeholder ?? null,
        help_text: payload.help_text ?? null,
        is_system_field: payload.is_system_field ?? false,
        include_in_internal_export: payload.include_in_internal_export ?? true,
        include_in_golf_genius_export: payload.include_in_golf_genius_export ?? false,
        sort_order: payload.sort_order ?? 0,
        status: payload.status ?? 'active',
      })
      .select()
      .single();

    if (error) throw error;
    await loadData();
    return data;
  }

  async function saveRegistrationFieldValue(payload) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const row = {
      event_id: payload.event_id,
      field_id: payload.field_id,
      team_registration_id: payload.team_registration_id ?? null,
      golfer_id: payload.golfer_id ?? null,
      value_text: payload.value_text ?? null,
      value_number: payload.value_number ?? null,
      value_boolean: payload.value_boolean ?? null,
      value_date: payload.value_date || null,
      value_json: payload.value_json ?? null,
    };

    if (!row.team_registration_id && !row.golfer_id) {
      throw new Error('A custom field value must belong to a team registration or golfer.');
    }

    let query = supabase.from('registration_field_values');

    if (row.golfer_id) {
      query = query.upsert(row, { onConflict: 'field_id,golfer_id' });
    } else {
      query = query.upsert(row, { onConflict: 'field_id,team_registration_id' });
    }

    const { data, error } = await query.select().single();

    if (error) throw error;
    await loadData();
    return data;
  }

  async function updateRow(table, id, patch) {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from(table)
      .update(patch)
      .eq('id', id);

    if (error) throw error;
    await loadData();
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    isSupabaseConfigured,

    events,
    products,
    sponsors,
    purchases,
    volunteers,
    requests,
    contributions,

    registrationTypes,
    teamRegistrations,
    golfers,
    registrationFields,
    registrationFieldValues,

    selectedEventId,
    setSelectedEventId,

    loading,
    error,
    setError,

    loadData,
    createEvent,
    createEventRequest,
    createSponsor,
    createVolunteer,

    createRegistrationType,
    createTeamRegistration,
    createCompTeam,
    createSponsorIncludedTeam,
    createGolfer,
    refreshTeamRosterStatus,

    createDefaultRegistrationFields,
    createRegistrationField,
    saveRegistrationFieldValue,

    updateRow,
  };
}

