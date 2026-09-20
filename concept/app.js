(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = n => '₹' + Number(n).toLocaleString('en-IN');
  const catalogue = window.SPORTLINE_CATALOGUE;
  const params = new URLSearchParams(location.search);
  const source = (params.get('src') || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100);
  const sportParam = (params.get('sport') || params.get('svc') || '').toLowerCase();
  let sport = ['cri', 'cricket', 'bat'].includes(sportParam) ? 'cricket' : 'badminton';
  let step = 0;
  let reached = 0;
  const batJobs = [
    ['hand', 'Knocking-in by hand', 500], ['machine', 'Knocking-in by machine', 800],
    ['oil', 'Oiling', 100], ['toe', 'Toe guard', 100], ['scuff', 'Anti-scuff sheet', 150],
    ['fibre', 'Fibre tape', 150], ['weight', 'Weight reducing', null], ['crack', 'Crack binding', null]
  ];
  const shops = {
    '6th': '6th Avenue — 2, R-Block, 6th Ave West, Anna Nagar',
    '5th': '5th Avenue — 265, 5th Ave, Z Block, Anna Nagar'
  };
  if (source) { $('referral').textContent = 'Referred by ' + source; $('referral').hidden = false; }
  if (params.get('shop') === '5th') document.querySelector('input[name=shop][value="5th"]').checked = true;
  function fillSelect(id, options) {
    $(id).replaceChildren(...options.map(([value, text]) => new Option(text, value)));
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
    $('next').replaceChildren(document.createTextNode(['Continue to details', 'Review your request', 'Send request on WhatsApp'][step]));
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
  $('request-form').addEventListener('submit', e => {
    e.preventDefault();
    if (step < 2) { goForward(step + 1); return; }
    for (let i = 0; i < 2; i++) { const problem = validStage(i); if (problem) { showStep(i); showError(problem); return; } }
    const message = ['*Sportline · gear care request*', '', ...reviewRows().map(([k,v]) => k + ': ' + v), '',
      ...lines().map(([name, cost]) => name + ': ' + (cost === null ? 'quote after inspection' : money(cost))), '',
      'Please confirm stock, the final price and when I should drop off my gear.'].join('\n');
    const url = 'https://wa.me/918056436668?text=' + encodeURIComponent(message);
    $('fallback').href = url; $('sent').hidden = false;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  // Use the shop's timezone, not the customer's device timezone.
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hour >= 19) {
    $('when').options[0].disabled = true; $('when').selectedIndex = 1;
    $('timing-help').textContent = 'It’s after 7pm in Chennai. Same-day requests are closed; we’ll confirm the next available bench time.';
  }
  renderSport(); showStep(0, false);
})();
