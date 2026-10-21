import React from 'react';
import './scanner-tools-disclosure.css';

const ACCESS=['Supabase owner authorization','Access check','Checks the signed-in owner and current EIG membership before running this scan.'];
const SOURCE=['ElevationPilot Source Scanner','Evidence scan','Reads the fixed, approved first-party source and test files in this deployed preview. It does not execute the tests.'];
const ENVIRONMENT=['ElevationPilot Environment Comparison','Snapshot comparison','Compares dated deployment and database-schema snapshots. It does not make a fresh database or GitHub query.'];
export default function ScannerToolsDisclosure({kind='source',completed=false}){
 const rows=kind==='ai'?[
  ACCESS,SOURCE,
  ['OpenAI · gpt-4.1-mini',completed?'Response received':'On Analyze click','Reviews bounded scanner metadata. No raw source or customer records are sent.'],
  ['ElevationPilot Evidence Validator','Output check','Checks the AI response and its file references before showing recommendations.'],
 ]:kind==='inspector'?[
  ACCESS,['ElevationPilot IA Source Inspector','Evidence scan','Checks four approved InceptionApex source/test files. It does not run AI or execute browser tests.'],
 ]:kind==='radar'?[
  ACCESS,SOURCE,['ElevationPilot Essentials & Wow Rules','Rules engine','Applies built-in product-quality rules and static standards references. No AI or competitor-site visit.'],
 ]:[ACCESS,SOURCE,ENVIRONMENT];
 return <details className="bl-scanner-tools">
  <summary>Tools used</summary>
  <dl>{rows.map(([name,status,description])=><div key={name}><dt><strong>{name}</strong> <span>{status}</span></dt><dd>{description}</dd></div>)}</dl>
  <p>Opening this list does not run a scan or make an AI request.</p>
 </details>;
}
