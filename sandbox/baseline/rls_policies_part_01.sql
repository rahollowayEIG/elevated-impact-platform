-- SANDBOX ONLY: production RLS policy expressions with client table and RPC grants still REVOKED.
-- No customer rows, identities, contacts or sessions are imported.
CREATE POLICY "EIG admins can manage billing" ON public."billing_accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_eig_admin()) WITH CHECK (is_eig_admin());
CREATE POLICY "Organization admins can read billing" ON public."billing_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text])));
CREATE POLICY "Organization members can create contacts" ON public."contacts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (has_organization_role(organization_id, ARRAY['eig_admin'::text, 'organization_admin'::text, 'organization_staff'::text, 'event_coordinator'::text, 'event_staff'::text]));
CREATE POLICY "Organization members can read contacts" ON public."contacts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_organization_member(organization_id));
CREATE POLICY "Organization members can update contacts" ON public."contacts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_organization_role(organization_id, ARRAY['eig_admin'::text, 'organization_admin'::text, 'organization_staff'::text, 'event_coordinator'::text, 'event_staff'::text])) WITH CHECK (has_organization_role(organization_id, ARRAY['eig_admin'::text, 'organization_admin'::text, 'organization_staff'::text, 'event_coordinator'::text, 'event_staff'::text]));
CREATE POLICY "anon read contributions" ON public."contributions" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write contributions" ON public."contributions" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "eic_design_catalog_audit_read" ON public."eic_design_product_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (( SELECT eig_private.can_manage_design_catalog() AS can_manage_design_catalog));
CREATE POLICY "eic_design_catalog_read" ON public."eic_design_products" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT eig_private.active_builder_session() AS active_builder_session) AND ((status = 'active'::text) OR ( SELECT eig_private.can_manage_design_catalog() AS can_manage_design_catalog))));
CREATE POLICY "authorized_budget_history" ON public."eie_event_budget_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (eig_private.can_manage_event_budget(event_id));
CREATE POLICY "authorized_budget_read" ON public."eie_event_budgets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (eig_private.can_manage_event_budget(event_id));
CREATE POLICY "EIG admins can manage credits" ON public."eig_credit_ledger" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_eig_admin()) WITH CHECK (is_eig_admin());
CREATE POLICY "Organization admins can read credits" ON public."eig_credit_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text])));
CREATE POLICY "Hangar leaders can manage event assignments" ON public."event_assignments" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM golf_registration_events ge
  WHERE ((ge.id = event_assignments.event_id) AND (is_eig_admin() OR has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM golf_registration_events ge
  WHERE ((ge.id = event_assignments.event_id) AND (is_eig_admin() OR has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "Users can read their event assignments" ON public."event_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM golf_registration_events e
  WHERE ((e.id = event_assignments.event_id) AND has_organization_role(e.organization_id, ARRAY['eig_admin'::text, 'organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "event_builder_asset_audit_authorized_read" ON public."event_builder_asset_audit" AS PERMISSIVE FOR SELECT TO "authenticated" USING (eig_private.can_manage_event_assets(event_id));
CREATE POLICY "event_builder_assets_authorized_read" ON public."event_builder_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (eig_private.can_manage_event_assets(event_id));
CREATE POLICY "Assigned users can read event contact roles" ON public."event_contact_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_event_assigned(event_id) OR (EXISTS ( SELECT 1
   FROM golf_registration_events e
  WHERE ((e.id = event_contact_roles.event_id) AND has_organization_role(e.organization_id, ARRAY['eig_admin'::text, 'organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "assigned ATC can manage event offers" ON public."event_offers" AS PERMISSIVE FOR ALL TO "authenticated" USING (app_private.is_event_coordinator(golf_event_id)) WITH CHECK (app_private.is_event_coordinator(golf_event_id));
CREATE POLICY "event_offers_manager_write" ON public."event_offers" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))) WITH CHECK ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "event_offers_member_read" ON public."event_offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR is_organization_member(organization_id)));
CREATE POLICY "public can read active offers for published golf events" ON public."event_offers" AS PERMISSIVE FOR SELECT TO "anon" USING (((status = 'active'::text) AND (EXISTS ( SELECT 1
   FROM golf_registration_events gre
  WHERE ((gre.id = event_offers.golf_event_id) AND (gre.status = 'published'::text))))));
CREATE POLICY "anon read event_registration_fields" ON public."event_registration_fields" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write event_registration_fields" ON public."event_registration_fields" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "Organization members can read request activity" ON public."event_request_activity" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM event_requests er
  WHERE ((er.id = event_request_activity.event_request_id) AND (er.organization_id IS NOT NULL) AND is_organization_member(er.organization_id)))));
CREATE POLICY "Organization members can read event requests" ON public."event_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((organization_id IS NOT NULL) AND is_organization_member(organization_id)));
CREATE POLICY "Organization staff can manage event requests" ON public."event_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id IS NOT NULL) AND has_organization_role(organization_id, ARRAY['eig_admin'::text, 'organization_admin'::text, 'organization_staff'::text]))) WITH CHECK (((organization_id IS NOT NULL) AND has_organization_role(organization_id, ARRAY['eig_admin'::text, 'organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "Public can submit event requests" ON public."event_requests" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (((organization_id IS NOT NULL) AND (status = 'submitted'::text) AND (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = event_requests.organization_id) AND (o.status = 'active'::text))))));
CREATE POLICY "anon read requests" ON public."event_requests" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write requests" ON public."event_requests" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "anon read events" ON public."events" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write events" ON public."events" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "assigned ATC can read master event" ON public."events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app_private.is_event_coordinator_for_master(id));
CREATE POLICY "assigned ATC can update master event" ON public."events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (app_private.is_event_coordinator_for_master(id)) WITH CHECK (app_private.is_event_coordinator_for_master(id));
CREATE POLICY "golf admins can read own membership" ON public."golf_admin_users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "assigned ATC can manage payment settings" ON public."golf_event_payment_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (app_private.is_event_coordinator(event_id)) WITH CHECK (app_private.is_event_coordinator(event_id));
CREATE POLICY "authorized managers can insert golf payment settings" ON public."golf_event_payment_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "authorized managers can read golf payment settings" ON public."golf_event_payment_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "authorized managers can update golf payment settings" ON public."golf_event_payment_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))) WITH CHECK ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "public read golf event setup" ON public."golf_event_setup" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "super admins insert golf event setup" ON public."golf_event_setup" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM golf_admin_users
  WHERE ((golf_admin_users.user_id = auth.uid()) AND (golf_admin_users.role = 'super_admin'::text)))));
CREATE POLICY "super admins read golf event setup" ON public."golf_event_setup" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM golf_admin_users
  WHERE ((golf_admin_users.user_id = auth.uid()) AND (golf_admin_users.role = 'super_admin'::text)))));
CREATE POLICY "super admins update golf event setup" ON public."golf_event_setup" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM golf_admin_users
  WHERE ((golf_admin_users.user_id = auth.uid()) AND (golf_admin_users.role = 'super_admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM golf_admin_users
  WHERE ((golf_admin_users.user_id = auth.uid()) AND (golf_admin_users.role = 'super_admin'::text)))));
CREATE POLICY "assigned ATC can read golf event" ON public."golf_registration_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app_private.is_event_coordinator(id));
CREATE POLICY "assigned ATC can update golf event" ON public."golf_registration_events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (app_private.is_event_coordinator(id)) WITH CHECK (app_private.is_event_coordinator(id));
CREATE POLICY "authorized managers can insert golf events" ON public."golf_registration_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR (EXISTS ( SELECT 1
   FROM golf_registration_events existing
  WHERE ((existing.event_key = golf_registration_events.event_key) AND has_organization_role(existing.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "authorized managers can read golf events" ON public."golf_registration_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "authorized managers can update golf events" ON public."golf_registration_events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))) WITH CHECK ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "public can read published golf events" ON public."golf_registration_events" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((status = 'published'::text));
CREATE POLICY "assigned ATC can read event registrations" ON public."golf_registrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app_private.is_event_coordinator(event_id));
CREATE POLICY "authenticated users create own golf registrations" ON public."golf_registrations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "authorized managers can read golf registrations" ON public."golf_registrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR (EXISTS ( SELECT 1
   FROM golf_registration_events e
  WHERE (((e.id = golf_registrations.event_id) OR (e.event_key = golf_registrations.event_key)) AND has_organization_role(e.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "users can read own golf registrations" ON public."golf_registrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "anon read golfers" ON public."golfers" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write golfers" ON public."golfers" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "inception_private_versions" ON public."inception_project_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM inception_projects p
  WHERE (p.id = inception_project_versions.project_id))));
CREATE POLICY "inception_private_projects" ON public."inception_projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (eig_private.can_access_inception(owner_user_id, event_id));
CREATE POLICY "Users can read own memberships" ON public."organization_memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR has_organization_role(organization_id, ARRAY['eig_admin'::text, 'organization_admin'::text])));
CREATE POLICY "EIG admins can manage organization entitlements" ON public."organization_product_entitlements" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_eig_admin()) WITH CHECK (is_eig_admin());
CREATE POLICY "Members can read organization entitlements" ON public."organization_product_entitlements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR is_organization_member(organization_id)));
CREATE POLICY "Members or EIG admins can read organization profiles" ON public."organization_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR is_organization_member(organization_id)));
CREATE POLICY "Organization admins or EIG admins can manage organization profi" ON public."organization_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text]))) WITH CHECK ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text])));
CREATE POLICY "EIG admins can manage organizations" ON public."organizations" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_eig_admin()) WITH CHECK (is_eig_admin());
CREATE POLICY "Members or EIG admins can read organizations" ON public."organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR is_organization_member(id)));
CREATE POLICY "Public can read active venue organizations" ON public."organizations" AS PERMISSIVE FOR SELECT TO "anon" USING (((status = 'active'::text) AND (organization_type = ANY (ARRAY['golf_course'::text, 'venue'::text, 'business'::text]))));
CREATE POLICY "assigned ATC can read event Hangar" ON public."organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app_private.is_event_coordinator_for_org(id));
