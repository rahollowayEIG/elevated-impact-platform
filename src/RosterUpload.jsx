import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import {
  buildRosterPreview,
  getMissingRequiredMappings,
  getRosterFieldOptions,
  inferRosterMapping,
  isEieRequiredRosterTemplate,
  mappingIsRequired,
  parseRosterFile
} from './rosterImport';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

function bytesLabel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileToBase64(file) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(binary);
  });
}

async function functionError(error, fallback) {
  try {
    const body = await error?.context?.json();
    if (body?.error) return body.error;
  } catch {
    // The Functions client may already have consumed the body.
  }
  return error?.message || fallback;
}

function statusLabel(entry) {
  if (entry.status === 'ready') return 'Ready';
  if (entry.status === 'duplicate') return 'Duplicate';
  return 'Needs review';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function requestableMissingFields(entry, event) {
  const fields = [];
  const golfer = entry?.golfer || {};
  const issues = new Set(entry?.issues || []);

  if (issues.has('Missing first name')) fields.push('first_name');
  if (issues.has('Missing last name')) fields.push('last_name');
  if (issues.has('Missing phone') && validEmail(golfer.email) && !golfer.phone) {
    fields.push('phone');
  }

  if (event?.fields?.dob === 'required' && !golfer.date_of_birth) fields.push('date_of_birth');
  if (event?.fields?.gender === 'required' && !golfer.gender) fields.push('gender');
  if (event?.fields?.division === 'required' && !golfer.division) fields.push('division');
  if (event?.fields?.membership === 'required' && issues.has('Missing club membership status')) fields.push('membership_status');
  if (event?.fields?.ghin === 'required' && !golfer.ghin_number) fields.push('ghin_number');

  (event?.customFields || []).forEach((field) => {
    if (
      field?.required &&
      issues.has(`Missing ${field.label}`)
    ) {
      fields.push(`custom:${field.id}`);
    }
  });

  return [...new Set(fields)];
}

export default function RosterUpload({
  open,
  onClose,
  event,
  existingRows,
  onImported
}) {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [sourceRows, setSourceRows] = useState([]);
  const [headerRowNumber, setHeaderRowNumber] = useState(1);
  const [mapping, setMapping] = useState([]);
  const [membershipDefault, setMembershipDefault] = useState('Member');
  const [paymentDefault, setPaymentDefault] = useState('pending');
  const [compReasonDefault, setCompReasonDefault] = useState('');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [summary, setSummary] = useState(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState(event?.googleSheetUrl || '');
  const [importSourceUrl, setImportSourceUrl] = useState('');
  const [sourceMode, setSourceMode] = useState('upload');
  const [sourceHash, setSourceHash] = useState('');
  const [requestingInfo, setRequestingInfo] = useState(false);
  const [requestNotice, setRequestNotice] = useState('');
  const [eieTemplate, setEieTemplate] = useState(false);

  const fieldOptions = useMemo(
    () => getRosterFieldOptions(event?.customFields || []),
    [event?.customFields]
  );

  const preview = useMemo(() => {
    if (!headers.length || !sourceRows.length) return [];

    return buildRosterPreview({
      headers,
      sourceRows,
      mapping,
      existingRows,
      defaults: {
        membership_status: membershipDefault,
        payment_status: paymentDefault,
        comp_reason: compReasonDefault,
        required_fields: event?.fields || {},
        custom_fields: event?.customFields || []
      },
      headerRowNumber
    });
  }, [
    headers,
    sourceRows,
    mapping,
    existingRows,
    membershipDefault,
    paymentDefault,
    compReasonDefault,
    headerRowNumber,
    event?.fields,
    event?.customFields
  ]);

  const missingRequiredMappings = useMemo(
    () => headers.length ? getMissingRequiredMappings(mapping, event) : [],
    [headers, mapping, event]
  );

  const readyCount = preview.filter((entry) => entry.status === 'ready').length;
  const duplicateCount = preview.filter((entry) => entry.status === 'duplicate').length;
  const reviewCount = preview.filter((entry) => entry.status === 'needs_review').length;
  const importableCount = readyCount + (allowDuplicates ? duplicateCount : 0);

  useEffect(() => {
    if (!open || !importSourceUrl || !headers.length) return undefined;

    let lastReloadAt = 0;

    const reloadWhenBack = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastReloadAt < 1200) return;
      lastReloadAt = now;
      reloadFromGoogle();
    };

    document.addEventListener('visibilitychange', reloadWhenBack);
    window.addEventListener('focus', reloadWhenBack);

    return () => {
      document.removeEventListener('visibilitychange', reloadWhenBack);
      window.removeEventListener('focus', reloadWhenBack);
    };
  }, [open, importSourceUrl, headers.length, event?.dbId, event?.id]);

  if (!open) return null;

  async function chooseFile(selected) {
    setNotice('');
    setSummary(null);
    setAllowDuplicates(false);

    if (!selected) {
      setFile(null);
      setHeaders([]);
      setSourceRows([]);
      setMapping([]);
      return;
    }

    if (selected.size > MAX_FILE_BYTES) {
      setNotice('Roster files must be 5 MB or smaller.');
      return;
    }

    const extension = selected.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx'].includes(extension)) {
      setNotice('Choose a CSV or XLSX roster file.');
      return;
    }

    setWorking(true);
    try {
      const parsed = await parseRosterFile(selected);
      if (parsed.rows.length > MAX_ROWS) {
        throw new Error(`This first import version supports up to ${MAX_ROWS} golfers per file.`);
      }

      const { data: sourceData, error: sourceError } = await supabase.functions.invoke('golf-import-roster', {
        body: {
          action: 'save_source_sheet',
          event_id: event.dbId,
          event_key: event.id,
          replace_source: true,
          source_sheet: {
            headers: parsed.headers,
            rows: parsed.rows
          }
        }
      });

      if (sourceError) {
        throw new Error(await functionError(sourceError, 'Unable to save the uploaded roster to Google Workspace.'));
      }
      if (!sourceData?.success) {
        throw new Error(sourceData?.error || 'Unable to save the uploaded roster to Google Workspace.');
      }

      setFile(selected);
      setSourceMode('upload');
      setHeaders(parsed.headers);
      setSourceRows(parsed.rows);
      setHeaderRowNumber(parsed.headerRowNumber);
      setMapping(inferRosterMapping(parsed.headers, event?.customFields || []));
      setEieTemplate(isEieRequiredRosterTemplate(parsed.headers, event));
      setGoogleSheetUrl(sourceData.google_sheet_url || '');
      setImportSourceUrl(sourceData.import_source_url || sourceData.google_sheet_url || '');
      setSourceHash(sourceData.source_hash || '');
      setNotice(
        `${parsed.rows.length} row${parsed.rows.length === 1 ? '' : 's'} loaded and saved to the event Google Workspace. Review the mapping and preview before importing.`
      );
    } catch (error) {
      setFile(null);
      setHeaders([]);
      setSourceRows([]);
      setMapping([]);
      setNotice(error instanceof Error ? error.message : 'Unable to read the roster file.');
    } finally {
      setWorking(false);
    }
  }

  function updateMapping(index, value) {
    setMapping((current) => current.map((entry, entryIndex) =>
      entryIndex === index ? value : entry
    ));
    setSummary(null);
  }

  async function saveSourceToGoogle() {
    if (!headers.length || !sourceRows.length || !supabase) return;

    setWorking(true);
    setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('golf-import-roster', {
        body: {
          action: 'save_source_sheet',
          event_id: event.dbId,
          event_key: event.id,
          source_sheet: {
            headers,
            rows: sourceRows
          }
        }
      });

      if (error) {
        throw new Error(await functionError(error, 'Unable to save the source sheet.'));
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Unable to save the source sheet.');
      }

      setGoogleSheetUrl(data.google_sheet_url || '');
      setImportSourceUrl(data.import_source_url || data.google_sheet_url || '');
      setNotice(`Source roster saved to Google Workspace with ${data.saved_count || sourceRows.length} row${(data.saved_count || sourceRows.length) === 1 ? '' : 's'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save the source sheet.');
    } finally {
      setWorking(false);
    }
  }

  async function reloadFromGoogle() {
    if (!supabase) return;

    setWorking(true);
    setNotice('');
    setSummary(null);
    setAllowDuplicates(false);

    try {
      const { data, error } = await supabase.functions.invoke('golf-import-roster', {
        body: {
          action: 'load_source_sheet',
          event_id: event.dbId,
          event_key: event.id
        }
      });

      if (error) {
        throw new Error(await functionError(error, 'Unable to reload the Google Sheet.'));
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Unable to reload the Google Sheet.');
      }

      const loadedHeaders = Array.isArray(data.headers) ? data.headers : [];
      const loadedRows = Array.isArray(data.rows) ? data.rows : [];

      if (!loadedHeaders.length) {
        throw new Error('The Import Source sheet does not have any headers yet.');
      }

      setHeaders(loadedHeaders);
      setSourceRows(loadedRows);
      setHeaderRowNumber(1);
      setMapping(inferRosterMapping(loadedHeaders, event?.customFields || []));
      setEieTemplate(isEieRequiredRosterTemplate(loadedHeaders, event));
      setSourceMode((current) =>
        current === 'required_roster_sheet' ? 'required_roster_sheet' : 'google_sheet'
      );
      setGoogleSheetUrl(data.google_sheet_url || '');
      setImportSourceUrl(data.import_source_url || data.google_sheet_url || '');
      setSourceHash(data.source_hash || '');
      setNotice(`${loadedRows.length} row${loadedRows.length === 1 ? '' : 's'} reloaded from the Google Import Source sheet. Review the preview before importing.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to reload the Google Sheet.');
    } finally {
      setWorking(false);
    }
  }

  async function loadRequiredRosterSheet() {
    if (!supabase) return;

    setWorking(true);
    setNotice('');
    setSummary(null);
    setAllowDuplicates(false);

    try {
      const { data, error } = await supabase.functions.invoke('golf-import-roster', {
        body: {
          action: 'load_required_roster_template',
          event_id: event.dbId,
          event_key: event.id
        }
      });

      if (error) {
        throw new Error(await functionError(error, 'Unable to load the EIE Required Roster Sheet.'));
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Unable to load the EIE Required Roster Sheet.');
      }

      const loadedHeaders = Array.isArray(data.headers) ? data.headers : [];
      const loadedRows = Array.isArray(data.rows) ? data.rows : [];

      if (!loadedHeaders.length) {
        throw new Error('The Required Roster Sheet does not have any headers yet.');
      }

      setFile(null);
      setHeaders(loadedHeaders);
      setSourceRows(loadedRows);
      setHeaderRowNumber(1);
      setMapping(inferRosterMapping(loadedHeaders, event?.customFields || []));
      setEieTemplate(true);
      setSourceMode('required_roster_sheet');
      setGoogleSheetUrl(data.google_sheet_url || '');
      setImportSourceUrl(data.import_source_url || data.google_sheet_url || '');
      setSourceHash(data.source_hash || '');
      setNotice(
        `${loadedRows.length} golfer row${loadedRows.length === 1 ? '' : 's'} loaded directly from the EIE Required Roster Sheet. Team blocks will carry into roster review as grouping hints. Review the preview before importing.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load the EIE Required Roster Sheet.');
    } finally {
      setWorking(false);
    }
  }

  function columnMapForRequests() {
    const result = {};
    mapping.forEach((field, index) => {
      if (field && headers[index]) result[field] = headers[index];
    });
    return result;
  }

  async function sendMissingInfoRequests(entries) {
    if (!supabase || !entries.length) return;

    const requests = entries
      .map((entry) => ({
        source_row: entry.source_row,
        email: entry.golfer.email,
        first_name: entry.golfer.first_name,
        last_name: entry.golfer.last_name,
        requested_fields: requestableMissingFields(entry, event)
      }))
      .filter((item) => validEmail(item.email) && item.requested_fields.length > 0);

    if (!requests.length) {
      setRequestNotice('None of these rows have a valid email address plus player-completable missing information.');
      return;
    }

    setRequestingInfo(true);
    setRequestNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('golf-roster-missing-info', {
        body: {
          action: 'request',
          event_id: event.dbId,
          event_key: event.id,
          app_origin: window.location.origin,
          column_map: columnMapForRequests(),
          requests
        }
      });

      if (error) {
        throw new Error(await functionError(error, 'Unable to send missing-information requests.'));
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Unable to send missing-information requests.');
      }

      setRequestNotice(
        `${data.sent_count || 0} missing-information request${data.sent_count === 1 ? '' : 's'} sent.${
          data.skipped_count ? ` ${data.skipped_count} row${data.skipped_count === 1 ? '' : 's'} could not be emailed.` : ''
        }`
      );
    } catch (error) {
      setRequestNotice(error instanceof Error ? error.message : 'Unable to send missing-information requests.');
    } finally {
      setRequestingInfo(false);
    }
  }

  async function importRoster() {
    if (!preview.length || importableCount === 0 || !supabase) return;
    if (sourceMode === 'upload' && !file) return;

    setWorking(true);
    setNotice('');
    setSummary(null);

    try {
      const base64 = sourceMode === 'upload' && file ? await fileToBase64(file) : '';
      const candidates = preview
        .filter((entry) => entry.status !== 'needs_review')
        .map((entry) => ({
          source_row: entry.source_row,
          golfer: entry.golfer
        }));

      const { data, error } = await supabase.functions.invoke('golf-import-roster', {
        body: {
          event_id: event.dbId,
          event_key: event.id,
          allow_duplicates: allowDuplicates,
          source_type: sourceMode,
          source_hash: sourceHash,
          source_sheet: {
            headers,
            rows: sourceRows
          },
          file: {
            name: file?.name || '',
            type: file?.type || (
              file?.name?.toLowerCase().endsWith('.csv')
                ? 'text/csv'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
            size: file?.size || 0,
            base64
          },
          rows: candidates
        }
      });

      if (error) {
        throw new Error(await functionError(error, 'Roster import could not be completed.'));
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Roster import could not be completed.');
      }

      const result = {
        imported_count: data.imported_count || 0,
        duplicate_count: data.duplicate_count || 0,
        invalid_count: reviewCount + (data.invalid_count || 0),
        file_saved: Boolean(data.file_path),
        sync_warning: data.sync_warning || null,
        google_sheet_url: data.google_sheet_url || '',
        import_source_url: data.import_source_url || ''
      };

      setSummary(result);
      if (result.google_sheet_url) setGoogleSheetUrl(result.google_sheet_url);
      if (result.import_source_url) setImportSourceUrl(result.import_source_url);
      setNotice(
        result.sync_warning ||
        `Import complete: ${result.imported_count} added, ${result.duplicate_count} duplicate${result.duplicate_count === 1 ? '' : 's'} skipped, ${result.invalid_count} need${result.invalid_count === 1 ? 's' : ''} review.`
      );

      if (onImported) await onImported();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Roster import could not be completed.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="card">
      <div className="event-summary" style={{ marginBottom: 18 }}>
        <div>
          <span className="section-kicker">Roster Maintenance</span>
          <h2>Upload Roster</h2>
          <p>
            Import an organizer-created CSV or XLSX roster. Nothing is added until you review the mapping and confirm the import.
          </p>
        </div>
      </div>

      <div
        className="message"
        style={{ marginBottom: 18 }}
      >
        <strong>Using the EIE Required Roster Sheet?</strong>{' '}
        Load it directly into roster review. No download and re-upload needed.
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="secondary"
            disabled={working}
            onClick={loadRequiredRosterSheet}
          >
            {working ? 'Loading…' : 'Load EIE Roster Sheet'}
          </button>
        </div>
      </div>

      <div className="grid two">
        <label className="field">
          <span>Roster file *</span>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={working}
            onChange={(event) => chooseFile(event.target.files?.[0] || null)}
          />
        </label>

        <div className="field">
          <span>Import limits</span>
          <div
            style={{
              padding: '13px 14px',
              border: '1.5px solid #8094aa',
              borderRadius: 11,
              minHeight: 48
            }}
          >
            CSV or XLSX · up to 5 MB · up to {MAX_ROWS} golfers
          </div>
        </div>
      </div>

      {file && (
        <p className="muted" style={{ marginBottom: 0 }}>
          {file.name} · {bytesLabel(file.size)}
        </p>
      )}

      {notice && (
        <div className="message" style={{ marginTop: 16 }}>
          {notice}
        </div>
      )}

      {headers.length > 0 && (
        <>
          <div style={{ marginTop: 22 }}>
            <span className="section-kicker">1. Match Columns</span>
            <h3 style={{ color: '#1D245D', marginBottom: 8 }}>Column Mapping</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              {eieTemplate
                ? 'EIE template recognized. Required fields are mapped automatically and locked.'
                : 'We matched the obvious columns automatically. Required fields that EIE confidently recognizes are locked to prevent accidental removal.'}
            </p>
            {missingRequiredMappings.length > 0 && (
              <div className="message" style={{ marginTop: 12 }}>
                <strong>Required mapping needed:</strong>{' '}
                {missingRequiredMappings.join(', ')}. Map these fields before import.
              </div>
            )}
          </div>

          <div className="grid two">
            {headers.map((header, index) => (
              <label className="field" key={`${header}-${index}`}>
                <span>{header}</span>
                <select
                  value={mapping[index] || ''}
                  disabled={mappingIsRequired(mapping[index], event)}
                  onChange={(event) => updateMapping(index, event.target.value)}
                >
                  {fieldOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {mappingIsRequired(mapping[index], event) && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    🔒 Required by Registration Setup
                  </span>
                )}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <span className="section-kicker">2. Defaults</span>
            <h3 style={{ color: '#1D245D', marginBottom: 8 }}>Missing Values</h3>
          </div>

          <div className="grid two">
            {event?.fields?.membership !== 'hidden' && (
              <label className="field">
                <span>Default club membership status</span>
                <select
                  value={membershipDefault}
                  onChange={(event) => setMembershipDefault(event.target.value)}
                >
                  <option>Member</option>
                  <option>Non-Member</option>
                </select>
              </label>
            )}

            <label className="field">
              <span>Default payment status</span>
              <select
                value={paymentDefault}
                onChange={(event) => setPaymentDefault(event.target.value)}
              >
                <option value="pending">Unpaid / pending</option>
                <option value="paid">Paid</option>
                <option value="comp">Comp</option>
              </select>
            </label>

            <div className="field">
              <span>Default roster status</span>
              <div
                style={{
                  padding: '13px 14px',
                  border: '1.5px solid #8094aa',
                  borderRadius: 11,
                  background: '#f4f6f8'
                }}
              >
                Active
              </div>
            </div>

            {paymentDefault === 'comp' && (
              <label className="field">
                <span>Default comp reason *</span>
                <input
                  value={compReasonDefault}
                  onChange={(event) => setCompReasonDefault(event.target.value)}
                  placeholder="Reason for complimentary players"
                />
              </label>
            )}
          </div>

          <div style={{ marginTop: 22 }}>
            <span className="section-kicker">3. Google Workspace Source</span>
            <h3 style={{ color: '#1D245D', marginBottom: 8 }}>Editable Source Sheet</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              The uploaded roster is saved automatically to the event Google Workspace. If EIE flags a row for review, fix the source sheet there, save it, then reload it here.
            </p>
            <div
              className="message"
              style={{ marginBottom: 12 }}
            >
              <strong>Source saved automatically.</strong>{' '}
              {reviewCount > 0
                ? `${reviewCount} row${reviewCount === 1 ? '' : 's'} must be fixed in the Import Source sheet before importing.`
                : 'The source sheet matches the current preview.'}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {importSourceUrl && (
                <a
                  className="secondary"
                  href={importSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  {reviewCount > 0 ? 'Open Sheet & Fix Required Rows' : 'Open Import Source Sheet'}
                </a>
              )}
              <button
                type="button"
                className="secondary"
                disabled={working || !importSourceUrl}
                onClick={reloadFromGoogle}
              >
                Reload from Google Sheet
              </button>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <span className="section-kicker">4. Review</span>
            <h3 style={{ color: '#1D245D', marginBottom: 8 }}>Import Preview</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              {readyCount} ready · {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} · {reviewCount} need{reviewCount === 1 ? 's' : ''} review
            </p>
            {reviewCount > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={requestingInfo}
                  onClick={() => sendMissingInfoRequests(
                    preview.filter((entry) =>
                      entry.status === 'needs_review' &&
                      validEmail(entry.golfer.email) &&
                      requestableMissingFields(entry, event).length > 0
                    )
                  )}
                >
                  {requestingInfo ? 'Sending…' : 'Email All Contactable Players'}
                </button>
                <span className="muted" style={{ fontSize: 13 }}>
                  Players receive a secure link to complete only the missing fields.
                </span>
              </div>
            )}
            {requestNotice && <div className="message" style={{ marginTop: 12 }}>{requestNotice}</div>}
          </div>

          {duplicateCount > 0 && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '12px 0 16px',
                fontWeight: 800,
                color: '#1D245D'
              }}
            >
              <input
                type="checkbox"
                style={{ width: 18, height: 18 }}
                checked={allowDuplicates}
                onChange={(event) => setAllowDuplicates(event.target.checked)}
              />
              Import flagged duplicates anyway
            </label>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              margin: '14px 0 16px',
              padding: 16,
              border: '1.5px solid #1D245D',
              borderRadius: 14,
              background: '#f7f9fb'
            }}
          >
            <div>
              <strong style={{ color: '#1D245D' }}>
                {importableCount > 0
                  ? `${importableCount} golfer${importableCount === 1 ? '' : 's'} ready to import`
                  : 'No golfers are ready to import yet'}
              </strong>
              <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                {reviewCount > 0
                  ? `${reviewCount} row${reviewCount === 1 ? '' : 's'} must be fixed in the Google Import Source sheet, saved, and reloaded before import is unlocked.`
                  : 'Review the preview below, then confirm the import.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="secondary"
                disabled={working}
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="primary"
                disabled={
                  working ||
                  (sourceMode === 'upload' && !file) ||
                  !sourceHash ||
                  importableCount === 0 ||
                  reviewCount > 0 ||
                  missingRequiredMappings.length > 0 ||
                  (paymentDefault === 'comp' && !compReasonDefault.trim())
                }
                onClick={importRoster}
              >
                {working
                  ? 'Importing…'
                  : `Import ${importableCount} Golfer${importableCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Entry #</th>
                  <th>Team ID</th>
                  <th>Golfer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Member</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 25).map((entry) => (
                  <tr key={entry.source_row}>
                    <td>{entry.source_row}</td>
                    <td>{entry.golfer.entry_number || ''}</td>
                    <td>{entry.golfer.team_id || ''}</td>
                    <td>
                      <strong>
                        {entry.golfer.first_name} {entry.golfer.last_name}
                      </strong>
                    </td>
                    <td>{entry.golfer.email}</td>
                    <td>{entry.golfer.phone}</td>
                    <td>{entry.golfer.membership_status}</td>
                    <td>{entry.golfer.payment_status}</td>
                    <td>
                      <span className="pill">{statusLabel(entry)}</span>
                    </td>
                    <td style={{ whiteSpace: 'normal', minWidth: 210 }}>
                      {[...entry.issues, ...entry.duplicate_reasons].join('; ') || 'Ready to import'}
                    </td>
                    <td style={{ minWidth: 190 }}>
                      {entry.status === 'needs_review' && validEmail(entry.golfer.email) && requestableMissingFields(entry, event).length > 0 ? (
                        <button
                          type="button"
                          className="secondary"
                          disabled={requestingInfo}
                          onClick={() => sendMissingInfoRequests([entry])}
                        >
                          Request Missing Info
                        </button>
                      ) : entry.status === 'needs_review' ? (
                        <span className="muted">ATC follow-up required</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.length > 25 && (
            <p className="muted">Showing the first 25 of {preview.length} rows.</p>
          )}

          {summary && (
            <div className="message" style={{ marginTop: 16 }}>
              <strong>Import saved.</strong>{' '}
              {summary.imported_count} added, {summary.duplicate_count} duplicates skipped, {summary.invalid_count} need review.
              {summary.file_saved ? ' Original roster file saved with the event.' : ''}
            </div>
          )}

        </>
      )}

      {!headers.length && (
        <div className="edit-actions">
          <button
            type="button"
            className="secondary"
            disabled={working}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}
