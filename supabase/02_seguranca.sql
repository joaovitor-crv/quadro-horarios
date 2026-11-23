-- Segurança: sem cadastro público (só o dono cria escolas), escola suspensa não entra,
-- sessão do dono curta e funções expostas só para o papel anon (a chave pública do site).

drop function if exists public.quadro_cadastrar_escola(text, text, text, text, text, text, text);
drop table if exists public.quadro_cadastros;

-- escola suspensa: ninguém dela entra (a sessão cai na hora)
create or replace function public.quadro__sessao(p_token uuid)
returns public.quadro_usuarios language plpgsql stable security definer set search_path = '' as $$
declare u public.quadro_usuarios;
begin
  select q.* into u from public.quadro_sessoes s join public.quadro_usuarios q on q.id = s.usuario_id
   where s.token = p_token and s.expira_em > now() and q.ativo;
  if u.id is null then raise exception 'SESSAO_INVALIDA'; end if;
  if u.escola_id is not null and exists (select 1 from public.quadro_escolas e where e.id = u.escola_id and e.bloqueada) then raise exception 'ESCOLA_SUSPENSA'; end if;
  return u;
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
  if u.escola_id is not null and exists (select 1 from public.quadro_escolas e where e.id = u.escola_id and e.bloqueada) then raise exception 'ESCOLA_SUSPENSA'; end if;
  delete from public.quadro_tentativas where usuario = u.usuario or em < now() - interval '1 day';
  delete from public.quadro_sessoes where expira_em < now();
  insert into public.quadro_sessoes (usuario_id, expira_em) values (u.id, now() + case when u.dono then interval '12 hours' else interval '30 days' end) returning token into t;
  return jsonb_build_object('token', t, 'usuario', u.usuario, 'nome', u.nome, 'papel', u.papel, 'trocar_senha', u.trocar_senha,
    'dono', u.dono, 'escola', case when u.escola_id is null then null else public.quadro__escola_info(u.escola_id) end);
end $$;

-- suspender derruba as sessões abertas da escola
create or replace function public.quadro_dono_salvar_escola(p_token uuid, p_id bigint, p_pago_ate date, p_teste_ate date, p_bloqueada boolean, p_plano text, p_obs text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__dono(p_token);
begin
  update public.quadro_escolas set pago_ate = p_pago_ate, teste_ate = p_teste_ate, bloqueada = coalesce(p_bloqueada, false), plano = nullif(trim(coalesce(p_plano,'')),''), obs = nullif(trim(coalesce(p_obs,'')),'')
   where id = p_id;
  if not found then raise exception 'ESCOLA_NAO_ENCONTRADA'; end if;
  if coalesce(p_bloqueada, false) then
    delete from public.quadro_sessoes s using public.quadro_usuarios q where q.id = s.usuario_id and q.escola_id = p_id;
  end if;
  return public.quadro__escola_info(p_id);
end $$;

-- só o dono cria escolas (com o administrador dela, que troca a senha no primeiro acesso)
create or replace function public.quadro_dono_criar_escola(p_token uuid, p_nome text, p_responsavel text, p_email text, p_telefone text, p_cidade text, p_usuario text, p_senha text, p_liberada_ate date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u public.quadro_usuarios := public.quadro__dono(p_token); e bigint; usu text := lower(trim(coalesce(p_usuario,'')));
begin
  if length(trim(coalesce(p_nome,''))) < 3 then raise exception 'ESCOLA_VAZIA'; end if;
  if usu !~ '^[a-z0-9._-]{3,40}$' then raise exception 'USUARIO_INVALIDO'; end if;
  if exists (select 1 from public.quadro_usuarios where usuario = usu) then raise exception 'USUARIO_EXISTE'; end if;
  if p_liberada_ate is null or p_liberada_ate < current_date then raise exception 'DATA_INVALIDA'; end if;
  perform public.quadro__senha_ok(p_senha);
  insert into public.quadro_escolas (nome, responsavel, email, telefone, cidade, pago_ate)
    values (left(trim(p_nome),120), nullif(left(trim(coalesce(p_responsavel,'')),120),''), nullif(left(lower(trim(coalesce(p_email,''))),160),''), nullif(left(trim(coalesce(p_telefone,'')),40),''), nullif(left(trim(coalesce(p_cidade,'')),80),''), p_liberada_ate)
    returning id into e;
  insert into public.quadro_usuarios (escola_id, usuario, nome, senha_hash, papel, ativo, trocar_senha)
    values (e, usu, coalesce(nullif(left(trim(coalesce(p_responsavel,'')),120),''), 'Administrador'), extensions.crypt(p_senha, extensions.gen_salt('bf')), 'admin', true, true);
  insert into public.quadro_docs (escola_id, doc, v, atualizado_por) values (e, 'config', jsonb_build_object('escola', left(trim(p_nome),120)), u.nome);
  return public.quadro__escola_info(e);
end $$;

-- a API do site usa só o papel anon; os outros papéis e o público não executam nada do quadro
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'quadro%' loop
    execute format('revoke execute on function %s from public, authenticated', f.sig);
    if f.proname like 'quadro\_\_%' then execute format('revoke execute on function %s from anon', f.sig);
    else execute format('grant execute on function %s to anon', f.sig); end if;
  end loop;
end $$;
revoke all on public.quadro_escolas, public.quadro_docs, public.quadro_usuarios, public.quadro_sessoes, public.quadro_tentativas from anon, authenticated;
