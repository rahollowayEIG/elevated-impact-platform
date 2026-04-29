import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export function useEventSystemData() {
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [contributions, setContributions] = useState([]);
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
      ] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('sponsorship_products').select('*').order('created_at', { ascending: false }),
        supabase.from('sponsors').select('*').order('created_at', { ascending: false }),
        supabase.from('sponsor_purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('volunteers').select('*').order('created_at', { ascending: false }),
        supabase.from('event_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('contributions').select('*').order('created_at', { ascending: false }),
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (sponsorsRes.error) throw sponsorsRes.error;
      if (purchasesRes.error) throw purchasesRes.error;
      if (volunteersRes.error) throw volunteersRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (contributionsRes.error) throw contributionsRes.error;

      const eventRows = eventsRes.data ?? [];
      setEvents(eventRows);
      setProducts(productsRes.data ?? []);
      setSponsors(sponsorsRes.data ?? []);
      setPurchases(purchasesRes.data ?? []);
      setVolunteers(volunteersRes.data ?? []);
      setRequests(requestsRes.data ?? []);
      setContributions(contributionsRes.data ?? []);
      setSelectedEventId((current) => current || eventRows[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load event system data.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      })
      .select()
      .single();

    if (error) throw error;
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

  async function updateRow(table, id, patch) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.from(table).update(patch).eq('id', id);
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
    updateRow,
  };
}
