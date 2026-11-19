# Quadro de Horários Escolar

Sistema para montar o horário das aulas da escola: importa o quadro de distribuição de aulas (Excel), confere professores, turmas e quantidades, gera o horário automaticamente, permite ajustar arrastando as aulas, aponta conflitos e exporta em PDF e Excel.

**Acesse:** https://joaovitor-crv.github.io/quadro-horarios/

## Como usar
1. Entre com seu usuário e senha. No primeiro acesso, o sistema pede para você criar a sua senha.
2. **Importar quadro**: envie a planilha do quadro de distribuição (.xlsx ou .xlsm), confira e confirme.
3. **Configurações**: ajuste os horários de início das aulas de cada turno.
4. **Gerar horário automaticamente**.
5. **Pedidos dos professores** (opcional): escreva pedidos como "Professor X quer 4 aulas seguidas na segunda"; o gerador respeita.
6. **Grade de horários**: ajuste arrastando as aulas; a **Validação** mostra os conflitos.
7. **Relatórios**: quadro geral, horário por turma, por professor, carga horária, distribuição por disciplina e aulas pendentes, em PDF ou Excel.

## Acesso
- Os dados ficam no Supabase (tabelas `quadro_*`) e são os mesmos para todos os usuários, em qualquer computador ou celular.
- Usuários são criados pelo administrador em **Configurações → Usuários com acesso**.
- Administrador: gerencia usuários e edita o quadro. Editor: edita o quadro.

## Manutenção
O site é um único `index.html`, gerado a partir da pasta `fonte/`:

```
python3 fonte/build.py
```

- `fonte/core.js` — leitura de Excel, importação do quadro, gerador de horário, validação, PDF e Excel.
- `fonte/app.js` — telas, login e gravação no Supabase.
- `fonte/page.html` — layout e estilos.

Desenvolvido por João Vitor - CRV
