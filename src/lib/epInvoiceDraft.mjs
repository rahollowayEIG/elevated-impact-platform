// ElevationPilot Universal Invoicing: safe, deterministic manual invoice prototype.
// Owner-only Build Lab DEMO. No database, issuer verification, real invoice number,
// payment, email, SMS, persistent ledger, tax service, or payment provider calls.
export const EP_INVOICE_ISSUERS=Object.freeze([
 {id:"demo-eig",label:"Elevated Impact Group (sample issuer)",kind:"eig"},
 {id:"demo-hangar",label:"Example Hangar Business (fictional issuer)",kind:"hangar"},
 {id:"demo-nonprofit",label:"Example Nonprofit Organization (fictional issuer)",kind:"nonprofit"},
]);
export const EP_INVOICE_SOURCES=Object.freeze([
 {id:"manual",label:"Manual service or product"},
 {id:"event",label:"Event / outing"},
 {id:"sponsorship",label:"Sponsorship"},
 {id:"advertising",label:"Advertising / printing"},
 {id:"store",label:"Hangar Store / Vendor"},
 {id:"other",label:"Other"},
]);
export const EP_INVOICE_SAFETY=Object.freeze({
 scenario:"owner_preview_only",fictionalIssuers:true,issuerVerified:false,
 realInvoiceIssued:false,realInvoiceNumberAllocated:false,customerRecordsRead:false,
 databaseWrites:false,cardCharged:false,actualPaymentRecorded:false,
 emailSent:false,textSent:false,publicPaymentLinksCreated:false,
 legalTaxRateVerified:false,automaticReminders:false
});
const CURRENCIES=new Set(["USD"]);
const ISSUERS=new Set(EP_INVOICE_ISSUERS.map(x=>x.id));
const SOURCES=new Set(EP_INVOICE_SOURCES.map(x=>x.id));
const MAX_LINES=30,MAX_UNIT_CENTS=50_000_000,MAX_INVOICE_CENTS=200_000_000;
export const centsDisplay=x=>(x/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
const name=(x,max=120)=>typeof x==="string"?x.replace(/\s+/g," ").trim().slice(0,max):"";
function nonEmpty(x,label,max){const out=name(x,max);if(out.length<2)throw Error(label+" must be at least 2 characters.");return out;}
function validDate(x){
 if(typeof x!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
 const d=new Date(x+"T00:00:00Z");
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===x;
}
export function parseInvoiceCents(input){
 const s=String(input??"").trim();
 if(!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s))throw Error("Enter a nonnegative dollar amount with up to 2 decimal places.");
 const parts=s.split(".");
 const cents=Number(parts[0])*100+Number((parts[1]||"").padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents>MAX_UNIT_CENTS)throw Error("Amount exceeds the sample invoice limit.");
 return cents;
}
export function invoiceLine({id,label,quantity,unitCents}={}){
 const cleanLabel=nonEmpty(label,"Line item",160);
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)throw Error("Quantity must be between 1 and 10,000.");
 if(!Number.isSafeInteger(unitCents)||unitCents<0||unitCents>MAX_UNIT_CENTS)
  throw Error("Enter an example unit price from $0 to $500,000.");
 const lineId=typeof id==="string"&&/^demo-line-[0-9a-f-]{36}$/i.test(id)?
  id:"demo-line-"+crypto.randomUUID();
 const total=quantity*unitCents;
 if(!Number.isSafeInteger(total)||total>MAX_INVOICE_CENTS)throw Error("Line item exceeds the example invoice limit.");
 return {id:lineId,label:cleanLabel,quantity,unitCents,totalCents:total};
}
function safeBill({issuerId,customerName,customerEmail,sourceType,reference,notes,issueDate,dueDate,taxBasisPoints,lines}={}){
 if(!ISSUERS.has(issuerId))throw Error("Choose a sample issuer.");
 if(!SOURCES.has(sourceType))throw Error("Select an invoice source.");
 if(!CURRENCIES.has("USD"))throw Error("Unsupported currency.");
 if(!validDate(issueDate)||!validDate(dueDate)||dueDate<issueDate)throw Error("Enter valid issue and due dates, with due date on or after issue date.");
 if(!Number.isInteger(taxBasisPoints)||taxBasisPoints<0||taxBasisPoints>2500)
  throw Error("Illustrative tax rate must be between 0% and 25%.");
 if(typeof customerEmail!=="string"||customerEmail.length>160||
   (customerEmail!==""&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)))
  throw Error("Enter a valid example email or leave it empty.");
 const recipient=nonEmpty(customerName,"Recipient",140);
 if(!Array.isArray(lines)||lines.length<1||lines.length>MAX_LINES)
  throw Error("Add 1–30 line items.");
 const normalized=lines.map(x=>invoiceLine(x));
 if(new Set(normalized.map(x=>x.id)).size!==normalized.length)throw Error("Duplicate line IDs are not allowed.");
 const subtotal=normalized.reduce((n,x)=>n+x.totalCents,0);
 if(!Number.isSafeInteger(subtotal)||subtotal>MAX_INVOICE_CENTS)throw Error("Invoice subtotal exceeds the example limit.");
 const tax=Math.round(subtotal*taxBasisPoints/10000);
 if(subtotal+tax>MAX_INVOICE_CENTS)throw Error("Invoice total exceeds the example limit.");
 return {
  issuerId,issuerLabel:EP_INVOICE_ISSUERS.find(x=>x.id===issuerId).label,
  recipient,customerEmail:customerEmail.trim(),sourceType,
  reference:name(reference,100),notes:name(notes,500),
  issueDate,dueDate,taxBasisPoints,lines:normalized,
  currency:"USD",subtotalCents:subtotal,taxCents:tax,totalCents:subtotal+tax
 };
}
export function prepareDemoInvoice(input){
 const bill=safeBill(input);
 return {
  kind:"ep_manual_invoice_preview",schemaVersion:1,
  id:"demo-invoice-"+crypto.randomUUID(),
  status:"draft_not_issued",invoiceNumber:null,
  ...bill,
  simulatedPaymentCents:0,verifiedPaidCents:0,
  realPaymentStatus:"not_connected",
  balanceExampleCents:bill.totalCents,
  realCustomerContacted:false,
  publicInvoiceUrl:null,publicPaymentUrl:null,
  actualInvoiceIssued:false,actualTaxVerified:false,
  source:"fictional_or_user_entered_preview_not_persisted",
  approvalRequired:true,
  privacy:"in_browser_memory_only",
  disclaimer:"DEMO ONLY. This is not an issued invoice, payment request or tax-valid document. No message or payment has been sent."
 };
}
export function ensureDemoInvoice(d){
 if(!d||d.kind!=="ep_manual_invoice_preview"||d.schemaVersion!==1||
   !/^demo-invoice-[0-9a-f-]{36}$/i.test(d.id||"")||
   !["draft_not_issued","approved_in_demo_not_issued"].includes(d.status)||
   d.invoiceNumber!==null||
   d.actualInvoiceIssued!==false||d.actualTaxVerified!==false||
   d.publicPaymentUrl!==null||d.publicInvoiceUrl!==null||
   d.verifiedPaidCents!==0||d.realPaymentStatus!=="not_connected"||
   d.realCustomerContacted!==false||d.approvalRequired!==true||
   d.privacy!=="in_browser_memory_only"||
   d.source!=="fictional_or_user_entered_preview_not_persisted")
   throw Error("Invalid or unsafe manual invoice preview.");
 const normalized=safeBill(d);
 if(d.issuerLabel!==normalized.issuerLabel||
   d.recipient!==normalized.recipient||
   d.subtotalCents!==normalized.subtotalCents||
   d.taxCents!==normalized.taxCents||
   d.totalCents!==normalized.totalCents||
   JSON.stringify(d.lines)!==JSON.stringify(normalized.lines)||
   !Number.isSafeInteger(d.simulatedPaymentCents)||
   d.simulatedPaymentCents<0||d.simulatedPaymentCents>d.totalCents||
   d.balanceExampleCents!==d.totalCents-d.simulatedPaymentCents)
   throw Error("Invalid or unsafe manual invoice preview.");
 return d;
}
export function approveDemoInvoice(d){
 ensureDemoInvoice(d);
 if(d.status!=="draft_not_issued")throw Error("Only unapproved drafts can be approved in this demo.");
 return {...d,status:"approved_in_demo_not_issued",actualInvoiceIssued:false,
  invoiceNumber:null,realCustomerContacted:false,publicInvoiceUrl:null};
}
export function simulateInvoicePayment(d,amountCents){
 ensureDemoInvoice(d);
 if(d.status!=="approved_in_demo_not_issued")throw Error("Review the demo invoice before simulating payment.");
 if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>d.balanceExampleCents)
  throw Error("Simulated payment must be positive and no greater than the example balance.");
 return {...d,simulatedPaymentCents:d.simulatedPaymentCents+amountCents,
  balanceExampleCents:d.balanceExampleCents-amountCents,
  verifiedPaidCents:0,realPaymentStatus:"not_connected"};
}
export function manualInvoiceEmailCopy(d){
 ensureDemoInvoice(d);
 const rows=d.lines.map(x=>x.quantity+" × "+x.label+": "+centsDisplay(x.totalCents)).join("\n");
 return [
  "DEMO ONLY | MANUAL INVOICE PREVIEW",
  "From: "+d.issuerLabel,
  "To: "+d.recipient,
  "Reference: "+(d.reference||"Unassigned"),
  "Invoice date: "+d.issueDate,
  "Due date: "+d.dueDate,
  "",rows,
  "Subtotal: "+centsDisplay(d.subtotalCents),
  "Illustrative tax (not verified): "+centsDisplay(d.taxCents),
  "Example total: "+centsDisplay(d.totalCents),
  "This is an unissued demo draft. No payment is being requested."
 ].join("\n");
}
export function manualInvoiceTextCopy(d){
 ensureDemoInvoice(d);
 return "DEMO ONLY: Invoice preview for "+d.recipient+
  " from "+d.issuerLabel+". Example total "+centsDisplay(d.totalCents)+
  ", due "+d.dueDate+". Not issued, payable or sent.";
}
