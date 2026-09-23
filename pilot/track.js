(() => {
  const $=id=>document.getElementById(id);
  const token=location.hash.slice(1);
  const help={Requested:'Your request is saved. Show this number at the counter and hand your gear to the team. Work starts after staff confirm the price.',Accepted:'Your job has been accepted. The team will move it to the bench.', 'At the bench':'Your gear is being worked on.',Ready:'Your gear is ready. Collect it at your selected shop.',Collected:'Your gear has been collected. See you on court!',Cancelled:'This request was cancelled. Contact the counter if you need help.'};
  async function refresh(){
    $('error').hidden=true; $('refresh').disabled=true;
    try {
      if(!/^[a-f0-9-]{36}$/i.test(token)) throw new Error('This private link is incomplete. Please ask the counter team for help.');
      const o=await PilotAPI.rpc('pilot_track_booking',{p_token:token});
      if(!o) throw new Error('We could not find this job. Check your private link or ask the counter team.');
      $('title').textContent='Your request is saved.'; $('message').textContent='Keep this page or take a screenshot of your job number.';
      const stages=['Requested','Accepted','At the bench','Ready','Collected'];
      const labels=['Received','Accepted','Repairing','Ready','Collected'];
      $('progress').hidden=o.status==='Cancelled';
      $('progress').replaceChildren(...stages.map((s,i)=>{const li=document.createElement('li');li.textContent=labels[i];if(i<stages.indexOf(o.status))li.className='complete';if(s===o.status){li.className='current';li.setAttribute('aria-current','step');}return li;}));
      $('code').textContent=o.code; $('instruction').textContent=help[o.status]; $('job').hidden=false;
      const rows=[['Status',o.status],['Drop & collect',o.shop==='5th'?'5th Avenue':'6th Avenue'],['Estimate','₹'+o.estimate.toLocaleString('en-IN')+(o.needs_quote?' + inspection quote':'')],['Agreed price',o.final_total===null?'Awaiting counter confirmation':'₹'+o.final_total.toLocaleString('en-IN')],['Payment',o.paid?'Recorded as paid':'Not yet recorded']];
      $('details').replaceChildren(...rows.map(([k,v])=>{const row=document.createElement('div');row.className='review-row';const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;row.append(dt,dd);return row;}));
    } catch(e){$('title').textContent='Let’s check your job.';$('error').textContent=e.message;$('error').hidden=false;}
    finally{$('refresh').disabled=false;}
  }
  $('refresh').onclick=refresh;
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('copy-status').textContent='Link copied.';}catch{$('copy-status').textContent='Copy the link from your browser’s address bar.';}};
  refresh();
})();
