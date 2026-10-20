import React,{useState} from 'react';
import {prepareResearchTarget} from '../lib/researchTargetDraft.mjs';
export default function ResearchTargetPlanner(){
 const [kind,setKind]=useState('website'),[target,setTarget]=useState(''),[focus,setFocus]=useState('full'),[compareTo,setCompareTo]=useState('event_builder');
 const [draft,setDraft]=useState(null),[error,setError]=useState('');
 function prepare(){try{setDraft(prepareResearchTarget({kind,target,focus,compareTo}));setError('');}catch(e){setError(e.message);setDraft(null);}}
 function download(){if(!draft)return;const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='eig-research-target-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="platform-section-card bl-research-target" aria-labelledby="bl-research-title">
 <h2 id="bl-research-title">External Software Research Brief (Planning Only)</h2>
 <p>This section prepares a future comparison with external websites and software. It does not run a live scan yet. To inspect ElevationPilot modules now, use the Master Scanner at the top.</p>
 <div className="bl-research-grid">
 <label>Target type<select value={kind} onChange={e=>{setKind(e.target.value);setDraft(null);}}><option value="website">Website or web app</option><option value="mobile_app">Mobile application</option><option value="github">Public GitHub repository</option><option value="software_product">Software product</option></select></label>
 <label>Research focus<select value={focus} onChange={e=>{setFocus(e.target.value);setDraft(null);}}><option value="full">Full feature analysis</option><option value="experience">User experience</option><option value="technology">Technology and integrations</option><option value="innovation">Innovation opportunities</option></select></label>
 <label className="bl-research-wide">Site URL, app name, or product<input value={target} onChange={e=>{setTarget(e.target.value);setDraft(null);}} placeholder={kind==='github'?'https://github.com/owner/repo':kind==='website'?'https://example.com':'App or product name'} maxLength={500}/></label>
 <label>Compare against<select value={compareTo} onChange={e=>{setCompareTo(e.target.value);setDraft(null);}}><option value="event_builder">ElevationPilot Event Builder</option><option value="inception_apex">InceptionApex</option><option value="marketplace">EIG Marketplace</option><option value="build_lab">EIG Build Lab</option><option value="none">No comparison</option></select></label>
 </div>
 <div className="bl-review-actions"><button type="button" className="platform-primary-button" onClick={prepare}>Prepare research brief (no scan)</button>{draft&&<button type="button" className="platform-secondary-button" onClick={download}>Download research brief JSON</button>}</div>
 {error&&<p className="platform-error" role="alert">{error}</p>}
 {draft&&<p role="status">Research target prepared for review: <strong>{draft.target}</strong>. No external scan was run. The proposed comparison is {draft.compareTo.replaceAll('_',' ')}.</p>}
 </section>;
}
