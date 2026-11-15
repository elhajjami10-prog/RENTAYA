"""Assemble l'export web (mode démo) en un seul fichier HTML autonome.
Usage : EXPO_PUBLIC_DEMO=1 EXPO_PUBLIC_API_URL=/ npx expo export --platform web --output-dir dist-demo
        python3 scripts/build-demo-html.py dist-demo rentaya-demo.html"""
import re, base64, glob, os, sys
root, out = sys.argv[1], sys.argv[2]
js = open(glob.glob(root + '/_expo/static/js/web/entry-*.js')[0]).read()
mime = {'.png': 'image/png', '.ttf': 'font/ttf'}
keep = ('Ionicons', 'logo-', '@react-navigation')
def repl(m):
    p = m.group(1)
    if not any(k in p for k in keep):
        return m.group(0)
    data = open(root + p, 'rb').read()
    return '"data:%s;base64,%s"' % (mime[os.path.splitext(p)[1]], base64.b64encode(data).decode())
js = re.sub(r'"(/assets/[^"]+)"', repl, js).replace('</script', '<\\/script')
css = ''.join(open(f).read() for f in glob.glob(root + '/_expo/static/css/*.css'))
html = ('<title>Rentaya — démo</title>\n<meta name="theme-color" content="#6A1BD0">\n<style>\n'
        'html, body { height: 100%; }\nbody { overflow: hidden; background: #FFFFFF; color: #2A0B4D; color-scheme: light; }\n'
        '#root { display: flex; height: 100%; flex: 1; }\n' + css + '\n</style>\n<div id="root"></div>\n'
        "<script>try { if (location.pathname !== '/') history.replaceState(null, '', '/' + location.search); } catch (e) {}</script>\n"
        '<script>' + js + '</script>\n')
open(out, 'w').write(html)
print(out, len(html) // 1024, 'KB')
