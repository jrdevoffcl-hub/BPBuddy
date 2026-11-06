(() => {
  'use strict';

  const KEYS = {
    users: 'bpbuddy_users_v2',
    readings: 'bpbuddy_readings_v2',
    queue: 'bpbuddy_sync_queue_v2',
    shared: 'bpbuddy_shared_readings_v2',
    reminders: 'bpbuddy_reminders_v2',
    education: 'bpbuddy_education_v2',
    followups: 'bpbuddy_followups_v2',
    referrals: 'bpbuddy_referrals_v2',
    lastSync: 'bpbuddy_last_sync_v2'
  };

  const parse = (value, fallback) => {
    try { return value ? JSON.parse(value) : fallback; }
    catch { return fallback; }
  };

  const read = (key, fallback = []) => parse(localStorage.getItem(key), fallback);
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const getUsers = () => read(KEYS.users, []);
  const saveUsers = (users) => write(KEYS.users, users);
  const getUser = (userId) => getUsers().find(user => user.id === userId) || null;
  const updateUser = (userId, updates) => {
    const users = getUsers();
    const index = users.findIndex(user => user.id === userId);
    if (index < 0) return null;
    users[index] = {...users[index], ...updates, updatedAt: new Date().toISOString()};
    saveUsers(users);
    return users[index];
  };

  const getPatientUsers = () => getUsers().filter(user => user.role === 'patient');

  const getReadingsFor = (patientId, sharedOnly = false) => {
    const source = read(sharedOnly ? KEYS.shared : KEYS.readings, []);
    return source
      .filter(item => item.patientId === patientId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const addReading = (reading) => {
    const readings = read(KEYS.readings, []);
    readings.unshift(reading);
    write(KEYS.readings, readings);

    const queue = read(KEYS.queue, []);
    if (!queue.includes(reading.id)) queue.unshift(reading.id);
    write(KEYS.queue, queue);
    return reading;
  };

  const getQueueFor = (patientId) => {
    const queuedIds = new Set(read(KEYS.queue, []));
    return read(KEYS.readings, []).filter(item => item.patientId === patientId && queuedIds.has(item.id));
  };

  const syncQueued = (patientId = null) => {
    const queue = read(KEYS.queue, []);
    const readings = read(KEYS.readings, []);
    const shared = read(KEYS.shared, []);
    const sharedIds = new Set(shared.map(item => item.id));
    const remaining = [];
    let added = 0;

    for (const id of queue) {
      const reading = readings.find(item => item.id === id);
      if (!reading) continue;
      if (patientId && reading.patientId !== patientId) {
        remaining.push(id);
        continue;
      }
      if (!sharedIds.has(id)) {
        shared.unshift({...reading, syncedAt: new Date().toISOString()});
        sharedIds.add(id);
        added += 1;
      }
    }

    write(KEYS.shared, shared);
    write(KEYS.queue, remaining);
    if (added > 0) {
      const syncMap = read(KEYS.lastSync, {});
      const targetId = patientId || 'all';
      syncMap[targetId] = new Date().toISOString();
      write(KEYS.lastSync, syncMap);
    }
    return added;
  };

  const getReminders = (patientId) => {
    const all = read(KEYS.reminders, {});
    return all[patientId] || {};
  };

  const setReminders = (patientId, data) => {
    const all = read(KEYS.reminders, {});
    all[patientId] = {...(all[patientId] || {}), ...data};
    write(KEYS.reminders, all);
    return all[patientId];
  };

  const getEducation = (patientId) => {
    const all = read(KEYS.education, {});
    return all[patientId] || {topics: {}, quiz: null};
  };

  const setEducation = (patientId, data) => {
    const all = read(KEYS.education, {});
    all[patientId] = data;
    write(KEYS.education, all);
    return data;
  };

  const getFollowupsForPatient = (patientId) => read(KEYS.followups, [])
    .filter(item => item.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  const addOrUpdateFollowup = ({patientId, bhwId, date, notes}) => {
    const items = read(KEYS.followups, []);
    const existingIndex = items.findIndex(item => item.patientId === patientId && item.status !== 'completed');
    const now = new Date().toISOString();
    const item = existingIndex >= 0
      ? {...items[existingIndex], bhwId, date, notes, updatedAt: now}
      : {id: `F-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, patientId, bhwId, date, notes, status: 'scheduled', createdAt: now};
    if (existingIndex >= 0) items[existingIndex] = item; else items.unshift(item);
    write(KEYS.followups, items);
    setReminders(patientId, {followupDate: date});
    return item;
  };

  const getAllFollowups = () => read(KEYS.followups, []);

  const addReferral = (referral) => {
    const items = read(KEYS.referrals, []);
    const item = {id: `R-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, createdAt: new Date().toISOString(), ...referral};
    items.unshift(item);
    write(KEYS.referrals, items);
    return item;
  };

  const getReferrals = () => read(KEYS.referrals, []);
  const getReferralsForPatient = (patientId) => getReferrals().filter(item => item.patientId === patientId);

  const medicationAdherence = (patientId, sharedOnly = false) => {
    const readings = getReadingsFor(patientId, sharedOnly).filter(item => typeof item.medicationTaken === 'boolean');
    if (!readings.length) return null;
    return Math.round(readings.filter(item => item.medicationTaken).length / readings.length * 100);
  };

  window.BPBuddyStore = {
    KEYS,
    read,
    write,
    getUsers,
    saveUsers,
    getUser,
    updateUser,
    getPatientUsers,
    getReadingsFor,
    addReading,
    getQueueFor,
    syncQueued,
    getReminders,
    setReminders,
    getEducation,
    setEducation,
    getFollowupsForPatient,
    addOrUpdateFollowup,
    getAllFollowups,
    addReferral,
    getReferrals,
    getReferralsForPatient,
    medicationAdherence
  };
})();
