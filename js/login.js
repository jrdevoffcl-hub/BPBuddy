(() => {
  'use strict';
  const auth = window.BPBuddyAuth;
  if (!auth) return;
  if (auth.redirectIfSignedIn()) return;

  const params = new URLSearchParams(location.search);
  const requestedRole = params.get('role');
  if (requestedRole === 'patient' || requestedRole === 'bhw') {
    const input = document.querySelector(`input[name="role"][value="${requestedRole}"]`);
    if (input) input.checked = true;
  }

  const signupLink = document.getElementById('signup-link');
  const updateSignupLink = () => {
    const role = document.querySelector('input[name="role"]:checked')?.value || 'patient';
    signupLink.href = `signup.html?role=${encodeURIComponent(role)}`;
  };
  document.querySelectorAll('input[name="role"]').forEach(input => input.addEventListener('change', updateSignupLink));
  updateSignupLink();

  document.getElementById('login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('login-message');
    const submit = event.submitter;
    message.textContent = '';
    message.className = 'form-message';
    submit.disabled = true;
    submit.textContent = 'Logging in…';
    try {
      const role = document.querySelector('input[name="role"]:checked')?.value;
      const user = await auth.login({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
        role,
        remember: document.getElementById('remember-session').checked
      });
      message.textContent = 'Login successful. Opening your dashboard…';
      message.className = 'form-message success';
      const next = params.get('next');
      const safeNext = next && /^[a-z0-9_-]+\.html$/i.test(next) ? next : null;
      location.href = safeNext || (user.role === 'patient' ? 'patient.html' : 'bhw.html');
    } catch (error) {
      message.textContent = error.message || 'Unable to log in.';
      message.className = 'form-message error';
      submit.disabled = false;
      submit.textContent = 'Log in';
    }
  });
})();
