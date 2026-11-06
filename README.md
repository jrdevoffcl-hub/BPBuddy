# BPBuddy — Full Frontend Website

BPBuddy is a web-based hypertension self-management and community follow-up application for Filipino patients and barangay health workers (BHWs). This build follows the frontend-focused scope of the Web Systems and Technologies 1 project documentation.

## Included pages

- `index.html` — complete public landing page with hypertension information, project evidence, four core features, workflow, role explanations, FAQ, and account calls-to-action.
- `login.html` — role-aware login for patients and BHWs.
- `signup.html` — role-aware account registration with patient- and BHW-specific fields.
- `patient.html` — authenticated patient workspace.
- `bhw.html` — authenticated BHW workspace.

## Four core feature groups

1. **Patient health tracker**
   - Blood pressure entry with validation
   - Monitoring category labels
   - Medication intake, symptoms, weight, activity, salt-level, and notes
   - Reading history and trend charts

2. **BHW dashboard, follow-up, search/filtering, and referrals**
   - Registered patient list
   - Search, filtering, sorting, and priority status
   - Synchronized patient monitoring history
   - Follow-up scheduling and BHW notes
   - Referral recording and printable referral summary

3. **Offline-first local records and reminders**
   - Browser-first patient record storage
   - Pending synchronization queue
   - Automatic synchronization when connectivity returns
   - Medication reminder time
   - Follow-up reminder date
   - Service-worker application-shell caching

4. **Hypertension education and self-care**
   - Four educational topics
   - Expandable key points
   - Locally saved topic completion
   - Knowledge check with saved result

## Account behavior

Accounts are separated by role. Registration creates either a Patient ID (`P-0001`, `P-0002`, etc.) or BHW ID (`BHW-0001`, etc.). Passwords are hashed in the browser before storage. Signed-in sessions are role-guarded so a patient session cannot open the BHW workspace and vice versa.

Because the approved course scope is frontend-focused, this implementation stores account and health information in the browser instead of claiming production server authentication. It should not be used with real confidential health information.

## Patient ↔ BHW workflow

1. A patient creates an account and records BP/self-management information.
2. The record is saved locally first.
3. When online, queued records synchronize into the shared browser data store.
4. A BHW account can then review that synchronized information.
5. A BHW can schedule a follow-up; that date appears in the matching patient's dashboard and reminders.
6. Referrals can be recorded and printed as a structured monitoring summary.

## Run locally

Use a local web server so the service worker and browser APIs operate correctly.

### Python

```bash
cd BPBuddy-System-Full
python -m http.server 8000
```

Open:

`http://localhost:8000`

### XAMPP

You may also place the `BPBuddy-System-Full` folder inside XAMPP's `htdocs` folder and open it through `http://localhost/BPBuddy-System-Full/`.

PHP and MySQL are not required for this build.

## Suggested evaluation flow

1. Open the landing page and review the hypertension and feature sections.
2. Create a patient account.
3. Add a BP reading and review the patient dashboard/history.
4. Log out.
5. Create a BHW account.
6. Open the patient list and review the synchronized patient record.
7. Schedule a follow-up and record a referral.
8. Log out and sign back into the patient account to verify that the BHW-saved follow-up date appears in the patient workspace.
9. Test the site on a narrow/mobile browser viewport.

## Technology stack

- Semantic HTML5
- CSS3 responsive layout
- Vanilla JavaScript
- Chart.js with SVG fallback
- JSON-compatible JavaScript data structures
- `localStorage` / `sessionStorage`
- Service Worker + Cache API

## Important scope boundary

BPBuddy organizes hypertension self-monitoring and community follow-up. It does not diagnose hypertension, prescribe or recommend medicines, dispatch emergency services, provide live teleconsultation, or replace professional medical care.

## Ready-to-use accounts

The site automatically creates these accounts on first load:

- Patient — Email: `patient@bpbuddy.com` — Password: `Patient123!`
- BHW — Email: `bhw@bpbuddy.com` — Password: `BHW12345!`

On the login page, select the matching role before signing in.
