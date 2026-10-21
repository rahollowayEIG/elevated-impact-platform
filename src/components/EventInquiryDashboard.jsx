import React,{useEffect,useMemo,useState} from "react";
import {loadMyEventInquiries} from "../lib/eventInquiryPortalClient.mjs";
import {inquiryStatusLabel} from "../lib/eventInquiryLifecycle.mjs";
import "./event-inquiry-dashboard.css";

function fmtDate(v){
  if(!v)return "To be confirmed";
  const n=new Date(/T/.test(v)?v:v+"T12:00:00");
  return Number.isFinite(n.getTime())?n.toLocaleDateString():"To be confirmed";
}
const SORTS=new Set(["group_name","status_label","preferred_date","updated_at"]);
export default function EventInquiryDashboard({supabaseClient,onNewRequest,onExit}) {
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState({key:"updated_at",direction:"desc"});
  const [expanded,setExpanded]=useState("");
  async function reload(){
    setLoading(true);setError("");
    try{setRequests(await loadMyEventInquiries(supabaseClient));}
    catch(e){setError(e?.message||"Unable to load your event requests.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{let live=true;setLoading(true);
    loadMyEventInquiries(supabaseClient).then(rows=>{if(live){setRequests(rows);setError("");}})
      .catch(e=>{if(live)setError(e?.message||"Unable to load your event requests.");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[supabaseClient]);
  const filtered=useMemo(()=>{
    const term=search.trim().toLowerCase();
    const rows=requests.filter(x=>!term||[x.group_name,x.status_label,x.event_type,x.organization_name]
      .some(z=>String(z||"").toLowerCase().includes(term)));
    return [...rows].sort((a,b)=>{
      const d=String(a[sort.key]||"").localeCompare(String(b[sort.key]||""));
      return (d||String(a.id).localeCompare(String(b.id)))*(sort.direction==="asc"?1:-1);
    });
  },[requests,search,sort]);
  function order(key){if(!SORTS.has(key))return;
    setSort(s=>({key,direction:s.key===key&&s.direction==="asc"?"desc":"asc"}));
  }
  return <section className="eir-dashboard" aria-labelledby="eir-dashboard-title">
    <header className="eir-dashboard-head">
      <div><p className="platform-eyebrow">ElevationPilot / My Requests</p>
        <h2 id="eir-dashboard-title">My Event Requests</h2>
        <p>Track your event requests, proposed dates, contract status and Hangar responses.</p>
      </div>
      <div className="eir-dashboard-actions">
        <button type="button" className="platform-secondary-button" onClick={reload} disabled={loading}>Refresh</button>
        {onNewRequest&&<button type="button" className="platform-primary-button" onClick={onNewRequest}>New Event Request</button>}
        {onExit&&<button type="button" className="platform-secondary-button" onClick={onExit}>Go to My Airport</button>}
      </div>
    </header>
    {error&&<div className="platform-error" role="alert">{error}</div>}
    {loading?<p role="status">Loading your event requests…</p>:<>
      <label className="eir-dashboard-search">Search my requests
        <input value={search} type="search" onChange={e=>setSearch(e.target.value)}
          placeholder="Find a group, event or status" /></label>
      <div className="eir-dashboard-scroll"><table>
        <thead><tr>{[
          ["group_name","Request"],["status_label","Status"],
          ["preferred_date","Requested Date"],["updated_at","Last Updated"],
        ].map(([key,title])=><th key={key} aria-sort={sort.key===key?(sort.direction==="asc"?"ascending":"descending"):"none"}>
          <button type="button" onClick={()=>order(key)}>{title} {sort.key===key?(sort.direction==="asc"?"↑":"↓"):"↕"}</button>
        </th>)}</tr></thead>
        <tbody>{filtered.map(request=><React.Fragment key={request.id}>
          <tr className="eir-dashboard-row">
            <td><button type="button" className="eir-dashboard-open" onClick={()=>setExpanded(p=>p===request.id?"":request.id)}
              aria-expanded={expanded===request.id}>
              {expanded===request.id?"▾":"▸"} {request.group_name||request.event_type||"Event Request"}</button>
              <small>{request.organization_name}</small>
            </td>
            <td><span className="eir-dashboard-status">{inquiryStatusLabel(request.status)}</span></td>
            <td>{fmtDate(request.preferred_date)}</td>
            <td>{fmtDate(request.updated_at)}</td>
          </tr>
          {expanded===request.id&&<tr><td colSpan={4} className="eir-dashboard-detail">
            <dl>
              <div><dt>Current status</dt><dd>{inquiryStatusLabel(request.status)}</dd></div>
              <div><dt>Confirmed date</dt><dd>{fmtDate(request.confirmed_date)}</dd></div>
              <div><dt>Confirmed start</dt><dd>{request.confirmed_start_type||"Not yet set"} {request.confirmed_start_time||""}</dd></div>
              <div><dt>Participant capacity</dt><dd>{request.confirmed_capacity||"Not yet confirmed"}</dd></div>
              <div><dt>Contract</dt><dd>{String(request.contract_status||"not_sent").replaceAll("_"," ")}</dd></div>
              <div><dt>Deposit</dt><dd>{String(request.deposit_status||"not_required").replaceAll("_"," ")}</dd></div>
              <div><dt>Deposit due</dt><dd>{fmtDate(request.deposit_due_at)}</dd></div>
              <div><dt>Hold expires</dt><dd>{fmtDate(request.hold_expires_at)}</dd></div>
            </dl>
            {request.confirmed_package&&<p><strong>Venue package:</strong> {request.confirmed_package}</p>}
            {request.venue_response&&<p><strong>Message from the Hangar:</strong> {request.venue_response}</p>}
            <p className="eir-dashboard-note">Email and Squawk notifications will appear when secure delivery is enabled. Private Hangar notes are never shown here.</p>
          </td></tr>}
        </React.Fragment>)}
        {!filtered.length&&<tr><td colSpan={4}>No event requests match this search.</td></tr>}
        </tbody>
      </table></div>
    </>}
  </section>;
}
