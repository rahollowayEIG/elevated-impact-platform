import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Content-Type":"application/json"};
const reply = (body: unknown,status=200) => new Response(JSON.stringify(body),{status,headers:cors});
const trim=(x:unknown)=>String(x??"").trim();
const email=(x:unknown)=>trim(x).toLowerCase();
const valid=(x:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
const access=(row:any)=>!!row&&row.status==="active"&&(!row.access_starts_at||Date.parse(row.access_starts_at)<=Date.now())&&(!row.access_ends_at||Date.parse(row.access_ends_at)>=Date.now());

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({success:false,error:"Method not allowed"},405);
  let team:any=null;
  let createdRows:any[]=[];
  let admin:any=null;
  try{
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!key)throw new Error("Server configuration missing.");
    const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
    if(!token)return reply({success:false,error:"Sign in required"},401);
    admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:ud,error:ue}=await admin.auth.getUser(token);
    if(ue||!ud?.user)return reply({success:false,error:"Invalid session"},401);
    const actor=ud.user;
    const body=await req.json();
    const eventId=trim(body.event_id),eventKey=trim(body.event_key);
    if(!eventId&&!eventKey)return reply({success:false,error:"Event required"},400);
    let q=admin.from("golf_registration_events").select("*");
    q=eventId?q.eq("id",eventId):q.eq("event_key",eventKey);
    const {data:event,error:ee}=await q.maybeSingle();
    if(ee)throw ee;
    if(!event)return reply({success:false,error:"Event not found"},404);
    const fs=event.field_settings||{};
    if(fs.registration_format!=="team")return reply({success:false,error:"Event is not a team-format registration"},400);
    const {data:profile}=await admin.from("profiles").select("role").eq("id",actor.id).maybeSingle();
    let authorized=profile?.role==="super_admin";
    if(!authorized){
      const {data:membership}=await admin.from("organization_memberships").select("role,status,access_starts_at,access_ends_at").eq("organization_id",event.organization_id).eq("user_id",actor.id).in("role",["eig_admin","organization_admin","organization_staff"]).maybeSingle();
      authorized=access(membership);
    }
    if(!authorized){
      const {data:assignment}=await admin.from("event_assignments").select("role,status,access_starts_at,access_ends_at").eq("event_id",event.id).eq("user_id",actor.id).eq("role","event_coordinator").maybeSingle();
      authorized=access(assignment);
    }
    if(!authorized)return reply({success:false,error:"Authorized ATC or Pilot access required"},403);
    const captain=body.captain||{},teammates=Array.isArray(body.teammates)?body.teammates:[];
    const first=trim(captain.first_name),last=trim(captain.last_name),captainEmail=email(captain.email),phone=trim(captain.phone);
    if(!first||!last||!valid(captainEmail)||!phone)return reply({success:false,error:"Captain name, valid email and phone required"},400);
    const size=Math.max(1,Math.min(32,Number(fs.team_size||4)));
    if(teammates.length>size-1)return reply({success:false,error:"Too many teammates"},400);
    const players=[{...captain,first_name:first,last_name:last,email:captainEmail,phone}];
    const seen=new Set([captainEmail]);
    for(const p of teammates){
      const fn=trim(p?.first_name),ln=trim(p?.last_name),em=email(p?.email);
      if(fn||ln||em){
        if(!fn||!ln||!valid(em))return reply({success:false,error:"Every named teammate needs first name, last name, and valid email"},400);
        if(seen.has(em))return reply({success:false,error:"Duplicate emails on the team"},400);
        seen.add(em);
        players.push({first_name:fn,last_name:ln,email:em});
      }else players.push({first_name:"TBA",last_name:"Reserved",email:null,tba:true});
    }
    while(players.length<size)players.push({first_name:"TBA",last_name:"Reserved",email:null,tba:true});
    if(fs.allow_partial_team===false&&players.some(p=>p.tba))return reply({success:false,error:"This event requires all team members"},400);
    const emails=[...seen];
    const {data:existing,error:de}=await admin.from("golf_registrations").select("email").eq("event_id",event.id).in("email",emails).neq("registration_status","cancelled");
    if(de)throw de;
    if(existing?.length)return reply({success:false,error:"A golfer email already exists in this event. Review the roster before adding the team.",duplicates:existing},409);
    const price=Number(body.team_price??(trim(captain.membership_status)==="Non-Member"?event.non_member_price:event.member_price)??0);
    if(!Number.isFinite(price)||price<0)return reply({success:false,error:"Invalid team price"},400);
    const paymentStatus=trim(body.payment_status);
    if(!["pending","paid","comp"].includes(paymentStatus))return reply({success:false,error:"Invalid payment status"},400);
    if(paymentStatus==="comp"&&!trim(body.reason))return reply({success:false,error:"Comp reason required"},400);
    // Captain account, when previously claimed, is linked through existing passenger identity.
    let captainUserId:string|null=null,passengerId:string|null=null;
    const {data:contacts,error:ce}=await admin.from("passenger_contacts").select("passenger_id").eq("contact_type","email").eq("normalized_value",captainEmail).eq("is_active",true).limit(1);
    if(ce)throw ce;
    if(contacts?.[0]?.passenger_id){
      const {data:passenger,error:pe}=await admin.from("passengers").select("id,auth_user_id,status").eq("id",contacts[0].passenger_id).maybeSingle();
      if(pe)throw pe;
      if(passenger?.status!=="merged"){passengerId=passenger?.id||null;captainUserId=passenger?.auth_user_id||null;}
    }
    const now=new Date().toISOString();
    for(let attempt=0;attempt<5&&!team;attempt++){
      const {data:prior,error:pr}=await admin.from("golf_registration_teams").select("entry_number").eq("event_id",event.id);
      if(pr)throw pr;
      const next=String(Math.max(0,...(prior||[]).map((t:any)=>parseInt(t.entry_number,10)||0))+1);
      const {data:created,error:te}=await admin.from("golf_registration_teams").insert({
        organization_id:event.organization_id,event_id:event.id,team_id:next,entry_number:next,
        team_name:trim(body.team_name)||null,team_size:size,captain_user_id:captainUserId,
        payment_mode:"captain_all",allow_partial_team:fs.allow_partial_team!==false,
        status:players.some(p=>p.tba)?"roster_incomplete":"roster_complete"
      }).select("*").single();
      if(!te)team=created;else if(te.code!=="23505")throw te;
    }
    if(!team)return reply({success:false,error:"Could not allocate a Team / Entry #"},409);
    const rows=players.map((p:any,i:number)=>({
      organization_id:event.organization_id,event_id:event.id,event_key:event.event_key,event_name:event.name,
      team_id:team.team_id,entry_number:team.entry_number,first_name:p.first_name,last_name:p.last_name,
      email:p.email||null,phone:i===0?phone:null,
      date_of_birth:i===0?(trim(captain.date_of_birth)||null):null,
      gender:i===0?(trim(captain.gender)||null):null,division:i===0?(trim(captain.division)||null):null,
      membership_status:i===0?(trim(captain.membership_status)||"Member"):"Member",
      ghin_number:i===0?(trim(captain.ghin_number)||null):null,
      custom_fields:i===0?(captain.custom_fields||{}):(p.tba?{reserved_tba:true}:{}),
      price:i===0?price:0,payment_status:paymentStatus==="paid"?"paid":paymentStatus==="comp"?"comp":"pending",
      payment_reference:i===0?(paymentStatus==="paid"?"clubhouse":paymentStatus==="comp"?"comp":"admin_manual"):"team_member",
      amount_paid:paymentStatus==="paid"?(i===0?price:0):paymentStatus==="comp"?0:null,
      paid_at:paymentStatus==="paid"||paymentStatus==="comp"?now:null,
      payment_method:paymentStatus==="paid"?"clubhouse":null,
      registration_status:"active",registration_source:"admin_manual",
      user_id:i===0?captainUserId:null,passenger_id:i===0?passengerId:null,
      passenger_claim_status:i===0&&captainUserId?"claimed":"unclaimed",
      passenger_claimed_at:i===0&&captainUserId?now:null,
      spot_hold_status:"none",deadline_charge_status:"not_applicable",admin_note:trim(body.reason)||null,
      admin_updated_by:actor.id,admin_updated_at:now
    }));
    const {data:inserted,error:ie}=await admin.from("golf_registrations").insert(rows).select("*");
    if(ie)throw ie;
    createdRows=inserted||[];
    const {error:ue2}=await admin.from("golf_registration_teams").update({captain_registration_id:createdRows[0].id}).eq("id",team.id);
    if(ue2){ await admin.from("golf_registrations").delete().in("id",createdRows.map((r:any)=>r.id)); createdRows=[]; throw ue2; }
    const warnings:string[]=[];
    for(const member of createdRows.slice(1)){
      if(!member.email)continue;
      try{
        const invitation=await fetch(url+"/functions/v1/golf-team-member",{method:"POST",headers:{"apikey":key,"Content-Type":"application/json"},body:JSON.stringify({action:"invite",team_id:team.id,registration_id:member.id,app_origin:"https://elevated-impact-platform.vercel.app"})});
        const result=await invitation.json().catch(()=>({}));
        if(!invitation.ok||!result.email_sent)warnings.push(member.email+": invitation not sent");
      }catch{warnings.push(member.email+": invitation failed");}
    }
    // Manual captains use the SAME six-digit email-code account flow as normal golfers.
    // A team-spot invitation claims the existing roster row, without another registration.
    if(!captainUserId){
      try{
        const invite=await fetch(url+"/functions/v1/golf-team-member",{
          method:"POST",
          headers:{"apikey":key,"Content-Type":"application/json"},
          body:JSON.stringify({
            action:"invite",team_id:team.id,registration_id:createdRows[0].id,
            app_origin:"https://elevated-impact-platform.vercel.app"
          })
        });
        const result=await invite.json().catch(()=>({}));
        if(!invite.ok||!result.success||!result.email_sent){
          warnings.push("Captain registration invitation not sent: "+trim(result.error||result.warning||"Please resend from the roster"));
        }
      }catch{
        warnings.push("Captain registration invitation failed; use Resend Invite in the roster");
      }
    } else {
      // Claimed Passengers only need their existing registration and Airport link.
      try {
        const apiKey=Deno.env.get("RESEND_API_KEY");
        if(!apiKey){warnings.push("Captain confirmation email not configured");}
        else {
          const airportLink="https://elevated-impact-platform.vercel.app/?airport=1&event_id="+encodeURIComponent(event.id);
          const escapeHtml=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
          const html='<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1D245D"><p>Hi '+escapeHtml(first)+',</p><p>You have been registered as captain for <strong>'+escapeHtml(event.name)+'</strong>, Team / Entry #'+escapeHtml(String(team.entry_number))+'.</p><p>Your existing ElevationPilot account is connected. No new password is needed.</p><p><a href="'+escapeHtml(airportLink)+'" style="background:#D81C22;color:white;padding:12px 18px;text-decoration:none">Open My Registration &amp; Team</a></p><p>ElevationPilot by Elevated Impact Group</p></div>';
          const sent=await fetch("https://api.resend.com/emails",{
            method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
            body:JSON.stringify({
              from:Deno.env.get("SQUAWK_FROM_EMAIL")||"ElevationPilot <squawk@elevatedimpactgroup.net>",
              to:[captainEmail],reply_to:Deno.env.get("SQUAWK_REPLY_TO_EMAIL")||"info@elevatedimpactgroup.net",
              subject:event.name+": captain registration confirmed",html,
              text:"Hi "+first+",\n\nYou have been registered as captain for "+event.name+", Team / Entry #"+team.entry_number+".\n\nSign in to your existing ElevationPilot account to manage your registration: "+airportLink+"\n\nElevationPilot by Elevated Impact Group"
            })
          });
          if(!sent.ok)warnings.push("Captain confirmation email not sent");
        }
      }catch{warnings.push("Captain confirmation email needs attention");}
    }
    await admin.from("golf_registration_admin_actions").insert({registration_id:createdRows[0].id,organization_id:event.organization_id,event_id:event.id,action:"team_added_manually",reason:trim(body.reason)||null,acted_by:actor.id,new_payment_status:paymentStatus,new_registration_status:"active",metadata:{team_id:team.id,team_size:size}});
    try{
      const sync=await fetch(url+"/functions/v1/sync-google-roster",{method:"POST",headers:{"Authorization":"Bearer "+key,"apikey":key,"Content-Type":"application/json"},body:JSON.stringify({event_key:event.event_key})});
      if(!sync.ok)warnings.push("Google Sheet sync needs attention");
    }catch{warnings.push("Google Sheet sync needs attention");}
    return reply({success:true,team,registrations:createdRows,warning:warnings.join("; ")||null});
  }catch(e){
    // Roll back records and team when the initial creation fails; no partially formed team.
    if(admin&&team&&createdRows.length===0)await admin.from("golf_registration_teams").delete().eq("id",team.id);
    return reply({success:false,error:e instanceof Error?e.message:"Unable to add team"},400);
  }
});
