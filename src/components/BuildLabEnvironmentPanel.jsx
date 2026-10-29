import React from "react";
import "./build-lab-environment-panel.css";

const MODE_NAMES={live:"Live (read-only)",sandbox:"Sandbox (read-only)",compare:"Compare Live + Sandbox"};
function EnvCard({value,kind}) {
 if(!value)return null;
 return <article className="blm-env-project">
   <div className="blm-env-project-heading"><strong>{kind==="live"?"LIVE":"SANDBOX"}</strong>
    <span>Deployment metadata</span></div>
   <h4>{value.label}</h4>
   <p><strong>Git ref:</strong> <code>{value.gitRef}</code></p>
   <p><strong>Deployed commit:</strong> <code>{value.deployedCommit.slice(0,12)}</code></p>
   <div className="blm-env-numbers">
    <span><strong>{value.tables}</strong> tables</span>
    <span><strong>{value.functions}</strong> functions</span>
    <span><strong>{value.rlsDisabled.length}</strong> tables without RLS</span>
   </div>
   {value.missingRelevantTables.length>0&&
    <p className="blm-env-attention">Not found in this environment's captured schema: {value.missingRelevantTables.join(", ")}</p>}
   <details><summary>Inspect {value.relevantTables.length} recorded {value.relevantTables.length===1?"table":"tables"}</summary>
    <div className="blm-env-compact-list">
     {value.relevantTables.map(t=><p key={t.table}>
      <code>{t.table}</code> · {t.columns} columns · {t.policies} policies · RLS {t.rlsEnabled?"enabled":"disabled"}
     </p>)}
    </div>
   </details>
 </article>;
}
function DeltaCard({audit}) {
 const c=audit.compare;
 if(!c)return null;
 const source=c.source,db=c.database;
 return <section className="blm-env-delta" aria-labelledby="blm-env-delta-title">
  <h4 id="blm-env-delta-title">What differs between the deployments?</h4>
  <div className="blm-env-numbers">
   <span><strong>{source.totalChangedFiles}</strong> changed files across the two deployed commits</span>
   <span><strong>{source.relevantChangedFiles.length}</strong> changed files in this scan's module scope</span>
   <span><strong>{db.totalDifferentTables}</strong> schema differences across all public tables</span>
   <span><strong>{db.totalDifferentFunctions}</strong> public function differences</span>
  </div>
  <p className="blm-env-context">
   The GitHub comparison is between the actual recorded production deployment commits,
   not the protected Build Lab preview branch. Changes are not automatically defects.
  </p>
  <details open={audit.scope!=="all"&&db.selectedDifferentTables.length>0}>
   <summary>Database differences for {audit.scope==="all"?"all public tables":"the selected module"} ({db.selectedDifferentTables.length})</summary>
   <div className="blm-env-compact-list">
    {db.selectedDifferentTables.length===0?<p>No schema differences observed in the selected tables at the captured date.</p>:
     db.selectedDifferentTables.map(x=><div key={x.table} className="blm-env-change">
      <strong><code>{x.table}</code></strong>
      {x.kind==="table_missing"?<p>Table presence: {x.presentIn}. Verify whether this difference is intentional.</p>:<>
       {x.policyDifferent&&<p>Security policies differ. Live: {x.livePolicyCount}; Sandbox: {x.sandboxPolicyCount}. A count/hash difference is not proof of a vulnerability.</p>}
       {x.rlsDifferent&&<p>RLS enabled: Live {String(x.liveRls)}; Sandbox {String(x.sandboxRls)}.</p>}
       {x.indexDifferent&&<p>Indexes: Live {x.liveIndexCount}; Sandbox {x.sandboxIndexCount}.</p>}
       {x.liveOnlyColumns.length>0&&<p>Columns only in Live: {x.liveOnlyColumns.join(", ")}</p>}
       {x.sandboxOnlyColumns.length>0&&<p>Columns only in Sandbox: {x.sandboxOnlyColumns.join(", ")}</p>}
       {x.changedColumns.length>0&&<p>Changed column definitions: {x.changedColumns.map(c=>c.name).join(", ")}</p>}
      </>}
     </div>)}
   </div>
  </details>
  <details>
   <summary>Changed deployment files relevant to this scan ({source.relevantChangedFiles.length})</summary>
   <div className="blm-env-compact-list">
    {source.relevantChangedFiles.length===0?<p>No changes to the approved module file set were reported in this dated comparison.</p>:
      source.relevantChangedFiles.map(f=><p key={f.path}><code>{f.path}</code> · {f.status} · +{f.additions} / -{f.deletions}</p>)}
   </div>
  </details>
  <details>
   <summary>Public function differences across both databases ({db.functionDifferences.length})</summary>
   <div className="blm-env-compact-list">
    {db.functionDifferences.length===0?<p>No public function definition differences observed.</p>:
      db.functionDifferences.map(f=><p key={f.signature}><code>{f.signature}</code> · {f.status.replaceAll("_"," ")}</p>)}
   </div>
  </details>
 </section>;
}
export default function BuildLabEnvironmentPanel({audit}){
 if(!audit)return null;
 return <section className="blm-env" aria-labelledby="blm-env-heading">
  <div className="blm-env-head">
   <div><h3 id="blm-env-heading">Environment Evidence: {MODE_NAMES[audit.selected]||"Unknown"}</h3>
    <p>Recorded {audit.capturedOn}. Separate deployed GitHub versions and Supabase public-schema metadata.</p>
   </div>
   <span className="blm-env-captured">Dated snapshot, not a live refresh</span>
  </div>
  <div className="blm-env-projects">
   <EnvCard kind="live" value={audit.live}/>
   <EnvCard kind="sandbox" value={audit.sandbox}/>
  </div>
  <DeltaCard audit={audit}/>
  <div className="blm-env-verification">
   <strong>Functional browser tests:</strong> Live not run · Sandbox not run. The source/UI/test badges below inspect the Build Lab preview as reference, not either deployed app.
  </div>
  <p className="blm-env-safety">Read-only evidence. No real customers, transactions, Sandbox data writes, AI repairs or production deployments were performed.</p>
 </section>;
}
