-- Sort by the case-insensitive labels shown in the catalog, with id as stable tie-breaker.
alter table public.eic_design_products
  add column sort_name text generated always as (lower(name)) stored,
  add column sort_category text generated always as (case category
    when 'signage' then 'signs & banners' when 'marketing' then 'marketing materials'
    when 'books' then 'books & programs' when 'displays' then 'digital displays' else category end) stored,
  add column sort_material text generated always as (case material
    when 'sign' then 'sponsor sign' when 'swag' then 'gifts & swag' when 'book' then 'book cover'
    when 'display' then 'digital display' else material end) stored,
  add column sort_status text generated always as (case status when 'active' then 'available' else status end) stored;
grant select(sort_name,sort_category,sort_material,sort_status) on public.eic_design_products to authenticated;
create index eic_design_products_name_sort_idx on public.eic_design_products(sort_name,id);
notify pgrst, 'reload schema';
