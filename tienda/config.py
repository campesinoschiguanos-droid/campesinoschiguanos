"""Configuración validada en cada creación de la aplicación."""
import os
import re

MAX_REQUEST_BYTES = 16 * 1024


def configuration(overrides=None):
    config = {
        'MAX_CONTENT_LENGTH': MAX_REQUEST_BYTES,
        'MAPS_EMBED_API_KEY': os.environ.get('GOOGLE_MAPS_EMBED_API_KEY', ''),
        'TRUSTED_HOSTS': os.environ.get('TRUSTED_HOSTS', '127.0.0.1,localhost').split(',')
                         + [domain for domain in os.environ.get('CUSTOM_DOMAINS', '').split(',') if domain.strip()],
        'WHATSAPP_NUMBER': os.environ.get('WHATSAPP_NUMBER', '573132046536'),
        'DEBUG': False,
    }
    config.update(overrides or {})
    hosts = config['TRUSTED_HOSTS']
    if not isinstance(hosts, (list, tuple)) or not 1 <= len(hosts) <= 32:
        raise ValueError('TRUSTED_HOSTS debe ser una lista de dominios permitidos')
    clean = []
    for host in hosts:
        if not isinstance(host, str):
            raise ValueError('Dominio inválido en TRUSTED_HOSTS')
        host = host.strip().lower()
        labels = host.removeprefix('.').split('.')
        if len(host) > 253 or not all(
            re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label)
            for label in labels
        ):
            raise ValueError('TRUSTED_HOSTS solo admite dominios o IPv4, sin URL, puerto ni comodines')
        clean.append(host)
    config['TRUSTED_HOSTS'] = list(dict.fromkeys(clean))
    number = config['WHATSAPP_NUMBER']
    if not isinstance(number, str) or not re.fullmatch(r'[1-9][0-9]{7,14}', number):
        raise ValueError('WHATSAPP_NUMBER debe contener solo dígitos con código de país')
    limit = config['MAX_CONTENT_LENGTH']
    if type(limit) is not int or not 1 <= limit <= MAX_REQUEST_BYTES:
        raise ValueError('MAX_CONTENT_LENGTH debe estar entre 1 y 16384 bytes')
    return config
