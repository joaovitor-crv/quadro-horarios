# Quadro de Horários

Sistema online para escolas montarem o horário das aulas: importa o quadro de distribuição de aulas (Excel), confere professores, turmas e quantidades, gera o horário automaticamente, permite ajustar arrastando as aulas, aponta conflitos e exporta em PDF e Excel.

Vendido por escola, com teste grátis de 15 dias e cobrança manual (Pix ou boleto).

## O que tem no site (pasta `site/`)
| Endereço | O que é |
|---|---|
| `/` | Página de vendas (recursos, preço, perguntas, botão de teste grátis) |
| `/app/` | O sistema. `/app/#criar` abre o cadastro de uma escola nova |
| `/admin/` | Painel do dono: escolas, situação, registrar pagamento, estender teste, suspender, gerar senha provisória, excluir escola |
| `/termos.html`, `/privacidade.html` | Termos de uso e política de privacidade (LGPD) |

## Como funciona a venda
1. A escola cria a conta em `/app/#criar` (ou pelo botão "Testar grátis"). Quem cria vira o administrador da escola e cadastra a equipe em **Configurações → Usuários com acesso**.
2. O teste dura 15 dias. O sistema mostra quantos dias faltam e, em **Configurações → Assinatura**, como assinar.
3. A escola paga por Pix ou boleto direto ao dono. No `/admin/`, o dono clica em **Gerenciar → + 1 mês** ou **+ 1 ano**.
4. Se vencer, a escola continua vendo, imprimindo e exportando, mas não salva alterações até renovar.

Preço, contato e dias de teste ficam em `fonte/site.json`. O número de dias do teste criado no banco está na função `quadro_cadastrar_escola` (`current_date + 15`).

## Banco de dados (Supabase)
- Cada escola tem os dados separados (`quadro_escolas`, `quadro_docs.escola_id`, `quadro_usuarios.escola_id`).
- Todo acesso passa por funções (`quadro_*`) com o token da sessão; as tabelas têm RLS ligado e nenhuma política, então não são lidas diretamente pela API.
- O dono do sistema é um usuário com `dono = true` e sem escola; ele entra pelo `/admin/`.
- Script da migração: `supabase/01_varias_escolas.sql` (já aplicado).

## Publicar na Cloudflare Pages (grátis)
1. Crie a conta em https://dash.cloudflare.com/sign-up.
2. **Workers & Pages → Create → Pages → Connect to Git**, autorize o GitHub e escolha `quadro-horarios`.
3. Configuração do build: *Framework preset* **None**, *Build command* vazio, *Build output directory* **`site`**.
4. **Save and Deploy**. O endereço fica `https://<nome>.pages.dev`. Cada push na `main` publica sozinho.
5. (Opcional) Domínio próprio: **Custom domains → Set up a domain**.

Depois de conferir que tudo abre pela Cloudflare, o repositório pode virar privado (**Settings → General → Change visibility**). O GitHub Pages deixa de funcionar nesse momento, então avise a escola que já usa o sistema para trocar o link.

## Manutenção
Tudo é gerado a partir da pasta `fonte/`:

```
python3 fonte/build.py
```

- `fonte/core.js`: leitura de Excel, importação do quadro, gerador de horário, validação, PDF e Excel.
- `fonte/app.js`: telas, login, cadastro, aviso de vencimento e gravação no Supabase.
- `fonte/page.html`: layout e estilos do sistema.
- `fonte/site/`: página de vendas, termos, privacidade, painel do dono e estilos.
- `fonte/site.json`: nome, preços, dias de teste e contato.
- `index.html` na raiz: cópia do sistema para o link antigo do GitHub Pages.

Desenvolvido por João Vitor - CRV
