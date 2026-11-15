"""Assemble le back-office démo en un seul fichier HTML : VITE_DEMO=1 npx vite build && python3 build-demo-html.py out.html"""
import base64, glob, sys
js = open(glob.glob('dist-demo/assets/*.js')[0]).read()
css = open(glob.glob('dist-demo/assets/*.css')[0]).read()
logo = 'data:image/png;base64,' + base64.b64encode(open('dist-demo/logo.png', 'rb').read()).decode()
js = js.replace('"/logo.png"', '"%s"' % logo).replace('</script', '<\\/script')
html = ('<title>Rentaya Admin — démo</title>\n<style>\nbody { background: #F8F4FD; color: #2A0B4D; color-scheme: light; }\n' + css +
        '\n</style>\n<div id="root"></div>\n<script type="module">' + js + '</script>\n')
open(sys.argv[1], 'w').write(html)
print(sys.argv[1], len(html) // 1024, 'KB')
