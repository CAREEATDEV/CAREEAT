-- ============================================================
-- HYDRA WAITLIST v2 — 8 requêtes d'analyse
-- À exécuter dans le SQL Editor Supabase (rôle admin/service).
-- Table : public.hydra_waitlist_v2
-- ============================================================

-- 1. INVITÉS BÊTA PRIORITAIRES
-- Ceux qui valorisent le produit (prix ≥ 5 €), premiers arrivés d'abord.
-- Mode 'simple' → price_fair ; mode 'sensitivity' → price_good_deal.
select email, coalesce(price_fair, price_good_deal) as prix, created_at, source
from public.hydra_waitlist_v2
where coalesce(price_fair, price_good_deal) >= 5
order by created_at asc;

-- 2. LECTURE DU PRIX
-- Stats descriptives + histogramme par tranche de 1 €.
select
  count(*) filter (where price_fair is not null)              as n_reponses,
  round(min(price_fair), 2)                                   as prix_min,
  round(max(price_fair), 2)                                   as prix_max,
  round(avg(price_fair), 2)                                   as prix_moyen,
  round(percentile_cont(0.5) within group (order by price_fair)::numeric, 2) as prix_median
from public.hydra_waitlist_v2;

-- Histogramme (tranches de 1 €)
select floor(price_fair)::int as tranche_eur, count(*) as n,
       repeat('▮', count(*)::int) as barre
from public.hydra_waitlist_v2
where price_fair is not null
group by 1 order by 1;

-- Mode 'sensitivity' : fourchette croisée Van Westendorp
select
  round(percentile_cont(0.5) within group (order by price_good_deal)::numeric, 2)     as bonne_affaire_median,
  round(percentile_cont(0.5) within group (order by price_too_expensive)::numeric, 2) as trop_cher_median
from public.hydra_waitlist_v2
where price_good_deal is not null or price_too_expensive is not null;

-- 3. DÉCISION D'ANGLE MARKETING
-- Soirée vs générique : où les gens oublient de boire × ce qui les motive.
select forget_context, count(*) as n,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from public.hydra_waitlist_v2
where forget_context is not null
group by 1 order by n desc;

select motivation, count(*) as n,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from public.hydra_waitlist_v2
where motivation is not null
group by 1 order by n desc;

-- 4. DÉCISION ROADMAP
-- Classement des features fermées + thèmes récurrents de la baguette magique.
select feature_priority, count(*) as n
from public.hydra_waitlist_v2
where feature_priority is not null
group by 1 order by n desc;

-- Mots les plus fréquents dans magic_wand (mots ≥ 4 lettres, hors stopwords basiques)
select word, count(*) as n
from public.hydra_waitlist_v2,
     lateral regexp_split_to_table(lower(magic_wand), '\W+') as word
where magic_wand is not null
  and length(word) >= 4
  and word not in ('pour','avec','dans','plus','tout','être','fait','faire','quand','elle','vous','mais','nous','cette','sont')
group by word having count(*) > 1 order by n desc limit 30;

-- 5. DÉCISION ANDROID
-- Si la part Android est significative, la roadmap Android monte en priorité.
select platform, count(*) as n,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from public.hydra_waitlist_v2
where platform is not null
group by 1;

-- 6. DÉCISION MONTRE
-- Part d'Apple Watch = poids à donner à la complication watchOS.
select watch, count(*) as n,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from public.hydra_waitlist_v2
where watch is not null
group by 1 order by n desc;

-- 7. CIBLE CHURN (les plus précieux : ils ont déjà essayé et abandonné)
-- Leur feedback concurrent = ta liste d'erreurs à ne pas refaire.
select email, competitor_feedback, created_at
from public.hydra_waitlist_v2
where 'app_churned' = any(current_management)
  and competitor_feedback is not null
  and length(trim(competitor_feedback)) > 0
order by created_at desc;

-- 8. SOURCES & COMPLÉTION
-- Quel canal amène du volume ET des réponses complètes.
select
  coalesce(source, '(direct)') as source,
  count(*) as inscrits,
  count(*) filter (where completed_optional) as bloc2_complet,
  round(100.0 * count(*) filter (where completed_optional) / count(*), 1) as taux_completion_pct
from public.hydra_waitlist_v2
group by 1 order by inscrits desc;
