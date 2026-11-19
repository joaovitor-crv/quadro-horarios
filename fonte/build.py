# Gera o index.html do site a partir dos fontes: python3 fonte/build.py (rodar na raiz do repositório)
import json, os
d = os.path.dirname(os.path.abspath(__file__))
w = json.load(open(os.path.join(d, 'widths.json')))
core = open(os.path.join(d, 'core.js')).read().replace('__WH__', json.dumps(w['WH'])).replace('__WB__', json.dumps(w['WB']))
core = core.replace("if (typeof module !== 'undefined') module.exports", "if (typeof module !== 'undefined' && module.exports) module.exports")
app = open(os.path.join(d, 'app.js')).read()
page = open(os.path.join(d, 'page.html')).read()
out = page.replace('__CORE__', core.replace('</script', '<\\/script')).replace('__APP__', app.replace('</script', '<\\/script'))
cfg = '<script>window.QH_SUPA={url:"https://xafbnwjxypdzizntkboh.supabase.co",key:"sb_publishable_PQhSXGWpCE77hQ32vwUIDg_ThiBaZPw"};</script>\n<script>\n'
out = out.replace('<script>\n', cfg, 1)
open(os.path.join(d, '..', 'index.html'), 'w').write(out)
print('index.html gerado:', len(out), 'bytes')
