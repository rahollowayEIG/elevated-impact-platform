-- SANDBOX ONLY. RLS policies installed but client table and RPC privileges remain REVOKED.
-- Policy expressions are schema code, not production records.
CREATE POLICY "passengers read own billing profile" ON public."passenger_billing_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_billing_profiles.passenger_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))) OR is_eig_admin()));
CREATE POLICY "passenger contacts manage own" ON public."passenger_contacts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_contacts.passenger_id) AND ((p.auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin())))));
CREATE POLICY "passenger contacts read own or managed" ON public."passenger_contacts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_contacts.passenger_id) AND ((p.auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin() OR (EXISTS ( SELECT 1
           FROM (golf_registrations gr
             JOIN golf_registration_events ge ON ((ge.id = gr.event_id)))
          WHERE ((gr.passenger_id = p.id) AND has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])))))))));
CREATE POLICY "passenger contacts update own" ON public."passenger_contacts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_contacts.passenger_id) AND ((p.auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_contacts.passenger_id) AND ((p.auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin())))));
CREATE POLICY "passenger results managers insert" ON public."passenger_event_results" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_eig_admin() OR (EXISTS ( SELECT 1
   FROM golf_registration_events ge
  WHERE ((ge.id = passenger_event_results.event_id) AND has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "passenger results managers update" ON public."passenger_event_results" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_eig_admin() OR (EXISTS ( SELECT 1
   FROM golf_registration_events ge
  WHERE ((ge.id = passenger_event_results.event_id) AND has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])))))) WITH CHECK ((is_eig_admin() OR (EXISTS ( SELECT 1
   FROM golf_registration_events ge
  WHERE ((ge.id = passenger_event_results.event_id) AND has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "passenger results read own or managed" ON public."passenger_event_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR (EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_event_results.passenger_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM golf_registration_events ge
  WHERE ((ge.id = passenger_event_results.event_id) AND has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "passenger aliases manage own" ON public."passenger_name_aliases" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_name_aliases.passenger_id) AND ((p.auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin())))));
CREATE POLICY "passenger aliases read own or managed" ON public."passenger_name_aliases" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_name_aliases.passenger_id) AND ((p.auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin() OR (EXISTS ( SELECT 1
           FROM (golf_registrations gr
             JOIN golf_registration_events ge ON ((ge.id = gr.event_id)))
          WHERE ((gr.passenger_id = p.id) AND has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])))))))));
CREATE POLICY "passenger aliases update own" ON public."passenger_name_aliases" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_name_aliases.passenger_id) AND ((p.auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_name_aliases.passenger_id) AND ((p.auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin())))));
CREATE POLICY "passengers read own saved payment methods" ON public."passenger_payment_methods" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_payment_methods.passenger_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))) OR is_eig_admin()));
CREATE POLICY "passengers create own reusable profile" ON public."passenger_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_profiles.passenger_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))) OR is_eig_admin()));
CREATE POLICY "passengers read own reusable profile" ON public."passenger_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_profiles.passenger_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))) OR is_eig_admin()));
CREATE POLICY "passengers update own reusable profile" ON public."passenger_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_profiles.passenger_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))) OR is_eig_admin())) WITH CHECK (((EXISTS ( SELECT 1
   FROM passengers p
  WHERE ((p.id = passenger_profiles.passenger_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))) OR is_eig_admin()));
CREATE POLICY "passengers create own claimed profile" ON public."passengers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin()));
CREATE POLICY "passengers read own or managed event passengers" ON public."passengers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin() OR (EXISTS ( SELECT 1
   FROM (golf_registrations gr
     JOIN golf_registration_events ge ON ((ge.id = gr.event_id)))
  WHERE ((gr.passenger_id = passengers.id) AND has_organization_role(ge.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))))));
CREATE POLICY "passengers update own permanent profile" ON public."passengers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin())) WITH CHECK (((auth_user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin()));
CREATE POLICY "No direct client access to platform invitations" ON public."platform_invitations" AS PERMISSIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "Authenticated users can read active products" ON public."products" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((status <> 'retired'::text));
CREATE POLICY "EIG admins can manage products" ON public."products" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_eig_admin()) WITH CHECK (is_eig_admin());
CREATE POLICY "Users can read own profile" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((id = auth.uid()));
CREATE POLICY "Users can update own profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "anon read registration_field_values" ON public."registration_field_values" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write registration_field_values" ON public."registration_field_values" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "anon read registration_types" ON public."registration_types" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write registration_types" ON public."registration_types" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "social_versions_authorized_read" ON public."social_campaign_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM social_campaigns c
  WHERE (c.id = social_campaign_versions.campaign_id))));
CREATE POLICY "social_authorized_read" ON public."social_campaigns" AS PERMISSIVE FOR SELECT TO "authenticated" USING (eig_private.can_access_social(owner_user_id, event_id));
CREATE POLICY "anon read sponsor_purchases" ON public."sponsor_purchases" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write sponsor_purchases" ON public."sponsor_purchases" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "anon read sponsors" ON public."sponsors" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write sponsors" ON public."sponsors" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "assigned ATC can manage event sponsors" ON public."sponsors" AS PERMISSIVE FOR ALL TO "authenticated" USING ((app_private.is_event_coordinator(event_id) OR app_private.is_event_coordinator_for_master(event_id))) WITH CHECK ((app_private.is_event_coordinator(event_id) OR app_private.is_event_coordinator_for_master(event_id)));
CREATE POLICY "anon read sponsorship_products" ON public."sponsorship_products" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write sponsorship_products" ON public."sponsorship_products" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "authors can write squawk audit entries" ON public."squawk_audit_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((actor_user_id = ( SELECT auth.uid() AS uid)) AND (is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((event_id IS NOT NULL) AND is_event_assigned(event_id)))));
CREATE POLICY "squawk managers can read audit history" ON public."squawk_audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "organization users can view channel readiness" ON public."squawk_channel_connections" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])));
CREATE POLICY "scoped users can view delivery events" ON public."squawk_delivery_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR (EXISTS ( SELECT 1
   FROM (squawk_messages sm
     JOIN squawk_threads st ON ((st.id = sm.thread_id)))
  WHERE ((sm.id = squawk_delivery_events.message_id) AND ((sm.created_by = ( SELECT auth.uid() AS uid)) OR has_organization_role(st.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((st.event_id IS NOT NULL) AND is_event_assigned(st.event_id))))))));
CREATE POLICY "authorized roles can read squawk message content" ON public."squawk_message_content" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (squawk_messages sm
     JOIN squawk_threads st ON ((st.id = sm.thread_id)))
  WHERE ((sm.id = squawk_message_content.message_id) AND ((sm.created_by = ( SELECT auth.uid() AS uid)) OR is_eig_admin() OR ((sm.visibility = 'direct'::text) AND ((EXISTS ( SELECT 1
           FROM squawk_message_recipients sr
          WHERE ((sr.message_id = sm.id) AND (sr.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM squawk_thread_participants stp
          WHERE ((stp.thread_id = st.id) AND (stp.user_id = ( SELECT auth.uid() AS uid))))))) OR ((sm.visibility = 'all_relevant'::text) AND ((EXISTS ( SELECT 1
           FROM squawk_message_recipients sr
          WHERE ((sr.message_id = sm.id) AND (sr.user_id = ( SELECT auth.uid() AS uid))))) OR has_organization_role(st.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((st.event_id IS NOT NULL) AND is_event_assigned(st.event_id)) OR (EXISTS ( SELECT 1
           FROM squawk_thread_participants stp
          WHERE ((stp.thread_id = st.id) AND (stp.user_id = ( SELECT auth.uid() AS uid))))))) OR ((sm.visibility = 'role_restricted'::text) AND ((EXISTS ( SELECT 1
           FROM squawk_message_recipients sr
          WHERE ((sr.message_id = sm.id) AND (sr.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM organization_memberships om
          WHERE ((om.organization_id = st.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.status = 'active'::text) AND ((om.access_starts_at IS NULL) OR (om.access_starts_at <= now())) AND ((om.access_ends_at IS NULL) OR (om.access_ends_at >= now())) AND (om.role = ANY (sm.required_roles))))) OR ((st.event_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM event_assignments ea
          WHERE ((ea.event_id = st.event_id) AND (ea.user_id = ( SELECT auth.uid() AS uid)) AND (ea.status = 'active'::text) AND ((ea.access_starts_at IS NULL) OR (ea.access_starts_at <= now())) AND ((ea.access_ends_at IS NULL) OR (ea.access_ends_at >= now())) AND (ea.role = ANY (sm.required_roles)))))))))))));
CREATE POLICY "authors can create squawk message content" ON public."squawk_message_content" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM squawk_messages sm
  WHERE ((sm.id = squawk_message_content.message_id) AND (sm.created_by = ( SELECT auth.uid() AS uid)) AND (sm.status = 'draft'::text)))));
CREATE POLICY "authors can update draft squawk message content" ON public."squawk_message_content" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM squawk_messages sm
  WHERE ((sm.id = squawk_message_content.message_id) AND (sm.created_by = ( SELECT auth.uid() AS uid)) AND (sm.status = 'draft'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM squawk_messages sm
  WHERE ((sm.id = squawk_message_content.message_id) AND (sm.created_by = ( SELECT auth.uid() AS uid)) AND (sm.status = 'draft'::text)))));
CREATE POLICY "users can create own squawk receipts" ON public."squawk_message_receipts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM squawk_messages sm
  WHERE (sm.id = squawk_message_receipts.message_id)))));
CREATE POLICY "users can see own squawk receipts" ON public."squawk_message_receipts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (squawk_messages sm
     JOIN squawk_threads st ON ((st.id = sm.thread_id)))
  WHERE ((sm.id = squawk_message_receipts.message_id) AND ((sm.created_by = ( SELECT auth.uid() AS uid)) OR is_eig_admin() OR has_organization_role(st.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text])))))));
CREATE POLICY "users can update own squawk receipts" ON public."squawk_message_receipts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "authors can add draft squawk recipients" ON public."squawk_message_recipients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM squawk_messages sm
  WHERE ((sm.id = squawk_message_recipients.message_id) AND (sm.created_by = ( SELECT auth.uid() AS uid)) AND (sm.status = 'draft'::text)))));
CREATE POLICY "senders and direct users can see squawk recipients" ON public."squawk_message_recipients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR app_private.can_view_squawk_recipient_list(message_id)));
CREATE POLICY "pilots can review squawk messages" ON public."squawk_message_reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((reviewed_by = ( SELECT auth.uid() AS uid)) AND (((reviewer_role = 'eig_admin'::text) AND is_eig_admin()) OR ((reviewer_role = 'organization_admin'::text) AND (EXISTS ( SELECT 1
   FROM (squawk_messages sm
     JOIN squawk_threads st ON ((st.id = sm.thread_id)))
  WHERE ((sm.id = squawk_message_reviews.message_id) AND has_organization_role(st.organization_id, ARRAY['organization_admin'::text]))))))));
CREATE POLICY "scoped users can see squawk reviews" ON public."squawk_message_reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((reviewed_by = ( SELECT auth.uid() AS uid)) OR is_eig_admin() OR (EXISTS ( SELECT 1
   FROM (squawk_messages sm
     JOIN squawk_threads st ON ((st.id = sm.thread_id)))
  WHERE ((sm.id = squawk_message_reviews.message_id) AND (has_organization_role(st.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((st.event_id IS NOT NULL) AND is_event_assigned(st.event_id))))))));
CREATE POLICY "authors can update their draft squawk notices" ON public."squawk_messages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((created_by = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::text))) WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::text)));
CREATE POLICY "relevant users can see squawk message notices" ON public."squawk_messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((created_by = ( SELECT auth.uid() AS uid)) OR is_eig_admin() OR (EXISTS ( SELECT 1
   FROM squawk_message_recipients sr
  WHERE ((sr.message_id = squawk_messages.id) AND (sr.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM squawk_threads st
  WHERE ((st.id = squawk_messages.thread_id) AND (has_organization_role(st.organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((st.event_id IS NOT NULL) AND is_event_assigned(st.event_id)) OR (EXISTS ( SELECT 1
           FROM squawk_thread_participants stp
          WHERE ((stp.thread_id = st.id) AND (stp.user_id = ( SELECT auth.uid() AS uid)))))))))));
CREATE POLICY "thread users can create squawk message notices" ON public."squawk_messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::text) AND (EXISTS ( SELECT 1
   FROM squawk_threads st
  WHERE (st.id = squawk_messages.thread_id)))));
CREATE POLICY "scoped managers can create recipient preferences" ON public."squawk_recipient_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((updated_by = ( SELECT auth.uid() AS uid)) AND (is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((registration_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM golf_registrations gr
  WHERE ((gr.id = squawk_recipient_preferences.registration_id) AND is_event_assigned(gr.event_id))))))));
CREATE POLICY "scoped managers can update recipient preferences" ON public."squawk_recipient_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((registration_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM golf_registrations gr
  WHERE ((gr.id = squawk_recipient_preferences.registration_id) AND is_event_assigned(gr.event_id))))))) WITH CHECK (((updated_by = ( SELECT auth.uid() AS uid)) AND (is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((registration_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM golf_registrations gr
  WHERE ((gr.id = squawk_recipient_preferences.registration_id) AND is_event_assigned(gr.event_id))))))));
CREATE POLICY "scoped users can read recipient preferences" ON public."squawk_recipient_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((registration_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM golf_registrations gr
  WHERE ((gr.id = squawk_recipient_preferences.registration_id) AND is_event_assigned(gr.event_id)))))));
CREATE POLICY "managers can create squawk templates" ON public."squawk_templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (((organization_id IS NULL) AND is_eig_admin()) OR ((organization_id IS NOT NULL) AND (is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text]))))));
CREATE POLICY "managers can update squawk templates" ON public."squawk_templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_eig_admin() OR ((organization_id IS NOT NULL) AND has_organization_role(organization_id, ARRAY['organization_admin'::text])))) WITH CHECK ((is_eig_admin() OR ((organization_id IS NOT NULL) AND has_organization_role(organization_id, ARRAY['organization_admin'::text]))));
CREATE POLICY "relevant users can read active squawk templates" ON public."squawk_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active AND ((organization_id IS NULL) OR is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]))));
CREATE POLICY "Users can see own direct thread participation" ON public."squawk_thread_participants" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "authorized users can create squawk threads" ON public."squawk_threads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((event_id IS NOT NULL) AND is_event_assigned(event_id)))));
CREATE POLICY "relevant users can see squawk thread metadata" ON public."squawk_threads" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_eig_admin() OR has_organization_role(organization_id, ARRAY['organization_admin'::text, 'organization_staff'::text]) OR ((event_id IS NOT NULL) AND is_event_assigned(event_id)) OR (EXISTS ( SELECT 1
   FROM squawk_thread_participants stp
  WHERE ((stp.thread_id = squawk_threads.id) AND (stp.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "anon read team_registrations" ON public."team_registrations" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write team_registrations" ON public."team_registrations" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
CREATE POLICY "anon read volunteers" ON public."volunteers" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon write volunteers" ON public."volunteers" AS PERMISSIVE FOR ALL TO "anon" USING (true) WITH CHECK (true);
