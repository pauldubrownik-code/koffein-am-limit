"""Build index.html (single file, for GitHub Pages and for the Claude artifact) from src/."""
import base64, pathlib
r = pathlib.Path(__file__).parent
b64 = lambda n: base64.b64encode((r / 'img' / n).read_bytes()).decode()
head = (r / 'src/head.html').read_text().split('\n')
title, meta, fonts = head[0], head[1], head[2]
js = (r / 'src/app.js').read_text().replace('@@ORIGIN@@', b64('origin.jpg')).replace('@@PROFUEL@@', b64('profuel.jpg'))
assert '@@' not in js
css = (r / 'src/style.css').read_text()
gh = (r / 'src/githubdb.js').read_text()
body = (r / 'src/body.html').read_text()
out = ('<!doctype html><html lang="de"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
       '<meta name="theme-color" content="#0f1115">' + title + fonts +
       '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icons/icon-192.png"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png">'
       '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Koffein"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
       '<script>document.documentElement.setAttribute("data-skin","ring")</script>' +
       '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}[hidden]{display:none!important}img{max-width:100%}</style>'
       '</head><body><style>' + css + '</style>' + body + '<script>' + gh + '</script><script>' + js + '</script></body></html>')
(r / 'index.html').write_text(out)
print('index.html', len(out))
