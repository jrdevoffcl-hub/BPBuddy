(() => {
  'use strict';
  const auth = window.BPBuddyAuth;
  if (!auth) return;
  if (auth.redirectIfSignedIn()) return;

  const roleInputs = [...document.querySelectorAll('input[name="role"]')];
  const patientFields = document.getElementById('patient-fields');
  const bhwFields = document.getElementById('bhw-fields');
  const params = new URLSearchParams(location.search);
  const requestedRole = params.get('role');
  if (requestedRole === 'patient' || requestedRole === 'bhw') {
    const input = document.querySelector(`input[name="role"][value="${requestedRole}"]`);
    if (input) input.checked = true;
  }

  const updateRoleFields = () => {
    const role = document.querySelector('input[name="role"]:checked')?.value || 'patient';
    patientFields.hidden = role !== 'patient';
    bhwFields.hidden = role !== 'bhw';
    document.getElementById('signup-age').required = role === 'patient';
    document.getElementById('signup-staff-id').required = role === 'bhw';
    document.getElementById('signup-center').required = role === 'bhw';
    document.getElementById('login-link').href = `login.html?role=${encodeURIComponent(role)}`;
  };
  roleInputs.forEach(input => input.addEventListener('change', updateRoleFields));
  updateRoleFields();

  document.getElementById('signup-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('signup-message');
    const submit = event.submitter;
    message.textContent = '';
    message.className = 'form-message';

    const role = document.querySelector('input[name="role"]:checked')?.value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm-password').value;
    if (password.length < 8) {
      message.textContent = 'Password must contain at least 8 characters.';
      message.className = 'form-message error';
      return;
    }
    if (password !== confirm) {
      message.textContent = 'Password and confirmation do not match.';
      message.className = 'form-message error';
      return;
    }
    if (!document.getElementById('signup-terms').checked) {
      message.textContent = 'Please confirm that you understand BPBuddy’s monitoring and follow-up scope.';
      message.className = 'form-message error';
      return;
    }

    const payload = {
      role,
      name: document.getElementById('signup-name').value,
      email: document.getElementById('signup-email').value,
      contact: document.getElementById('signup-contact').value,
      barangay: document.getElementById('signup-barangay').value,
      age: document.getElementById('signup-age').value,
      reminderTime: document.getElementById('signup-reminder').value,
      staffId: document.getElementById('signup-staff-id').value,
      healthCenter: document.getElementById('signup-center').value
    };

    if (role === 'patient' && (!payload.age || Number(payload.age) < 18 || Number(payload.age) > 120)) {
      message.textContent = 'Please enter a valid patient age from 18 to 120.';
      message.className = 'form-message error';
      return;
    }
    if (role === 'bhw' && (!payload.staffId.trim() || !payload.healthCenter.trim())) {
      message.textContent = 'Please complete the BHW / staff ID and health center fields.';
      message.className = 'form-message error';
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Creating account…';
    try {
      const user = await auth.register(payload, password);
      auth.setSession({userId: user.id, role: user.role, signedInAt: new Date().toISOString()}, true);
      message.textContent = 'Account created successfully. Opening your dashboard…';
      message.className = 'form-message success';
      location.href = user.role === 'patient' ? 'patient.html' : 'bhw.html';
    } catch (error) {
      message.textContent = error.message || 'Unable to create account.';
      message.className = 'form-message error';
      submit.disabled = false;
      submit.textContent = 'Create account';
    }
  });
})();
