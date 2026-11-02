'use strict';
// Strictly bounded server-side reads after owner authentication.
// Never select google_oauth_tokens, access_token, refresh_token, auth.users,
// customer records, social campaign content or Hangar personnel information.
const {createClient}=require('@supabase/supabase-js');
const {LIMITS}=require('./eig-build-lab-hangar-connections.cjs');
const LIVE_URL='https://aszixzrdayrivungodwq.supabase.co';
async function limited(query,limit){
 const {data,error}=await query.limit(limit+1);
 if(error||!Array.isArray(data)||data.length>limit)throw Error('Hangar inventory read incomplete.');
 return data;
}
async function readHangarConnectionSnapshot(env=name=>process.env[name],clientFactory=createClient){
 const url=env('VITE_SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
 if(url!==LIVE_URL||typeof key!=='string'||!key||typeof clientFactory!=='function')
  throw Error('Live Hangar inventory backend is not configured.');
 const client=clientFactory(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const organizations=await limited(client.from('organizations')
  .select('id,name,slug,organization_type,status,is_test')
  .order('name'),LIMITS.organizations);
 if(!organizations.length)return {organizations,channels:[],driveMappings:[],campaigns:[]};
 const ids=organizations.map(x=>x.id);
 const [channels,driveMappings,campaigns]=await Promise.all([
  limited(client.from('squawk_channel_connections')
   .select('organization_id,channel,provider,connection_status,compliance_status,last_verified_at')
   .in('organization_id',ids),LIMITS.related),
  limited(client.from('platform_google_drive_folders')
   .select('organization_id,folder_key').in('organization_id',ids),LIMITS.related),
  limited(client.from('social_campaigns')
   .select('id,organization_id').in('organization_id',ids),LIMITS.related)
 ]);
 return {organizations,channels,driveMappings,campaigns};
}
module.exports={readHangarConnectionSnapshot};
