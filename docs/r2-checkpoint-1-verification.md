# R2 checkpoint 1: legitimate administrator login

Verified November 11, 2026 (America/Toronto).

**Result: PASS, manually confirmed by the account owner.**

## Environment

The repository's Next.js development server was started at
`http://127.0.0.1:3000`. Its public Supabase configuration targets the linked
MyRealHub project, `eywzwkfeghbhwtsnjuti`. The application's
`/api/supabase/health` endpoint returned HTTP 200 with `ok: true`, reporting
GoTrue v2.197.0.

This verifies the local application against hosted Supabase. It does not establish
the behavior of a separate deployed staging or production application.

## Manually verified behavior

The account owner entered credentials directly into the application and reported
successful login with the legitimate administrator account selected during R1.
The owner then confirmed the requested checks:

| Check | Result |
| --- | --- |
| Sign in and open the administrator dashboard | PASS, owner reported |
| Reload and remain on the administrator dashboard | PASS, owner confirmed |
| Log out | PASS, owner confirmed |
| Reopen `/admin/dashboard` after logout and be redirected to login | PASS, owner confirmed |

The ambient browser URL after the manual checks was
`/login?next=%2Fadmin%2Fdashboard`, consistent with the reported protected-page
redirect. That URL alone is not proof of page content or all preceding actions.

## Verification boundary

Browser automation could not inspect the application because the origin approval
gate declined access. No alternate inspection route was used. The browser checks
above are user-confirmed results, not automated browser assertions. The assistant
did not request, read, store, or reset the account owner's password.

Customer/provider login, cross-role navigation, signup/confirmation, password
recovery, resend, and longer-term session refresh/expiry remain for later R2
checkpoints. R2 as a whole is not complete.
