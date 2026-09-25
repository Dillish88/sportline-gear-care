
(function(){
"use strict";
var $=function(i){return document.getElementById(i)};
var R=function(n){return "₹"+Number(n||0).toLocaleString("en-IN")};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
var STAGES=["Requested","Accepted","At the bench","Ready","Collected"];
var LABELS={"Requested":"Received","Accepted":"Confirmed","At the bench":"On the bench","Ready":"Ready to collect","Collected":"Collected","Cancelled":"Cancelled"};
var NOTE={"Requested":"We've got your booking and will confirm it shortly.",
          "Accepted":"Confirmed. Bring your gear in for your slot.",
          "At the bench":"Your gear is being worked on now.",
          "Ready":"All done — ready to collect at your drop-off shop.",
          "Collected":"Collected. Thanks for choosing Sportline.",
          "Cancelled":"This booking was cancelled. Call us if that's unexpected."};
function fmtTime(hm){var p=hm.split(":"),h=+p[0];return (h%12||12)+":"+p[1]+(h<12?" am":" pm")}

/* token lives in the #fragment, so it never reaches server logs */
var token=(location.hash.match(/(?:t=)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)||[])[1];
function load(){
  if(!token){ $("app").innerHTML='<div class="msg">This link is incomplete. Use the full link from your booking message.</div>'; return; }
  function call(fn,body){
    return fetch("/api/rpc/"+encodeURIComponent(fn),{method:"POST",signal:AbortSignal.timeout(20000),
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    .then(function(r){if(!r.ok)throw new Error("Unable to load");return r.json()});
  }
  call("pilot_track_booking_v2",{p_token:token})
  .then(function(b){
    if(!b||!b.code){ $("app").innerHTML='<div class="msg">We couldn\u2019t find that booking. Check the link, or call the shop.</div>'; return; }
    draw(b);
  })
  .catch(function(){ $("app").innerHTML='<div class="msg">Couldn\u2019t load your booking just now. Please try again.</div>'; });
}
function draw(b){
  var idx=STAGES.indexOf(b.status), cancelled=b.status==="Cancelled";
  var track=STAGES.map(function(s,i){return '<div class="'+(cancelled?"":i<idx?"on":i===idx?"now":"")+'"></div>'}).join("");
  var tl=STAGES.map(function(s,i){return '<span class="'+(!cancelled&&i<=idx?"on":"")+'">'+esc(LABELS[s])+'</span>'}).join("");
  var when=b.urgent&&b.ready_by?"Urgent · "+fmtTime(b.ready_by):b.urgent?"Urgent — ask the shop for timing"
    :b.slot_date?new Date(b.slot_date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})+" · "+fmtTime(b.ready_by||b.slot_start)
    :"Confirmed by the shop";
  var total=b.final_total!=null?b.final_total:b.estimate;
  var lines=(b.lines||[]).map(function(l){
    return '<div><span>'+esc(l.name)+'</span><span>'+(l.price==null?"On inspection":R(l.price))+'</span></div>'}).join("");
  var svc=b.sport==="badminton"?"Badminton restring":b.sport==="cricket"?"Cricket bat care":"Shoe repair";
  $("app").innerHTML=
    '<div class="code">'+esc(b.code)+'</div>'+
    '<div class="state">'+esc(LABELS[b.status]||b.status)+'</div>'+
    '<p class="sub">'+esc(NOTE[b.status]||"")+'</p>'+
    (cancelled?'':'<div class="track">'+track+'</div><div class="tlabels">'+tl+'</div>')+
    '<p class="step">Booking</p><div class="card kv">'+
      '<div><span>Service</span><span>'+esc(svc)+'</span></div>'+
      '<div><span>'+(b.sport==="badminton"?"Ready by":"Timing")+'</span><span>'+esc(when)+'</span></div>'+
      (b.sport==="badminton"&&b.slot_start&&!b.urgent?'<div><span>Drop off by</span><span>'+esc(fmtTime(b.slot_start))+'</span></div>':'')+
      '<div><span>Drop-off</span><span>'+(b.shop==="5th"?"5th Avenue":"6th Avenue")+'</span></div>'+
      (b.pay_method?'<div><span>Payment</span><span>'+esc(b.pay_method)+'</span></div>':'')+
    '</div>'+
    '<p class="sub">Ask the counter team to check or use your Sportline credit.</p>'+
    '<p class="step">Charges</p><div class="card kv">'+lines+
      '<div class="big"><span>'+(b.final_total!=null?"Total":"Estimate")+'</span><span>'+(b.needs_quote&&b.final_total==null&&!b.estimate?"After inspection":R(total))+'</span></div>'+
      '<div><span>Paid so far</span><span>'+R(b.paid_total)+'</span></div>'+
      '<div class="bal"><span>Balance</span><span>'+(b.needs_quote&&b.final_total==null?"Confirmed after inspection":R(b.balance))+'</span></div>'+
    '</div>'+
    '<div class="row"><button class="btn" id="refresh" type="button">Refresh</button>'+
    '<a class="btn" href="tel:+918056436668">Call the shop</a></div>'+
    '<p class="sub" style="margin-top:14px;font-size:12px">Updated '+new Date(b.updated_at||b.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})+'</p>';
  $("refresh").onclick=load;
}
load();
setInterval(function(){ if(document.visibilityState==="visible") load(); },60000);
})();
