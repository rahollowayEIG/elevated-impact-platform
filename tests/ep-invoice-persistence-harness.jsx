import React from 'react';
import {createRoot} from 'react-dom/client';
import EpInvoicePersistence from '../src/components/EpInvoicePersistence.jsx';
import {prepareDemoInvoice} from '../src/lib/epInvoiceDraft.mjs';
import {invoiceSandboxStore} from '../src/lib/epInvoicePersistence.mjs';
import {supabase} from '../src/lib/supabase';
const draft=prepareDemoInvoice({issuerId:'demo-eig',customerName:'Fictional Browser Sponsor',customerEmail:'',sourceType:'sponsorship',reference:'Browser Sandbox test',notes:'Fictional only',issueDate:'2026-10-21',dueDate:'2026-11-20',taxBasisPoints:0,lines:[{label:'Fictional Sponsor Package',quantity:1,unitCents:10000},{label:'One-time fictional service',quantity:1,unitCents:100}]});
const store=invoiceSandboxStore(supabase,'30000000-0000-0000-0000-000000000001');
createRoot(document.getElementById('root')).render(<EpInvoicePersistence draft={draft} store={store}/>);
