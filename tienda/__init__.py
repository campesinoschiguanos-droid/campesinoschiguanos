"""Factoría de la aplicación, rutas HTTP y cabeceras de seguridad."""
from hashlib import sha256

from flask import Flask, abort, g, jsonify, render_template, request
from werkzeug.exceptions import HTTPException

from .catalog import BASE, CatalogStore, cargar_catalogo
from .config import configuration
from .orders import generar_cotizacion
from .security import cabeceras, error_peticion, read_order_json


def create_app(config=None):
    app = Flask(__name__, template_folder=str(BASE / 'templates'),
                static_folder=str(BASE / 'static'), static_url_path='/static')
    app.json.sort_keys = False
    app.config.update(configuration(config))
    catalog_path = app.config.get('CATALOG_PATH', BASE / 'catalogo.json')
    store = CatalogStore(catalog_path, lambda: cargar_catalogo(catalog_path), app.json.dumps)
    app.extensions['catalog_store'] = store
    app.extensions['catalog'] = store.get()
    hero_order = ('broth-pollo', 'cuadro-chicken', 'broth-beef',
                  'aguacate', 'mar-alas', 'cp-pechuga',
                  'corte-cubos', 'zucchini', 'sabor-green')
    assets = ('styles.css', 'refinements.css', 'night.css', 'night-stars.svg',
              'night-sky.jpg', 'theme.js', 'startup.js',
              'app.js', 'cart-core.mjs', 'api.mjs')
    asset_version = sha256(b''.join((BASE / 'static' / name).read_bytes() for name in assets)).hexdigest()[:12]

    @app.before_request
    def current_catalog():
        if request.endpoint not in ('inicio', 'catalogo', 'cotizacion', 'health'):
            return
        try:
            g.catalog = store.get()
        except (OSError, ValueError):
            app.logger.error('No se pudo cargar un catálogo válido')
            abort(503)
        app.extensions['catalog'] = g.catalog

    @app.get('/')
    def inicio():
        products = g.catalog['products']
        hero_products = [products[pid] for pid in hero_order if pid in products]
        hero_products.extend(p for pid, p in products.items() if pid not in hero_order)
        hero_columns = [hero_products[i::3] for i in range(3)]
        return render_template('index.html',
                               whatsapp_number=app.config['WHATSAPP_NUMBER'],
                               maps_embed_key=app.config['MAPS_EMBED_API_KEY'],
                               asset_version=asset_version, hero_columns=hero_columns,
                               product_images={pid: p['imagen'] for pid, p in products.items()})

    @app.get('/healthz')
    def health():
        return jsonify(status='ok')

    @app.get('/api/catalogo')
    def catalogo():
        response = app.response_class(g.catalog['json'], mimetype='application/json')
        response.set_etag(g.catalog['etag'])
        return response.make_conditional(request)

    @app.post('/api/cotizar')
    def cotizacion():
        # Stateless computation: no order persistence or payment side effects.
        origin = request.headers.get('Origin')
        if request.headers.get('Sec-Fetch-Site') == 'cross-site' or (
            origin and origin != request.host_url.rstrip('/')
        ):
            return jsonify(error='Solicitud de otro sitio no permitida'), 403
        datos = read_order_json()
        try:
            result = generar_cotizacion(datos, g.catalog['products'], app.config['WHATSAPP_NUMBER'])
        except ValueError as error:
            return jsonify(error=str(error)), 400
        return jsonify(result)

    app.after_request(cabeceras)
    app.register_error_handler(HTTPException, error_peticion)
    return app
