# Publica CarSofit en GitHub Pages (repo carlitoseh/CarSoFit, subcarpeta CarSofit/).
# 1) Genera index.html con build.py  2) copia los archivos a un clon local del repo  3) commit + push si hay cambios.
# Avisa si supabase/functions/ia/index.ts ha cambiado desde el último despliegue (lo despliega Claude con el conector).
import hashlib, os, shutil, stat, subprocess, sys
from datetime import datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO_URL = "https://github.com/carlitoseh/CarSoFit.git"
REPO = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "CarSofit-publicar", "repo")
DESTINO = os.path.join(REPO, "CarSofit")
ARCHIVOS = ["app.html", "index.html", "build.py", "publicar.py", "manifest.webmanifest", "sw.js", "CLAUDE.md"]
CARPETAS = ["icons", "vendor", "supabase"]
FUNCION = os.path.join(AQUI, "supabase", "functions", "ia", "index.ts")
HASH_DESPLEGADO = os.path.join(AQUI, "supabase", "functions", "ia", ".desplegado")
SILENCIOSO = "--silencioso" in sys.argv

def log(m):
    if not SILENCIOSO: print(m)

def git(*a, check=True):
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GCM_INTERACTIVE": "never"}
    r = subprocess.run(["git", *a], cwd=REPO, capture_output=True, text=True, encoding="utf-8", env=env)
    if check and r.returncode != 0:
        raise SystemExit(f"git {' '.join(a)} falló:\n{r.stderr.strip()}")
    return r.stdout.strip()

def main():
    # 1) index.html a partir de app.html
    subprocess.run([sys.executable, "build.py"], cwd=AQUI, check=True, capture_output=SILENCIOSO)

    # 2) clon local del repo, siempre alineado con GitHub (la carpeta de OneDrive manda)
    if not os.path.isdir(os.path.join(REPO, ".git")):
        os.makedirs(os.path.dirname(REPO), exist_ok=True)
        subprocess.run(["git", "clone", "-q", REPO_URL, REPO], check=True)
    git("fetch", "-q", "origin")
    rama = git("rev-parse", "--abbrev-ref", "origin/HEAD", check=False).replace("origin/", "") or "main"
    git("checkout", "-q", rama)
    git("reset", "-q", "--hard", f"origin/{rama}")

    # Borra solo los archivos (no las carpetas: Windows a veces las bloquea) y vuelve a copiar
    for raiz, _, archivos in os.walk(DESTINO):
        for a in archivos:
            ruta = os.path.join(raiz, a)
            os.chmod(ruta, stat.S_IWRITE)
            os.remove(ruta)
    os.makedirs(DESTINO, exist_ok=True)
    for f in ARCHIVOS:
        shutil.copy2(os.path.join(AQUI, f), DESTINO)
    for c in CARPETAS:
        shutil.copytree(os.path.join(AQUI, c), os.path.join(DESTINO, c), dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns(".desplegado", "__pycache__", ".temp"))

    # 3) commit + push
    git("add", "-A")
    if not git("status", "--porcelain"):
        log("GitHub ya estaba al día: no hay cambios que publicar.")
    else:
        git("commit", "-q", "-m", f"Actualiza CarSofit ({datetime.now():%d/%m/%Y %H:%M})")
        git("push", "-q", "origin", rama)
        print("Publicado en GitHub. En 1-2 minutos estará en https://carlitoseh.github.io/CarSoFit/CarSofit/")

    # Aviso si la función de IA no está desplegada en Supabase
    h = hashlib.sha256(open(FUNCION, "rb").read()).hexdigest()
    previo = open(HASH_DESPLEGADO).read().strip() if os.path.exists(HASH_DESPLEGADO) else ""
    if h != previo:
        print("AVISO: supabase/functions/ia/index.ts ha cambiado y falta desplegarla en Supabase "
              "(Claude: despliega la función 'ia' con el conector y ejecuta `python publicar.py --funcion-desplegada`).")

if __name__ == "__main__":
    if "--funcion-desplegada" in sys.argv:
        open(HASH_DESPLEGADO, "w").write(hashlib.sha256(open(FUNCION, "rb").read()).hexdigest())
        print("Anotado: la función 'ia' desplegada coincide con la local.")
    else:
        main()
