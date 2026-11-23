# Quadro de Horários

Sistema para montar o horário das aulas da escola: importa o quadro de distribuição de aulas (Excel), confere professores, turmas e quantidades, gera o horário automaticamente, permite ajustar arrastando as aulas, aponta conflitos e exporta em PDF e Excel.

## Como usar
1. Entre com seu usuário e senha. No primeiro acesso, o sistema pede para você criar a sua senha.
2. **Importar quadro**: envie a planilha do quadro de distribuição (.xlsx ou .xlsm), confira e confirme.
3. **Configurações**: ajuste os horários de início das aulas de cada turno.
4. **Gerar horário automaticamente**.
5. **Pedidos dos professores** (opcional): escreva pedidos como "Professor X quer 4 aulas seguidas na segunda"; o gerador respeita.
6. **Grade de horários**: ajuste arrastando as aulas; a **Validação** mostra os conflitos.
7. **Relatórios**: quadro geral, horário por turma, por professor, carga horária, distribuição por disciplina e aulas pendentes, em PDF ou Excel.

## Várias escolas e acesso
- Cada escola tem os dados e os usuários separados no Supabase (`quadro_escolas`, `quadro_docs`, `quadro_usuarios`). Uma escola não vê nada de outra.
- Não existe cadastro pelo site: **só o dono cria escolas**, pelo painel `/admin/` (botão **Nova escola**), com o usuário e a senha provisória do administrador da escola. As condições são combinadas direto com cada escola.
- No painel o dono também: libera o acesso até uma data (+1 mês, +1 ano ou data escolhida), suspende a escola (ninguém dela entra e as sessões caem na hora), gera senha provisória para o administrador e exclui a escola.
- Escola com a data vencida continua entrando para consultar, imprimir e exportar, mas não salva alterações.
- Dentro da escola, o administrador cria os usuários em **Configurações → Usuários com acesso** (administrador ou editor).

## Segurança
- As tabelas têm RLS ligado, sem políticas e sem permissão para os papéis da API: nada é lido ou gravado direto. Todo acesso passa pelas funções `quadro_*`, que exigem o token da sessão e filtram pela escola do usuário.
- Senhas com bcrypt, bloqueio de 15 minutos após 8 tentativas erradas, sessão de 30 dias (12 horas para o dono), troca de senha obrigatória no primeiro acesso.
- Funções internas (`quadro__*`) não ficam expostas na API.
- Migrações: `supabase/01_varias_escolas.sql` e `supabase/02_seguranca.sql`.

## Publicar na Cloudflare Pages (grátis, aceita repositório privado)
1. Crie a conta em https://dash.cloudflare.com/sign-up.
2. **Workers & Pages → Create → Pages → Connect to Git**, autorize o GitHub e escolha `quadro-horarios`.
3. *Framework preset* **None**, *Build command* vazio, *Build output directory* **`site`**.
4. **Save and Deploy**. O sistema fica em `https://<nome>.pages.dev` e o painel do dono em `https://<nome>.pages.dev/admin/`. Cada push na `main` publica sozinho.

Depois de conferir que abre pela Cloudflare, o repositório pode virar privado (**Settings → General → Change visibility**). O link do GitHub Pages para de funcionar nesse momento.

## Manutenção
Tudo é gerado a partir da pasta `fonte/`:

```
python3 fonte/build.py
```

- `fonte/core.js`: leitura de Excel, importação do quadro, gerador de horário, validação, PDF e Excel.
- `fonte/app.js`: telas, login e gravação no Supabase.
- `fonte/page.html`: layout e estilos.
- `fonte/site/admin.html` e `estilo.css`: painel do dono.
- Saída: `site/` (Cloudflare) e `index.html` na raiz (GitHub Pages).

Desenvolvido por João Vitor - CRV
