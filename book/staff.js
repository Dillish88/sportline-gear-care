
(function(){
"use strict";
var CFG={url:"https://swlsbvrqlnvbvamainql.supabase.co",key:"sb_publishable_hFuKjzCTep2eNNO9d6trBg_kXIDy1OL"};
if(window.PILOT_CONFIG){CFG.url=PILOT_CONFIG.url;CFG.key=PILOT_CONFIG.key;}
var $=function(i){return document.getElementById(i)};
var R=function(n){return "₹"+Number(n||0).toLocaleString("en-IN")};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
var LABEL={"Requested":"New","Accepted":"Confirmed","At the bench":"On the bench","Ready":"Ready","Collected":"Collected","Cancelled":"Cancelled"};
var ACTIVE=["Requested","Accepted","At the bench","Ready"];
var SESS=null, JOBS=[], VIEW="active", OPEN=null, SEEN=null, URGENT_LEFT=null, audio=null, timer=null;

/* ---------------- auth (email + password, same as the pilot) ---------------- */
var KEY="sportline-staff-session", BUSY=false, LOADING=false, EPOCH=0;
function editing(){return !!document.querySelector('[id^="payBox-"]:not([hidden])')||!!document.querySelector('[id^="price-"][data-dirty]');}
var refreshing=null;
function saveSess(s){ SESS=s; try{ s?localStorage.setItem(KEY,JSON.stringify(s)):localStorage.removeItem(KEY);}catch(e){} }
function loadSess(){ try{ return JSON.parse(localStorage.getItem(KEY)); }catch(e){ return null; } }
function authCall(grant,body){
  return fetch(CFG.url+"/auth/v1/token?grant_type="+grant,{method:"POST",signal:AbortSignal.timeout(20000),
    headers:{"apikey":CFG.key,"Content-Type":"application/json"},body:JSON.stringify(body)})
  .then(function(r){return r.json().then(function(j){
    if(!r.ok) throw new Error(j.error_description||j.msg||j.message||"Sign-in failed.");
    return {access_token:j.access_token,refresh_token:j.refresh_token,
            expires_at:Date.now()+((j.expires_in||3600)*1000),email:(j.user&&j.user.email)||""};
  });});
}
function fresh(){
  if(!SESS) return Promise.reject(new Error("Signed out."));
  if(SESS.expires_at-Date.now()>60000) return Promise.resolve(SESS);
  if(refreshing)return refreshing;
  refreshing=authCall("refresh_token",{refresh_token:SESS.refresh_token})
    .then(function(s){ s.email=s.email||SESS.email; saveSess(s); return s; })
    .catch(function(e){ signOut(); throw new Error("Your session ended. Please sign in again."); }).finally(function(){refreshing=null;});
  return refreshing;
}
/* signed-in calls: publishable key on apikey, the staff member's own token on Authorization */
function rpc(fn,body){
  return fresh().then(function(s){
    return fetch(CFG.url+"/rest/v1/rpc/"+fn,{method:"POST",signal:AbortSignal.timeout(20000),
      headers:{"apikey":CFG.key,"Authorization":"Bearer "+s.access_token,"Content-Type":"application/json"},
      body:JSON.stringify(body||{})});
  }).then(function(r){return r.text().then(function(t){
    var j=null; try{j=t?JSON.parse(t):null}catch(e){}
    if(!r.ok) throw new Error((j&&(j.message||j.hint))||"Something went wrong. Try again.");
    return j;});});
}
function signOut(){
  EPOCH++;OPEN=null;SEEN=null;$("jobs").replaceChildren();$("slip").replaceChildren();$("password").value="";
  if(timer){clearInterval(timer);timer=null;}
  if(SESS){ fetch(CFG.url+"/auth/v1/logout",{method:"POST",signal:AbortSignal.timeout(20000),headers:{"apikey":CFG.key,"Authorization":"Bearer "+SESS.access_token}}).catch(function(){}); }
  saveSess(null); JOBS=[]; $("board").hidden=true; $("login").hidden=false; $("signout").hidden=true; $("who").textContent="";
}
$("signout").onclick=signOut;
$("login").onsubmit=function(e){
  e.preventDefault(); hideMsg();
  var b=$("signin"); b.disabled=true; b.textContent="Signing in…";
  unlockAudio();
  authCall("password",{email:$("email").value.trim(),password:$("password").value})
  .then(function(s){ saveSess(s); return enter(); })
  .catch(function(er){ showErr(er.message); })
  .then(function(){ b.disabled=false; b.textContent="Sign in"; });
};
function enter(){
  return rpc("pilot_is_staff").then(function(ok){
    if(ok!==true){ signOut(); throw new Error("This account isn't on the approved staff list."); }
    $("login").hidden=true; $("board").hidden=false; $("signout").hidden=false; $("who").textContent=SESS.email||"";
    $("password").value="";
    return load(true).then(function(){ if(!timer) timer=setInterval(function(){ if(document.visibilityState==="visible"&&!BUSY&&!editing()) load(false); },20000); });
  });
}

/* ---------------- messages + sound ---------------- */
function showErr(m){$("err").textContent=m;$("err").hidden=false;$("okmsg").hidden=true;window.scrollTo({top:0,behavior:"smooth"});}
function showOk(m){$("okmsg").textContent=m;$("okmsg").hidden=false;$("err").hidden=true;setTimeout(function(){$("okmsg").hidden=true},3500);}
function hideMsg(){$("err").hidden=true;$("okmsg").hidden=true;}
function unlockAudio(){ try{ if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)(); if(audio.state==="suspended") audio.resume(); }catch(e){} }
function beep(){
  try{ if(!audio) return; [0,0.18].forEach(function(t){
    var o=audio.createOscillator(),g=audio.createGain(); o.type="sine"; o.frequency.value=880;
    g.gain.setValueAtTime(.0001,audio.currentTime+t); g.gain.exponentialRampToValueAtTime(.25,audio.currentTime+t+.02);
    g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+t+.15);
    o.connect(g); g.connect(audio.destination); o.start(audio.currentTime+t); o.stop(audio.currentTime+t+.16); }); }catch(e){}
}
document.addEventListener("click",unlockAudio,{once:false});

/* ---------------- time (shop runs on IST whatever the tablet says) ---------------- */
function istNow(){ return new Date(Date.now()+330*60000); }
function istDate(){ return istNow().toISOString().slice(0,10); }
function istMins(){ var d=istNow(); return d.getUTCHours()*60+d.getUTCMinutes(); }
function toMins(hm){ if(!hm) return null; var p=String(hm).split(":"); return (+p[0])*60+(+p[1]); }
function fmt(hm){ if(!hm) return ""; var p=String(hm).split(":"),h=+p[0]; return (h%12||12)+":"+p[1]+(h<12?" am":" pm"); }
function dayWord(d){
  var t=istDate(), tm=new Date(Date.parse(t+"T00:00:00Z")+86400000).toISOString().slice(0,10);
  if(d===t) return "Today"; if(d===tm) return "Tomorrow";
  return new Date(d+"T00:00:00Z").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"});
}
function overdue(j){
  if(ACTIVE.indexOf(j.status)<0||j.status==="Ready"||!j.slot_date||!j.ready_by) return false;
  var t=istDate(); if(j.slot_date<t) return true; if(j.slot_date>t) return false;
  return istMins()>toMins(j.ready_by);
}
function sortKey(j){
  var act=ACTIVE.indexOf(j.status)>=0?0:1;
  var urg=(j.urgent&&act===0)?0:1;
  var when=j.slot_date?(j.slot_date+"T"+(j.ready_by||"23:59")):"9999-"+(j.created_at||"");
  return [act,urg,when,j.created_at||""].join("|");
}

/* ---------------- data ---------------- */
function load(first){
  if(LOADING||BUSY||!SESS)return Promise.resolve();
  LOADING=true;var epoch=EPOCH;
  return Promise.all([rpc("pilot_queue_v2"),
    rpc("pilot_available_slots",{p_date:istDate()}).catch(function(){return null;})])
  .then(function(res){
    if(epoch!==EPOCH||!SESS)return;
    JOBS=(res[0]||[]).slice().sort(function(a,b){return sortKey(a)<sortKey(b)?-1:1});
    URGENT_LEFT=res[1]?res[1].urgent_left:null;
    var reqIds=JOBS.filter(function(j){return j.status==="Requested"}).map(function(j){return j.id});
    if(SEEN){
      var fresh=reqIds.filter(function(id){return SEEN.indexOf(id)<0});
      if(fresh.length){ beep(); $("newText").textContent=fresh.length+" new booking"+(fresh.length>1?"s":""); $("newBanner").hidden=false;
        document.title="("+fresh.length+") Sportline — Counter"; }
    }
    SEEN=reqIds.concat(SEEN||[]);
    if(!editing())draw();
  }).catch(function(e){if(epoch===EPOCH&&SESS)showErr(e.message);}).finally(function(){LOADING=false;});
}
$("reload").onclick=function(){ hideMsg(); load(false); };
$("newSeen").onclick=function(){ $("newBanner").hidden=true; document.title="Sportline — Counter"; VIEW="Requested"; draw(); };
$("search").oninput=draw; $("shopF").onchange=draw;

/* ---------------- drawing ---------------- */
function count(st){return JOBS.filter(function(j){return j.status===st}).length}
function drawStats(){
  var over=JOBS.filter(overdue).length;
  var items=[["Requested","New",count("Requested"),count("Requested")>0],
             ["Accepted","Confirmed",count("Accepted"),false],
             ["At the bench","On the bench",count("At the bench"),over>0],
             ["Ready","Ready",count("Ready"),false],
             ["urgent","Urgent left today",URGENT_LEFT==null?"–":URGENT_LEFT,false]];
  $("stats").innerHTML=items.map(function(i){
    return '<button type="button" class="stat'+(VIEW===i[0]?" on":"")+(i[3]?" alert":"")+'" data-v="'+i[0]+'"><div class="n">'+i[2]+'</div><div class="l">'+i[1]+'</div></button>';
  }).join("");
  Array.prototype.forEach.call(document.querySelectorAll(".stat"),function(b){
    b.onclick=function(){ var v=b.getAttribute("data-v"); if(v==="urgent") return; VIEW=(VIEW===v?"active":v); draw(); };
  });
}
function visible(){
  var q=$("search").value.trim().toLowerCase(), shop=$("shopF").value;
  return JOBS.filter(function(j){
    if(VIEW==="active"&&ACTIVE.indexOf(j.status)<0) return false;
    if(VIEW!=="active"&&j.status!==VIEW) return false;
    if(shop&&j.shop!==shop) return false;
    if(q&&[j.code,j.customer_name,j.phone,j.gear].join(" ").toLowerCase().indexOf(q)<0) return false;
    return true;
  });
}
function rd(j){ return j.request_data||{}; }
function sportName(j){ return j.sport==="badminton"?"Badminton":j.sport==="cricket"?"Cricket":"Shoe repair"; }
function summary(j){
  var r=rd(j);
  if(j.sport==="badminton"){
    var s=(j.lines&&j.lines[0]&&j.lines[0].name)||"";
    return [s, r.mains&&(r.mains+"/"+r.crosses+" lbs"), r.knots&&(r.knots+" knot"), r.colour==="Other"?r.colour_other:r.colour].filter(Boolean).join(" · ");
  }
  if(j.sport==="cricket") return (j.lines||[]).map(function(l){return l.name}).join(" · ");
  return j.note||"Shoe repair";
}
function whenCell(j){
  if(j.urgent&&!j.ready_by&&ACTIVE.indexOf(j.status)>=0) return '<div class="t" style="color:var(--red-lit)">ASAP</div><div class="d">Urgent</div>';
  if(j.slot_date&&j.ready_by) return '<div class="t">'+esc(fmt(j.ready_by))+'</div><div class="d">'+esc(dayWord(j.slot_date))+'</div>';
  var r=rd(j);
  if(r.needed) return '<div class="t" style="font-size:18px">'+esc(r.needed)+'</div><div class="d">Requested</div>';
  return '<div class="t" style="font-size:18px">'+(j.sport==="badminton"?"—":"Look first")+'</div><div class="d">'+esc(sportName(j))+'</div>';
}
function due(j){ return j.final_total!=null?j.final_total:j.estimate; }
function balance(j){ return Math.max((due(j)||0)-(j.paid_total||0),0); }
function badges(j){
  var b=['<span class="bd st">'+esc(LABEL[j.status]||j.status)+'</span>'];
  if(j.urgent&&ACTIVE.indexOf(j.status)>=0) b.push('<span class="bd red">Urgent</span>');
  if(overdue(j)) b.push('<span class="bd amber">Overdue</span>');
  if(j.shop==="5th") b.push('<span class="bd">5th Ave</span>');
  if(j.sport!=="badminton") b.push('<span class="bd">'+esc(sportName(j))+'</span>');
  if(j.paid) b.push('<span class="bd ok">Paid</span>');
  else if((j.paid_total||0)>0) b.push('<span class="bd ok">'+R(j.paid_total)+' paid</span>');
  return b.join("");
}
function draw(){
  drawStats();
  var list=visible();
  $("count").textContent=list.length+" job"+(list.length===1?"":"s")+(VIEW==="active"?" in progress":" · "+(LABEL[VIEW]||VIEW))+" · updated "+istNow().toISOString().slice(11,16)+" IST";
  if(!list.length){ $("jobs").innerHTML='<div class="empty">Nothing here right now.</div>'; return; }
  $("jobs").innerHTML=list.map(function(j){
    var cls="job"+(j.urgent&&ACTIVE.indexOf(j.status)>=0?" urgent":"")+(overdue(j)?" overdue":"");
    return '<article class="'+cls+'" data-id="'+j.id+'">'
      +'<button class="jh" type="button" data-open="'+j.id+'" aria-expanded="'+(OPEN===j.id)+'">'
      +'<div class="when">'+whenCell(j)+'</div>'
      +'<div class="who"><b>'+esc(j.customer_name)+'</b> <span class="small">'+esc(j.code)+'</span><span class="s">'+esc(summary(j))+'</span></div>'
      +'<div class="badges">'+badges(j)+'</div></button>'
      +(OPEN===j.id?detail(j):"")+'</article>';
  }).join("");
  wire();
}
function row(k,v){ return v==null||v===""?"":'<div><span>'+esc(k)+'</span><span>'+v+'</span></div>'; }
function detail(j){
  var r=rd(j), flags=[];
  if(r.help_choose||r.advice) flags.push("Customer asked us to choose — confirm string and tension with them before starting.");
  if(r.priority) flags.push("Asked for priority on the old form — confirm with the customer.");
  if(r.colour==="Other") flags.push("Wants a colour not on the list: "+esc(r.colour_other||"")+".");
  if(j.needs_quote&&j.final_total==null) flags.push("Needs a price after inspection — enter it when you accept.");
  if(j.shop==="5th") flags.push("Dropped at 5th Avenue — send to the 6th Avenue bench, then back for collection.");
  var left="", right="";
  left+=row("Phone",'<a href="tel:+91'+esc(j.phone)+'" style="color:var(--text)">'+esc(j.phone)+'</a>');
  left+=row(j.sport==="badminton"?"Racket":j.sport==="cricket"?"Bat":"Shoes",esc(j.gear));
  if(j.sport==="badminton"){
    left+=row("String",esc(j.lines&&j.lines[0]&&j.lines[0].name));
    left+=row("Colour",esc(r.colour==="Other"?(r.colour_other+" (requested)"):r.colour));
    left+=row("Tension",r.mains?esc(r.mains+" vertical / "+r.crosses+" cross lbs"):"");
    left+=row("Knots",r.knots?esc(r.knots):"");
    left+=row("Pre-stretch",r.pre_stretch?"Yes":"No");
  }
  if(j.note) left+=row("Note",esc(j.note));
  right+=row("Service",esc(sportName(j)));
  right+=row("Ready by",j.urgent&&!j.ready_by?"Urgent — confirm timing":j.slot_date?esc(dayWord(j.slot_date)+" · "+fmt(j.ready_by)):esc(r.needed||"Confirm with customer"));
  if(j.slot_start) right+=row("Drop off by",esc(fmt(String(j.slot_start).slice(0,5))));
  right+=row("Drop-off",j.shop==="5th"?"5th Avenue":"6th Avenue");
  (j.lines||[]).forEach(function(l){ right+=row(l.name,l.price==null?"On inspection":R(l.price)); });
  right+=row(j.final_total!=null?"Agreed total":"Estimate",'<span style="font-size:17px">'+R(due(j))+'</span>');
  right+=row("Paid so far",R(j.paid_total||0));
  right+=row("Balance",'<span style="color:'+(balance(j)?"var(--amber)":"var(--ok)")+'">'+R(balance(j))+'</span>');
  right+=row("Pays by",esc(j.pay_method||r.payment||""));
  if(j.advance_intent) right+=row("Said they'd pay",R(j.advance_intent)+" advance");
  var html='<div class="jb">'+(flags.length?flags.map(function(f){return '<div class="flag">'+f+'</div>'}).join(""):"")
    +'<div class="grid2" style="margin-top:'+(flags.length?"14px":"0")+'"><div class="kv">'+left+'</div><div class="kv">'+right+'</div></div>'
    +actions(j)+'</div>';
  return html;
}
function actions(j){
  var a=[], st=j.status, open=ACTIVE.indexOf(st)>=0;
  if(st==="Requested"){
    a.push('<div class="inline"><span class="small">Agreed price</span><input class="inp" type="number" inputmode="numeric" min="0" id="price-'+j.id+'" value="'+(j.needs_quote&&!j.estimate?"":due(j))+'" placeholder="₹">'
      +'<button class="btn chrome" type="button" data-act="accept" data-id="'+j.id+'">Accept job</button></div>');
  }
  var btns=[];
  if(st==="Accepted") btns.push('<button class="btn chrome" type="button" data-act="start" data-id="'+j.id+'">Start work</button>');
  if(st==="At the bench") btns.push('<button class="btn chrome" type="button" data-act="ready" data-id="'+j.id+'">Mark ready</button>');
  if(st==="Ready") btns.push('<button class="btn red" type="button" data-act="collect" data-id="'+j.id+'"'+(j.paid?"":" disabled title=\"Take the balance first\"")+'>Handed over</button>');
  if(open && !j.paid && st!=="Requested") btns.push('<button class="btn" type="button" data-pay="'+j.id+'">Take payment</button>');
  if(st==="Requested"&&!j.needs_quote) btns.push('<button class="btn" type="button" data-pay="'+j.id+'">Take advance</button>');
  if(st==="Ready") btns.push('<a class="btn" target="_blank" rel="noopener" href="'+readyWA(j)+'">WhatsApp: ready</a>');
  else if(open) btns.push('<a class="btn" target="_blank" rel="noopener" href="https://wa.me/91'+esc(j.phone)+'">WhatsApp</a>');
  btns.push('<button class="btn" type="button" data-slip="'+j.id+'">Print slip</button>');
  if(rd(j).marketing_opt_in===true) btns.push('<button class="btn" type="button" data-offers="'+j.id+'">Confirm offers opt-in</button>');
  btns.push('<button class="btn" type="button" data-stop-offers="'+j.id+'">Stop offers</button>');
  if((st==="Requested"||st==="Accepted")&&!j.paid&&!(j.paid_total>0)) btns.push('<button class="btn" type="button" data-act="cancel" data-id="'+j.id+'" style="margin-left:auto">Cancel</button>');
  a.push('<div class="acts">'+btns.join("")+'</div>');
  a.push('<div id="payBox-'+j.id+'" hidden></div>');
  return a.join("");
}
function readyWA(j){
  var bal=balance(j);
  var t="Hi "+j.customer_name+", your "+(j.sport==="badminton"?"racket":j.sport==="cricket"?"bat":"shoes")+" ("+j.code+") is ready to collect at Sportline "
    +(j.shop==="5th"?"5th Avenue":"6th Avenue")+"."+(bal?" Balance: "+R(bal)+".":" Fully paid.")+" Open 10:30am–9pm. Thank you!";
  t+="\n"+summary(j)+"\nTotal (tax inclusive): "+R(due(j))+" · Paid: "+R(j.paid_total||0)+" · Balance: "+R(bal);
  if(j.status_token)t+="\nStatus: "+new URL("status.html",location.href).href+"#t="+j.status_token;
  return "https://wa.me/91"+j.phone+"?text="+encodeURIComponent(t);
}
function byId(id){ return JOBS.filter(function(j){return j.id===id})[0]; }
function wire(){
  document.querySelectorAll("[data-stop-offers]").forEach(b=>{b.onclick=()=>{const j=byId(b.dataset.stopOffers);rpc("pilot_marketing_consent",{p_order:j.id,p_opt_in:false}).then(()=>showOk("Offers stopped for this number.")).catch(e=>showErr(e.message));};});
  document.querySelectorAll('[id^="price-"]').forEach(function(input){input.oninput=function(){input.dataset.dirty="true";};});
  Array.prototype.forEach.call(document.querySelectorAll("[data-open]"),function(b){
    b.onclick=function(){ var id=b.getAttribute("data-open"); OPEN=(OPEN===id?null:id); draw(); };
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-act]"),function(b){
    b.onclick=function(){ act(byId(b.getAttribute("data-id")),b.getAttribute("data-act"),b); };
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-pay]"),function(b){
    b.onclick=function(){ payForm(byId(b.getAttribute("data-pay"))); };
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-slip]"),function(b){
    b.onclick=function(){ printSlip(byId(b.getAttribute("data-slip"))); };
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-offers]"),function(b){
    b.onclick=function(){ var j=byId(b.getAttribute("data-offers"));if(!confirm("Has this customer confirmed they want offers for 12 months?"))return;b.disabled=true;
      rpc("pilot_marketing_consent",{p_order:j.id,p_opt_in:true})
      .then(function(){ b.textContent="Offers confirmed"; showOk(j.customer_name+" added to the offers list for 12 months."); })
      .catch(function(e){ b.disabled=false; showErr(e.message); }); };
  });
}

/* ---------------- actions ---------------- */
var VERB={accept:"Accepted",start:"On the bench",ready:"Marked ready",collect:"Handed over",cancel:"Cancelled"};
function act(j,action,btn){
  if(!j||BUSY) return; hideMsg();
  var amount=null;
  if(action==="accept"){
    var v=$("price-"+j.id).value; amount=v===""?null:Number(v);
    if(amount==null||!Number.isInteger(amount)||amount<0||amount>100000){ showErr("Enter the agreed price before accepting."); return; }
  }
  if(action==="cancel"&&!confirm("Cancel "+j.code+" for "+j.customer_name+"?")) return;
  BUSY=true;btn.disabled=true;
  rpc("pilot_update_order",{p_id:j.id,p_expected:j.status,p_action:action,p_amount:amount})
  .then(function(){ BUSY=false;document.querySelectorAll("[data-dirty]").forEach(x=>delete x.dataset.dirty);showOk(j.code+" — "+VERB[action]+"."); if(action==="collect"||action==="cancel") OPEN=null; return load(false); })
  .catch(function(e){ BUSY=false;showErr(e.message); btn.disabled=false; if(/changed/i.test(e.message)) load(false); });
}
function payForm(j){
  var box=$("payBox-"+j.id); if(!box) return;
  if(!box.hidden){ box.hidden=true; return; }
  var bal=balance(j), method=j.pay_method||rd(j).payment||"UPI";
  var suggest=j.status==="Requested"?(j.advance_intent||""):bal;
  box.innerHTML='<div class="inline"><span class="small">Amount</span>'
    +'<input class="inp" type="number" inputmode="numeric" min="1" id="amt-'+j.id+'" value="'+suggest+'" placeholder="₹">'
    +'<div class="chips">'+["UPI","Cash","Card"].map(function(m){
      return '<label class="chip"><input type="radio" name="pm-'+j.id+'" value="'+m+'"'+(m===method?" checked":"")+'><span>'+m+'</span></label>'}).join("")+'</div>'
    +'<button class="btn red" type="button" id="payGo-'+j.id+'">Record</button>'
    +'<span class="small" style="width:100%">Balance before this: '+R(bal)+'. The job marks itself paid when the balance reaches zero.</span></div>';
  box.hidden=false;
  $("payGo-"+j.id).onclick=function(){
    if(BUSY)return;
    var amt=Number($("amt-"+j.id).value), m=(document.querySelector('input[name="pm-'+j.id+'"]:checked')||{}).value;
    if(!Number.isInteger(amt)||amt<=0){ showErr("Enter the amount received."); return; }
    if(amt>bal){showErr("Amount exceeds the balance.");return;}
    if(!confirm("Record "+R(amt)+" received by "+m+" for "+j.code+"?"))return;
    var kind=(j.status==="Requested"||(j.status==="Accepted"&&!(j.paid_total>0)))?"advance":(amt>=bal?"balance":"part");
    var fingerprint=[j.id,amt,m,kind].join("|"),key;try{key=sessionStorage.getItem("payment:"+fingerprint);}catch(e){}if(!key)key=crypto.randomUUID();try{sessionStorage.setItem("payment:"+fingerprint,key);}catch(e){}
    BUSY=true;this.disabled=true;
    rpc("pilot_record_payment_v3",{p_order:j.id,p_amount:amt,p_method:m,p_kind:kind,p_key:key})
    .then(function(r){BUSY=false;box.hidden=true;try{sessionStorage.removeItem("payment:"+fingerprint);}catch(e){} showOk(R(amt)+" "+m+" recorded for "+j.code+". Balance "+R(r.balance)+(r.paid?" — fully paid.":".")); return load(false); })
    .catch(function(e){BUSY=false;showErr(e.message);var b=$("payGo-"+j.id);if(b)b.disabled=false;});
  };
}

/* ---------------- 72mm job slip for the RP326 ---------------- */
function printSlip(j){
  var r=rd(j), spec="";
  if(j.sport==="badminton") spec=[(j.lines&&j.lines[0]&&j.lines[0].name)||"", r.mains?(r.mains+" / "+r.crosses+" lbs"):"",
    r.knots?(r.knots+" knot"+(r.pre_stretch?" + pre-stretch":"")):"", r.colour==="Other"?r.colour_other:r.colour].filter(Boolean).map(esc).join("<br>");
  else spec=(j.lines||[]).map(function(l){return esc(l.name)}).join("<br>");
  var when=j.urgent&&!j.ready_by?"URGENT — confirm timing":j.slot_date?(dayWord(j.slot_date)+" "+fmt(j.ready_by)):(r.needed||"Confirm");
  $("slip").innerHTML='<div class="h">Sportline gear care</div><div class="c">'+esc(j.code)+'</div><hr>'
    +'<div class="big">'+esc(sportName(j))+'</div><div style="text-align:center;margin-top:1mm">'+spec+'</div><hr>'
    +'<div class="r"><span>Ready by</span><b>'+esc(when)+'</b></div>'
    +'<div class="r"><span>Drop-off</span><b>'+(j.shop==="5th"?"5th Ave":"6th Ave")+'</b></div>'
    +'<div class="r"><span>Name</span><b>'+esc(j.customer_name)+'</b></div>'
    +'<div class="r"><span>Mobile</span><b>'+esc(j.phone)+'</b></div>'
    +(j.gear?'<div class="r"><span>Item</span><b>'+esc(j.gear)+'</b></div>':'')
    +'<hr><div class="r"><span>Total incl. tax</span><b>'+R(due(j))+'</b></div><div class="r"><span>Paid</span><b>'+R(j.paid_total||0)+'</b></div>'
    +'<div class="r"><span>Balance</span><b>'+R(balance(j))+'</b></div><hr><div class="h">Keep with the item</div>';
  window.print();
}

$("withdraw-form").onsubmit=function(e){e.preventDefault();rpc("pilot_withdraw_offers",{p_phone:$("withdraw-phone").value.trim()}).then(function(){$("withdraw-phone").value="";showOk("Offers stopped for that number.");}).catch(function(e){showErr(e.message);});};
/* ---------------- start ---------------- */
var s=loadSess();
if(s&&s.refresh_token){ SESS=s; enter().catch(function(e){ signOut(); showErr(e.message); }); }
})();
