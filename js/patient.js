(() => {
  'use strict';
  const store = window.BPBuddyStore;
  const auth = window.BPBuddyAuth;
  if (!store || !auth) return;

  let user = auth.requireRole('patient');
  if (!user) return;

  let overviewChart = null;
  let historyChart = null;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const firstName = name => String(name || 'Patient').trim().split(/\s+/)[0];
  const formatDate = (value, withTime = true) => value
    ? new Intl.DateTimeFormat('en-PH', withTime ? {dateStyle: 'medium', timeStyle: 'short'} : {dateStyle: 'medium'}).format(new Date(value))
    : '—';

  const classifyBP = (systolic, diastolic) => {
    if (systolic >= 180 || diastolic >= 120) return {label: 'Very high / urgent review', tone: 'danger'};
    if (systolic >= 140 || diastolic >= 90) return {label: 'Stage 2', tone: 'danger'};
    if (systolic >= 130 || diastolic >= 80) return {label: 'Stage 1', tone: 'warning'};
    if (systolic >= 120 && diastolic < 80) return {label: 'Elevated', tone: 'warning'};
    return {label: 'Normal range', tone: 'success'};
  };

  const latestReading = readings => readings[0] || null;
  const ownReadings = () => store.getReadingsFor(user.id);

  const chartData = (readings, range) => {
    const sorted = [...readings].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (range === 'all') return sorted;
    return sorted.slice(-Number(range || 12));
  };

  const renderFallbackChart = (svg, canvas, readings) => {
    if (!svg || !canvas) return;
    svg.hidden = false;
    canvas.hidden = true;
    const data = [...readings].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-12);
    if (!data.length) {
      svg.innerHTML = '<text x="350" y="130" text-anchor="middle" fill="#697386" font-size="16">Add readings to display a trend</text>';
      return;
    }
    const width = 700, height = 260, pad = 44, min = 50, max = 200;
    const x = index => pad + (data.length === 1 ? (width - 2 * pad) / 2 : index * (width - 2 * pad) / (data.length - 1));
    const y = value => height - pad - (value - min) * (height - 2 * pad) / (max - min);
    const grid = [60, 100, 140, 180].map(value => `<line x1="${pad}" x2="${width-pad}" y1="${y(value)}" y2="${y(value)}" stroke="#e9edf2"/><text x="5" y="${y(value)+5}" fill="#697386" font-size="12">${value}</text>`).join('');
    const line = (key, color) => `<polyline fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${data.map((item, index) => `${x(index)},${y(item[key])}`).join(' ')}"/>`;
    const points = data.map((item, index) => `<circle cx="${x(index)}" cy="${y(item.systolic)}" r="4" fill="#a81828"/><circle cx="${x(index)}" cy="${y(item.diastolic)}" r="4" fill="#e55b67"/>`).join('');
    svg.innerHTML = `${grid}${line('systolic', '#a81828')}${line('diastolic', '#e55b67')}${points}<text x="500" y="22" fill="#a81828" font-size="12">Systolic</text><text x="590" y="22" fill="#e55b67" font-size="12">Diastolic</text>`;
  };

  const buildChart = (canvas, fallback, readings, chartRefName) => {
    if (!canvas) return;
    const data = readings;
    if (window.Chart) {
      canvas.hidden = false;
      if (fallback) fallback.hidden = true;
      if (chartRefName === 'overview' && overviewChart) overviewChart.destroy();
      if (chartRefName === 'history' && historyChart) historyChart.destroy();
      const chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: data.map(item => new Intl.DateTimeFormat('en-PH', {month: 'short', day: 'numeric'}).format(new Date(item.date))),
          datasets: [
            {label: 'Systolic', data: data.map(item => item.systolic), borderColor: '#a81828', backgroundColor: 'rgba(168,24,40,.08)', pointBackgroundColor: '#a81828', tension: .28, borderWidth: 3},
            {label: 'Diastolic', data: data.map(item => item.diastolic), borderColor: '#e55b67', backgroundColor: 'rgba(229,91,103,.08)', pointBackgroundColor: '#e55b67', tension: .28, borderWidth: 3}
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {mode: 'index', intersect: false},
          plugins: {legend: {position: 'bottom', labels: {usePointStyle: true, boxWidth: 8}}},
          scales: {x: {grid: {display: false}}, y: {suggestedMin: 50, suggestedMax: 190, ticks: {stepSize: 20}}}
        }
      });
      if (chartRefName === 'overview') overviewChart = chart; else historyChart = chart;
    } else {
      renderFallbackChart(fallback, canvas, data);
    }
  };

  const renderIdentity = () => {
    $('#patient-first-name').textContent = firstName(user.name);
    $('#header-user-name').textContent = user.name;
    $('#header-avatar').textContent = firstName(user.name).charAt(0).toUpperCase();
    $('#profile-avatar').textContent = firstName(user.name).charAt(0).toUpperCase();
    $('#profile-display-name').textContent = user.name;
    $('#profile-display-location').textContent = user.barangay || '—';
    $('#profile-name').value = user.name || '';
    $('#profile-email').value = user.email || '';
    $('#profile-contact').value = user.contact || '';
    $('#profile-barangay').value = user.barangay || '';
    $('#profile-age').value = user.age || '';
    $('#profile-id').value = user.id || '';
  };

  const renderSummary = () => {
    const readings = ownReadings();
    const latest = latestReading(readings);
    $('#metric-latest-bp').textContent = latest ? `${latest.systolic}/${latest.diastolic}` : '—';
    $('#metric-latest-category').textContent = latest ? latest.category : 'No reading yet';

    const sevenDaysAgo = Date.now() - 7 * 86400000;
    $('#metric-week-logs').textContent = String(readings.filter(item => new Date(item.date).getTime() >= sevenDaysAgo).length);
    const adherence = store.medicationAdherence(user.id, false);
    $('#metric-adherence').textContent = adherence === null ? '—' : `${adherence}%`;

    const reminders = store.getReminders(user.id);
    if (reminders.followupDate) {
      const followup = new Date(`${reminders.followupDate}T00:00:00`);
      const today = new Date(); today.setHours(0,0,0,0);
      const days = Math.ceil((followup - today) / 86400000);
      $('#metric-followup').textContent = new Intl.DateTimeFormat('en-PH', {month: 'short', day: 'numeric'}).format(followup);
      $('#metric-followup-note').textContent = days < 0 ? `${Math.abs(days)} day(s) overdue` : days === 0 ? 'Today' : `${days} day(s) away`;
    } else {
      $('#metric-followup').textContent = '—';
      $('#metric-followup-note').textContent = 'No appointment scheduled';
    }

    const alert = $('#latest-alert');
    if (latest && (latest.systolic >= 140 || latest.diastolic >= 90)) {
      alert.hidden = false;
      const veryHigh = latest.systolic >= 180 || latest.diastolic >= 120;
      alert.className = veryHigh ? 'alert-box danger' : 'alert-box warning';
      alert.innerHTML = veryHigh
        ? '<strong>Very high reading recorded.</strong><span> Recheck your measurement correctly and follow the action plan given by your health professional. Seek appropriate medical care for severe symptoms or urgent concerns.</span>'
        : '<strong>This reading needs attention.</strong><span> Continue monitoring and bring repeated high readings to your health worker or clinician.</span>';
    } else {
      alert.hidden = true;
    }

    const recent = chartData(readings, 8);
    buildChart($('#overview-chart'), $('#overview-chart-fallback'), recent, 'overview');
    renderTasks(readings);
  };

  const renderTasks = readings => {
    const todayString = new Date().toDateString();
    const todayReading = readings.find(item => new Date(item.date).toDateString() === todayString);
    const readingState = $('#task-reading-state');
    readingState.textContent = todayReading ? '✓' : '○';
    readingState.classList.toggle('complete', Boolean(todayReading));
    $('#task-reading-text').textContent = todayReading ? `Recorded ${todayReading.systolic}/${todayReading.diastolic} today.` : 'No reading recorded today.';

    const reminders = store.getReminders(user.id);
    const medState = $('#task-med-state');
    if (reminders.medicationTime) {
      medState.textContent = '✓'; medState.classList.add('complete');
      $('#task-med-text').textContent = `Reminder set for ${reminders.medicationTime}.`;
    } else {
      medState.textContent = '○'; medState.classList.remove('complete');
      $('#task-med-text').textContent = 'Set a daily reminder below.';
    }

    const queued = store.getQueueFor(user.id);
    const syncState = $('#task-sync-state');
    syncState.textContent = queued.length ? '!' : '✓';
    syncState.classList.toggle('complete', queued.length === 0);
    $('#task-sync-text').textContent = queued.length ? `${queued.length} record${queued.length === 1 ? '' : 's'} waiting to synchronize.` : 'No pending records.';
  };

  const renderHistory = () => {
    const readings = ownReadings();
    const range = $('#history-range')?.value || '12';
    buildChart($('#bp-chart'), $('#bp-chart-fallback'), chartData(readings, range), 'history');
    const body = $('#reading-table-body');
    body.innerHTML = readings.map(item => `<tr>
      <td>${formatDate(item.date)}</td>
      <td><strong>${item.systolic}/${item.diastolic}</strong> mmHg</td>
      <td><span class="table-status">${item.category}</span></td>
      <td>${item.medicationTaken ? 'Taken' : 'Not recorded / missed'}</td>
      <td>${item.symptoms === 'none' ? 'None reported' : item.symptoms.replaceAll('-', ' ')}</td>
      <td>${item.activityMinutes || 0} min</td>
    </tr>`).join('') || '<tr><td colspan="6">No readings recorded yet.</td></tr>';
  };

  const renderSyncAndReminders = () => {
    const queue = store.getQueueFor(user.id);
    $('#queue-badge').textContent = `${queue.length} pending`;
    $('#queue-message').textContent = queue.length
      ? `${queue.length} record${queue.length === 1 ? '' : 's'} saved locally and waiting to synchronize.`
      : 'All saved records are synchronized.';
    $('#sync-button').disabled = queue.length === 0 || !navigator.onLine;

    const lastSync = store.read(store.KEYS.lastSync, {})[user.id];
    $('#last-sync-text').textContent = lastSync ? `Last synchronized ${formatDate(lastSync)}.` : 'No recent synchronization.';

    const reminders = store.getReminders(user.id);
    if (reminders.medicationTime) $('#med-reminder-time').value = reminders.medicationTime;
    $('#med-reminder-text').textContent = reminders.medicationTime ? `Daily reminder saved for ${reminders.medicationTime}.` : 'No medication reminder saved.';
    if (reminders.followupDate) $('#followup-date').value = reminders.followupDate;
    if (reminders.followupDate) {
      const date = new Date(`${reminders.followupDate}T00:00:00`);
      const today = new Date(); today.setHours(0,0,0,0);
      const days = Math.ceil((date - today) / 86400000);
      $('#followup-reminder-text').textContent = days < 0 ? `Follow-up was ${Math.abs(days)} day(s) ago.` : days === 0 ? 'Follow-up is today.' : `Follow-up is in ${days} day(s).`;
    } else {
      $('#followup-reminder-text').textContent = 'No follow-up date saved.';
    }
  };

  const renderEducation = () => {
    const progress = store.getEducation(user.id);
    $$('.education-card').forEach(card => {
      const checkbox = card.querySelector('.topic-complete');
      if (checkbox) checkbox.checked = Boolean(progress.topics?.[card.dataset.topic]);
    });
    const count = Object.values(progress.topics || {}).filter(Boolean).length;
    $('#education-progress').textContent = `${count}/4 topics completed`;
  };

  const refreshAll = () => {
    user = store.getUser(user.id) || user;
    renderIdentity();
    renderSummary();
    renderHistory();
    renderSyncAndReminders();
    renderEducation();
  };

  $('#bp-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const message = $('#form-message');
    const systolic = Number($('#systolic').value);
    const diastolic = Number($('#diastolic').value);
    const dateValue = $('#reading-date').value;

    if (!dateValue || !Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
      message.textContent = 'Please enter date/time, systolic, and diastolic values.';
      message.className = 'form-message error';
      return;
    }
    if (systolic < 60 || systolic > 260 || diastolic < 30 || diastolic > 160 || systolic <= diastolic) {
      message.textContent = 'Please check the BP values. Systolic must be higher than diastolic and both values must be within the accepted form limits.';
      message.className = 'form-message error';
      return;
    }

    const category = classifyBP(systolic, diastolic);
    const reading = {
      id: `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      patientId: user.id,
      patientName: user.name,
      barangay: user.barangay,
      date: new Date(dateValue).toISOString(),
      systolic,
      diastolic,
      medicationTaken: $('#medication-taken').checked,
      symptoms: $('#symptoms').value,
      weight: $('#weight').value ? Number($('#weight').value) : null,
      activityMinutes: Number($('#activity-minutes').value || 0),
      saltLevel: $('#salt-level').value,
      notes: $('#notes').value.trim(),
      category: category.label,
      createdAt: new Date().toISOString()
    };

    store.addReading(reading);
    let syncText = 'Saved locally and added to the synchronization queue.';
    if (navigator.onLine) {
      const synced = store.syncQueued(user.id);
      if (synced) syncText = 'Saved and synchronized successfully.';
    }
    message.textContent = `${category.label}. ${syncText}`;
    message.className = 'form-message success';
    event.target.reset();
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    $('#reading-date').value = now.toISOString().slice(0, 16);
    refreshAll();
  });

  $('#history-range')?.addEventListener('change', renderHistory);

  $('#clear-readings')?.addEventListener('click', () => {
    if (!confirm('Clear all BPBuddy readings linked to your patient account on this browser?')) return;
    const allReadings = store.read(store.KEYS.readings, []).filter(item => item.patientId !== user.id);
    const allShared = store.read(store.KEYS.shared, []).filter(item => item.patientId !== user.id);
    const currentIds = new Set(store.read(store.KEYS.readings, []).filter(item => item.patientId === user.id).map(item => item.id));
    const queue = store.read(store.KEYS.queue, []).filter(id => !currentIds.has(id));
    store.write(store.KEYS.readings, allReadings);
    store.write(store.KEYS.shared, allShared);
    store.write(store.KEYS.queue, queue);
    refreshAll();
  });

  $('#sync-button')?.addEventListener('click', () => {
    if (!navigator.onLine) return;
    const count = store.syncQueued(user.id);
    $('#queue-message').textContent = count ? `${count} record${count === 1 ? '' : 's'} synchronized successfully.` : 'All saved records are already synchronized.';
    refreshAll();
  });

  $('#save-med-reminder')?.addEventListener('click', () => {
    store.setReminders(user.id, {medicationTime: $('#med-reminder-time').value});
    renderSyncAndReminders(); renderSummary();
  });

  $('#save-followup')?.addEventListener('click', () => {
    store.setReminders(user.id, {followupDate: $('#followup-date').value});
    renderSyncAndReminders(); renderSummary();
  });

  $$('.topic-toggle').forEach(button => button.addEventListener('click', () => {
    const details = button.nextElementSibling;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    details.hidden = expanded;
    button.textContent = expanded ? 'Show key points' : 'Hide key points';
  }));

  $$('.topic-complete').forEach(checkbox => checkbox.addEventListener('change', () => {
    const topic = checkbox.closest('.education-card').dataset.topic;
    const progress = store.getEducation(user.id);
    progress.topics ||= {};
    progress.topics[topic] = checkbox.checked;
    store.setEducation(user.id, progress);
    renderEducation();
  }));

  $('#education-quiz')?.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const score = (formData.get('q1') === 'b' ? 1 : 0) + (formData.get('q2') === 'a' ? 1 : 0);
    const result = $('#quiz-result');
    result.textContent = `Score: ${score}/2. ${score === 2 ? 'Correct — you understood BPBuddy’s role and offline-first workflow.' : 'Review the learning topics and try again.'}`;
    result.className = `form-message ${score === 2 ? 'success' : 'error'}`;
    const progress = store.getEducation(user.id);
    progress.quiz = {score, date: new Date().toISOString()};
    store.setEducation(user.id, progress);
  });

  $('#patient-profile-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#profile-name').value.trim();
    const contact = $('#profile-contact').value.trim();
    const barangay = $('#profile-barangay').value.trim();
    const age = Number($('#profile-age').value);
    const message = $('#profile-message');
    if (!name || !contact || !barangay || !Number.isFinite(age) || age < 18 || age > 120) {
      message.textContent = 'Please complete all patient profile fields with valid values.';
      message.className = 'form-message error';
      return;
    }
    user = store.updateUser(user.id, {name, contact, barangay, age});
    const readings = store.read(store.KEYS.readings, []).map(item => item.patientId === user.id ? {...item, patientName: name, barangay} : item);
    const shared = store.read(store.KEYS.shared, []).map(item => item.patientId === user.id ? {...item, patientName: name, barangay} : item);
    store.write(store.KEYS.readings, readings);
    store.write(store.KEYS.shared, shared);
    message.textContent = 'Profile changes saved.';
    message.className = 'form-message success';
    refreshAll();
  });

  window.addEventListener('online', () => {
    store.syncQueued(user.id);
    refreshAll();
  });
  window.addEventListener('offline', renderSyncAndReminders);

  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $('#reading-date').value = now.toISOString().slice(0, 16);
  refreshAll();
})();
