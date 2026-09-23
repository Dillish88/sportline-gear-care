(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = n => '₹' + Number(n).toLocaleString('en-IN');
  $('next').disabled = true;
  let entries;
  try { entries = await PilotAPI.rpc('pilot_public_catalogue'); }
  catch (e) { $('setup-note').hidden=false; $('setup-note').textContent='The service list could not load. Refresh to retry or ask the counter team. '+e.message; return; }
  const catalogue = Object.create(null);
  entries.filter(e=>e.sport==='badminton').forEach(e=>{const [brand,...model]=e.key.split('|');(catalogue[brand] ||= []).push([model.join('|'),e.price,e.colours]);});
  if(!Object.keys(catalogue).length){$('setup-note').hidden=false;$('setup-note').textContent='No strings are available for booking. Please ask the counter team.';return;}
  const handles=entries.filter(e=>e.sport==='cricket'&&e.key.startsWith('handle-'));
  $('handle').replaceChildren(new Option('No replacement needed','0'),...handles.map(e=>{const o=new Option(e.name.replace('New handle: ','')+' — '+money(e.price),e.price);o.dataset.key=e.key;return o;}));
  $('next').disabled = false;
  const params = new URLSearchParams(location.search);
  const source = (params.get('src') || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100);
  const sportParam = (params.get('sport') || params.get('svc') || '').toLowerCase();
  let sport = ['cri', 'cricket', 'bat'].includes(sportParam) ? 'cricket' : 'badminton';
  let step = 0;
  let reached = 0;
  const batJobs = entries.filter(e=>e.sport==='cricket'&&!e.key.startsWith('handle-')).map(e=>[e.key,e.name,e.price]);
  const shops = {
    '6th': '6th Avenue — 2, R-Block, 6th Ave West, Anna Nagar',
    '5th': '5th Avenue — 265, 5th Ave, Z Block, Anna Nagar'
  };
  if (source) { $('referral').textContent = 'Referred by ' + source; $('referral').hidden = false; }
  if (params.get('shop') === '5th') document.querySelector('input[name=shop][value="5th"]').checked = true;
  function fillSelect(id, options) {
    $(id).replaceChildren(...options.map(([value, text]) => new Option(text, value)));
    if (id === 'brand' || id === 'colour') {
      const group = $(id + '-chips');
      group.replaceChildren(...options.map(([value,text],i) => {
        const label = document.createElement('label'); label.className = 'choice-chip';
        const radio = document.createElement('input'); radio.type='radio'; radio.name=id+'-choice'; radio.value=value; radio.checked=i===0;
        const span = document.createElement('span'); span.textContent=text;
        radio.addEventListener('change',()=>{ if(radio.checked){$(id).value=value;$(id).dispatchEvent(new Event('change',{bubbles:true}));} });
        label.append(radio,span);return label;
      }));
    }
  }
  fillSelect('brand', Object.keys(catalogue).map(b => [b, b]));
  function currentString() { return catalogue[$('brand').value][Number($('string').value)]; }
  function fillColours() { fillSelect('colour', currentString()[2].map(c => [c, c])); }
  function fillStrings() {
    fillSelect('string', catalogue[$('brand').value].map((s, i) => [i, s[0] + ' · ' + money(s[1])]));
    fillColours();
  }
  fillStrings();
  batJobs.forEach(([id, name, price]) => {
    const label = document.createElement('label'); label.className = 'check-row';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = id; input.name = 'bat-job';
    const text = document.createElement('span'); text.textContent = name;
    const cost = document.createElement('b'); cost.textContent = price === null ? 'On inspection' : money(price);
    label.append(input, text, cost); $('bat-services').append(label);
  });
  function selectedBatJobs() {
    const chosen = [...document.querySelectorAll('input[name=bat-job]:checked')].map(el => el.value);
    return batJobs.filter(j => chosen.includes(j[0]));
  }
  const shop = () => document.querySelector('input[name=shop]:checked').value;
  const normalizedPhone = () => {
    let phone = $('phone').value.replace(/\D/g, '');
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    return phone;
  };
  const tensionText = () => $('separate').checked
    ? `${$('mains').value} / ${$('crosses').value} lbs mains/crosses` : `${$('tension').value} lbs`;
  function lines() {
    if (sport === 'cricket') {
      const rows = selectedBatJobs().map(j => [j[1], j[2]]);
      if (Number($('handle').value)) rows.push(['New handle · ' + $('handle').selectedOptions[0].text.split(' — ')[0], Number($('handle').value)]);
      return rows;
    }
    const s = currentString();
    const rows = [[$('brand').value + ' ' + s[0], s[1]]];
    if ($('knots').checked) rows.push(['4-knot stringing', 25]);
    if ($('pre').checked) rows.push(['Pre-stretch', 25]);
    if ($('priority').checked) rows.push(['Priority, if confirmed', 100]);
    return rows;
  }
  function renderSummary() {
    const rows = lines();
    $('line-items').replaceChildren(...rows.map(([name, cost]) => {
      const row = document.createElement('div'); row.className = 'line-item';
      const title = document.createElement('span'); title.textContent = name;
      const price = document.createElement('span'); price.textContent = cost === null ? 'To quote' : money(cost);
      row.append(title, price); return row;
    }));
    $('summary-sport').textContent = sport === 'badminton' ? 'Badminton restringing' : 'Cricket bat care';
    const quoted = rows.some(r => r[1] === null);
    const total = rows.reduce((sum, r) => sum + (r[1] || 0), 0);
    $('total').textContent = quoted && !total ? 'To quote' : money(total) + (quoted ? ' + quote' : '');
    $('total').style.fontSize = quoted ? '23px' : '';
    $('mobile-total').textContent = $('total').textContent;
    $('estimate-note').textContent = quoted ? 'Priced work includes tax. Inspection work is quoted separately.'
      : sport === 'badminton' ? 'Includes string, labour and tax.' : rows.length ? 'Service prices include tax.' : 'Choose a service to see your estimate.';
    $('bench-copy').textContent = sport === 'badminton'
      ? 'A restring takes about 30 minutes on the machine. We’ll check the queue and confirm your turnaround.'
      : 'Knocking-in and repairs take proper time. We inspect the bat and agree the work and finish date with you.';
  }
  function renderSport() {
    document.querySelectorAll('[data-sport]').forEach(b => {
      const selected = b.dataset.sport === sport;
      b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected));
    });
    $('badminton-fields').hidden = sport !== 'badminton';
    $('cricket-fields').hidden = sport !== 'cricket';
    $('timing-fields').hidden = sport !== 'badminton';
    renderSummary();
  }
  function reviewRows() {
    const rows = [['Service', sport === 'badminton' ? 'Badminton restringing' : 'Cricket bat care']];
    if (sport === 'badminton') {
      rows.push(['Setup', `${$('brand').value} ${currentString()[0]}\n${$('colour').value} · ${tensionText()}\n${$('knots').checked ? '4' : '2'} knots${$('pre').checked ? ' · pre-stretch' : ''}`]);
      if ($('advice').checked) rows.push(['Advice', 'Please help me choose my string and tension.']);
    } else rows.push(['Work', lines().map(r => r[0]).join('\n')]);
    rows.push(['Customer', $('name').value.trim() + '\n' + normalizedPhone()]);
    if ($('gear').value.trim()) rows.push(['Gear', $('gear').value.trim()]);
    rows.push(['Drop-off', shops[shop()]]);
    rows.push(['Timing', sport === 'badminton' ? $('when').value + ($('priority').checked ? '\nPriority requested (+₹100 if confirmed)' : '') : 'Finish date confirmed after inspection']);
    rows.push(['Payment', $('payment').value + ' on collection']);
    if ($('notes').value.trim()) rows.push(['Notes', $('notes').value.trim()]);
    if (source) rows.push(['Referral', source]);
    rows.push(['Estimate', $('total').textContent + ' · inclusive of tax on priced work']);
    return rows;
  }
  function renderReview() {
    const list = document.createElement('dl');
    reviewRows().forEach(([key, value]) => {
      const row = document.createElement('div'); row.className = 'review-row';
      const dt = document.createElement('dt'); dt.textContent = key;
      const dd = document.createElement('dd'); dd.textContent = value;
      row.append(dt, dd); list.append(row);
    });
    $('review-details').replaceChildren(list);
  }
  function validStage(which) {
    if (which === 0) {
      if (sport === 'cricket' && !lines().length) return ['Choose at least one bat service or a replacement handle.', document.querySelector('input[name=bat-job]')];
      if (sport === 'badminton') {
        const ids = $('separate').checked ? ['mains', 'crosses'] : ['tension'];
        for (const id of ids) {
          const n = Number($(id).value);
          if (!Number.isInteger(n) || n < 18 || n > 35) return ['Choose a tension between 18 and 35 lbs, within your frame’s limit.', $(id)];
        }
      }
    }
    if (which === 1) {
      if (!$('name').value.trim()) return ['Please enter your name.', $('name')];
      if (!/^[6-9]\d{9}$/.test(normalizedPhone())) return ['Enter a valid 10-digit Indian mobile number. +91 is also accepted.', $('phone')];
    }
    return null;
  }
  function showError(problem) { $('error').textContent = problem[0]; $('error').hidden = false; problem[1].focus(); }
  function showStep(next, focus = true) {
    step = next; reached = Math.max(reached, step);
    document.querySelectorAll('[data-panel]').forEach(p => p.hidden = Number(p.dataset.panel) !== step);
    document.querySelectorAll('[data-step]').forEach(b => {
      const n = Number(b.dataset.step); b.disabled = n > reached;
      if (n === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    $('back').hidden = step === 0; $('error').hidden = true; $('sent').hidden = true;
    $('next').replaceChildren(document.createTextNode(['Continue to details', 'Review your request', 'Save my booking request'][step]));
    const arrow = document.createElement('span'); arrow.textContent = step === 2 ? '↗' : '→'; $('next').append(arrow);
    if (step === 2) renderReview();
    if (focus) document.querySelector(`[data-panel="${step}"] .stage-title`).focus();
  }
  function goForward(target) {
    for (let i = 0; i < target; i++) {
      const problem = validStage(i);
      if (problem) { showStep(i); showError(problem); return; }
    }
    showStep(target);
  }
  document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
    const next = Number(b.dataset.step); next > step ? goForward(next) : showStep(next);
  }));
  document.querySelectorAll('[data-sport]').forEach(b => b.addEventListener('click', () => { sport = b.dataset.sport; renderSport(); $('error').hidden = true; }));
  $('brand').addEventListener('change', fillStrings);
  $('string').addEventListener('change', fillColours);
  $('separate').addEventListener('change', () => $('split-tension').hidden = !$('separate').checked);
  const changeTension = delta => {
    $('tension').value = Math.max(18, Math.min(35, (Number($('tension').value) || 24) + delta));
    $('mains').value = $('tension').value; $('crosses').value = Math.min(35, Number($('tension').value) + 2);
  };
  $('tension-minus').addEventListener('click', () => changeTension(-1));
  $('tension-plus').addEventListener('click', () => changeTension(1));
  $('tension').addEventListener('input', () => { $('mains').value = $('tension').value; $('crosses').value = Math.min(35, Number($('tension').value) + 2); });
  $('request-form').addEventListener('change', e => {
    if (e.target.name === 'bat-job' && e.target.checked && ['hand', 'machine'].includes(e.target.value)) {
      const other = e.target.value === 'hand' ? 'machine' : 'hand';
      document.querySelector(`input[name=bat-job][value="${other}"]`).checked = false;
    }
    renderSummary(); $('sent').hidden = true;
  });
  $('back').addEventListener('click', () => showStep(Math.max(0, step - 1)));
  let saving = false;
  $('request-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (saving) return;
    if (step < 2) { goForward(step + 1); return; }
    for (let i = 0; i < 2; i++) { const problem = validStage(i); if (problem) { showStep(i); showError(problem); return; } }
    if (!window.PILOT_CONFIG.enabled) { showError(['Bookings are not open yet. Please ask the counter team.', $('next')]); return; }
    const jobs = selectedBatJobs().map(j => j[0]);
    if (Number($('handle').value)) jobs.push($('handle').selectedOptions[0].dataset.key);
    const payload = { sport, name: $('name').value.trim(), phone: normalizedPhone(), shop: shop(),
      marketing_opt_in: $('marketing').checked, gear: $('gear').value.trim(), note: $('notes').value.trim(), src: source, payment: $('payment').value,
      ...(sport === 'badminton' ? { string_key: $('brand').value + '|' + currentString()[0], colour: $('colour').value,
        mains: Number($('separate').checked ? $('mains').value : $('tension').value),
        crosses: Number($('separate').checked ? $('crosses').value : $('tension').value),
        knots: $('knots').checked ? 4 : 2, pre_stretch: $('pre').checked, priority: $('priority').checked,
        advice: $('advice').checked, needed: $('when').value } : { jobs }) };
    saving = true; $('next').disabled = true; $('next').textContent = 'Saving your request…'; $('error').hidden = true;
    try {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
      const fingerprint = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
      let pending = null;
      try { pending = JSON.parse(sessionStorage.getItem('sportline-pending')); } catch {}
      if (!pending || pending.fingerprint !== fingerprint) pending = {fingerprint, key: crypto.randomUUID()};
      sessionStorage.setItem('sportline-pending', JSON.stringify(pending));
      const result = await PilotAPI.rpc('pilot_create_booking', {p_request: payload, p_key: pending.key});
      if (!result?.code || !result?.token) throw new Error('No booking receipt returned. Please retry without changing your details.');
      sessionStorage.removeItem('sportline-pending');
      location.assign('track.html#' + encodeURIComponent(result.token));
    } catch (error) {
      $('error').textContent = error.message + ' Retry with the same details; retries use the same request reference.';
      $('error').hidden = false;
    } finally { saving = false; $('next').disabled = false; $('next').textContent = 'Save my booking request ↗'; }
  });
  // Use the shop's timezone, not the customer's device timezone.
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hour >= 19) {
    $('when').options[0].disabled = true; $('when').selectedIndex = 1;
    $('timing-help').textContent = 'It’s after 7pm in Chennai. Same-day requests are closed; we’ll confirm the next available bench time.';
  }
  renderSport(); showStep(0, false);
  new IntersectionObserver(entries=>document.body.classList.toggle('booking-visible',entries[0].isIntersecting)).observe($('booking'));
  if (!window.PILOT_CONFIG.enabled) { $('setup-note').hidden=false; $('setup-note').textContent='Pilot setup is in progress. You can try the form; saving opens after the shop setup is complete.'; }
})();
