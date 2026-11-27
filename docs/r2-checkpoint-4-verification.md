# R2 checkpoint 4: password recovery

Status: complete; all requested password-recovery checks passed by owner
confirmation on November 16, 2026 (America/Toronto).

The owner requested proceeding to this checkpoint on November 16, 2026
(America/Toronto), deferring confirmation resend to provider signup.

Use the existing, confirmed owner-controlled customer test account
`ja***@hotmail.com` (masked in this report). The website's Forgot Password form
requests a recovery email with the current origin's `/auth/callback` route and
`next=/reset-password`. The browser/email journey remains owner-operated, as
previously selected. Passwords and recovery links must not be recorded.

Required acceptance evidence:

- Reset request produces appropriate feedback and the email reaches the mailbox.
- The link reaches the password-change form in the intended application.
- Saving a new password succeeds.
- After logout, the previous password fails and the new password succeeds.
- Reused or expired links fail safely with recovery guidance.

## Manual results

After being asked to perform the complete sequence, the owner reported that
everything worked as intended:

| Check | Result |
| --- | --- |
| Request reset through the website and receive the email | PASS, owner confirmed |
| Open the link and reach the password-change form | PASS, owner confirmed |
| Save a different password successfully | PASS, owner confirmed |
| Log out and verify the old password fails | PASS, owner confirmed |
| Verify the new password succeeds | PASS, owner confirmed |
| Reopen the used link and receive recovery guidance | PASS, owner confirmed |

These are manually reported results, not automated browser assertions. Passwords
and recovery links were neither requested nor inspected by the assistant. No
Auth setting or application code was changed during this checkpoint. An actually
expired link was not independently tested; the reused-link check passed.

R2 is not yet complete: provider signup and the deferred confirmation-resend
checks from checkpoint 3 remain outstanding.
