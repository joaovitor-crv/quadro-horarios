{
const $ = id => document.getElementById(id);
const E = U.esc;
let S = Store.vazio(), M = Modelo(S), PROBS = [], ROUTE = 'painel';
const UI = { modo: 'turma', turma: null, prof: null, turnoGeral: 'M', sel: null, clip: null, filtroAtr: { t: '', p: '', d: '', q: '' }, import: null, undo: [], lastGen: null };


/* ---------------- modo site (Supabase) ---------------- */
const ERROS = { LOGIN_INVALIDO: 'Usuário ou senha incorretos.', MUITAS_TENTATIVAS: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.', SENHA_CURTA: 'A senha precisa ter pelo menos 6 caracteres.', SENHA_FRACA: 'Senha muito fácil. Escolha outra.', SENHA_ATUAL_ERRADA: 'A senha atual está incorreta.', NAO_PODE_SI_MESMO: 'Você não pode remover o próprio acesso de administrador.', SEM_PERMISSAO: 'Apenas administradores podem fazer isso.', SESSAO_INVALIDA: 'Sua sessão expirou. Entre novamente.', NOME_VAZIO: 'Informe o nome.', PAPEL_INVALIDO: 'Papel inválido.', ASSINATURA_VENCIDA: 'O acesso da escola venceu: os dados ficam só para consulta e exportação até a renovação.', SEM_ESCOLA: 'Esta conta é do painel do dono do sistema. Abra a página /admin/.', USUARIO_EXISTE: 'Esse nome de usuário já existe. Escolha outro.', USUARIO_INVALIDO: 'Usuário: de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado, sem espaços.', EMAIL_INVALIDO: 'Informe um e-mail válido.', ESCOLA_VAZIA: 'Informe o nome da escola.', MUITOS_CADASTROS: 'Muitos cadastros feitos agora. Tente de novo mais tarde ou fale com o suporte.', LIMITE_USUARIOS: 'Limite de 50 usuários por escola.', DADOS_GRANDES: 'Os dados ficaram grandes demais para salvar. Fale com o suporte.' };
const SITE = window.QH_SITE || {};
const contato = () => [SITE.whatsapp ? `WhatsApp ${E(SITE.whatsapp)}` : '', SITE.email ? `<a href="mailto:${E(SITE.email)}">${E(SITE.email)}</a>` : ''].filter(Boolean).join(' · ');
const dataBR = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
const msgErro = e => { const m = String(e && (e.code || e.message) || e); if (/duplicate key|unique/i.test(m)) return 'Esse nome de usuário já existe.'; if (/check constraint.*usuario/i.test(m)) return 'O usuário deve ter de 3 a 40 letras minúsculas, sem espaços.'; if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.'; return ERROS[m] || m; };
async function rpc(fn, args) {
  if (window.QH_MOCK) return window.QH_MOCK(fn, args || {});
  const r = await fetch(WEB.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: WEB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
  if (!r.ok) { const m = (j && (j.message || j.hint)) || t || r.statusText; const e = new Error(m); e.code = m; throw e; }
  return j;
}
const Auth = {
  token: null, eu: null,
  ler() { try { return localStorage.getItem('qh.token'); } catch (e) { return null; } },
  gravar(t) { try { t ? localStorage.setItem('qh.token', t) : localStorage.removeItem('qh.token'); } catch (e) { } },
  async garantir() {
    const t = Auth.token || Auth.ler();
    if (t) { try { Auth.eu = await rpc('quadro_eu', { p_token: t }); Auth.token = t; } catch (e) { Auth.token = null; Auth.gravar(null); } }
    if (!Auth.token) await Auth.tela();
    if (Auth.eu.dono) { location.href = '../admin/'; await new Promise(() => { }); }
    if (Auth.eu.trocar_senha) await Auth.trocaObrigatoria();
    Auth.rodape();
  },
  tela(msg) {
    return new Promise(res => {
      let el = $('login'); if (!el) { el = document.createElement('div'); el.id = 'login'; document.body.appendChild(el); }
      el.className = 'ov center'; el.hidden = false; el.style.background = 'var(--brand-bg)';
      el.innerHTML = `<form class="modal" id="fLogin" style="width:min(400px,94vw)"><div class="row" style="gap:12px;margin-bottom:14px">${document.querySelector('.logo svg').outerHTML.replace('opacity=".14"', 'opacity=".9" fill="#1f3a68"')}<div><h2>Quadro de Horários</h2><p class="hint" style="margin:2px 0 0">${E(S.config.escola || 'Gestão escolar')}</p></div></div>
        <label class="f">Usuário<input type="text" id="lU" autocomplete="username" autocapitalize="none" required></label>
        <label class="f" style="margin-top:10px">Senha<input type="password" id="lS" autocomplete="current-password" required></label>
        <p id="lMsg" style="color:var(--bad);min-height:20px;margin:10px 0 4px">${E(msg || '')}</p>
        <button class="btn pri" style="width:100%;justify-content:center" id="lBtn">Entrar</button>
        <p class="hint" style="margin-top:12px">Esqueceu a senha? Peça ao administrador da escola. Se você é o administrador, fale com o suporte${contato() ? ': ' + contato() : ''}.</p>
        <div class="card" style="margin-top:12px;padding:12px;text-align:center"><b>Sua escola ainda não usa?</b><br><button type="button" class="btn acc" style="margin-top:8px" id="lCriar">Criar conta grátis · ${SITE.teste_dias || 15} dias</button></div></form>`;
      $('lU').focus();
      $('lCriar').onclick = () => Auth.cadastro(el, res);
      $('fLogin').onsubmit = async ev => {
        ev.preventDefault(); $('lBtn').disabled = true; $('lMsg').textContent = '';
        try {
          const r = await rpc('quadro_login', { p_usuario: $('lU').value.trim(), p_senha: $('lS').value });
          if (r.dono) { Auth.gravar(r.token); location.href = '../admin/'; return; }
          Auth.token = r.token; Auth.eu = r; Auth.gravar(r.token); el.hidden = true; el.innerHTML = ''; res();
        } catch (e) { $('lMsg').textContent = msgErro(e); $('lBtn').disabled = false; }
      };
      if (/^#criar/.test(location.hash)) Auth.cadastro(el, res);
    });
  },
  cadastro(el, res) {
    el.innerHTML = `<form class="modal" id="fCad" style="width:min(520px,94vw)"><h2>Criar conta grátis</h2><p class="hint" style="margin:4px 0 12px">${SITE.teste_dias || 15} dias para testar com todos os recursos, sem cartão. Depois, se gostar, é só assinar.</p>
      <div class="grid" style="gap:10px"><label class="f">Nome da escola<input type="text" id="cE" required maxlength="120"></label>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px"><label class="f">Seu nome<input type="text" id="cR" required maxlength="120" autocomplete="name"></label><label class="f">Cidade/UF<input type="text" id="cC" maxlength="80" placeholder="ex.: Uberlândia/MG"></label></div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px"><label class="f">E-mail<input type="email" id="cM" required maxlength="160" autocomplete="email"></label><label class="f">WhatsApp<input type="tel" id="cT" maxlength="40" autocomplete="tel" placeholder="(34) 9…"></label></div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px"><label class="f">Usuário para entrar<input type="text" id="cU" required autocapitalize="none" autocomplete="username" placeholder="ex.: maria.silva"></label><label class="f">Senha (mín. 6)<input type="password" id="cS" required autocomplete="new-password"></label></div>
      <label class="row" style="align-items:flex-start"><input type="checkbox" id="cOk" required> <span class="hint" style="margin:0">Li e aceito os <a href="../termos.html" target="_blank" rel="noopener">termos de uso</a> e a <a href="../privacidade.html" target="_blank" rel="noopener">política de privacidade</a>.</span></label>
      <input type="text" id="cHp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"></div>
      <p id="cMsg" style="color:var(--bad);min-height:20px;margin:10px 0 4px"></p>
      <div class="row"><button type="button" class="btn" id="cVolta">Já tenho conta</button><span class="sp"></span><button class="btn pri" id="cBtn">Criar conta e entrar</button></div></form>`;
    $('cE').focus();
    $('cVolta').onclick = () => { history.replaceState(null, '', location.pathname); Auth.tela().then(res); };
    $('fCad').onsubmit = async ev => {
      ev.preventDefault(); if ($('cHp').value) return;
      const usu = $('cU').value.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(usu)) return $('cMsg').textContent = ERROS.USUARIO_INVALIDO;
      $('cBtn').disabled = true; $('cMsg').textContent = '';
      try {
        const r = await rpc('quadro_cadastrar_escola', { p_escola: $('cE').value, p_responsavel: $('cR').value, p_email: $('cM').value, p_telefone: $('cT').value, p_cidade: $('cC').value, p_usuario: usu, p_senha: $('cS').value });
        const nomeEsc = $('cE').value.trim();
        Auth.token = r.token; Auth.eu = r; Auth.gravar(r.token); el.hidden = true; el.innerHTML = '';
        S = Store.vazio(); S.config.escola = nomeEsc; UI.boasVindas = true;
        history.replaceState(null, '', location.pathname + '#painel'); res();
      } catch (e) { $('cMsg').textContent = msgErro(e); $('cBtn').disabled = false; }
    };
  },
  trocaObrigatoria() {
    return new Promise(res => {
      modal(`<h2>Crie sua senha</h2><p class="hint">É o seu primeiro acesso (ou a senha foi redefinida). Escolha uma senha pessoal, com pelo menos 6 caracteres.</p>
      <form id="fTroca" class="grid" style="margin-top:12px"><label class="f">Senha atual (a que você recebeu)<input type="password" id="tA" autocomplete="current-password" required></label><label class="f">Nova senha<input type="password" id="tN" autocomplete="new-password" required></label><label class="f">Repita a nova senha<input type="password" id="tR" autocomplete="new-password" required></label>
      <p id="tMsg" style="color:var(--bad);min-height:20px;margin:0"></p><button class="btn pri">Salvar senha</button></form>`);
      UI.travado = true;
      $('fTroca').onsubmit = async ev => {
        ev.preventDefault();
        if ($('tN').value !== $('tR').value) return $('tMsg').textContent = 'As senhas não conferem.';
        try { await rpc('quadro_trocar_senha', { p_token: Auth.token, p_atual: $('tA').value, p_nova: $('tN').value }); Auth.eu.trocar_senha = false; UI.travado = false; $('ovm').hidden = true; toast('Senha criada.'); res(); }
        catch (e) { $('tMsg').textContent = msgErro(e); }
      };
    });
  },
  rodape() { const s = $('save'); if (!$('quem')) { const d = document.createElement('div'); d.id = 'quem'; d.style.cssText = 'margin-top:6px;display:flex;gap:8px;align-items:center'; s.appendChild(d); } $('quem').innerHTML = `<span style="opacity:.85">${E(Auth.eu.nome)}</span><button class="btn sm ghost" style="color:#fff;border-color:rgba(255,255,255,.3);min-height:30px;margin-left:auto" id="bSair">Sair</button>`; $('bSair').onclick = async () => { try { await P.flush(); await rpc('quadro_sair', { p_token: Auth.token }); } catch (e) { } Auth.token = null; Auth.gravar(null); location.reload(); }; }
};

/* ---------------- persistência ---------------- */
const WEB = window.QH_SUPA || null;
async function cap(nome) {
  if (WEB) return null;
  for (let i = 0; i < 20 && !(window.claude && window.claude.use); i++) await new Promise(r => setTimeout(r, 100));
  if (!(window.claude && window.claude.use)) return null;
  try { return await Promise.race([window.claude.use(nome), new Promise(r => setTimeout(() => r(null), 10000))]); } catch (e) { return null; }
}
const DOCS = ['config', 'professores', 'turmas', 'disciplinas', 'atribs', 'grade'];
const P = {
  db: null, dirty: new Set(), timer: null, writing: false, last: {}, ok: true,
  pack(k) { return k === 'grade' ? { grade: S.grade, fixas: S.fixas } : S[k]; },
  chave() { const id = WEB && Auth.eu?.escola?.id; return 'quadroHorarios.v1' + (id && id !== 1 ? '.e' + id : ''); },
  somenteLeitura() { return !!(WEB && Auth.eu?.escola && !Auth.eu.escola.liberada); },
  local() { try { localStorage.setItem(P.chave(), JSON.stringify(S)); } catch (e) { } },
  status(cls, txt) { const s = $('save'); s.className = 'save ' + cls; s.querySelector('span').textContent = txt; },
  mark(...ks) { ks.forEach(k => P.dirty.add(k)); P.local(); if (P.somenteLeitura()) { P.status('err', 'Somente leitura — acesso vencido'); return; } P.status('pend', 'Alterações não salvas…'); clearTimeout(P.timer); P.timer = setTimeout(P.flush, 700); },
  async flush() {
    if (P.writing) { P.timer = setTimeout(P.flush, 400); return; }
    if (WEB) return P.flushWeb();
    if (!P.db) { P.dirty.clear(); P.status('', 'Salvo neste navegador'); return; }
    P.writing = true;
    try {
      for (const k of [...P.dirty]) {
        P.dirty.delete(k);
        const v = JSON.stringify(P.pack(k)); if (P.last[k] === v) continue;
        await P.db.doc('escola/' + k).set({ v, em: new Date().toISOString() }); P.last[k] = v;
      }
      P.status('', 'Tudo salvo · ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      P.status('err', e && e.code === 'quota_exceeded' ? 'Limite de armazenamento atingido' : 'Sem conexão — salvo só neste navegador');
      toast('Não consegui salvar no banco de dados (' + (e.code || e.message) + '). As alterações ficam neste navegador.');
    }
    P.writing = false;
    if (P.dirty.size) P.timer = setTimeout(P.flush, 400);
  },
  async flushWeb() {
    P.writing = true;
    try {
      for (const k of [...P.dirty]) {
        const v = JSON.stringify(P.pack(k)); if (P.last[k] === v) { P.dirty.delete(k); continue; }
        await rpc('quadro_salvar', { p_token: Auth.token, p_doc: k, p_v: P.pack(k) }); P.last[k] = v; P.dirty.delete(k);
      }
      P.status('', 'Tudo salvo · ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      const m = msgErro(e);
      if (/ASSINATURA_VENCIDA/.test(e.code || e.message)) { P.writing = false; if (Auth.eu?.escola) Auth.eu.escola.liberada = false; P.status('err', 'Somente leitura — acesso vencido'); render(); toast(m, 7000); return; }
      if (/SESSAO_INVALIDA/.test(e.code || e.message)) { P.writing = false; P.status('err', 'Sessão expirada'); Auth.token = null; Auth.gravar(null); await Auth.tela(ERROS.SESSAO_INVALIDA); Auth.rodape(); P.timer = setTimeout(P.flush, 100); return; }
      P.status('err', 'Não salvou no servidor — guardado neste navegador'); toast('Não consegui salvar no servidor: ' + m + ' Vou tentar de novo.', 5000);
      P.writing = false; clearTimeout(P.timer); P.timer = setTimeout(P.flush, 8000); return;
    }
    P.writing = false;
    if (P.dirty.size) P.timer = setTimeout(P.flush, 400);
  },
  async loadWeb(local) {
    P.status('pend', 'Conectando ao servidor…');
    await Auth.garantir();
    try { local = JSON.parse(localStorage.getItem(P.chave()) || 'null'); } catch (e) { local = null; }
    if (UI.boasVindas) local = null;
    try {
      const got = await rpc('quadro_ler', { p_token: Auth.token });
      if (got && Object.keys(got).length) {
        const base = Store.vazio();
        for (const k of DOCS) { if (!got[k]) continue; const v = got[k].v; P.last[k] = JSON.stringify(v); if (k === 'grade') { base.grade = v.grade || {}; base.fixas = v.fixas || {}; } else base[k] = v; }
        S = base; const ult = Object.values(got).map(x => x.em).sort().pop(), por = Object.values(got).find(x => x.em === ult)?.por;
        P.status('', 'Dados do servidor' + (por ? ' · última alteração: ' + por : ''));
      } else if (local && local.turmas && local.turmas.length) { S = local; P.mark(...DOCS); }
      else if (UI.boasVindas) { P.mark('config'); }
      else P.status('', 'Servidor conectado');
    } catch (e) { if (local) S = local; P.status('err', 'Servidor indisponível — usando este navegador'); toast(msgErro(e), 5000); }
    if (P.somenteLeitura()) P.status('err', 'Somente leitura — acesso vencido');
    normaliza();
    if (!S.config.escola && Auth.eu?.escola?.nome) S.config.escola = Auth.eu.escola.nome;
  },
  async load() {
    let local = null; try { local = JSON.parse(localStorage.getItem('quadroHorarios.v1') || 'null'); } catch (e) { }
    if (WEB) return P.loadWeb(local);
    let db = null;
    db = await cap('db');
    P.db = db;
    if (db) {
      try {
        const got = await Promise.race([Promise.all(DOCS.map(k => db.doc('escola/' + k).get())), new Promise((_, j) => setTimeout(() => j(new Error('tempo')), 10000))]);
        const any = got.some(g => g.exists);
        if (any) {
          const base = Store.vazio();
          got.forEach((g, i) => { const k = DOCS[i]; if (!g.exists) return; const v = JSON.parse(g.data().v); P.last[k] = g.data().v; if (k === 'grade') { base.grade = v.grade || {}; base.fixas = v.fixas || {}; } else base[k] = v; });
          S = base; P.status('', 'Dados carregados do banco');
        } else if (local && local.turmas && local.turmas.length) { S = local; P.mark(...DOCS); }
        else P.status('', 'Banco de dados pronto');
      } catch (e) { if (local) S = local; P.status('err', 'Banco indisponível — usando este navegador'); }
    } else { if (local) S = local; P.status('', 'Salvo neste navegador'); }
    normaliza();
  }
};
function normaliza() {
  const v = Store.vazio();
  S.config = Object.assign(v.config, S.config || {}); S.config.prefs = Object.assign(v.config.prefs, S.config.prefs || {});
  for (const k of ['professores', 'turmas', 'disciplinas', 'atribs']) S[k] = S[k] || [];
  S.grade = S.grade || {}; S.fixas = S.fixas || {};
  S.professores.forEach(p => p.indisp = p.indisp || []);
  S.config.regras = S.config.regras || [];
  // atividades complementares não entram na grade (pedido da escola): remove uma vez dos dados já importados
  if (S.config.acFora === undefined) {
    S.config.acFora = true;
    const acs = new Set(S.disciplinas.filter(d => U.ehAC(d.nome)).map(d => d.id));
    if (acs.size) {
      const antes = {}; S.professores.forEach(p => antes[p.id] = S.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + a.aulas, 0));
      S.atribs = S.atribs.filter(a => !acs.has(a.disc)); S.disciplinas = S.disciplinas.filter(d => !acs.has(d.id));
      S.professores.forEach(p => { const novo = S.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + a.aulas, 0); if (p.carga == null || p.carga === antes[p.id]) p.carga = novo; });
      for (const t of S.turmas) { const dem = S.atribs.filter(a => a.turma === t.id).reduce((s, a) => s + a.aulas, 0), max = S.config.turnos[t.turno]?.horarios.length || t.aulasDia, dias = Math.min(t.dias || S.config.dias.length, S.config.dias.length); t.aulasDia = Math.max(1, Math.min(max, Math.ceil(dem / dias))); }
      UI.migrou = acs.size;
    }
  }
  // Educação Física não tem horário no noturno (pedido da escola): remove uma vez dos dados já importados
  if (S.config.efNoturnoFora === undefined) {
    S.config.efNoturnoFora = true;
    const ef = new Set(S.disciplinas.filter(d => U.ehEF(d.nome)).map(d => d.id)), tn = new Set(S.turmas.filter(t => t.turno === 'N').map(t => t.id));
    const sai = S.atribs.filter(a => ef.has(a.disc) && tn.has(a.turma));
    if (sai.length) {
      const antes = {}; S.professores.forEach(p => antes[p.id] = S.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + a.aulas, 0));
      const ids = new Set(sai.map(a => a.id)); S.atribs = S.atribs.filter(a => !ids.has(a.id));
      S.disciplinas = S.disciplinas.filter(d => !ef.has(d.id) || S.atribs.some(a => a.disc === d.id));
      S.professores.forEach(p => { const novo = S.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + a.aulas, 0); if (p.carga == null || p.carga === antes[p.id]) p.carga = novo; });
      UI.migrouEF = sai.length;
    }
  }
  const ids = new Set(S.atribs.map(a => a.id));
  for (const [tid, g] of Object.entries(S.grade)) for (const [k, v] of Object.entries(g)) if (!ids.has(v)) { delete g[k]; delete S.fixas[tid + '|' + k]; }
  for (const t of S.turmas) { const max = S.config.turnos[t.turno]?.horarios.length; if (max && t.aulasDia > max) t.aulasDia = max; }
  // aulas que ficaram fora do horário da turma (após reduzir aulas por dia) voltam para "a distribuir"
  if (UI.migrou) for (const t of S.turmas) { const g = S.grade[t.id] || {}, nd = Math.min(t.dias || S.config.dias.length, S.config.dias.length); for (const k of Object.keys(g)) { const [d, x] = k.split('-').map(Number); if (x >= t.aulasDia || d >= nd) { delete g[k]; delete S.fixas[t.id + '|' + k]; } } }
}
function recalc() { M = Modelo(S); PROBS = validar(S); const n = PROBS.filter(p => p.grav >= 2).length; const b = $('nConf'); b.hidden = !n; b.textContent = n; const np = PROBS.filter(p => p.tipo === 'regra').length, bp = $('nPed'); bp.hidden = !np; bp.textContent = np; $('escNome').textContent = S.config.escola || 'Gestão escolar'; }
function mudou(...ks) { recalc(); P.mark(...ks); }
function snap() { UI.undo.push(JSON.stringify({ grade: S.grade, fixas: S.fixas })); if (UI.undo.length > 40) UI.undo.shift(); }
function desfazer() { const s = UI.undo.pop(); if (!s) return toast('Nada para desfazer.'); const o = JSON.parse(s); S.grade = o.grade; S.fixas = o.fixas; mudou('grade'); render(); toast('Desfeito.'); }

/* ---------------- utilidades de interface ---------------- */
let tt; function toast(m, ms = 3200) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, ms); }
function drawer(html, wide) { const d = $('drawer'); d.className = 'drawer' + (wide ? ' wide' : ''); d.innerHTML = html; $('ov').hidden = false; d.querySelector('input,select,button')?.focus(); }
function fecha() { if (UI.travado) return; $('ov').hidden = true; $('ovm').hidden = true; }
function modal(html) { $('modal').innerHTML = html; $('ovm').hidden = false; $('modal').querySelector('button')?.focus(); }
function confirma(msg, ok, rotulo = 'Confirmar', perigo) {
  modal(`<h2>Confirmar</h2><p>${msg}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-x>Cancelar</button><button class="btn ${perigo ? 'acc' : 'pri'}" id="okC">${rotulo}</button></div>`);
  $('okC').onclick = () => { fecha(); ok(); };
}
$('ov').addEventListener('click', e => { if (e.target.id === 'ov' || e.target.closest('[data-x]')) fecha(); });
$('ovm').addEventListener('click', e => { if (e.target.id === 'ovm' || e.target.closest('[data-x]')) fecha(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecha();
  if (ROUTE !== 'grade' || !$('ov').hidden || !$('ovm').hidden || /input|select|textarea/i.test(document.activeElement.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); desfazer(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && UI.sel) { copiar(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && UI.sel) { colar(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && UI.sel) { e.preventDefault(); removerAula(UI.sel.t, UI.sel.d, UI.sel.a); }
  else if (UI.sel && UI.modo === 'turma' && /^Arrow/.test(e.key)) {
    e.preventDefault(); const t = M.turma[UI.sel.t]; let { d, a } = UI.sel;
    if (e.key === 'ArrowLeft') d = Math.max(0, d - 1); if (e.key === 'ArrowRight') d = Math.min(M.diasT(t) - 1, d + 1);
    if (e.key === 'ArrowUp') a = Math.max(0, a - 1); if (e.key === 'ArrowDown') a = Math.min(t.aulasDia - 1, a + 1);
    UI.sel = { t: t.id, d, a }; render();
  } else if (e.key === 'Enter' && UI.sel) editarCelula(UI.sel.t, UI.sel.d, UI.sel.a);
});
async function baixar(nome, dados, tipo) {
  try {
    const dl = await cap('downloads');
    if (dl) { await dl.save({ filename: nome, data: new Blob([dados]) }); toast('Arquivo pronto: ' + nome); return; }
  } catch (e) { if (e && e.code === 'declined') return toast('Download cancelado.'); }
  try { const u = URL.createObjectURL(new Blob([dados], { type: tipo || 'application/octet-stream' })); const a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); toast('Download iniciado: ' + nome); }
  catch (e) { toast('Este visualizador não permite downloads.'); }
}
const discDe = aid => M.disc[M.atr[aid]?.disc];
const profDe = aid => M.prof[M.atr[aid]?.prof];
const nomeCurto = n => U.primeiroNome(n || '');
const contagem = () => M.contagem();
function conflitosSet() { const s = new Set(); for (const p of PROBS) { if (p.tipo === 'choque') p.cells.forEach(c => s.add(c.join('|'))); if (p.tipo === 'indisp' || p.tipo === 'fora') s.add([p.turma, p.d, p.a].join('|')); } return s; }
function ordTurmas() { const o = { M: 0, V: 1, N: 2 }; return S.turmas.slice().sort((a, b) => (o[a.turno] ?? 3) - (o[b.turno] ?? 3) || (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt')); }
const turnoNome = k => S.config.turnos[k]?.nome || k;
/* intervalo (recreio/almoço) que fica logo antes da aula de índice a */
function intervaloAntes(tu, a) { const c = S.config.turnos[tu]; if (!c || !a) return null; const h = c.horarios[a], ant = c.horarios[a - 1]; return (c.intervalos || []).find(iv => iv.fim <= h && iv.ini >= ant) || null; }
const txtIntervalo = iv => `${iv.nome} · ${iv.ini}–${iv.fim}`;

/* ---------------- roteamento ---------------- */
const VIEWS = {};
function avisoConta() {
  const e = WEB && Auth.eu?.escola; if (!e) return '';
  const adm = Auth.eu.papel === 'admin', bot = adm ? ' <a href="#ajustes" data-act="verAssinatura">Ver como assinar</a>' : ' Avise o administrador da escola.';
  const st = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-radius:12px;margin-bottom:14px;font-size:14px;';
  if (!e.liberada) return `<div role="alert" style="${st}background:color-mix(in srgb,var(--bad) 12%,var(--panel));border:1px solid var(--bad)"><b>${e.bloqueada ? 'Acesso suspenso.' : e.em_teste ? 'O teste grátis terminou.' : 'A assinatura venceu em ' + dataBR(e.valido_ate) + '.'}</b> Os dados continuam aqui para consulta, impressão e exportação, mas as alterações não são salvas.${bot}</div>`;
  if (e.em_teste) return `<div style="${st}background:color-mix(in srgb,var(--warn) 12%,var(--panel));border:1px solid color-mix(in srgb,var(--warn) 50%,var(--line))"><b>Teste grátis:</b> ${e.dias === 0 ? 'último dia' : e.dias === 1 ? 'falta 1 dia' : 'faltam ' + e.dias + ' dias'} (até ${dataBR(e.valido_ate)}).${bot}</div>`;
  if (e.dias <= 7) return `<div style="${st}background:color-mix(in srgb,var(--warn) 12%,var(--panel));border:1px solid color-mix(in srgb,var(--warn) 50%,var(--line))"><b>A assinatura vence em ${dataBR(e.valido_ate)}</b> (${e.dias === 0 ? 'hoje' : e.dias === 1 ? 'amanhã' : 'em ' + e.dias + ' dias'}).${bot}</div>`;
  return '';
}
function cardAssinatura() {
  const e = WEB && Auth.eu?.escola; if (!e || Auth.eu.papel !== 'admin') return '';
  const sit = !e.liberada ? `<span class="tag bad">${e.bloqueada ? 'suspensa' : 'vencida'}</span>` : e.em_teste ? '<span class="tag warn">teste grátis</span>' : '<span class="tag ok">ativa</span>';
  return `<div class="card grid" id="assinatura"><h2>Assinatura</h2><p style="margin:0">Situação: ${sit}${e.valido_ate && e.valido_ate < '2090' ? ` · ${e.liberada ? 'válida até' : 'venceu em'} <b>${dataBR(e.valido_ate)}</b>` : ''}</p>
   <p class="hint" style="margin:0">Para assinar ou renovar, fale com ${E(SITE.responsavel || 'o suporte')}${contato() ? ': ' + contato() : ''}. A liberação é feita no mesmo dia, sem perder nada do que já foi feito.</p></div>`;
}
function render() {
  const h = (location.hash || '#painel').slice(1); ROUTE = VIEWS[h] ? h : 'painel';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === ROUTE));
  $('main').innerHTML = avisoConta() + VIEWS[ROUTE]();
  (VIEWS[ROUTE].after || (() => { }))();
  $('side').classList.remove('open'); $('mob').setAttribute('aria-expanded', 'false');
}
window.addEventListener('hashchange', () => { UI.sel = null; render(); window.scrollTo(0, 0); });
$('mob').onclick = () => { const o = $('side').classList.toggle('open'); $('mob').setAttribute('aria-expanded', o); };
$('main').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) ACT[b.dataset.act]?.(b.dataset, b, e); });
$('drawer').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) ACT[b.dataset.act]?.(b.dataset, b, e); });
$('modal').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) ACT[b.dataset.act]?.(b.dataset, b, e); });
const ACT = {};

/* ---------------- PAINEL ---------------- */
VIEWS.painel = () => {
  const cont = contagem(), tot = S.atribs.filter(a => a.prof).reduce((s, a) => s + a.aulas, 0), dist = S.atribs.filter(a => a.prof).reduce((s, a) => s + Math.min(a.aulas, cont[a.id] || 0), 0);
  const pct = tot ? Math.round(dist / tot * 100) : 0, conf = PROBS.filter(p => p.tipo === 'choque' || p.tipo === 'indisp').length;
  const pend = S.professores.map(p => { const at = S.atribs.filter(a => a.prof === p.id), prev = at.reduce((s, a) => s + a.aulas, 0), g = at.reduce((s, a) => s + Math.min(a.aulas, cont[a.id] || 0), 0); return { p, prev, g }; }).filter(x => x.g < x.prev);
  const semProf = S.atribs.filter(a => !a.prof).reduce((s, a) => s + a.aulas, 0);
  if (!S.turmas.length) return `<div class="top"><div><h1>Bem-vindo ao Quadro de Horários</h1><p>Comece importando o quadro de distribuição de aulas da escola.</p></div></div>
    <div class="card" style="padding:28px"><ol class="steps"><li>Importe o quadro de distribuição (.xlsx, .xlsm ou .csv)</li><li>Confira professores, turmas e quantidades</li><li>Gere o horário automaticamente</li><li>Ajuste manualmente arrastando as aulas</li><li>Valide e exporte em PDF ou Excel</li></ol><p style="margin-top:20px"><a class="btn pri" href="#importar">Importar quadro de distribuição</a></p></div>`;
  const passos = [['Quadro importado', S.atribs.length > 0], ['Cadastros conferidos', S.turmas.length > 0 && !PROBS.some(p => p.tipo === 'capacidade')], ['Horário gerado', dist > 0], ['Todas as aulas na grade', pct === 100], ['Sem conflitos', dist > 0 && conf === 0]];
  const linhasT = ordTurmas().map(t => { const at = S.atribs.filter(a => a.turma === t.id && a.prof), prev = at.reduce((s, a) => s + a.aulas, 0), g = at.reduce((s, a) => s + Math.min(a.aulas, cont[a.id] || 0), 0), p = prev ? Math.round(g / prev * 100) : 0; return `<tr><td><a href="#grade" data-act="abrirTurma" data-t="${t.id}">${E(t.nome)}</a></td><td class="muted">${E(turnoNome(t.turno))}</td><td style="width:40%"><div class="bar"><i class="${p === 100 ? 'full' : ''}" style="width:${p}%"></i></div></td><td class="num">${g}/${prev}</td></tr>`; }).join('');
  return `<div class="top"><div><h1>${pct === 100 && !conf ? 'Horário completo e sem conflitos' : pct ? `Grade ${pct}% preenchida${conf ? ` · ${conf} conflito${conf > 1 ? 's' : ''}` : ''}` : 'Pronto para gerar o horário'}</h1><p>${E(S.config.escola)} · ${S.config.ano || ''}</p></div>
    <div class="row"><button class="btn acc" data-act="gerar">Gerar horário automaticamente</button><a class="btn" href="#grade">Abrir grade</a></div></div>
  <div class="grid kpis">
    <div class="card kpi"><small>Professores</small><b>${S.professores.length}</b><span>${S.atribs.filter(a => a.prof).length} atribuições</span></div>
    <div class="card kpi"><small>Turmas</small><b>${S.turmas.length}</b><span>${Object.keys(S.config.turnos).filter(k => S.turmas.some(t => t.turno === k)).map(turnoNome).join(' · ')}</span></div>
    <div class="card kpi"><small>Disciplinas</small><b>${S.disciplinas.length}</b><span>em uso nas turmas</span></div>
    <div class="card kpi"><small>Aulas semanais</small><b>${tot}</b><span>${semProf ? semProf + ' sem professor' : 'todas com professor'}</span></div>
    <div class="card kpi ${pct === 100 ? 'ok' : ''}"><small>Preenchimento</small><b>${pct}%</b><span>${dist} de ${tot} aulas na grade</span></div>
    <div class="card kpi ${pend.length ? 'bad' : 'ok'}"><small>Cargas pendentes</small><b>${pend.length}</b><span>professores com aulas fora da grade</span></div>
    <div class="card kpi ${conf ? 'bad' : 'ok'}"><small>Conflitos</small><b>${conf}</b><span><a href="#validacao">ver validação</a></span></div>
  </div>
  <div class="hero" style="margin-top:14px">
    <div class="card"><div class="row"><h2>Preenchimento por turma</h2><span class="sp"></span><span class="hint">clique para abrir a grade da turma</span></div><div class="scroll" style="margin-top:8px"><table class="stack"><thead><tr><th>Turma</th><th>Turno</th><th>Progresso</th><th class="num">Aulas</th></tr></thead><tbody>${linhasT}</tbody></table></div></div>
    <div class="grid" style="align-content:start">
      <div class="card"><h2>Etapas</h2><ol class="steps" style="margin-top:12px">${passos.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${t}</li>`).join('')}</ol></div>
      <div class="card"><h2>Cargas pendentes</h2>${pend.length ? `<table style="margin-top:8px"><tbody>${pend.slice(0, 12).map(x => `<tr><td><a href="#grade" data-act="abrirProf" data-p="${x.p.id}">${E(x.p.nome)}</a></td><td class="num">${x.g}/${x.prev}</td></tr>`).join('')}</tbody></table>${pend.length > 12 ? `<p class="hint">e mais ${pend.length - 12}…</p>` : ''}` : '<p class="muted">Nenhuma: todos os professores estão com a carga completa na grade.</p>'}</div>
    </div>
  </div>`;
};
ACT.abrirTurma = d => { UI.modo = 'turma'; UI.turma = d.t; location.hash = '#grade'; render(); };
ACT.abrirProf = d => { UI.modo = 'prof'; UI.prof = d.p; location.hash = '#grade'; render(); };

/* ---------------- IMPORTAR ---------------- */
VIEWS.importar = () => {
  const im = UI.import;
  const topo = `<div class="top"><div><h1>Importar quadro de distribuição</h1><p>Excel (.xlsx/.xlsm) no formato do quadro de distribuição de aulas, CSV ou backup (.json). Nada é gravado antes da conferência.</p></div></div>
  <div class="card row"><button class="btn pri" data-act="escolherArq">Escolher arquivo…</button><span class="hint">ou arraste o arquivo para esta área</span><span class="sp"></span><button class="btn sm ghost" data-act="modeloCsv">Baixar modelo CSV</button><button class="btn sm ghost" data-act="exportDados">Exportar dados atuais (Excel)</button></div>`;
  if (!im) return topo + `<div class="card" style="margin-top:14px"><h3>Como o arquivo é lido</h3><ul class="muted"><li>No quadro de distribuição (planilha com a coluna “PROFESSORES / DISCIPLINA”), cada linha de disciplina traz as aulas por turma e as linhas abaixo dela são os professores; o “X” (ou outra letra, como “Z”) marca as turmas de cada professor.</li><li>Turmas, turnos (vespertino, matutino, noturno) e quantidades vêm do cabeçalho da planilha.</li><li>Professores com mais de um cargo (mesmo MASP) viram um só cadastro.</li><li>Quando duas linhas marcam a mesma disciplina e turma (ex.: substituição), você escolhe quem fica.</li><li>CSV: colunas <code>professor; disciplina; turma; turno; aulas</code>.</li></ul></div>`;
  if (im.erro) return topo + `<div class="card" style="margin-top:14px"><h2>Não consegui ler o arquivo</h2><p>${E(im.erro)}</p></div>`;
  const pr = im.prop, inc = pr.turmas.filter(t => t.incluir);
  const nAtr = pr.atr.filter(a => inc.some(t => t.col === a.col)).length;
  const profs = new Set(pr.atr.filter(a => inc.some(t => t.col === a.col)).map(a => (String(a.masp || '').replace(/\D/g, '') || U.norm(a.prof)))).size;
  return topo + `<div class="card" style="margin-top:14px"><div class="row"><div><h2>Conferência: ${E(im.nome)}</h2><p class="hint">${im.aba ? 'Aba “' + E(im.aba) + '” · ' : ''}${inc.length} turmas, ${profs} professores, ${nAtr} marcações, ${pr.dups.length} duplicidades para resolver</p></div><span class="sp"></span>
    ${im.abas && im.abas.length > 1 ? `<label class="f">Aba da planilha<select id="impAba">${im.abas.map(a => `<option ${a === im.aba ? 'selected' : ''}>${E(a)}</option>`).join('')}</select></label>` : ''}
    <button class="btn" data-act="cancelaImp">Cancelar</button><button class="btn acc" data-act="confirmaImp">Confirmar importação</button></div>
    ${(() => { const n = pr.discs.filter(d => U.ehAC(d.nome) && d.total > 0).length; return n && S.config.acFora !== false ? `<p class="hint" style="margin-top:8px">${n} atividades complementares ficam fora da grade (não entram no quadro de horários).</p>` : ''; })()}
    <p class="hint" style="margin-top:8px">Ao confirmar, os cadastros atuais e a grade são substituídos pelos dados conferidos abaixo. As configurações de horários são mantidas.</p></div>
  <div class="card" style="margin-top:14px"><h2>Turmas identificadas</h2><div class="tbl" style="margin-top:10px"><table class="stack"><thead><tr><th>Incluir</th><th>Nome da turma</th><th>Turno</th><th class="num">Aulas na semana</th><th>Aulas por dia</th><th>Observação</th></tr></thead><tbody>
    ${pr.turmas.map((t, i) => `<tr><td><input type="checkbox" data-imp="incluir" data-i="${i}" ${t.incluir ? 'checked' : ''} aria-label="Incluir turma"></td><td><input type="text" data-imp="nome" data-i="${i}" value="${E(t.nome)}" style="width:100%"></td>
    <td><select data-imp="turno" data-i="${i}">${Object.entries(S.config.turnos).map(([k, v]) => `<option value="${k}" ${t.turno === k ? 'selected' : ''}>${E(v.nome)}</option>`).join('')}</select></td>
    <td class="num">${t.soma}</td><td><input type="number" min="1" max="12" data-imp="aulasDia" data-i="${i}" value="${t.aulasDia || Math.min(S.config.turnos[t.turno]?.horarios.length || 6, Math.max(1, Math.ceil(t.soma / S.config.dias.length)))}"></td><td class="muted">${E(t.motivo)}</td></tr>`).join('')}
  </tbody></table></div></div>
  ${pr.dups.length ? `<div class="card" style="margin-top:14px"><h2>Duplicidades: mais de um professor na mesma disciplina e turma</h2><p class="hint">Já deixei marcado o substituto quando a observação diz “substituindo”. Ajuste se precisar.</p><div class="tbl" style="margin-top:10px"><table class="stack"><thead><tr><th>Disciplina</th><th>Turma</th><th>Quem fica</th></tr></thead><tbody>
    ${pr.dups.map((d, i) => `<tr><td>${E(d.disc)}</td><td>${E(d.turma)}</td><td><select data-imp="dup" data-i="${i}" style="max-width:100%">${d.opcoes.map(o => `<option value="${o.linha}" ${o.linha === d.escolha ? 'selected' : ''}>${E(o.prof)}${o.obs ? ' — ' + E(o.obs.slice(0, 70)) : ''}</option>`).join('')}</select></td></tr>`).join('')}
  </tbody></table></div></div>` : ''}
  ${pr.semProf.length ? `<div class="card" style="margin-top:14px"><h2>Aulas previstas sem professor marcado</h2><p class="hint">Serão importadas como “sem professor”; defina o professor depois em Distribuição de aulas.</p><div class="row" style="margin-top:8px">${pr.semProf.filter(s => inc.some(t => t.col === s.col)).map(s => `<span class="tag">${E(s.disc)} · ${E((pr.turmas.find(t => t.col === s.col) || {}).nome || '')} · ${s.aulas}a</span>`).join('') || '<span class="muted">Nenhuma nas turmas incluídas.</span>'}</div></div>` : ''}
  <div class="card" style="margin-top:14px"><h2>Marcações por professor</h2><div class="tbl" style="margin-top:10px"><table class="stack"><thead><tr><th>Professor</th><th>Disciplina</th><th>Turma</th><th class="num">Aulas</th><th>Marca</th></tr></thead><tbody>
    ${pr.atr.filter(a => inc.some(t => t.col === a.col)).sort((a, b) => a.prof.localeCompare(b.prof, 'pt')).map(a => `<tr><td>${E(a.prof)}</td><td>${E(a.disc)}</td><td>${E((pr.turmas.find(t => t.col === a.col) || {}).nome)}</td><td class="num">${a.aulas || '<span class="tag warn">0</span>'}</td><td>${E(a.marca)}</td></tr>`).join('')}
  </tbody></table></div></div>`;
};
VIEWS.importar.after = () => {
  const dz = $('main'); dz.ondragover = e => { e.preventDefault(); }; dz.ondrop = e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) lerArquivo(f); };
  $('main').querySelectorAll('[data-imp]').forEach(el => el.onchange = () => {
    const pr = UI.import.prop, i = +el.dataset.i, k = el.dataset.imp;
    if (k === 'dup') pr.dups[i].escolha = +el.value;
    else if (k === 'incluir') { pr.turmas[i].incluir = el.checked; render(); }
    else if (k === 'aulasDia') pr.turmas[i].aulasDia = +el.value;
    else pr.turmas[i][k] = el.value;
  });
  const sa = $('impAba'); if (sa) sa.onchange = () => { const s = UI.import.sheets.find(x => x.name === sa.value); const pr = Importer.quadro(s); if (!pr) return toast('Essa aba não tem o formato do quadro de distribuição.'); UI.import.prop = pr; UI.import.aba = s.name; render(); };
};
ACT.escolherArq = () => { $('fileIn').value = ''; $('fileIn').click(); };
$('fileIn').onchange = e => { const f = e.target.files[0]; if (f) lerArquivo(f); };
async function lerArquivo(f) {
  location.hash = '#importar';
  try {
    const nome = f.name, ext = nome.split('.').pop().toLowerCase();
    if (ext === 'json') {
      const o = JSON.parse(await f.text()); if (!o.turmas || !o.atribs) throw new Error('O arquivo .json não é um backup deste sistema.');
      return confirma(`Restaurar o backup <b>${E(nome)}</b>? Os dados atuais serão substituídos (${o.turmas.length} turmas, ${o.professores.length} professores).`, () => { S = o; normaliza(); UI.undo = []; mudou(...DOCS); location.hash = '#painel'; render(); toast('Backup restaurado.'); }, 'Restaurar');
    }
    if (ext === 'csv' || ext === 'txt') { UI.import = { nome, prop: Importer.csv(await f.text()) }; return render(); }
    const sheets = await XLSX.read(await f.arrayBuffer());
    const cands = sheets.map(s => ({ s, pr: Importer.quadro(s) })).filter(x => x.pr);
    if (!cands.length) throw new Error('Não encontrei uma aba com o quadro de distribuição (cabeçalho “PROFESSORES / DISCIPLINA”). Para outros formatos, use o modelo CSV.');
    const best = cands.find(x => x.s.state === 'visible' && x.pr.atr.length) || cands[0];
    UI.import = { nome, sheets: cands.map(x => x.s), abas: cands.map(x => x.s.name), aba: best.s.name, prop: best.pr };
  } catch (e) { UI.import = { erro: e.message || String(e) }; }
  render();
}
ACT.cancelaImp = () => { UI.import = null; render(); };
ACT.confirmaImp = () => {
  const pr = UI.import.prop;
  const fazer = () => {
    const novo = Importer.montar(pr, S.config);
    novo.config = S.config; S = novo; normaliza(); UI.undo = []; UI.import = null; UI.turma = null; UI.prof = null;
    mudou(...DOCS); location.hash = '#painel'; render(); toast(`Importado: ${S.turmas.length} turmas, ${S.professores.length} professores, ${S.atribs.length} atribuições.`, 5000);
  };
  if (S.turmas.length) confirma('Substituir os cadastros e a grade atuais pelos dados conferidos?', fazer, 'Substituir e importar', true); else fazer();
};
ACT.modeloCsv = () => baixar('modelo_quadro_distribuicao.csv', '﻿professor;disciplina;turma;turno;aulas\nMaria Silva;Língua Portuguesa;6º Ano;Vespertino;5\nMaria Silva;Língua Portuguesa;7º Ano;Vespertino;5\nJoão Souza;Matemática;1º EM Regular 1;Matutino;4\n', 'text/csv');

/* ---------------- PROFESSORES ---------------- */
VIEWS.professores = () => {
  const cont = contagem(), q = U.norm(UI.qProf || '');
  const lin = S.professores.filter(p => !q || U.norm(p.nome).includes(q)).map(p => {
    const at = S.atribs.filter(a => a.prof === p.id), atr = at.reduce((s, a) => s + a.aulas, 0), g = at.reduce((s, a) => s + (cont[a.id] || 0), 0), prev = p.carga ?? atr;
    const ds = [...new Set(at.map(a => a.disc))].map(id => M.disc[id]).filter(Boolean);
    const st = g === prev && atr === prev ? '<span class="tag ok">completa</span>' : g > prev || atr > prev ? '<span class="tag bad">acima</span>' : '<span class="tag warn">pendente</span>';
    return `<tr><td><span class="dot" style="background:${p.cor}"></span> <a href="javascript:void 0" data-act="editProf" data-p="${p.id}"><b>${E(p.nome)}</b></a>${p.indisp.length ? ` <span class="tag" title="horários indisponíveis">${p.indisp.length} restrições</span>` : ''}</td><td>${E(p.masp)}</td>
      <td>${ds.map(d => `<span class="chip" style="background:${d.cor}" title="${E(d.nome)}">${E(d.sigla)}</span>`).join(' ')}</td><td class="num">${new Set(at.map(a => a.turma)).size}</td><td class="num">${prev}</td><td class="num">${atr}</td><td class="num">${g}</td><td>${st}</td>
      <td><button class="btn sm" data-act="abrirProf" data-p="${p.id}">Horário</button></td></tr>`;
  }).join('');
  return `<div class="top"><div><h1>Professores</h1><p>${S.professores.length} professores · carga prevista, atribuída e já colocada na grade.</p></div><div class="row"><input type="search" id="qProf" placeholder="Buscar professor" value="${E(UI.qProf || '')}"><button class="btn pri" data-act="editProf">Novo professor</button></div></div>
  <div class="tbl"><table class="stack"><thead><tr><th>Nome</th><th>MASP</th><th>Disciplinas</th><th class="num">Turmas</th><th class="num">Carga prevista</th><th class="num">Atribuída</th><th class="num">Na grade</th><th>Situação</th><th></th></tr></thead><tbody>${lin || '<tr><td colspan="9" class="empty">Nenhum professor cadastrado.</td></tr>'}</tbody></table></div>`;
};
VIEWS.professores.after = () => { const q = $('qProf'); q.oninput = () => { UI.qProf = q.value; const pos = q.selectionStart; render(); const n = $('qProf'); n.focus(); n.setSelectionRange(pos, pos); }; };
function tempos() { // todos os horários distintos, por turno
  const out = []; for (const [k, t] of Object.entries(S.config.turnos)) t.horarios.forEach((h, i) => out.push({ turno: k, h, i })); return out;
}
ACT.editProf = d => {
  const p = d.p ? M.prof[d.p] : { id: '', nome: '', masp: '', carga: null, indisp: [], obs: '', cor: U.palette[S.professores.length % U.palette.length] };
  const at = S.atribs.filter(a => a.prof === p.id), indisp = new Set(p.indisp);
  const turnosUsados = Object.keys(S.config.turnos);
  const av = turnosUsados.map(k => { const t = S.config.turnos[k]; return `<div style="margin-top:10px"><b style="font-size:13px">${E(t.nome)}</b><div class="av" style="grid-template-columns:56px repeat(${S.config.dias.length},minmax(0,1fr))"><span></span>${S.config.dias.map(x => `<small class="muted" style="text-align:center">${E(x.slice(0, 3))}</small>`).join('')}
    ${t.horarios.map(h => `<small class="muted">${h}</small>` + S.config.dias.map((x, di) => { const k2 = di + '|' + h; return `<button type="button" data-av="${k2}" class="${indisp.has(k2) ? 'x' : ''}" aria-pressed="${indisp.has(k2)}">${indisp.has(k2) ? '✕' : ''}</button>`; }).join('')).join('')}</div></div>`; }).join('');
  drawer(`<div class="row"><h2>${p.id ? 'Editar professor' : 'Novo professor'}</h2><span class="sp"></span><button class="btn sm ghost" data-x>Fechar</button></div>
  <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);margin-top:14px">
    <label class="f">Nome completo<input type="text" id="pNome" value="${E(p.nome)}" required></label>
    <label class="f">MASP<input type="text" id="pMasp" value="${E(p.masp)}"></label>
    <label class="f">Carga horária semanal prevista<input type="number" id="pCarga" min="0" max="60" value="${p.carga ?? at.reduce((s, a) => s + a.aulas, 0)}"></label>
    <label class="f">Cor<input type="color" id="pCor" value="${p.cor}" style="height:40px;width:100%"></label>
  </div>
  <label class="f" style="margin-top:10px">Restrições e observações<textarea id="pObs" placeholder="Ex.: não pode às sextas à noite; prefere aulas geminadas">${E(p.obs || '')}</textarea></label>
  <h3 style="margin-top:16px">Disponibilidade</h3><p class="hint">Clique nos horários em que o professor <b>não</b> pode dar aula. O gerador respeita essas restrições.</p>${av}
  ${p.id ? `<h3 style="margin-top:16px">Aulas atribuídas (${at.reduce((s, a) => s + a.aulas, 0)})</h3><table style="margin-top:6px"><tbody>${at.map(a => `<tr><td><span class="chip" style="background:${M.disc[a.disc]?.cor}">${E(M.disc[a.disc]?.sigla)}</span> ${E(M.disc[a.disc]?.nome)}</td><td>${E(M.turma[a.turma]?.nome)}</td><td class="num">${a.aulas}</td></tr>`).join('') || '<tr><td class="muted">Nenhuma. Atribua aulas em Distribuição de aulas.</td></tr>'}</tbody></table>` : ''}
  <div class="row" style="margin-top:18px">${p.id ? `<button class="btn danger" data-act="delProf" data-p="${p.id}">Excluir</button>` : ''}<span class="sp"></span><button class="btn" data-x>Cancelar</button><button class="btn pri" data-act="salvaProf" data-p="${p.id}">Salvar</button></div>`);
  $('drawer').querySelectorAll('[data-av]').forEach(b => b.onclick = () => { const on = !b.classList.contains('x'); b.classList.toggle('x', on); b.textContent = on ? '✕' : ''; b.setAttribute('aria-pressed', on); });
};
ACT.salvaProf = d => {
  const nome = $('pNome').value.trim(); if (!nome) return toast('Informe o nome do professor.');
  if (S.professores.some(p => p.id !== d.p && U.norm(p.nome) === U.norm(nome))) return toast('Já existe um professor com esse nome.');
  const carga = $('pCarga').value === '' ? null : Math.max(0, +$('pCarga').value);
  const indisp = [...$('drawer').querySelectorAll('[data-av].x')].map(b => b.dataset.av);
  let p = d.p ? M.prof[d.p] : null;
  if (!p) { p = { id: U.uid('p') }; S.professores.push(p); }
  Object.assign(p, { nome, masp: $('pMasp').value.trim(), carga, cor: $('pCor').value, obs: $('pObs').value, indisp });
  S.professores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  fecha(); mudou('professores'); render(); toast('Professor salvo.');
};
ACT.delProf = d => { const p = M.prof[d.p], n = S.atribs.filter(a => a.prof === p.id).length; confirma(`Excluir <b>${E(p.nome)}</b>? ${n ? `As ${n} atribuições dele ficarão sem professor e as aulas saem da grade.` : ''}`, () => { snap(); S.atribs.filter(a => a.prof === p.id).forEach(a => { a.prof = ''; tiraDaGrade(a.id); }); S.professores = S.professores.filter(x => x.id !== p.id); fecha(); mudou('professores', 'atribs', 'grade'); render(); }, 'Excluir', true); };
function tiraDaGrade(aid) { for (const g of Object.values(S.grade)) for (const [k, v] of Object.entries(g)) if (v === aid) delete g[k]; }

/* ---------------- TURMAS ---------------- */
VIEWS.turmas = () => {
  const cont = contagem();
  const lin = ordTurmas().map(t => {
    const at = S.atribs.filter(a => a.turma === t.id), dem = at.reduce((s, a) => s + a.aulas, 0), cap = t.aulasDia * M.diasT(t), g = at.reduce((s, a) => s + (cont[a.id] || 0), 0);
    return `<tr><td><input type="text" data-tu="nome" data-t="${t.id}" value="${E(t.nome)}" style="width:100%;min-width:160px" aria-label="Nome"></td><td><input type="text" data-tu="sigla" data-t="${t.id}" value="${E(t.sigla || '')}" style="width:120px" aria-label="Sigla"></td>
    <td><select data-tu="turno" data-t="${t.id}">${Object.entries(S.config.turnos).map(([k, v]) => `<option value="${k}" ${k === t.turno ? 'selected' : ''}>${E(v.nome)}</option>`).join('')}</select></td>
    <td><input type="number" min="1" max="${S.config.turnos[t.turno]?.horarios.length || 12}" data-tu="aulasDia" data-t="${t.id}" value="${t.aulasDia}" aria-label="Aulas por dia"></td>
    <td><input type="number" min="1" max="${S.config.dias.length}" data-tu="dias" data-t="${t.id}" value="${M.diasT(t)}" aria-label="Dias letivos"></td>
    <td class="num">${dem}</td><td class="num">${cap}</td><td class="num">${g}</td><td>${dem > cap ? '<span class="tag bad">faltam horários</span>' : g >= dem && dem ? '<span class="tag ok">completa</span>' : '<span class="tag warn">' + (dem - g) + ' a colocar</span>'}</td>
    <td class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="abrirTurma" data-t="${t.id}">Grade</button><button class="btn sm ghost danger" data-act="delTurma" data-t="${t.id}" aria-label="Excluir turma">Excluir</button></td></tr>`;
  }).join('');
  return `<div class="top"><div><h1>Turmas</h1><p>Edite direto na tabela. Aulas por dia limitam a grade de cada turma; os horários de cada turno ficam em Configurações.</p></div><button class="btn pri" data-act="novaTurma">Nova turma</button></div>
  <div class="tbl"><table class="stack"><thead><tr><th>Turma</th><th>Sigla</th><th>Turno</th><th>Aulas/dia</th><th>Dias letivos</th><th class="num">Aulas previstas</th><th class="num">Horários</th><th class="num">Na grade</th><th>Situação</th><th></th></tr></thead><tbody>${lin || '<tr><td colspan="10" class="empty">Nenhuma turma.</td></tr>'}</tbody></table></div>`;
};
VIEWS.turmas.after = () => $('main').querySelectorAll('[data-tu]').forEach(el => el.onchange = () => {
  const t = M.turma[el.dataset.t], k = el.dataset.tu; let v = el.value;
  if (k === 'nome' && !v.trim()) { toast('O nome não pode ficar vazio.'); return render(); }
  if (k === 'aulasDia' || k === 'dias') { v = Math.max(1, Math.round(+v || 1)); const max = k === 'dias' ? S.config.dias.length : (S.config.turnos[t.turno]?.horarios.length || 12); if (v > max) { toast(k === 'dias' ? `Máximo de ${max} dias (ajuste os dias em Configurações).` : `O turno tem ${max} horários. Acrescente horários em Configurações.`); v = max; } }
  t[k] = v; mudou('turmas'); render();
});
ACT.novaTurma = () => { const t = { id: U.uid('t'), nome: 'Nova turma', sigla: 'Nova', turno: 'M', aulasDia: 5, ordem: S.turmas.length }; S.turmas.push(t); mudou('turmas'); render(); toast('Turma criada. Edite o nome na tabela.'); };
ACT.delTurma = d => { const t = M.turma[d.t]; confirma(`Excluir a turma <b>${E(t.nome)}</b>, suas ${S.atribs.filter(a => a.turma === t.id).length} atribuições e a grade dela?`, () => { S.turmas = S.turmas.filter(x => x.id !== t.id); S.atribs = S.atribs.filter(a => a.turma !== t.id); delete S.grade[t.id]; mudou('turmas', 'atribs', 'grade'); render(); }, 'Excluir', true); };

/* ---------------- DISCIPLINAS ---------------- */
VIEWS.disciplinas = () => {
  const lin = S.disciplinas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map(d => {
    const at = S.atribs.filter(a => a.disc === d.id), profs = [...new Set(at.map(a => a.prof).filter(Boolean))].map(id => M.prof[id]?.nome).filter(Boolean);
    return `<tr><td><input type="color" data-di="cor" data-d="${d.id}" value="${d.cor}" aria-label="Cor" style="width:38px;height:34px;border:0;background:none"></td><td><input type="text" data-di="nome" data-d="${d.id}" value="${E(d.nome)}" style="width:100%;min-width:200px" aria-label="Nome"></td><td><input type="text" data-di="sigla" data-d="${d.id}" value="${E(d.sigla)}" style="width:90px" aria-label="Sigla"></td>
      <td class="num">${at.length}</td><td class="num">${at.reduce((s, a) => s + a.aulas, 0)}</td><td class="muted" style="font-size:13px">${profs.map(n => E(nomeCurto(n))).join(', ') || '<span class="tag warn">sem professor</span>'}</td>
      <td class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="verDisc" data-d="${d.id}">Turmas</button><button class="btn sm ghost danger" data-act="delDisc" data-d="${d.id}">Excluir</button></td></tr>`;
  }).join('');
  return `<div class="top"><div><h1>Disciplinas</h1><p>Cor e sigla aparecem nas fichas da grade. “Turmas” mostra as aulas semanais por turma e o professor responsável.</p></div><button class="btn pri" data-act="novaDisc">Nova disciplina</button></div>
  <div class="tbl"><table class="stack"><thead><tr><th>Cor</th><th>Disciplina</th><th>Sigla</th><th class="num">Turmas</th><th class="num">Aulas/semana</th><th>Professores</th><th></th></tr></thead><tbody>${lin || '<tr><td colspan="7" class="empty">Nenhuma disciplina.</td></tr>'}</tbody></table></div>`;
};
VIEWS.disciplinas.after = () => $('main').querySelectorAll('[data-di]').forEach(el => el.onchange = () => { const d = M.disc[el.dataset.d], k = el.dataset.di; if (k !== 'cor' && !el.value.trim()) return render(); d[k] = k === 'sigla' ? el.value.trim().toUpperCase().slice(0, 8) : el.value; mudou('disciplinas'); render(); });
ACT.novaDisc = () => { const n = S.disciplinas.length; S.disciplinas.push({ id: U.uid('d'), nome: 'Nova disciplina', sigla: 'ND' + (n + 1), cor: U.palette[n % U.palette.length] }); mudou('disciplinas'); render(); };
ACT.delDisc = d => { const x = M.disc[d.d], n = S.atribs.filter(a => a.disc === x.id).length; confirma(`Excluir <b>${E(x.nome)}</b>${n ? ` e suas ${n} atribuições (as aulas saem da grade)` : ''}?`, () => { S.atribs.filter(a => a.disc === x.id).forEach(a => tiraDaGrade(a.id)); S.atribs = S.atribs.filter(a => a.disc !== x.id); S.disciplinas = S.disciplinas.filter(y => y.id !== x.id); mudou('disciplinas', 'atribs', 'grade'); render(); }, 'Excluir', true); };
ACT.verDisc = d => { UI.filtroAtr = { t: '', p: '', d: d.d, q: '' }; location.hash = '#atribuicoes'; };

/* ---------------- ATRIBUIÇÕES ---------------- */
VIEWS.atribuicoes = () => {
  const f = UI.filtroAtr, cont = contagem(), q = U.norm(f.q);
  const lst = S.atribs.filter(a => (!f.t || a.turma === f.t) && (!f.p || (f.p === '-' ? !a.prof : a.prof === f.p)) && (!f.d || a.disc === f.d) && (!q || U.norm((M.disc[a.disc]?.nome || '') + ' ' + (M.turma[a.turma]?.nome || '') + ' ' + (M.prof[a.prof]?.nome || '')).includes(q)))
    .sort((a, b) => (M.turma[a.turma]?.nome || '').localeCompare(M.turma[b.turma]?.nome || '', 'pt', { numeric: true }) || (M.disc[a.disc]?.nome || '').localeCompare(M.disc[b.disc]?.nome || '', 'pt'));
  const opT = ordTurmas().map(t => `<option value="${t.id}" ${f.t === t.id ? 'selected' : ''}>${E(t.nome)}</option>`).join('');
  const opP = S.professores.map(p => `<option value="${p.id}" ${f.p === p.id ? 'selected' : ''}>${E(p.nome)}</option>`).join('');
  const opD = S.disciplinas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map(d => `<option value="${d.id}" ${f.d === d.id ? 'selected' : ''}>${E(d.nome)}</option>`).join('');
  const resumo = f.t ? (() => { const t = M.turma[f.t], dem = S.atribs.filter(a => a.turma === t.id).reduce((s, a) => s + a.aulas, 0), cap = t.aulasDia * M.diasT(t); return `<p class="hint">${E(t.nome)}: ${dem} aulas previstas para ${cap} horários ${dem > cap ? '<span class="tag bad">acima da capacidade</span>' : ''}</p>`; })() : '';
  return `<div class="top"><div><h1>Distribuição de aulas</h1><p>Quem dá qual disciplina, em qual turma e quantas aulas por semana. É a base do gerador.</p></div><button class="btn pri" data-act="novaAtr">Nova atribuição</button></div>
  <div class="card row" style="margin-bottom:12px"><select id="fT" aria-label="Turma"><option value="">Todas as turmas</option>${opT}</select><select id="fP" aria-label="Professor"><option value="">Todos os professores</option><option value="-" ${f.p === '-' ? 'selected' : ''}>— Sem professor —</option>${opP}</select><select id="fD" aria-label="Disciplina"><option value="">Todas as disciplinas</option>${opD}</select><input type="search" id="fQ" placeholder="Buscar" value="${E(f.q)}"><span class="sp"></span><span class="hint">${lst.length} atribuições · ${lst.reduce((s, a) => s + a.aulas, 0)} aulas</span></div>${resumo}
  <div class="tbl"><table class="stack"><thead><tr><th>Turma</th><th>Disciplina</th><th>Professor</th><th>Aulas/semana</th><th class="num">Na grade</th><th></th></tr></thead><tbody>
  ${lst.map(a => { const n = cont[a.id] || 0; return `<tr><td>${E(M.turma[a.turma]?.nome)}</td><td><span class="chip" style="background:${M.disc[a.disc]?.cor}">${E(M.disc[a.disc]?.sigla)}</span> ${E(M.disc[a.disc]?.nome)}${a.marca ? ` <span class="tag" title="Marca na planilha">${E(a.marca)}</span>` : ''}</td>
    <td><select data-at="prof" data-a="${a.id}" style="max-width:260px" aria-label="Professor"><option value="">— Sem professor —</option>${S.professores.map(p => `<option value="${p.id}" ${a.prof === p.id ? 'selected' : ''}>${E(p.nome)}</option>`).join('')}</select></td>
    <td><input type="number" min="0" max="20" data-at="aulas" data-a="${a.id}" value="${a.aulas}" aria-label="Aulas"></td><td class="num">${n === a.aulas ? `<span class="tag ok">${n}</span>` : n > a.aulas ? `<span class="tag bad">${n}</span>` : n}</td><td><button class="btn sm ghost danger" data-act="delAtr" data-a="${a.id}">Excluir</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Nenhuma atribuição com esses filtros.</td></tr>'}
  </tbody></table></div>`;
};
VIEWS.atribuicoes.after = () => {
  const f = UI.filtroAtr; $('fT').onchange = e => { f.t = e.target.value; render(); }; $('fP').onchange = e => { f.p = e.target.value; render(); }; $('fD').onchange = e => { f.d = e.target.value; render(); };
  $('fQ').oninput = e => { f.q = e.target.value; const p = e.target.selectionStart; render(); const n = $('fQ'); n.focus(); n.setSelectionRange(p, p); };
  $('main').querySelectorAll('[data-at]').forEach(el => el.onchange = () => {
    const a = M.atr[el.dataset.a];
    if (el.dataset.at === 'aulas') { const v = Math.max(0, Math.round(+el.value || 0)); a.aulas = v; }
    else { const novo = el.value; if (novo && S.atribs.some(x => x.id !== a.id && x.disc === a.disc && x.turma === a.turma && x.prof === novo)) { toast('Esse professor já tem essa disciplina nessa turma. Ajuste a quantidade na linha existente.'); return render(); } a.prof = novo; }
    mudou('atribs'); render();
  });
};
ACT.novaAtr = () => {
  const f = UI.filtroAtr;
  drawer(`<div class="row"><h2>Nova atribuição</h2><span class="sp"></span><button class="btn sm ghost" data-x>Fechar</button></div>
  <div class="grid" style="margin-top:14px">
  <label class="f">Turma<select id="nT">${ordTurmas().map(t => `<option value="${t.id}" ${f.t === t.id ? 'selected' : ''}>${E(t.nome)}</option>`).join('')}</select></label>
  <label class="f">Disciplina<select id="nD">${S.disciplinas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map(d => `<option value="${d.id}" ${f.d === d.id ? 'selected' : ''}>${E(d.nome)}</option>`).join('')}</select></label>
  <label class="f">Professor<select id="nP"><option value="">— Sem professor —</option>${S.professores.map(p => `<option value="${p.id}" ${f.p === p.id ? 'selected' : ''}>${E(p.nome)}</option>`).join('')}</select></label>
  <label class="f">Aulas por semana<input type="number" id="nA" min="1" max="20" value="2"></label></div>
  <div class="row" style="margin-top:18px"><span class="sp"></span><button class="btn" data-x>Cancelar</button><button class="btn pri" data-act="salvaAtr">Adicionar</button></div>`);
};
ACT.salvaAtr = () => {
  const t = $('nT').value, d = $('nD').value, p = $('nP').value, n = Math.round(+$('nA').value);
  if (!t || !d) return toast('Escolha turma e disciplina. Cadastre-as antes, se ainda não existirem.');
  if (!(n > 0)) return toast('Informe a quantidade de aulas.');
  const ex = S.atribs.find(a => a.turma === t && a.disc === d && a.prof === p);
  if (ex) ex.aulas += n; else S.atribs.push({ id: U.uid('a'), turma: t, disc: d, prof: p, aulas: n, marca: '' });
  fecha(); mudou('atribs'); render(); toast('Atribuição adicionada.');
};
ACT.delAtr = d => { const a = M.atr[d.a]; confirma(`Excluir ${E(M.disc[a.disc]?.nome)} em ${E(M.turma[a.turma]?.nome)}? As aulas dela saem da grade.`, () => { snap(); tiraDaGrade(a.id); S.atribs = S.atribs.filter(x => x.id !== a.id); mudou('atribs', 'grade'); render(); }, 'Excluir', true); };

/* ---------------- GRADE ---------------- */
function profOcupado(pid, tempo, exceto) { for (const x of M.cells()) if (x.at && x.at.prof === pid && M.chaveTempo(x.t, x.d, x.a) === tempo && !(exceto && x.t.id === exceto[0] && x.d === exceto[1] && x.a === exceto[2])) return x; return null; }
VIEWS.grade = () => {
  if (!S.turmas.length) return `<div class="top"><h1>Grade de horários</h1></div><div class="card empty">Importe o quadro de distribuição ou cadastre turmas primeiro. <a href="#importar">Importar</a></div>`;
  const ts = ordTurmas(); if (!UI.turma || !M.turma[UI.turma]) UI.turma = ts[0].id; if (!UI.prof || !M.prof[UI.prof]) UI.prof = S.professores[0]?.id;
  const tabs = `<div class="tabs" role="tablist">${[['turma', 'Por turma'], ['prof', 'Por professor'], ['geral', 'Quadro geral']].map(([k, n]) => `<button role="tab" aria-selected="${UI.modo === k}" class="${UI.modo === k ? 'on' : ''}" data-act="modo" data-m="${k}">${n}</button>`).join('')}</div>`;
  const sel = UI.modo === 'turma' ? `<select id="selT" aria-label="Turma">${Object.keys(S.config.turnos).map(k => { const g = ts.filter(t => t.turno === k); return g.length ? `<optgroup label="${E(turnoNome(k))}">${g.map(t => `<option value="${t.id}" ${t.id === UI.turma ? 'selected' : ''}>${E(t.nome)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>`
    : UI.modo === 'prof' ? `<select id="selP" aria-label="Professor">${S.professores.map(p => `<option value="${p.id}" ${p.id === UI.prof ? 'selected' : ''}>${E(p.nome)}</option>`).join('')}</select>`
      : `<select id="selTu" aria-label="Turno">${Object.entries(S.config.turnos).filter(([k]) => ts.some(t => t.turno === k)).map(([k, v]) => `<option value="${k}" ${k === UI.turnoGeral ? 'selected' : ''}>${E(v.nome)}</option>`).join('')}</select>`;
  const barra = `<div class="row" style="margin-bottom:12px">${tabs}${sel}<span class="sp"></span>
    <button class="btn sm" data-act="desfazer" ${UI.undo.length ? '' : 'disabled'} title="Ctrl+Z">Desfazer</button>
    ${UI.modo === 'turma' ? `<button class="btn sm" data-act="copiaDia">Copiar dia</button><button class="btn sm" data-act="limparTurma">Limpar turma</button>` : ''}
    <button class="btn sm" data-act="limparTudo">Limpar grade</button><button class="btn acc" data-act="gerar">Gerar horário automaticamente</button></div>`;
  let corpo = '';
  if (UI.modo === 'turma') corpo = gradeTurma(M.turma[UI.turma]);
  else if (UI.modo === 'prof') corpo = UI.prof ? gradeProf(M.prof[UI.prof]) : '<div class="card empty">Nenhum professor.</div>';
  else corpo = gradeGeral(UI.turnoGeral);
  return `<div class="top"><div><h1>Grade de horários</h1><p>${UI.modo === 'turma' ? 'Arraste as fichas da lista para a grade, ou entre horários para trocar. Clique numa célula para editar; Delete remove, Ctrl+C/Ctrl+V copia.' : UI.modo === 'prof' ? 'Horário do professor em todas as turmas. Clique num horário vazio para colocar uma aula dele.' : 'Todas as turmas do turno. Clique numa aula para abrir a grade da turma.'}</p></div></div>${barra}${corpo}`;
};
function fichaHtml(aid) { const d = discDe(aid), p = profDe(aid); return d ? `<span class="d">${E(d.nome)}</span><span class="p">${p ? E(nomeCurto(p.nome)) : 'sem professor'}</span>` : '<span class="d">?</span>'; }
function gradeTurma(t) {
  const conf = conflitosSet(), g = S.grade[t.id] || {}, hs = S.config.turnos[t.turno]?.horarios || [], cont = contagem();
  let rows = '';
  for (let a = 0; a < t.aulasDia; a++) {
    const iv = intervaloAntes(t.turno, a); if (iv) rows += `<tr class="ivr"><td class="h"></td><td colspan="${S.config.dias.length}"><div class="intv">${E(txtIntervalo(iv))}</div></td></tr>`;
    rows += `<tr><td class="h"><b>${a + 1}ª</b>${hs[a] || ''}</td>`;
    for (let d = 0; d < S.config.dias.length; d++) {
      if (d >= M.diasT(t)) { rows += `<td><div class="cell off" aria-label="sem aula"></div></td>`; continue; }
      const aid = g[d + '-' + a], k = [t.id, d, a].join('|'), selc = UI.sel && UI.sel.t === t.id && UI.sel.d === d && UI.sel.a === a;
      const fix = S.fixas[t.id + '|' + d + '-' + a];
      if (aid && M.atr[aid]) { const disc = discDe(aid); rows += `<td><div class="cell fill ${conf.has(k) ? 'conf' : ''} ${selc ? 'sel' : ''}" style="background:${disc?.cor || '#888'}" draggable="true" data-cell="${d}-${a}" tabindex="0" title="${E((disc?.nome || '') + ' — ' + (profDe(aid)?.nome || 'sem professor'))}${conf.has(k) ? ' — CONFLITO' : ''}">${fichaHtml(aid)}${fix ? '<span class="pin" title="Fixada: o gerador mantém">📌</span>' : ''}</div></td>`; }
      else rows += `<td><div class="cell ${selc ? 'sel' : ''}" data-cell="${d}-${a}" tabindex="0" aria-label="${S.config.dias[d]} ${a + 1}ª aula vazia"></div></td>`;
    }
    rows += '</tr>';
  }
  const at = S.atribs.filter(x => x.turma === t.id).map(x => ({ x, falta: x.aulas - (cont[x.id] || 0) }));
  const pend = at.filter(o => o.falta > 0), dem = at.reduce((s, o) => s + o.x.aulas, 0);
  const tray = `<div class="card tray"><div class="row"><h3>Aulas a distribuir</h3><span class="sp"></span><span class="tag ${pend.length ? 'warn' : 'ok'}">${pend.reduce((s, o) => s + o.falta, 0)}</span></div><p class="hint">${dem} aulas previstas · ${t.aulasDia * M.diasT(t)} horários</p>
    ${pend.map(o => { const d = M.disc[o.x.disc], p = M.prof[o.x.prof]; return `<div class="it" draggable="${p ? 'true' : 'false'}" data-atr="${o.x.id}" title="${p ? 'Arraste para a grade' : 'Defina o professor em Distribuição de aulas'}"><span class="c" style="background:${d?.cor}"></span><div><b>${E(d?.nome)}</b><small>${p ? E(p.nome) : '⚠ sem professor'}</small></div><span class="q">${o.falta}</span></div>`; }).join('') || '<p class="muted">Todas as aulas desta turma estão na grade.</p>'}
    ${at.some(o => o.falta < 0) ? `<p class="hint" style="color:var(--bad)">Há disciplinas com aulas a mais na grade — veja Validação.</p>` : ''}
    ${UI.clip ? `<p class="hint">Copiado: <b>${E(discDe(UI.clip)?.nome || '')}</b></p>` : ''}</div>`;
  return `<div class="gwrap"><div class="card scroll"><div class="row" style="margin-bottom:6px"><h2>${E(t.nome)}</h2><span class="tag">${E(turnoNome(t.turno))}</span><span class="sp"></span><span class="hint">📌 = fixada (o gerador mantém)</span></div>
  <table class="sched" id="sched" data-t="${t.id}"><thead><tr><th style="width:74px"></th>${S.config.dias.map(d => `<th>${E(d)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${tray}</div>`;
}
function gradeProf(p) {
  const conf = conflitosSet(), ind = M.indisp[p.id] || new Set();
  const minhas = []; for (const x of M.cells()) if (x.at && x.at.prof === p.id) minhas.push(x);
  const turnos = [...new Set(S.atribs.filter(a => a.prof === p.id).map(a => M.turma[a.turma]?.turno).filter(Boolean))];
  const ordem = { M: 0, V: 1, N: 2 }; turnos.sort((a, b) => (ordem[a] ?? 3) - (ordem[b] ?? 3));
  const cont = contagem(), at = S.atribs.filter(a => a.prof === p.id), prev = p.carga ?? at.reduce((s, a) => s + a.aulas, 0), g = at.reduce((s, a) => s + (cont[a.id] || 0), 0);
  let html = `<div class="card"><div class="row"><span class="dot" style="background:${p.cor}"></span><h2>${E(p.nome)}</h2><span class="tag ${g === prev ? 'ok' : g > prev ? 'bad' : 'warn'}">${g} de ${prev} aulas na grade</span><span class="sp"></span><button class="btn sm" data-act="editProf" data-p="${p.id}">Disponibilidade</button></div>`;
  if (!turnos.length) html += '<p class="muted">Sem aulas atribuídas.</p>';
  for (const tu of turnos) {
    const hs = S.config.turnos[tu].horarios;
    html += `<h3 style="margin-top:14px">${E(turnoNome(tu))}</h3><div class="scroll"><table class="sched"><thead><tr><th style="width:74px"></th>${S.config.dias.map(d => `<th>${E(d)}</th>`).join('')}</tr></thead><tbody>`;
    hs.forEach((h, a) => {
      const iv = intervaloAntes(tu, a); if (iv) html += `<tr class="ivr"><td class="h"></td><td colspan="${S.config.dias.length}"><div class="intv">${E(txtIntervalo(iv))}</div></td></tr>`;
      html += `<tr><td class="h"><b>${a + 1}ª</b>${h}</td>`;
      for (let d = 0; d < S.config.dias.length; d++) {
        const aqui = minhas.filter(x => x.t.turno === tu && x.d === d && M.hor(x.t, x.a) === h), k = d + '|' + h;
        if (aqui.length) { const x = aqui[0], disc = M.disc[x.at.disc], c = aqui.length > 1 || conf.has([x.t.id, x.d, x.a].join('|')); html += `<td><div class="cell fill ${c ? 'conf' : ''}" style="background:${disc?.cor}" data-pc="${x.t.id}|${x.d}|${x.a}" title="${E(aqui.map(y => y.t.nome).join(' + '))}"><span class="d">${E(aqui.map(y => y.t.sigla || y.t.nome).join(' + '))}</span><span class="p">${E(disc?.nome)}</span></div></td>`; }
        else html += `<td><div class="cell ${ind.has(k) ? 'na' : ''}" data-pv="${tu}|${d}|${a}" title="${ind.has(k) ? 'Indisponível' : 'Livre'}">${ind.has(k) ? '<span class="p" style="color:var(--bad)">indisponível</span>' : ''}</div></td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }
  return html + '</div>';
}
function gradeGeral(tu) {
  const conf = conflitosSet(), ts = ordTurmas().filter(t => t.turno === tu), hs = S.config.turnos[tu]?.horarios || [], nA = Math.max(0, ...ts.map(t => t.aulasDia));
  if (!ts.length) return '<div class="card empty">Nenhuma turma neste turno.</div>';
  let h = `<div class="card"><div class="scroll" style="max-height:75vh"><table class="geral"><thead><tr><th class="t">Turma</th>${S.config.dias.map((d, di) => hs.slice(0, nA).map((x, a) => `<th class="${a === 0 ? 'dsep' : ''}" title="${E(d)} ${x}">${a === 0 ? E(d.slice(0, 3)) + '<br>' : '<br>'}${a + 1}ª</th>`).join('')).join('')}</tr></thead><tbody>`;
  for (const t of ts) {
    const g = S.grade[t.id] || {};
    h += `<tr><td class="t"><a href="#grade" data-act="abrirTurma" data-t="${t.id}">${E(t.sigla || t.nome)}</a></td>`;
    for (let d = 0; d < S.config.dias.length; d++) for (let a = 0; a < nA; a++) {
      const aid = g[d + '-' + a], cls = a === 0 ? 'dsep' : '';
      if (a >= t.aulasDia || d >= M.diasT(t)) { h += `<td class="${cls}"></td>`; continue; }
      if (aid && M.atr[aid]) { const ds = discDe(aid), p = profDe(aid); h += `<td class="${cls}"><div class="g ${conf.has([t.id, d, a].join('|')) ? 'conf' : ''}" style="background:${ds?.cor}" data-act="abrirTurma" data-t="${t.id}" title="${E(ds?.nome + ' — ' + (p?.nome || ''))}"><b>${E(ds?.sigla)}</b><small>${E(p ? p.nome.split(' ')[0] : '')}</small></div></td>`; }
      else h += `<td class="${cls}"><div class="g v" data-act="abrirTurma" data-t="${t.id}">·</div></td>`;
    }
    h += '</tr>';
  }
  return h + `</tbody></table></div><div class="row" style="margin-top:10px">${S.disciplinas.filter(d => S.atribs.some(a => a.disc === d.id && ts.some(t => t.id === a.turma))).map(d => `<span class="chip" style="background:${d.cor}">${E(d.sigla)}</span><span class="hint" style="margin-right:8px">${E(d.nome)}</span>`).join('')}</div></div>`;
}
VIEWS.grade.after = () => {
  const sT = $('selT'), sP = $('selP'), sTu = $('selTu');
  if (sT) sT.onchange = () => { UI.turma = sT.value; UI.sel = null; render(); };
  if (sP) sP.onchange = () => { UI.prof = sP.value; render(); };
  if (sTu) sTu.onchange = () => { UI.turnoGeral = sTu.value; render(); };
  const tab = $('sched');
  if (tab) {
    const tid = tab.dataset.t;
    tab.querySelectorAll('[data-cell]').forEach(c => {
      const [d, a] = c.dataset.cell.split('-').map(Number);
      c.onclick = () => { if (UI.sel && UI.sel.t === tid && UI.sel.d === d && UI.sel.a === a) return editarCelula(tid, d, a); UI.sel = { t: tid, d, a }; render(); };
      c.ondblclick = () => editarCelula(tid, d, a);
      c.ondragstart = e => { e.dataTransfer.setData('text/plain', 'cell:' + d + '-' + a); e.dataTransfer.effectAllowed = 'move'; };
      c.ondragover = e => { e.preventDefault(); c.classList.add('drop'); };
      c.ondragleave = () => c.classList.remove('drop');
      c.ondrop = e => { e.preventDefault(); c.classList.remove('drop'); const v = e.dataTransfer.getData('text/plain'); if (v.startsWith('cell:')) { const [d0, a0] = v.slice(5).split('-').map(Number); moverTroca(tid, d0, a0, d, a); } else if (v.startsWith('atr:')) colocar(tid, d, a, v.slice(4)); };
    });
    $('main').querySelectorAll('.tray .it[draggable=true]').forEach(it => {
      it.ondragstart = e => { e.dataTransfer.setData('text/plain', 'atr:' + it.dataset.atr); };
      it.onclick = () => { if (UI.sel && UI.sel.t === tid) colocar(tid, UI.sel.d, UI.sel.a, it.dataset.atr); else toast('Selecione uma célula da grade e clique na aula, ou arraste a aula para a grade.'); };
    });
    const f = UI.flash; if (f && f.t === tid) { const c = tab.querySelector(`[data-cell="${f.d}-${f.a}"]`); if (c) { c.classList.add('flash'); c.scrollIntoView({ block: 'center', behavior: 'smooth' }); } UI.flash = null; }
  }
  $('main').querySelectorAll('[data-pv]').forEach(c => c.onclick = () => { const [tu, d, a] = c.dataset.pv.split('|'); colocarProf(UI.prof, tu, +d, +a); });
  $('main').querySelectorAll('[data-pc]').forEach(c => c.onclick = () => { const [t, d, a] = c.dataset.pc.split('|'); editarCelula(t, +d, +a); });
};
ACT.modo = d => { UI.modo = d.m; UI.sel = null; render(); };
ACT.desfazer = () => desfazer();
function avisoConflito(t, d, a, aid) {
  const at = M.atr[aid]; if (!at || !at.prof) return '';
  const tempo = M.chaveTempo(t, d, a), oc = profOcupado(at.prof, tempo, [t.id, d, a]);
  if (oc) return `${M.prof[at.prof].nome} já está em ${oc.t.nome} nesse horário`;
  if (M.indisp[at.prof]?.has(tempo)) return `${M.prof[at.prof].nome} marcou esse horário como indisponível`;
  return '';
}
function colocar(tid, d, a, aid, silencioso) {
  const t = M.turma[tid]; if (a >= t.aulasDia || d >= M.diasT(t)) return toast('Fora do horário da turma.');
  const at = M.atr[aid]; if (!at) return; if (at.turma !== tid) return toast('Essa aula é de outra turma.');
  snap(); (S.grade[tid] ||= {})[d + '-' + a] = aid; delete S.fixas[tid + '|' + d + '-' + a];
  mudou('grade'); UI.sel = { t: tid, d, a }; render();
  const w = avisoConflito(t, d, a, aid); if (w) toast('⚠ Conflito: ' + w + '. A aula foi colocada e aparece marcada.', 5000); else if (!silencioso) toast('Aula colocada.');
}
function moverTroca(tid, d0, a0, d1, a1) {
  if (d0 === d1 && a0 === a1) return;
  const g = S.grade[tid] || {}, x = g[d0 + '-' + a0], y = g[d1 + '-' + a1]; if (!x) return;
  snap(); if (y) g[d0 + '-' + a0] = y; else delete g[d0 + '-' + a0]; g[d1 + '-' + a1] = x;
  const f0 = S.fixas[tid + '|' + d0 + '-' + a0], f1 = S.fixas[tid + '|' + d1 + '-' + a1]; delete S.fixas[tid + '|' + d0 + '-' + a0]; delete S.fixas[tid + '|' + d1 + '-' + a1]; if (f0) S.fixas[tid + '|' + d1 + '-' + a1] = 1; if (f1 && y) S.fixas[tid + '|' + d0 + '-' + a0] = 1;
  mudou('grade'); UI.sel = { t: tid, d: d1, a: a1 }; render();
  const t = M.turma[tid], w = [avisoConflito(t, d1, a1, x), y ? avisoConflito(t, d0, a0, y) : ''].filter(Boolean);
  toast(w.length ? '⚠ Conflito: ' + w.join('; ') + '.' : y ? 'Aulas trocadas.' : 'Aula movida.', w.length ? 5000 : 2000);
}
function removerAula(tid, d, a) { const g = S.grade[tid] || {}; if (!g[d + '-' + a]) return; snap(); delete g[d + '-' + a]; delete S.fixas[tid + '|' + d + '-' + a]; mudou('grade'); fecha(); render(); toast('Aula removida.'); }
function copiar() { const g = S.grade[UI.sel.t] || {}, aid = g[UI.sel.d + '-' + UI.sel.a]; if (!aid) return toast('Célula vazia.'); UI.clip = aid; render(); toast('Aula copiada. Selecione outra célula e use Ctrl+V.'); }
function colar() { if (!UI.clip) return toast('Nada copiado.'); const at = M.atr[UI.clip]; if (!at) return; if (at.turma !== UI.sel.t) return toast('A aula copiada é de outra turma. Para outra turma, use a lista “Aulas a distribuir”.'); colocar(UI.sel.t, UI.sel.d, UI.sel.a, UI.clip); }
function editarCelula(tid, d, a) {
  const t = M.turma[tid], g = S.grade[tid] || {}, aid = g[d + '-' + a], cont = contagem(), tempo = M.chaveTempo(t, d, a);
  const opts = S.atribs.filter(x => x.turma === tid).map(x => {
    const falta = x.aulas - (cont[x.id] || 0) + (x.id === aid ? 1 : 0), ds = M.disc[x.disc], p = M.prof[x.prof];
    const oc = x.prof ? profOcupado(x.prof, tempo, [tid, d, a]) : null, ind = x.prof && M.indisp[x.prof]?.has(tempo);
    const obs = !x.prof ? 'sem professor' : oc ? `ocupado em ${oc.t.nome}` : ind ? 'indisponível neste horário' : falta > 0 ? `${falta} a colocar` : 'já completa';
    return { x, falta, ds, p, ruim: !x.prof || oc || ind, obs };
  }).sort((u, v) => (u.ruim - v.ruim) || (v.falta - u.falta));
  UI.sel = { t: tid, d, a };
  drawer(`<div class="row"><div><h2>${E(t.nome)}</h2><p class="hint">${E(S.config.dias[d])} · ${a + 1}ª aula · ${E(M.hor(t, a))}</p></div><span class="sp"></span><button class="btn sm ghost" data-x>Fechar</button></div>
  ${aid ? `<div class="card" style="margin:12px 0;background:${discDe(aid)?.cor};color:#fff;border:0"><b>${E(discDe(aid)?.nome)}</b><br>${E(profDe(aid)?.nome || 'sem professor')}</div>
  <div class="row"><button class="btn danger" data-act="cRem">Remover</button><button class="btn" data-act="cFix">${S.fixas[tid + '|' + d + '-' + a] ? 'Desafixar' : 'Fixar (gerador mantém)'}</button><button class="btn" data-act="cCopy">Copiar</button></div>` : '<p class="hint" style="margin:12px 0">Horário vazio.</p>'}
  ${UI.clip && M.atr[UI.clip]?.turma === tid ? `<button class="btn" style="margin-top:8px" data-act="cPaste">Colar ${E(discDe(UI.clip)?.nome)}</button>` : ''}
  <h3 style="margin-top:16px">${aid ? 'Trocar por' : 'Colocar'}</h3><div class="opts" style="margin-top:8px">${opts.map(o => `<button class="opt ${o.ruim ? 'no' : ''}" data-act="cSet" data-a="${o.x.id}"><span class="dot" style="background:${o.ds?.cor}"></span><span><b>${E(o.ds?.nome)}</b><small>${E(o.p?.nome || 'sem professor')} · ${E(o.obs)}</small></span></button>`).join('') || '<p class="muted">Nenhuma atribuição para esta turma.</p>'}</div>`);
}
ACT.cRem = () => removerAula(UI.sel.t, UI.sel.d, UI.sel.a);
ACT.cFix = () => { const k = UI.sel.t + '|' + UI.sel.d + '-' + UI.sel.a; snap(); if (S.fixas[k]) delete S.fixas[k]; else S.fixas[k] = 1; mudou('grade'); fecha(); render(); };
ACT.cCopy = () => { fecha(); copiar(); };
ACT.cPaste = () => { fecha(); colar(); };
ACT.cSet = d => { const at = M.atr[d.a]; if (!at.prof) return toast('Defina o professor desta disciplina em Distribuição de aulas.'); fecha(); colocar(UI.sel.t, UI.sel.d, UI.sel.a, d.a); };
function colocarProf(pid, tu, d, a) {
  const h = S.config.turnos[tu].horarios[a], tempo = d + '|' + h, cont = contagem();
  const opts = S.atribs.filter(x => x.prof === pid && M.turma[x.turma]?.turno === tu).map(x => {
    const t = M.turma[x.turma], ai = (S.config.turnos[t.turno].horarios).indexOf(h), livre = ai >= 0 && ai < t.aulasDia && d < M.diasT(t) && !(S.grade[t.id] || {})[d + '-' + ai];
    return { x, t, ai, livre, falta: x.aulas - (cont[x.id] || 0) };
  }).sort((u, v) => (v.livre - u.livre) || (v.falta - u.falta));
  drawer(`<div class="row"><div><h2>${E(M.prof[pid].nome)}</h2><p class="hint">${E(S.config.dias[d])} · ${h}${M.indisp[pid].has(tempo) ? ' · <b style="color:var(--bad)">marcado como indisponível</b>' : ''}</p></div><span class="sp"></span><button class="btn sm ghost" data-x>Fechar</button></div>
  <h3 style="margin-top:14px">Colocar aula</h3><div class="opts" style="margin-top:8px">${opts.map(o => `<button class="opt ${o.livre && o.falta > 0 ? '' : 'no'}" ${o.livre ? '' : 'disabled'} data-act="pSet" data-t="${o.t.id}" data-a="${o.x.id}" data-d="${d}" data-ai="${o.ai}"><span class="dot" style="background:${M.disc[o.x.disc]?.cor}"></span><span><b>${E(o.t.nome)} — ${E(M.disc[o.x.disc]?.nome)}</b><small>${o.livre ? (o.falta > 0 ? o.falta + ' a colocar' : 'já completa') : 'turma ocupada nesse horário'}</small></span></button>`).join('') || '<p class="muted">Sem aulas neste turno.</p>'}</div>`);
}
ACT.pSet = d => { fecha(); colocar(d.t, +d.d, +d.ai, d.a); };
ACT.limparTurma = () => { const t = M.turma[UI.turma]; confirma(`Remover todas as aulas da grade de <b>${E(t.nome)}</b>? (Ctrl+Z desfaz)`, () => { snap(); S.grade[t.id] = {}; Object.keys(S.fixas).filter(k => k.startsWith(t.id + '|')).forEach(k => delete S.fixas[k]); mudou('grade'); render(); }, 'Limpar', true); };
ACT.limparTudo = () => confirma('Remover todas as aulas de todas as turmas? (Ctrl+Z desfaz)', () => { snap(); S.grade = {}; S.fixas = {}; mudou('grade'); render(); }, 'Limpar tudo', true);
ACT.copiaDia = () => {
  const t = M.turma[UI.turma];
  modal(`<h2>Copiar dia</h2><p class="hint">Copia as aulas de um dia de ${E(t.nome)} para outro dia (o destino é substituído). Útil para turmas com a mesma sequência em dias diferentes.</p>
  <div class="row" style="margin:12px 0"><label class="f">De<select id="cdA">${S.config.dias.slice(0, M.diasT(t)).map((x, i) => `<option value="${i}">${E(x)}</option>`).join('')}</select></label><label class="f">Para<select id="cdB">${S.config.dias.slice(0, M.diasT(t)).map((x, i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${E(x)}</option>`).join('')}</select></label></div>
  <div class="row" style="justify-content:flex-end"><button class="btn" data-x>Cancelar</button><button class="btn pri" data-act="copiaDiaOk">Copiar</button></div>`);
};
ACT.copiaDiaOk = () => { const t = M.turma[UI.turma], A = +$('cdA').value, B = +$('cdB').value; if (A === B) return toast('Escolha dias diferentes.'); snap(); const g = (S.grade[t.id] ||= {}); for (let a = 0; a < t.aulasDia; a++) { if (g[A + '-' + a]) g[B + '-' + a] = g[A + '-' + a]; else delete g[B + '-' + a]; } fecha(); mudou('grade'); render(); toast('Dia copiado. Confira a Validação: a disciplina pode passar da quantidade prevista.'); };

/* ---------------- GERADOR ---------------- */
ACT.gerar = () => {
  if (!S.atribs.length) return toast('Importe ou cadastre as atribuições antes.');
  const temAulas = Object.values(S.grade).some(g => Object.keys(g).length), nFix = Object.keys(S.fixas).length;
  modal(`<h2>Gerar horário automaticamente</h2><p class="hint">O gerador testa centenas de combinações e fica com a melhor: sem professor em duas turmas ao mesmo tempo, respeitando a disponibilidade, a carga de cada disciplina, evitando repetir a disciplina no dia e janelas para os professores.</p>
  <div class="grid" style="margin:14px 0">
   <label class="row"><input type="radio" name="gm" value="novo" ${temAulas ? '' : 'checked'}> Montar do zero${nFix ? ` (mantendo as ${nFix} aulas fixadas 📌)` : ''}</label>
   <label class="row"><input type="radio" name="gm" value="completar" ${temAulas ? 'checked' : ''}> Completar a grade atual (mantém as aulas já colocadas)</label>
   <label class="f">Tempo de busca<select id="gTempo"><option value="4000">Rápido (4 s)</option><option value="10000" selected>Normal (10 s)</option><option value="25000">Caprichado (25 s)</option></select></label>
   ${S.config.regras.filter(r => r.ativo !== false).length ? `<p class="hint" style="margin:0">Vai respeitar ${S.config.regras.filter(r => r.ativo !== false).length} pedido(s) de professores. <a href="#pedidos" data-x>Ver pedidos</a></p>` : `<p class="hint" style="margin:0">Tem pedidos de professores (ex.: “4 aulas seguidas na segunda”)? <a href="#pedidos" data-x>Cadastre antes de gerar</a>.</p>`}
  </div><div id="gProg" hidden><div class="prog"><i id="gBar" style="width:0"></i></div><p class="hint" id="gTxt">Preparando…</p></div>
  <div class="row" style="justify-content:flex-end" id="gBtns"><button class="btn" data-x>Cancelar</button><button class="btn acc" data-act="gerarOk">Gerar</button></div>`);
};
ACT.gerarOk = async () => {
  const modo = document.querySelector('input[name=gm]:checked').value, tempo = +$('gTempo').value;
  $('gProg').hidden = false; $('gBtns').hidden = true;
  snap();
  const r = await Gerador.gerar(S, { tempoMs: tempo, manterFixas: true, manterTudo: modo === 'completar', onProgress: async (n, best, el, tot) => { $('gBar').style.width = Math.min(100, el / tot * 100) + '%'; $('gTxt').textContent = `${n} combinações testadas · melhor: ${best.falhas.length} aula(s) sem lugar, ${Math.round(best.custo)} pontos de penalidade`; await new Promise(r => setTimeout(r, 0)); } });
  S.grade = r.grade; UI.lastGen = r; mudou('grade');
  const tot = S.atribs.filter(a => a.prof).reduce((s, a) => s + a.aulas, 0), falt = r.naoAlocadas.reduce((s, x) => s + x.qtd, 0);
  modal(`<h2>${falt ? `Horário gerado com ${falt} aula(s) sem lugar` : 'Horário gerado sem pendências'}</h2><p>${tot - falt} de ${tot} aulas distribuídas em ${r.tentativas} combinações testadas.${S.atribs.some(a => !a.prof) ? ' Aulas sem professor definido ficam de fora até você definir o professor.' : ''}</p>
  ${falt ? `<div class="opts" style="margin:10px 0">${r.naoAlocadas.map(n => { const a = M.atr[n.atr]; return `<div class="opt" style="cursor:default"><span class="dot" style="background:${M.disc[a.disc]?.cor}"></span><span><b>${E(M.disc[a.disc]?.nome)} — ${E(M.turma[a.turma]?.nome)} (${n.qtd})</b><small>${E(n.motivo)}</small></span></div>`; }).join('')}</div>` : ''}
  ${(() => { const rs = Regras.checar(S); if (!rs.length) return ''; const nao = rs.filter(r => !r.ok); return `<p style="margin:10px 0 4px"><b>Pedidos dos professores:</b> ${rs.length - nao.length} de ${rs.length} atendidos.</p>${nao.map(r => `<p class="hint" style="margin:2px 0;color:var(--bad)">✕ ${E(r.txt)} — ${E(r.det)}</p>`).join('')}`; })()}
  <div class="row" style="justify-content:flex-end"><button class="btn" data-act="verValid">Ver validação</button><button class="btn pri" data-x>Ver grade</button></div>`);
  location.hash = '#grade'; render();
};
ACT.verValid = () => { fecha(); location.hash = '#validacao'; };

/* ---------------- PEDIDOS DOS PROFESSORES ---------------- */
VIEWS.pedidos = () => {
  const st = Object.fromEntries(Regras.checar(S).map(r => [r.id, r])), temGrade = Object.values(S.grade).some(g => Object.keys(g).length);
  const regras = S.config.regras;
  const pend = UI.pedidos || [];
  return `<div class="top"><div><h1>Pedidos dos professores</h1><p>Escreva os pedidos do jeito que você falaria. O sistema interpreta, você confere e o gerador respeita na próxima vez que gerar o horário.</p></div>${regras.length ? '<button class="btn acc" data-act="gerar">Gerar horário com os pedidos</button>' : ''}</div>
  <div class="card"><label class="f" for="pedTxt">Escreva um pedido por linha</label>
  <textarea id="pedTxt" style="min-height:110px;margin-top:6px" placeholder="Professor Adalermo quer 4 aulas seguidas na segunda&#10;Jaqueline só pode dar aula na terça, quarta e quinta&#10;A professora Leda não pode na sexta&#10;Henrique no máximo 6 aulas por dia&#10;Maria Cristina quer 2 aulas na quarta">${E(UI.pedTxt || '')}</textarea>
  <div class="row" style="margin-top:10px"><button class="btn pri" data-act="interpretar">Interpretar</button><span class="hint">Entendo: aulas seguidas num dia, mínimo de aulas num dia, só em certos dias, não em certos dias e máximo de aulas por dia.</span></div></div>
  ${pend.length ? `<div class="card" style="margin-top:14px"><div class="row"><h2>Confira como entendi</h2><span class="sp"></span><button class="btn" data-act="pedDescarta">Descartar</button><button class="btn acc" data-act="pedConfirma">Adicionar ${pend.length} pedido${pend.length > 1 ? 's' : ''}</button></div>
    <div class="grid" style="margin-top:10px">${pend.map((r, i) => editorRegra(r, i)).join('')}</div></div>` : ''}
  <div class="card" style="margin-top:14px;padding:0"><div class="row" style="padding:14px 16px"><h2>Pedidos cadastrados</h2><span class="tag">${regras.length}</span></div>
  ${regras.length ? `<div class="tbl" style="border:0;border-radius:0"><table class="stack"><thead><tr><th>Pedido</th><th>Como o sistema aplica</th><th>Situação na grade</th><th></th></tr></thead><tbody>${regras.map(r => { const s = st[r.id]; return `<tr><td class="muted" style="max-width:280px">${E(r.texto || '—')}</td><td><b>${E(Regras.descreve(r, S))}</b></td><td>${r.ativo === false ? '<span class="tag">desligado</span>' : !temGrade ? '<span class="tag">aguardando gerar</span>' : s ? (s.ok ? `<span class="tag ok">atendido</span>` : `<span class="tag bad">não atendido</span>`) + ` <span class="hint">${E(s.det)}</span>` : ''}</td>
    <td class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="pedLiga" data-id="${r.id}">${r.ativo === false ? 'Ligar' : 'Desligar'}</button><button class="btn sm ghost danger" data-act="pedDel" data-id="${r.id}">Excluir</button></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="empty">Nenhum pedido ainda.</p>'}</div>`;
};
function editorRegra(r, i) {
  const D = S.config.dias, um = r.tipo === 'seq' || r.tipo === 'min';
  return `<div class="card" style="background:var(--panel2)"><p class="hint" style="margin:0 0 8px">“${E(r.texto)}”</p>${(r.avisos || []).map(x => `<p style="color:var(--warn);margin:0 0 6px;font-size:13px">⚠ ${E(x)}</p>`).join('')}
  <div class="row"><select data-pe="prof" data-i="${i}" aria-label="Professor" style="max-width:280px"><option value="">— professor —</option>${S.professores.map(p => `<option value="${p.id}" ${p.id === r.prof ? 'selected' : ''}>${E(p.nome)}</option>`).join('')}</select>
  <select data-pe="tipo" data-i="${i}" aria-label="Tipo"><option value="">— tipo de pedido —</option>${Object.entries(Regras.TIPOS).map(([k, v]) => `<option value="${k}" ${k === r.tipo ? 'selected' : ''}>${v}</option>`).join('')}</select>
  ${r.tipo === 'seq' || r.tipo === 'min' || r.tipo === 'max' ? `<label class="row" style="gap:6px">Aulas <input type="number" min="1" max="10" data-pe="n" data-i="${i}" value="${r.n || ''}"></label>` : ''}
  ${r.tipo && r.tipo !== 'max' ? (um ? `<select data-pe="dia" data-i="${i}" aria-label="Dia"><option value="">— dia —</option>${D.map((d, k) => `<option value="${k}" ${r.dias[0] === k ? 'selected' : ''}>${d}</option>`).join('')}</select>` : `<span class="row" style="gap:8px">${D.map((d, k) => `<label class="row" style="gap:3px"><input type="checkbox" data-pe="dias" data-i="${i}" value="${k}" ${r.dias.includes(k) ? 'checked' : ''}>${d.slice(0, 3)}</label>`).join('')}</span>`) : ''}
  <span class="sp"></span><button class="btn sm ghost" data-act="pedTira" data-i="${i}">Remover</button></div>
  <p style="margin:8px 0 0"><b>${r.prof && r.tipo ? E(Regras.descreve(r, S)) : '<span class="muted">Complete o professor e o tipo.</span>'}</b></p></div>`;
}
VIEWS.pedidos.after = () => {
  const ta = $('pedTxt'); ta.oninput = () => UI.pedTxt = ta.value;
  $('main').querySelectorAll('[data-pe]').forEach(el => el.onchange = () => {
    const r = UI.pedidos[+el.dataset.i], k = el.dataset.pe;
    if (k === 'prof') r.prof = el.value; else if (k === 'tipo') { r.tipo = el.value; if ((r.tipo === 'seq' || r.tipo === 'min') && r.dias.length > 1) r.dias = r.dias.slice(0, 1); if (r.tipo === 'min' && !r.n) r.n = 1; }
    else if (k === 'n') r.n = Math.max(1, +el.value || 1); else if (k === 'dia') r.dias = el.value === '' ? [] : [+el.value];
    else if (k === 'dias') r.dias = [...$('main').querySelectorAll(`[data-pe=dias][data-i="${el.dataset.i}"]:checked`)].map(x => +x.value);
    r.avisos = []; render();
  });
};
ACT.interpretar = () => {
  const linhas = ($('pedTxt').value || '').split('\n').map(x => x.trim()).filter(Boolean);
  if (!linhas.length) return toast('Escreva pelo menos um pedido.');
  if (!S.professores.length) return toast('Importe o quadro de distribuição antes.');
  UI.pedidos = (UI.pedidos || []).concat(linhas.flatMap(l => { const r = Regras.interpretar(l, S); return r.regras.map(x => ({ ...x, avisos: r.avisos })); }));
  UI.pedTxt = ''; render();
};
ACT.pedTira = d => { UI.pedidos.splice(+d.i, 1); render(); };
ACT.pedDescarta = () => { UI.pedidos = []; render(); };
ACT.pedConfirma = () => {
  const ok = [], ruins = [];
  for (const r of UI.pedidos) { const comp = r.prof && r.tipo && (r.tipo === 'max' ? r.n > 0 : r.dias.length && ((r.tipo !== 'seq' && r.tipo !== 'min') || r.n > 0)) && !(r.tipo === 'seq' && r.n < 2); (comp ? ok : ruins).push(r); }
  if (ruins.length) return toast(`Complete ${ruins.length} pedido(s): professor, tipo, dia e quantidade.`, 4000);
  for (const r of ok) S.config.regras.push({ id: U.uid('r'), prof: r.prof, tipo: r.tipo, dias: r.dias, n: r.n || null, texto: r.texto, ativo: true });
  UI.pedidos = []; mudou('config'); render(); toast(`${ok.length} pedido(s) adicionado(s). Gere o horário para aplicar.`, 4000);
};
ACT.pedLiga = d => { const r = S.config.regras.find(x => x.id === d.id); r.ativo = r.ativo === false; mudou('config'); render(); };
ACT.pedDel = d => confirma('Excluir este pedido?', () => { S.config.regras = S.config.regras.filter(x => x.id !== d.id); mudou('config'); render(); }, 'Excluir', true);

/* ---------------- VALIDAÇÃO ---------------- */
const TIPOS = { regra: ['Pedidos de professores não atendidos', 2], choque: ['Professor em duas turmas no mesmo horário', 3], turma2: ['Turma com dois professores no mesmo horário', 3], indisp: ['Aula em horário indisponível do professor', 2], capacidade: ['Turma com mais aulas que horários', 3], falta: ['Aulas faltantes na grade', 1], excesso: ['Disciplina com aulas a mais', 2], carga: ['Carga horária acima ou abaixo do previsto', 1], semprof: ['Aulas sem professor definido', 1], fora: ['Aula fora do horário da turma', 2], orfa: ['Aula sem atribuição', 2] };
VIEWS.validacao = () => {
  const cor = g => g >= 3 ? 'var(--bad)' : g === 2 ? 'var(--warn)' : 'var(--muted)';
  const grupos = Object.entries(TIPOS).map(([k, [n, g]]) => ({ k, n, g, itens: PROBS.filter(p => p.tipo === k) }));
  const tot = PROBS.filter(p => p.grav >= 2).length;
  return `<div class="top"><div><h1>${tot ? tot + ' problema' + (tot > 1 ? 's' : '') + ' a corrigir' : PROBS.length ? 'Sem conflitos — só pendências' : 'Tudo certo'}</h1><p>A verificação roda a cada alteração. Clique em “Corrigir” para ir direto ao horário com o problema.</p></div></div>
  <div class="grid kpis" style="margin-bottom:14px">${grupos.map(gr => `<a class="card kpi ${gr.itens.length && gr.g >= 2 ? 'bad' : !gr.itens.length ? 'ok' : ''}" href="#v-${gr.k}" style="text-decoration:none;color:inherit"><small>${gr.n}</small><b>${gr.itens.length}</b>${gr.k === 'turma2' ? '<span>a grade não permite</span>' : ''}</a>`).join('')}</div>
  ${grupos.filter(g => g.itens.length).map(gr => `<div class="card" id="v-${gr.k}" style="margin-bottom:14px;padding:0"><div class="row" style="padding:14px 16px"><span class="dot" style="background:${cor(gr.g)};border-radius:50%"></span><h2>${gr.n}</h2><span class="tag">${gr.itens.length}</span></div>
  ${gr.itens.slice(0, 200).map((p, i) => `<div class="prob"><span class="s" style="background:${cor(p.grav)}"></span><div class="sp">${E(p.msg)}</div>${p.turma != null && p.d != null ? `<button class="btn sm" data-act="corrigir" data-t="${p.turma}" data-d="${p.d}" data-a="${p.a}">Corrigir</button>` : p.turma ? `<button class="btn sm" data-act="abrirTurma" data-t="${p.turma}">Ver turma</button>` : p.prof ? `<button class="btn sm" data-act="abrirProf" data-p="${p.prof}">Ver professor</button>` : ''}${p.atr && p.tipo === 'semprof' ? `<button class="btn sm" data-act="filtraAtr" data-t="${p.turma}">Definir professor</button>` : ''}</div>`).join('')}</div>`).join('') || '<div class="card empty">Nenhum problema encontrado.</div>'}`;
};
ACT.corrigir = d => { UI.modo = 'turma'; UI.turma = d.t; UI.sel = { t: d.t, d: +d.d, a: +d.a }; UI.flash = { t: d.t, d: +d.d, a: +d.a }; location.hash = '#grade'; render(); };
ACT.filtraAtr = d => { UI.filtroAtr = { t: d.t, p: '-', d: '', q: '' }; location.hash = '#atribuicoes'; };

/* ---------------- RELATÓRIOS ---------------- */
const REL = {
  quadro: 'Quadro geral de horários', turmas: 'Horário individual de cada turma', profs: 'Horário individual de cada professor', carga: 'Carga horária dos professores', disc: 'Distribuição de aulas por disciplina', pend: 'Aulas ainda não distribuídas', dados: 'Cadastros completos (dados)'
};
VIEWS.relatorios = () => {
  const ts = ordTurmas();
  const card = (k, desc, pdf = true, xls = true, extra = '') => `<div class="card"><h3>${REL[k]}</h3><p class="hint" style="min-height:38px">${desc}</p>${extra}<div class="row" style="margin-top:10px"><button class="btn sm" data-act="ver" data-r="${k}">Visualizar</button>${pdf ? `<button class="btn sm pri" data-act="pdf" data-r="${k}">PDF</button>` : ''}${xls ? `<button class="btn sm" data-act="xls" data-r="${k}">Excel</button>` : ''}</div></div>`;
  return `<div class="top"><div><h1>Relatórios e exportação</h1><p>PDF pronto para imprimir e Excel (.xlsx) para editar. Use “Visualizar” para conferir antes.</p></div><div class="row"><button class="btn" data-act="backup">Backup completo (.json)</button></div></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
  ${card('quadro', 'Todas as turmas lado a lado, por turno, com disciplina e professor em cada aula.')}
  ${card('turmas', 'Uma página por turma, com dias nas colunas e aulas nas linhas.', true, true, `<select id="rT" aria-label="Turma" style="width:100%"><option value="">Todas as turmas</option>${ts.map(t => `<option value="${t.id}">${E(t.nome)}</option>`).join('')}</select>`)}
  ${card('profs', 'Uma página por professor, com turma e disciplina em cada horário.', true, true, `<select id="rP" aria-label="Professor" style="width:100%"><option value="">Todos os professores</option>${S.professores.map(p => `<option value="${p.id}">${E(p.nome)}</option>`).join('')}</select>`)}
  ${card('carga', 'Carga prevista, atribuída e colocada na grade, com dias de trabalho e janelas.')}
  ${card('disc', 'Para cada disciplina: turmas, professor, aulas previstas e distribuídas.')}
  ${card('pend', 'Aulas que ainda faltam na grade e o motivo provável.')}
  ${card('dados', 'Professores, turmas, disciplinas e atribuições — para guardar ou levar a outra planilha.', false, true)}
  </div><div id="prev" style="margin-top:16px"></div>`;
};
function relDados(k, filtro) {
  const D = S.config.dias, cont = contagem(), out = [];
  if (k === 'quadro') {
    for (const [tu, cfg] of Object.entries(S.config.turnos)) {
      const ts = ordTurmas().filter(t => t.turno === tu); if (!ts.length) continue;
      const nA = Math.max(...ts.map(t => t.aulasDia)), head = ['Dia / aula', ...ts.map(t => t.sigla || t.nome)], rows = [];
      D.forEach((dia, d) => { for (let a = 0; a < nA; a++) rows.push([{ t: (a === 0 ? dia + '\n' : '\n') + (a + 1) + 'ª · ' + (cfg.horarios[a] || ''), bold: a === 0, align: 'left' }, ...ts.map(t => { const aid = (S.grade[t.id] || {})[d + '-' + a]; if (a >= t.aulasDia || d >= M.diasT(t)) return { t: '', fill: '#eceef3' }; if (!aid || !M.atr[aid]) return ''; const ds = discDe(aid), p = profDe(aid); return { t: (ds?.sigla || '') + '\n' + (p ? p.nome.split(' ')[0] : ''), bold: true, fill: ds?.cor, color: '#ffffff', color2: '#ffffff' }; })]); });
      out.push({ title: 'Quadro geral — ' + cfg.nome, head, rows, widths: [1.5, ...ts.map(() => 1)], fontSize: ts.length > 12 ? 6.5 : 7.5, rowH: ts.length > 12 ? 21 : 23, group: nA, sheet: 'Quadro ' + cfg.nome });
    }
  }
  if (k === 'turmas') for (const t of ordTurmas().filter(t => !filtro || t.id === filtro)) {
    const hs = S.config.turnos[t.turno]?.horarios || [], rows = [];
    for (let a = 0; a < t.aulasDia; a++) { const iv = intervaloAntes(t.turno, a); if (iv) rows.push([{ t: iv.nome, bold: true, align: 'left', fill: '#eceef3' }, ...D.map((x, i) => ({ t: i === Math.floor(D.length / 2) ? iv.ini + ' – ' + iv.fim : '', fill: '#eceef3', color: '#5b6475' }))]); rows.push([{ t: (a + 1) + 'ª aula\n' + (hs[a] || ''), bold: true, align: 'left' }, ...D.map((x, d) => { if (d >= M.diasT(t)) return { t: '', fill: '#eceef3' }; const aid = (S.grade[t.id] || {})[d + '-' + a]; if (!aid || !M.atr[aid]) return ''; const ds = discDe(aid), p = profDe(aid); return { t: (ds?.nome || '') + '\n' + (p?.nome || ''), bold: true, fill: ds?.cor, color: '#fff', color2: '#fff' }; })]); }
    out.push({ title: 'Horário — ' + t.nome, subtitle: turnoNome(t.turno) + ' · ' + S.config.escola, head: ['Aula', ...D], rows, widths: [0.9, ...D.map(() => 2)], fontSize: 9, sheet: t.sigla || t.nome });
  }
  if (k === 'profs') for (const p of S.professores.filter(p => !filtro || p.id === filtro)) {
    const minhas = []; for (const x of M.cells()) if (x.at && x.at.prof === p.id) minhas.push(x);
    const turnos = [...new Set(S.atribs.filter(a => a.prof === p.id).map(a => M.turma[a.turma]?.turno).filter(Boolean))].sort((a, b) => 'MVN'.indexOf(a) - 'MVN'.indexOf(b));
    const rows = [];
    for (const tu of turnos) S.config.turnos[tu].horarios.forEach((h, a) => { const cells = D.map((x, d) => { const aq = minhas.filter(y => y.t.turno === tu && y.d === d && M.hor(y.t, y.a) === h); if (!aq.length) return M.indisp[p.id].has(d + '|' + h) ? { t: 'indisponível', fill: '#f6e3e3', color: '#a33' } : ''; const ds = M.disc[aq[0].at.disc]; return { t: aq.map(y => y.t.sigla || y.t.nome).join(' + ') + '\n' + (ds?.nome || ''), bold: true, fill: aq.length > 1 ? '#c53030' : ds?.cor, color: '#fff', color2: '#fff' }; }); if (cells.some(c => c && (c.t || c) !== 'indisponível')) rows.push([{ t: turnoNome(tu).slice(0, 3) + ' ' + (a + 1) + 'ª\n' + h, bold: true, align: 'left' }, ...cells]); });
    const at = S.atribs.filter(a => a.prof === p.id), prev = p.carga ?? at.reduce((s, a) => s + a.aulas, 0);
    out.push({ title: 'Horário — ' + p.nome, subtitle: `${p.masp ? 'MASP ' + p.masp + ' · ' : ''}${at.reduce((s, a) => s + (cont[a.id] || 0), 0)} de ${prev} aulas na grade · ${S.config.escola}`, head: ['Horário', ...D], rows: rows.length ? rows : [['Sem aulas na grade', ...D.map(() => '')]], widths: [0.9, ...D.map(() => 2)], fontSize: 8.5, sheet: p.nome.split(' ')[0] + ' ' + (p.nome.split(' ').slice(-1)[0] || '') });
  }
  if (k === 'carga') {
    const rows = S.professores.map(p => {
      const at = S.atribs.filter(a => a.prof === p.id), atr = at.reduce((s, a) => s + a.aulas, 0), prev = p.carga ?? atr, g = at.reduce((s, a) => s + (cont[a.id] || 0), 0);
      const porDia = {}; for (const x of M.cells()) if (x.at && x.at.prof === p.id) (porDia[x.t.turno + x.d] ||= []).push(x.a);
      const janelas = Object.values(porDia).reduce((s, L) => s + (Math.max(...L) - Math.min(...L) + 1 - L.length), 0), dias = new Set(Object.keys(porDia).map(k => k.slice(1))).size;
      return [{ t: p.nome, align: 'left' }, p.masp || '', prev, atr, g, { t: g === prev ? 'Completa' : g < prev ? 'Faltam ' + (prev - g) : 'Excede ' + (g - prev), color: g === prev ? '#18805b' : '#c53030', bold: true }, dias, janelas, { t: [...new Set(at.map(a => M.disc[a.disc]?.sigla))].join(', '), align: 'left' }];
    });
    out.push({ title: 'Carga horária dos professores', subtitle: S.config.escola + ' · ' + S.professores.length + ' professores', head: ['Professor', 'MASP', 'Prevista', 'Atribuída', 'Na grade', 'Situação', 'Dias', 'Janelas', 'Disciplinas'], rows, widths: [3.2, 1.2, 0.8, 0.8, 0.8, 1.1, 0.6, 0.7, 2.6], fontSize: 8, sheet: 'Carga horária' });
  }
  if (k === 'disc') {
    const rows = [];
    for (const d of S.disciplinas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))) for (const a of S.atribs.filter(x => x.disc === d.id).sort((x, y) => (M.turma[x.turma]?.nome || '').localeCompare(M.turma[y.turma]?.nome || '', 'pt', { numeric: true }))) {
      const n = cont[a.id] || 0; rows.push([{ t: d.nome, align: 'left' }, { t: M.turma[a.turma]?.nome || '', align: 'left' }, { t: M.prof[a.prof]?.nome || '— sem professor —', align: 'left' }, a.aulas, n, { t: n === a.aulas ? 'OK' : n < a.aulas ? 'Faltam ' + (a.aulas - n) : 'Excede ' + (n - a.aulas), color: n === a.aulas ? '#18805b' : '#c53030', bold: true }]);
    }
    out.push({ title: 'Distribuição de aulas por disciplina', subtitle: S.config.escola, head: ['Disciplina', 'Turma', 'Professor', 'Previstas', 'Na grade', 'Situação'], rows, widths: [3, 2, 3, 0.8, 0.8, 1], fontSize: 8, sheet: 'Por disciplina' });
  }
  if (k === 'pend') {
    const rows = [];
    for (const a of S.atribs) { const n = cont[a.id] || 0; if (n >= a.aulas) continue; const mot = !a.prof ? 'Sem professor definido' : (UI.lastGen?.naoAlocadas.find(x => x.atr === a.id)?.motivo) || Gerador.motivo(S, S.grade, a); rows.push([{ t: M.turma[a.turma]?.nome || '', align: 'left' }, { t: M.disc[a.disc]?.nome || '', align: 'left' }, { t: M.prof[a.prof]?.nome || '—', align: 'left' }, a.aulas - n, { t: mot, align: 'left' }]); }
    out.push({ title: 'Aulas ainda não distribuídas', subtitle: rows.length ? rows.reduce((s, r) => s + r[3], 0) + ' aulas pendentes' : 'Nenhuma pendência', head: ['Turma', 'Disciplina', 'Professor', 'Faltam', 'Motivo provável'], rows: rows.length ? rows : [['Todas as aulas estão na grade', '', '', '', '']], widths: [1.6, 2.2, 2.2, 0.6, 5], fontSize: 8, sheet: 'Não distribuídas' });
  }
  if (k === 'dados') {
    out.push({ title: 'Professores', head: ['Nome', 'MASP', 'Carga prevista', 'Indisponibilidades', 'Observações'], rows: S.professores.map(p => [p.nome, p.masp, p.carga ?? '', p.indisp.map(x => { const [d, h] = x.split('|'); return S.config.dias[d]?.slice(0, 3) + ' ' + h; }).join(', '), p.obs || '']), sheet: 'Professores' });
    out.push({ title: 'Turmas', head: ['Turma', 'Sigla', 'Turno', 'Aulas por dia', 'Dias letivos'], rows: ordTurmas().map(t => [t.nome, t.sigla || '', turnoNome(t.turno), t.aulasDia, M.diasT(t)]), sheet: 'Turmas' });
    out.push({ title: 'Disciplinas', head: ['Disciplina', 'Sigla', 'Cor'], rows: S.disciplinas.map(d => [d.nome, d.sigla, d.cor]), sheet: 'Disciplinas' });
    out.push({ title: 'Atribuições', head: ['Turma', 'Turno', 'Disciplina', 'Professor', 'Aulas por semana', 'Na grade'], rows: S.atribs.map(a => [M.turma[a.turma]?.nome || '', turnoNome(M.turma[a.turma]?.turno), M.disc[a.disc]?.nome || '', M.prof[a.prof]?.nome || '', a.aulas, cont[a.id] || 0]), sheet: 'Atribuições' });
    const gr = [['Turma', 'Dia', 'Aula', 'Horário', 'Disciplina', 'Professor']];
    for (const t of ordTurmas()) for (let d = 0; d < D.length; d++) for (let a = 0; a < t.aulasDia; a++) { const aid = (S.grade[t.id] || {})[d + '-' + a]; if (aid && M.atr[aid]) gr.push([t.nome, D[d], a + 1, M.hor(t, a), discDe(aid)?.nome || '', profDe(aid)?.nome || '']); }
    out.push({ title: 'Grade (lista)', head: gr[0], rows: gr.slice(1), sheet: 'Grade' });
  }
  return out;
}
const txt = c => c && typeof c === 'object' ? String(c.t ?? '') : String(c ?? '');
function gerarPDF(k, filtro) {
  const doc = new PDF.Doc(k !== 'disc'), agora = new Date().toLocaleString('pt-BR');
  for (const t of relDados(k, filtro)) PDF.table(doc, { ...t, subtitle: t.subtitle || S.config.escola + ' · ' + S.config.ano, right: 'Emitido em ' + agora, footer: S.config.escola + ' — ' + REL[k] });
  return doc.out();
}
function gerarXLS(k, filtro) {
  const tabs = relDados(k, filtro), sheets = [];
  if (k === 'turmas' || k === 'profs') {
    const rows = [], styles = {};
    for (const t of tabs) { styles[rows.length] = 3; rows.push([t.title]); styles[rows.length] = 1; rows.push(t.head); for (const r of t.rows) rows.push(r.map(txt).map(s => s.replace(/\n/g, ' — '))); rows.push([]); }
    sheets.push({ name: k === 'turmas' ? 'Horários por turma' : 'Horários por professor', rows, styles, widths: [16, ...S.config.dias.map(() => 30)] });
    if (!filtro) for (const t of tabs) sheets.push({ name: t.sheet, rows: [[t.title], t.head, ...t.rows.map(r => r.map(txt).map(s => s.replace(/\n/g, ' — ')))], styles: { 0: 3, 1: 1 }, widths: [16, ...S.config.dias.map(() => 30)], freeze: 2 });
  } else for (const t of tabs) sheets.push({ name: t.sheet || t.title, rows: [[t.title], t.head, ...t.rows.map(r => r.map(c => typeof c === 'number' ? c : (c && typeof c === 'object' && typeof c.t === 'number') ? c.t : txt(c).replace(/\n/g, ' — ')))], styles: { 0: 3, 1: 1 }, widths: t.head.map((h, i) => i === 0 ? 30 : k === 'quadro' ? 16 : Math.max(12, Math.min(60, String(h).length + 10))), freeze: 2 });
  return XLSX.write(sheets);
}
const nomeArq = (k, f) => ('Horario_' + REL[k] + (f ? '_' + (M.turma[f]?.nome || M.prof[f]?.nome || '') : '')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/_+$/, '');
const filtroRel = k => k === 'turmas' ? $('rT')?.value : k === 'profs' ? $('rP')?.value : '';
ACT.pdf = d => { if (!S.turmas.length) return toast('Sem dados.'); baixar(nomeArq(d.r, filtroRel(d.r)) + '.pdf', gerarPDF(d.r, filtroRel(d.r)), 'application/pdf'); };
ACT.xls = d => { if (!S.turmas.length) return toast('Sem dados.'); baixar(nomeArq(d.r, filtroRel(d.r)) + '.xlsx', gerarXLS(d.r, filtroRel(d.r)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); };
ACT.exportDados = () => ACT.xls({ r: 'dados' });
ACT.backup = () => baixar('backup_quadro_horarios_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(S), 'application/json');
ACT.ver = d => {
  const tabs = relDados(d.r, filtroRel(d.r));
  $('prev').innerHTML = `<div class="card"><div class="row"><h2>${REL[d.r]}</h2><span class="sp"></span><button class="btn sm" data-act="copiarRel" data-r="${d.r}">Copiar como tabela</button></div>` + tabs.map(t => `<h3 style="margin-top:14px">${E(t.title)}</h3>${t.subtitle ? `<p class="hint">${E(t.subtitle)}</p>` : ''}<div class="tbl" style="margin-top:6px"><table><thead><tr>${t.head.map(h => `<th>${E(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(c => { const o = c && typeof c === 'object' ? c : { t: c }; return `<td style="${o.fill ? `background:${o.fill};` : ''}${o.color ? `color:${o.color};` : ''}${o.bold ? 'font-weight:600;' : ''}font-size:12.5px">${E(String(o.t ?? '')).replace(/\n/g, '<br><small>') }</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`).join('') + '</div>';
  $('prev').scrollIntoView({ behavior: 'smooth' });
};
ACT.copiarRel = async d => { const tabs = relDados(d.r, filtroRel(d.r)); const s = tabs.map(t => t.title + '\n' + t.head.join('\t') + '\n' + t.rows.map(r => r.map(txt).map(x => x.replace(/\n/g, ' — ')).join('\t')).join('\n')).join('\n\n'); try { await navigator.clipboard.writeText(s); toast('Copiado. Cole no Excel com Ctrl+V.'); } catch (e) { toast('O navegador bloqueou a cópia.'); } };

/* ---------------- CONFIGURAÇÕES ---------------- */
VIEWS.ajustes = () => {
  const c = S.config, todos = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `<div class="top"><div><h1>Configurações</h1><p>Dados da escola, dias letivos, horários de cada turno e preferências do gerador.</p></div><button class="btn pri" data-act="salvaCfg">Salvar configurações</button></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
  <div class="card grid"><h2>Escola</h2><label class="f">Nome da escola<input type="text" id="cEsc" value="${E(c.escola)}"></label><label class="f">Ano letivo<input type="number" id="cAno" value="${c.ano || ''}" style="width:120px"></label>
   <div><b style="font-size:13px">Dias letivos</b><div class="row" style="margin-top:6px">${todos.map(d => `<label class="row" style="gap:4px"><input type="checkbox" class="cDia" value="${d}" ${c.dias.includes(d) ? 'checked' : ''}>${d}</label>`).join('')}</div></div></div>
  <div class="card grid"><h2>Horários dos turnos</h2><p class="hint">Início de cada aula, separados por vírgula. Professores que dão aula em turnos diferentes só têm conflito quando os horários coincidem.</p>
   ${Object.entries(c.turnos).map(([k, t]) => `<div class="grid" style="gap:6px"><label class="f">${E(t.nome)} — início de cada aula (${t.horarios.length} aulas)<input type="text" class="cTur" data-k="${k}" value="${E(t.horarios.join(', '))}"></label><label class="f">Intervalos do ${E(t.nome.toLowerCase())}<input type="text" class="cInt" data-k="${k}" value="${E((t.intervalos || []).map(iv => iv.ini + '-' + iv.fim + ' ' + iv.nome).join('; '))}" placeholder="09:25-09:45 Recreio; 12:10-13:10 Almoço"></label></div>`).join('')}
   <p class="hint">Turmas com menos aulas por dia usam só os primeiros horários do turno (ex.: regular com 6 aulas termina antes do almoço; EMTI com 7 usa também a aula das 13:10).</p></div>
  <div class="card grid"><h2>Preferências do gerador</h2>
   <label class="f">Máximo de aulas da mesma disciplina no mesmo dia<input type="number" id="cMax" min="1" max="6" value="${c.prefs.maxMesmaDiscDia}"></label>
   <label class="row"><input type="checkbox" id="cAC" ${c.acFora !== false ? 'checked' : ''}> Atividades complementares ficam fora da grade (vale para as próximas importações)</label>
   <label class="row"><input type="checkbox" id="cEFN" ${c.efNoturnoFora !== false ? 'checked' : ''}> Educação Física não tem horário nas turmas do noturno (vale para as próximas importações)</label>
   <label class="row"><input type="checkbox" id="cDupla" ${c.prefs.permitirDupla !== false ? 'checked' : ''}> Permitir aula dupla (duas seguidas da mesma disciplina)</label>
   <p class="hint">Regras obrigatórias (sempre respeitadas): professor em uma turma por vez, disponibilidade do professor, quantidade de aulas de cada disciplina, aulas por dia da turma. As preferências acima e “evitar janelas” entram como penalidade.</p></div>
  ${cardAssinatura()}
  ${WEB ? `<div class="card grid"><h2>Minha senha</h2><p class="hint">Conectado como <b>${E(Auth.eu?.nome)}</b> (${E(Auth.eu?.usuario)}).</p><div class="row"><button class="btn" data-act="minhaSenha">Trocar minha senha</button></div></div>` : ''}
  ${WEB && Auth.eu?.papel === 'admin' ? `<div class="card grid" style="grid-column:1/-1"><div class="row"><h2>Usuários com acesso</h2><span class="sp"></span><button class="btn pri sm" data-act="editUsu">Novo usuário</button></div><p class="hint">Cada pessoa entra com usuário e senha. No primeiro acesso, o sistema pede para ela criar a própria senha. Administradores também gerenciam usuários.</p><div id="listaUsu" class="muted">Carregando…</div></div>` : ''}
  <div class="card grid"><h2>Dados</h2><p class="hint">${WEB ? 'Os dados da escola ficam guardados no servidor e aparecem para todos os usuários da escola, em qualquer computador ou celular. Baixe um backup de vez em quando.' : P.db ? 'Os dados ficam no banco de dados desta página e aparecem em qualquer dispositivo em que você abrir este link.' : 'Banco de dados indisponível nesta visualização: os dados ficam salvos só neste navegador. Faça backups.'}</p>
   <div class="row"><button class="btn" data-act="backup">Baixar backup (.json)</button><button class="btn" data-act="escolherArq">Restaurar backup</button><button class="btn danger" data-act="apagaTudo">Apagar todos os dados</button></div></div>
  </div>`;
};
VIEWS.ajustes.after = () => { if (WEB && Auth.eu?.papel === 'admin') carregaUsuarios(); };
let USUS = [];
async function carregaUsuarios() {
  const el = $('listaUsu'); if (!el) return;
  try { USUS = await rpc('quadro_usuarios_lista', { p_token: Auth.token }) || []; }
  catch (e) { el.textContent = msgErro(e); return; }
  el.className = '';
  el.innerHTML = `<div class="tbl"><table class="stack"><thead><tr><th>Nome</th><th>Usuário</th><th>Papel</th><th>Situação</th><th></th></tr></thead><tbody>${USUS.map(u => `<tr><td>${E(u.nome)}</td><td>${E(u.usuario)}</td><td>${u.papel === 'admin' ? 'Administrador' : 'Editor'}</td><td>${u.ativo ? '<span class="tag ok">ativo</span>' : '<span class="tag">bloqueado</span>'}</td><td><button class="btn sm" data-act="editUsu" data-id="${u.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>`;
}
ACT.editUsu = d => {
  const u = d.id ? USUS.find(x => String(x.id) === d.id) : { nome: '', usuario: '', papel: 'editor', ativo: true };
  drawer(`<div class="row"><h2>${d.id ? 'Editar usuário' : 'Novo usuário'}</h2><span class="sp"></span><button class="btn sm ghost" data-x>Fechar</button></div>
  <div class="grid" style="margin-top:14px"><label class="f">Nome<input type="text" id="uN" value="${E(u.nome)}"></label>
  <label class="f">Usuário (para entrar)<input type="text" id="uU" value="${E(u.usuario)}" autocapitalize="none" placeholder="ex.: maria.silva"></label>
  <label class="f">Papel<select id="uP"><option value="editor" ${u.papel === 'editor' ? 'selected' : ''}>Editor — monta e edita o quadro</option><option value="admin" ${u.papel === 'admin' ? 'selected' : ''}>Administrador — também gerencia usuários</option></select></label>
  <label class="row"><input type="checkbox" id="uA" ${u.ativo ? 'checked' : ''}> Acesso ativo</label>
  <label class="f">${d.id ? 'Nova senha provisória (deixe vazio para manter)' : 'Senha provisória'}<input type="text" id="uS" autocomplete="off" placeholder="mínimo 6 caracteres"></label>
  <p class="hint">Passe o usuário e a senha provisória para a pessoa. No primeiro acesso ela cria a própria senha.</p></div>
  <div class="row" style="margin-top:16px">${d.id && String(d.id) !== String(USUS.find(x => x.usuario === Auth.eu.usuario)?.id) ? `<button class="btn danger" data-act="delUsu" data-id="${d.id}">Excluir</button>` : ''}<span class="sp"></span><button class="btn" data-x>Cancelar</button><button class="btn pri" data-act="salvaUsu" data-id="${d.id || ''}">Salvar</button></div>`);
};
ACT.salvaUsu = async d => {
  const usu = $('uU').value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(usu)) return toast('Usuário: de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado, sem espaços.');
  if (!d.id && $('uS').value.length < 6) return toast('Defina uma senha provisória com pelo menos 6 caracteres.');
  try { await rpc('quadro_salvar_usuario', { p_token: Auth.token, p_id: d.id ? +d.id : null, p_usuario: usu, p_nome: $('uN').value, p_papel: $('uP').value, p_senha: $('uS').value || null, p_ativo: $('uA').checked }); fecha(); toast('Usuário salvo.'); carregaUsuarios(); }
  catch (e) { toast(msgErro(e), 5000); }
};
ACT.delUsu = d => confirma('Excluir este usuário? Ele perde o acesso imediatamente.', async () => { try { await rpc('quadro_excluir_usuario', { p_token: Auth.token, p_id: +d.id }); fecha(); toast('Usuário excluído.'); carregaUsuarios(); } catch (e) { toast(msgErro(e)); } }, 'Excluir', true);
ACT.minhaSenha = () => {
  modal(`<h2>Trocar minha senha</h2><form id="fMinha" class="grid" style="margin-top:12px"><label class="f">Senha atual<input type="password" id="mA" required></label><label class="f">Nova senha<input type="password" id="mN" required></label><label class="f">Repita a nova senha<input type="password" id="mR" required></label><p id="mMsg" style="color:var(--bad);min-height:20px;margin:0"></p><div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">Salvar</button></div></form>`);
  $('fMinha').onsubmit = async ev => { ev.preventDefault(); if ($('mN').value !== $('mR').value) return $('mMsg').textContent = 'As senhas não conferem.'; try { await rpc('quadro_trocar_senha', { p_token: Auth.token, p_atual: $('mA').value, p_nova: $('mN').value }); fecha(); toast('Senha alterada.'); } catch (e) { $('mMsg').textContent = msgErro(e); } };
};
ACT.verAssinatura = () => setTimeout(() => $('assinatura')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
ACT.salvaCfg = () => {
  const c = S.config, dias = [...document.querySelectorAll('.cDia:checked')].map(x => x.value);
  if (!dias.length) return toast('Escolha pelo menos um dia letivo.');
  const tur = {}; for (const el of document.querySelectorAll('.cTur')) { const hs = el.value.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean); if (!hs.length || hs.some(h => !/^\d{1,2}[:h]\d{2}$/.test(h))) return toast(`Horários inválidos em ${c.turnos[el.dataset.k].nome}. Use o formato 07:00, 07:50…`); tur[el.dataset.k] = hs.map(h => h.replace('h', ':').padStart(5, '0')); }
  snap();
  c.escola = $('cEsc').value.trim() || c.escola; c.ano = +$('cAno').value || c.ano; c.dias = dias;
  for (const [k, hs] of Object.entries(tur)) c.turnos[k].horarios = hs;
  for (const el of document.querySelectorAll('.cInt')) { const ivs = []; for (const part of el.value.split(';').map(x => x.trim()).filter(Boolean)) { const m = /^(\d{1,2}[:h]\d{2})\s*[-–a]+\s*(\d{1,2}[:h]\d{2})\s*(.*)$/i.exec(part); if (!m) return toast(`Intervalo inválido: “${part}”. Use o formato 09:25-09:45 Recreio.`); const f = h => h.replace('h', ':').padStart(5, '0'); ivs.push({ ini: f(m[1]), fim: f(m[2]), nome: m[3].trim() || 'Intervalo' }); } c.turnos[el.dataset.k].intervalos = ivs; }
  c.prefs.maxMesmaDiscDia = Math.max(1, +$('cMax').value || 2); c.prefs.permitirDupla = $('cDupla').checked; c.acFora = $('cAC').checked; c.efNoturnoFora = $('cEFN').checked;
  S.turmas.forEach(t => { const max = c.turnos[t.turno]?.horarios.length || t.aulasDia; if (t.aulasDia > max) t.aulasDia = max; });
  mudou('config', 'turmas'); render(); toast('Configurações salvas.');
};
ACT.apagaTudo = () => confirma('Apagar professores, turmas, disciplinas, atribuições e a grade? Esta ação não pode ser desfeita (baixe um backup antes).', () => { const cfg = S.config; S = Store.vazio(cfg); UI.undo = []; mudou(...DOCS); location.hash = '#painel'; render(); toast('Dados apagados.'); }, 'Apagar tudo', true);

/* ---------------- início ---------------- */
if (window.__TEST) window.__T = { gerarPDF, gerarXLS, relDados, get S() { return S; } };
(async () => { await P.load(); recalc(); render(); if (UI.boasVindas) toast('Conta criada! Comece importando o quadro de distribuição de aulas ou cadastrando as turmas.', 7000); if (UI.migrou) { P.mark(...DOCS); toast(`As atividades complementares (${UI.migrou} disciplinas) saíram da grade. Gere o horário de novo.`, 7000); } if (UI.migrouEF) { P.mark(...DOCS); toast(`Educação Física saiu do noturno (${UI.migrouEF} turmas). Ela não tem horário nas turmas da noite.`, 7000); } })();
}
