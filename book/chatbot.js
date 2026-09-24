/* Guided catalogue assistant. No LLM or external knowledge service. Physical stock and setup require staff confirmation. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function R(n) { return "\u20b9" + Number(n || 0).toLocaleString("en-IN"); }

  var WA = "918056436668";
  var root = document.createElement("div");
  root.innerHTML =
    '<button id="cbOpen" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="cbPanel">' +
      '<span class="cb-ico" aria-hidden="true">?</span><span class="cb-label">Help me choose</span></button>' +
    '<div id="cbPanel" role="dialog" aria-modal="false" aria-label="Sportline assistant" hidden>' +
      '<div id="cbHead"><span>Sportline assistant</span><button id="cbClose" type="button" aria-label="Close">\u00d7</button></div>' +
      '<div id="cbBody" role="log" aria-live="polite"></div>' +
      '<div id="cbChoices"></div>' +
    '</div>';
  document.body.appendChild(root);

  var style = document.createElement("style");
  style.textContent =
    '#cbOpen{position:fixed;right:18px;bottom:18px;z-index:60;display:flex;align-items:center;gap:9px;' +
      'min-height:52px;padding:12px 20px 12px 16px;border:0;border-radius:999px;cursor:pointer;' +
      'background:linear-gradient(180deg,var(--red-lit,#ff3a40),var(--red,#e31e24));color:#fff;' +
      'font-family:var(--sans,inherit);font-size:13.5px;font-weight:800;letter-spacing:.02em;' +
      'box-shadow:0 10px 30px rgba(227,30,36,.35)}' +
    '#cbOpen .cb-ico{display:flex;align-items:center;justify-content:center;width:22px;height:22px;' +
      'border-radius:50%;background:rgba(255,255,255,.22);font-size:13px}' +
    '#cbPanel{position:fixed;right:18px;bottom:84px;z-index:61;width:min(360px,calc(100vw - 36px));' +
      'max-height:min(560px,calc(100vh - 120px));display:flex;flex-direction:column;overflow:hidden;' +
      'background:linear-gradient(180deg,var(--panel-2,#15181e),var(--panel,#101216));' +
      'border:1px solid var(--line-2,rgba(255,255,255,.15));border-radius:18px;' +
      'box-shadow:0 30px 70px -20px rgba(0,0,0,.8)}' +
    '#cbHead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;' +
      'border-bottom:1px solid var(--line,rgba(255,255,255,.075));font-weight:800;font-size:13.5px;' +
      'color:var(--text,#f2f4f7);font-family:var(--sans,inherit)}' +
    '#cbClose{background:none;border:0;color:var(--muted,#a3acb8);font-size:20px;line-height:1;cursor:pointer;padding:4px 6px}' +
    '#cbBody{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;' +
      'font-family:var(--sans,inherit);font-size:13.5px;color:var(--text,#f2f4f7)}' +
    '.cb-msg{max-width:88%;padding:10px 13px;border-radius:14px;line-height:1.5}' +
    '.cb-bot{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid var(--line,rgba(255,255,255,.075))}' +
    '.cb-me{align-self:flex-end;background:var(--chrome,linear-gradient(175deg,#fff,#8f98a3));color:#0a0b0d;font-weight:700}' +
    '.cb-msg b{display:block;margin-bottom:2px}' +
    '.cb-msg a{color:inherit;text-decoration:underline}' +
    '#cbChoices{display:flex;flex-wrap:wrap;gap:7px;padding:12px 16px 16px;' +
      'border-top:1px solid var(--line,rgba(255,255,255,.075))}' +
    '#cbChoices button{min-height:40px;padding:8px 14px;border-radius:999px;cursor:pointer;' +
      'border:1px solid var(--line-2,rgba(255,255,255,.15));background:rgba(255,255,255,.03);' +
      'color:var(--text,#f2f4f7);font-family:var(--sans,inherit);font-size:12.5px;font-weight:700}' +
    '#cbChoices button:hover{border-color:var(--line-3,rgba(255,255,255,.32))}' +
    'body[data-screen=flow] #cbOpen{bottom:112px}body[data-screen=flow] #cbPanel{bottom:174px;max-height:calc(100dvh - 196px)}#cbPanel[hidden]{display:none!important}' +
    '@media(max-width:420px){#cbPanel{right:10px;left:10px;width:auto;bottom:78px}#cbOpen{right:14px}}' +
    '@media(prefers-reduced-motion:reduce){#cbPanel{transition:none}}';
  document.head.appendChild(style);

  var open = $("cbOpen"), panel = $("cbPanel"), body = $("cbBody"), choices = $("cbChoices"), closeBtn = $("cbClose");
  var state = { adv: {} };

  function show() {
    panel.hidden = false; open.setAttribute("aria-expanded", "true");
    if (!body.children.length) { greet(); }
    var f = panel.querySelector("button"); if (f) f.focus();
  }
  function hide() { panel.hidden = true; open.setAttribute("aria-expanded", "false"); open.focus(); }
  open.onclick = function () { panel.hidden ? show() : hide(); };
  closeBtn.onclick = hide;
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) hide(); });

  function say(html) {
    var d = document.createElement("div"); d.className = "cb-msg cb-bot"; d.innerHTML = html;
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }
  function sayMe(text) {
    var d = document.createElement("div"); d.className = "cb-msg cb-me"; d.textContent = text;
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }
  function offer(options) {
    choices.innerHTML = "";
    options.forEach(function (o) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = o.label;
      b.onclick = function () { sayMe(o.label); choices.innerHTML = ""; o.go(); };
      choices.appendChild(b);
    });
  }
  function waLink(text) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent(text); }
  function humanFallback(why) {
    say("I don't have a confident answer for that from our catalogue. " +
      '<a href="' + waLink(why || "Hi, I had a question about restringing.") + '" target="_blank" rel="noopener">Ask the shop on WhatsApp \u2192</a>');
    mainMenu();
  }

  function greet() {
    say("Hi \u2014 I'm the Sportline assistant. I can help you choose from our listed strings and prices. The counter team confirms stock, colour and your racket setup.");
    mainMenu();
  }
  function mainMenu() {
    offer([
      { label: "Browse strings & prices", go: browseBrands },
      { label: "Help me pick a string", go: askLevel },
      { label: "What tension should I use?", go: function () { say("Tension is really about your level and shuttle \u2014 I can suggest a starting setup after a few questions. Staff must check the frame limit and stringing pattern."); askLevel(); } },
      { label: "When will it be ready?", go: readyInfo },
      { label: "Shop hours & location", go: shopInfo },
      { label: "Sportline credit", go: creditInfo },
      { label: "Track my order", go: trackInfo }
    ]);
  }

  /* ---- string / tension adviser: identical rules to the booking form's own adviser ---- */
  function askLevel() {
    say("How long have you been playing?");
    offer([
      { label: "Just started", go: function () { state.adv.lv = "beg"; askFreq(); } },
      { label: "Club, regularly", go: function () { state.adv.lv = "club"; askFreq(); } },
      { label: "Competitive", go: function () { state.adv.lv = "adv"; askFreq(); } }
    ]);
  }
  function askFreq() {
    say("How often do you play?");
    offer([
      { label: "1\u20132 times a week", go: function () { state.adv.fq = "low"; askShuttle(); } },
      { label: "3\u20134 times a week", go: function () { state.adv.fq = "mid"; askShuttle(); } },
      { label: "Almost daily", go: function () { state.adv.fq = "high"; askShuttle(); } }
    ]);
  }
  function askShuttle() {
    say("Which shuttle do you usually play with?");
    offer([
      { label: "Nylon / plastic", go: function () { state.adv.sh = "ny"; askWant(); } },
      { label: "Feather", go: function () { state.adv.sh = "fe"; askWant(); } }
    ]);
  }
  function askWant() {
    say("And what matters more to you?");
    offer([
      { label: "Control", go: function () { state.adv.wt = "ctrl"; askFrame(); } },
      { label: "A bit of both", go: function () { state.adv.wt = "bal"; askFrame(); } },
      { label: "Power", go: function () { state.adv.wt = "pow"; askFrame(); } }
    ]);
  }
  function browseBrands(){
    var list=window.SportlineBooking?.catalogue()||[];
    var brands=[...new Set(list.map(c=>c.key.split('|')[0]))];if(!brands.length){humanFallback();return;}
    say('Choose a brand to see its listed strings and tax-inclusive prices. Stock and colour are confirmed at the counter.');
    offer(brands.map(brand=>({label:brand,go:()=>{var items=list.filter(c=>c.key.startsWith(brand+'|'));say(items.map(c=>esc(c.name)+' — '+R(c.price)).join('<br>'));offer([{label:'Other brands',go:browseBrands},{label:'Main menu',go:mainMenu}]);}})));
  }
  function askFrame(){
    say('What maximum tension is printed on your racket? Enter the limit in lbs. If you cannot find it, ask the counter team.');
    var label=document.createElement('label');label.textContent='Frame maximum (lbs)';var input=document.createElement('input');input.type='number';input.min='18';input.max='35';input.id='cbFrame';input.style.cssText='width:100%;padding:12px;margin-top:6px';label.append(input);choices.append(label);
    var b=document.createElement('button');b.textContent='Check suggestion';b.onclick=()=>{var max=Number(input.value);if(!Number.isInteger(max)||max<18||max>35){input.setCustomValidity('Enter a whole number from 18 to 35, or ask staff.');input.reportValidity();return;}state.adv.max=max;sayMe('Frame limit '+max+' lbs');choices.replaceChildren();giveAdvice();};choices.append(b);
    var help=document.createElement('button');help.textContent='Not sure — ask staff';help.onclick=()=>humanFallback('Hi, can you check my racket frame limit and help choose a string?');choices.append(help);
  }
  function giveAdvice() {
    var a = state.adv, lv = a.lv, fq = a.fq, sh = a.sh, wt = a.wt;
    var t = { beg: 20, club: 24, adv: 27 }[lv];
    if (wt === "ctrl") t += 1; if (wt === "pow") t -= 1;
    if (fq === "high" && lv !== "beg") t += 1; if (fq === "low" && lv === "adv") t -= 1;
    if (sh === "ny") t -= 1;
    t = Math.max({ beg: 18, club: 22, adv: 25 }[lv], Math.min({ beg: 23, club: 26, adv: 29 }[lv], t));
    t=Math.min(t,state.adv.max);var cross = Math.min(state.adv.max, t + 2);
    var pickName = { beg: "BG65", club_ctrl: "Nanogy 95", club_bal: "BG65 Titanium", club_pow: "BG66 Ultimax",
      adv_ctrl: "Aero Bite Boost", adv_bal: "Exbolt 65", adv_pow: "Aero Sonic" }[lv === "beg" ? "beg" : lv + "_" + wt];
    var s = byKey("Yonex|" + pickName) || byKey("Yonex|BG65");
    if (!s) { humanFallback(); return; }
    say("<b>" + t + " / " + cross + " lbs \u00b7 " + esc(s.name) + " \u2014 " + R(s.price) + "</b>" +
      " Suggested starting setup, within the limit you entered. Staff must confirm the racket condition, manufacturer pattern, stock and colour before stringing.");
    offer([
      { label: "Use this in my booking", go: function () { applyToForm(s.key, t, cross); } },
      { label: "Ask something else", go: mainMenu }
    ]);
  }
  // Same lookup index.js's own adviser uses: exact key match against the loaded
  // catalogue. Never a fuzzy or name-based guess, so it can't drift from what's real.
  function byKey(k){return (window.SportlineBooking?.catalogue()||[]).find(c=>c.key===k)||null;}
  function applyToForm(key,mains,crosses){
    if(!window.SportlineBooking?.apply(key,mains,crosses)){humanFallback();return;}
    hide();say('Added as a suggested setup for staff to confirm.');mainMenu();document.getElementById('flow').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }

  /* ---- fixed shop facts: no catalogue lookup needed ---- */
  function readyInfo() {
    say("A restring is about 20 minutes on the machine. Pick a ready-by time \u2014 11:00am to 9:00pm, half-hour steps \u2014 and drop your racket in at least 30 minutes before that. There's a break from 2:00 to 2:30pm, so nothing is bookable to start right then.");
    say("Bat work runs differently \u2014 it's done before the shop opens, so we tell you a ready date after we've looked at the bat, not a same-day time.");
    offer([{ label: "Something else", go: mainMenu }]);
  }
  function shopInfo() {
    say("6th Avenue West, R Block, Anna Nagar. Open 10:30am to 9pm.<br><a href=\"tel:+918056436668\">+91 80564 36668</a>");
    offer([{ label: "Something else", go: mainMenu }]);
  }
  function creditInfo() {
    say("You earn 5% back as Sportline credit on every completed job \u2014 automatic, tied to your phone number, no app needed. Switch on WhatsApp offers when you book and staff can confirm your opt-in and add a one-time \u20b920 welcome credit. Spend it at the counter next time; staff can put part of your bill on it.");
    offer([{ label: "Something else", go: mainMenu }]);
  }
  function trackInfo() {
    say("The link in your booking confirmation shows live status \u2014 stage, ready-by time, what's paid, what's left. If you can't find it, message the shop with your name and mobile number and they'll look it up.");
    offer([
      { label: "Message the shop", go: function () { window.open(waLink("Hi, could you help me find my booking status?"), "_blank", "noopener"); mainMenu(); } },
      { label: "Something else", go: mainMenu }
    ]);
  }
})();
