'use strict';
/* Small, careful edits to YAML front matter text. They change one key and leave
   every other line (comments included) exactly as it was. */

const yq = (s) => JSON.stringify(String(s));

function foldedBlock(text, indent = '  ', width = 78) {
  const words = String(text).trim().split(/\s+/);
  const lines = []; let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= width) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return '>-\n' + lines.map((l) => indent + l).join('\n');
}

function yamlValue(kind, v) {
  switch (kind) {
    case 'date': return String(v);
    case 'num': return String(Number(v));
    case 'bool': return v ? 'true' : 'false';
    case 'list': return '[' + v.map((x) => (/^[A-Za-z0-9_.-]+$/.test(x) ? x : yq(x))).join(', ') + ']';
    case 'folded': return String(v).length > 90 || /\n/.test(v) ? foldedBlock(String(v).replace(/\s*\n\s*/g, ' ')) : yq(v);
    default: return yq(v);
  }
}

function keyIndex(lines, key, indent = '') {
  const re = new RegExp('^' + indent + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\s|$)');
  return lines.findIndex((l) => re.test(l));
}
function nextNonBlank(lines, i) {
  for (let j = i + 1; j < lines.length; j++) if (lines[j].trim() !== '') return lines[j];
  return '';
}
function blockEnd(lines, i, baseIndentLen = 0) {
  let j = i + 1;
  while (j < lines.length) {
    const l = lines[j];
    const indented = /^[ \t]+\S/.test(l) && (l.match(/^[ \t]*/)[0].length > baseIndentLen);
    if (indented) { j++; continue; }
    if (l.trim() === '' && /^[ \t]+\S/.test(nextNonBlank(lines, j)) && nextNonBlank(lines, j).match(/^[ \t]*/)[0].length > baseIndentLen) { j++; continue; }
    break;
  }
  return j;
}

/* Set a top-level key. `formatted` is the text after "key:" (may contain newlines for a folded block). */
function setKey(raw, key, formatted) {
  const lines = String(raw).split('\n');
  const i = keyIndex(lines, key);
  const newLines = (formatted === '' ? key + ':' : key + ': ' + formatted).split('\n');
  if (i >= 0) lines.splice(i, blockEnd(lines, i) - i, ...newLines);
  else {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push(...newLines);
  }
  return lines.join('\n');
}
function removeKey(raw, key) {
  const lines = String(raw).split('\n');
  const i = keyIndex(lines, key);
  if (i < 0) return raw;
  lines.splice(i, blockEnd(lines, i) - i);
  return lines.join('\n');
}
/* Set or clear a top-level key. Empty value removes it (or leaves "key:" if keepEmpty). */
function setField(raw, key, kind, value, keepEmpty = false) {
  const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0 && kind !== 'list');
  if (kind === 'bool') return setKey(raw, key, yamlValue('bool', !!value));
  if (empty) {
    if (keepEmpty && keyIndex(String(raw).split('\n'), key) >= 0) return setKey(raw, key, '');
    return removeKey(raw, key);
  }
  return setKey(raw, key, yamlValue(kind, value));
}
/* Set a key one level down, inside a block such as "image:". */
function setNested(raw, parent, key, kind, value) {
  const lines = String(raw).split('\n');
  const pi = keyIndex(lines, parent);
  const empty = value == null || value === '';
  if (pi < 0) {
    if (empty) return raw;
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push(parent + ':', '  ' + key + ': ' + yamlValue(kind, value));
    return lines.join('\n');
  }
  const end = blockEnd(lines, pi);
  const re = new RegExp('^[ \\t]+' + key + ':(\\s|$)');
  let ki = -1;
  for (let j = pi + 1; j < end; j++) if (re.test(lines[j])) { ki = j; break; }
  if (ki >= 0) {
    if (empty) lines.splice(ki, 1);
    else lines[ki] = '  ' + key + ': ' + yamlValue(kind, value);
  } else if (!empty) {
    lines.splice(end, 0, '  ' + key + ': ' + yamlValue(kind, value));
  }
  return lines.join('\n');
}

/* A very small Markdown reader, only for the rough preview pane. */
function miniMarkdown(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  const out = []; let list = null; let para = [];
  const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const endList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  for (const line of String(src).replace(/\r/g, '').split('\n')) {
    let m;
    if (/^\s*$/.test(line)) { flush(); endList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); endList(); out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { flush(); if (list !== 'ul') { endList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) { flush(); if (list !== 'ol') { endList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); endList(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); continue; }
    if (/^\{:.*\}\s*$/.test(line)) continue;
    if ((m = line.match(/^\{%\s*include\s+embed\.html\s+url="([^"]*)"/))) { flush(); endList(); out.push('<p class="md-embed">▶ Embedded media: ' + esc(m[1]) + '</p>'); continue; }
    if (/^<figure>/.test(line)) { flush(); endList(); const a = (line.match(/alt="([^"]*)"/) || [])[1] || ''; const c = (line.match(/<figcaption>(.*?)<\/figcaption>/) || [])[1] || ''; out.push('<p class="md-embed">🖼 Picture: ' + esc(a) + (c ? ' · ' + c : '') + '</p>'); continue; }
    if (/^---+\s*$/.test(line)) { flush(); endList(); out.push('<hr>'); continue; }
    endList(); para.push(line.trim());
  }
  flush(); endList();
  return out.join('\n');
}
