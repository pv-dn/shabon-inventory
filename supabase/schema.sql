-- しゃぼん玉せっけん 在庫管理（専用プロジェクト）
-- 他アプリ（プゥルヴー在庫など）とは別の Supabase プロジェクトで実行してください。
-- Supabase SQL Editor に貼り付けて Run。

create table if not exists products (
  id bigserial primary key,
  code text not null unique,
  name text not null,
  spec text default '',
  case_qty text default '',
  retail_price integer,
  member_price integer,
  quantity integer not null default 0,
  min_stock integer not null default 0,
  note text default '',
  category text not null default '["other"]',
  image_url text,
  updated_at text
);

create table if not exists movements (
  id bigserial primary key,
  product_id bigint not null references products(id) on delete cascade,
  type text not null,
  quantity integer not null,
  before_qty integer not null,
  after_qty integer not null,
  memo text default '',
  created_at text not null,
  cancelled_at text
);

create table if not exists order_requests (
  id bigserial primary key,
  product_id bigint not null references products(id) on delete cascade,
  quantity integer not null default 1,
  memo text default '',
  status text not null default 'pending',
  created_at text not null,
  completed_at text
);

create index if not exists idx_shabon_movements_product on movements(product_id);
create index if not exists idx_shabon_movements_created on movements(created_at);
create index if not exists idx_shabon_order_requests_status on order_requests(status);
create index if not exists idx_shabon_order_requests_created on order_requests(created_at);

alter table products enable row level security;
alter table movements enable row level security;
alter table order_requests enable row level security;

-- 共有パスワードアプリ向け（anon key で店舗端末から利用）
-- ※ URL と anon key を知っている人だけがアクセスできる前提
drop policy if exists shabon_products_all on products;
create policy shabon_products_all on products for all using (true) with check (true);

drop policy if exists shabon_movements_all on movements;
create policy shabon_movements_all on movements for all using (true) with check (true);

drop policy if exists shabon_order_requests_all on order_requests;
create policy shabon_order_requests_all on order_requests for all using (true) with check (true);

-- 入出庫（在庫更新を原子的に）
create or replace function shabon_create_movement(
  p_product_id bigint,
  p_type text,
  p_quantity integer,
  p_memo text default ''
)
returns json
language plpgsql
as $$
declare
  v_before integer;
  v_after integer;
  v_delta integer;
  v_now text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS');
  v_product products%rowtype;
begin
  if p_type not in ('in', 'out', 'adjust') then
    raise exception '種別は in / out / adjust のいずれかです';
  end if;

  select * into v_product from products where id = p_product_id for update;
  if not found then
    raise exception '商品が見つかりません';
  end if;

  v_before := v_product.quantity;
  if p_type = 'in' then
    if p_quantity <= 0 then raise exception '数量は1以上で入力してください'; end if;
    v_after := v_before + p_quantity;
    v_delta := p_quantity;
  elsif p_type = 'out' then
    if p_quantity <= 0 then raise exception '数量は1以上で入力してください'; end if;
    if v_before < p_quantity then
      raise exception '在庫不足です（現在: %）', v_before;
    end if;
    v_after := v_before - p_quantity;
    v_delta := p_quantity;
  else
    if p_quantity < 0 then raise exception '棚卸の在庫数は0以上です'; end if;
    v_after := p_quantity;
    v_delta := abs(v_after - v_before);
  end if;

  update products
    set quantity = v_after, updated_at = v_now
    where id = p_product_id;

  insert into movements (product_id, type, quantity, before_qty, after_qty, memo, created_at)
  values (p_product_id, p_type, v_delta, v_before, v_after, coalesce(p_memo, ''), v_now);

  select * into v_product from products where id = p_product_id;
  return row_to_json(v_product);
end;
$$;

-- 履歴取消
create or replace function shabon_cancel_movement(p_movement_id bigint)
returns json
language plpgsql
as $$
declare
  v_mov movements%rowtype;
  v_product products%rowtype;
  v_delta integer;
  v_new_qty integer;
  v_now text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS');
begin
  select * into v_mov from movements where id = p_movement_id for update;
  if not found then
    raise exception '履歴が見つかりません';
  end if;
  if v_mov.cancelled_at is not null then
    raise exception 'この履歴は既に取り消されています';
  end if;

  select * into v_product from products where id = v_mov.product_id for update;
  if not found then
    raise exception '商品が見つかりません';
  end if;

  v_delta := v_mov.after_qty - v_mov.before_qty;
  v_new_qty := v_product.quantity - v_delta;
  if v_new_qty < 0 then
    raise exception '取り消すと在庫が不足します（現在 % 個）', v_product.quantity;
  end if;

  if v_delta <> 0 then
    update products
      set quantity = v_new_qty, updated_at = v_now
      where id = v_mov.product_id;

    update movements
      set before_qty = before_qty - v_delta,
          after_qty = after_qty - v_delta
      where product_id = v_mov.product_id
        and cancelled_at is null
        and (created_at > v_mov.created_at
             or (created_at = v_mov.created_at and id > v_mov.id));
  end if;

  delete from movements where id = p_movement_id;

  select * into v_product from products where id = v_mov.product_id;
  return row_to_json(v_product);
end;
$$;

grant execute on function shabon_create_movement(bigint, text, integer, text) to anon, authenticated;
grant execute on function shabon_cancel_movement(bigint) to anon, authenticated;
