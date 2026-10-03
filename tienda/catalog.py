"""Carga y validación del catálogo local."""
import json
import re
from hashlib import sha256
from pathlib import Path
from threading import RLock

BASE = Path(__file__).resolve().parent.parent
PRODUCT_CATEGORIES = {'caldos', 'cubos', 'pollo', 'marinados', 'frescos'}


def indexar_catalogo(catalogo):
    """Valida el archivo local antes de exponerlo o usarlo para calcular precios."""
    if not isinstance(catalogo, dict) or not catalogo:
        raise ValueError('El catálogo debe contener categorías')
    productos = {}
    for categoria in catalogo.values():
        if not isinstance(categoria, dict) or not isinstance(categoria.get('productos'), list):
            raise ValueError('Categoría de catálogo inválida')
        for producto in categoria['productos']:
            required = {'id', 'nombre', 'etiqueta', 'categoriaVisual', 'imagen', 'desc', 'detalle', 'hechos', 'opciones'}
            if not isinstance(producto, dict) or not required <= producto.keys():
                raise ValueError('Producto de catálogo incompleto')
            pid = producto['id']
            if not isinstance(pid, str) or not re.fullmatch(r'[a-z0-9-]{1,60}', pid) or pid in productos:
                raise ValueError(f'Identificador de producto inválido o duplicado: {pid!r}')
            if not isinstance(producto['categoriaVisual'], str) or producto['categoriaVisual'] not in PRODUCT_CATEGORIES:
                raise ValueError(f'Categoría visual inválida para {pid}')
            for campo in ('nombre', 'etiqueta', 'desc', 'detalle'):
                if not isinstance(producto[campo], str) or not producto[campo] or len(producto[campo]) > 1000:
                    raise ValueError(f'Campo {campo} inválido para {pid}')
            imagen = producto['imagen']
            galeria = producto.get('galeria', [])
            if (not isinstance(galeria, list) or len(galeria) > 5
                    or any(not isinstance(foto, str) for foto in galeria)
                    or len(set(galeria)) != len(galeria) or imagen in galeria):
                raise ValueError(f'Galería inválida para {pid}')
            for foto in [imagen, *galeria]:
                if not isinstance(foto, str) or not re.fullmatch(r'/static/[a-f0-9]+\.(?:png|jpe?g|webp)', foto):
                    raise ValueError(f'Ruta de imagen inválida para {pid}')
                if not (BASE / foto.removeprefix('/')).is_file():
                    raise ValueError(f'Imagen inexistente para {pid}')
            hechos = producto['hechos']
            if not isinstance(hechos, list) or any(not isinstance(h, str) or len(h) > 500 for h in hechos):
                raise ValueError(f'Información adicional inválida para {pid}')
            opciones = producto['opciones']
            if not isinstance(opciones, list) or not opciones:
                raise ValueError(f'Presentaciones inválidas para {pid}')
            for opcion in opciones:
                if not isinstance(opcion, dict) or set(opcion) != {'etiqueta', 'precio', 'ml', 'unidades'}:
                    raise ValueError(f'Presentación incompleta para {pid}')
                if not isinstance(opcion['etiqueta'], str) or not opcion['etiqueta'] or len(opcion['etiqueta']) > 80:
                    raise ValueError(f'Etiqueta de presentación inválida para {pid}')
                if type(opcion['precio']) is not int or opcion['precio'] <= 0:
                    raise ValueError(f'Precio inválido para {pid}')
                if any(type(opcion[campo]) is not int or opcion[campo] < 0 for campo in ('ml', 'unidades')):
                    raise ValueError(f'Medida inválida para {pid}')
            if 'pesoVariable' in producto and not isinstance(producto['pesoVariable'], bool):
                raise ValueError(f'Indicador de peso inválido para {pid}')
            productos[pid] = producto
    if not productos:
        raise ValueError('El catálogo debe contener productos')
    return productos


def cargar_catalogo(path=None):
    catalogo = json.loads(Path(path or BASE / 'catalogo.json').read_text(encoding='utf-8'))
    return catalogo, indexar_catalogo(catalogo)


class CatalogStore:
    """Publish a complete, validated snapshot when the catalog file changes."""

    def __init__(self, path, loader, serialize):
        self.path = Path(path)
        self.loader = loader
        self.serialize = serialize
        self._lock = RLock()
        self._signature = None
        self._snapshot = None
        self.get()  # Invalid catalogs must also fail at startup.

    def _file_signature(self):
        stat = self.path.stat()
        return (stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)

    def get(self):
        with self._lock:
            signature = self._file_signature()
            if signature == self._signature:
                return self._snapshot
            # A file being saved must never produce a partial snapshot.
            for _ in range(3):
                categories, products = self.loader()
                after = self._file_signature()
                if signature == after:
                    body = self.serialize(categories).encode('utf-8')
                    snapshot = {'categories': categories, 'products': products,
                                'json': body, 'etag': sha256(body).hexdigest()}
                    self._signature, self._snapshot = after, snapshot
                    return snapshot
                signature = after
            raise ValueError('El catálogo cambió durante su lectura')
