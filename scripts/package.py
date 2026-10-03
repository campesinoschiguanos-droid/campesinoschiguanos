"""Genera el ZIP de entrega a partir de una lista explícita de archivos."""
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
FILES = ('app.py', 'serve.py', 'render.yaml', 'catalogo.json', 'requirements.txt',
         'requirements-lock.txt', 'README.md', '.gitignore',
         'test_app.py', 'test_infrastructure.py', 'test_frontend.cjs')
FOLDERS = ('tienda', 'static', 'templates', 'scripts')
UNUSED_PUBLIC_DOCS = ROOT / 'static' / 'docs'


def collect_files():
    files = [ROOT / name for name in FILES]
    for folder in FOLDERS:
        files.extend(path for path in (ROOT / folder).rglob('*')
                     if path.is_file() and not path.is_symlink()
                     and UNUSED_PUBLIC_DOCS not in path.parents
                     and '__pycache__' not in path.parts
                     and path.name != '.DS_Store'
                     and path.suffix not in ('.pyc', '.pyo', '.zip'))
    return sorted(files)


def main():
    files = collect_files()
    destination = ROOT.parent / (ROOT.name + '.zip')
    with NamedTemporaryFile(dir=ROOT.parent, suffix='.zip', delete=False) as file:
        temporary = Path(file.name)
    try:
        with ZipFile(temporary, 'w', ZIP_DEFLATED) as archive:
            for path in files:
                archive.write(path, Path(ROOT.name) / path.relative_to(ROOT))
        with ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise RuntimeError('El archivo comprimido no superó la verificación')
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Paquete verificado: {len(files)} archivos en {destination}')


if __name__ == '__main__':
    main()
