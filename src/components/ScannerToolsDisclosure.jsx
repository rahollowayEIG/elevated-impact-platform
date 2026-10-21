import React from 'react';
import './scanner-tools-disclosure.css';

const SOURCE_TOOLS=[
 ['ElevationPilot scanner','Runs here','Checks the fixed, approved source-file list in this deployed preview.'],
 ['GitHub','Code origin','The scan reads the deployed code copy; it does not fetch GitHub on each click.'],
 ['Supabase','Reference snapshot','Uses dated schema metadata; this button does not query live customer data.'],
 ['Vercel','Hosting','Runs the protected preview and supplies recorded deployment context.'],
 ['Playwright + GitHub Actions','Separate test workflow','Automated browser and regression checks run in CI. Clicking Scan does not execute those tests.'],
];
const PLANNED=[
 ['Web research / search','Planned','Source-linked comparisons with other apps and services.'],
 ['Image and document reading','Planned','Extract candidates from authorized product photos and documents for review.'],
 ['Maps / course imagery','Planned','Course mapping and flyover research; no mapping provider is connected here.'],
];
export default function ScannerToolsDisclosure({kind='source',completed=false}){
 const rows=kind==='ai'?[
  ['OpenAI · gpt-4.1-mini',completed?'Response received':'Manual request','Analyzes bounded scanner metadata only when you click Analyze. No raw source or customer records are sent.'],
  ['ElevationPilot scanner','Evidence input','Builds the first-party source findings before calling OpenAI.'],
  ['Supabase','Session authorization','Checks your owner login and EIG membership; schema evidence is a dated snapshot.'],
  ['Vercel','Hosting','Runs the owner-protected preview API.'],
 ]:kind==='inspector'?[
  ['ElevationPilot IA inspector','Runs here','Checks four approved InceptionApex source/test files in the deployed preview.'],
  ['GitHub','Code origin','Reads the deployed code copy; no new GitHub fetch is made by this scan.'],
  ['Supabase','Session authorization','Verifies the owner login and current EIG membership.'],
  ['Vercel','Hosting','Runs the protected source-inspection endpoint.'],
 ]:SOURCE_TOOLS;
 return <details className="bl-scanner-tools">
  <summary>Tools used by this scanner</summary>
  <p>{kind==='radar'?'Upgrade Radar applies built-in rules to first-party evidence and static standards references. It does not run AI or visit competitor sites.':'This describes the current implementation. A configured integration is not proof that a scan or test completed.'}</p>
  <dl>{rows.map(([name,status,description])=><div key={name}><dt><strong>{name}</strong> <span>{status}</span></dt><dd>{description}</dd></div>)}</dl>
  <h4>Planned connections</h4>
  <dl>{PLANNED.map(([name,status,description])=><div key={name}><dt><strong>{name}</strong> <span>{status}</span></dt><dd>{description}</dd></div>)}</dl>
  <p>Opening this dropdown does not run a tool or make an AI request.</p>
 </details>;
}
