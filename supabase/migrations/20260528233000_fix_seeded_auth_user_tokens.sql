update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, '')
where email in (
  'ava.chen@example.com',
  'marcus.bennett@example.com',
  'priya.shah@example.com',
  'daniel.moreau@example.com',
  'sofia.rivera@example.com',
  'noah.thompson@example.com',
  'leila.haddad@example.com',
  'ethan.brooks@example.com',
  'grace.kim@example.com',
  'omar.malik@example.com',
  'maya.singh@example.com',
  'liam.walker@example.com',
  'hannah.lee@example.com',
  'jacob.wilson@example.com',
  'admin@example.com'
);
