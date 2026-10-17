// A planning-only target contract. No website access or external requests.
export const TARGET_KINDS=Object.freeze(['website','mobile_app','github','software_product']);
export const RESEARCH_FOCUS=Object.freeze(['full','experience','technology','innovation']);
export const COMPARE_TO=Object.freeze(['event_builder','inception_apex','marketplace','build_lab','none']);
export function prepareResearchTarget(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Enter research details.');
 const {kind,focus,compareTo}=input;
 if(!TARGET_KINDS.includes(kind)||!RESEARCH_FOCUS.includes(focus)||!COMPARE_TO.includes(compareTo))throw Error('Choose a valid research type, focus and comparison.');
 if(typeof input.target!=='string'||!input.target.trim()||input.target.length>500)throw Error('Enter a target of up to 500 characters.');
 const target=input.target.trim();
 if(['website','github'].includes(kind)){
  let url;try{url=new URL(target);}catch{throw Error('Enter a full HTTPS URL.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal')||/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(url.hostname)||url.hostname.includes(':'))throw Error('Only public HTTPS references without credentials are permitted.');
  if(kind==='github'&&url.hostname!=='github.com')throw Error('Use a github.com repository URL.');
 }
 return {kind:'research_target_draft',schemaVersion:1,sourceType:kind,target,focus,compareTo,status:'draft_requires_review',readOnly:true,automaticCrawl:false,findings:[],caveat:'No website, application, API or repository was accessed. Public information must be verified, attributed and reviewed before use.'};
}
