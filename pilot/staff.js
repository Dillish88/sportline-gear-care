(() => {
  const $=id=>document.getElementById(id), money=n=>'₹'+Number(n).toLocaleString('en-IN');
  let session=null, orders=[], loading=false, acting=false, updated='';
  const error=e=>{$('staff-error').textContent=e.message;$('staff-error').hidden=false;};
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  async function accessToken(){
    if(!session) throw new Error('Sign in with an approved staff account.');
    if(Date.now()>session.expiresAt-60000){
      const result=await PilotAPI.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
      session={...result,expiresAt:Date.now()+result.expires_in*1000};
    }
    return session.access_token;
  }
  function reset(){session=null;orders=[];$('queue').replaceChildren();$('dashboard').hidden=true;$('logout').hidden=true;$('login').hidden=false;$('password').value='';}
  $('login').onsubmit=async e=>{
    e.preventDefault();$('signin').disabled=true;$('staff-error').hidden=true;
    try{
      const result=await PilotAPI.request('/auth/v1/token?grant_type=password',{email:$('email').value.trim(),password:$('password').value});
      session={...result,expiresAt:Date.now()+result.expires_in*1000};$('password').value='';
      orders=await PilotAPI.rpc('pilot_queue',{},await accessToken());
      $('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;updated=new Date().toLocaleTimeString();render();
    }catch(e){reset();error(e);}finally{$('signin').disabled=false;}
  };
  $('logout').onclick=async()=>{const token=session?.access_token;reset();if(token)try{await PilotAPI.request('/auth/v1/logout',{},token);}catch{}};
  async function load(){
    if(loading||acting||!session)return;loading=true;$('reload').disabled=true;
    try{orders=await PilotAPI.rpc('pilot_queue',{},await accessToken());updated=new Date().toLocaleTimeString();$('staff-error').hidden=true;render();}
    catch(e){error(e);}finally{loading=false;$('reload').disabled=false;}
  }
  function print(o){
    const box=$('print-label');const r=o.request_data;
    const text=[o.sport==='badminton'?'Badminton restringing':'Cricket bat care',...o.lines.map(l=>l.name),o.sport==='badminton'?`${r.colour} · ${r.mains}/${r.crosses} lbs · ${r.knots} knots`:'',o.gear,'Customer: '+o.customer_name,'Mobile: '+o.phone,'Drop / collect: '+o.shop+' Avenue','Status: '+o.status,'Agreed total: '+(o.final_total===null?'To confirm':money(o.final_total)),'Note: '+(o.note||'—'),'Check the job number and customer mobile before handover.'].filter(Boolean).join('\n');
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
    const visible=orders.filter(o=>(!branch||o.shop===branch)&&(status==='active'?!['Collected','Cancelled'].includes(o.status):o.status===status)&&(!query||[o.code,o.customer_name,o.phone].join(' ').toLowerCase().includes(query)));
    $('count').textContent=visible.length+' jobs · Updated '+updated+' · Refreshes every 15 seconds while this tab is open.';
    $('queue').replaceChildren();
    if(!visible.length){$('queue').append(node('p','No jobs in this view.'));return;}
    visible.forEach(o=>{
      const card=node('article',undefined,'job-card'),r=o.request_data;
      card.append(node('h2',o.code),node('span',o.status,'badge'),node('p',`${o.customer_name} · ${o.phone}\n${o.shop} Avenue · ${new Date(o.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`));
      card.append(node('p',o.lines.map(l=>l.name+' · '+(l.price===null?'Quote required':money(l.price))).join('\n')));
      if(o.sport==='badminton')card.append(node('p',`${r.colour} · ${r.mains}/${r.crosses} lbs · ${r.knots} knots\nNeeded: ${r.needed}${r.advice?'\nAdvice requested: confirm setup with customer.':''}`));
      if(o.gear)card.append(node('p','Gear: '+o.gear));if(o.note)card.append(node('p','Note: '+o.note));if(o.src)card.append(node('p','QR source: '+o.src));
      card.append(node('p','Estimate: '+money(o.estimate)+(o.needs_quote?' + quote':'')+'\nAgreed: '+(o.final_total===null?'Not confirmed':money(o.final_total))+'\nPayment: '+(o.paid?'Paid':'Unpaid')+' · '+r.payment));
      let amount;
      if(o.status==='Requested'){
        const label=node('label','Final price agreed with customer (₹)');amount=node('input');amount.type='number';amount.min='0';amount.max='100000';amount.step='1';amount.value=o.needs_quote?'':o.estimate;label.append(amount);card.append(label,node('p','Accept only after checking stock, gear condition, frame limits and timing.','field-help'));
      }
      const actions=node('div',undefined,'actions');
      function button(label,action){const b=node('button',label,'primary');b.onclick=()=>act(o,action,amount?.value===''?NaN:Number(amount?.value),b);actions.append(b);}
      if(o.status==='Requested')button('Accept job','accept');
      if(o.status==='Accepted')button('Start work','start');
      if(o.status==='At the bench')button('Mark ready','ready');
      if(['Accepted','At the bench','Ready'].includes(o.status)&&!o.paid)button('Record payment','pay');
      if(o.status==='Ready'&&o.paid)button('Handed back','collect');
      if(['Requested','Accepted'].includes(o.status)&&!o.paid)button('Cancel','cancel');
      const p=node('button','Print job slip','secondary');p.onclick=()=>print(o);actions.append(p);card.append(actions);$('queue').append(card);
    });
  }
  $('reload').onclick=load;['search','shop-filter','status-filter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
  setInterval(()=>{if(!document.hidden&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))load();},15000);
})();
