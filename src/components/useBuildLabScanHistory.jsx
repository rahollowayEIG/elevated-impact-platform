import {useEffect,useState} from "react";
import {HISTORY_EVENT,readScanHistory,saveScanHistory} from "../lib/buildLabScanHistory.mjs";
export default function useBuildLabScanHistory(ownerUserId,type,snapshot,scope="all",source="") {
 const [run,setRun]=useState(()=>{
  try {
   const row=readScanHistory(window.localStorage,ownerUserId).find(x=>x.type===type&&x.scope===scope&&JSON.stringify(x.snapshot)===JSON.stringify(snapshot));
   return row?{[scope]:{id:row.id,savedAt:row.savedAt}}:{};
  }catch{return {};}
 }),[error,setError]=useState("");
 const json=snapshot?JSON.stringify(snapshot):"";
 useEffect(()=>{
  if(!json)return;
  try {
   const data=JSON.parse(json);
   const stamp=data.report?.inspectedAt||data.inspectedAt||data.review?.generatedAt;
   const existing=readScanHistory(window.localStorage,ownerUserId).find(x=>x.type===type&&x.scope===scope&&JSON.stringify(x.snapshot)===json);
   const active=run[scope]||existing;
   const id=active?.id||("restored:"+source+":"+scope+":"+(stamp||"latest"));
   const savedAt=active?.savedAt||(Number.isFinite(Date.parse(stamp))?stamp:new Date().toISOString());
   if(saveScanHistory(window.localStorage,ownerUserId,{id,type,scope,source:source||"unversioned",savedAt,snapshot:data}))window.dispatchEvent(new Event(HISTORY_EVENT));
   setError("");
  }catch {setError("Scan history could not be saved. Download the result before leaving this page.");}
 },[ownerUserId,type,json,scope,source,run]);
 function record(nextSnapshot,nextScope=scope,nextSource=source){
  try{
   if(!nextSnapshot||typeof nextSnapshot!=='object')throw Error('Missing scan result.');
   const stamp=nextSnapshot.report?.inspectedAt||nextSnapshot.inspectedAt||nextSnapshot.review?.generatedAt||new Date().toISOString();
   const savedAt=Number.isFinite(Date.parse(stamp))?stamp:new Date().toISOString();
   const row={id:crypto.randomUUID(),type,scope:nextScope,source:nextSource||'unversioned',savedAt,snapshot:nextSnapshot};
   saveScanHistory(window.localStorage,ownerUserId,row);
   window.dispatchEvent(new Event(HISTORY_EVENT));setRun(r=>({...r,[nextScope]:{id:row.id,savedAt:row.savedAt}}));setError('');return true;
  }catch{setError('Scan completed, but History could not save it. Download the scanner report before leaving.');return false;}
 }
 return {error,record,begin:(nextScope=scope)=>setRun(r=>({...r,[nextScope]:{id:crypto.randomUUID(),savedAt:new Date().toISOString()}}))};
}
