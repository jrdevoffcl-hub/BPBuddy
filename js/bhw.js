(() => {
  'use strict';
  const store = window.BPBuddyStore;
  const auth = window.BPBuddyAuth;
  if (!store || !auth) return;

  let user = auth.requireRole('bhw');
  if (!user) return;

  let selectedId = null;
  const $ = selector => document.querySelector(selector);
  const firstName = name => String(name || 'BHW').trim().split(/\s+/)[0];
  const formatDate = (value, withTime = false) => value
    ? new Intl.DateTimeFormat('en-PH', withTime ? {dateStyle: 'medium', timeStyle: 'short'} : {dateStyle: 'medium'}).format(new Date(value))
    : '—';

  const daysFromToday = dateString => {
    if (!dateString) return 9999;
    const date = new Date(`${dateString}T00:00:00`);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((date - today) / 86400000);
  };

  const patients = () => store.getPatientUsers();
  const patientReadings = patientId => store.getReadingsFor(patientId, true);
  const latestReading = patientId => patientReadings(patientId)[0] || null;
  const adherence = patientId => store.medicationAdherence(patientId, true);
  const followupDate = patientId => store.getReminders(patientId).followupDate || '';

  const isFlagged = patient => {
    const reading = latestReading(patient.id);
    const med = adherence(patient.id);
    return Boolean(reading && (reading.systolic >= 140 || reading.diastolic >= 90)) || (med !== null && med < 70);
  };

  const statusFor = patient => {
    const reading = latestReading(patient.id);
    const days = daysFromToday(followupDate(patient.id));
    if (reading && (reading.systolic >= 180 || reading.diastolic >= 120)) return {label: 'Urgent review', cls: 'flagged'};
    if (isFlagged(patient)) return {label: 'Flagged', cls: 'flagged'};
    if (days <= 7) return {label: days < 0 ? 'Follow-up overdue' : 'Follow-up due', cls: 'watch'};
    if (!reading) return {label: 'No synced reading', cls: 'neutral'};
    return {label: 'Monitoring', cls: 'stable'};
  };

  const priorityScore = patient => {
    const reading = latestReading(patient.id);
    const med = adherence(patient.id);
    const days = daysFromToday(followupDate(patient.id));
    return (reading && (reading.systolic >= 180 || reading.diastolic >= 120) ? 200 : 0)
      + (isFlagged(patient) ? 100 : 0)
      + (days < 0 ? 60 : days <= 7 ? 30 : 0)
      + (med !== null ? Math.max(0, 70 - med) : 0);
  };

  const renderIdentity = () => {
    $('#header-user-name').textContent = user.name;
    $('#header-avatar').textContent = firstName(user.name).charAt(0).toUpperCase();
    $('#profile-avatar').textContent = firstName(user.name).charAt(0).toUpperCase();
    $('#profile-display-name').textContent = user.name;
    $('#profile-display-location').textContent = user.healthCenter || user.barangay || '—';
    $('#profile-name').value = user.name || '';
    $('#profile-email').value = user.email || '';
    $('#profile-contact').value = user.contact || '';
    $('#profile-barangay').value = user.barangay || '';
    $('#profile-staff-id').value = user.staffId || '';
    $('#profile-center').value = user.healthCenter || '';
  };

  const renderMetrics = () => {
    const list = patients();
    $('#bhw-total').textContent = String(list.length);
    $('#bhw-flagged').textContent = String(list.filter(isFlagged).length);
    $('#bhw-due').textContent = String(list.filter(patient => daysFromToday(followupDate(patient.id)) <= 7).length);
    const today = new Date().toDateString();
    const syncedToday = store.read(store.KEYS.shared, []).filter(item => item.syncedAt && new Date(item.syncedAt).toDateString() === today).length;
    $('#bhw-synced').textContent = String(syncedToday);
  };

  const renderPriorityPatients = () => {
    const target = $('#priority-patients');
    const list = patients().map(patient => ({patient, score: priorityScore(patient)})).filter(item => item.score > 0).sort((a,b) => b.score - a.score).slice(0,5);
    if (!list.length) {
      target.innerHTML = '<div class="empty-compact"><strong>No priority records right now.</strong><span>Flagged readings and due follow-ups will appear here.</span></div>';
      return;
    }
    target.innerHTML = list.map(({patient}) => {
      const reading = latestReading(patient.id);
      const status = statusFor(patient);
      return `<button class="priority-item open-patient" type="button" data-patient-id="${patient.id}">
        <span class="avatar">${firstName(patient.name).charAt(0).toUpperCase()}</span>
        <span class="priority-copy"><strong>${patient.name}</strong><small>${patient.barangay} • ${reading ? `${reading.systolic}/${reading.diastolic} mmHg` : 'No synced BP'}</small></span>
        <span class="status-dot ${status.cls}">${status.label}</span>
      </button>`;
    }).join('');
    bindPatientOpenButtons(target);
  };

  const renderUpcoming = () => {
    const target = $('#upcoming-followups');
    const list = patients().map(patient => ({patient, date: followupDate(patient.id), days: daysFromToday(followupDate(patient.id))}))
      .filter(item => item.date && item.days >= -30)
      .sort((a,b) => a.days - b.days)
      .slice(0,5);
    if (!list.length) {
      target.innerHTML = '<div class="empty-compact"><strong>No follow-ups scheduled.</strong><span>Save a date from a patient record to add it here.</span></div>';
      return;
    }
    target.innerHTML = list.map(item => `<button class="timeline-item open-patient" type="button" data-patient-id="${item.patient.id}">
      <span class="timeline-date"><strong>${new Date(`${item.date}T00:00:00`).getDate()}</strong><small>${new Intl.DateTimeFormat('en-PH',{month:'short'}).format(new Date(`${item.date}T00:00:00`))}</small></span>
      <span><strong>${item.patient.name}</strong><small>${item.days < 0 ? `${Math.abs(item.days)} day(s) overdue` : item.days === 0 ? 'Due today' : `In ${item.days} day(s)`}</small></span>
    </button>`).join('');
    bindPatientOpenButtons(target);
  };

  const bindPatientOpenButtons = root => {
    root.querySelectorAll('.open-patient, .view-patient').forEach(button => button.addEventListener('click', () => selectPatient(button.dataset.patientId)));
  };

  const renderPatientTable = () => {
    const query = $('#patient-search').value.trim().toLowerCase();
    const filter = $('#status-filter').value;
    const sort = $('#sort-filter').value;
    let list = patients().filter(patient => `${patient.name} ${patient.id} ${patient.barangay}`.toLowerCase().includes(query));
    if (filter === 'flagged') list = list.filter(isFlagged);
    if (filter === 'due') list = list.filter(patient => daysFromToday(followupDate(patient.id)) <= 7);
    if (filter === 'low-adherence') list = list.filter(patient => adherence(patient.id) !== null && adherence(patient.id) < 70);

    list.sort((a,b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'recent') return new Date(latestReading(b.id)?.date || 0) - new Date(latestReading(a.id)?.date || 0);
      if (sort === 'followup') return daysFromToday(followupDate(a.id)) - daysFromToday(followupDate(b.id));
      return priorityScore(b) - priorityScore(a);
    });

    const body = $('#patient-table-body');
    body.innerHTML = list.map(patient => {
      const reading = latestReading(patient.id);
      const med = adherence(patient.id);
      const followup = followupDate(patient.id);
      const days = daysFromToday(followup);
      const status = statusFor(patient);
      return `<tr>
        <td><div class="table-person"><span class="avatar">${firstName(patient.name).charAt(0).toUpperCase()}</span><span><strong>${patient.name}</strong><small>${patient.id} • ${patient.barangay}</small></span></div></td>
        <td>${reading ? `<strong>${reading.systolic}/${reading.diastolic}</strong><br><small>${reading.category}</small>` : '<span class="muted">No synced reading</span>'}</td>
        <td>${med === null ? '—' : `${med}%`}</td>
        <td>${reading ? formatDate(reading.date, true) : '—'}</td>
        <td>${followup ? `${formatDate(followup)}<br><small>${days < 0 ? `${Math.abs(days)} day(s) overdue` : days === 0 ? 'Today' : `${days} day(s)`}</small>` : 'Not scheduled'}</td>
        <td><span class="status-dot ${status.cls}">${status.label}</span></td>
        <td><button class="button button-sm button-secondary view-patient" data-patient-id="${patient.id}" type="button">View</button></td>
      </tr>`;
    }).join('');
    $('#empty-patient-state').hidden = list.length !== 0;
    bindPatientOpenButtons(body);
  };

  const renderReferralSummary = patient => {
    const reading = latestReading(patient.id);
    const med = adherence(patient.id);
    const referrals = store.getReferralsForPatient(patient.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latestReferral = referrals[0];
    $('#referral-summary').innerHTML = `<section class="referral-sheet">
      <div class="referral-sheet-header"><div><strong>BPBuddy</strong><span>Patient monitoring and referral summary</span></div><span>${formatDate(new Date().toISOString())}</span></div>
      <dl>
        <dt>Patient</dt><dd>${patient.name} (${patient.id})</dd>
        <dt>Community</dt><dd>${patient.barangay || '—'}</dd>
        <dt>Age / contact</dt><dd>${patient.age || '—'} • ${patient.contact || '—'}</dd>
        <dt>Latest synchronized BP</dt><dd>${reading ? `${reading.systolic}/${reading.diastolic} mmHg — ${reading.category}` : 'No synchronized reading available'}</dd>
        <dt>Medication record</dt><dd>${med === null ? 'No synchronized intake entries' : `${med}% based on synchronized records`}</dd>
        <dt>Next follow-up</dt><dd>${followupDate(patient.id) ? formatDate(followupDate(patient.id)) : 'Not scheduled'}</dd>
        <dt>Latest referral</dt><dd>${latestReferral ? `${latestReferral.destination} — ${latestReferral.reason} (${formatDate(latestReferral.createdAt)})` : 'No referral recorded'}</dd>
      </dl>
      <p class="referral-disclaimer">This BPBuddy summary organizes recorded information and is not an official diagnosis, prescription, or substitute for a clinical record.</p>
    </section>`;
  };

  const selectPatient = patientId => {
    const patient = patients().find(item => item.id === patientId);
    if (!patient) return;
    selectedId = patientId;
    $('#patient-detail').hidden = false;
    $('#detail-title').textContent = patient.name;
    const med = adherence(patient.id);
    $('#patient-summary-list').innerHTML = `<dt>Patient ID</dt><dd>${patient.id}</dd><dt>Age</dt><dd>${patient.age || '—'}</dd><dt>Barangay</dt><dd>${patient.barangay || '—'}</dd><dt>Contact</dt><dd>${patient.contact || '—'}</dd><dt>Medication record</dt><dd>${med === null ? 'No synchronized entries' : `${med}%`}</dd><dt>Next follow-up</dt><dd>${followupDate(patient.id) ? formatDate(followupDate(patient.id)) : 'Not scheduled'}</dd>`;

    const readings = patientReadings(patient.id);
    $('#patient-reading-body').innerHTML = readings.slice(0, 8).map(item => `<tr><td>${formatDate(item.date, true)}</td><td><strong>${item.systolic}/${item.diastolic}</strong></td><td>${item.category}</td><td>${item.medicationTaken ? 'Taken' : 'Not recorded / missed'}</td></tr>`).join('') || '<tr><td colspan="4">No synchronized readings.</td></tr>';

    const reminder = store.getReminders(patient.id);
    $('#bhw-followup-date').value = reminder.followupDate || '';
    const latestFollowup = store.getFollowupsForPatient(patient.id)[0];
    $('#bhw-followup-notes').value = latestFollowup?.notes || '';
    $('#followup-save-message').textContent = '';
    $('#referral-save-message').textContent = '';
    renderReferralSummary(patient);
    $('#patient-detail').scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  const renderFollowupBoard = () => {
    const target = $('#followup-board');
    const list = patients().map(patient => ({patient, date: followupDate(patient.id), days: daysFromToday(followupDate(patient.id))})).filter(item => item.date).sort((a,b) => a.days - b.days);
    if (!list.length) {
      target.innerHTML = '<article class="card empty-state"><strong>No follow-ups scheduled.</strong><p>Open a patient record and save a follow-up date to begin organizing the schedule.</p></article>';
      return;
    }
    target.innerHTML = list.map(item => {
      const group = item.days < 0 ? 'overdue' : item.days <= 7 ? 'soon' : 'later';
      return `<article class="followup-card card ${group}">
        <div class="followup-date-block"><strong>${new Date(`${item.date}T00:00:00`).getDate()}</strong><span>${new Intl.DateTimeFormat('en-PH',{month:'short',year:'numeric'}).format(new Date(`${item.date}T00:00:00`))}</span></div>
        <div><span class="status-dot ${item.days < 0 ? 'flagged' : item.days <= 7 ? 'watch' : 'stable'}">${item.days < 0 ? 'Overdue' : item.days === 0 ? 'Today' : item.days <= 7 ? 'Due soon' : 'Scheduled'}</span><h3>${item.patient.name}</h3><p>${item.patient.barangay} • ${item.patient.id}</p><small>${item.days < 0 ? `${Math.abs(item.days)} day(s) overdue` : item.days === 0 ? 'Due today' : `In ${item.days} day(s)`}</small></div>
        <button class="button button-sm button-secondary open-patient" data-patient-id="${item.patient.id}" type="button">Open record</button>
      </article>`;
    }).join('');
    bindPatientOpenButtons(target);
  };

  const renderReferrals = () => {
    const refs = store.getReferrals().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const body = $('#referral-table-body');
    body.innerHTML = refs.map(referral => {
      const patient = store.getUser(referral.patientId);
      const bhw = store.getUser(referral.bhwId);
      return `<tr><td>${formatDate(referral.createdAt, true)}</td><td><strong>${patient?.name || referral.patientId}</strong><br><small>${referral.patientId}</small></td><td>${referral.destination}</td><td>${referral.reason}</td><td>${bhw?.name || referral.bhwId || '—'}</td></tr>`;
    }).join('');
    $('#empty-referral-state').hidden = refs.length !== 0;
  };

  const refreshAll = () => {
    user = store.getUser(user.id) || user;
    renderIdentity();
    renderMetrics();
    renderPriorityPatients();
    renderUpcoming();
    renderPatientTable();
    renderFollowupBoard();
    renderReferrals();
    if (selectedId) {
      const stillExists = patients().some(patient => patient.id === selectedId);
      if (stillExists) selectPatient(selectedId); else { selectedId = null; $('#patient-detail').hidden = true; }
    }
  };

  $('#patient-search')?.addEventListener('input', renderPatientTable);
  $('#status-filter')?.addEventListener('change', renderPatientTable);
  $('#sort-filter')?.addEventListener('change', renderPatientTable);
  $('#close-detail')?.addEventListener('click', () => { $('#patient-detail').hidden = true; selectedId = null; });

  $('#followup-form')?.addEventListener('submit', event => {
    event.preventDefault();
    if (!selectedId) return;
    const date = $('#bhw-followup-date').value;
    if (!date) return;
    store.addOrUpdateFollowup({patientId: selectedId, bhwId: user.id, date, notes: $('#bhw-followup-notes').value.trim()});
    $('#followup-save-message').textContent = 'Follow-up schedule saved.';
    $('#followup-save-message').className = 'form-message success';
    refreshAll();
  });

  $('#referral-form')?.addEventListener('submit', event => {
    event.preventDefault();
    if (!selectedId) return;
    const reason = $('#referral-reason').value.trim();
    if (!reason) return;
    store.addReferral({patientId: selectedId, bhwId: user.id, destination: $('#referral-destination').value, reason});
    $('#referral-save-message').textContent = 'Referral recorded successfully.';
    $('#referral-save-message').className = 'form-message success';
    event.target.reset();
    renderReferrals();
    const patient = patients().find(item => item.id === selectedId);
    if (patient) renderReferralSummary(patient);
  });

  $('#print-referral')?.addEventListener('click', () => window.print());

  $('#bhw-profile-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const updates = {
      name: $('#profile-name').value.trim(),
      contact: $('#profile-contact').value.trim(),
      barangay: $('#profile-barangay').value.trim(),
      staffId: $('#profile-staff-id').value.trim(),
      healthCenter: $('#profile-center').value.trim()
    };
    const message = $('#profile-message');
    if (Object.values(updates).some(value => !value)) {
      message.textContent = 'Please complete all BHW profile fields.';
      message.className = 'form-message error';
      return;
    }
    user = store.updateUser(user.id, updates);
    message.textContent = 'Profile changes saved.';
    message.className = 'form-message success';
    refreshAll();
  });

  refreshAll();
})();
