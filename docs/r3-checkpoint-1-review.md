# R3 checkpoint 1: existing customer provider-onboarding review

Reviewed November 16, 2026 (America/Toronto).

**Result: review complete. The existing customer CTA leads into an authentication
redirect loop rather than provider onboarding. Implementation remains pending.**

## Confirmed source behavior

- `components/auth/auth-menu.tsx` displays Join as Provider for signed-in
  customers and links to `/signup?role=provider`.
- `proxy.ts` identifies `/signup` as an authentication route and redirects a
  signed-in customer to the permitted post-auth destination, normally `/dashboard`.
  The signup role query does not convert an existing application profile.
- `lib/auth/roles.ts` already grants providers customer capabilities: consumer
  services, account settings, and provider-profile management.
- Direct client updates cannot change `public.profiles.role`. A browser-only role
  update or changing signup metadata would not be a supported conversion path.
- `/provider` routes require provider capability, so a customer onboarding entry
  page cannot simply be added inside that protected namespace.
- The existing provider dashboard supports a missing listing and links to the
  listing form in Settings. Listing creation/submission already follows its draft
  and approval workflow.

These findings come from source review, not browser automation. The owner has
selected manual browser checks; the previous browser origin denial remains
respected.

## Implementation direction for the next checkpoint

Add a dedicated authenticated customer onboarding page outside the provider-only
namespace, linked by the existing customer CTA. Explain that provider tools are
added to the same account and customer activity remains available. Conversion
must require an explicit form submission, not occur on a GET or link prefetch.

Use a guarded, self-scoped database operation with no caller-supplied user ID or
target role. It must verify a confirmed Auth identity and valid application
profile, allow only customer-to-provider conversion, and handle an already-provider
retry without duplicate effects. Anonymous, missing-identity/profile, and
administrator conversion attempts must be rejected. Administrator assignment and
direct role-column updates remain unavailable to clients.

After success, refresh the authenticated navigation and open the existing
provider dashboard with its listing-setup link. Retain the same account identity, saved
providers, messages, and customer permissions. Do not automatically publish or
approve a listing.

## Checks required before completion of R3

1. Implement and test the database operation in isolation, including denied
   callers, repeat requests, unrelated-account isolation, and retained customer
   activity. Confirm R1 security protections remain intact.
2. Connect the authenticated page/form and correct the signed-in customer CTA;
   keep anonymous provider registration available.
3. Verify the guarded Server Action, failure feedback, navigation role refresh,
   and listing approval boundary.
4. Apply the reviewed forward migration to the linked project only after
   isolated verification, then manually test conversion through the website.

This checkpoint did not change application code, database permissions, hosted
roles, accounts, or listings. R2's remaining email checks are explicitly deferred.
