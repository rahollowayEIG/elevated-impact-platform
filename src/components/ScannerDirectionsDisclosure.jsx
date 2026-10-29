import React from 'react';
import directions from '../lib/buildLabScannerDirections.json';
import {MASTER_SCAN_TARGETS} from '../lib/eigMasterScanTargets.mjs';
export default function ScannerDirectionsDisclosure({kind='master',moduleId='all'}){
 const rule=directions.scanners[kind];if(!rule)return null;
 const modules=moduleId==='all'?[]:directions.modules[moduleId]||[];
 return <details className="bl-scanner-directions"><summary>Scanner directions</summary><p><strong>Mission:</strong> {rule.mission}</p><h4>What this scanner identifies</h4><ul>{rule.identifies.map(x=><li key={x}>{x}</li>)}</ul><h4>Current limits</h4><ul>{rule.limits.map(x=><li key={x}>{x}</li>)}</ul>{modules.length>0&&<><h4>Verification checklist · {MASTER_SCAN_TARGETS.find(x=>x.id===moduleId)?.label||moduleId}</h4><p>Required follow-up checks; this source scan does not execute these workflows.</p><ul>{modules.map(x=><li key={x}>{x}</li>)}</ul></>}<h4>Shared evidence rules</h4><ul>{directions.principles.map(x=><li key={x}>{x}</li>)}</ul><p><strong>Before handoff:</strong> {rule.handoff}</p></details>;
}
