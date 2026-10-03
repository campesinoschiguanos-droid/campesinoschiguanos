"""Actualiza una foto sin editarla y publica el catálogo mediante reemplazo atómico."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from tienda.catalog import cargar_catalogo, indexar_catalogo


def replace_image(product_id, source):
    path = ROOT / 'catalogo.json'
    original = path.read_bytes()
    categories, products = cargar_catalogo()
    if product_id not in products:
        raise ValueError('Producto desconocido')
    content = Path(source).read_bytes()
    if content.startswith(b'\x89PNG\r\n\x1a\n'):
        extension = 'png'
    elif content.startswith(b'\xff\xd8\xff'):
        extension = 'jpg'
    elif content[:4] == b'RIFF' and content[8:12] == b'WEBP':
        extension = 'webp'
    else:
        raise ValueError('La imagen debe ser PNG, JPEG o WebP')
    name = sha256(content).hexdigest()[:16] + '.' + extension
    target = ROOT / 'static' / name
    if not target.exists():
        target.write_bytes(content)
    elif target.read_bytes() != content:
        raise ValueError('Conflicto con una imagen existente')
    product = products[product_id]
    product['imagen'] = '/static/' + name
    if 'galeria' in product:
        product['galeria'] = [photo for photo in product['galeria'] if photo != product['imagen']]
    indexar_catalogo(categories)
    with NamedTemporaryFile(dir=ROOT, suffix='.json', delete=False) as file:
        temporary = Path(file.name)
        file.write((json.dumps(categories, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
    try:
        if path.read_bytes() != original:
            raise ValueError('El catálogo cambió durante la actualización. Vuelve a intentarlo.')
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return product['imagen']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('producto', help='Identificador del producto, por ejemplo cp-entero')
    parser.add_argument('imagen', type=Path)
    args = parser.parse_args()
    try:
        image = replace_image(args.producto, args.imagen)
    except (OSError, ValueError) as error:
        parser.exit(1, f'No se actualizó el catálogo: {error}\n')
    print(f'Foto actualizada: {args.producto} → {image}. Recarga la página para verla.')


if __name__ == '__main__':
    main()
