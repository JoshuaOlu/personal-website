#!/usr/bin/env python3
"""Photographs a 1200x630 preview card for every piece of writing.

GitHub runs this after the site is built:  python3 scripts/make_cards.py _site
It serves the built site, opens /og/#<piece> in headless Chrome and saves _site/assets/og/<piece>.png.
If a card cannot be made, the standard preview picture is used instead, so a link preview never breaks.
Test it yourself with:  CHROME=/path/to/chrome python3 scripts/make_cards.py _site
"""
import functools, http.server, json, os, shutil, socketserver, struct, subprocess, sys, tempfile, threading, zlib

site = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '_site')
out_dir = os.path.join(site, 'assets', 'og')
default_png = os.path.join(site, 'assets', 'images', 'og-default.png')
cards_json = os.path.join(site, 'og', 'cards.json')
if not os.path.exists(cards_json):
    print('No cards to make.'); sys.exit(0)
cards = json.load(open(cards_json, encoding='utf-8'))
if not cards:
    print('No writing yet, so no cards.'); sys.exit(0)

chrome = os.environ.get('CHROME') or next((shutil.which(c) for c in ('google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium') if shutil.which(c)), None)
if not chrome:
    print('::warning::No Chrome found. Using the standard preview picture for every piece.')
os.makedirs(out_dir, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=site)
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    return struct.unpack('>II', head[16:24])

def crop_png(path, keep_rows):
    """Keep only the first rows of an 8-bit, non-interlaced PNG (what Chrome writes). No extra libraries needed."""
    data = open(path, 'rb').read()
    pos = 8; idat = b''; ihdr = None; other = []
    while pos < len(data):
        n, = struct.unpack('>I', data[pos:pos + 4]); kind = data[pos + 4:pos + 8]; body = data[pos + 8:pos + 8 + n]; pos += 12 + n
        if kind == b'IHDR': ihdr = body
        elif kind == b'IDAT': idat += body
        elif kind == b'IEND': break
        elif kind in (b'PLTE', b'tRNS', b'gAMA', b'sRGB', b'iCCP', b'pHYs'): other.append((kind, body))
    w, h, depth, ctype, _, _, interlace = struct.unpack('>IIBBBBB', ihdr)
    if depth != 8 or interlace != 0 or ctype not in (2, 6):
        raise ValueError('unsupported PNG')
    bpp = 4 if ctype == 6 else 3
    stride = w * bpp
    raw = zlib.decompress(idat)
    rows = []; prev = bytearray(stride)
    for y in range(keep_rows):
        f = raw[y * (stride + 1)]; line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        if f == 1:
            for i in range(bpp, stride): line[i] = (line[i] + line[i - bpp]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride): line[i] = (line[i] + (((line[i - bpp] if i >= bpp else 0) + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0; b = prev[i]; c = prev[i - bpp] if i >= bpp else 0
                p = a + b - c; pa = abs(p - a); pb = abs(p - b); pc = abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(bytes(line)); prev = line
    def chunk(kind, body): return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)
    out = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, keep_rows, 8, ctype, 0, 0, 0))
    for kind, body in other: out += chunk(kind, body)
    out += chunk(b'IDAT', zlib.compress(b''.join(b'\x00' + r for r in rows), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(out)

made = failed = 0
for c in cards:
    slug = c['slug']; dest = os.path.join(out_dir, slug + '.png'); ok = False
    if chrome:
        profile = tempfile.mkdtemp(prefix='cardprofile')
        try:
            # Shoot in a tall window (so nothing is cut off) and keep the top 630 rows.
            subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                            '--user-data-dir=' + profile, '--window-size=1200,760', '--virtual-time-budget=8000',
                            '--screenshot=' + dest, 'http://127.0.0.1:%d/og/#%s' % (port, slug)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
            size = png_size(dest) if os.path.exists(dest) else None
            if size and size[0] == 1200 and size[1] >= 630:
                if size[1] > 630:
                    crop_png(dest, 630)
                ok = png_size(dest) == (1200, 630)
        except Exception as e:
            print('::warning::Card for %s failed: %s' % (slug, e))
        finally:
            shutil.rmtree(profile, ignore_errors=True)
    if ok:
        made += 1; print('Made card for', slug)
    else:
        failed += 1
        if os.path.exists(default_png): shutil.copyfile(default_png, dest)
        print('::warning::Could not make a card for %s. Using the standard preview picture.' % slug)
srv.shutdown()
print('Cards: %d made, %d fell back.' % (made, failed))
