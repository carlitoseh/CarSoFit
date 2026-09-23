# Genera index.html (app instalable conectada a Supabase) a partir de app.html
body=open('app.html',encoding='utf-8').read()
head='''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F2F5F0">
<meta name="color-scheme" content="light">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="CarSofit">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>body{margin:0}[hidden]{display:none!important}:root{padding-top:env(safe-area-inset-top,0px)}</style>
'''
t=body.index('</title>')+len('</title>')
out=head+body[:t]+"\n"+body[t:].replace('<div class="app">','</head>\n<body>\n<div class="app">',1)
out=out.replace('<script>\n/* =====','<script src="vendor/supabase.js"></script>\n<script>\n/* =====',1)
assert 'const CLOUD_ENABLED = false;' in out
out=out.replace('const CLOUD_ENABLED = false;','const CLOUD_ENABLED = true;',1)
out=out.replace('<p class="demo">Prototipo · fase 1 · datos de ejemplo guardados solo en este móvil</p>','<p class="demo">CarSofit · sincronizado entre los dos móviles</p>')
out+='''
<script>if("serviceWorker" in navigator){addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));}</script>
</body>
</html>
'''
open('index.html','w',encoding='utf-8').write(out)
print('index.html generado')
