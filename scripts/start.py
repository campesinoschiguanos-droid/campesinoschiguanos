"""Inicia la tienda con su entorno de Python, desde cualquier carpeta."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def main():
    suffix = 'Scripts/python.exe' if os.name == 'nt' else 'bin/python'
    candidates = (ROOT / '.venv' / suffix, ROOT / 'venv' / suffix,
                  ROOT.parent.parent / 'work' / 'venv' / suffix, Path(sys.executable))
    for python in dict.fromkeys(candidates):
        if not python.is_file():
            continue
        result = subprocess.run([str(python), '-c', 'import flask, waitress'],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode == 0:
            os.chdir(ROOT)
            os.execv(str(python), [str(python), str(ROOT / 'serve.py'), *sys.argv[1:]])
    raise SystemExit('Faltan las dependencias. Crea .venv e instala requirements-lock.txt como indica README.md.')


if __name__ == '__main__':
    main()
