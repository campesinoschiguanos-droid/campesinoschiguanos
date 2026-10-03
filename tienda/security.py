"""HTTP security headers, strict request decoding and public error responses."""
import json

from flask import jsonify, request
from werkzeug.exceptions import BadRequest, UnsupportedMediaType


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _reject_constant(value):
    raise ValueError("Non-finite JSON number")


def read_order_json():
    """Reject ambiguous JSON before validating order fields and prices."""
    if not request.is_json:
        raise UnsupportedMediaType()
    try:
        return json.loads(request.get_data(cache=False), object_pairs_hook=_unique_object,
                          parse_constant=_reject_constant)
    except (ValueError, RecursionError):
        raise BadRequest() from None


def cabeceras(response):
    response.headers.update({
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; frame-src https://www.google.com; media-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Permitted-Cross-Domain-Policies': 'none',
    })
    if request.path == '/':
        response.headers['Cache-Control'] = 'no-cache'
    if request.path == '/api/catalogo' and response.status_code in (200, 304):
        response.headers['Cache-Control'] = 'public, no-cache'
    elif request.path.startswith('/api/') or request.path == '/healthz':
        response.headers['Cache-Control'] = 'no-store'
    if response.status_code >= 400:
        response.headers['Cache-Control'] = 'no-store'
    if request.is_secure:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response


def error_peticion(error):
    if not (request.path.startswith('/api/') or request.path == '/healthz') and error.code not in (400, 413, 415, 503):
        return error
    messages = {
        400: 'Solicitud JSON inválida',
        404: 'Ruta de API no encontrada',
        405: 'Método no permitido',
        413: 'La solicitud supera el tamaño permitido',
        415: 'Usa Content-Type application/json',
        500: 'No pudimos procesar el pedido. Inténtalo de nuevo.',
        503: 'La tienda está temporalmente no disponible. Inténtalo de nuevo en un momento.',
    }
    # Preserve HTTP headers (e.g. Allow on 405); never expose exception details.
    response = error.get_response()
    response.set_data(jsonify(error=messages.get(error.code, 'No se pudo procesar la solicitud')).get_data())
    response.content_type = 'application/json'
    return response
