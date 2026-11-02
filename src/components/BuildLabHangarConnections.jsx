import React,{useEffect,useState} from 'react';
import {SOCIAL_DESTINATIONS} from '../lib/socialCampaign.mjs';
import {requestHangarConnections} from '../lib/buildLabHangarConnectionsClient.mjs';
import './build-lab-app-stack.css';

const socialProviders=SOCIAL_DESTINATIONS.filter(p=>Boolean(p.setup));
const date=value=>value&&Number.isFinite(Date.parse(value))?
 new Date(value).toLocaleString():'Not yet verified';
function connectionText(channel){
 if(channel.verified)return 'Connected · last verified '+date(channel.verifiedAt);
 if(channel.status==='setup_required')return 'Setup required';
 if(channel.status==='connected')return 'Configured · verification missing';
 if(channel.status==='disconnected')return 'Disconnected';
 if(channel.status==='error')return 'Connection issue';
 if(channel.status==='pending')return 'Waiting for authorization';
 return 'Not verified · '+channel.status.replaceAll('_',' ');
}
export default function BuildLabHangarConnections({supabaseClient}){
 const [report,setReport]=useState(null),[error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [showDemo,setShowDemo]=useState(false),[showHQ,setShowHQ]=useState(false);
 const [search,setSearch]=useState('');
 async function refresh(active=()=>true){
  setLoading(true);setError('');
  try{
   const next=await requestHangarConnections(supabaseClient);
   if(active())setReport(next);
  }catch(e){if(active())setError(e.message||'Could not verify Hangar connections.');}
  finally{if(active())setLoading(false);}
 }
 useEffect(()=>{let active=true;refresh(()=>active);return()=>{active=false;};},[supabaseClient]);
 const organizations=(report?.hangars||[]).filter(h=>
  (showDemo||!h.isTest)&&(showHQ||h.kind==='hangar')&&
  (!search.trim()||(h.name+' '+h.slug).toLowerCase().includes(search.trim().toLowerCase())));
 return <section className="platform-section-card bl-app-stack" aria-label="Hangar connection adoption">
  <p className="platform-eyebrow">BUILD LAB / HANGAR CONNECTIONS</p>
  <h2>Hangar Connections &amp; Adoption</h2>
  <p>See what each business has actually connected, what requires attention, and which integrations we still need to build. Connection counts reflect verified records, not a guess about the business's success.</p>
  <div className="bl-stack-actions">
   <button type="button" className="platform-primary-button" disabled={loading}
    onClick={()=>refresh()}>{loading?'Checking connections…':'Refresh verified connections'}</button>
   <label><input type="checkbox" checked={showDemo} onChange={e=>setShowDemo(e.target.checked)} /> Include demo Hangars</label>
   <label><input type="checkbox" checked={showHQ} onChange={e=>setShowHQ(e.target.checked)} /> Include EIG HQ</label>
   <label>Search Hangars<input type="search" value={search}
    onChange={e=>setSearch(e.target.value)} placeholder="Business name" /></label>
  </div>
  {error&&<p className="platform-error" role="alert">{error} No connection status was changed.</p>}
  {report&&<>
   <div className="bl-stack-summary" aria-label="Hangar adoption overview">
    <div><strong>{report.summary.realHangars}</strong><span>Real Hangars tracked</span></div>
    <div><strong>{report.summary.verifiedChannels}</strong><span>Verified communication connections</span></div>
    <div><strong>{report.summary.configuredChannels}</strong><span>Configured channel records</span></div>
    <div><strong>{report.summary.testHangars}</strong><span>Demo Hangars excluded by default</span></div>
    <div><strong>Not measured</strong><span>Overall Hangar adoption</span></div>
   </div>
   <p className="bl-stack-small">Read-only server check: {date(report.generatedAt)}. The counts exclude test Hangars and HQ. A verified connection reflects the last recorded check, not guaranteed delivery today.</p>
   <div className="bl-stack-cards">
    {organizations.map(h=><article className="bl-stack-card" key={h.id}
     aria-label={h.name+' connection status'}>
     <div className="bl-stack-card-head"><div><p className="platform-eyebrow">{h.kind==='hq'?'Platform HQ':h.isTest?'Demo Hangar':'Hangar'}</p><h3>{h.name}</h3></div><span className="bl-stack-stage">{h.status}</span></div>
     <div className="bl-stack-meters">
      <div className="bl-stack-meter">
       <div className="bl-stack-meter-heading"><strong>Verified communication connections</strong><strong>{h.configuredChannels?String(h.verifiedChannels)+' of '+h.configuredChannels:'Not measured'}</strong></div>
       <div className="bl-stack-track" role={h.configuredChannels?'progressbar':undefined}
        aria-label={h.configuredChannels?'Verified configured communication connections':undefined}
        aria-valuemin={h.configuredChannels?0:undefined}
        aria-valuemax={h.configuredChannels?100:undefined}
        aria-valuenow={h.configuredChannels?h.channelCoverage:undefined}>
        {h.configuredChannels>0&&<span style={{width:h.channelCoverage+'%'}} />}
       </div>
       <small>Only previously configured Squawk Box channels. This is not overall Hangar adoption.</small>
      </div>
      <div className="bl-stack-meter unmeasured">
       <div className="bl-stack-meter-heading"><strong>Overall integration adoption</strong><strong>Not measured</strong></div>
       <div className="bl-stack-track"/>
       <small>{h.adoptionReason}</small>
      </div>
     </div>
     <h4>Communication connections</h4>
     {h.channels.length?
      <ul className="bl-hangar-channel-list">
       {h.channels.map((ch,i)=><li key={ch.channel+':'+ch.provider+':'+i}>
        <strong>{ch.channel.toUpperCase()} · {ch.provider}</strong>
        <span>{connectionText(ch)}</span>
        {ch.compliance!=='not_applicable'&&<small>Compliance record: {ch.compliance.replaceAll('_',' ')}</small>}
       </li>)}
      </ul>:
      <p className="bl-stack-small">No configured communication channel records. Available channels must be confirmed before scoring adoption.</p>}
     <dl className="bl-stack-metrics">
      <div><dt>Drive folder mappings</dt><dd>{h.driveFolderMappings}</dd></div>
      <div><dt>Saved social campaigns</dt><dd>{h.savedCampaigns}</dd></div>
      <div><dt>External social logins</dt><dd>Not available yet</dd></div>
     </dl>
     <details className="bl-stack-signals">
      <summary>Social channel connection opportunities ({socialProviders.length})</summary>
      <p className="bl-stack-small">These providers are listed in the Social Media app, but ElevationPilot's sign-in, permission, and publishing connectors have not been activated. They are not counted as missing Hangar setup.</p>
      <ul>{socialProviders.map(p=><li key={p.id}><strong>{p.name}</strong> · Platform integration pending</li>)}</ul>
      <p className="bl-stack-small">When available, Hangar admins will sign in directly with the provider, approve specific permissions, choose authorized pages/channels and return to ElevationPilot. Build Lab will then record verified connection and publishing health.</p>
     </details>
     <p className="bl-stack-next"><strong>Next action:</strong> {h.nextAction}</p>
    </article>)}
   </div>
   {!organizations.length&&<p>No Hangars match the selected filters.</p>}
   <p className="bl-stack-small">Google Drive folder mappings and campaign counts show recorded activity, not connected OAuth authorization or a successful publication. User access to other Hangars remains prohibited; this owner-only Build Lab report cannot edit any connections.</p>
  </>}
  {!loading&&!report&&!error&&<p>Connection inventory is not yet available. Refresh to check the authorized source.</p>}
 </section>;
}
