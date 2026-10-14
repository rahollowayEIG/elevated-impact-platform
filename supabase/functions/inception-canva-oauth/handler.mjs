// Draft-only Canva Connect OAuth handler. Not deployed.
// POST /start requires a current EIG-admin session; GET /callback uses opaque one-use state.
// Each connection belongs to an existing platform account, never to the browser-supplied user.
const SCOPES = ["asset:read","asset:write","brandtemplate:content:read","brandtemplate:meta:read","design:content:read","design:content:write","design:meta:read","profile:read"].join(" ");
const CANVA_AUTH = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN = "https://api.canva.com/rest/v1/oauth/token";
const CANVA_USER = "https://api.canva.com/rest/v1/users/me";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
class PublicError extends Error { constructor(message,status=400){super(message);this.status=status;} }
function b64(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function unb64(value) { const s=atob(value.replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(s,c=>c.charCodeAt(0)); }
async function digest(value,crypt) { return new Uint8Array(await crypt.subtle.digest("SHA-256",encoder.encode(value))); }
async function hex(value,crypt) {return [...await digest(value,crypt)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function db(result) {if(result.error)throw new Error("Canva connection storage unavailable");return result.data;}
function html(message,status=200) {
  const safe = message.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  return new Response('<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>InceptionApex Canva</title><p>'+safe+'</p>',{
    status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; style-src 'none'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"}
  });
}
function json(body,status=200,origin) {return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...(origin?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})}});}
async function encrypt(refresh,key,crypt) {
  const raw=unb64(key);
  if(raw.length!==32)throw new Error("Invalid server encryption configuration");
  const secret=await crypt.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt"]);
  const iv=crypt.getRandomValues(new Uint8Array(12));
  const encrypted=new Uint8Array(await crypt.subtle.encrypt({name:"AES-GCM",iv},secret,encoder.encode(refresh)));
  return "v1."+b64(iv)+"."+b64(encrypted);
}
export function createCanvaOAuthHandler({admin,env,crypt=crypto,http=fetch,now=()=>Date.now()}) {
  return async function handle(req) {
    const url=new URL(req.url),origin=env("INCEPTION_CANVA_APP_ORIGIN");
    const callback=env("INCEPTION_CANVA_REDIRECT_URI");
    const enabled=env("INCEPTION_CANVA_OAUTH_ENABLED")==="true";
    const headers={"Cache-Control":"no-store"};
    if(req.method==="OPTIONS"){
      if(req.headers.get("Origin")!==origin) return new Response(null,{status:403});
      return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}});
    }
    if(!enabled) return json({error:"Canva connection is not available yet."},503);
    if(!origin || !/^https:\/\/[^/]+$/.test(origin) || !callback || !/^https:\/\//.test(callback) || !env("CANVA_CLIENT_ID") || !env("CANVA_CLIENT_SECRET") || !env("CANVA_OAUTH_ENCRYPTION_KEY"))return json({error:"Canva connection needs configuration."},503);
    try {
      if(url.pathname.endsWith("/start") && req.method==="POST"){
        if(req.headers.get("Origin")!==origin)throw new PublicError("This action must start in InceptionApex.",403);
        const access=req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
        if(!access)throw new PublicError("Sign in to ElevationPilot.",401);
        const {data:{user}={},error}=await admin.auth.getUser(access);
        if(error || !user)throw new PublicError("Your session has expired.",401);
        let session;
        try {const payload=JSON.parse(atob(access.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));session=payload.session_id;}catch{}
        if(!UUID.test(session||""))throw new PublicError("An active session is required.",403);
        const guard=await admin.rpc("platform_assert_active_admin",{p_actor_id:user.id,p_actor_session_id:session});
        if(guard.error)throw new PublicError("EIG team authorization is required.",403);
        const membership=db(await admin.from("organization_memberships").select("organization_id,role,status,access_starts_at,access_ends_at,organization:organizations(id,slug)").eq("user_id",user.id).eq("role","eig_admin").eq("status","active"));
        const row=membership.find(x=>x.organization?.slug==="elevated-impact-group" && (!x.access_starts_at||Date.parse(x.access_starts_at)<=now())&&(!x.access_ends_at||Date.parse(x.access_ends_at)>now()));
        if(!row)throw new PublicError("Only authorized EIG administrators can connect Canva during the pilot.",403);
        const state=b64(crypt.getRandomValues(new Uint8Array(32)));
        const verifier=b64(crypt.getRandomValues(new Uint8Array(32)));
        const challenge=b64(await digest(verifier,crypt));
        // Clear stale or abandoned requests for this same user before inserting, never other users.
        db(await admin.from("inception_canva_oauth_states").delete().eq("actor_user_id",user.id));
        db(await admin.from("inception_canva_oauth_states").insert({state_hash:await hex(state,crypt),actor_user_id:user.id,actor_session_id:session,organization_id:row.organization_id,code_verifier:verifier,expires_at:new Date(now()+600000).toISOString()}));
        const authorization=new URL(CANVA_AUTH);
        authorization.searchParams.set("client_id",env("CANVA_CLIENT_ID"));
        authorization.searchParams.set("redirect_uri",callback);
        authorization.searchParams.set("response_type","code");
        authorization.searchParams.set("scope",SCOPES);
        authorization.searchParams.set("state",state);
        authorization.searchParams.set("code_challenge",challenge);
        authorization.searchParams.set("code_challenge_method","S256");
        return json({authorization_url:authorization.toString()},200,origin);
      }
      if(url.pathname.endsWith("/callback") && req.method==="GET"){
        const state=url.searchParams.get("state")||"";
        const code=url.searchParams.get("code")||"";
        if(!/^[A-Za-z0-9_-]{43}$/.test(state))return html("Authorization link expired or invalid. Return to InceptionApex and try again.",400);
        const hashed=await hex(state,crypt);
        // Atomic claim: a previously consumed state cannot be used to exchange a code.
        const claimed=db(await admin.from("inception_canva_oauth_states").update({consumed_at:new Date(now()).toISOString()}).eq("state_hash",hashed).is("consumed_at",null).gt("expires_at",new Date(now()).toISOString()).select("*"));
        if(claimed.length!==1)return html("Authorization expired or has already been used. Return to InceptionApex and try again.",400);
        const row=claimed[0];
        if(url.searchParams.has("error")||!code||code.length>2048)return html("Canva authorization was canceled or unsuccessful. You can try again from InceptionApex.",400);
        // Browser session may have ended while authorizing. Check that the original
        // identity/session remains eligible before persisting any third-party token.
        const session=db(await admin.rpc("platform_assert_active_admin",{p_actor_id:row.actor_user_id,p_actor_session_id:row.actor_session_id}));
        void session;
        const membership=db(await admin.from("organization_memberships").select("organization_id,role,status,access_starts_at,access_ends_at,organization:organizations(id,slug)").eq("user_id",row.actor_user_id).eq("role","eig_admin").eq("status","active"));
        if(!membership.some(x=>x.organization_id===row.organization_id&&x.organization?.slug==="elevated-impact-group"&&(!x.access_starts_at||Date.parse(x.access_starts_at)<=now())&&(!x.access_ends_at||Date.parse(x.access_ends_at)>now())))return html("Your EIG access changed. Return to InceptionApex.",403);
        const credential=btoa(env("CANVA_CLIENT_ID")+":"+env("CANVA_CLIENT_SECRET"));
        const response=await http(CANVA_TOKEN,{method:"POST",headers:{"Authorization":"Basic "+credential,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:callback,code_verifier:row.code_verifier}),signal:AbortSignal.timeout(20000)});
        if(!response.ok)return html("Canva did not complete authorization. Return to InceptionApex and try again.",502);
        const token=await response.json();
        if(!token.refresh_token||!token.access_token || !Number.isFinite(token.expires_in)||!token.token_type || token.token_type.toLowerCase()!=="bearer")return html("Canva returned an incomplete authorization. Try again.",502);
        const userResponse=await http(CANVA_USER,{headers:{"Authorization":"Bearer "+token.access_token},signal:AbortSignal.timeout(20000)});
        if(!userResponse.ok)return html("Could not verify the Canva account. Try again.",502);
        const identity=await userResponse.json();
        const canvaUser=identity.team_user?.user_id;
        const canvaTeam=identity.team_user?.team_id;
        if(typeof canvaUser!=="string"||!canvaUser||typeof canvaTeam!=="string"||!canvaTeam)return html("Could not verify the Canva account. Try again.",502);
        const scopes=typeof token.scope==="string"?token.scope.split(/\s+/).filter(Boolean):[];
        const required=["asset:read","asset:write","design:content:read","design:content:write","design:meta:read","profile:read"];
        if(!required.every(x=>scopes.includes(x)))return html("Canva permissions were incomplete. Return to InceptionApex and reconnect.",403);
        const cipher=await encrypt(token.refresh_token,env("CANVA_OAUTH_ENCRYPTION_KEY"),crypt);
        db(await admin.from("inception_canva_connections").upsert({actor_user_id:row.actor_user_id,organization_id:row.organization_id,canva_user_id:canvaUser,canva_team_id:canvaTeam,encrypted_refresh_token:cipher,granted_scopes:scopes.join(" "),updated_at:new Date(now()).toISOString()},{onConflict:"actor_user_id"}));
        return html("Canva connected to InceptionApex. You can close this tab and return to your design workspace.");
      }
      return json({error:"Not found"},404);
    } catch (error) {
      if(url.pathname.endsWith("/callback"))return html("Canva authorization could not be completed. Return to InceptionApex and try again.",error.status&&error.status<500?error.status:500);
      return json({error:error instanceof PublicError?error.message:"Canva connection is temporarily unavailable."},error instanceof PublicError?error.status:500,origin);
    }
  };
}
