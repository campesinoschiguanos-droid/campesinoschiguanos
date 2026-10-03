import copy
import unittest
from urllib.parse import urlparse, parse_qs
from functools import partial
from tienda import create_app
from tienda.catalog import BASE, cargar_catalogo, indexar_catalogo
from tienda.orders import cotizar as calcular_cotizacion, calcular_domicilio_global

CATALOGO, PRODUCTOS = cargar_catalogo()
cotizar = partial(calcular_cotizacion, productos=PRODUCTOS)
app = create_app({'TESTING': True})


def item(pid='broth-pollo', opcion=0, cantidad=1):
    return dict(id=pid, opcion=opcion, cantidad=cantidad)


class TiendaTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.payload = dict(items=[item()], pago='online', online='llave', cliente={
            'nombres': 'Ana', 'apellidos': 'Pérez', 'telefono': '3001234567',
            'direccion': 'Calle 1', 'barrio': 'Centro', 'ciudad': 'bogota', 'nota': '', 'tipo-vivienda':'casa'})

    def test_domicilio_caldos(self):
        for cantidad, envio in [(1, 7000), (2, 3000), (3, 0)]:
            with self.subTest(cantidad=cantidad):
                self.assertEqual(cotizar([item(cantidad=cantidad)])['domicilio'], envio)

    def test_volumen_sin_redondeo(self):
        self.assertEqual(cotizar([item(opcion=5, cantidad=10)])['domicilio'], 3000)
        self.assertEqual(cotizar([item(opcion=5, cantidad=15)])['domicilio'], 0)

    def test_cubos_y_mezclas(self):
        for opcion, envio in [(0,7000),(1,3000),(2,0)]:
            self.assertEqual(cotizar([item('cuadro-chicken',opcion)])['domicilio'], envio)
        self.assertEqual(cotizar([item(),item('cuadro-chicken',2)])['domicilio'], 0)

    def test_cuadros_dual_precios_y_domicilio(self):
        dual = PRODUCTOS['cuadro-dual']
        self.assertEqual(dual['nombre'], 'Cuadros Dual')
        self.assertEqual([option['precio'] for option in dual['opciones']], [27000, 53000, 100000])
        for opcion, envio in ((0, 7000), (1, 7000), (2, 0)):
            with self.subTest(opcion=opcion):
                quote = cotizar([item('cuadro-dual', opcion)])
                self.assertEqual(quote['domicilio'], envio)
                self.assertEqual(quote['total'], dual['opciones'][opcion]['precio'] + envio)
        self.assertEqual(cotizar([item('cuadro-dual', 0, 2)])['domicilio'], 7000)
        self.assertEqual(cotizar([item('cuadro-dual', 0, 4)])['domicilio'], 0)
        self.assertEqual(cotizar([item('cuadro-dual', 0), item('cuadro-chicken', 0)])['domicilio'], 7000)
        self.assertEqual(cotizar([item('cuadro-dual', 0), item('cuadro-chicken', 1)])['domicilio'], 3000)
        self.assertEqual(cotizar([item('cuadro-dual', 1), item('cuadro-chicken', 1)])['domicilio'], 0)

    def test_umbral_inclusivo_200000(self):
        self.assertEqual(cotizar([item(),item('aguacate',cantidad=20)])['domicilio'],7000)
        self.assertEqual(cotizar([item(),item('aguacate',cantidad=21)])['domicilio'],0)
        self.assertEqual(cotizar([item('aguacate',cantidad=25)])['domicilio'],7000)

    def test_calculo_global_de_domicilio(self):
        for ml, cubos, subtotal, habilitado, esperado in [
            (1000, 0, 50000, False, 7000), (1900, 0, 50000, False, 7000),
            (2000, 0, 50000, False, 3000), (2200, 0, 50000, False, 3000),
            (2500, 0, 50000, False, 3000), (2900, 0, 50000, False, 3000),
            (2990, 0, 50000, False, 3000), (3000, 0, 50000, False, 0),
            (3100, 0, 50000, False, 0), (0, 12, 50000, False, 7000),
            (0, 23, 50000, False, 7000), (0, 24, 50000, False, 3000),
            (0, 36, 50000, False, 3000), (0, 47, 50000, False, 3000),
            (0, 48, 50000, False, 0), (3000, 0, 80000, True, 0),
            (0, 36, 80000, True, 3000), (0, 48, 80000, True, 0),
            (2500, 12, 80000, False, 3000), (1000, 48, 80000, True, 0),
            (1000, 0, 199999, True, 7000), (1000, 0, 200000, True, 0),
            (1000, 0, 200000, False, 7000), (0, 0, 200000, True, 7000),
        ]:
            with self.subTest(ml=ml,cubos=cubos,subtotal=subtotal):
                self.assertEqual(calcular_domicilio_global(ml,cubos,subtotal,habilitado),esperado)

    def test_cantidades_invalidas(self):
        for cantidad in [True,0,-1,51,100,1.5,'2',None,10**100]:
            with self.subTest(cantidad=cantidad), self.assertRaises(ValueError):
                cotizar([item(cantidad=cantidad)])

    def test_identificadores_invalidos(self):
        for linea in [item('no-existe'),item(opcion=-1),item(opcion=True),item(opcion=20),item(pid=[]),{}]:
            with self.subTest(linea=linea), self.assertRaises(ValueError): cotizar([linea])

    def test_duplicados(self):
        self.assertEqual(cotizar([item(),item()])['total'],77000)
        with self.assertRaises(ValueError): cotizar([item(cantidad=60),item(cantidad=60)])

    def test_no_acepta_precio_del_cliente(self):
        self.payload['items'][0]['precio']=1
        self.assertEqual(self.client.post('/api/cotizar',json=self.payload).status_code,400)

    def test_cotizacion(self):
        response=self.client.post('/api/cotizar',json=self.payload)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['total'],44000)
        self.assertTrue(response.json['whatsapp'].startswith('https://wa.me/573132046536?text='))
        self.assertEqual(response.headers['Cache-Control'],'no-store')
        self.assertNotIn('personalizar tu caldo de hueso gratis en bolsitas de 250 ml',response.json['detalle'])

    def test_mensaje_whatsapp_organizado(self):
        self.payload['items'] = [item(cantidad=3), item('aguacate')]
        self.payload['cliente']['nota'] = 'Sin sal'
        result = self.client.post('/api/cotizar', json=self.payload).json
        message = parse_qs(urlparse(result['whatsapp']).query)['text'][0]
        self.assertIn('Domicilio: GRATIS', message)
        self.assertIn('1. *Chicken Bone Broth*\n   Presentación: 1 litro\n   Cantidad: 3', message)
        self.assertIn('\n\n2. *Aguacate Hass*', message)
        for title in ('RESUMEN DE VALORES', 'DATOS DE CONTACTO', 'DATOS DE ENTREGA', 'MEDIO DE PAGO', 'OBSERVACIONES', 'UBICACIÓN EN GOOGLE MAPS'):
            self.assertIn(f'\n\n*{title}*\n', message)
        self.assertIn(result['maps'], message)

    def test_personalizacion_excluye_presentaciones_200ml(self):
        self.payload['items']=[item(opcion=5,cantidad=5)]
        response=self.client.post('/api/cotizar',json=self.payload)
        self.assertNotIn('personalizar tu caldo de hueso gratis en bolsitas de 250 ml',response.json['detalle'])
        self.payload['items']=[item(opcion=4,cantidad=2)]
        response=self.client.post('/api/cotizar',json=self.payload)
        self.assertNotIn('personalizar tu caldo de hueso gratis en bolsitas de 250 ml',response.json['detalle'])
        self.payload['items']=[item(opcion=4,cantidad=4)]
        response=self.client.post('/api/cotizar',json=self.payload)
        self.assertIn('personalizar tu caldo de hueso gratis en bolsitas de 250 ml',response.json['detalle'])
        self.payload['items']=[item(opcion=1)]
        response=self.client.post('/api/cotizar',json=self.payload)
        self.assertIn('personalizar tu caldo de hueso gratis en bolsitas de 250 ml',response.json['detalle'])

    def test_maps_codifica_direccion_y_ciudad(self):
        self.payload['cliente'].update(direccion='Carrera 7 # 11-10 & esquina', ciudad='soacha')
        response=self.client.post('/api/cotizar',json=self.payload)
        url=urlparse(response.json['maps'])
        self.assertEqual((url.scheme,url.netloc,url.path),('https','www.google.com','/maps/search/'))
        self.assertEqual(parse_qs(url.query),{'api':['1'],'query':['Carrera 7 # 11-10 & esquina, Centro, Soacha, Colombia']})
        self.assertEqual(url.fragment,'')
        self.assertIn(response.json['maps'],parse_qs(urlparse(response.json['whatsapp']).query)['text'][0])
        self.assertNotIn('3001234567',response.json['maps'])

    def test_mapa_opcional_y_aceptacion_inicial(self):
        from unittest.mock import patch
        with patch.dict(app.config, MAPS_EMBED_API_KEY=''):
            html=self.client.get('/').get_data(as_text=True)
            self.assertNotIn('id="showAddressMap"',html)
            self.assertIn('id="quoteWhatsApp" target="_blank" rel="noopener noreferrer" aria-disabled="true"',html)
        with patch.dict(app.config, MAPS_EMBED_API_KEY='test"<key>'):
            response=self.client.get('/')
            html=response.get_data(as_text=True)
            self.assertIn('id="mapPlaceholder"',html)
            self.assertIn('test&#34;&lt;key&gt;',html)
            self.assertIn('frame-src https://www.google.com;',response.headers['Content-Security-Policy'])

    def test_html_es_texto_json(self):
        payload='<img src=x onerror=alert(1)>'
        self.payload['cliente']['nombres']=payload
        response=self.client.post('/api/cotizar',json=self.payload)
        self.assertEqual(response.status_code,200)
        self.assertIn(payload,response.json['detalle'])
        self.assertEqual(response.mimetype,'application/json')

    def test_soacha_y_horarios(self):
        for ciudad in ('chia', 'cajica', 'cota', 'soacha'):
            self.payload['cliente']['ciudad'] = ciudad
            response = self.client.post('/api/cotizar', json=self.payload)
            self.assertEqual(response.status_code, 200)
            self.assertIn('11 a. m. a 5 p. m.', response.json['entrega'])

    def test_casa_y_apartamento(self):
        self.payload['cliente'].update(casa='8',apartamento='201',torre='A',piso='2')
        response=self.client.post('/api/cotizar',json=self.payload)
        self.assertEqual(response.status_code,200)
        self.assertIn('Tipo de vivienda: Casa',response.json['detalle'])
        self.assertIn('Piso: 2',response.json['detalle'])
        self.assertIn('Casa: 8',response.json['detalle'])
        self.assertNotIn('Apartamento: 201',response.json['detalle'])
        self.payload['cliente']['tipo-vivienda']='apartamento'
        self.assertEqual(self.client.post('/api/cotizar',json=self.payload).status_code,400)
        self.payload['cliente']['edificio']='Conjunto Los Pinos'
        response=self.client.post('/api/cotizar',json=self.payload)
        self.assertIn('Apartamento: 201',response.json['detalle'])
        self.assertNotIn('Casa: 8',response.json['detalle'])
        self.payload['cliente']['tipo-vivienda']='invalido'
        self.assertEqual(self.client.post('/api/cotizar',json=self.payload).status_code,400)

    def test_cincuenta_y_limite_acumulado(self):
        self.assertEqual(cotizar([item(cantidad=50)])['lineas'][0]['cantidad'],50)
        with self.assertRaises(ValueError): cotizar([item(cantidad=25),item(cantidad=26)])

    def test_datos_cliente(self):
        for campo,valor in [('telefono','abc'),('ciudad','inventada'),('direccion',''),('nombres','a'*81),('nombres','a\nb')]:
            data=copy.deepcopy(self.payload);data['cliente'][campo]=valor
            self.assertEqual(self.client.post('/api/cotizar',json=data).status_code,400)
        self.payload['cliente']['ciudad']='otra'
        self.assertEqual(self.client.post('/api/cotizar',json=self.payload).status_code,400)
        self.payload['cliente']['otra-ciudad']='Medellín'
        self.assertEqual(self.client.post('/api/cotizar',json=self.payload).status_code,400)

    def test_controles_invisibles_y_origen(self):
        for character in ('\x7f', '\x85', '\u202e', '\u2066'):
            data = copy.deepcopy(self.payload)
            data['cliente']['nota'] = 'Texto' + character + 'oculto'
            self.assertEqual(self.client.post('/api/cotizar', json=data).status_code, 400)
        for origin in ('https://otro-sitio.example', 'null'):
            self.assertEqual(self.client.post('/api/cotizar', json=self.payload, headers={'Origin': origin}).status_code, 403)
        self.assertEqual(self.client.post('/api/cotizar', json=self.payload, headers={'Origin': 'http://localhost'}).status_code, 200)

    def test_json_profundo_y_campos_no_publicos(self):
        response = self.client.post('/api/cotizar', data='[' * 1100 + ']' * 1100,
                                    content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.mimetype, 'application/json')
        self.payload['cliente']['otra-ciudad'] = 'Medellín'
        self.assertEqual(self.client.post('/api/cotizar', json=self.payload).status_code, 400)
        self.assertEqual(self.client.get('/').headers['Cache-Control'], 'no-cache')

    def test_peticion_invalida(self):
        for data in [None,[],{},dict(self.payload,pago=[])]:
            self.assertEqual(self.client.post('/api/cotizar',json=data).status_code,400 if data is not None else 415)
        self.assertEqual(self.client.post('/api/cotizar',data='{',content_type='application/json').status_code,400)
        self.assertEqual(self.client.post('/api/cotizar',data=' '*17000,content_type='application/json').status_code,413)
        self.assertEqual(self.client.post('/api/cotizar',json=self.payload,headers={'Sec-Fetch-Site':'cross-site'}).status_code,403)

    def test_pagina_y_cabeceras(self):
        response=self.client.get('/')
        self.assertEqual(response.status_code,200)
        self.assertIn("script-src 'self'",response.headers['Content-Security-Policy'])
        self.assertNotIn("'unsafe-inline'",response.headers['Content-Security-Policy'])
        self.assertNotIn(b'onclick=',response.data)
        self.assertNotIn(b' style=',response.data)
        self.assertNotIn(b'<script>',response.data)
        self.assertIn(b'id="quoteDetails"',response.data)
        self.assertNotIn(b'id="quoteText"',response.data)
        for control in (b'id="copyOrder"', b'id="cancelOrder"', b'id="sentConfirmationModal"',
                        b'id="finishOrderModal"', b'id="cancelOrderModal"', b'id="orderSuccessModal"'):
            self.assertIn(control, response.data)
        self.assertIn(b'Enviar pedido por WhatsApp', response.data)
        self.assertIn(b'Cancelar y vaciar pedido', response.data)
        self.assertEqual(self.client.get('/api/catalogo').status_code,200)
        self.assertEqual(self.client.get('/static/../app.py').status_code,404)

    def test_host_y_cabeceras_adicionales(self):
        self.assertEqual(self.client.get('/', headers={'Host': 'sitio-falso.example'}).status_code, 400)
        response = self.client.get('/')
        self.assertEqual(response.headers['Cross-Origin-Opener-Policy'], 'same-origin')
        self.assertEqual(response.headers['Cross-Origin-Resource-Policy'], 'same-origin')
        self.assertEqual(response.headers['X-Permitted-Cross-Domain-Policies'], 'none')
        self.assertIn("connect-src 'self'", response.headers['Content-Security-Policy'])

class IntegracionTests(unittest.TestCase):
    def test_catalogo_rechaza_datos_inseguros(self):
        catalogo = copy.deepcopy(CATALOGO)
        primero = next(iter(catalogo.values()))['productos'][0]
        primero['imagen'] = 'javascript:alert(1)'
        with self.assertRaises(ValueError):
            indexar_catalogo(catalogo)
        catalogo = copy.deepcopy(CATALOGO)
        productos = next(iter(catalogo.values()))['productos']
        productos.append(copy.deepcopy(productos[0]))
        with self.assertRaises(ValueError):
            indexar_catalogo(catalogo)

    def test_catalogo_completo(self):
        self.assertEqual(len(PRODUCTOS),39)
        for p in PRODUCTOS.values():
            for o in p['opciones']:
                self.assertIs(type(o['precio']),int)
                self.assertGreater(o['precio'],0)
            self.assertTrue(p['imagen'].startswith('/static/'))
        self.assertEqual(PRODUCTOS['broth-pollo']['nombre'],'Chicken Bone Broth')
        self.assertEqual(PRODUCTOS['broth-beef']['nombre'],'Beef Bone Broth')
        self.assertEqual(PRODUCTOS['combo-sabores']['nombre'],'Combo de sabores')
        self.assertEqual(PRODUCTOS['broth-dual']['nombre'],'Dual Broth')
        self.assertEqual(PRODUCTOS['broth-pollo-neutro']['nombre'],'Chicken Bone Broth Neutro')
        self.assertEqual(PRODUCTOS['cuadro-aloe']['categoriaVisual'],'cubos')

    def test_galeria_de_producto_y_rutas_invalidas(self):
        for pid in ('cuadro-green', 'cuadro-chicken', 'cuadro-beef', 'cuadro-dual', 'cuadro-turmeric', 'cuadro-mexican', 'cuadro-aloe'):
            product = PRODUCTOS[pid]
            self.assertFalse(product.get('galeria'))
            self.assertTrue((BASE / product['imagen'].lstrip('/')).is_file())
        green = PRODUCTOS['cuadro-green']
        for images in ('texto', ['javascript:alert(1)'], ['/static/inexistente.webp'],
                       [green['imagen']], [PRODUCTOS['cuadro-beef']['imagen']] * 2, [42]):
            with self.subTest(images=images), self.assertRaises(ValueError):
                catalogo = copy.deepcopy(CATALOGO)
                product = next(p for category in catalogo.values()
                               for p in category['productos'] if p['id'] == 'cuadro-green')
                product['galeria'] = images
                indexar_catalogo(catalogo)

    def test_combo_y_presentaciones(self):
        self.assertEqual(cotizar([item('combo-sabores',0)])['total'],180000)
        self.assertEqual(cotizar([item('combo-sabores',1)])['total'],96000)
        self.assertEqual(cotizar([item('combo-sabores',2)])['total'],46000)
        self.assertEqual(cotizar([item('broth-pollo',1)])['total'],75000)

    def test_direccion_completa_y_peso_variable(self):
        data=dict(items=[item('cp-entero')],pago='efectivo',online='llave',cliente={
            'nombres':'Ana','apellidos':'Prueba','telefono':'3001234567','direccion':'Calle 1',
            'barrio':'Centro','ciudad':'soacha','tipo-vivienda':'apartamento','edificio':'Prueba',
            'torre':'B','apartamento':'201','piso':'2','indicaciones':'Portería\nPreguntar al vigilante','nota':'Sin sal\nGracias'})
        response=app.test_client().post('/api/cotizar',json=data)
        self.assertEqual(response.status_code,200)
        self.assertIn('Apartamento: 201',response.json['detalle'])
        self.assertIn('peso final',response.json['detalle'])
        self.assertIn('11 a. m. a 5 p. m.',response.json['entrega'])

    def test_assets_y_controles(self):
        import re
        html=(BASE/'templates/index.html').read_text()
        ids=re.findall(r'\bid="([^"]+)"',html)
        self.assertEqual(len(ids),len(set(ids)))
        for p in PRODUCTOS.values():
            self.assertTrue((BASE/p['imagen'].lstrip('/')).is_file())
        for pid in re.findall(r'data-feature-product="([^"]+)"',html):
            self.assertIn(pid,PRODUCTOS)

if __name__ == '__main__': unittest.main()
