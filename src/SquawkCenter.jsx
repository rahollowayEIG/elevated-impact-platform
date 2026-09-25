import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

const SquawkContext = createContext(null);

const FALLBACK_TEMPLATES = {
  payment_reminder: {
    subject: 'Registration payment reminder',
    message: 'Hi {{first_name}}, your registration balance for {{event_name}} is still open. Use the secure payment link below to complete payment.\n\n{{payment_link}}',
  },
  invoice: {
    subject: 'Invoice for {{event_name}}',
    message: 'Hi {{first_name}}, your invoice for {{event_name}} is ready. You can review it and submit payment using the link below.\n\n{{invoice_link}}',
  },
  registration_confirmation: {
    subject: 'You are registered for {{event_name}}',
    message: 'Hi {{first_name}}, your registration for {{event_name}} is confirmed. We will keep you updated as the event gets closer.',
  },
  event_update: {
    subject: 'Update for {{event_name}}',
    message: 'Hi {{first_name}}, we have an update for {{event_name}}:\n\n',
  },
};

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  return name && domain ? `${name.slice(0, 2)}***@${domain}` : null;
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `***-***-${digits.slice(-4)}` : null;
}

async function readFunctionError(error, fallback) {
  try {
    const details = await error.context?.json();
    return details?.error || error.message || fallback;
  } catch {
    return error?.message || fallback;
  }
}

function GlobalSquawkDrawer({ organization, messages, currentRole, onMarkRead, onReview, actionError, onCompose, onClose }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const unreadCount = messages.filter((message) => !message.read).length;
  const filteredMessages = messages.filter((message) => {
    if (activeFilter === 'unread') return !message.read;
    if (activeFilter === 'restricted') return message.restricted;
    return true;
  });
  const canReview = ['eig_admin', 'organization_admin'].includes(currentRole);

  return <div className="global-squawk-layer" role="dialog" aria-modal="true" aria-label="Squawk Box">
    <button className="global-squawk-backdrop" aria-label="Close Squawk Box" onClick={onClose} />
    <aside className="global-squawk-drawer">
      <div className="global-squawk-heading">
        <div><p className="platform-eyebrow">ElevationPilot Communications</p><h2>Squawk Box</h2><span>{organization?.name || 'All permitted workspaces'}</span></div>
        <button className="global-squawk-close" onClick={onClose} aria-label="Close Squawk Box">×</button>
      </div>

      <div className="review-actions squawk-drawer-actions">
        <button className="platform-primary-button" type="button" onClick={onCompose}>+ New Squawk</button>
      </div>

      <div className="global-squawk-filters">
        <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>All Permitted</button>
        <button className={activeFilter === 'unread' ? 'active' : ''} onClick={() => setActiveFilter('unread')}>Unread {unreadCount ? `(${unreadCount})` : ''}</button>
        <button className={activeFilter === 'restricted' ? 'active' : ''} onClick={() => setActiveFilter('restricted')}>Restricted</button>
      </div>

      {actionError && <div className="platform-error global-squawk-action-error">{actionError}</div>}

      {filteredMessages.length ? <div className="global-squawk-list">
        {filteredMessages.map((message) => <article key={message.id} className={`global-squawk-message ${message.restricted ? 'restricted' : ''}`}>
          <div className="global-squawk-message-top">
            <span>{message.contextLabel}</span>
            {message.reviewed ? <b className="reviewed">{message.reviewedLabel}</b> : !message.read && <b>Unread</b>}
          </div>
          <h3>{message.restricted ? `${message.requiredRole} Message · Restricted` : message.subject}</h3>
          <p>{message.restricted ? `${message.requiredRole} or another authorized user must review this message.` : message.preview}</p>
          <div className="global-squawk-message-footer">
            <small>{message.sentAt}</small>
            <div className="global-squawk-message-actions">
              {!message.read && !message.restricted && <button onClick={() => onMarkRead(message.id)}>Mark Read</button>}
              {message.requiresReview && !message.reviewed && canReview && <button className="review" onClick={() => onReview(message.id)}>Review as {currentRole === 'eig_admin' ? 'EIG' : 'Pilot'}</button>}
              {message.requiresReview && !message.reviewed && !canReview && <span>Pilot review required</span>}
            </div>
          </div>
        </article>)}
      </div> : <div className="global-squawk-empty">
        <div className="global-squawk-radio">SB</div>
        <h3>{messages.length ? 'No matching Squawks' : 'No Squawks yet'}</h3>
        <p>{messages.length ? 'Choose another filter to see your permitted messages.' : 'Hangar and event Squawks will appear here.'}</p>
      </div>}

      <div className="global-squawk-permission-note">
        <strong>Permission aware</strong>
        <span>Internal Pilot and ATC messages stay internal. Only Squawks explicitly marked for the Event Hub can appear publicly.</span>
      </div>
    </aside>
  </div>;
}

function SquawkWorkspace({ organization, golfEvents, initialEventId = '', onClose }) {
  const [workspaceTab, setWorkspaceTab] = useState('compose');
  const [channel, setChannel] = useState('email');
  const [audience, setAudience] = useState('all_passengers');
  const [eventId, setEventId] = useState(initialEventId || golfEvents[0]?.id || '');
  const [templateKey, setTemplateKey] = useState('event_update');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState(FALLBACK_TEMPLATES.event_update.subject);
  const [message, setMessage] = useState(FALLBACK_TEMPLATES.event_update.message);
  const [smsMessage, setSmsMessage] = useState('{{event_name}} update: ');
  const [hubVisible, setHubVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [recipientPreferences, setRecipientPreferences] = useState(new Map());
  const [selectedRecipientIds, setSelectedRecipientIds] = useState(new Set());
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [connections, setConnections] = useState([]);
  const [history, setHistory] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sendResult, setSendResult] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (initialEventId) setEventId(initialEventId);
  }, [initialEventId]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      if (!organization?.id) return;
      setWorkspaceLoading(true);
      const [templateResult, connectionResult, threadResult] = await Promise.all([
        supabase.from('squawk_templates')
          .select('id,name,description,message_kind,channel_options,subject_template,body_template,email_template,sms_template,merge_fields,audience_key,is_system')
          .eq('is_active', true)
          .or(`organization_id.is.null,organization_id.eq.${organization.id}`)
          .order('is_system', { ascending: false })
          .order('name'),
        supabase.from('squawk_channel_connections')
          .select('channel,provider,connection_status,compliance_status,sender_label,sender_masked,last_verified_at')
          .eq('organization_id', organization.id),
        supabase.from('squawk_threads').select('id,context_label,event_id').eq('organization_id', organization.id),
      ]);
      if (cancelled) return;
      setTemplates(templateResult.data || []);
      setConnections(connectionResult.data || []);

      if (!threadResult.error && threadResult.data?.length) {
        const threadMap = new Map(threadResult.data.map((thread) => [thread.id, thread]));
        const { data: rows } = await supabase.from('squawk_messages')
          .select('id,thread_id,created_by,message_kind,audience_key,channels,status,sent_at,created_at,updated_at,metadata,squawk_message_content(subject,body,email_body,sms_body),squawk_message_recipients(id,channel,delivery_status)')
          .in('thread_id', threadResult.data.map((thread) => thread.id))
          .order('updated_at', { ascending: false })
          .limit(100);

        if (!cancelled) setHistory((rows || []).map((row) => {
          const content = Array.isArray(row.squawk_message_content) ? row.squawk_message_content[0] : row.squawk_message_content;
          return {
            ...row,
            contextLabel: threadMap.get(row.thread_id)?.context_label || 'ElevationPilot',
            subject: content?.subject || 'Restricted Squawk',
            body: content?.body || '',
            recipientCount: row.squawk_message_recipients?.length || 0,
          };
        }));
      } else setHistory([]);
      setWorkspaceLoading(false);
    }
    loadWorkspace();
    return () => { cancelled = true; };
  }, [organization?.id, refreshKey]);

  useEffect(() => {
    if (templateId || !templates.length) return;
    const initialTemplate = templates.find((template) => template.message_kind === 'event_update') || templates[0];
    if (!initialTemplate) return;
    setTemplateId(initialTemplate.id);
    setTemplateKey(initialTemplate.message_kind);
    setSubject(initialTemplate.subject_template || '');
    setMessage(initialTemplate.email_template || initialTemplate.body_template || '');
    setSmsMessage(initialTemplate.sms_template || initialTemplate.body_template || '');
    if (initialTemplate.audience_key) setAudience(initialTemplate.audience_key);
  }, [templates, templateId]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecipients() {
      if (!eventId) {
        setRecipients([]);
        setSelectedRecipientIds(new Set());
        return;
      }
      setLoadingRecipients(true);
      setRecipientError('');
      const { data, error } = await supabase.from('golf_registrations')
        .select('id,event_id,event_name,first_name,last_name,email,phone,price,amount_paid,payment_status,registration_status')
        .eq('event_id', eventId)
        .order('last_name')
        .order('first_name');

      if (cancelled) return;
      if (error) {
        setRecipientError(error.message);
        setRecipients([]);
        setRecipientPreferences(new Map());
        setSelectedRecipientIds(new Set());
      } else {
        const rows = (data || []).filter((row) => (row.registration_status || 'active') === 'active');
        setRecipients(rows);
        if (rows.length) {
          const { data: preferenceRows } = await supabase.from('squawk_recipient_preferences')
            .select('registration_id,email_status,sms_status,do_not_contact')
            .eq('organization_id', organization.id)
            .in('registration_id', rows.map((recipient) => recipient.id));
          if (!cancelled) setRecipientPreferences(new Map((preferenceRows || []).map((preference) => [preference.registration_id, preference])));
        } else setRecipientPreferences(new Map());
      }
      setLoadingRecipients(false);
    }
    loadRecipients();
    return () => { cancelled = true; };
  }, [eventId, organization?.id]);

  const eligibleRecipients = useMemo(() => recipients.filter((recipient) => {
    const paymentStatus = String(recipient.payment_status || '').toLowerCase();
    const hasOpenBalance = !['paid', 'comp'].includes(paymentStatus) && Number(recipient.amount_paid || 0) < Number(recipient.price || 0);
    if (audience === 'passengers_open_balance' && !hasOpenBalance) return false;
    if (audience !== 'passengers_open_balance' && audience !== 'all_passengers') return false;
    if (recipientPreferences.get(recipient.id)?.do_not_contact) return false;
    if (channel === 'email') return Boolean(recipient.email);
    if (channel === 'sms') return Boolean(recipient.phone);
    if (channel === 'both') return Boolean(recipient.email || recipient.phone);
    if (channel === 'in_app') return true;
    return false;
  }), [recipients, recipientPreferences, audience, channel]);

  useEffect(() => {
    setSelectedRecipientIds(new Set());
    setSaved(false);
    setSavedDraftId('');
  }, [eventId, audience, channel]);

  function toggleRecipient(id) {
    setSaved(false);
    setSelectedRecipientIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllRecipients() {
    setSaved(false);
    setSelectedRecipientIds((current) => current.size === eligibleRecipients.length
      ? new Set()
      : new Set(eligibleRecipients.map((recipient) => recipient.id)));
  }

  function applyTemplate(key) {
    const databaseTemplate = templates.find((item) => item.id === key);
    if (databaseTemplate) {
      setTemplateId(databaseTemplate.id);
      setTemplateKey(databaseTemplate.message_kind);
      setSubject(databaseTemplate.subject_template || '');
      setMessage(databaseTemplate.email_template || databaseTemplate.body_template || '');
      setSmsMessage(databaseTemplate.sms_template || databaseTemplate.body_template || '');
      if (databaseTemplate.audience_key) setAudience(databaseTemplate.audience_key);
    } else {
      const template = FALLBACK_TEMPLATES[key] || FALLBACK_TEMPLATES.event_update;
      setTemplateId('');
      setTemplateKey(key);
      setSubject(template.subject);
      setMessage(template.message);
      setSmsMessage(template.message);
    }
    setSaved(false);
    setSavedDraftId('');
    setSaveError('');
  }

  async function saveDraft() {
    setSaveError('');
    setSendResult('');
    setSaved(false);
    setSaving(true);

    const selected = eligibleRecipients.filter((recipient) => selectedRecipientIds.has(recipient.id));
    const channels = channel === 'both' ? ['email', 'sms'] : [channel];
    const recipientRows = selected.flatMap((recipient) => channels.flatMap((deliveryChannel) => {
      if (deliveryChannel === 'email' && recipient.email) return [{
        registration_id: recipient.id,
        recipient_type: 'passenger',
        channel: 'email',
        destination_masked: maskEmail(recipient.email),
      }];
      if (deliveryChannel === 'sms' && recipient.phone) return [{
        registration_id: recipient.id,
        recipient_type: 'passenger',
        channel: 'sms',
        destination_masked: maskPhone(recipient.phone),
      }];
      if (deliveryChannel === 'in_app') return [{
        registration_id: recipient.id,
        recipient_type: 'passenger',
        channel: 'in_app',
        destination_masked: null,
      }];
      return [];
    }));

    const selectedEvent = golfEvents.find((event) => event.id === eventId);
    const { data, error } = await supabase.rpc('create_squawk_draft', {
      p_organization_id: organization.id,
      p_event_id: eventId || null,
      p_context_label: selectedEvent?.name || `${organization.name} Cockpit`,
      p_message_kind: templateKey || 'message',
      p_visibility: 'all_relevant',
      p_required_roles: [],
      p_safe_label: subject || 'Squawk Box message',
      p_requires_review: ['invoice', 'payment_reminder'].includes(templateKey),
      p_subject: subject || null,
      p_body: message,
      p_email_body: message,
      p_sms_body: smsMessage,
      p_audience_key: audience,
      p_channels: channels,
      p_template_id: templateId || null,
      p_recipients: recipientRows,
    });

    if (error) {
      setSaveError(error.message || 'The Squawk draft could not be saved.');
      setSaving(false);
      return null;
    }

    if (hubVisible) {
      const { data: messageRow } = await supabase.from('squawk_messages').select('metadata').eq('id', data).maybeSingle();
      const { error: metadataError } = await supabase.from('squawk_messages')
        .update({ metadata: { ...(messageRow?.metadata || {}), hub_visible: true } })
        .eq('id', data);
      if (metadataError) {
        setSaveError('The draft saved, but the Event Hub flag could not be saved.');
        setSaving(false);
        return data;
      }
    }

    setSaved(true);
    setSavedDraftId(data);
    setRefreshKey((value) => value + 1);
    setSaving(false);
    return data;
  }

  async function sendEmailSquawk() {
    setSaveError('');
    setSendResult('');
    setSending(true);
    try {
      const draftId = saved && savedDraftId ? savedDraftId : await saveDraft();
      if (!draftId) return;
      const { data, error } = await supabase.functions.invoke('send-squawk-email', { body: { message_id: draftId } });
      if (error) throw new Error(await readFunctionError(error, 'The email could not be sent.'));
      if (!data?.success) throw new Error(data?.error || 'The email could not be sent.');
      setSendResult(`${data.sent_count} email${data.sent_count === 1 ? '' : 's'} sent successfully.${hubVisible ? ' The update is also live on the Event Hub.' : ''}`);
      setSaved(false);
      setSavedDraftId('');
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The email could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function publishInAppSquawk() {
    setSaveError('');
    setSendResult('');
    setSending(true);
    try {
      const draftId = saved && savedDraftId ? savedDraftId : await saveDraft();
      if (!draftId) return;
      const { data, error } = await supabase.functions.invoke('publish-squawk', { body: { message_id: draftId } });
      if (error) throw new Error(await readFunctionError(error, 'The Squawk could not be published.'));
      if (!data?.success) throw new Error(data?.error || 'The Squawk could not be published.');
      setSendResult(hubVisible ? 'Squawk published in-app and to the Event Hub.' : 'In-app Squawk published.');
      setSaved(false);
      setSavedDraftId('');
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The Squawk could not be published.');
    } finally {
      setSending(false);
    }
  }

  const draftMessages = history.filter((item) => item.status === 'draft' && item.body);
  const sentMessages = history.filter((item) => !['draft', 'cancelled', 'archived'].includes(item.status));
  const emailConnection = connections.find((item) => item.channel === 'email');
  const smsConnection = connections.find((item) => item.channel === 'sms');
  const selectedEvent = golfEvents.find((event) => event.id === eventId);
  const canHubPublish = audience === 'all_passengers' && Boolean(eventId);

  return <div className="squawk-workspace-layer" role="dialog" aria-modal="true" aria-label="Squawk Box Workspace">
    <button className="global-squawk-backdrop" aria-label="Close Squawk Box" onClick={onClose} />
    <section className="platform-section-card squawk-box squawk-workspace-modal">
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">ElevationPilot Communications</p><h2>Squawk Box</h2><p>One communication layer for the Hangar, ATC, registered passengers, and the Event Hub.</p></div>
        <button className="platform-secondary-button" onClick={onClose}>Close</button>
      </div>

      <div className="squawk-workspace-tabs" role="tablist" aria-label="Squawk Box workspace">
        <button className={workspaceTab === 'compose' ? 'active' : ''} onClick={() => setWorkspaceTab('compose')}>Compose</button>
        <button className={workspaceTab === 'drafts' ? 'active' : ''} onClick={() => setWorkspaceTab('drafts')}>Drafts <span>{draftMessages.length}</span></button>
        <button className={workspaceTab === 'sent' ? 'active' : ''} onClick={() => setWorkspaceTab('sent')}>Sent <span>{sentMessages.length}</span></button>
        <button className={workspaceTab === 'templates' ? 'active' : ''} onClick={() => setWorkspaceTab('templates')}>Templates <span>{templates.length}</span></button>
      </div>

      {workspaceTab === 'compose' ? <div className="squawk-layout">
        <div className="squawk-composer">
          <div className="form-grid two">
            <label>Event context
              <select value={eventId} onChange={(e) => { setEventId(e.target.value); setSaved(false); }}>
                <option value="">Select an event</option>
                {golfEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <label>Audience
              <select value={audience} onChange={(e) => { setAudience(e.target.value); setSaved(false); if (e.target.value !== 'all_passengers') setHubVisible(false); }}>
                <option value="all_passengers">All registered passengers</option>
                <option value="passengers_open_balance">Passengers with open balances</option>
                <option value="atc_crew">ATC and Crew</option>
                <option value="sponsors">Sponsors</option>
                <option value="volunteers">Volunteers</option>
              </select>
            </label>
            <label>Channel
              <select value={channel} onChange={(e) => { setChannel(e.target.value); setSaved(false); }}>
                <option value="email">Email</option>
                <option value="in_app">In-app Squawk</option>
                <option value="sms">Text message</option>
                <option value="both">Email + text</option>
              </select>
            </label>
            <label>Message template
              <select value={templateId || templateKey} onChange={(e) => applyTemplate(e.target.value)}>
                {templates.length ? templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>) : <>
                  <option value="event_update">Event update</option>
                  <option value="payment_reminder">Registration payment reminder</option>
                  <option value="invoice">Invoice and payment link</option>
                  <option value="registration_confirmation">Registration confirmation</option>
                </>}
              </select>
            </label>
          </div>

          {channel !== 'sms' && <label>Subject<input value={subject} onChange={(e) => { setSubject(e.target.value); setSaved(false); }} /></label>}
          {channel !== 'sms' && <label>{channel === 'in_app' ? 'In-app message' : 'Email message'}<textarea rows="7" value={message} onChange={(e) => { setMessage(e.target.value); setSaved(false); }} /></label>}
          {['sms', 'both'].includes(channel) && <label>Text message<textarea rows="4" value={smsMessage} onChange={(e) => { setSmsMessage(e.target.value); setSaved(false); }} /></label>}

          <div className="squawk-token-list">
            <span>Merge fields:</span><code>{'{{first_name}}'}</code><code>{'{{event_name}}'}</code><code>{'{{payment_link}}'}</code><code>{'{{invoice_link}}'}</code>
          </div>

          <label className={`squawk-hub-toggle ${canHubPublish ? '' : 'disabled'}`}>
            <input type="checkbox" checked={hubVisible} disabled={!canHubPublish} onChange={(e) => { setHubVisible(e.target.checked); setSaved(false); }} />
            <span><strong>Show this Squawk on the Event Hub</strong><small>Only available for “All registered passengers.” Internal ATC/Pilot messages can never be exposed by this control.</small></span>
          </label>

          <div className="squawk-recipient-panel">
            <div className="squawk-recipient-heading">
              <div><p className="platform-eyebrow">Recipient Preview</p><h3>{selectedRecipientIds.size} of {eligibleRecipients.length} selected</h3></div>
              <button className="platform-secondary-button" type="button" onClick={toggleAllRecipients} disabled={!eligibleRecipients.length}>{selectedRecipientIds.size === eligibleRecipients.length && eligibleRecipients.length ? 'Clear All' : 'Select All'}</button>
            </div>

            {loadingRecipients ? <p className="platform-login-copy">Loading Registration recipients...</p>
              : recipientError ? <div className="platform-error">{recipientError}</div>
              : !eventId ? <p className="platform-login-copy">Select an event to preview recipients.</p>
              : !eligibleRecipients.length ? <p className="platform-login-copy">No recipients match this audience and channel.</p>
              : <div className="squawk-recipient-list">{eligibleRecipients.map((recipient) => {
                const balance = Math.max(Number(recipient.price || 0) - Number(recipient.amount_paid || 0), 0);
                return <label key={recipient.id} className="squawk-recipient-row">
                  <input type="checkbox" checked={selectedRecipientIds.has(recipient.id)} onChange={() => toggleRecipient(recipient.id)} />
                  <span><strong>{recipient.first_name} {recipient.last_name}</strong><small>{recipient.email || 'No email'} · {recipient.phone || 'No phone'}</small></span>
                  <span className={balance > 0 ? 'balance open' : 'balance paid'}>{balance > 0 ? `$${balance.toFixed(2)} due` : 'Paid'}</span>
                </label>;
              })}</div>}
          </div>

          {saveError && <div className="platform-error">{saveError}</div>}
          {sendResult && <div className="squawk-notice">{sendResult}</div>}

          <div className="review-actions">
            <button className="platform-secondary-button" onClick={saveDraft} disabled={saving || sending || !eventId || !message.trim()}>{saving ? 'Saving...' : 'Save Draft'}</button>
            {channel === 'email' && <button className="platform-primary-button" onClick={sendEmailSquawk} disabled={saving || sending || emailConnection?.connection_status !== 'connected' || !eventId || !message.trim() || selectedRecipientIds.size === 0}>{sending ? 'Sending...' : 'Send Email'}</button>}
            {channel === 'in_app' && <button className="platform-primary-button" onClick={publishInAppSquawk} disabled={saving || sending || !eventId || !message.trim()}>{sending ? 'Publishing...' : hubVisible ? 'Publish In-App + Hub' : 'Publish In-App'}</button>}
            {channel === 'sms' && <button className="platform-primary-button" disabled title="SMS delivery is not connected yet">Text Delivery Not Connected</button>}
            {channel === 'both' && <button className="platform-primary-button" disabled title="Combined delivery will unlock when SMS is connected">Email + Text Not Ready</button>}
            {saved && <span className="squawk-saved">Draft saved · {savedDraftId.slice(0, 8)}</span>}
          </div>
        </div>

        <aside className="squawk-side">
          <p className="platform-eyebrow">Current Context</p>
          <h3>{selectedEvent?.name || 'Select an event'}</h3>
          <ul>
            <li className={eventId ? 'ready' : ''}>Event context</li>
            <li className={recipients.length ? 'ready' : ''}>Registration recipients</li>
            <li className={emailConnection?.connection_status === 'connected' ? 'ready' : ''}>Email: {emailConnection?.connection_status?.replaceAll('_', ' ') || 'setup required'}</li>
            <li className={smsConnection?.connection_status === 'connected' && smsConnection?.compliance_status === 'approved' ? 'ready' : ''}>SMS: {smsConnection?.compliance_status?.replaceAll('_', ' ') || 'not connected'}</li>
            <li className={hubVisible ? 'ready' : ''}>Event Hub: {hubVisible ? 'included' : 'not included'}</li>
          </ul>
          <div className="squawk-history"><strong>One message, many doors</strong><p>The same Squawk can be delivered by email and displayed on the Event Hub without creating a separate announcement record.</p></div>
        </aside>
      </div> : <div className="squawk-library-panel">
        {workspaceLoading ? <p className="platform-login-copy">Loading Squawk records...</p>
          : workspaceTab === 'templates' ? <div className="squawk-template-grid">{templates.map((template) => <button key={template.id} className="squawk-template-card" onClick={() => { applyTemplate(template.id); setWorkspaceTab('compose'); }}><span>{template.is_system ? 'EIG System Template' : 'Hangar Template'}</span><strong>{template.name}</strong><p>{template.description}</p><small>{template.channel_options.join(' + ')}</small></button>)}</div>
          : <div className="squawk-record-list">{(workspaceTab === 'drafts' ? draftMessages : sentMessages).length
            ? (workspaceTab === 'drafts' ? draftMessages : sentMessages).map((item) => <article key={item.id} className="squawk-record-row"><div><span>{item.contextLabel} · {item.channels?.join(' + ')}</span><h3>{item.subject}</h3><p>{item.body.slice(0, 150)}{item.body.length > 150 ? '…' : ''}</p></div><div><b className={`squawk-record-status ${item.status}`}>{item.status.replaceAll('_', ' ')}</b><small>{item.recipientCount} delivery record(s)</small><small>{item.metadata?.hub_visible ? 'Event Hub ✓' : ''}</small><small>{new Date(item.sent_at || item.updated_at || item.created_at).toLocaleString()}</small></div></article>)
            : <div className="empty-state"><strong>No {workspaceTab} Squawks yet.</strong><span>Saved drafts and completed delivery records will appear here.</span></div>}
          </div>}
      </div>}
    </section>
  </div>;
}

export function SquawkProvider({ user, organization, role, events = [], children }) {
  const [mode, setMode] = useState('');
  const [initialEventId, setInitialEventId] = useState('');
  const [messages, setMessages] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadSquawks() {
      if (!organization?.id || !user?.id) {
        setMessages([]);
        return;
      }
      const { data: threads, error: threadError } = await supabase.from('squawk_threads')
        .select('id,organization_id,event_id,context_type,context_label')
        .eq('organization_id', organization.id);

      if (cancelled || threadError || !threads?.length) {
        if (!cancelled) setMessages([]);
        return;
      }

      const threadMap = new Map(threads.map((thread) => [thread.id, thread]));
      const { data: rows, error } = await supabase.from('squawk_messages')
        .select('id,thread_id,message_kind,visibility,required_roles,safe_label,requires_review,status,sent_at,created_at,reviewed_at,squawk_message_content(subject,body),squawk_message_receipts(user_id,read_at),squawk_message_reviews(reviewed_at,reviewer_role,reviewed_by)')
        .in('thread_id', threads.map((thread) => thread.id))
        .in('status', ['queued', 'sent', 'partially_sent', 'failed'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (cancelled || error) {
        if (!cancelled) setMessages([]);
        return;
      }

      setMessages((rows || []).map((message) => {
        const thread = threadMap.get(message.thread_id);
        const content = Array.isArray(message.squawk_message_content) ? message.squawk_message_content[0] : message.squawk_message_content;
        const ownReceipt = (message.squawk_message_receipts || []).find((receipt) => receipt.user_id === user.id);
        const review = Array.isArray(message.squawk_message_reviews) ? message.squawk_message_reviews[0] : message.squawk_message_reviews;
        const restricted = !content;
        const reviewed = Boolean(review?.reviewed_at || message.reviewed_at);
        return {
          id: message.id,
          eventId: thread?.event_id || '',
          contextLabel: thread?.context_label || 'ElevationPilot',
          subject: content?.subject || message.safe_label,
          preview: content?.body?.slice(0, 180) || '',
          restricted,
          requiredRole: message.required_roles?.length ? message.required_roles.map((value) => value.replaceAll('_', ' ')).join(' / ') : 'Authorized',
          requiresReview: message.requires_review,
          read: Boolean(ownReceipt?.read_at || reviewed),
          reviewed,
          reviewedLabel: review?.reviewer_role === 'eig_admin' ? 'Reviewed by EIG' : 'Reviewed by Pilot',
          sentAt: new Date(message.sent_at || message.created_at).toLocaleString(),
        };
      }));
    }

    loadSquawks();
    return () => { cancelled = true; };
  }, [organization?.id, user?.id, mode, refresh]);

  async function markRead(messageId, reviewedAt = null) {
    setActionError('');
    const now = new Date().toISOString();
    const receipt = { message_id: messageId, user_id: user.id, read_at: now };
    if (reviewedAt) receipt.reviewed_at = reviewedAt;
    const { error } = await supabase.from('squawk_message_receipts').upsert(receipt, { onConflict: 'message_id,user_id' });
    if (error) {
      setActionError('That Squawk could not be updated.');
      return false;
    }
    setRefresh((value) => value + 1);
    return true;
  }

  async function reviewMessage(messageId) {
    setActionError('');
    const reviewedAt = new Date().toISOString();
    const reviewerRole = role === 'eig_admin' ? 'eig_admin' : 'organization_admin';
    const { error } = await supabase.from('squawk_message_reviews').insert({
      message_id: messageId,
      reviewed_by: user.id,
      reviewer_role: reviewerRole,
      reviewed_at: reviewedAt,
    });
    if (error && error.code !== '23505') {
      setActionError('The Pilot review could not be recorded.');
      return;
    }
    await markRead(messageId, reviewedAt);
  }

  const unreadCount = messages.filter((message) => !message.read).length;
  const value = {
    unreadCount,
    openInbox: () => setMode('inbox'),
    openComposer: (eventId = '') => { setInitialEventId(eventId); setMode('compose'); },
    closeSquawk: () => setMode(''),
  };

  return <SquawkContext.Provider value={value}>
    {children}
    {mode === 'inbox' && <GlobalSquawkDrawer
      organization={organization}
      messages={messages}
      currentRole={role}
      onMarkRead={markRead}
      onReview={reviewMessage}
      actionError={actionError}
      onCompose={() => setMode('compose')}
      onClose={() => setMode('')}
    />}
    {mode === 'compose' && <SquawkWorkspace
      organization={organization}
      golfEvents={events}
      initialEventId={initialEventId}
      onClose={() => { setMode(''); setRefresh((value) => value + 1); }}
    />}
  </SquawkContext.Provider>;
}

export function useSquawk() {
  return useContext(SquawkContext) || {
    unreadCount: 0,
    openInbox: () => {},
    openComposer: () => {},
    closeSquawk: () => {},
  };
}
