-- Extend the existing secure golf team-spot invitation to manual captains (slot 1).
alter table public.golf_team_invitations drop constraint golf_team_invitations_slot_number_check;
alter table public.golf_team_invitations add constraint golf_team_invitations_slot_number_check check (slot_number >= 1);

CREATE OR REPLACE FUNCTION public.golf_claim_manual_captain_invitation(p_invitation_id uuid, p_user_id uuid, p_passenger_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 inv public.golf_team_invitations%rowtype;
 reg public.golf_registrations%rowtype;
 tm public.golf_registration_teams%rowtype;
 claimed_at timestamptz := now();
begin
 if current_user <> 'service_role' then raise exception 'Service authorization required'; end if;
 if p_invitation_id is null or p_user_id is null or p_passenger_id is null then
   raise exception 'Missing claimed captain identity'; end if;
 select * into inv from public.golf_team_invitations where id=p_invitation_id for update;
 if not found then raise exception 'Invitation not found'; end if;
 if inv.status not in ('pending','send_failed') or inv.expires_at <= claimed_at then
   raise exception 'Invitation is no longer active'; end if;
 select * into reg from public.golf_registrations where id=inv.registration_id for update;
 if not found or reg.registration_status <> 'active' then
   raise exception 'Active captain registration not found'; end if;
 select * into tm from public.golf_registration_teams where id=inv.team_id for update;
 if not found or tm.event_id <> inv.event_id or tm.team_id <> reg.team_id or
    tm.captain_registration_id <> reg.id or inv.slot_number <> 1 or reg.event_id <> inv.event_id then
   raise exception 'Invitation does not match the team captain'; end if;
 if lower(btrim(coalesce(reg.email,''))) <> lower(btrim(inv.email)) then
   raise exception 'The team captain email no longer matches this invitation'; end if;
 if reg.user_id is not null and reg.user_id <> p_user_id then
   raise exception 'Captain registration already claimed by another account'; end if;
 if tm.captain_user_id is not null and tm.captain_user_id <> p_user_id then
   raise exception 'Captain permissions already belong to another account'; end if;
 if exists (select 1 from public.passengers p where p.id=p_passenger_id and p.auth_user_id<>p_user_id) then
   raise exception 'Passenger account mismatch'; end if;
 update public.golf_registrations set user_id=p_user_id,passenger_id=p_passenger_id,
   passenger_claim_status='claimed',passenger_claimed_at=claimed_at where id=reg.id;
 update public.golf_registration_teams set captain_user_id=p_user_id,updated_at=claimed_at where id=tm.id;
 update public.golf_team_invitations set status='completed',completed_at=claimed_at,
   last_error=null,updated_at=claimed_at where id=inv.id;
 return reg.id;
end $function$

revoke all on function public.golf_claim_manual_captain_invitation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.golf_claim_manual_captain_invitation(uuid,uuid,uuid) to service_role;
