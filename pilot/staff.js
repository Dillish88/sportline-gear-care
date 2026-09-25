(() => {
  const $=id=>document.getElementById(id), money=n=>'₹'+Number(n).toLocaleString('en-IN');
  let session=null, orders=[], loading=false, acting=false, updated='';
  const error=e=>{$('staff-error').textContent=e.message;$('staff-error').hidden=false;};
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  async function accessToken(){
    if(!session) throw new Error('Sign in with an approved staff account.');
    if(Date.now()>session.expiresAt-60000){
      const result=await PilotAPI.request('/api/auth/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
      session={...result,expiresAt:Date.now()+result.expires_in*1000};
    }
    return session.access_token;
  }
  function reset(){session=null;orders=[];$('queue').replaceChildren();$('dashboard').hidden=true;$('logout').hidden=true;$('login').hidden=false;$('password').value='';}
  $('login').onsubmit=async e=>{
    e.preventDefault();$('signin').disabled=true;$('staff-error').hidden=true;
    try{
      const result=await PilotAPI.request('/api/auth/token?grant_type=password',{email:$('email').value.trim(),password:$('password').value});
      session={...result,expiresAt:Date.now()+result.expires_in*1000};$('password').value='';
      orders=await PilotAPI.rpc('pilot_queue',{},await accessToken());
      $('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;updated=new Date().toLocaleTimeString();render();
    }catch(e){reset();error(e);}finally{$('signin').disabled=false;}
  };
  $('logout').onclick=async()=>{const token=session?.access_token;reset();if(token)try{await PilotAPI.request('/api/auth/logout',{},token);}catch{}};
  async function load(){
    if(loading||acting||!session)return;loading=true;$('reload').disabled=true;
    try{orders=await PilotAPI.rpc('pilot_queue',{},await accessToken());updated=new Date().toLocaleTimeString();$('staff-error').hidden=true;render();}
    catch(e){error(e);}finally{loading=false;$('reload').disabled=false;}
  }
  function print(o){
    const box=$('print-label');const r=o.request_data;
    const text=[o.sport==='badminton'?'Badminton restringing':'Cricket bat care',...o.lines.map(l=>l.name),o.sport==='badminton'?`${r.colour} · ${r.mains}/${r.crosses} lbs · ${r.knots} knots`:'',o.gear,'Customer: '+o.customer_name,'Mobile: '+o.phone,'Drop / collect: '+o.shop+' Avenue','Status: '+o.status,'Agreed total (tax inclusive): '+(o.final_total===null?'To confirm':money(o.final_total)),'Note: '+(o.note||'—'),'Check the job number and customer mobile before handover.'].filter(Boolean).join('\n');
    box.replaceChildren(node('h2','Sportline · job slip'),node('h1',o.code),node('p',text));window.print();
  }
  async function act(o,action,amount,button){
    if(acting)return;
    if(action==='accept'&&(!Number.isInteger(amount)||amount<0||amount>100000)){error(new Error('Enter the final agreed price in whole rupees.'));return;}
    if(['cancel','pay','collect'].includes(action)){
      const messages={cancel:'Cancel this unpaid job?',pay:'Confirm payment has been received for '+money(o.final_total)+'?',collect:'Have you verified the job number and customer mobile, and handed the gear back?'};
      if(!window.confirm(messages[action]))return;
    }
    acting=true;button.disabled=true;$('staff-error').hidden=true;
    let failure=null;
    try{await PilotAPI.rpc('pilot_update_order',{p_id:o.id,p_expected:o.status,p_action:action,p_amount:action==='accept'?amount:null},await accessToken());}
    catch(e){failure=e;}
    finally{acting=false;button.disabled=false;await load();if(failure)error(failure);}
  }
  function render(){
    const query=$('search').value.trim().toLowerCase(),branch=$('shop-filter').value,status=$('status-filter').value;
    const matches=(o,s)=>s==='active'?!['Collected','Cancelled'].includes(o.status):s==='working'?['Accepted','At the bench'].includes(o.status):o.status===s;
    document.querySelectorAll('[data-view]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.view===status));b.querySelector('span').textContent=orders.filter(o=>(!branch||o.shop===branch)&&matches(o,b.dataset.view)).length;});
    const visible=orders.filter(o=>(!branch||o.shop===branch)&&matches(o,status)&&(!query||[o.code,o.customer_name,o.phone].join(' ').toLowerCase().includes(query)));
    visible.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    $('count').textContent=visible.length+(visible.length===1?' job':' jobs')+' · Oldest first · Updated '+updated;
    $('queue').replaceChildren();
    if(!visible.length){$('queue').append(node('p','No jobs in this view.'));return;}
    visible.forEach(o=>{
      const card=node('article',undefined,'job-card'),r=o.request_data;
      card.dataset.status=o.status;
      const head=node('div',undefined,'job-heading');head.append(node('h2',o.code),node('span',o.status==='Requested'?'New request':o.status,'badge'));card.append(head);
      card.append(node('h3',o.customer_name,'customer-name'),node('p',o.phone+' · '+o.shop+' Avenue','customer-meta'));
      card.append(node('p',o.sport==='badminton'?'Badminton restringing':o.sport==='shoe'?'Shoe repair':'Cricket bat care','service-name'));
      card.append(node('p',o.sport==='badminton'?(o.lines[0]?.name||'')+' · '+r.colour+'\n'+r.mains+'/'+r.crosses+' lbs · '+r.knots+' knots'+(r.pre_stretch?' · Pre-stretch':'')+'\n'+(r.needed||'Timing to confirm')+(r.priority?' · Priority requested':''):o.lines.map(l=>l.name).join(' · '),'setup-summary'));
      const detail=node('details',undefined,'job-details');detail.append(node('summary','Repair details & charges'));
      const detailBody=node('div');detail.append(detailBody);
      detailBody.append(node('p','Booked: '+new Date(o.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})));
      detailBody.append(node('p',o.lines.map(l=>l.name+' · '+(l.price===null?'Quote required':money(l.price))).join('\n')));
      if(o.sport==='badminton')detailBody.append(node('p',`${r.colour} · ${r.mains}/${r.crosses} lbs · ${r.knots} knots\nNeeded: ${r.needed}${r.advice?'\nAdvice requested: confirm setup with customer.':''}`));
      if(o.gear)card.append(node('p',o.gear,'gear-name'));if(o.note)card.append(node('p','Customer note: '+o.note,'customer-note'));if(r.advice)card.append(node('p','Setup advice requested — check with the customer.','customer-note'));if(o.src)detailBody.append(node('p','QR source: '+o.src));
      detailBody.append(node('p','Estimate: '+money(o.estimate)+(o.needs_quote?' + quote':'')+'\nAgreed: '+(o.final_total===null?'Not confirmed':money(o.final_total))+'\nPayment: '+(o.paid?'Paid':'Unpaid')+' · '+r.payment+'\nService prices include tax.'));
      card.append(node('p',(o.final_total===null?'Estimate '+money(o.estimate)+(o.needs_quote?' + quote':''):money(o.final_total)+' agreed')+' · '+(o.paid?'Paid':'Unpaid'),'price-summary'));
      let amount;
      if(o.status==='Requested'){
        const label=node('label','Final price agreed with customer (₹)');amount=node('input');amount.type='number';amount.min='0';amount.max='100000';amount.step='1';amount.value=o.needs_quote?'':o.estimate;label.append(amount);card.append(label,node('p','Accept only after checking stock, gear condition, frame limits and timing.','field-help'));
      }
      const actions=node('div',undefined,'actions');const extra=node('details',undefined,'job-options');extra.append(node('summary','More actions'));const extras=node('div',undefined,'actions');extra.append(extras);
      const message=['Hi '+o.customer_name+',','Sportline Gear Care — '+o.code,'Status: '+o.status,
        ...o.lines.map(l=>l.name+' — '+(l.price===null?'Quote after inspection':money(l.price)+' (tax inclusive)')),
        o.gear?'Gear: '+o.gear:'',o.sport==='badminton'?r.colour+' · '+r.mains+'/'+r.crosses+' lbs · '+r.knots+' knots'+(r.pre_stretch?' · Pre-stretch':''):'',
        o.sport==='badminton'?'Requested timing: '+r.needed+' (subject to shop confirmation)':'Bat work: completion time confirmed after inspection',
        r.advice?'Please confirm the string setup with our team.':'',
        'Estimated total: '+money(o.estimate)+(o.needs_quote?' + inspection quote':''),
        'Agreed total: '+(o.final_total===null?'Awaiting counter confirmation':money(o.final_total)+' (tax inclusive)'),
        'Payment: '+(o.paid?'Received':'Not yet received')+' · '+r.payment,
        'Drop / collect: '+(o.shop==='6th'?'2, R-Block, 6th Ave West, Anna Nagar':'265, 5th Ave, Z Block, Anna Nagar'),
        'Hours: 10am–9pm · Shop: +91 80564 36668',
        o.status==='Ready'?'Your gear is ready. Bring your job number when collecting.':o.status==='Collected'?'Thank you for choosing Sportline.':o.status==='Cancelled'?'This request has been cancelled.':'The shop will confirm stock, final price and collection time. Priority is subject to confirmation.'
      ].filter(Boolean).join('\n');
      const preview=node('details');preview.className='whatsapp-details';preview.append(node('summary','Review WhatsApp message'),node('p',message));
      const wa=node('a','Open WhatsApp to send','secondary');wa.href='https://wa.me/91'+o.phone+'?text='+encodeURIComponent(message);wa.target='_blank';wa.rel='noopener noreferrer';preview.append(wa);
      preview.append(node('p','Review the message and tap Send in WhatsApp. Opening WhatsApp does not send it.','field-help'));
      if(r.marketing_opt_in){const consent=node('button','Confirm offers opt-in at counter','secondary');consent.onclick=async()=>{if(!confirm('Has this customer confirmed they want Sportline offers on this number for 12 months?'))return;try{await PilotAPI.rpc('pilot_marketing_consent',{p_order:o.id,p_opt_in:true},await accessToken());consent.textContent='Offer opt-in saved';}catch(e){error(e);}};extras.append(consent);}
      const stop=node('button','Stop offers for this number','secondary');stop.onclick=async()=>{try{await PilotAPI.rpc('pilot_marketing_consent',{p_order:o.id,p_opt_in:false},await accessToken());stop.textContent='Offers stopped';}catch(e){error(e);}};extras.append(stop);
      function button(label,action,secondary=false){const b=node('button',label,secondary?'secondary':'primary');b.onclick=()=>act(o,action,amount?.value===''?NaN:Number(amount?.value),b);(secondary?extras:actions).append(b);}
      if(o.status==='Requested')button('Accept job','accept');
      if(o.status==='Accepted')button('Start work','start');
      if(o.status==='At the bench')button('Mark ready','ready');
      if(['Accepted','At the bench','Ready'].includes(o.status)&&!o.paid)button('Record payment','pay',o.status!=='Ready');
      if(o.status==='Ready'&&o.paid)button('Handed back','collect');
      if(['Requested','Accepted'].includes(o.status)&&!o.paid)button('Cancel','cancel',true);
      const p=node('button','Print job slip','secondary');p.onclick=()=>print(o);actions.append(p);card.append(actions,detail,preview,extra);$('queue').append(card);
    });
  }
  $('withdraw-offers').onclick=async()=>{try{await PilotAPI.rpc('pilot_withdraw_offers',{p_phone:$('withdraw-phone').value.trim()},await accessToken());$('withdraw-phone').value='';$('withdraw-result').textContent='Offers stopped for that number.';await load();}catch(e){error(e);}};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{$('status-filter').value=b.dataset.view;render();});
  $('reload').onclick=load;['search','shop-filter','status-filter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
  setInterval(()=>{if(!document.hidden&&!document.querySelector('.job-card details[open]')&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))load();},15000);
})();
