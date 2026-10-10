/**
 * Self-contained print window for the EIE check-in roster.
 * Does not change roster, attendance, or financial records.
 */
const escape = (value) => String(value ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#39;");

function paymentDisplay(value) {
  switch (String(value || '').toLowerCase()) {
    case 'paid': return ['PAID','paid'];
    case 'comp': return ['COMP','comp'];
    case 'pending': return ['PENDING / UNPAID','pending'];
    case 'refunded': return ['REFUNDED / UNPAID','pending'];
    case 'failed': return ['FAILED / UNPAID','pending'];
    default: return ['NOT RECORDED','pending'];
  }
}

const CSS = [
  ':root{font-family:Arial,Helvetica,sans-serif;color:#1D245D;background:#f3f5f8}',
  '*{box-sizing:border-box}body{margin:0}',
  '.toolbar{display:flex;align-items:center;justify-content:space-between;gap:15px;background:#1D245D;color:#fff;padding:12px 24px}',
  '.toolbar span{font-size:13px;font-weight:700}',
  '.print-btn{border:0;border-radius:8px;padding:10px 17px;background:#D81C22;color:#fff;font-size:14px;font-weight:800;cursor:pointer}',
  'main{max-width:1120px;margin:22px auto;padding:22px 26px;background:#fff;box-shadow:0 5px 30px #2531511f;border-radius:12px}',
  '.heading{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:16px}',
  '.heading h1{font-size:22px;line-height:1.2;margin:0 0 5px}',
  '.heading p{margin:0;color:#5a6680;font-size:11px;line-height:1.5}',
  '.summary{text-align:right;font-size:11px;font-weight:700;line-height:1.65;white-space:nowrap}',
  'table{border-collapse:collapse;width:100%;table-layout:fixed}',
  'col.hole-col{width:6.5%}col.team-col{width:6.2%}col.player-col{width:21.825%}',
  'th{background:#1D245D;color:white;text-align:left;font-size:9px;padding:9px 7px}',
  'th.hole,th.team{text-align:center}',
  'tbody tr:nth-child(odd){background:#f0f3f6}',
  'tbody tr{break-inside:avoid;page-break-inside:avoid}',
  'td{height:43px;padding:6px 7px;border-bottom:1px solid #c7ced8;vertical-align:middle}',
  'td.hole{font-weight:900;font-size:12px;text-align:center}',
  'td.team{font-weight:800;text-align:center}',
  'td.player{border-left:1px solid #d3d8e2}',
  '.player-main{display:flex;align-items:center;justify-content:space-between;gap:4px}',
  '.player-main strong{font-size:10px;line-height:1.2;overflow-wrap:anywhere}',
  '.tick{display:inline-block;width:13px;height:13px;min-width:13px;border:1.5px solid #1D245D}',
  '.player small{display:block;margin-top:4px;font-size:8px;font-weight:800;letter-spacing:.025em}',
  '.paid{color:#1c6b45}.comp{color:#1D245D}.pending{color:#c31d26}',
  '.notes{font-size:10px;color:#657187;margin:15px 0 4px;line-height:1.5}',
  '.warnings{padding:9px 11px;background:#fff7e6;border:1px solid #dba942;border-radius:7px;margin:12px 0;font-size:12px;color:#633d0a}',
  '@page{size:letter landscape;margin:.33in}',
  '@media print{',
    'html,body,:root{background:white!important;color:#1D245D}',
    '.toolbar{display:none!important}',
    'main{max-width:none;margin:0;padding:0;border-radius:0;box-shadow:none}',
    '.heading h1{font-size:16px}.heading{margin-bottom:9px}',
    '.heading p,.summary{font-size:9px}',
    'thead{display:table-header-group}',
    'tr,td{break-inside:avoid;page-break-inside:avoid}',
    'td{height:35px;padding:4px 6px}',
    'th{padding:6px;font-size:8px}',
    '.player-main strong{font-size:8.7px}.player small{font-size:7px;margin-top:3px}',
    '.tick{height:11px;width:11px;min-width:11px}',
    '.notes{font-size:8px;margin-top:10px}',
    'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
  '}',
].join('');

export function checkInPrintHtml(sheet, generatedAt = new Date()) {
  if (!sheet || !Array.isArray(sheet.rows)) throw new Error('No check-in list was prepared.');
  const dateLabel = generatedAt.toLocaleString('en-US', {
    month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',
  });
  const summary = sheet.summary || {};
  const warnings = (sheet.warnings || []).length
    ? '<div class="warnings"><strong>Review before printing:</strong> ' +
      sheet.warnings.map(escape).join(' · ') + '</div>' : '';

  const tableRows = sheet.rows.map(group => {
    const players = group.players || [];
    const spots = [...players, ...Array(Math.max(0,4-players.length)).fill(null)].slice(0,4)
      .map(player => {
        if (!player) return '<td class="player empty"><strong>Open spot</strong><small>—</small></td>';
        const [label, cls] = paymentDisplay(player.payment_status);
        return '<td class="player"><div class="player-main"><strong>' +
          escape(player.name) + '</strong><span class="tick" aria-label="Paper check-in box"></span></div>' +
          '<small class="' + cls + '">' + escape(player.id ? label : 'OPEN SPOT') + '</small></td>';
      }).join('');
    return '<tr><td class="hole">' + escape(group.hole || '—') + '</td>' +
      '<td class="team">' + escape(group.team_entry_number || group.team_id) + '</td>' +
      spots + '</tr>';
  }).join('');

  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<title>' + escape(sheet.eventName) + ' - Check-In Sheet</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' + CSS + '</style></head><body>' +
    '<div class="toolbar"><span>Elevated Impact Group · Printable Check-In</span>' +
    '<button class="print-btn" type="button" onclick="window.print()">Print / Save PDF</button></div>' +
    '<main><header class="heading"><div><h1>' + escape(sheet.eventName) + ' · Check-In</h1>' +
    '<p>Golf Genius starting holes · 9:00 AM shotgun · ' + escape(dateLabel) + ' snapshot</p>' +
    '<p>Mark each square as the golfer arrives. Print again after EIE payments change.</p></div>' +
    '<div class="summary">' + escape(summary.teams || 0) + ' teams / ' + escape(summary.golfers || 0) + ' golfers<br>' +
    escape(summary.paid || 0) + ' PAID · ' + escape(summary.comp || 0) + ' COMP · ' +
    escape(summary.pending || 0) + ' PENDING</div></header>' +
    warnings +
    '<table><colgroup><col class="hole-col"><col class="team-col">' +
    '<col class="player-col"><col class="player-col"><col class="player-col"><col class="player-col"></colgroup>' +
    '<thead><tr><th class="hole">HOLE</th><th class="team">TEAM</th>' +
    '<th>GOLFER 1 · CHECK IN</th><th>GOLFER 2 · CHECK IN</th>' +
    '<th>GOLFER 3 · CHECK IN</th><th>GOLFER 4 · CHECK IN</th></tr></thead>' +
    '<tbody>' + tableRows + '</tbody></table>' +
    '<p class="notes">PENDING = payment not recorded in EIE. Do not treat a printed mark as a payment receipt. ' +
    'Confirm clubhouse cash/check collection and update EIE separately. ' +
    'Golf Genius manages starting holes; EIE owns the payment status.</p></main></body></html>';
}
