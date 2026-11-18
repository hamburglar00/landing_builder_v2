-- Include managed signups already in progress during the rollout.
-- Native accounts qualify only once their link is complete.
update public.client_subscriptions as subscription
set expires_at = null
from public.pbadmin_accounts as account
join public.profiles as profile on profile.id = account.account_id
where subscription.user_id = account.account_id
  and profile.role = 'client'
  and account.disconnected_at is null
  and (account.ready or not account.legacy)
  and subscription.expires_at is not null;
