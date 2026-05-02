-- Persist final draw result for promotions.

alter table public.promotions
  add column if not exists draw_status text not null default 'pending'
    check (draw_status in ('pending', 'completed', 'no_participants')),
  add column if not exists draw_processed_at timestamptz null;

update public.promotions
set
  draw_status = 'completed',
  draw_processed_at = coalesce(draw_processed_at, winner_selected_at)
where winner_participant_id is not null
  and draw_status = 'pending';

create index if not exists idx_promotions_due_pending
  on public.promotions (draw_at)
  where status = 'active' and draw_status = 'pending';
