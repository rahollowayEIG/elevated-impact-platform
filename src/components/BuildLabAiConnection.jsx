import React,{useState} from 'react';
export default function BuildLabAiConnection({supabaseClient}) {
 const [busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('');
 async function testConnection(){
  if(busy)return;
  setBusy(true);setError('');setResult(null);
  try{
   if(!supabaseClient)throw Error('Sign in to EIG before testing.');
   const {data,error:authError}=await supabaseClient.auth.getSession();
   const token=data?.session?.access_token;
   if(authError||!token)throw Error('Your session expired. Please sign in again.');
   const res=await fetch('/api/eig-build-lab-ai-probe',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:'{}'
   });
   const payload=await res.json().catch(()=>({}));
   if(!res.ok||payload.ok!==true)throw Error(payload.message||'AI connection did not complete. Verify preview access and configuration.');
   setResult({model:payload.model,input:payload.usage?.input_tokens??0,output:payload.usage?.output_tokens??0});
  }catch(e){setError(e.message||'Connection unavailable.');}
  finally{setBusy(false);}
 }
 return <section className="platform-section-card" aria-labelledby="bl-ai-title">
   <h2 id="bl-ai-title">OpenAI Connection</h2>
   <p>Owner-only preview diagnostic. Sends fixed test text through the EIG Vercel backend. Does not upload code, customer information or event data.</p>
   <button type="button" className="platform-primary-button" disabled={busy} onClick={testConnection}>{busy?'Testing connection…':'Test OpenAI Connection'}</button>
   {error&&<p role="alert" className="platform-error">{error}</p>}
   {result&&<p role="status">Connected successfully · {result.model} · Input tokens: {result.input} · Output tokens: {result.output}. No application changes were made.</p>}
 </section>;
}
