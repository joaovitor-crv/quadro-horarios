/* ===== Núcleo: utilidades, xlsx (ler/escrever), pdf, importação, gerador, validação ===== */
const U = {
  uid: (p = 'x') => p + Math.random().toString(36).slice(2, 9),
  norm: s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(),
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  title(s) {
    const low = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'a', 'o', 'ao', 'na', 'no'];
    return String(s).toLowerCase().split(/\s+/).map((w, i) => (i && low.includes(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      .replace(/\b(Ii|Iii|Iv|Mei|Html|Css|Php|Java|Sql|Mysql|Web|Poo|P\.o\.o|Pics|Ec|Aec|Eja)\b/g, m => m.toUpperCase());
  },
  sigla(nome) {
    const n = U.norm(nome).replace(/[^a-z0-9 ]/g, ' ');
    const skip = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'a', 'o', 'ao', 'na', 'no', 'compl', 'comp', 'ativ', 'atividade', 'complementar', 'proj', 'integ', 'projeto', 'integrador'];
    const ws = n.split(' ').filter(w => w && !skip.includes(w));
    let s = ws.length === 1 ? ws[0].slice(0, 4) : ws.slice(0, 4).map(w => w[0]).join('');
    if (/^ativ/.test(n)) s = 'AC-' + s;
    return s.toUpperCase();
  },
  siglaUnica(nome, usadas) {
    let s = U.sigla(nome); if (!usadas.includes(s)) return s;
    const ws = U.norm(nome).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 2 && !['ativ', 'comp', 'compl'].includes(w));
    const alt = (/^ativ/i.test(nome) ? 'AC-' : '') + ws.slice(0, 2).map(w => w.slice(0, 3)).join('').toUpperCase();
    if (alt && !usadas.includes(alt)) return alt;
    let i = 2; while (usadas.includes(s + i)) i++; return s + i;
  },
  ehAC: nome => /^ativ(idade)?s?\.?\s*(compl|comp)/.test(U.norm(nome)),
  palette: ['#2f6fdb', '#e0573f', '#1f9e7a', '#a259d9', '#e39b1b', '#d6457f', '#2aa0b8', '#6b8e23', '#c0601f', '#5b6bd6', '#b8426b', '#3f8f5a', '#8a6d3b', '#4f9fd8', '#d9734a', '#7c5cc4', '#239c9c', '#b0882b', '#c94c4c', '#56799e'],
  primeiroNome(n) { const p = String(n).trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0]; }
};

/* ---------- ZIP (leitura com DecompressionStream; escrita sem compressão) ---------- */
const Zip = {
  async read(buf) {
    const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = b.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Arquivo não é um .xlsx/.xlsm válido.');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
    const dec = new TextDecoder();
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      out[name] = async () => {
        const ln = dv.getUint16(lo + 26, true), lx = dv.getUint16(lo + 28, true), st = lo + 30 + ln + lx;
        const data = b.subarray(st, st + csize);
        if (method === 0) return data;
        const ds = new DecompressionStream('deflate-raw');
        const res = new Response(new Blob([data]).stream().pipeThrough(ds));
        return new Uint8Array(await res.arrayBuffer());
      };
    }
    return out;
  },
  crcT: null,
  crc(d) {
    if (!Zip.crcT) { Zip.crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; Zip.crcT[n] = c >>> 0; } }
    let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = Zip.crcT[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
  },
  write(files) { // files: {name: string|Uint8Array}
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const [name, v] of Object.entries(files)) {
      const nm = enc.encode(name), data = typeof v === 'string' ? enc.encode(v) : v, crc = Zip.crc(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + data.length;
    }
    const csz = central.reduce((s, a) => s + a.length, 0), end = new DataView(new ArrayBuffer(22)), n = Object.keys(files).length;
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, n, true); end.setUint16(10, n, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)], tot = all.reduce((s, a) => s + a.length, 0), r = new Uint8Array(tot); let q = 0;
    for (const a of all) { r.set(a, q); q += a.length; } return r;
  }
};

/* ---------- XLSX leitura (valores) ---------- */
const XLSX = {
  unx: s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&'),
  colNum(ref) { let n = 0; for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n; },
  async read(buf) {
    const z = await Zip.read(buf), dec = new TextDecoder(), txt = async n => z[n] ? dec.decode(await z[n]()) : '';
    const ss = [], sx = await txt('xl/sharedStrings.xml');
    for (const m of sx.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(XLSX.unx([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
    const wb = await txt('xl/workbook.xml'), rels = await txt('xl/_rels/workbook.xml.rels'), relMap = {};
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) { const id = /Id="([^"]+)"/.exec(m[1]), t = /Target="([^"]+)"/.exec(m[1]); if (id && t) relMap[id[1]] = t[1]; }
    const sheets = [];
    for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
      const name = XLSX.unx((/name="([^"]*)"/.exec(m[1]) || [])[1] || ''), rid = (/r:id="([^"]+)"/.exec(m[1]) || [])[1], state = (/state="([^"]+)"/.exec(m[1]) || [])[1] || 'visible';
      let path = relMap[rid] || ''; path = path.startsWith('/') ? path.slice(1) : 'xl/' + path.replace(/^\.\//, '');
      sheets.push({ name, state, path });
    }
    for (const s of sheets) {
      const x = await txt(s.path), cells = {}; let maxR = 0, maxC = 0;
      for (const m of x.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = m[1], ref = (/r="([A-Z]+\d+)"/.exec(a) || [])[1]; if (!ref || !m[2]) continue;
        const t = (/t="([^"]+)"/.exec(a) || [])[1]; let v = (/<v>([\s\S]*?)<\/v>/.exec(m[2]) || [])[1];
        if (t === 's') v = ss[+v]; else if (t === 'inlineStr') v = XLSX.unx([...m[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(q => q[1]).join(''));
        else if (t === 'str' || t === 'e') v = v == null ? v : XLSX.unx(v); else if (t === 'b') v = v === '1'; else if (v != null) v = +v;
        if (v == null || v === '') continue;
        const r = +ref.match(/\d+/)[0], c = XLSX.colNum(ref); (cells[r] ||= {})[c] = v; if (r > maxR) maxR = r; if (c > maxC) maxC = c;
      }
      s.cells = cells; s.maxR = maxR; s.maxC = maxC; s.get = (r, c) => (cells[r] || {})[c];
    }
    return sheets;
  },
  /* escrita: sheets = [{name, rows:[[...]], widths:[...], header:true}] */
  write(sheets) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
    const col = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const files = {}, used = new Set();
    const names = sheets.map(s => { let n = String(s.name).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Planilha', b = n, i = 2; while (used.has(n.toLowerCase())) n = b.slice(0, 28) + ' ' + i++; used.add(n.toLowerCase()); return n; });
    files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>';
    files['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    files['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>';
    files['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    files['xl/styles.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF24395F"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFC8CDD8"/></left><right style="thin"><color rgb="FFC8CDD8"/></right><top style="thin"><color rgb="FFC8CDD8"/></top><bottom style="thin"><color rgb="FFC8CDD8"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment wrapText="1" vertical="center"/></xf><xf fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf><xf fontId="2" fillId="0" borderId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    sheets.forEach((s, i) => {
      const w = s.widths || [];
      const cols = w.length ? '<cols>' + w.map((x, j) => `<col min="${j + 1}" max="${j + 1}" width="${x}" customWidth="1"/>`).join('') + '</cols>' : '';
      const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
        if (v == null || v === '') return '';
        const ref = col(ci + 1) + (ri + 1), st = (s.styles && s.styles[ri]) != null ? s.styles[ri] : (s.header !== false && ri === (s.headerRow || 0) ? 1 : 2);
        return typeof v === 'number' ? `<c r="${ref}" s="${st}"><v>${v}</v></c>` : `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      }).join('') + '</row>').join('');
      files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${s.freeze ? `<pane ySplit="${s.freeze}" topLeftCell="A${s.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : ''}</sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
    });
    return Zip.write(files);
  }
};

/* ---------- PDF simples (tabelas) ---------- */
const PDF = (() => {
  // larguras Helvetica / Helvetica-Bold (1/1000 em), caracteres 32..255 (WinAnsi)
  const WH = __WH__, WB = __WB__;
  const map = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
  const code = ch => { const c = ch.charCodeAt(0); if (c >= 32 && c < 127) return c; if (map[ch]) return map[ch]; if (c >= 160 && c <= 255) return c; if (ch === 'º' || ch === 'ª') return c; return 63; };
  const width = (s, size, bold) => { let w = 0; for (const ch of String(s)) { const c = code(ch); w += ((bold ? WB : WH)[c - 32] || 556); } return w * size / 1000; };
  const enc = s => { let o = ''; for (const ch of String(s)) { const c = code(ch); o += c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c); } return o; };
  const rgb = h => { h = (h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3)).join(' '); };
  function fit(s, size, maxW, bold) { s = String(s ?? ''); if (width(s, size, bold) <= maxW) return s; while (s.length > 1 && width(s + '…', size, bold) > maxW) s = s.slice(0, -1); return s + '…'; }
  function wrap(s, size, maxW, bold, maxLines) {
    const words = String(s ?? '').split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (width(t, size, bold) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { const l = lines.slice(0, maxLines); l[maxLines - 1] = fit(lines.slice(maxLines - 1).join(' '), size, maxW, bold); return l; }
    return lines.map(l => fit(l, size, maxW, bold));
  }
  class Doc {
    constructor(landscape = true) { this.W = landscape ? 842 : 595; this.H = landscape ? 595 : 842; this.pages = []; }
    page() { this.cur = []; this.pages.push(this.cur); return this; }
    rect(x, y, w, h, fill, stroke) { this.cur.push(`${fill ? rgb(fill) + ' rg ' : ''}${stroke ? rgb(stroke) + ' RG 0.5 w ' : ''}${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`); }
    text(x, y, s, size = 9, bold = false, color = '#1d2433', align = 'left', maxW) {
      if (maxW) s = fit(s, size, maxW, bold); let xx = x; const w = width(s, size, bold);
      if (align === 'center') xx = x - w / 2; else if (align === 'right') xx = x - w;
      this.cur.push(`BT ${rgb(color)} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${xx.toFixed(2)} ${(this.H - y).toFixed(2)} Td (${enc(s)}) Tj ET`);
    }
    out() {
      const objs = []; const add = s => (objs.push(s), objs.length);
      add('<< /Type /Catalog /Pages 2 0 R >>'); add('PAGES');
      add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const kids = [];
      for (const p of this.pages) { const c = p.join('\n'); const ci = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`); kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${ci} 0 R >>`)); }
      objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
      let s = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const offs = [];
      objs.forEach((o, i) => { offs.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const x = s.length; s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
      const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b;
    }
  }
  /* Tabela com paginação. t = {title, subtitle, head:[...], rows:[[cell|{t,fill,color,bold,lines}]], widths:[proporções], fontSize, rowH, headH, footer} */
  function table(doc, t) {
    const M = 28, top = 70, W = doc.W - 2 * M, fs = t.fontSize || 8, lh = fs * 1.2;
    const ws = t.widths || t.head.map(() => 1), tw = ws.reduce((a, b) => a + b, 0), cw = ws.map(w => w / tw * W);
    const cellLines = c => { const tx = typeof c === 'object' && c ? (c.t ?? '') : (c ?? ''); return String(tx).split('\n'); };
    const rowHeight = r => t.rowH || Math.max(fs * 1.9, ...r.map((c, i) => { const ls = cellLines(c).flatMap(l => wrap(l, fs, cw[i] - 6, c && c.bold, 4)); return ls.length * lh + fs * 0.8; }));
    const headH = t.headH || fs * 2.4;
    let y, pageNo = 0;
    const header = () => {
      doc.page(); pageNo++;
      doc.rect(0, 0, doc.W, 6, '#24395f');
      doc.text(M, 34, t.title, 15, true, '#24395f');
      if (t.subtitle) doc.text(M, 52, t.subtitle, 9, false, '#5b6475', 'left', W);
      doc.text(doc.W - M, 34, t.right || '', 8, false, '#5b6475', 'right');
      y = top; let x = M;
      t.head.forEach((h, i) => { doc.rect(x, y, cw[i], headH, '#24395f'); const ls = wrap(h, fs, cw[i] - 6, true, 2); ls.forEach((l, k) => doc.text(x + cw[i] / 2, y + headH / 2 - (ls.length - 1) * lh / 2 + fs * 0.35 + k * lh, l, fs, true, '#ffffff', 'center')); x += cw[i]; });
      y += headH;
      doc.text(M, doc.H - 14, t.footer || '', 7, false, '#8a93a6'); doc.text(doc.W - M, doc.H - 14, 'Página ' + pageNo, 7, false, '#8a93a6', 'right');
    };
    header();
    t.rows.forEach((r, ri) => {
      const h = rowHeight(r);
      if (t.group && ri % t.group === 0 && ri && y + h * t.group > doc.H - 30) header();
      if (y + h > doc.H - 30) header();
      let x = M;
      r.forEach((c, i) => {
        const o = (c && typeof c === 'object') ? c : { t: c };
        doc.rect(x, y, cw[i], h, o.fill || (ri % 2 ? '#f6f7fb' : '#ffffff'), '#c8cdd8');
        const ls = cellLines(o).flatMap((l, li) => wrap(l, li ? fs - 1 : fs, cw[i] - 6, o.bold && !li, 4));
        const total = ls.length * lh, align = o.align || (i === 0 ? 'left' : 'center');
        ls.forEach((l, k) => doc.text(align === 'left' ? x + 3 : align === 'right' ? x + cw[i] - 3 : x + cw[i] / 2, y + h / 2 - total / 2 + lh * 0.8 + k * lh, l, k ? fs - 1 : fs, o.bold && !k, k ? (o.color2 || '#5b6475') : (o.color || '#1d2433'), align));
        x += cw[i];
      });
      y += h;
    });
    if (t.after) { y += 14; for (const line of t.after) { if (y > doc.H - 40) { header(); } doc.text(M, y, line, 8, false, '#1d2433', 'left', W); y += 12; } }
  }
  return { Doc, table, width };
})();

/* ---------- Importação do quadro de distribuição ---------- */
const Importer = {
  limpaDisc(s) {
    let t = String(s).replace(/\s+/g, ' ').trim();
    t = t.replace(/E\.\s?F\s?-?\s?\d{4,5}/gi, '').replace(/E\.\s?M\s?-?\s?\d{4,5}/gi, '').replace(/^\s*\d{4,5}(\s*\/\s*\d{4,5})?\s*-?\s*/, '').replace(/^\s*-\s*/, '').replace(/\s*-\s*$/, '');
    t = t.replace(/\s*-\s*/g, ' / ').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s+/g, ' ').trim();
    t = t.replace(/^(.*?) \/ (.*)$/, (m, a, b) => /^[A-ZÀ-Ú\s]+$/.test(a) && /^[A-ZÀ-Ú\s]+$/.test(b) ? a + ' / ' + b : m);
    const upper = t === t.toUpperCase();
    return upper ? U.title(t) : t;
  },
  turnoDe(s) { const n = U.norm(s); if (n.includes('vesp')) return 'V'; if (n.includes('not')) return 'N'; if (n.includes('mat') || n.includes('integral')) return 'M'; return null; },
  /* devolve proposta para conferência */
  quadro(sheet) {
    const g = (r, c) => sheet.get(r, c);
    let r0 = 0, cNome = 0;
    for (let r = 1; r <= Math.min(60, sheet.maxR) && !r0; r++) for (let c = 1; c <= Math.min(20, sheet.maxC); c++) { const v = g(r, c); if (typeof v === 'string' && /professor/i.test(v) && /disciplina/i.test(v)) { r0 = r; cNome = c; break; } }
    if (!r0) return null;
    let cMasp = 0, cTotalGeral = 0, cObs = 0, cAdm = 0, cVinc = 0;
    for (let c = cNome + 1; c <= sheet.maxC; c++) {
      const v = U.norm(g(r0, c));
      if (!v) continue;
      if (v === 'masp') cMasp = c; else if (v.startsWith('admiss')) cAdm = c; else if (v.startsWith('efet')) cVinc = c;
      else if (v.includes('total de aulas geral')) cTotalGeral = c; else if (v.includes('quadro de distribui') && !cObs) cObs = c;
    }
    const cIni = (() => { for (let c = cNome + 1; c <= sheet.maxC; c++) if (Importer.turnoDe(g(r0, c) || '') && !/total/i.test(g(r0, c))) return c; return cNome + 4; })();
    const cFim = (cTotalGeral || sheet.maxC + 1) - 1;
    // colunas de turma
    const cols = []; let turno = null, nivel = '', serie = '', modal = '';
    for (let c = cIni; c <= cFim; c++) {
      const h = g(r0, c); if (h && /total/i.test(h)) { turno = turno; continue; }
      if (h && Importer.turnoDe(h)) turno = Importer.turnoDe(h);
      if (g(r0 + 1, c)) nivel = String(g(r0 + 1, c)).trim();
      if (g(r0 + 2, c)) serie = String(g(r0 + 2, c)).trim();
      if (g(r0 + 3, c)) modal = String(g(r0 + 3, c)).trim();
      const label = g(r0 + 4, c);
      if (!label) continue;
      cols.push({ c, turno, nivel, serie, modal, label: String(label).replace(/\s+/g, ' ').trim(), letra: g(r0 + 5, c) });
    }
    // linhas
    const discs = [], linhasProf = []; let disc = null;
    for (let r = r0 + 6; r <= sheet.maxR; r++) {
      const nome = g(r, cNome); if (!nome || !String(nome).trim() || typeof nome !== 'string') continue;
      const masp = cMasp ? g(r, cMasp) : null;
      if (masp && String(masp).trim()) {
        const marks = {};
        for (const k of cols) { const v = g(r, k.c); if (typeof v === 'string' && /^[a-z]$/i.test(v.trim())) marks[k.c] = v.trim().toUpperCase(); }
        linhasProf.push({ r, nome: String(nome).trim(), masp: String(masp).trim(), adm: cAdm ? g(r, cAdm) : '', vinc: cVinc ? g(r, cVinc) : '', obs: cObs ? String(g(r, cObs) || '').trim() : '', marks, disc });
      } else {
        const qt = {}; for (const k of cols) { const v = g(r, k.c); if (typeof v === 'number' && v > 0) qt[k.c] = v; }
        disc = { r, bruto: String(nome).trim(), nome: Importer.limpaDisc(nome), qt }; discs.push(disc);
      }
    }
    // turmas usadas
    const turmas = cols.map(k => {
      const serie = k.serie.replace(/\s*ANO\s*$/i, '').trim(), soma = discs.reduce((s, d) => s + (U.ehAC(d.nome) ? 0 : (d.qt[k.c] || 0)), 0);
      const temProf = linhasProf.some(p => p.marks[k.c]);
      let nome = (serie ? serie + ' ' : '') + (/eja/i.test(k.nivel + k.modal + k.label) ? '' : (/fund/i.test(k.nivel) ? 'Ano ' : 'EM ')) + k.label.replace(/^(EF AF|EM)\s*/i, '').replace(/\bINT\.?\s*/i, 'Integral ').replace(/\bREG\.?\s*/i, 'Regular ').replace(/\bTec\b/i, 'Téc.').replace(/\s+/g, ' ');
      if (/fund/i.test(k.nivel) || /^EF/i.test(k.label)) nome = (serie || '') + ' Ano';
      else if (k.turno === 'N' && !/eja/i.test(k.nivel + k.modal + k.label)) nome = (serie || '') + ' EM Noturno';
      return { col: k.c, nome: nome.trim(), turno: k.turno || 'M', soma, temProf, incluir: soma > 0 && temProf, motivo: soma === 0 ? 'sem aulas previstas' : !temProf ? 'nenhum professor marcado' : '' };
    });
    // nomes repetidos -> acrescenta letra
    const cnt = {}; turmas.forEach(t => cnt[t.nome] = (cnt[t.nome] || 0) + 1);
    turmas.forEach(t => { if (cnt[t.nome] > 1) { const k = cols.find(x => x.c === t.col); t.nome += ' (' + (k.letra ?? t.col) + ')'; } });
    const semSuf = n => n.replace(/\s*\([^)]*\)\s*$/, '');
    turmas.forEach(t => { if (t.incluir && semSuf(t.nome) !== t.nome && turmas.filter(x => x.incluir && semSuf(x.nome) === semSuf(t.nome)).length === 1) t.nome = semSuf(t.nome); });
    // atribuições
    const atr = [];
    for (const p of linhasProf) {
      if (!p.disc) continue;
      for (const [c, m] of Object.entries(p.marks)) {
        const q = p.disc.qt[c] || 0, t = turmas.find(x => x.col === +c);
        atr.push({ discKey: p.disc.r, disc: p.disc.nome, col: +c, turma: t ? t.nome : '?', prof: p.nome, masp: p.masp, aulas: q, marca: m, obs: p.obs, linha: p.r });
      }
    }
    // disciplinas com aulas e sem professor
    const semProf = [];
    for (const d of discs) for (const [c, q] of Object.entries(d.qt)) if (!atr.some(a => a.discKey === d.r && a.col === +c)) semProf.push({ discKey: d.r, disc: d.nome, col: +c, aulas: q });
    // duplicidades
    const grupos = {}; atr.forEach(a => (grupos[a.discKey + '|' + a.col] ||= []).push(a));
    const dups = Object.values(grupos).filter(g => g.length > 1).map(g => {
      const sub = g.filter(a => /substitu|subst\./i.test(a.obs));
      const escolhido = (sub.length ? sub[sub.length - 1] : g[g.length - 1]);
      return { chave: g[0].discKey + '|' + g[0].col, disc: g[0].disc, turma: g[0].turma, opcoes: g.map(a => ({ prof: a.prof, obs: a.obs, linha: a.linha })), escolha: escolhido.linha };
    });
    return { turmas, discs: discs.map(d => ({ key: d.r, nome: d.nome, bruto: d.bruto, total: Object.values(d.qt).reduce((a, b) => a + b, 0) })), atr, semProf, dups, profs: linhasProf };
  },
  /* aplica proposta conferida e devolve estado */
  montar(prop, cfg) {
    const st = Store.vazio(cfg);
    const tMap = {};
    const incl = prop.turmas.filter(t => t.incluir), base = n => n.replace(/\s*\([^)]*\)\s*$/, '');
    incl.forEach(t => { const b = base(t.nome); if (b !== t.nome && incl.filter(x => base(x.nome) === b).length === 1) t.nome = b; });
    prop.turmas.filter(t => t.incluir).forEach((t, i) => {
      const tid = 't' + t.col; tMap[t.col] = tid;
      const cap = st.config.turnos[t.turno]?.horarios.length || 6;
      st.turmas.push({ id: tid, nome: t.nome, sigla: Importer.siglaTurma(t.nome), turno: t.turno, aulasDia: Math.min(cap, Math.max(1, t.aulasDia || Math.ceil(t.soma / st.config.dias.length))), ordem: i });
    });
    const dMap = {}; let ci = 0;
    const discUsada = new Set(prop.atr.filter(a => tMap[a.col] && a.aulas > 0).map(a => a.discKey).concat(prop.semProf.filter(s => tMap[s.col]).map(s => s.discKey)));
    const semAC = !cfg || cfg.acFora !== false;
    for (const d of prop.discs) {
      if (!discUsada.has(d.key) || (semAC && U.ehAC(d.nome))) continue;
      const ex = st.disciplinas.find(x => U.norm(x.nome) === U.norm(d.nome));
      if (ex) { dMap[d.key] = ex.id; continue; }
      const id = 'd' + d.key; dMap[d.key] = id;
      st.disciplinas.push({ id, nome: d.nome, sigla: U.siglaUnica(d.nome, st.disciplinas.map(x => x.sigla)), cor: U.palette[ci++ % U.palette.length] });
    }
    const pMap = {}, keyP = a => (String(a.masp || '').replace(/\D/g, '') || U.norm(a.prof));
    const escolhaDup = {}; prop.dups.forEach(d => escolhaDup[d.chave] = d.escolha);
    let pi = 0;
    for (const a of prop.atr) {
      if (!tMap[a.col] || !(a.aulas > 0)) continue;
      const ch = a.discKey + '|' + a.col; if (escolhaDup[ch] != null && escolhaDup[ch] !== a.linha) continue;
      const k = keyP(a);
      if (!pMap[k]) { const id = 'p' + (++pi); pMap[k] = id; st.professores.push({ id, nome: a.prof, masp: a.masp || '', cor: U.palette[(pi * 7) % U.palette.length], carga: null, indisp: [], obs: '' }); }
      else { const p = st.professores.find(x => x.id === pMap[k]); if (a.prof.length > p.nome.length) p.nome = a.prof; }
      const pid = pMap[k], did = dMap[a.discKey], tid = tMap[a.col];
      if (!did) continue;
      const ex = st.atribs.find(x => x.disc === did && x.turma === tid && x.prof === pid);
      if (ex) ex.aulas += a.aulas; else st.atribs.push({ id: U.uid('a'), disc: did, turma: tid, prof: pid, aulas: a.aulas, marca: a.marca === 'X' ? '' : a.marca });
    }
    for (const s of prop.semProf) { if (!tMap[s.col] || !dMap[s.discKey]) continue; st.atribs.push({ id: U.uid('a'), disc: dMap[s.discKey], turma: tMap[s.col], prof: '', aulas: s.aulas, marca: '' }); }
    st.professores = st.professores.filter(p => st.atribs.some(a => a.prof === p.id));
    for (const p of st.professores) p.carga = st.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + a.aulas, 0);
    st.config.acFora = semAC;
    st.professores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    return st;
  },
  siglaTurma(n) {
    return String(n).replace(/\bIntegral\b/i, 'Int').replace(/\bRegular\b/i, 'Reg').replace(/\bTéc\.\s*/i, '').replace(/\bAno\b/i, 'Ano').replace(/\s+/g, ' ').trim().slice(0, 18);
  },
  /* CSV: professor;disciplina;turma;turno;aulas */
  csv(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
    const head = split(lines[0]).map(U.norm);
    const idx = n => head.findIndex(h => n.some(x => h.startsWith(x)));
    const iP = idx(['prof']), iD = idx(['disc', 'componente']), iT = idx(['turma', 'classe']), iTu = idx(['turno']), iA = idx(['aula', 'qtd', 'quant', 'carga']), iM = idx(['masp', 'matr']);
    if (iP < 0 || iD < 0 || iT < 0 || iA < 0) throw new Error('O CSV precisa das colunas: professor; disciplina; turma; aulas (turno é opcional).');
    const turmas = {}, discs = {}, atr = [];
    lines.slice(1).forEach((l, n) => {
      const c = split(l); const t = c[iT], d = c[iD], p = c[iP], a = +String(c[iA]).replace(',', '.') || 0; if (!t || !d) return;
      if (!turmas[t]) turmas[t] = { col: Object.keys(turmas).length + 1, nome: t, turno: Importer.turnoDe(c[iTu] || '') || 'M', soma: 0, temProf: false, incluir: true, motivo: '' };
      turmas[t].soma += a; if (p) turmas[t].temProf = true;
      if (!discs[d]) discs[d] = { key: Object.keys(discs).length + 1, nome: d, bruto: d, total: 0 };
      discs[d].total += a;
      if (p) atr.push({ discKey: discs[d].key, disc: d, col: turmas[t].col, turma: t, prof: p, masp: iM >= 0 ? c[iM] : '', aulas: a, marca: 'X', obs: '', linha: n + 2 });
    });
    const semProf = []; lines.slice(1).forEach(l => { const c = split(l); if (!c[iP] && c[iT] && c[iD]) semProf.push({ discKey: discs[c[iD]].key, disc: c[iD], col: turmas[c[iT]].col, aulas: +c[iA] || 0 }); });
    const grupos = {}; atr.forEach(a => (grupos[a.discKey + '|' + a.col] ||= []).push(a));
    const dups = Object.values(grupos).filter(g => g.length > 1).map(g => ({ chave: g[0].discKey + '|' + g[0].col, disc: g[0].disc, turma: g[0].turma, opcoes: g.map(a => ({ prof: a.prof, obs: '', linha: a.linha })), escolha: g[g.length - 1].linha }));
    return { turmas: Object.values(turmas), discs: Object.values(discs), atr, semProf, dups, profs: [] };
  }
};

/* ---------- Estado ---------- */
const Store = {
  vazio(cfg) {
    return {
      config: cfg ? JSON.parse(JSON.stringify(cfg)) : {
        escola: 'Escola Estadual Sérgio de Freitas Pacheco', ano: 2026,
        dias: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
        turnos: {
          M: { nome: 'Matutino', horarios: ['06:55', '07:45', '08:35', '09:45', '10:33', '11:21', '13:10'], intervalos: [{ ini: '09:25', fim: '09:45', nome: 'Recreio' }, { ini: '12:10', fim: '13:10', nome: 'Almoço (EMTI)' }] },
          V: { nome: 'Vespertino', horarios: ['13:10', '14:00', '14:50', '15:55', '16:45'], intervalos: [{ ini: '15:40', fim: '15:55', nome: 'Recreio' }] },
          N: { nome: 'Noturno', horarios: ['19:00', '19:50', '21:00', '21:50'], intervalos: [{ ini: '20:40', fim: '21:00', nome: 'Recreio' }] }
        },
        prefs: { maxMesmaDiscDia: 2, permitirDupla: true }
      },
      professores: [], turmas: [], disciplinas: [], atribs: [], grade: {}, fixas: {}
    };
  }
};

/* ---------- Modelo: índices e consultas ---------- */
function Modelo(st) {
  const M = { st };
  M.prof = Object.fromEntries(st.professores.map(p => [p.id, p]));
  M.turma = Object.fromEntries(st.turmas.map(t => [t.id, t]));
  M.disc = Object.fromEntries(st.disciplinas.map(d => [d.id, d]));
  M.atr = Object.fromEntries(st.atribs.map(a => [a.id, a]));
  M.dias = st.config.dias.length;
  M.diasT = t => Math.max(1, Math.min(t.dias || M.dias, M.dias));
  M.hor = (t, a) => (st.config.turnos[t.turno]?.horarios || [])[a] || ('Aula ' + (a + 1));
  M.chaveTempo = (t, d, a) => d + '|' + M.hor(t, a);
  M.indisp = Object.fromEntries(st.professores.map(p => [p.id, new Set(p.indisp || [])]));
  M.regras = ((st.config && st.config.regras) || []).filter(r => r.ativo !== false && M.prof[r.prof]);
  M.maxDia = {};
  for (const r of M.regras) {
    if (r.tipo === 'nao' || r.tipo === 'dias') {
      const bloq = r.tipo === 'nao' ? r.dias : st.config.dias.map((x, i) => i).filter(i => !r.dias.includes(i));
      for (const d of bloq) for (const tu of Object.values(st.config.turnos)) for (const h of tu.horarios) M.indisp[r.prof].add(d + '|' + h);
    }
    if (r.tipo === 'max') M.maxDia[r.prof] = Math.min(M.maxDia[r.prof] ?? 99, r.n);
  }
  M.cells = function* () { for (const t of st.turmas) { const g = st.grade[t.id] || {}; for (const [k, aid] of Object.entries(g)) { const [d, a] = k.split('-').map(Number); yield { t, d, a, aid, at: M.atr[aid] }; } } };
  M.contagem = () => { const c = {}; for (const x of M.cells()) if (x.at) c[x.aid] = (c[x.aid] || 0) + 1; return c; };
  return M;
}

/* ---------- Pedidos dos professores (regras) ---------- */
const Regras = {
  TIPOS: { seq: 'Aulas seguidas no dia', min: 'Aulas no dia (mínimo)', dias: 'Só dá aula nestes dias', nao: 'Não dá aula nestes dias', max: 'Máximo de aulas por dia' },
  descreve(r, st) {
    const p = (st.professores.find(x => x.id === r.prof) || {}).nome || '?', D = st.config.dias, ds = (r.dias || []).map(i => D[i] || '?');
    const lista = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] || '?';
    if (r.tipo === 'seq') return `${p}: ${r.n} aulas seguidas na ${ds[0]}`;
    if (r.tipo === 'min') return `${p}: pelo menos ${r.n} aula${r.n > 1 ? 's' : ''} na ${ds[0]}`;
    if (r.tipo === 'dias') return `${p}: só dá aula ${lista(ds.map(x => 'na ' + x))}`;
    if (r.tipo === 'nao') return `${p}: não dá aula ${lista(ds.map(x => 'na ' + x))}`;
    if (r.tipo === 'max') return `${p}: no máximo ${r.n} aulas por dia`;
    return p;
  },
  /* uma linha de texto -> [{prof, tipo, dias, n}] ou {erro, candidatos} */
  interpretar(txt, st) {
    const t = ' ' + U.norm(txt).replace(/[.,;:!?()]/g, ' ') + ' ';
    const nomesDias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dias = []; for (const m of t.matchAll(/\b(segunda|terca|quarta|quinta|sexta|sabado)(-feira|s)?\b/g)) { const i = nomesDias.indexOf(m[1]); if (i < st.config.dias.length && !dias.includes(i)) dias.push(i); }
    const pal = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7 };
    const nm = /\b(\d{1,2}|uma?|dois|duas|tres|quatro|cinco|seis|sete)\s+aulas?\b/.exec(t) || /\b(\d{1,2})\b/.exec(t);
    const n = nm ? (pal[nm[1]] || parseInt(nm[1], 10)) : null;
    // professor
    const skip = ['de', 'da', 'do', 'das', 'dos', 'e'];
    const sc = st.professores.map(p => { const tk = U.norm(p.nome).split(' ').filter(w => w.length > 1 && !skip.includes(w)); const hit = tk.filter(w => t.includes(' ' + w + ' ')); return { p, hit: hit.length, first: t.includes(' ' + tk[0] + ' ') }; }).filter(x => x.hit > 0);
    const melhor = Math.max(0, ...sc.map(x => x.hit + (x.first ? 0.5 : 0)));
    const cands = sc.filter(x => x.hit + (x.first ? 0.5 : 0) === melhor).map(x => x.p);
    let tipo = null;
    if (/\b(no maximo|maximo|nao mais (de|que)|ate)\s+(\d{1,2}|uma?|dois|duas|tres|quatro|cinco|seis|sete)\s+aulas?\b/.test(t) || /\bmais (de|que) \d+ aulas?\b/.test(t)) tipo = 'max';
    else if (/(seguid|sequenc|sequencia|consecutiv|geminad|emendad|em bloco|juntas|direto|corrid)/.test(t)) tipo = 'seq';
    else if (/\b(nao|sem aula|folga|livre|nenhuma aula|exceto|menos)\b/.test(t)) tipo = 'nao';
    else if (/\b(so|somente|apenas|unicamente)\b/.test(t)) tipo = 'dias';
    else if (dias.length) tipo = 'min';
    const r = { prof: cands.length === 1 ? cands[0].id : '', tipo, dias, n, texto: String(txt).trim() };
    if (/mais (de|que) (\d+)/.test(t) && tipo === 'max') r.n = parseInt(/mais (de|que) (\d+)/.exec(t)[2], 10);
    const avisos = [];
    if (!cands.length) avisos.push('Não reconheci o professor.');
    if (cands.length > 1) avisos.push('Mais de um professor combina: ' + cands.map(p => p.nome).join(', ') + '. Escolha o certo.');
    if (!tipo) avisos.push('Não entendi o tipo de pedido. Escolha abaixo.');
    if ((tipo === 'seq' || tipo === 'min' || tipo === 'dias' || tipo === 'nao') && !dias.length) avisos.push('Não encontrei o dia da semana.');
    if ((tipo === 'seq' || tipo === 'max') && !n) avisos.push('Não encontrei a quantidade de aulas.');
    if (tipo === 'min' && !r.n) r.n = 1;
    if (tipo === 'seq' && r.n === 1) avisos.push('Uma aula só não forma sequência; confira a quantidade.');
    // seq/min com vários dias vira uma regra por dia
    const regras = (tipo === 'seq' || tipo === 'min') && dias.length > 1 ? dias.map(d => ({ ...r, dias: [d] })) : [r];
    return { regras, avisos, candidatos: cands.map(p => p.id) };
  },
  /* situação de cada regra na grade atual */
  checar(st) {
    const M = Modelo(st), out = [];
    for (const r of M.regras) {
      const mine = []; for (const x of M.cells()) if (x.at && x.at.prof === r.prof) mine.push(x);
      let ok = true, det = '';
      if (r.tipo === 'seq') {
        const d = r.dias[0]; let best = 0;
        for (const tu of Object.keys(st.config.turnos)) { const idx = [...new Set(mine.filter(x => x.d === d && x.t.turno === tu).map(x => st.config.turnos[tu].horarios.indexOf(M.hor(x.t, x.a))))].sort((a, b) => a - b); let run = 0, prev = -9; for (const i of idx) { run = i === prev + 1 ? run + 1 : 1; prev = i; best = Math.max(best, run); } }
        ok = best >= r.n; det = `maior sequência na ${st.config.dias[d]}: ${best}`;
      } else if (r.tipo === 'min') { const c = mine.filter(x => x.d === r.dias[0]).length; ok = c >= r.n; det = `${c} aula(s) na ${st.config.dias[r.dias[0]]}`; }
      else if (r.tipo === 'max') { const por = {}; mine.forEach(x => por[x.d] = (por[x.d] || 0) + 1); const mx = Math.max(0, ...Object.values(por)); ok = mx <= r.n; det = `máximo atual: ${mx} por dia`; }
      else { const bloq = r.tipo === 'nao' ? r.dias : st.config.dias.map((x, i) => i).filter(i => !r.dias.includes(i)); const c = mine.filter(x => bloq.includes(x.d)).length; ok = c === 0; det = c ? `${c} aula(s) em dia não permitido` : 'nenhuma aula em dia não permitido'; }
      out.push({ id: r.id, ok, det, txt: Regras.descreve(r, st) });
    }
    return out;
  }
};

/* ---------- Validação ---------- */
function validar(st) {
  const M = Modelo(st), probs = [], cont = M.contagem();
  const ocup = {};
  for (const x of M.cells()) {
    if (!x.at) { probs.push({ tipo: 'orfa', grav: 2, msg: `Aula sem atribuição válida em ${x.t.nome}`, turma: x.t.id, d: x.d, a: x.a }); continue; }
    if (x.a >= x.t.aulasDia || x.d >= M.diasT(x.t)) probs.push({ tipo: 'fora', grav: 2, msg: `${x.t.nome}: aula fora do horário da turma (${st.config.dias[x.d] || 'dia ' + (x.d + 1)}, ${x.a + 1}ª aula)`, turma: x.t.id, d: x.d, a: x.a });
    if (!x.at.prof) continue;
    const k = x.at.prof + '@' + M.chaveTempo(x.t, x.d, x.a);
    (ocup[k] ||= []).push(x);
    if (M.indisp[x.at.prof]?.has(M.chaveTempo(x.t, x.d, x.a))) probs.push({ tipo: 'indisp', grav: 2, msg: `${M.prof[x.at.prof]?.nome}: aula em horário indisponível (${st.config.dias[x.d]}, ${M.hor(x.t, x.a)}) em ${x.t.nome}`, turma: x.t.id, d: x.d, a: x.a, prof: x.at.prof });
  }
  for (const [k, arr] of Object.entries(ocup)) if (arr.length > 1) {
    const p = M.prof[arr[0].at.prof];
    probs.push({ tipo: 'choque', grav: 3, msg: `${p?.nome || 'Professor'} em ${arr.length} turmas no mesmo horário (${st.config.dias[arr[0].d]}, ${M.hor(arr[0].t, arr[0].a)}): ${arr.map(x => x.t.nome).join(', ')}`, turma: arr[0].t.id, d: arr[0].d, a: arr[0].a, prof: arr[0].at.prof, cells: arr.map(x => [x.t.id, x.d, x.a]) });
  }
  for (const a of st.atribs) {
    const n = cont[a.id] || 0, t = M.turma[a.turma], d = M.disc[a.disc];
    if (!t || !d) continue;
    if (!a.prof) probs.push({ tipo: 'semprof', grav: 1, msg: `${d.nome} em ${t.nome}: ${a.aulas} aula(s) sem professor definido`, turma: t.id, atr: a.id });
    if (n < a.aulas && a.prof) probs.push({ tipo: 'falta', grav: 1, msg: `${d.nome} em ${t.nome} (${M.prof[a.prof]?.nome}): ${n} de ${a.aulas} aulas distribuídas — faltam ${a.aulas - n}`, turma: t.id, atr: a.id, prof: a.prof });
    if (n > a.aulas) probs.push({ tipo: 'excesso', grav: 2, msg: `${d.nome} em ${t.nome}: ${n} aulas na grade, previstas ${a.aulas}`, turma: t.id, atr: a.id });
  }
  for (const p of st.professores) {
    const prevista = p.carga ?? st.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + a.aulas, 0);
    const naGrade = st.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + (cont[a.id] || 0), 0);
    const atribuida = st.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + a.aulas, 0);
    if (atribuida !== prevista) probs.push({ tipo: 'carga', grav: 1, msg: `${p.nome}: carga prevista ${prevista}, atribuída ${atribuida} (${atribuida > prevista ? 'acima' : 'abaixo'} do previsto)`, prof: p.id });
    if (naGrade > prevista) probs.push({ tipo: 'carga', grav: 2, msg: `${p.nome}: ${naGrade} aulas na grade, acima da carga prevista (${prevista})`, prof: p.id });
  }
  if (Object.keys(ocup).length) for (const r of Regras.checar(st)) if (!r.ok) { const rg = M.regras.find(x => x.id === r.id); probs.push({ tipo: 'regra', grav: 2, msg: `Pedido não atendido — ${r.txt} (${r.det})`, prof: rg && rg.prof, regra: r.id }); }
  for (const t of st.turmas) {
    const dem = st.atribs.filter(a => a.turma === t.id).reduce((s, a) => s + a.aulas, 0), cap = t.aulasDia * M.diasT(t);
    const demP = st.atribs.filter(a => a.turma === t.id && a.prof).reduce((s, a) => s + a.aulas, 0);
    if (dem > cap) probs.push(demP <= cap ? { tipo: 'capacidade', grav: 1, msg: `${t.nome}: ${dem} aulas previstas para ${cap} horários — as ${dem - demP} aula(s) sem professor não cabem na grade`, turma: t.id } : { tipo: 'capacidade', grav: 3, msg: `${t.nome}: ${dem} aulas previstas para ${cap} horários (${t.aulasDia} por dia) — aumente as aulas por dia`, turma: t.id });
  }
  return probs;
}

/* ---------- Gerador automático ---------- */
const Gerador = {
  /* opções: {manterFixas, manterTudo, tempoMs, onProgress} ; devolve Promise<{grade, naoAlocadas, custo, tentativas}> */
  async gerar(st, opt = {}) {
    const M = Modelo(st), D = M.dias, T = st.turmas, prefs = st.config.prefs || {};
    const tempo = opt.tempoMs || 6000, ini = Date.now();
    const rnd = (() => { let s = opt.seed || (Date.now() % 2147483647); return () => (s = s * 16807 % 2147483647) / 2147483647; })();
    // base: aulas mantidas
    const base = {};
    for (const t of T) {
      base[t.id] = {};
      const g = st.grade[t.id] || {};
      for (const [k, aid] of Object.entries(g)) { const [d0, a0] = k.split('-').map(Number); if (a0 >= t.aulasDia || d0 >= M.diasT(t)) continue; if (M.atr[aid] && (opt.manterTudo || (opt.manterFixas && st.fixas[t.id + '|' + k]))) base[t.id][k] = aid; }
    }
    const jaTem = {}; for (const t of T) for (const aid of Object.values(base[t.id])) jaTem[aid] = (jaTem[aid] || 0) + 1;
    const unidades = [];
    for (const a of st.atribs) { if (!a.prof || !M.turma[a.turma] || !M.prof[a.prof]) continue; const n = Math.max(0, a.aulas - (jaTem[a.id] || 0)); for (let i = 0; i < n; i++) unidades.push(a); }
    // dificuldade
    const cargaProf = {}; st.atribs.forEach(a => { if (a.prof) cargaProf[a.prof] = (cargaProf[a.prof] || 0) + a.aulas; });
    const dispProf = {}; for (const p of st.professores) dispProf[p.id] = (p.indisp || []).length;
    const dificuldade = a => cargaProf[a.prof] * 2 + dispProf[a.prof] * 3 + a.aulas + (M.turma[a.turma].aulasDia * M.diasT(M.turma[a.turma]) - st.atribs.filter(x => x.turma === a.turma).reduce((s, x) => s + x.aulas, 0) < 3 ? 15 : 0);

    function tentativa() {
      const grade = {}, profOc = {}, discDia = {}, turmaDia = {}, profDia = {}, profTot = {};
      const put = (t, d, a, at) => {
        (grade[t.id] ||= {})[d + '-' + a] = at.id;
        profOc[at.prof + '@' + M.chaveTempo(t, d, a)] = t.id + '|' + d + '-' + a;
        discDia[at.id + '|' + d] = (discDia[at.id + '|' + d] || 0) + 1;
        turmaDia[t.id + '|' + d] = (turmaDia[t.id + '|' + d] || 0) + 1;
        (profDia[at.prof + '|' + t.turno + '|' + d] ||= []).push(a);
        profTot[at.prof + '|' + d] = (profTot[at.prof + '|' + d] || 0) + 1;
      };
      const del = (t, d, a) => {
        const aid = grade[t.id][d + '-' + a], at = M.atr[aid]; delete grade[t.id][d + '-' + a];
        delete profOc[at.prof + '@' + M.chaveTempo(t, d, a)];
        discDia[at.id + '|' + d]--; turmaDia[t.id + '|' + d]--;
        const L = profDia[at.prof + '|' + t.turno + '|' + d]; L.splice(L.indexOf(a), 1); profTot[at.prof + '|' + d]--; return at;
      };
      for (const t of T) for (const [k, aid] of Object.entries(base[t.id])) { const [d, a] = k.split('-').map(Number); put(t, d, a, M.atr[aid]); }
      const livre = (t, d, a) => !(grade[t.id] && grade[t.id][d + '-' + a]);
      const pode = (t, d, a, at) => a < t.aulasDia && livre(t, d, a) && !profOc[at.prof + '@' + M.chaveTempo(t, d, a)] && !M.indisp[at.prof].has(M.chaveTempo(t, d, a)) && (M.maxDia[at.prof] == null || (profTot[at.prof + '|' + d] || 0) < M.maxDia[at.prof]);
      const custo = (t, d, a, at) => {
        let c = 0;
        const n = discDia[at.id + '|' + d] || 0;
        if (n >= 1) {
          const adj = (grade[t.id] || {})[d + '-' + (a - 1)] === at.id || (grade[t.id] || {})[d + '-' + (a + 1)] === at.id;
          c += (prefs.permitirDupla !== false && n === 1 && adj) ? 6 : 40 * n;
          if (n + 1 > (prefs.maxMesmaDiscDia || 2)) c += 200;
        }
        c += 2 * (turmaDia[t.id + '|' + d] || 0);
        const L = profDia[at.prof + '|' + t.turno + '|' + d] || [];
        if (L.length) { const mn = Math.min(...L), mx = Math.max(...L); if (a < mn - 1) c += 4 * (mn - a - 1); else if (a > mx + 1) c += 4 * (a - mx - 1); else if (a >= mn && a <= mx) c -= 1; c += 0.5 * L.length; }
        else c += 1.5;
        const dem = st.atribs.filter(x => x.turma === t.id).reduce((s, x) => s + x.aulas, 0), cap = t.aulasDia * M.diasT(t);
        if (dem < cap) c += a * 0.6; // deixa as sobras no fim do dia
        return c + rnd() * 1.2;
      };
      // pedidos dos professores: aulas seguidas / mínimo no dia são colocadas antes das demais
      const rest = {}, consumido = {}, regrasFalhas = [];
      for (const a of unidades) rest[a.id] = (rest[a.id] || 0) + 1;
      const usa = a => { rest[a.id]--; consumido[a.id] = (consumido[a.id] || 0) + 1; };
      const devolve = a => { rest[a.id]++; consumido[a.id]--; };
      const emb = arr => arr.map(x => [rnd(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      for (const r of emb(M.regras.filter(r => r.tipo === 'seq' || r.tipo === 'min'))) {
        const p = r.prof, d = r.dias[0], ats = st.atribs.filter(a => a.prof === p && M.turma[a.turma]);
        if (d == null || d >= D) { regrasFalhas.push(r.id); continue; }
        let ok = false;
        if (r.tipo === 'seq') {
          for (const tu of emb([...new Set(ats.map(a => M.turma[a.turma].turno))])) {
            const H = st.config.turnos[tu].horarios;
            for (const s0 of emb([...Array(Math.max(0, H.length - r.n + 1)).keys()])) {
              const feitos = []; let bom = true;
              for (let k = s0; k < s0 + r.n; k++) {
                if (profOc[p + '@' + d + '|' + H[k]]) continue;
                let best = null, bc = Infinity;
                for (const a of ats) { if (!(rest[a.id] > 0)) continue; const t = M.turma[a.turma]; if (t.turno !== tu || d >= M.diasT(t)) continue; if (pode(t, d, k, a)) { const c = custo(t, d, k, a); if (c < bc) { bc = c; best = [t, a]; } } }
                if (!best) { bom = false; break; }
                put(best[0], d, k, best[1]); usa(best[1]); feitos.push([best[0], k, best[1]]);
              }
              if (bom) { ok = true; break; }
              for (const [t, k, a] of feitos) { del(t, d, k); devolve(a); }
            }
            if (ok) break;
          }
        } else {
          let falta = r.n - (profTot[p + '|' + d] || 0);
          while (falta > 0) {
            let best = null, bc = Infinity;
            for (const a of ats) { if (!(rest[a.id] > 0)) continue; const t = M.turma[a.turma]; if (d >= M.diasT(t)) continue; for (let k = 0; k < t.aulasDia; k++) if (pode(t, d, k, a)) { const c = custo(t, d, k, a); if (c < bc) { bc = c; best = [t, k, a]; } } }
            if (!best) break;
            put(best[0], d, best[1], best[2]); usa(best[2]); falta--;
          }
          ok = falta <= 0;
        }
        if (!ok) regrasFalhas.push(r.id);
      }
      const ord = unidades.slice().sort((x, y) => (dificuldade(y) - dificuldade(x)) || (rnd() - 0.5));
      const falhas = [];
      for (const at of ord) {
        if (consumido[at.id] > 0) { consumido[at.id]--; continue; }
        const t = M.turma[at.turma]; let best = null, bc = Infinity;
        for (let d = 0; d < M.diasT(t); d++) for (let a = 0; a < t.aulasDia; a++) if (pode(t, d, a, at)) { const c = custo(t, d, a, at); if (c < bc) { bc = c; best = [d, a]; } }
        if (best) { put(t, best[0], best[1], at); continue; }
        // reparo: liberar uma célula movendo uma aula que bloqueia
        let ok = false;
        const cand = [];
        for (let d = 0; d < M.diasT(t); d++) for (let a = 0; a < t.aulasDia; a++) cand.push([d, a]);
        cand.sort(() => rnd() - 0.5);
        for (const [d, a] of cand) {
          if (M.indisp[at.prof].has(M.chaveTempo(t, d, a))) continue;
          const kTempo = at.prof + '@' + M.chaveTempo(t, d, a);
          const bloqT = !livre(t, d, a) ? [t, d, a] : null;
          const bloqP = profOc[kTempo] ? profOc[kTempo].split('|') : null;
          if ((bloqT && bloqP) || (!bloqT && !bloqP)) continue;
          let tb, db, ab;
          if (bloqT) [tb, db, ab] = bloqT; else { tb = M.turma[bloqP[0]]; [db, ab] = bloqP[1].split('-').map(Number); }
          if (base[tb.id][db + '-' + ab]) continue;
          const mov = del(tb, db, ab);
          let dest = null, dc = Infinity;
          for (let d2 = 0; d2 < M.diasT(tb); d2++) for (let a2 = 0; a2 < tb.aulasDia; a2++) {
            if (d2 === db && a2 === ab) continue;
            if (pode(tb, d2, a2, mov)) { const c = custo(tb, d2, a2, mov); if (c < dc) { dc = c; dest = [d2, a2]; } }
          }
          if (dest) { put(tb, dest[0], dest[1], mov); if (pode(t, d, a, at)) { put(t, d, a, at); ok = true; break; } del(tb, dest[0], dest[1]); }
          put(tb, db, ab, mov);
        }
        if (!ok) falhas.push(at);
      }
      // melhoria local: trocas dentro da turma
      const custoTotal = () => {
        let c = 0;
        for (const [k, n] of Object.entries(discDia)) if (n > 1) { c += 30 * (n - 1); if (n > (prefs.maxMesmaDiscDia || 2)) c += 200; }
        for (const L of Object.values(profDia)) if (L.length > 1) { const mn = Math.min(...L), mx = Math.max(...L); c += 4 * (mx - mn + 1 - L.length); }
        return c;
      };
      // reduz repetições: tenta trocar aulas duplicadas no mesmo dia
      for (let it = 0; it < 2; it++) for (const t of T) {
        const g = grade[t.id] || {};
        for (const [k, aid] of Object.entries(g)) {
          const [d, a] = k.split('-').map(Number); if (base[t.id][k]) continue;
          if ((discDia[aid + '|' + d] || 0) < 2) continue;
          const adj = g[d + '-' + (a - 1)] === aid || g[d + '-' + (a + 1)] === aid;
          if (adj && prefs.permitirDupla !== false && discDia[aid + '|' + d] === 2) continue;
          const at = M.atr[aid]; let feito = false;
          for (let d2 = 0; d2 < M.diasT(t) && !feito; d2++) for (let a2 = 0; a2 < t.aulasDia && !feito; a2++) {
            if (d2 === d || (discDia[aid + '|' + d2] || 0) > 0 || base[t.id][d2 + '-' + a2]) continue;
            const other = g[d2 + '-' + a2];
            if (!other) { del(t, d, a); if (pode(t, d2, a2, at)) { put(t, d2, a2, at); feito = true; } else put(t, d, a, at); continue; }
            const ot = M.atr[other]; if ((discDia[other + '|' + d] || 0) > 0) continue;
            del(t, d, a); del(t, d2, a2);
            if (pode(t, d2, a2, at)) { put(t, d2, a2, at); if (pode(t, d, a, ot)) { put(t, d, a, ot); feito = true; } else { del(t, d2, a2); put(t, d, a, at); put(t, d2, a2, ot); } }
            else { put(t, d, a, at); put(t, d2, a2, ot); }
          }
        }
      }
      return { grade, falhas, custo: custoTotal(), regrasFalhas };
    }
    let best = null, n = 0;
    do {
      const r = tentativa(); n++;
      const score = r.falhas.length * 10000 + r.regrasFalhas.length * 3000 + r.custo;
      if (!best || score < best.score) best = { ...r, score };
      if (opt.onProgress) await opt.onProgress(n, best, Date.now() - ini, tempo);
      else await new Promise(r => setTimeout(r, 0));
      if (best.falhas.length === 0 && best.regrasFalhas.length === 0 && best.custo === 0) break;
    } while (Date.now() - ini < tempo && n < (opt.maxTentativas || 400));
    // motivos das não alocadas
    const naoAlocadas = [];
    const agrup = {}; best.falhas.forEach(at => agrup[at.id] = (agrup[at.id] || 0) + 1);
    for (const [aid, qtd] of Object.entries(agrup)) naoAlocadas.push({ atr: aid, qtd, motivo: Gerador.motivo(st, best.grade, M.atr[aid]) });
    return { grade: best.grade, naoAlocadas, custo: best.custo, tentativas: n };
  },
  motivo(st, grade, at) {
    const M = Modelo({ ...st, grade }), t = M.turma[at.turma], p = M.prof[at.prof], D = M.dias;
    const livresT = []; for (let d = 0; d < M.diasT(t); d++) for (let a = 0; a < t.aulasDia; a++) if (!(grade[t.id] || {})[d + '-' + a]) livresT.push([d, a]);
    const dem = st.atribs.filter(a => a.turma === t.id).reduce((s, a) => s + a.aulas, 0), cap = t.aulasDia * M.diasT(t);
    if (dem > cap) return `A turma ${t.nome} tem ${dem} aulas previstas para apenas ${cap} horários (${t.aulasDia} por dia).`;
    const ocupado = new Set(); for (const x of M.cells()) if (x.at && x.at.prof === p.id) ocupado.add(M.chaveTempo(x.t, x.d, x.a));
    const indisp = M.indisp[p.id];
    const comum = livresT.filter(([d, a]) => !ocupado.has(M.chaveTempo(t, d, a)) && !indisp.has(M.chaveTempo(t, d, a)));
    const horariosTurno = []; for (let d = 0; d < M.diasT(t); d++) for (let a = 0; a < t.aulasDia; a++) horariosTurno.push(M.chaveTempo(t, d, a));
    const dispNoTurno = horariosTurno.filter(k => !indisp.has(k)).length;
    const cargaNoTurno = st.atribs.filter(a => a.prof === p.id && M.turma[a.turma] && M.turma[a.turma].turno === t.turno).reduce((s, a) => s + a.aulas, 0);
    const totP = st.atribs.filter(a => a.prof === p.id).reduce((s, a) => s + a.aulas, 0);
    if (M.maxDia[p.id] != null && totP > M.maxDia[p.id] * D) return `O pedido “no máximo ${M.maxDia[p.id]} aulas por dia” deixa ${p.nome} com ${M.maxDia[p.id] * D} horários na semana, mas ele(a) tem ${totP} aulas. Aumente o máximo ou redistribua aulas.`;
    if (cargaNoTurno > dispNoTurno) return `${p.nome} tem ${cargaNoTurno} aulas no turno ${st.config.turnos[t.turno].nome.toLowerCase()}, mas só ${dispNoTurno} horários disponíveis nesse turno.`;
    if (!livresT.length) return `A grade de ${t.nome} está cheia.`;
    if (!comum.length) {
      const porIndisp = livresT.filter(([d, a]) => indisp.has(M.chaveTempo(t, d, a))).length;
      return `Os ${livresT.length} horários que sobraram em ${t.nome} coincidem com horários em que ${p.nome} já está em outra turma${porIndisp ? ` ou indisponível (${porIndisp})` : ''}. Troque manualmente uma aula de ${p.nome} ou da turma para abrir espaço.`;
    }
    return `Restaram horários compatíveis, mas as regras de repetição da disciplina no dia impediram a alocação. Coloque manualmente na grade.`;
  }
};

if (typeof module !== 'undefined') module.exports = { U, Zip, XLSX, PDF, Importer, Store, Modelo, validar, Gerador, Regras };
