import React,{useEffect,useState} from "react";
import {isVerifiedInquiryAccount,normalizedInquiryEmail} from "../lib/eventInquiryLifecycle.mjs";
import "./event-inquiry-account-prompt.css";

// Designed for the account gate AFTER a completed event-request form.
// Does NOT submit a request. The authenticated caller must send the finalized
// request through a protected server endpoint that sets submitted_by_user_id.
export default function EventInquiryAccountPrompt({
  contactEmail,contactFullName="",supabaseClient,onAuthenticated,onCancel,
}) {
  const email=normalizedInquiryEmail(contactEmail);
  const nameParts=String(contactFullName).trim().split(/\s+/).filter(Boolean);
  const [mode,setMode]=useState("choose");
  const [identifier,setIdentifier]=useState(email);
  const [firstName,setFirstName]=useState(nameParts[0]||"");
  const [lastName,setLastName]=useState(nameParts.slice(1).join(" "));
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    function onKey(event){if(event.key==="Escape"&&!busy)onCancel?.();}
    document.addEventListener("keydown",onKey);
    return ()=>document.removeEventListener("keydown",onKey);
  },[busy,onCancel]);
  async function invoke(body){
    const {data,error:callError}=await supabaseClient.functions.invoke("golf-account-auth",{body});
    if(callError||data?.error||data?.success===false)
      throw new Error(data?.error||callError?.message||"Account service unavailable.");
    return data||{};
  }
  async function continueAuthenticated(tokens){
    if(tokens?.access_token&&tokens?.refresh_token){
      const {error:sessionError}=await supabaseClient.auth.setSession(tokens);
      if(sessionError)throw sessionError;
    }
    const {data,error:authError}=await supabaseClient.auth.getUser();
    const user=data?.user;
    if(authError||!user?.id)throw Error("Please sign in again to finish your event request.");
    if(!isVerifiedInquiryAccount(user,email))
      throw Error("This request must use your verified account email, "+email+". Sign in with that account or return to edit the contact email.");
    await onAuthenticated(user);
  }
  async function submitSignin(event){
    event.preventDefault();setBusy(true);setError("");
    try{
      const credentials=await invoke({action:"sign_in",identifier:identifier.trim(),password});
      if(!credentials.access_token||!credentials.refresh_token)
        throw Error("Your sign-in could not be completed.");
      await continueAuthenticated(credentials);
    }catch(e){setError(e?.message||"Unable to sign in.");}
    finally{setBusy(false);}
  }
  async function startSignup(event){
    event.preventDefault();setError("");setMessage("");
    if(!firstName.trim()||!lastName.trim())return setError("Enter your first and last name.");
    if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username.trim().replace(/^@/,"").toLowerCase()))
      return setError("Choose a valid @username using 3–30 characters.");
    if(password.length<8)return setError("Choose a password with at least 8 characters.");
    if(password!==confirmPassword)return setError("Your passwords do not match.");
    setBusy(true);
    try{
      await invoke({action:"request_signup_code",email,username:username.trim()});
      setMode("verify");setMessage("Enter the six-digit code sent to "+email+". It expires in ten minutes.");
    }catch(e){setError(e?.message||"Unable to send verification code.");}
    finally{setBusy(false);}
  }
  async function confirmSignup(event){
    event.preventDefault();setError("");
    if(!/^\d{6}$/.test(code.trim()))return setError("Enter the six-digit verification code.");
    setBusy(true);
    try{
      await invoke({
        action:"verify_signup_code",email,code:code.trim(),username:username.trim(),
        password,first_name:firstName.trim(),last_name:lastName.trim(),
      });
      const tokens=await invoke({action:"sign_in",identifier:email,password});
      if(!tokens.access_token||!tokens.refresh_token)throw Error("Account verified. Sign in to finish.");
      await continueAuthenticated(tokens);
    }catch(e){
      setError(e?.message||"Unable to verify your account.");
    }finally{setBusy(false);}
  }
  const modes={choose:"Finish Your Event Request",signin:"Sign In to Finish",signup:"Create Your ElevationPilot Account",verify:"Verify Your Email"};
  return <div className="eir-account-backdrop" role="presentation">
    <section className="eir-account-dialog" role="dialog" aria-modal="true"
      aria-labelledby="eir-account-title" aria-describedby="eir-account-description">
      <div className="eir-account-head">
        <div>
          <p className="platform-eyebrow">ElevationPilot / Event Request</p>
          <h2 id="eir-account-title">{modes[mode]}</h2>
        </div>
        <button type="button" aria-label="Return to event request form"
          className="eir-account-close" onClick={onCancel} disabled={busy}>×</button>
      </div>
      <p id="eir-account-description">
        Your event request is still filled out, but it has <strong>not been sent yet</strong>.
        Connect a verified account so you can follow status changes, receive email and Squawk updates,
        and reply when the Hangar needs information.
      </p>
      <p className="eir-account-email">Request contact email: <strong>{email}</strong></p>
      {mode==="choose"&&<div className="eir-account-actions">
        <button type="button" className="platform-primary-button" onClick={()=>{setMode("signin");setError("");}}>I Already Have an Account</button>
        <button type="button" className="platform-secondary-button" onClick={()=>{setMode("signup");setError("");}}>Create an Account</button>
        <button type="button" className="platform-secondary-button" onClick={onCancel}>Back to My Request</button>
      </div>}
      {mode==="signin"&&<form className="eir-account-form" onSubmit={submitSignin}>
        <label>Email or @username<input autoComplete="username" value={identifier}
          onChange={e=>setIdentifier(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password"
          value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        <button type="submit" className="platform-primary-button" disabled={busy}>{busy?"Signing in…":"Sign In & Submit Request"}</button>
        <button type="button" className="platform-secondary-button" disabled={busy}
          onClick={()=>{setMode("choose");setPassword("");setError("");}}>Back</button>
      </form>}
      {mode==="signup"&&<form className="eir-account-form" onSubmit={startSignup}>
        <div className="eir-account-name-row">
          <label>First name<input autoComplete="given-name" value={firstName}
            onChange={e=>setFirstName(e.target.value)} required /></label>
          <label>Last name<input autoComplete="family-name" value={lastName}
            onChange={e=>setLastName(e.target.value)} required /></label>
        </div>
        <label>Choose @username<input autoComplete="username" value={username}
          onChange={e=>setUsername(e.target.value.replace(/^@/,""))} required /></label>
        <label>Create password<input type="password" autoComplete="new-password"
          value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required /></label>
        <label>Confirm password<input type="password" autoComplete="new-password"
          value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={8} required /></label>
        <p className="eir-account-footnote">No date of birth or gender is required to create this account. Individual events may request those details later.</p>
        <button type="submit" className="platform-primary-button" disabled={busy}>{busy?"Sending code…":"Send Six-Digit Verification Code"}</button>
        <button type="button" className="platform-secondary-button" disabled={busy}
          onClick={()=>{setMode("choose");setError("");}}>Back</button>
      </form>}
      {mode==="verify"&&<form className="eir-account-form" onSubmit={confirmSignup}>
        <p className="eir-account-footnote">{message}</p>
        <label>Six-digit email code<input inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} required /></label>
        <button type="submit" className="platform-primary-button" disabled={busy}>{busy?"Verifying…":"Verify & Submit Request"}</button>
        <button type="button" className="platform-secondary-button" disabled={busy}
          onClick={()=>{setMode("signup");setCode("");setError("");}}>Resend or change details</button>
      </form>}
      {error&&<p className="platform-error" role="alert">{error}</p>}
    </section>
  </div>;
}
