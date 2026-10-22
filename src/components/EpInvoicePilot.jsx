import React,{useMemo,useState} from "react";
import {
 EP_INVOICE_ISSUERS,EP_INVOICE_SOURCES,EP_INVOICE_SAFETY,
 centsDisplay,parseInvoiceCents,prepareDemoInvoice,approveDemoInvoice,
 simulateInvoicePayment,manualInvoiceEmailCopy,manualInvoiceTextCopy
} from "../lib/epInvoiceDraft.mjs";
import "./ep-invoice-pilot.css";

const currentDate=()=>new Date().toISOString().slice(0,10);
const dueDate=()=>{const d=new Date();d.setUTCDate(d.getUTCDate()+30);return d.toISOString().slice(0,10);};
function getRow(){return {id:"ui-line-"+crypto.randomUUID(),label:"",quantity:"1",unitPrice:"0.00"};}
function downloadInvoice(draft){
 const blob=new Blob([JSON.stringify({kind:"ep_manual_invoice_preview_export",demo:true,invoice:draft},null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");link.href=url;link.download="ep-manual-invoice-demo.json";
 document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),750);
}
export default function EpInvoicePilot(){
 const [issuerId,setIssuerId]=useState("demo-eig");
 const [sourceType,setSourceType]=useState("manual");
 const [reference,setReference]=useState("");
 const [recipient,setRecipient]=useState("Sample Customer");
 const [customerEmail,setCustomerEmail]=useState("");
 const [issued,setIssued]=useState(currentDate);
 const [due,setDue]=useState(dueDate);
 const [tax,setTax]=useState("0");
 const [notes,setNotes]=useState("Payment terms to be confirmed when real billing is enabled.");
 const [rows,setRows]=useState(()=>[{...getRow(),label:"Example service or sponsorship",unitPrice:"125.00"}]);
 const [draft,setDraft]=useState(null);
 const [payment,setPayment]=useState("25.00");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [copied,setCopied]=useState("");
 const canAdd=rows.length<30;
 const subtotal=useMemo(()=>{
  try{return rows.reduce((n,r)=>n+parseInvoiceCents(r.unitPrice)*Number(r.quantity),0);}
  catch{return null;}
 },[rows]);
 function invalidate(){setDraft(null);setNotice("");setError("");setCopied("");}
 function setText(setter,value){setter(value);invalidate();}
 function updateRow(id,key,value){
  setRows(old=>old.map(row=>row.id===id?{...row,[key]:value}:row));invalidate();
 }
 function addRow(){if(!canAdd)return;setRows(old=>[...old,getRow()]);invalidate();}
 function removeRow(id){
  if(rows.length===1)return;
  setRows(old=>old.filter(r=>r.id!==id));invalidate();
 }
 function generate(e){
  e.preventDefault();setError("");setNotice("");setCopied("");
  try{
   if(!Number.isInteger(Number(tax))||Number(tax)<0||Number(tax)>25)
    throw Error("Enter a whole-number illustrative tax percentage between 0 and 25.");
   const lines=rows.map(row=>{
    if(!/^\d+$/.test(row.quantity))throw Error("Enter a whole-number quantity.");
    return {label:row.label,quantity:Number(row.quantity),unitCents:parseInvoiceCents(row.unitPrice)};
   });
   const example=prepareDemoInvoice({issuerId,customerName:recipient,customerEmail,
    sourceType,reference,notes,issueDate:issued,dueDate:due,
    taxBasisPoints:Number(tax)*100,lines});
   setDraft(example);
   setNotice("Manual invoice preview created. Nothing was issued, sent, charged, or saved to the database.");
  }catch(err){setDraft(null);setError(err?.message||"Unable to prepare invoice preview.");}
 }
 function approve(){
  try{setDraft(old=>approveDemoInvoice(old));setNotice("Reviewed in demo only. This is not an issued invoice.");setError("");}
  catch(err){setError(err?.message||"Could not approve preview.");}
 }
 function mockPayment(){
  try{
   const amount=parseInvoiceCents(payment);
   setDraft(old=>simulateInvoicePayment(old,amount));
   setNotice("Example balance updated with SIMULATED funds only. No actual receipt or customer payment recorded.");
   setError("");
  }catch(err){setError(err?.message||"Invalid simulated payment.");}
 }
 async function copyText(kind){
  if(!draft)return;
  const text=kind==="email"?manualInvoiceEmailCopy(draft):manualInvoiceTextCopy(draft);
  try{
   if(typeof navigator.clipboard?.writeText!=="function")throw Error("Clipboard unavailable");
   await navigator.clipboard.writeText(text);
   setCopied(kind);setNotice("Sample "+kind+" wording copied. Open your messaging app and paste it manually. Nothing was sent.");
  }catch{
   setCopied(kind);setNotice("Clipboard access isn't available. Select the sample wording below and copy it manually.");
  }
  setError("");
 }
 return <section className="epi-root" aria-labelledby="epi-heading">
  <header className="epd-subhead">
   <div><h3 id="epi-heading">Manual Invoice Builder · Private Pilot</h3>
    <p>Try drafting, reviewing and preparing invoices for email, text or print. All invoice numbers, official sending and payments remain disabled until the financial backend is approved.</p></div>
   <span className="epd-counter">DEMO · NOT ISSUED</span>
  </header>
  <p className="epi-warning"><strong>Important:</strong> Only use fictional customers for now. This demo does not persist data, verify the legal payee or tax rate, allocate an official invoice number, issue a real bill, send email/text or record real payments.</p>
  <form className="epi-form" onSubmit={generate}>
   <div className="epi-fields">
    <label>Invoice issuer / Hangar
      <select value={issuerId} onChange={e=>setText(setIssuerId,e.target.value)}>
       {EP_INVOICE_ISSUERS.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}
      </select>
    </label>
    <label>Source / business activity
      <select value={sourceType} onChange={e=>setText(setSourceType,e.target.value)}>
       {EP_INVOICE_SOURCES.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
    </label>
    <label>Customer / billed organization
      <input value={recipient} onChange={e=>setText(setRecipient,e.target.value)} maxLength={140} required/>
    </label>
    <label>Customer email (optional sample)
      <input type="email" value={customerEmail} onChange={e=>setText(setCustomerEmail,e.target.value)} maxLength={160}
       placeholder="Leave empty in the demo"/>
    </label>
    <label>Reference / event
      <input value={reference} onChange={e=>setText(setReference,e.target.value)} maxLength={100}
       placeholder="Example event or sponsor reference"/>
    </label>
    <label>Illustrative tax rate (%), not verified
      <input type="number" value={tax} onChange={e=>setText(setTax,e.target.value)} min="0" max="25" step="1"/>
    </label>
    <label>Invoice date
      <input type="date" value={issued} onChange={e=>setText(setIssued,e.target.value)} required/>
    </label>
    <label>Due date
      <input type="date" value={due} onChange={e=>setText(setDue,e.target.value)} required/>
    </label>
   </div>
   <div className="epi-lines-heading">
     <h4>Example invoice line items ({rows.length})</h4>
     <button type="button" onClick={addRow} disabled={!canAdd} className="platform-secondary-button">+ Add line</button>
   </div>
   <div className="epi-input-lines">{rows.map((r,i)=><div className="epi-input-line" key={r.id}>
    <label>Item {i+1} / description<input value={r.label} onChange={e=>updateRow(r.id,"label",e.target.value)}
      maxLength={160} placeholder="Ad placement, sponsor package, event service…" required/></label>
    <label>Quantity<input inputMode="numeric" type="number" min="1" max="10000" step="1" value={r.quantity}
      onChange={e=>updateRow(r.id,"quantity",e.target.value)} required/></label>
    <label>Unit price ($)<input inputMode="decimal" value={r.unitPrice} onChange={e=>updateRow(r.id,"unitPrice",e.target.value)}
      placeholder="125.00" required/></label>
    <button type="button" onClick={()=>removeRow(r.id)} disabled={rows.length===1}
     aria-label={"Remove invoice item "+(i+1)}>Remove</button>
   </div>)}</div>
   <label className="epi-notes">Sample terms / notes<textarea rows={3} value={notes} onChange={e=>setText(setNotes,e.target.value)}
     maxLength={500}/></label>
   <div className="epi-total-line"><strong>Estimated subtotal</strong><strong>{subtotal===null||!Number.isSafeInteger(subtotal)?"Enter valid amounts":centsDisplay(subtotal)}</strong></div>
   <div className="epd-action-row">
    <button className="platform-primary-button" type="submit">Create manual invoice preview</button>
   </div>
  </form>
  {error&&<p className="platform-error" role="alert">{error}</p>}
  {notice&&<p className="epd-notice" role="status">{notice}</p>}
  {draft&&<div className="epi-preview-wrap">
   <div className="epi-print-preview" aria-label="Printable example invoice">
    <div className="epi-invoice-top"><div>
      <p className="epi-demo-label">ELEVATIONPILOT / SAMPLE ONLY</p>
      <h4>INVOICE PREVIEW</h4>
      <p>{draft.issuerLabel}</p>
     </div>
     <span>NOT ISSUED<br/>NO PAYMENT REQUEST</span>
    </div>
    <div className="epi-invoice-details">
     <div><small>Prepared for</small><strong>{draft.recipient}</strong>
       {draft.customerEmail&&<span>{draft.customerEmail}</span>}</div>
     <div><small>Demo ID</small><strong>{draft.id.slice(0,22)}</strong>
      <span>Date: {draft.issueDate}</span><span>Due: {draft.dueDate}</span></div>
     <div><small>Business source</small><strong>{EP_INVOICE_SOURCES.find(x=>x.id===draft.sourceType)?.label}</strong>
       <span>{draft.reference||"No example reference"}</span></div>
    </div>
    <table className="epi-table">
     <thead><tr><th>Line item</th><th>Quantity</th><th>Unit</th><th>Total</th></tr></thead>
     <tbody>{draft.lines.map(r=><tr key={r.id}>
       <td>{r.label}</td><td>{r.quantity}</td><td>{centsDisplay(r.unitCents)}</td>
       <td>{centsDisplay(r.totalCents)}</td>
      </tr>)}</tbody>
    </table>
    <div className="epi-summary">
      <div><span>Subtotal</span><strong>{centsDisplay(draft.subtotalCents)}</strong></div>
      <div><span>Illustrative tax (not jurisdiction-verified)</span><strong>{centsDisplay(draft.taxCents)}</strong></div>
      <div className="epi-grand"><span>Example total</span><strong>{centsDisplay(draft.totalCents)}</strong></div>
      <div><span>Simulated payments (not received)</span><strong>{centsDisplay(draft.simulatedPaymentCents)}</strong></div>
      <div><span>Example balance</span><strong>{centsDisplay(draft.balanceExampleCents)}</strong></div>
    </div>
    <p className="epi-preview-terms">{draft.notes}</p>
    <p className="epi-watermark">DEMO ONLY · NOT A REAL INVOICE · NO PAYMENT DUE</p>
   </div>
   <div className="epi-actions">
     <h4>Review & manual sharing workflow</h4>
     <p>Status: <strong>{draft.status.replaceAll("_"," ")}</strong>. These actions prepare the demo; none sends a bill or takes payment.</p>
     <div className="epd-action-row">
      {draft.status==="draft_not_issued"&&<button type="button" className="platform-primary-button"
        onClick={approve}>Approve preview in demo</button>}
      <button type="button" className="platform-secondary-button"
       onClick={()=>window.print()}>Print / Save as PDF (sample)</button>
      <button type="button" className="platform-secondary-button"
       onClick={()=>downloadInvoice(draft)}>Export draft JSON</button>
     </div>
     <div className="epi-sharing">
      <div><button type="button" className="platform-secondary-button"
       onClick={()=>copyText("email")}>Copy sample email wording</button>
       <button type="button" className="platform-secondary-button"
        onClick={()=>copyText("text")}>Copy sample text wording</button></div>
      {copied&&<label>{copied==="email"?"Sample email wording":"Sample text wording"}
        <textarea readOnly rows={copied==="email"?10:3}
         value={copied==="email"?manualInvoiceEmailCopy(draft):manualInvoiceTextCopy(draft)}/></label>}
     </div>
     {draft.status==="approved_in_demo_not_issued"&&<div className="epi-pay-test">
       <label>Example payment amount ($) (simulation only)
        <input inputMode="decimal" value={payment} onChange={e=>setPayment(e.target.value)}/></label>
       <button className="platform-secondary-button" type="button"
        disabled={draft.balanceExampleCents===0} onClick={mockPayment}>Simulate payment</button>
     </div>}
     <p className="epi-warning">No real invoice number, hosted payment link, email delivery, SMS provider or financial ledger is connected. For real billing, we must first configure verified issuer data, safe server storage and explicit delivery approvals.</p>
   </div>
  </div>}
  <p className="epi-foot">Private pilot safety: {EP_INVOICE_SAFETY.databaseWrites?"Writes enabled":"No database writes"} ·
   no customer contact · no official invoice issuance · no real credit/debit · this form clears on refresh.</p>
 </section>;
}
