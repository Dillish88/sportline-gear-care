
(function(){
"use strict";
var CFG={shopWA:"918056436668"};
var $=function(i){return document.getElementById(i)};
var R=function(n){return "₹"+Number(n||0).toLocaleString("en-IN")};
var qs=new URLSearchParams(location.search);
var SRC=(qs.get("src")||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,100);

function rpc(fn,body){
  var path=fn==="pilot_create_booking_v2"?"/api/orders":"/api/rpc/"+encodeURIComponent(fn);
  var payload=fn==="pilot_create_booking_v2"?{request:body.p_request,key:body.p_key}:body||{};
  return fetch(path,{method:"POST",signal:AbortSignal.timeout(20000),
    headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
  .then(function(r){return r.text().then(function(t){
    var j=null; try{j=t?JSON.parse(t):null}catch(e){}
    if(!r.ok) throw new Error((j&&(j.message||j.hint))||"Something went wrong. Please try again.");
    return j;});});
}

var assistantApplied=false;
var SPORT=null, CAT=[], BRANDS={}, CRI=[], brand=null;
var T={mains:24,crosses:26};
var SLOTDAYS=[], dayIdx=0, slotSel=null, urgentFee=100;
var pending=null;try{pending=JSON.parse(sessionStorage.getItem("sportline-book-pending"))}catch(e){}

/* ---------------- navigation ---------------- */
function show(id){document.body.dataset.screen=id;["landing","flow","done"].forEach(function(x){$(x).hidden=(x!==id)});window.scrollTo(0,0)}
var LEDE={
  badminton:"Tell us your setup and choose when you want it ready. Drop it off at least 30 minutes before.",
  cricket:"Choose the work. Bat work is done early morning, so we confirm the ready date after a look.",
  shoe:"Tell us what's wrong. We inspect first, then quote."
};
function go(sport){
  SPORT=sport;
  $("title").textContent=sport==="badminton"?"Badminton":sport==="cricket"?"Cricket":"Shoe repair";
  $("lede").textContent=LEDE[sport];
  $("sec-bad").hidden=sport!=="badminton";
  $("sec-cri").hidden=sport!=="cricket";
  $("sec-shoe").hidden=sport!=="shoe";
  $("advBlk").hidden=sport==="shoe";
  if(sport==="shoe"){ var a0=document.querySelector('input[name="adv"][value="0"]'); if(a0) a0.checked=true; $("advAmt").hidden=true; }
  number(); hideErr(); show("flow");
  if(sport==="badminton") loadDays();
  render();
}
function number(){
  var n=0;
  Array.prototype.forEach.call(document.querySelectorAll("#flow .step[data-n]"),function(s){
    var sec=s.closest("section"); if(sec&&sec.hidden) return;
    n++; var lbl=s.getAttribute("data-l")||s.innerHTML; s.setAttribute("data-l",lbl);
    s.innerHTML=(n<10?"0":"")+n+" — "+lbl;
  });
}
Array.prototype.forEach.call(document.querySelectorAll("[data-go]"),function(b){
  b.onclick=function(){go(b.getAttribute("data-go"))};
});
$("back").onclick=function(){show("landing")};
$("again").onclick=function(){location.href=location.pathname+(SRC?"?src="+encodeURIComponent(SRC):"")};

/* ---------------- catalogue ---------------- */
function loadCatalogue(){
  return rpc("pilot_public_catalogue").then(function(list){
    CAT=list||[]; BRANDS={}; CRI=[];
    CAT.forEach(function(c){
      if(c.sport==="badminton"){var b=c.key.split("|")[0];(BRANDS[b]=BRANDS[b]||[]).push(c);}
      else if(c.sport==="cricket") CRI.push(c);
    });
    buildBrands(); buildCricket();
  }).catch(function(){
    showErr("We couldn't load prices just now. Please refresh, or call +91 80564 36668.");
  });
}
function chip(name,value,label,checked,type){
  return '<label class="chip"><input type="'+(type||"radio")+'" name="'+name+'" value="'+esc(value)+'"'+(checked?" checked":"")+'><span>'+label+'</span></label>';
}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function buildBrands(){
  var names=Object.keys(BRANDS); if(!names.length) return;
  brand=names[0];
  $("brands").innerHTML=names.map(function(b,i){return chip("brand",b,esc(b),i===0)}).join("");
  buildStrings();
}
function buildStrings(){
  var list=BRANDS[brand]||[];
  $("str").innerHTML=list.map(function(c,i){
    return '<option value="'+esc(c.key)+'">'+esc(c.name)+' — '+R(c.price)+'</option>'}).join("");
  buildColours();
}
function curString(){var k=$("str").value;return CAT.filter(function(c){return c.key===k})[0]}
function buildColours(){
  var s=curString(); var cols=(s&&s.colours)||[];
  $("colours").innerHTML=cols.map(function(c,i){return chip("colour",c,esc(c),i===0)}).join("")
    +chip("colour","Other","Other");
  $("colOther").hidden=true;
}
function buildCricket(){
  var knock=CRI.filter(function(c){return c.key==="hand"||c.key==="machine"});
  var extra=CRI.filter(function(c){return ["hand","machine"].indexOf(c.key)<0 && c.key.indexOf("handle-")!==0});
  var handles=CRI.filter(function(c){return c.key.indexOf("handle-")===0});
  var rows="";
  if(knock.length){
    rows+='<label class="opt"><input type="radio" name="knock" value="" checked><span><b>No knocking-in</b></span><span class="p"></span></label>';
    knock.forEach(function(c){
      rows+='<label class="opt"><input type="radio" name="knock" value="'+esc(c.key)+'"><span><b>'+esc(c.name)+'</b></span><span class="p">'+R(c.price)+'</span></label>';
    });
  }
  extra.forEach(function(c){
    rows+='<label class="opt"><input type="checkbox" class="job" value="'+esc(c.key)+'"><span><b>'+esc(c.name)+'</b>'
      +(c.price==null?'<span class="d">Priced after we look at it</span>':'')+'</span>'
      +(c.price==null?'<span class="p q">On inspection</span>':'<span class="p">'+R(c.price)+'</span>')+'</label>';
  });
  $("jobs").innerHTML=rows;
  $("handle").innerHTML='<option value="">No new handle</option>'+handles.map(function(c){
    return '<option value="'+esc(c.key)+'">'+esc(c.name)+' — '+R(c.price)+'</option>'}).join("");
}

/* ---------------- slots ---------------- */
function readyOf(hm){var p=hm.split(":"),m=+p[0]*60+(+p[1])+30;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
function fmtTime(hm){var p=hm.split(":"),h=+p[0],m=p[1];return (h%12||12)+":"+m+(h<12?" am":" pm")}
function dayLabel(d,i){
  i=Math.round((Date.parse(d)-Date.parse(istToday()))/86400000);
  var dt=new Date(d+"T00:00:00");
  var wd=dt.toLocaleDateString("en-IN",{weekday:"short"}), dm=dt.getDate();
  return i===0?"Today · "+dm:i===1?"Tomorrow · "+dm:wd+" · "+dm;
}
function istToday(){ return new Date(Date.now()+330*60000).toISOString().slice(0,10); }
function addDays(d,n){ var x=new Date(d+"T00:00:00Z"); x.setUTCDate(x.getUTCDate()+n); return x.toISOString().slice(0,10); }
var slotLoad=0;
function loadDays(){
  var generation=++slotLoad;slotSel=null;$("urgent").checked=false;
  $("slots").innerHTML='<p class="slotnote">Loading times…</p>';
  var base=istToday(), dates=[base,addDays(base,1),addDays(base,2)];
  Promise.all(dates.map(function(d){return rpc("pilot_available_slots",{p_date:d}).catch(function(){return null})}))
  .then(function(days){
    if(generation!==slotLoad)return;
    SLOTDAYS=days.filter(Boolean);
    if(!SLOTDAYS.length){$("slots").innerHTML='<p class="slotnote">Times are unavailable right now. Please call +91 80564 36668.</p>';return;}
    urgentFee=SLOTDAYS[0].urgent_fee??100; $("urgentFee").textContent="+"+R(urgentFee);
    $("urgentBox").hidden=!(SLOTDAYS[0].date===base&&SLOTDAYS[0].urgent_open);
    $("urgentSub").textContent="Earliest available slot today. Existing ready-by promises are protected. Included in the 20 daily bookings.";
    dayIdx=0;
    for(var i=0;i<SLOTDAYS.length;i++){ if(freeCount(SLOTDAYS[i])>0){dayIdx=i;break;} }
    drawDays(); drawSlots(); drawSimple(); render();
  });
}

/* ---------------- simple ready-by picker ----------------
   A handful of big choices instead of ~20 exact times. Each finds the earliest
   free slot in its window from the days already loaded — no extra API calls —
   and books that exact slot, same as picking it from the full grid would. */
var WINDOWS=[
  {id:"next",  label:"Next available", sub:function(s){return s?dayLabel(s.day.date,0).split(" · ")[0]+" · "+fmtTime(s.slot.ready||s.slot.end):"Nothing free"}, pick:function(){return firstFreeAnyDay()}},
  {id:"morn",  label:"This morning",   from:"11:00", to:"13:00"},
  {id:"aft",   label:"This afternoon", from:"13:00", to:"17:00"},
  {id:"eve",   label:"This evening",   from:"17:00", to:"21:01"},
  {id:"tom",   label:"Tomorrow",       day:1}
];
function firstFreeAnyDay(){
  for(var i=0;i<SLOTDAYS.length;i++){ var s=firstFreeInDay(i); if(s) return {day:SLOTDAYS[i],slot:s,idx:i}; }
  return null;
}
function firstFreeInDay(idx,from,to){
  var d=SLOTDAYS[idx]; if(!d) return null;
  for(var i=0;i<d.slots.length;i++){
    var s=d.slots[i]; if(!s.free) continue;
    var ready=s.ready||s.end; if(from&&ready<from) continue; if(to&&ready>=to) continue;
    return s;
  }
  return null;
}
function windowChoice(w){
  if(w.pick) return w.pick();
  var wanted=addDays(istToday(),w.day||0), idx=SLOTDAYS.findIndex(d=>d.date===wanted);if(idx<0)return null;
  var s=firstFreeInDay(idx,w.from,w.to);return s?{day:SLOTDAYS[idx],slot:s,idx:idx}:null;
}
function drawSimple(){
  var box=$("simple"); if(!box) return;
  var selId=null;
  if(slotSel){ WINDOWS.forEach(function(w){ if(selId) return; var c=windowChoice(w); if(c&&c.day.date===slotSel.date&&c.slot.start===slotSel.start) selId=w.id; }); }
  box.innerHTML=WINDOWS.map(function(w){
    var c=windowChoice(w), off=!c;
    var sub=w.sub?w.sub(c):(c?dayLabel(c.day.date,c.idx).split(" · ")[0]+" · "+fmtTime(c.slot.ready||c.slot.end):"Closed today");
    return '<label class="chip"><input type="radio" name="simple" value="'+w.id+'"'+(w.id===selId?" checked":"")+(off?" disabled":"")+'>'
      +'<span>'+w.label+(off?"":" · "+sub)+'</span></label>';
  }).join("");
}
$("exactToggle").onclick=function(){ $("simpleBlk").hidden=true; $("exactBlk").hidden=false; };
$("simpleToggle").onclick=function(){ $("exactBlk").hidden=true; $("simpleBlk").hidden=false; };
function freeCount(d){return d.slots.filter(function(s){return s.free}).length}
function drawDays(){
  $("days").innerHTML=SLOTDAYS.map(function(d,i){
    var full=freeCount(d)===0;
    return '<label class="chip"><input type="radio" name="day" value="'+i+'"'+(i===dayIdx?" checked":"")+(full?" disabled":"")+'><span>'
      +dayLabel(d.date,i)+(full?(i===0?" · closed":" · full"):"")+'</span></label>';
  }).join("");
}
function drawSlots(){
  var d=SLOTDAYS[dayIdx]; if(!d) return;
  $("slots").innerHTML=d.slots.map(function(s){
    var sel=slotSel&&slotSel.date===d.date&&slotSel.start===s.start;
    return '<label class="chip"><input type="radio" name="slot" value="'+s.start+'"'+(sel?" checked":"")+(s.free?"":" disabled")
      +' aria-label="Ready by '+fmtTime(s.ready||s.end)+'"><span>'+fmtTime(s.ready||s.end)+'</span></label>';
  }).join("");
  var todayFull=freeCount(SLOTDAYS[0])===0;
  $("slotNote").textContent=(dayIdx>0&&todayFull
      ?"Today's slots are closed or full, so we've opened the next day. "
      :"")+"Pick when you want it ready. Drop it off at least 30 minutes before. "+freeCount(d)+" available times on this day.";
}

/* ---------------- totals ---------------- */
function lines(){
  var out=[];
  if(SPORT==="badminton"){
    var s=curString(); if(s) out.push([s.name,s.price]);
    if(radio("knots")==="4") out.push(["4-knot stringing",25]);
    if(radio("pre")==="1") out.push(["Pre-stretch",25]);
    if($("urgent").checked) out.push(["Urgent",urgentFee]);
  } else if(SPORT==="cricket"){
    var k=radio("knock"); if(k){var c=byKey(k); if(c) out.push([c.name,c.price]);}
    Array.prototype.forEach.call(document.querySelectorAll(".job:checked"),function(x){var c=byKey(x.value);if(c)out.push([c.name,c.price])});
    var h=$("handle").value; if(h){var hc=byKey(h); if(hc) out.push([hc.name,hc.price]);}
  } else if(SPORT==="shoe"){ out.push(["Shoe service",null]); }
  return out;
}
function byKey(k){return CAT.filter(function(c){return c.key===k})[0]}
function radio(n){var e=document.querySelector('input[name="'+n+'"]:checked');return e?e.value:""}
function total(){var t=0,q=false;lines().forEach(function(l){if(l[1]==null)q=true;else t+=l[1]});return{t:t,q:q}}

function batTiming(){
  var slow=!!radio("knock")||!!$("handle").value, any=slow;
  Array.prototype.forEach.call(document.querySelectorAll(".job:checked"),function(x){
    any=true; if(["weight","crack"].indexOf(x.value)>=0) slow=true; });
  $("batTiming").innerHTML=!any?"Pick what the bat needs and we'll tell you how it works."
    :slow?"<b>We look at the bat first, then confirm the ready date.</b> Knocking-in, weight reducing, a new handle and crack work are done early in the morning before we open — never same-day."
    :"<b>This can be done on the spot.</b> Bring the bat in and wait, or leave it and collect the same day.";
}
function render(){
  if(!SPORT) return;
  var t=total();
  $("total").textContent=t.q&&!t.t?"On inspection":R(t.t)+(t.q?" +":"");
  var sub="";
  if(SPORT==="badminton"){
    sub=$("urgent").checked?"Urgent · today":slotSel?"Ready "+dayLabel(slotSel.date,SLOTDAYS.map(function(d){return d.date}).indexOf(slotSel.date)).split(" · ")[0].toLowerCase()+" · "+fmtTime(readyOf(slotSel.start)):"Pick a ready-by time";
  } else if(SPORT==="cricket"){ sub=t.q?"+ items priced after inspection":"Ready date confirmed after a look"; batTiming(); }
  else sub="Priced after inspection";
  $("totSub").textContent=sub;
}

/* ---------------- events ---------------- */
document.addEventListener("change",function(e){
  var t=e.target;
  if(t.name==="brand"){brand=t.value;buildStrings();}
  if(t.id==="str") buildColours();
  if(t.name==="colour"){$("colOther").hidden=t.value!=="Other"; if(t.value==="Other") $("colOther").focus();}
  if(t.name==="day"){dayIdx=+t.value;slotSel=null;$("urgent").checked=false;drawSlots();drawSimple();}
  if(t.name==="slot"){slotSel={date:SLOTDAYS[dayIdx].date,start:t.value};$("urgent").checked=false;$("urgentBox").classList.remove("on");drawSimple();}
  if(t.name==="simple"){
    var w=WINDOWS.filter(function(x){return x.id===t.value})[0], c=w&&windowChoice(w);
    if(c){ slotSel={date:c.day.date,start:c.slot.start}; $("urgent").checked=false; $("urgentBox").classList.remove("on"); dayIdx=c.idx; drawDays(); drawSlots(); }
  }
  if(t.id==="urgent"){$("urgentBox").classList.toggle("on",t.checked); if(t.checked){slotSel=null;drawSlots();drawSimple();}}
  if(t.name==="adv"){$("advAmt").hidden=t.value!=="1"; if(t.value==="1")$("advAmt").focus();}
  if(t.id==="ph"||t.id==="nm") t.classList.remove("field-err");
  if(t.name==="setup"){ var help=t.value==="help"; $("helpBlk").hidden=!help; $("knowBlk").hidden=help; if(help) advise(); }
  if(["gLvl","gFreq","gShut","gWant"].indexOf(t.id)>=0) advise();
  if(t.name==="shop") $("shopNote").hidden=t.value!=="5th";
  render();
});
Array.prototype.forEach.call(document.querySelectorAll(".pm"),function(b){
  b.onclick=function(){
    var k=b.getAttribute("data-t"),next=T[k]+(+b.getAttribute("data-d"));
    if(next<18||next>35){showErr("Tension must stay between 18 and 35 lbs.");return;}
    hideErr(); T[k]=next;
    $(k+"Out").innerHTML=T[k]+"<small>lbs</small>"; stepperState();
  };
});
function stepperState(){
  // Keep both controls clickable; the handler explains when a limit is reached.
}

/* ---------------- tension adviser ----------------
   low tension = power (trampoline), high tension = control (plank) — never the other way round */
var gRec=null;
function advise(){
  var lv=$("gLvl").value, fq=$("gFreq").value, wt=$("gWant").value, sh=$("gShut").value;
  var t={beg:20,club:24,adv:27}[lv];
  if(wt==="ctrl") t+=1; if(wt==="pow") t-=1;
  if(fq==="high"&&lv!=="beg") t+=1; if(fq==="low"&&lv==="adv") t-=1;
  if(sh==="ny") t-=1;
  t=Math.max({beg:18,club:22,adv:25}[lv],Math.min({beg:23,club:26,adv:29}[lv],t));
  var pick={beg:"BG65",club_ctrl:"Nanogy 95",club_bal:"BG65 Titanium",club_pow:"BG66 Ultimax",
            adv_ctrl:"Aero Bite Boost",adv_bal:"Exbolt 65",adv_pow:"Aero Sonic"}[lv==="beg"?"beg":lv+"_"+wt];
  var s=byKey("Yonex|"+pick)||byKey("Yonex|BG65");
  gRec={t:t,c:Math.min(35,t+2),s:s};
  $("gOut").innerHTML="<b>"+t+" / "+gRec.c+" lbs"+(s?" · "+esc(s.name):"")+"</b><br>"
    +(wt==="pow"?"Lower tension gives you the free power, not higher. ":"")
    +(sh==="ny"?"Plastic shuttles are heavier, so we go a pound lower. ":"")
    +"We'll check it with you at drop-off.";
}
$("gApply").onclick=function(){
  if(!gRec) advise();
  T.mains=gRec.t; T.crosses=gRec.c;
  $("mainsOut").innerHTML=T.mains+"<small>lbs</small>"; $("crossesOut").innerHTML=T.crosses+"<small>lbs</small>";
  if(gRec.s){ var b=gRec.s.key.split("|")[0], bi=document.querySelector('input[name="brand"][value="'+b+'"]');
    if(bi&&!bi.checked){bi.checked=true;brand=b;buildStrings();} $("str").value=gRec.s.key; buildColours(); }
  stepperState(); render();
  $("gApply").textContent="Applied — "+T.mains+" / "+T.crosses+" lbs";
};
$("noteToggle").onclick=function(){ var n=$("noteBad"); n.hidden=!n.hidden; this.textContent=(n.hidden?"+ Add":"− Hide")+" a note for the stringer"; if(!n.hidden) n.focus(); };

/* ---------------- validation + submit ---------------- */
function phone(){var p=$("ph").value.replace(/\D/g,"");if(p.length===12&&p.indexOf("91")===0)p=p.slice(2);return p}
function problems(){
  var p=[];
  if(!$("nm").value.trim()){p.push("your name");$("nm").classList.add("field-err");}
  if(!/^[6-9]\d{9}$/.test(phone())){p.push("a 10-digit mobile number");$("ph").classList.add("field-err");}
  if(SPORT==="badminton"){
    if($("rk").value.trim().length<2) p.push("your racket model");
    if(!curString()) p.push("a string");
    if(radio("colour")==="Other"&&$("colOther").value.trim().length<2) p.push("the colour you'd like");
    if(!$("urgent").checked&&!slotSel) p.push("a ready-by time");
  }
  if(SPORT==="cricket"&&!lines().length) p.push("at least one job for the bat");
  if(SPORT==="shoe"){
    if(!document.querySelector("#shoeIssues input:checked")&&$("noteShoe").value.trim().length<3) p.push("what the shoes need");
  }
  if(radio("adv")==="1"){var a=+$("advAmt").value; if(!(a>0)) p.push("the advance amount");}
  return p;
}
function payload(){
  var b={name:$("nm").value.trim(),phone:phone(),sport:SPORT,shop:radio("shop")||"6th",payment:radio("pay"),src:SRC,
         marketing_opt_in:$("offers").checked,
         advance:radio("adv")==="1"?String(Math.floor(+$("advAmt").value||0)):"0"};
  if(SPORT==="badminton"){
    b.gear=$("rk").value.trim(); b.string_key=$("str").value; b.colour=radio("colour");
    if(b.colour==="Other") b.colour_other=$("colOther").value.trim();
    b.mains=String(T.mains); b.crosses=String(T.crosses); b.knots=radio("knots"); b.pre_stretch=radio("pre")==="1";
    b.urgent=$("urgent").checked;
    if(radio("setup")==="help"||assistantApplied) b.help_choose=true;
    if(!b.urgent){b.slot_date=slotSel.date;b.slot_start=slotSel.start;}
    b.note=$("noteBad").value.trim();
  } else if(SPORT==="cricket"){
    var jobs=[]; var k=radio("knock"); if(k) jobs.push(k);
    Array.prototype.forEach.call(document.querySelectorAll(".job:checked"),function(x){jobs.push(x.value)});
    if($("handle").value) jobs.push($("handle").value);
    b.jobs=jobs; b.gear=$("bat").value.trim(); b.note=$("noteCri").value.trim();
  } else {
    var iss=Array.prototype.map.call(document.querySelectorAll("#shoeIssues input:checked"),function(x){return x.value});
    b.gear=$("shoeModel").value.trim();
    b.note=(iss.length?iss.join(", ")+". ":"")+$("noteShoe").value.trim();
  }
  return b;
}
function uuid(){ if(window.crypto&&crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16)});}
function showErr(m){$("err").textContent=m;$("err").hidden=false;$("err").scrollIntoView({behavior:"smooth",block:"center"})}
function hideErr(){$("err").hidden=true}

var SUBMITTING=false;
$("submit").onclick=async function(){
  if(SUBMITTING){showErr("Your booking is still being saved. Please wait for the result.");return;}
  var p=problems();
  if(p.length){showErr("Still need "+p.join(", ")+".");return;}
  hideErr();
  var btn=$("submit");SUBMITTING=true;btn.textContent="Booking…";
  try{
  var body=payload(), json=JSON.stringify(body);
  var hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(json))),x=>x.toString(16).padStart(2,"0")).join("");
  /* same request after a lost response reuses its key, so it can never create a second job */
  if(!pending||pending.hash!==hash) pending={hash:hash,key:uuid()};
  try{sessionStorage.setItem("sportline-book-pending",JSON.stringify(pending));}catch(e){}
  await rpc("pilot_create_booking_v2",{p_request:body,p_key:pending.key})
  .then(function(r){ confirmed(r,body); })
  .catch(function(e){
    showErr(e.message);
    if(/time|full|taken|urgent/i.test(e.message)&&SPORT==="badminton"){slotSel=null;$("urgent").checked=false;loadDays();}
  })
  .then(function(){btn.textContent="Request booking";});
  }catch(e){showErr(e.message);}finally{SUBMITTING=false;btn.textContent="Request booking";}
};

/* ---------------- confirmation ---------------- */
var DONE=null;
function statusUrl(token){return new URL("status.html",location.href).href.split("#")[0]+"#t="+token}
function confirmed(r,b){
  var link=statusUrl(r.token);
  var svc=b.sport==="badminton"?"Badminton restring":b.sport==="cricket"?"Cricket bat care":"Shoe repair";
  var when=b.sport==="badminton"
      ?(r.urgent?"Urgent · ready by "+fmtTime(r.ready_by)
        :dayLabel(r.slot_date,SLOTDAYS.map(function(d){return d.date}).indexOf(r.slot_date)).split(" · ")[0]+", "
          +new Date(r.slot_date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})+" · "+fmtTime(r.ready_by||readyOf(r.slot_start)))
      :"We'll confirm the ready date";
  var tot=r.needs_quote?(r.estimate?R(r.estimate)+" + inspection":"Priced after inspection"):R(r.estimate);
  var rows=[["Service",svc]];
  if(b.gear) rows.push([b.sport==="badminton"?"Racket":b.sport==="cricket"?"Bat":"Shoes",b.gear]);
  if(b.sport==="badminton"){
    var s=byKey(b.string_key);
    rows.push(["String",s?s.name:""]);
    rows.push(["Colour",b.colour==="Other"?b.colour_other:b.colour]);
    rows.push(["Tension",b.mains+" / "+b.crosses+" lbs"]);
    rows.push(["Method",b.knots+" knot"+(b.pre_stretch?" · pre-stretch":"")]);
    if(b.help_choose) rows.push(["Setup","Suggested — we'll confirm at drop-off"]);
  }
  rows.push([b.sport==="badminton"?"Ready by":"Timing",when]);
  if(b.sport==="badminton"&&r.slot_start) rows.push(["Drop off by",fmtTime(r.slot_start)]);
  rows.push(["Drop-off",b.shop==="5th"?"5th Avenue":"6th Avenue"]);
  rows.push(["Total",tot+(r.needs_quote?"":" incl. tax")]);
  rows.push(["Received","₹0 — staff record money at the counter"]);
  rows.push(["Payment",b.payment+(+b.advance>0?" · intended advance "+R(b.advance)+" (not yet received)":"")]);
  $("dCode").textContent=r.code;
  $("dLede").textContent="We'll confirm it shortly — your status page changes to Confirmed. Show this number at the counter.";
  $("dKv").innerHTML=rows.map(function(x){return "<div><span>"+esc(x[0])+"</span><span>"+esc(x[1])+"</span></div>"}).join("");
  $("dLink").value=link; $("dOpen").href=link;
  var w=0; rows.forEach(function(x){if(x[0].length>w)w=x[0].length});
  var ticket=rows.map(function(x){return x[0]+new Array(w-x[0].length+3).join(" ")+x[1]}).join("\n");
  var msg="*Sportline booking "+r.code+"*\n\n```\n"+ticket+"\n```\n"+b.name+" · "+b.phone+"\n\nStatus: "+link;
  DONE={msg:msg,phone:b.phone};
  pending=null;try{sessionStorage.removeItem("sportline-book-pending");}catch(e){} show("done");
}
$("waShop").onclick=function(){ if(DONE) window.open("https://wa.me/"+CFG.shopWA+"?text="+encodeURIComponent(DONE.msg),"_blank","noopener") };
$("waSelf").onclick=function(){ if(DONE) window.open("https://wa.me/91"+DONE.phone+"?text="+encodeURIComponent(DONE.msg),"_blank","noopener") };
$("copy").onclick=function(){
  var v=$("dLink").value;
  (navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(function(){
    $("copy").textContent="Copied";setTimeout(function(){$("copy").textContent="Copy"},1600)
  }).catch(function(){$("dLink").select();});
};

/* ---------------- start ---------------- */
Array.prototype.forEach.call(document.querySelectorAll("img[data-logo]"),function(i){i.src=$("logoMain").src});
stepperState();
if(qs.get("shop")==="5th"){ var s5=document.querySelector('input[name="shop"][value="5th"]'); if(s5){s5.checked=true;$("shopNote").hidden=false;} }
loadCatalogue().then(function(){
  var s=(qs.get("sport")||qs.get("svc")||"").toLowerCase();
  if(s==="bad"||s==="badminton"||s==="string") go("badminton");
  else if(s==="cri"||s==="cricket"||s==="bat"||s==="bat") go("cricket");
  else if(s==="shoe") go("shoe");

});

// A narrow interface keeps the assistant and booking form in sync.
window.SportlineBooking={catalogue:()=>CAT.filter(c=>c.sport==='badminton'&&c.price!=null&&c.active!==false),apply:function(key,mains,crosses){
 var s=byKey(key);if(!s||s.sport!=='badminton'||s.price==null)return false;
 if(SPORT!=='badminton'||$('flow').hidden)go('badminton');
 buildBrands();brand=key.split('|')[0];var bi=document.querySelector('input[name="brand"][value="'+brand+'"]');if(bi)bi.checked=true;buildStrings();$('str').value=key;buildColours();
 if(Number.isInteger(mains)&&Number.isInteger(crosses)&&mains>=18&&crosses<=35){T.mains=mains;T.crosses=crosses;}
 $('mainsOut').innerHTML=T.mains+'<small>lbs</small>';$('crossesOut').innerHTML=T.crosses+'<small>lbs</small>';stepperState();
 assistantApplied=true;var know=document.querySelector('input[name="setup"][value="know"]');if(know)know.checked=true;$('helpBlk').hidden=true;$('knowBlk').hidden=false;render();return true;
}};
})();
