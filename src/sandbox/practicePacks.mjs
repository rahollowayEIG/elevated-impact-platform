/**
 * Read-only practice-pack validation and preview. No DB, email or payment calls.
 * Browser-compatible so a future sandbox catalog can reuse these checks.
 */
export const PRACTICE_PACK_SCHEMA = 'elevationpilot.practice-pack.v1';
export const PRACTICE_CATALOG_SCHEMA = 'elevationpilot.practice-catalog.v1';
export const PRACTICE_SANDBOX_REF = 'publruuuyvpggogrrgwp';
export const MAX_PACK_RECORDS = 5;
export const PRACTICE_KINDS = Object.freeze([
  'event', 'golf_event', 'golf_player', 'ad_creative', 'ad_campaign',
  'sponsor_package', 'sponsor', 'coupon_offer', 'vendor', 'vendor_service'
]);

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function text(value, max = 160) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
function checkData(node, path, errors) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => checkData(item, path + '[' + i + ']', errors));
    return;
  }
  if (!plain(node)) return;
  for (const [field, value] of Object.entries(node)) {
    const at = path + '.' + field;
    if (/password|secret|api[_-]?key|service[_-]?role|(^|_)token($|_)|stripe|payment[_-]?intent|checkout[_-]?session|social[_-]?security|customer[_-]?id|webhook|phone/i.test(field)) {
      errors.push(at + ' contains a forbidden credential or external-service field.');
    }
    if (/^(url|href|redirect_url|external_url|website|callback_url)$/i.test(field)) {
      errors.push(at + ' must not specify an external destination.');
    }
    if (typeof value === 'string' && /https?:\/\/|mailto:|javascript:|data:/i.test(value)) {
      errors.push(at + ' contains an unsafe URL or executable destination.');
    }
    if (/email/i.test(field) && typeof value === 'string' && !/^[a-z0-9._+-]+@(practice\.example|sandbox\.invalid)$/i.test(value)) {
      errors.push(at + ' must use a reserved fictional email domain.');
    }
    if (field === 'status' && !['draft', 'pending', 'pending_review'].includes(value)) {
      errors.push(at + ' must remain draft/pending.');
    }
    if (field === 'registration_status' && !['draft', 'pending'].includes(value)) {
      errors.push(at + ' cannot represent a live registration.');
    }
    if (field === 'payment_status' && value !== 'unpaid') {
      errors.push(at + ' must remain unpaid.');
    }
    if (['is_published','publication_enabled','claim_enabled','redemption_enabled','checkout_enabled','send_email','send_sms','auto_charge'].includes(field) && value !== false) {
      errors.push(at + ' must be disabled.');
    }
    if (field === 'amount_paid' && value !== 0) errors.push(at + ' must not record a payment.');
    if (field === 'budget' && value !== 0) errors.push(at + ' must have zero planned spend.');
    checkData(value, at, errors);
  }
}

/** Validate an in-memory JSON pack without permitting side effects. */
export function validatePracticePack(pack) {
  const errors = [];
  if (!plain(pack)) return {ok:false, errors:['Pack must be a plain object.'], recordCount:0};
  if (pack.schema !== PRACTICE_PACK_SCHEMA || pack.version !== 1) errors.push('Unsupported pack format.');
  if (pack.sandboxOnly !== true || pack.autoImport !== false || pack.requiresExplicitSelection !== true) {
    errors.push('Packs must be sandbox-only and require explicit opt-in.');
  }
  if (!text(pack.id, 64) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pack.id || '')) errors.push('Invalid pack ID.');
  if (!text(pack.title, 90) || !text(pack.description, 260)) errors.push('Missing short title or description.');
  if (!text(pack.app, 40)) errors.push('Pack must identify one app.');
  if (!Array.isArray(pack.steps) || pack.steps.length < 1 || pack.steps.length > 5 ||
      pack.steps.some(step => !text(step, 200))) errors.push('Expected 1-5 short practice steps.');
  const records = Array.isArray(pack.records) ? pack.records : [];
  if (records.length < 1 || records.length > MAX_PACK_RECORDS) errors.push('Pack must contain 1-5 records.');
  const keys = new Set();
  for (const [i, r] of records.entries()) {
    const path = 'records[' + i + ']';
    if (!plain(r)) {errors.push(path + ' is invalid.'); continue;}
    if (!text(r.key,64) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.key || '')) {
      errors.push(path + ' needs a safe stable key.');
    } else if (keys.has(r.key)) errors.push(path + ' duplicate key.');
    else keys.add(r.key);
    if (!PRACTICE_KINDS.includes(r.kind)) errors.push(path + ' has an unknown record kind.');
    if (!plain(r.data) || Object.keys(r.data).length === 0) errors.push(path + ' needs data.');
    else checkData(r.data,path + '.data',errors);
  }
  for (const [i, r] of records.entries()) {
    if (!plain(r?.data)) continue;
    for (const [key, value] of Object.entries(r.data)) {
      if (key.endsWith('_ref') && (typeof value !== 'string' || !keys.has(value))) {
        errors.push('records[' + i + '].data.' + key + ' references a record outside this pack.');
      }
    }
  }
  return {ok:errors.length===0,errors,recordCount:records.length};
}

export function validatePracticeCatalog(catalog, packsById) {
  const errors=[];
  if (!plain(catalog) || catalog.schema!==PRACTICE_CATALOG_SCHEMA ||
      catalog.sandboxOnly!==true || catalog.defaultWorkspace!=='empty' ||
      catalog.version!==1 || !Array.isArray(catalog.packs)) {
    return {ok:false,errors:['Catalog must be empty-by-default and sandbox-only.']};
  }
  const ids=new Set();
  if(catalog.packs.length<1 || catalog.packs.length>12) errors.push('Catalog exceeds small pack count.');
  for(const [i,entry] of catalog.packs.entries()){
    const label='catalog.packs['+i+']';
    if(!plain(entry)||!text(entry.id,64)){errors.push(label+' is invalid.');continue;}
    if(ids.has(entry.id)) errors.push(label+' duplicates an ID.');
    ids.add(entry.id);
    if(entry.file!==entry.id+'.json') errors.push(label+' has an unsafe path.');
    const pack=packsById?.[entry.id];
    if(!pack){errors.push(label+' has no source file.');continue;}
    const result=validatePracticePack(pack);
    errors.push(...result.errors.map(e=>entry.id+': '+e));
    if(pack.id!==entry.id || pack.title!==entry.title || pack.app!==entry.app ||
       pack.records.length!==entry.recordCount ||
       JSON.stringify([...new Set(pack.records.map(r=>r.kind))])!==JSON.stringify(entry.recordKinds)){
      errors.push(label+' metadata does not match its pack.');
    }
  }
  if(packsById && Object.keys(packsById).some(id=>!ids.has(id))) errors.push('Unlisted pack present.');
  return {ok:errors.length===0,errors};
}

/** This intentionally returns only a preview, never a DB-writing operation. */
export function previewPracticePack(pack) {
  const check=validatePracticePack(pack);
  if(!check.ok) throw new Error('Unsafe practice pack: '+check.errors.join('; '));
  return Object.freeze({
    packId:pack.id,module:pack.app,title:pack.title,recordCount:check.recordCount,
    kinds:Object.freeze([...new Set(pack.records.map(r=>r.kind))]),
    willImport:false,willSendMessages:false,willCharge:false,willPublish:false,
    mode:'PREVIEW_ONLY'
  });
}
