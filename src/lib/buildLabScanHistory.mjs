export const SCAN_TYPES = {master:"Master Scanner",radar:"Upgrade Radar",ai:"AI Review",inspector:"IA Inspector",impact:"Impact Review"};
export const HISTORY_EVENT = "eig-scan-history-changed";
const LIMIT = 1800000;
export function historyKey(uid) {
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid||"") ? "eig:scan-history:v1:"+uid.toLowerCase() : null;
}
export function readScanHistory(storage,uid) {
 const key=historyKey(uid); if(!key)return [];
 const raw=storage.getItem(key); if(!raw)return [];
 if(raw.length>LIMIT)throw Error("Saved scan history is too large.");
 const value=JSON.parse(raw);
 if(value?.version!==1||!Array.isArray(value.entries)||value.entries.length>100)throw Error("Saved scan history is unreadable.");
 if(!value.entries.every(x=>Object.hasOwn(SCAN_TYPES,x.type)&&typeof x.id==="string"&&x.id.length<=200&&typeof x.scope==="string"&&x.scope.length<=150&&typeof x.source==="string"&&x.source.length<=150&&Number.isFinite(Date.parse(x.savedAt))&&x.snapshot&&typeof x.snapshot==="object"&&!Array.isArray(x.snapshot)))throw Error("Saved scan history is unreadable.");
 return value.entries;
}
export function saveScanHistory(storage,uid,entry) {
 const key=historyKey(uid); if(!key)throw Error("Cannot save scans without an owner account.");
 if(!Object.hasOwn(SCAN_TYPES,entry.type)||!entry.snapshot)throw Error("Invalid scan record.");
 const previous=readScanHistory(storage,uid);
 const found=previous.find(x=>x.id===entry.id&&x.type===entry.type);
 const next={...entry,savedAt:found?.savedAt||entry.savedAt};
 if(found&&JSON.stringify(found)===JSON.stringify(next))return false;
 const all=[next,...previous.filter(x=>!(x.id===entry.id&&x.type===entry.type))].sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt));
 const counts={};
 let entries=all.filter(x=>(counts[x.type]=(counts[x.type]||0)+1)<=20);
 // Keep complete records. Trim the oldest records, never the current result.
 while(JSON.stringify({version:1,entries}).length>LIMIT&&entries.length>1)entries.pop();
 const json=JSON.stringify({version:1,entries});
 if(json.length>LIMIT)throw Error("Scan result is too large for browser history.");
 storage.setItem(key,json);return true;
}
