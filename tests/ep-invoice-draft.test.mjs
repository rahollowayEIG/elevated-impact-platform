import test from "node:test";
import assert from "node:assert/strict";
import {
 EP_INVOICE_ISSUERS,EP_INVOICE_SOURCES,EP_INVOICE_SAFETY,
 parseInvoiceCents,invoiceLine,prepareDemoInvoice,ensureDemoInvoice,
 approveDemoInvoice,simulateInvoicePayment,manualInvoiceEmailCopy,manualInvoiceTextCopy
} from "../src/lib/epInvoiceDraft.mjs";

const sample=(changes={})=>prepareDemoInvoice({
 issuerId:"demo-eig",customerName:"Sample Golf Sponsor",customerEmail:"",
 sourceType:"sponsorship",reference:"Synthetic Tournament",
 notes:"Demo review only.",issueDate:"2026-10-21",dueDate:"2026-11-20",
 taxBasisPoints:0,lines:[{label:"Hole sponsor",quantity:2,unitCents:12500}],...changes
});
test("safe invoice metadata permits multiple fictional issuers and app sources",()=>{
 assert.deepEqual(EP_INVOICE_ISSUERS.map(x=>x.id),["demo-eig","demo-hangar","demo-nonprofit"]);
 assert.ok(EP_INVOICE_SOURCES.some(x=>x.id==="advertising"));
 assert.ok(EP_INVOICE_SOURCES.some(x=>x.id==="sponsorship"));
 assert.deepEqual(EP_INVOICE_SAFETY,{
  scenario:"owner_preview_only",fictionalIssuers:true,issuerVerified:false,
  realInvoiceIssued:false,realInvoiceNumberAllocated:false,customerRecordsRead:false,
  databaseWrites:false,cardCharged:false,actualPaymentRecorded:false,
  emailSent:false,textSent:false,publicPaymentLinksCreated:false,
  legalTaxRateVerified:false,automaticReminders:false
 });
});
test("exact cents parsing avoids unsafe floating point and rejects malformed amounts",()=>{
 assert.equal(parseInvoiceCents("0"),0);
 assert.equal(parseInvoiceCents("0.01"),1);
 assert.equal(parseInvoiceCents("125.30"),12530);
 assert.equal(parseInvoiceCents("125.3"),12530);
 for(const v of ["12.345","$125.00","1,250.00","-1","1e3","foo","","10.","900000000"])
  assert.throws(()=>parseInvoiceCents(v),/Enter|exceeds/);
});
test("invoice totals account for quantities and illustrative tax without ever being issued",()=>{
 const d=sample({
  taxBasisPoints:700,
  lines:[
   {label:"Sponsor signage",quantity:3,unitCents:10001},
   {label:"Design services",quantity:1,unitCents:1499}
  ]
 });
 assert.equal(d.subtotalCents,31502);
 assert.equal(d.taxCents,2205);
 assert.equal(d.totalCents,33707);
 assert.equal(d.balanceExampleCents,33707);
 assert.equal(d.status,"draft_not_issued");
 assert.equal(d.invoiceNumber,null);
 assert.equal(d.actualInvoiceIssued,false);
 assert.equal(d.actualTaxVerified,false);
 assert.equal(d.realCustomerContacted,false);
 assert.equal(d.publicInvoiceUrl,null);
 assert.equal(d.publicPaymentUrl,null);
 assert.equal(d.verifiedPaidCents,0);
 assert.equal(d.simulatedPaymentCents,0);
 assert.equal(ensureDemoInvoice(d),d);
});
test("due dates, tax rate and issuer are validated before creating drafts",()=>{
 assert.throws(()=>sample({issueDate:"2026-02-30"}),/valid issue/);
 assert.throws(()=>sample({dueDate:"2026-10-20"}),/valid issue/);
 assert.throws(()=>sample({issuerId:"real-company"}),/sample issuer/);
 assert.throws(()=>sample({sourceType:"unknown"}),/invoice source/);
 assert.throws(()=>sample({taxBasisPoints:-1}),/Illustrative tax/);
 assert.throws(()=>sample({taxBasisPoints:2501}),/Illustrative tax/);
 assert.throws(()=>sample({customerEmail:"not-email"}),/valid example email/);
 assert.throws(()=>sample({customerName:""}),/Recipient/);
 assert.throws(()=>sample({lines:[]}),/Add 1–30/);
});
test("line items reject invalid or unexpectedly large monetary inputs",()=>{
 assert.throws(()=>invoiceLine({label:"A",quantity:1,unitCents:100}),/at least 2/);
 assert.throws(()=>invoiceLine({label:"Service",quantity:0,unitCents:100}),/Quantity/);
 assert.throws(()=>invoiceLine({label:"Service",quantity:1.5,unitCents:100}),/Quantity/);
 assert.throws(()=>invoiceLine({label:"Service",quantity:1,unitCents:-100}),/price/);
 assert.throws(()=>invoiceLine({label:"Service",quantity:10,unitCents:50_000_000}),/limit/);
 assert.throws(()=>sample({lines:[{label:"Service",quantity:1,unitCents:100},
    {label:"Service",quantity:1,unitCents:100,id:"demo-line-12345678-1234-4234-a234-123456789012"}].map((x,i)=>i===0?{...x,id:"demo-line-12345678-1234-4234-a234-123456789012"}:x)}),
   /Duplicate line IDs/);
});
test("approval is local-only and does not change draft into an actual invoice",()=>{
 const a=sample(),b=approveDemoInvoice(a);
 assert.equal(b.status,"approved_in_demo_not_issued");
 assert.equal(b.invoiceNumber,null);
 assert.equal(b.actualInvoiceIssued,false);
 assert.equal(b.realCustomerContacted,false);
 assert.equal(b.publicInvoiceUrl,null);
 assert.equal(b.verifiedPaidCents,0);
 assert.throws(()=>approveDemoInvoice(b),/Only unapproved/);
});
test("simulated partial payments never record verified revenue or contact customers",()=>{
 const a=approveDemoInvoice(sample());
 assert.throws(()=>simulateInvoicePayment(sample(),100),/Review the demo invoice/);
 assert.throws(()=>simulateInvoicePayment(a,0),/positive/);
 assert.throws(()=>simulateInvoicePayment(a,25001),/positive/);
 const b=simulateInvoicePayment(a,10000);
 assert.equal(b.simulatedPaymentCents,10000);
 assert.equal(b.balanceExampleCents,15000);
 assert.equal(b.verifiedPaidCents,0);
 const c=simulateInvoicePayment(b,15000);
 assert.equal(c.balanceExampleCents,0);
 assert.equal(c.verifiedPaidCents,0);
 assert.equal(c.realPaymentStatus,"not_connected");
 assert.throws(()=>simulateInvoicePayment(c,1),/positive/);
});
test("email and SMS samples are only copyable placeholders, not real communication",()=>{
 const d=sample();
 const email=manualInvoiceEmailCopy(d),sms=manualInvoiceTextCopy(d);
 assert.match(email,/DEMO ONLY/);
 assert.match(email,/Sample Golf Sponsor/);
 assert.match(email,/Hole sponsor/);
 assert.match(email,/Example total: \$250\.00/);
 assert.match(email,/No payment is being requested/);
 assert.match(sms,/DEMO ONLY/);
 assert.match(sms,/Not issued, payable or sent/);
 assert.ok(!email.includes("mailto:"));
 assert.ok(!sms.includes("sms:"));
});
test("injected invoice, payment or payout claims never pass preview validation",()=>{
 const d=sample();
 for(const patch of [
  {invoiceNumber:"2026-EIG-00001"}, {actualInvoiceIssued:true},
  {realPaymentStatus:"paid"},{verifiedPaidCents:25000},
  {realCustomerContacted:true},{publicInvoiceUrl:"https://example.com/pay"},
  {customerEmail:"recipient@invalid"},{subtotalCents:0},{balanceExampleCents:0},
  {simulatedPaymentCents:25001},{taxCents:9999}
 ]) assert.throws(()=>ensureDemoInvoice({...d,...patch}),/Invalid|valid example/);
});
