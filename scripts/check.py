"""Comprueba dependencias, catálogo, servidor y reglas JavaScript sin enviar pedidos."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default=os.environ.get('NODE', 'node'),
                        help='Ejecutable Node.js (también configurable con NODE)')
    args = parser.parse_args()
    node = shutil.which(args.node)
    if not node:
        parser.error('Node.js no está disponible. Instálalo o indica su ruta con --node.')
    env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
    commands = ([sys.executable, '-m', 'pip', 'check'],
                [sys.executable, '-m', 'unittest', 'discover', '-v'],
                [node, 'test_frontend.cjs'])
    for command in commands:
        subprocess.run(command, cwd=ROOT, env=env, check=True)
    for path in sorted((ROOT / 'static').glob('*.mjs')):
        subprocess.run([node, '--check', str(path)], check=True)
    for path in sorted((ROOT / 'static').glob('*.js')):
        subprocess.run([node, '--input-type=module', '--check'], input=path.read_bytes(), check=True)
    print('Verificación completa: dependencias, Python y JavaScript correctos.')


if __name__ == '__main__':
    main()
