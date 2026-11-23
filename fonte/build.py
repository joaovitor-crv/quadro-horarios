# Gera o site a partir dos fontes: python3 fonte/build.py (rodar na raiz do repositório)
#   site/            -> pasta publicada pela Cloudflare Pages
#     index.html     -> página de vendas
#     app/           -> o sistema (Quadro de Horários)
#     admin/         -> painel do dono (escolas, pagamentos, senhas)
#     termos.html, privacidade.html, estilo.css, _headers, _redirects
#   index.html       -> cópia do sistema na raiz (link antigo do GitHub Pages, enquanto ele existir)
import json, os, re, datetime
d = os.path.dirname(os.path.abspath(__file__))
raiz = os.path.join(d, '..')
site = os.path.join(raiz, 'site')
ler = lambda *p: open(os.path.join(d, *p), encoding='utf-8').read()

SUPA = {"url": "https://xafbnwjxypdzizntkboh.supabase.co", "key": "sb_publishable_PQhSXGWpCE77hQ32vwUIDg_ThiBaZPw"}
cfg = json.loads(ler('site.json'))
cfg_js = '<script>window.QH_SUPA=' + json.dumps(SUPA) + ';window.QH_SITE=' + json.dumps(cfg, ensure_ascii=False) + ';</script>\n'

def grava(rel, txt):
    p = os.path.join(raiz, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(txt); print(f'{rel}: {len(txt):,} bytes')

# ---------- sistema ----------
w = json.loads(ler('widths.json'))
core = ler('core.js').replace('__WH__', json.dumps(w['WH'])).replace('__WB__', json.dumps(w['WB']))
core = core.replace("if (typeof module !== 'undefined') module.exports", "if (typeof module !== 'undefined' && module.exports) module.exports")
app = ler('app.js')
page = ler('page.html')
out = page.replace('__CORE__', core.replace('</script', '<\\/script')).replace('__APP__', app.replace('</script', '<\\/script'))
out = out.replace('<script>\n', cfg_js + '<script>\n', 1)
grava('site/app/index.html', out)
grava('index.html', out)

# ---------- páginas públicas ----------
logo = re.search(r'<svg width="38".*?</svg>', page, re.S).group(0).replace('width="38" height="38"', 'width="32" height="32"')
contato = [f'<a href="mailto:{cfg["email"]}">{cfg["email"]}</a>'] if cfg.get('email') else []
if cfg.get('whatsapp'):
    num = re.sub(r'\D', '', cfg['whatsapp']); num = '55' + num if len(num) <= 11 else num
    contato.insert(0, f'<a href="https://wa.me/{num}" target="_blank" rel="noopener">WhatsApp {cfg["whatsapp"]}</a>')
hoje = datetime.date.today()
meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
vals = {
    'logo': logo, 'teste_dias': str(cfg['teste_dias']),
    'responsavel': cfg['responsavel'], 'ano': str(hoje.year), 'atualizado': f'{hoje.day} de {meses[hoje.month - 1]} de {hoje.year}',
    'contato_html': ' · '.join(contato), 'contato_txt': ' ou '.join(re.sub('<[^>]+>', '', c) for c in contato) or 'pelo e-mail do rodapé',
}
def preenche(txt):
    txt = re.sub(r'\{\{(\w+)\}\}', lambda m: vals[m.group(1)], txt)
    return txt
for nome in ['index.html', 'termos.html', 'privacidade.html']:
    grava('site/' + nome, preenche(ler('site', nome)))
grava('site/admin/index.html', preenche(ler('site', 'admin.html')).replace('<script>\n', cfg_js + '<script>\n', 1))
grava('site/estilo.css', ler('site', 'estilo.css'))
grava('site/_headers', """/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000
/app/*
  Cache-Control: no-cache
/admin/*
  Cache-Control: no-store
  X-Robots-Tag: noindex
""")
grava('site/_redirects', "/entrar /app/ 302\n/cadastro /app/#criar 302\n/dono /admin/ 302\n")
grava('site/robots.txt', "User-agent: *\nDisallow: /app/\nDisallow: /admin/\n")
