# Gera o site a partir dos fontes: python3 fonte/build.py (rodar na raiz do repositório)
#   site/index.html  -> o sistema (pasta publicada pela Cloudflare Pages)
#   site/admin/      -> painel do dono (escolas, liberação, senhas)
#   index.html       -> cópia do sistema na raiz (link do GitHub Pages, enquanto ele existir)
import json, os, re, shutil
d = os.path.dirname(os.path.abspath(__file__))
raiz = os.path.join(d, '..')
site = os.path.join(raiz, 'site')
ler = lambda *p: open(os.path.join(d, *p), encoding='utf-8').read()
shutil.rmtree(site, ignore_errors=True)

SUPA = {"url": "https://xafbnwjxypdzizntkboh.supabase.co", "key": "sb_publishable_PQhSXGWpCE77hQ32vwUIDg_ThiBaZPw"}
cfg_js = '<script>window.QH_SUPA=' + json.dumps(SUPA) + ';</script>\n'

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
grava('site/index.html', out)
grava('index.html', out)

# ---------- painel do dono ----------
logo = re.search(r'<svg width="38".*?</svg>', page, re.S).group(0).replace('width="38" height="38"', 'width="32" height="32"')
grava('site/admin/index.html', ler('site', 'admin.html').replace('{{logo}}', logo).replace('<script>\n', cfg_js + '<script>\n', 1))
grava('site/admin/estilo.css', ler('site', 'estilo.css'))
grava('site/_headers', """/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000
  X-Robots-Tag: noindex
  Cache-Control: no-cache
/admin/*
  Cache-Control: no-store
""")
grava('site/robots.txt', "User-agent: *\nDisallow: /\n")
