import React from 'react';
import {createRoot} from 'react-dom/client';
import BuildLabLiveOwnerWorkspace from '../src/components/BuildLabLiveOwnerWorkspace.jsx';
import '../src/styles.css';
const owner='11111111-1111-4111-8111-111111111111';
const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-only-owner-token'}},error:null})}};
createRoot(document.getElementById('root')).render(<BuildLabLiveOwnerWorkspace ownerUserId={owner} supabaseClient={client} onBack={()=>{window.__buildLabReturned=true;}}/>);
