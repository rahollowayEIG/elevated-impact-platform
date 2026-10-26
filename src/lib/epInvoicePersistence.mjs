import {ensureDemoInvoice} from './epInvoiceDraft.mjs';
export const INVOICE_SANDBOX_URL='https://publruuuyvpggogrrgwp.supabase.co';
export function invoiceSandboxEnabled(env={}) {
 return env.VITE_EP_INVOICE_SANDBOX_ENABLED==='true' && env.VITE_SUPABASE_URL===INVOICE_SANDBOX_URL;
}
// Caller bearer/RLS only. The database independently checks owner, current session,
// current EIG membership, Sandbox issuer and explicit test-organization allowlist.
export function invoiceSandboxStore(client,organizationId) {
 async function command(action,data={}) {
  const {data:result,error}=await client.rpc('ep_sandbox_invoice_command',{
   p_org:organizationId,p_action:action,p_data:data
  });
  if(error)throw new Error(error.message||'Sandbox storage unavailable. Your preview is still here.');
  return result;
 }
 return {
  list:()=>command('list'),read:id=>command('read',{id}),
  save(invoice,fictionalConfirmed){
   ensureDemoInvoice(invoice);
   if(fictionalConfirmed!==true||invoice.customerEmail||invoice.simulatedPaymentCents||invoice.status!=='draft_not_issued')
    throw new Error('Confirm fictional details, leave email empty and save before demo approval or simulated payments.');
   return command('save',{id:crypto.randomUUID(),invoice,fictional_confirmed:true});
  },
  propose:(lineId,details,version=0)=>command('propose',{line_id:lineId,details,version}),
  approve:review=>command('approve',{id:review.id,version:review.version}),
  link:(review,productId)=>command('link',{id:review.id,version:review.version,product_id:productId}),
  dismiss:review=>command('dismiss',{id:review.id,version:review.version})
 };
}
