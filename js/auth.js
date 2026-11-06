(() => {
  'use strict';

  const store = window.BPBuddyStore;
  if (!store) return;

  const SESSION_KEY = 'bpbuddy_session_v2';

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  const hashPassword = async (password) => {
    const data = new TextEncoder().encode(password);
    if (window.crypto?.subtle) {
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for (const byte of data) hash = ((hash << 5) - hash + byte) | 0;
    return `fallback-${Math.abs(hash)}`;
  };

  const DEFAULT_ACCOUNTS = [
    {
      id: 'P-0001', role: 'patient', name: 'Juan Dela Cruz',
      email: 'patient@bpbuddy.com', contact: '09171234567', barangay: 'Tanza',
      age: 45, reminderTime: '08:00', password: 'Patient123!',
      staffId: null, healthCenter: null
    },
    {
      id: 'BHW-0001', role: 'bhw', name: 'Maria Santos',
      email: 'bhw@bpbuddy.com', contact: '09179876543', barangay: 'Tanza',
      age: null, reminderTime: null, password: 'BHW12345!',
      staffId: 'BHW-2026-001', healthCenter: 'Barangay Health Center'
    }
  ];

  const ensureDefaultAccounts = async () => {
    const users = store.getUsers();
    let changed = false;
    for (const account of DEFAULT_ACCOUNTS) {
      if (users.some(user => normalizeEmail(user.email) === normalizeEmail(account.email))) continue;
      const {password, ...profile} = account;
      users.push({
        ...profile,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (profile.role === 'patient') {
        store.setReminders(profile.id, {medicationTime: profile.reminderTime});
      }
      changed = true;
    }
    if (changed) store.saveUsers(users);
    return users;
  };

  const nextId = (role) => {
    const prefix = role === 'patient' ? 'P' : 'BHW';
    const users = store.getUsers().filter(user => user.role === role);
    const used = users.map(user => Number(String(user.id).split('-').pop())).filter(Number.isFinite);
    const number = used.length ? Math.max(...used) + 1 : 1;
    return `${prefix}-${String(number).padStart(4, '0')}`;
  };

  const register = async (payload, password) => {
    await ensureDefaultAccounts();
    const users = store.getUsers();
    const email = normalizeEmail(payload.email);
    if (users.some(user => normalizeEmail(user.email) === email)) {
      throw new Error('An account with this email already exists.');
    }
    const user = {
      id: nextId(payload.role),
      role: payload.role,
      name: payload.name.trim(),
      email,
      contact: payload.contact.trim(),
      barangay: payload.barangay.trim(),
      age: payload.role === 'patient' ? Number(payload.age) : null,
      reminderTime: payload.role === 'patient' ? payload.reminderTime || '08:00' : null,
      staffId: payload.role === 'bhw' ? payload.staffId.trim() : null,
      healthCenter: payload.role === 'bhw' ? payload.healthCenter.trim() : null,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(user);
    store.saveUsers(users);
    if (user.role === 'patient') store.setReminders(user.id, {medicationTime: user.reminderTime});
    return user;
  };

  const login = async ({email, password, role, remember}) => {
    await ensureDefaultAccounts();
    const users = store.getUsers();
    const passwordHash = await hashPassword(password);
    const user = users.find(item => normalizeEmail(item.email) === normalizeEmail(email) && item.role === role);
    if (!user || user.passwordHash !== passwordHash) throw new Error('Email, password, or selected role is incorrect.');
    setSession({userId: user.id, role: user.role, signedInAt: new Date().toISOString()}, remember);
    return user;
  };

  const setSession = (session, remember = true) => {
    clearSession();
    const target = remember ? localStorage : sessionStorage;
    target.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const getSession = () => {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  };

  const currentUser = () => {
    const session = getSession();
    if (!session) return null;
    return store.getUser(session.userId);
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  };

  const logout = () => {
    clearSession();
    location.href = 'login.html';
  };

  const requireRole = (role) => {
    const session = getSession();
    const user = session ? store.getUser(session.userId) : null;
    if (!session || !user || user.role !== role) {
      const target = encodeURIComponent(location.pathname.split('/').pop() || `${role}.html`);
      location.replace(`login.html?role=${encodeURIComponent(role)}&next=${target}`);
      return null;
    }
    return user;
  };

  const redirectIfSignedIn = () => {
    const user = currentUser();
    if (!user) return false;
    location.replace(user.role === 'patient' ? 'patient.html' : 'bhw.html');
    return true;
  };

  ensureDefaultAccounts();

  window.BPBuddyAuth = {register, login, setSession, getSession, currentUser, clearSession, logout, requireRole, redirectIfSignedIn, ensureDefaultAccounts};
})();
