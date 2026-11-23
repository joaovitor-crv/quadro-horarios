-- Várias escolas, teste grátis, validade da assinatura e painel do dono.
-- A escola que já usava o sistema vira a escola nº 1 (dados e usuários preservados).

create table public.quadro_escolas (
  id bigint generated always as identity primary key,
  nome text not null check (length(trim(nome)) between 2 and 120),
  responsavel text,
  email text,
  telefone text,
  cidade text,
  teste_ate date,
  pago_ate date,
  bloqueada boolean not null default false,
  plano text,
  obs text,
  origem_ip text,
  criado_em timestamptz not null default now()
);
alter table public.quadro_escolas enable row level security;

insert into public.quadro_escolas (nome, pago_ate, plano, obs)
values (coalesce((select v->>'escola' from public.quadro_docs where doc = 'config'), 'Escola 1'), date '2099-12-31', 'cortesia', 'Primeira escola (já usava o sistema antes da versão para várias escolas).');

-- usuários: escola e marca de dono do sistema
alter table public.quadro_usuarios add column escola_id bigint references public.quadro_escolas(id) on delete cascade;
alter table public.quadro_usuarios add column dono boolean not null default false;
update public.quadro_usuarios set escola_id = (select min(id) from public.quadro_escolas);
alter table public.quadro_usuarios add constraint quadro_usuarios_escola_ou_dono check (escola_id is not null or dono);
create index on public.quadro_usuarios (escola_id);

-- documentos: um conjunto por escola
alter table public.quadro_docs add column escola_id bigint references public.quadro_escolas(id) on delete cascade;
update public.quadro_docs set escola_id = (select min(id) from public.quadro_escolas);
alter table public.quadro_docs alter column escola_id set not null;
alter table public.quadro_docs drop constraint quadro_docs_pkey;
alter table public.quadro_docs add primary key (escola_id, doc);

-- controle de cadastros (anti-abuso)
create table public.quadro_cadastros (ip text, em timestamptz not null default now());
alter table public.quadro_cadastros enable row level security;

-- situação da escola em JSON (usada pelo app e pelo painel do dono)
create or replace function public.quadro__escola_info(p_escola bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'nome', e.nome, 'teste_ate', e.teste_ate, 'pago_ate', e.pago_ate, 'bloqueada', e.bloqueada,
    'valido_ate', greatest(e.teste_ate, e.pago_ate),
    'em_teste', e.pago_ate is null or e.pago_ate < current_date,
    'dias', greatest(e.teste_ate, e.pago_ate) - current_date,
    'liberada', not e.bloqueada and coalesce(greatest(e.teste_ate, e.pago_ate) >= current_date, false))
  from public.quadro_escolas e where e.id = p_escola
$$;

create or replace function public.quadro__liberada(p_escola bigint)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((public.quadro__escola_info(p_escola)->>'liberada')::boolean, false) then raise exception 'ASSINATURA_VENCIDA'; end if;
end $$;

create or replace function public.quadro__escola(u public.quadro_usuarios)
returns bigint language plpgsql immutable set search_path = '' as $$
begin
  if u.escola_id is null then raise exception 'SEM_ESCOLA'; end if;
  return u.escola_id;
end $$;

create or replace function public.quadro__dono(p_token uuid)
returns public.quadro_usuarios language plpgsql stable security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__sessao(p_token);
begin
  if not u.dono then raise exception 'SEM_PERMISSAO'; end if;
  return u;
end $$;

create or replace function public.quadro_eu(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__sessao(p_token);
begin
  return jsonb_build_object('usuario', u.usuario, 'nome', u.nome, 'papel', u.papel, 'trocar_senha', u.trocar_senha,
    'dono', u.dono, 'escola', case when u.escola_id is null then null else public.quadro__escola_info(u.escola_id) end);
end $$;

create or replace function public.quadro_login(p_usuario text, p_senha text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios; t uuid; n int;
begin
  select count(*) into n from public.quadro_tentativas where usuario = lower(trim(p_usuario)) and em > now() - interval '15 minutes';
  if n >= 8 then raise exception 'MUITAS_TENTATIVAS'; end if;
  select * into u from public.quadro_usuarios where usuario = lower(trim(p_usuario)) and ativo;
  if u.id is null or u.senha_hash <> extensions.crypt(p_senha, u.senha_hash) then
    insert into public.quadro_tentativas (usuario) values (lower(trim(coalesce(p_usuario,''))));
    raise exception 'LOGIN_INVALIDO';
  end if;
  delete from public.quadro_tentativas where usuario = u.usuario or em < now() - interval '1 day';
  delete from public.quadro_sessoes where expira_em < now();
  insert into public.quadro_sessoes (usuario_id) values (u.id) returning token into t;
  return jsonb_build_object('token', t, 'usuario', u.usuario, 'nome', u.nome, 'papel', u.papel, 'trocar_senha', u.trocar_senha,
    'dono', u.dono, 'escola', case when u.escola_id is null then null else public.quadro__escola_info(u.escola_id) end);
end $$;

create or replace function public.quadro_ler(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__sessao(p_token); e bigint := public.quadro__escola(u);
begin
  -- leitura continua liberada mesmo com a assinatura vencida (a escola pode consultar e exportar os dados)
  return coalesce((select jsonb_object_agg(doc, jsonb_build_object('v', v, 'em', atualizado_em, 'por', atualizado_por))
    from public.quadro_docs where escola_id = e), '{}'::jsonb);
end $$;

create or replace function public.quadro_salvar(p_token uuid, p_doc text, p_v jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__sessao(p_token); e bigint := public.quadro__escola(u); agora timestamptz := now();
begin
  perform public.quadro__liberada(e);
  if p_doc not in ('config','professores','turmas','disciplinas','atribs','grade') then raise exception 'DOC_INVALIDO'; end if;
  if p_v is null then raise exception 'DADOS_VAZIOS'; end if;
  if pg_column_size(p_v) > 5000000 then raise exception 'DADOS_GRANDES'; end if;
  insert into public.quadro_docs (escola_id, doc, v, atualizado_em, atualizado_por) values (e, p_doc, p_v, agora, u.nome)
    on conflict (escola_id, doc) do update set v = excluded.v, atualizado_em = agora, atualizado_por = u.nome;
  if p_doc = 'config' and coalesce(trim(p_v->>'escola'),'') <> '' then
    update public.quadro_escolas set nome = left(trim(p_v->>'escola'), 120) where id = e and nome is distinct from left(trim(p_v->>'escola'), 120);
  end if;
  return agora;
end $$;

create or replace function public.quadro_usuarios_lista(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__sessao(p_token); e bigint := public.quadro__escola(u);
begin
  if u.papel <> 'admin' then raise exception 'SEM_PERMISSAO'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'usuario', usuario, 'nome', nome, 'papel', papel, 'ativo', ativo) order by nome)
    from public.quadro_usuarios where escola_id = e), '[]'::jsonb);
end $$;

create or replace function public.quadro_salvar_usuario(p_token uuid, p_id bigint, p_usuario text, p_nome text, p_papel text, p_senha text, p_ativo boolean)
returns bigint language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__sessao(p_token); e bigint := public.quadro__escola(u); novo bigint;
begin
  if u.papel <> 'admin' then raise exception 'SEM_PERMISSAO'; end if;
  if coalesce(trim(p_nome),'') = '' then raise exception 'NOME_VAZIO'; end if;
  if p_papel not in ('admin','editor') then raise exception 'PAPEL_INVALIDO'; end if;
  if p_id is null then
    if (select count(*) from public.quadro_usuarios where escola_id = e) >= 50 then raise exception 'LIMITE_USUARIOS'; end if;
    perform public.quadro__senha_ok(p_senha);
    insert into public.quadro_usuarios (escola_id, usuario, nome, senha_hash, papel, ativo, trocar_senha)
      values (e, lower(trim(p_usuario)), trim(p_nome), extensions.crypt(p_senha, extensions.gen_salt('bf')), p_papel, coalesce(p_ativo, true), true)
      returning id into novo;
    return novo;
  end if;
  if not exists (select 1 from public.quadro_usuarios where id = p_id and escola_id = e) then raise exception 'SEM_PERMISSAO'; end if;
  if p_id = u.id and (p_papel <> 'admin' or not coalesce(p_ativo, true)) then raise exception 'NAO_PODE_SI_MESMO'; end if;
  update public.quadro_usuarios set usuario = lower(trim(p_usuario)), nome = trim(p_nome), papel = p_papel, ativo = coalesce(p_ativo, true) where id = p_id and escola_id = e;
  if coalesce(p_senha,'') <> '' then
    perform public.quadro__senha_ok(p_senha);
    update public.quadro_usuarios set senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf')), trocar_senha = (p_id <> u.id) where id = p_id and escola_id = e;
    delete from public.quadro_sessoes where usuario_id = p_id and p_id <> u.id;
  end if;
  if not coalesce(p_ativo, true) then delete from public.quadro_sessoes where usuario_id = p_id; end if;
  return p_id;
end $$;

create or replace function public.quadro_excluir_usuario(p_token uuid, p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__sessao(p_token); e bigint := public.quadro__escola(u);
begin
  if u.papel <> 'admin' then raise exception 'SEM_PERMISSAO'; end if;
  if p_id = u.id then raise exception 'NAO_PODE_SI_MESMO'; end if;
  delete from public.quadro_usuarios where id = p_id and escola_id = e;
end $$;

-- cadastro público: cria a escola com teste grátis, o administrador e já entra
create or replace function public.quadro_cadastrar_escola(p_escola text, p_responsavel text, p_email text, p_telefone text, p_cidade text, p_usuario text, p_senha text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ip text; e bigint; uid bigint; t uuid; usu text := lower(trim(coalesce(p_usuario,'')));
begin
  begin v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'cf-connecting-ip', current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  exception when others then v_ip := ''; end;
  delete from public.quadro_cadastros where em < now() - interval '2 days';
  if v_ip <> '' and (select count(*) from public.quadro_cadastros c where c.ip = v_ip and em > now() - interval '1 hour') >= 3 then raise exception 'MUITOS_CADASTROS'; end if;
  if (select count(*) from public.quadro_cadastros where em > now() - interval '1 day') >= 40 then raise exception 'MUITOS_CADASTROS'; end if;
  if length(trim(coalesce(p_escola,''))) < 3 then raise exception 'ESCOLA_VAZIA'; end if;
  if coalesce(trim(p_responsavel),'') = '' then raise exception 'NOME_VAZIO'; end if;
  if coalesce(trim(p_email),'') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'EMAIL_INVALIDO'; end if;
  if usu !~ '^[a-z0-9._-]{3,40}$' then raise exception 'USUARIO_INVALIDO'; end if;
  if exists (select 1 from public.quadro_usuarios where usuario = usu) then raise exception 'USUARIO_EXISTE'; end if;
  perform public.quadro__senha_ok(p_senha);
  insert into public.quadro_cadastros (ip) values (v_ip);
  insert into public.quadro_escolas (nome, responsavel, email, telefone, cidade, teste_ate, origem_ip)
    values (left(trim(p_escola),120), left(trim(p_responsavel),120), left(lower(trim(p_email)),160), left(trim(coalesce(p_telefone,'')),40), left(trim(coalesce(p_cidade,'')),80), current_date + 15, nullif(v_ip,''))
    returning id into e;
  insert into public.quadro_usuarios (escola_id, usuario, nome, senha_hash, papel, ativo, trocar_senha)
    values (e, usu, left(trim(p_responsavel),120), extensions.crypt(p_senha, extensions.gen_salt('bf')), 'admin', true, false) returning id into uid;
  insert into public.quadro_sessoes (usuario_id) values (uid) returning token into t;
  return jsonb_build_object('token', t, 'usuario', usu, 'nome', trim(p_responsavel), 'papel', 'admin', 'trocar_senha', false, 'dono', false, 'escola', public.quadro__escola_info(e));
end $$;

-- painel do dono
create or replace function public.quadro_dono_escolas(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__dono(p_token);
begin
  return coalesce((select jsonb_agg(public.quadro__escola_info(e.id) || jsonb_build_object(
      'responsavel', e.responsavel, 'email', e.email, 'telefone', e.telefone, 'cidade', e.cidade, 'plano', e.plano, 'obs', e.obs, 'criado_em', e.criado_em,
      'usuarios', (select count(*) from public.quadro_usuarios q where q.escola_id = e.id),
      'admins', (select jsonb_agg(q.usuario order by q.id) from public.quadro_usuarios q where q.escola_id = e.id and q.papel = 'admin'),
      'ultima_alteracao', (select max(d.atualizado_em) from public.quadro_docs d where d.escola_id = e.id),
      'turmas', (select jsonb_array_length(d.v) from public.quadro_docs d where d.escola_id = e.id and d.doc = 'turmas' and jsonb_typeof(d.v) = 'array'),
      'professores', (select jsonb_array_length(d.v) from public.quadro_docs d where d.escola_id = e.id and d.doc = 'professores' and jsonb_typeof(d.v) = 'array'),
      'ultimo_acesso', (select max(s.criado_em) from public.quadro_sessoes s join public.quadro_usuarios q on q.id = s.usuario_id where q.escola_id = e.id))
    order by e.id desc) from public.quadro_escolas e), '[]'::jsonb);
end $$;

create or replace function public.quadro_dono_salvar_escola(p_token uuid, p_id bigint, p_pago_ate date, p_teste_ate date, p_bloqueada boolean, p_plano text, p_obs text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__dono(p_token);
begin
  update public.quadro_escolas set pago_ate = p_pago_ate, teste_ate = p_teste_ate, bloqueada = coalesce(p_bloqueada, false), plano = nullif(trim(coalesce(p_plano,'')),''), obs = nullif(trim(coalesce(p_obs,'')),'')
   where id = p_id;
  if not found then raise exception 'ESCOLA_NAO_ENCONTRADA'; end if;
  return public.quadro__escola_info(p_id);
end $$;

create or replace function public.quadro_dono_redefinir_senha(p_token uuid, p_usuario text, p_senha text)
returns void language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__dono(p_token); alvo bigint;
begin
  perform public.quadro__senha_ok(p_senha);
  select id into alvo from public.quadro_usuarios where usuario = lower(trim(p_usuario)) and not dono;
  if alvo is null then raise exception 'USUARIO_NAO_ENCONTRADO'; end if;
  update public.quadro_usuarios set senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf')), trocar_senha = true, ativo = true where id = alvo;
  delete from public.quadro_sessoes where usuario_id = alvo;
  delete from public.quadro_tentativas where usuario = lower(trim(p_usuario));
end $$;

create or replace function public.quadro_dono_excluir_escola(p_token uuid, p_id bigint, p_confirma text)
returns void language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__dono(p_token);
begin
  if p_confirma is distinct from (select nome from public.quadro_escolas where id = p_id) then raise exception 'CONFIRMACAO_ERRADA'; end if;
  delete from public.quadro_escolas where id = p_id;
end $$;

-- funções internas não ficam expostas na API
revoke execute on function public.quadro__escola_info(bigint), public.quadro__liberada(bigint), public.quadro__escola(public.quadro_usuarios), public.quadro__dono(uuid) from public, anon, authenticated;
