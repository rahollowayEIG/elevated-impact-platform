-- SANDBOX ONLY: RLS-invoker view, no live credit balances or ledger data.
CREATE VIEW public.organization_credit_balances WITH (security_invoker = true) AS
SELECT o.id AS organization_id,
       o.name AS organization_name,
       COALESCE(SUM(CASE
          WHEN l.status = 'posted' AND (l.expires_at IS NULL OR l.expires_at > now())
          THEN l.amount ELSE 0::numeric END),0::numeric)::numeric(12,2) AS credit_balance
FROM public.organizations o
LEFT JOIN public.eig_credit_ledger l ON l.organization_id=o.id
GROUP BY o.id,o.name;
REVOKE ALL ON public.organization_credit_balances FROM PUBLIC, anon, authenticated;
