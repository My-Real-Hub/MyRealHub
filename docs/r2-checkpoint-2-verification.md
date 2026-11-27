# R2 checkpoint 2: customer/provider login and role restrictions

Status: complete. Customer/provider checks and the logout retest passed by owner
confirmation on November 11, 2026 (America/Toronto).

## Account preflight

Read-only hosted checks on November 11, 2026 (America/Toronto) confirmed the
existing synthetic customer `hannah.lee@example.com` has role `user` and the
synthetic provider `ava.chen@example.com` has role `provider` with an active
listing. Both have confirmed email addresses, configured passwords, and no ban
or deletion. Evidence: `audit-artifacts/r2/checkpoint2/account-preflight-result.json`.

## Manual results and correction

The owner initially reported the customer checks working. During subsequent
logout testing, the owner reported that customer/provider dashboards could remain
visible after logout, and clarified that a full Ctrl+R reload shows the login
page. The earlier logout pass is therefore not treated as final acceptance.
After the logout correction and retest, the owner additionally confirmed that
provider reload/session persistence, administrator-page redirection, and Settings
and Saved Providers access "all worked".

Browser access was previously declined and the owner explicitly selected manual
checks for this checkpoint. No browser automation workaround was used.

## Client correction

`components/auth/auth-menu.tsx` previously updated only the header when its Auth
subscription reported no session. It now hides protected main content and uses a
full navigation to login, preserving the return destination. This also handles
signed-out events received by other tabs sharing the session.

When the browser saves a protected document in its Back/Forward cache, the main
content is hidden; restoring that document triggers a full reload so the server
checks the current cookies. Existing role checks remain in the proxy and page
data-access helpers.

Validation: all 36 existing authentication regression tests passed; TypeScript,
targeted ESLint, and diff whitespace checks passed. Those tests do not establish
the changed browser event behavior. After being asked to refresh, log in/out,
and retest reopening the dashboard, Back, and another open tab, the owner replied
"working". The logout retest is therefore recorded as manually passed, not as an
automated browser result.

## Final manual acceptance

| Check | Customer | Provider |
| --- | --- | --- |
| Login opens the appropriate dashboard | PASS | PASS |
| Reload preserves the session | PASS | PASS |
| Administrator dashboard redirects to the appropriate role dashboard | PASS | PASS |
| Customer cannot access provider dashboard | PASS | Not applicable |
| Settings and Saved Providers open | Not separately checked here | PASS |
| Logout protects the dashboard on reopening | PASS after correction | PASS after correction |

All browser results are owner-confirmed. The logout/Back/other-tab retest was
confirmed as a combined sequence, without separate results for every browser or
role combination. Signup/confirmation and password recovery remain later R2 work.
