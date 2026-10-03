"""Regresiones de configuración, respuestas HTTP y datos malformados."""
import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from scripts.package import ROOT, collect_files
from tienda import create_app
from tienda.catalog import CatalogStore, cargar_catalogo, indexar_catalogo
from tienda.config import configuration


class InfrastructureTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True})
        self.client = self.app.test_client()
        self.payload = {
            'items': [{'id': 'broth-pollo', 'opcion': 0, 'cantidad': 1}],
            'pago': 'online', 'online': 'llave',
            'cliente': {'nombres': 'Prueba', 'apellidos': 'Tienda',
                        'telefono': '3001234567', 'direccion': 'Dirección de prueba',
                        'barrio': 'Centro', 'ciudad': 'bogota', 'tipo-vivienda': 'casa'},
        }

    def test_unicode_malformado_no_provoca_error_interno(self):
        for field in ('direccion', 'nombres', 'nota', 'indicaciones'):
            for character in ('\ud800', '\udfff', '\u2028', '\u2029'):
                with self.subTest(field=field, character=ascii(character)):
                    payload = copy.deepcopy(self.payload)
                    payload['cliente'][field] = 'Prueba' + character
                    response = self.client.post('/api/cotizar', json=payload)
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(response.mimetype, 'application/json')
                    self.assertNotIn('Traceback', response.get_data(as_text=True))
        self.payload['cliente']['nota'] = 'Preparación familiar 🥣\nGracias'
        self.assertEqual(self.client.post('/api/cotizar', json=self.payload).status_code, 200)

    def test_catalogo_se_revalida_y_cotizacion_no_se_guarda_en_cache(self):
        first = self.client.get('/api/catalogo')
        self.assertTrue(first.json)
        self.assertEqual(first.headers['Cache-Control'], 'public, no-cache')
        etag = first.headers['ETag']
        repeat = self.client.get('/api/catalogo', headers={'If-None-Match': etag})
        self.assertEqual(repeat.status_code, 304)
        self.assertEqual(repeat.data, b'')
        quote = self.client.post('/api/cotizar', json=self.payload)
        self.assertEqual(quote.headers['Cache-Control'], 'no-store')
        self.assertNotIn('ETag', quote.headers)
        self.assertNotIn('Set-Cookie', quote.headers)
        categories, products = cargar_catalogo()
        products['broth-pollo']['opciones'][0]['precio'] += 1
        with patch('tienda.cargar_catalogo', return_value=(categories, products)):
            changed = create_app({'TESTING': True}).test_client().get(
                '/api/catalogo', headers={'If-None-Match': etag})
        self.assertEqual(changed.status_code, 200)
        self.assertNotEqual(changed.headers['ETag'], etag)

    def test_instancias_independientes(self):
        second = create_app({'TESTING': True, 'WHATSAPP_NUMBER': '573001234567'})
        with second.test_client() as client:
            response = client.post('/api/cotizar', json=self.payload)
            self.assertTrue(response.json['whatsapp'].startswith('https://wa.me/573001234567?'))
            self.assertIn(b'data-whatsapp-url="https://wa.me/573001234567"', client.get('/').data)
        self.assertNotEqual(self.app.config['WHATSAPP_NUMBER'], second.config['WHATSAPP_NUMBER'])
        self.assertIsNot(self.app.extensions['catalog']['products'], second.extensions['catalog']['products'])

    def test_configuracion_rechaza_hosts_y_limites_inseguros(self):
        for hosts in ([], None, [''], ['*'], ['https://tienda.example'], ['localhost:8001'], ['a..example'], [42]):
            with self.subTest(hosts=hosts), self.assertRaises(ValueError):
                configuration({'TRUSTED_HOSTS': hosts})
        for limit in (None, True, 0, -1, 16385):
            with self.subTest(limit=limit), self.assertRaises(ValueError):
                configuration({'MAX_CONTENT_LENGTH': limit})
        self.assertEqual(configuration({'TRUSTED_HOSTS': [' localhost ', '.TIENDA.EXAMPLE']})['TRUSTED_HOSTS'], ['localhost', '.tienda.example'])
        with patch.dict('os.environ', {'TRUSTED_HOSTS': 'campesinos-chiguanos.onrender.com', 'CUSTOM_DOMAINS': 'tienda.example,www.tienda.example'}):
            configured = configuration()
            self.assertEqual(configured['TRUSTED_HOSTS'], ['campesinos-chiguanos.onrender.com', 'tienda.example', 'www.tienda.example'])
            client = create_app({'TESTING': True}).test_client()
            self.assertEqual(client.get('/healthz', base_url='https://tienda.example').status_code, 200)
            self.assertEqual(client.get('/healthz', base_url='https://www.tienda.example').status_code, 200)
            self.assertEqual(client.get('/healthz', base_url='https://otro.example').status_code, 400)
        with self.assertRaises(ValueError):
            create_app({'WHATSAPP_NUMBER': 'javascript:alert(1)'})
        configured = create_app({'TESTING': True, 'TRUSTED_HOSTS': ['tienda.example']}).test_client()
        self.assertEqual(configured.get('/healthz', base_url='http://tienda.example').status_code, 200)
        self.assertEqual(configured.get('/healthz', base_url='http://otro.example').status_code, 400)

    def test_errores_api_son_json_y_conservan_cabeceras(self):
        for path, status in (('/api/desconocida', 404), ('/api/cotizar', 405)):
            response = self.client.get(path)
            self.assertEqual(response.status_code, status)
            self.assertEqual(response.mimetype, 'application/json')
            self.assertIn('error', response.json)
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertIn('POST', self.client.get('/api/cotizar').headers['Allow'])
        self.app.config['PROPAGATE_EXCEPTIONS'] = False
        with patch('tienda.generar_cotizacion', side_effect=RuntimeError('detalle interno privado')):
            with patch.object(self.app.logger, 'error'):
                response = self.client.post('/api/cotizar', json=self.payload)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.mimetype, 'application/json')
        self.assertNotIn('detalle interno privado', response.get_data(as_text=True))
        self.assertIn('Content-Security-Policy', response.headers)

    def test_health_no_expone_configuracion_y_contenido_privado(self):
        response = self.client.get('/healthz')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {'status': 'ok'})
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        for path in ('/catalogo.json', '/.env', '/tienda/config.py', '/app.py'):
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_catalogo_con_tipos_incorrectos_falla_al_iniciar(self):
        categories, products = cargar_catalogo()
        products['broth-pollo']['categoriaVisual'] = []
        with self.assertRaises(ValueError):
            indexar_catalogo(categories)
        with self.assertRaises(ValueError):
            indexar_catalogo({'vacia': {'productos': []}})

    def test_json_duplicado_o_no_finito_se_rechaza(self):
        body = json.dumps(self.payload)
        ambiguous = body[:-1] + ', "items": [{"id":"broth-pollo","opcion":0,"cantidad":3}]}'
        nested = body.replace('"nombres": "Prueba"', '"nombres": "Prueba", "nombres": "Otra persona"')
        for raw in (ambiguous, nested, body.replace('"cantidad": 1', '"cantidad": NaN'),
                    body.replace('"cantidad": 1', '"cantidad": Infinity'), '[' * 2000 + '0' + ']' * 2000):
            with self.subTest(raw=raw[:80]):
                response = self.client.post('/api/cotizar', data=raw, content_type='application/json')
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.mimetype, 'application/json')
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                self.assertNotIn('Traceback', response.get_data(as_text=True))
        self.assertEqual(self.client.post('/api/cotizar', data=body, content_type='application/json').status_code, 200)

    def test_modulos_javascript_y_archivos_privados(self):
        for name in ('cart-core.mjs', 'api.mjs'):
            response = self.client.get('/static/' + name)
            self.assertEqual(response.status_code, 200)
            self.assertIn(response.mimetype, ('text/javascript', 'application/javascript'))
            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
            response.close()
        for path in ('/static/../catalogo.json', '/static/../tienda/security.py', '/static/%2e%2e/README.md'):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_arranque_aplica_limites_en_waitress(self):
        from serve import main
        with patch('sys.argv', ['serve.py']), patch('serve.serve') as server:
            main(self.app)
        options = server.call_args.kwargs
        self.assertEqual(options['host'], '127.0.0.1')
        self.assertEqual(options['max_request_body_size'], self.app.config['MAX_CONTENT_LENGTH'])
        self.assertEqual(options['max_request_header_size'], 8192)
        self.assertFalse(options['expose_tracebacks'])
        self.assertFalse(self.app.debug)

    def test_paquete_omite_pdf_sin_uso_y_conserva_assets(self):
        packaged = {path.relative_to(ROOT).as_posix() for path in collect_files()}
        self.assertIn('static/app.js', packaged)
        self.assertIn('static/night.css', packaged)
        self.assertIn('catalogo.json', packaged)
        self.assertFalse(any(name.startswith('static/docs/') for name in packaged))

    def test_catalogo_actualiza_fotos_portada_y_precios_sin_reiniciar(self):
        categories, _ = cargar_catalogo()
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'catalogo.json'
            path.write_text(json.dumps(categories))
            client = create_app({'TESTING': True, 'CATALOG_PATH': path}).test_client()
            first = client.get('/api/catalogo')
            chicken = categories['broths']['productos'][0]
            self.assertEqual(chicken['id'], 'broth-pollo')
            new_image = categories['cortesPollo']['productos'][-1]['imagen']
            chicken['imagen'] = new_image
            chicken['opciones'][0]['precio'] += 123
            path.write_text(json.dumps(categories))
            updated = client.get('/api/catalogo', headers={'If-None-Match': first.headers['ETag']})
            self.assertEqual(updated.status_code, 200)
            self.assertNotEqual(updated.headers['ETag'], first.headers['ETag'])
            self.assertEqual(updated.json['broths']['productos'][0]['imagen'], new_image)
            # Hero, editorial sections and cards now share the catalog image.
            page = client.get('/').get_data(as_text=True)
            self.assertIn(new_image, page)
            self.assertNotIn('src="/static/e34629c6bf8769f3.webp"', page)
            quote = client.post('/api/cotizar', json=self.payload)
            self.assertEqual(quote.status_code, 200)
            self.assertEqual(quote.json['subtotal'], chicken['opciones'][0]['precio'])

    def test_catalogo_invalido_bloquea_cotizar_y_se_recupera(self):
        categories, _ = cargar_catalogo()
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'catalogo.json'
            valid = json.dumps(categories)
            path.write_text(valid)
            application = create_app({'TESTING': True, 'CATALOG_PATH': path})
            client = application.test_client()
            path.write_text('{"incompleto":')
            with patch.object(application.logger, 'error'):
                for endpoint in ('/api/catalogo', '/healthz', '/'):
                    response = client.get(endpoint)
                    self.assertEqual(response.status_code, 503)
                    self.assertEqual(response.headers['Cache-Control'], 'no-store')
                quote = client.post('/api/cotizar', json=self.payload)
            self.assertEqual(quote.status_code, 503)
            self.assertIn('error', quote.json)
            self.assertNotIn('Traceback', quote.get_data(as_text=True))
            path.write_text(valid)
            self.assertEqual(client.get('/healthz').status_code, 200)
            self.assertEqual(client.post('/api/cotizar', json=self.payload).status_code, 200)

    def test_catalogo_sin_cambios_reutiliza_snapshot(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'catalogo.json'
            path.write_text('{}')
            loader = unittest.mock.Mock(return_value=({'test': {'productos': []}}, {}))
            store = CatalogStore(path, loader, json.dumps)
            first = store.get()
            self.assertIs(first, store.get())
            self.assertEqual(loader.call_count, 1)

    def test_catalogo_cambiado_durante_lectura_no_publica_snapshot_anterior(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'catalogo.json'
            path.write_text('1')
            def loader():
                value = path.read_text()
                if value == '1':
                    path.write_text('22')
                return {'value': value}, {}
            store = CatalogStore(path, loader, json.dumps)
            self.assertEqual(store.get()['categories']['value'], '22')


if __name__ == '__main__':
    unittest.main()
