"""Reglas de compra y mensajes; independiente de Flask y del servidor."""
import re
import unicodedata
from urllib.parse import urlencode

CIUDADES = {'bogota': 'Bogotá', 'chia': 'Chía', 'cajica': 'Cajicá', 'cota': 'Cota', 'soacha': 'Soacha'}
PAGOS = {'online': 'Pago en línea', 'tarjeta': 'Tarjeta de crédito', 'efectivo': 'Efectivo'}
ONLINE = {'llave': 'Llave', 'nequi': 'Nequi', 'daviplata': 'Daviplata', 'link': 'Link de pago'}
MIXED_FREE_IDS = {'aguacate', 'zucchini', 'cuadro-aloe'}


def cotizar(items, productos):
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise ValueError('Selecciona entre 1 y 100 líneas de productos')
    agrupados = {}
    for item in items:
        if not isinstance(item, dict) or set(item) != {'id', 'opcion', 'cantidad'}:
            raise ValueError('Cada línea debe incluir solo id, opción y cantidad')
        pid, op, cant = item['id'], item['opcion'], item['cantidad']
        if not isinstance(pid, str) or pid not in productos:
            raise ValueError('Producto desconocido')
        if type(op) is not int or not 0 <= op < len(productos[pid]['opciones']):
            raise ValueError('Presentación inválida')
        if type(cant) is not int or not 1 <= cant <= 50:
            raise ValueError('La cantidad debe ser un entero entre 1 y 50')
        key = (pid, op)
        agrupados[key] = agrupados.get(key, 0) + cant
        if agrupados[key] > 50:
            raise ValueError('Máximo 50 unidades por presentación')
    lineas, subtotal, ml, unidades, unidades_descuento, tiene_habilitado = [], 0, 0, 0, 0, False
    for (pid, index), cantidad in agrupados.items():
        producto = productos[pid]
        opcion = producto['opciones'][index]
        importe = opcion['precio'] * cantidad
        subtotal += importe
        ml += opcion['ml'] * cantidad
        unidades += opcion['unidades'] * cantidad
        if pid != 'cuadro-dual':
            unidades_descuento += opcion['unidades'] * cantidad
        tiene_habilitado = tiene_habilitado or producto['categoriaVisual'] == 'pollo' or pid in MIXED_FREE_IDS
        lineas.append(dict(nombre=producto['nombre'], opcion=opcion['etiqueta'], cantidad=cantidad,
                           importe=importe, variable=bool(producto.get('pesoVariable'))))
    domicilio = calcular_domicilio_global(ml, unidades, subtotal, tiene_habilitado, unidades_descuento)
    return dict(lineas=lineas, subtotal=subtotal, domicilio=domicilio, total=subtotal + domicilio)


def califica_envio_gratis_pedido_mixto(ml, subtotal, tiene_habilitado):
    return ml >= 1000 and subtotal >= 200000 and tiene_habilitado


def calcular_domicilio_global(ml, unidades, subtotal, tiene_habilitado=False, unidades_descuento=None):
    if unidades_descuento is None:
        unidades_descuento = unidades
    envio_por_litros = 0 if ml >= 3000 else 3000 if ml >= 2000 else 7000
    envio_por_cubos = 0 if unidades >= 48 else 3000 if unidades_descuento >= 24 else 7000
    envio_otros_productos = 0 if califica_envio_gratis_pedido_mixto(ml, subtotal, tiene_habilitado) else 7000
    return min(envio_por_litros, envio_por_cubos, envio_otros_productos)


def validar_cliente(cliente):
    limites = {'nombres': 80, 'apellidos': 80, 'telefono': 25, 'direccion': 180,
               'barrio': 80, 'ciudad': 20, 'nota': 400,
               'tipo-vivienda': 20, 'casa': 30, 'edificio': 80, 'torre': 30, 'apartamento': 30, 'piso': 15, 'indicaciones': 200}
    if not isinstance(cliente, dict) or set(cliente) - limites.keys():
        raise ValueError('Datos del cliente inválidos')
    limpio = {}
    for campo, limite in limites.items():
        valor = cliente.get(campo, '')
        if not isinstance(valor, str) or len(valor) > limite or any(
            (unicodedata.category(c) in ('Cc', 'Cs', 'Zl', 'Zp') or unicodedata.bidirectional(c) in
             ('LRE', 'RLE', 'LRO', 'RLO', 'PDF', 'LRI', 'RLI', 'FSI', 'PDI'))
            and not (c == '\n' and campo in ('nota', 'indicaciones')) for c in valor
        ):
            raise ValueError(f'Revisa el campo {campo} (máximo {limite} caracteres)')
        limpio[campo] = valor.strip()
        if campo in ('nombres', 'apellidos', 'telefono', 'direccion', 'barrio', 'ciudad') and not limpio[campo]:
            raise ValueError(f'Completa el campo {campo}')
    if limpio['ciudad'] not in CIUDADES:
        raise ValueError('Selecciona una ciudad disponible para entrega')
    if limpio['tipo-vivienda'] not in ('casa', 'apartamento'):
        raise ValueError('Selecciona Casa o Conjunto/Edificio como tipo de vivienda')
    if limpio['tipo-vivienda'] == 'casa':
        for campo in ('torre', 'apartamento', 'edificio'):
            limpio[campo] = ''
    else:
        if not limpio['edificio']:
            raise ValueError('Completa el nombre del conjunto o edificio')
        limpio['casa'] = ''
    telefono = re.sub(r'[ ()-]', '', limpio['telefono'])
    if not re.fullmatch(r'\+?[0-9]{7,15}', telefono):
        raise ValueError('Escribe un teléfono válido de 7 a 15 dígitos')
    return limpio


def maps_url(cliente):
    ciudad = CIUDADES[cliente['ciudad']]
    query = ', '.join((cliente['direccion'], cliente['barrio'], ciudad, 'Colombia'))
    return 'https://www.google.com/maps/search/?' + urlencode({'api': 1, 'query': query})


def moneda(n):
    return '$' + f'{n:,}'.replace(',', '.')


def generar_cotizacion(datos, productos, whatsapp):
    if not isinstance(datos, dict) or set(datos) != {'items', 'cliente', 'pago', 'online'}:
        raise ValueError('Solicitud inválida')
    resumen = cotizar(datos['items'], productos)
    cliente = validar_cliente(datos['cliente'])
    pago, online = datos['pago'], datos['online']
    if not isinstance(pago, str) or pago not in PAGOS or not isinstance(online, str) or online not in ONLINE:
        raise ValueError('Método de pago inválido')
    ciudad = cliente['ciudad']
    entrega = ('1 a 2 días, en la franja horaria de 10 a. m. a 4 p. m.' if ciudad == 'bogota' else
               'el jueves, en la franja horaria de 11 a. m. a 5 p. m.')
    detalle = ['*CAMPESINOS CHIGUANOS*', 'Cotización · Pendiente de confirmación por la tienda.', '', '*PRODUCTOS*']
    for numero, linea in enumerate(resumen['lineas'], 1):
        detalle.extend([f"{numero}. *{linea['nombre']}*",
                        f"   Presentación: {linea['opcion']}",
                        f"   Cantidad: {linea['cantidad']}",
                        f"   Valor: {moneda(linea['importe'])}"])
        if linea['variable']:
            detalle.append('   Precio sujeto al peso final.')
        detalle.append('')
    detalle.extend(['*RESUMEN DE VALORES*', f"Subtotal: {moneda(resumen['subtotal'])}",
                    f"Domicilio: {'GRATIS' if resumen['domicilio'] == 0 else moneda(resumen['domicilio'])}",
                    f"*Total estimado: {moneda(resumen['total'])}*", '', '*DATOS DE CONTACTO*',
                    f"Nombre: {cliente['nombres']} {cliente['apellidos']}", f"Teléfono: {cliente['telefono']}",
                    '', '*DATOS DE ENTREGA*', f"Dirección: {cliente['direccion']}",
                    f"Barrio: {cliente['barrio']}",
                    f"Ciudad: {CIUDADES[ciudad]}",
                    f"Tipo de vivienda: {'Casa' if cliente['tipo-vivienda'] == 'casa' else 'Conjunto/Edificio'}"])
    for campo in ('casa', 'edificio', 'torre', 'apartamento', 'piso', 'indicaciones'):
        if cliente[campo]:
            detalle.append(f'{campo.capitalize()}: {cliente[campo]}')
    detalle.extend([f'Entrega estimada: {entrega}', '', '*MEDIO DE PAGO*',
                    PAGOS[pago] + (f' ({ONLINE[online]})' if pago == 'online' else ''),
                    *(['', '*OBSERVACIONES*', cliente['nota']] if cliente['nota'] else [])])
    if any(l['variable'] for l in resumen['lineas']):
        detalle.extend(['', 'El total puede variar según el peso final.'])
    volumen_personalizable = sum(
        productos[i['id']]['opciones'][i['opcion']]['ml'] * i['cantidad']
        for i in datos['items']
        if productos[i['id']].get('categoriaVisual') == 'caldos'
        and '200 ml' not in productos[i['id']]['opciones'][i['opcion']]['etiqueta'].lower()
    )
    if volumen_personalizable >= 2000:
        detalle.extend(['', 'Ya puedes solicitar personalizar tu caldo de hueso gratis en bolsitas de 250 ml para facilitar el manejo en congelación.'])
    mapa = maps_url(cliente)
    texto = '\n'.join(detalle)
    mensaje = f'{texto}\n\n*UBICACIÓN EN GOOGLE MAPS*\n{mapa}\n\nGracias por elegir Campesinos Chiguanos.\nLa tienda confirmará disponibilidad y entrega por WhatsApp.'
    return dict(**resumen, detalle=texto, entrega=entrega, maps=mapa,
                   whatsapp=f'https://wa.me/{whatsapp}?' + urlencode({'text': mensaje}))
