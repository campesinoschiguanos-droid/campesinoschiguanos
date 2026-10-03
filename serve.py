"""Arranque local con límites de recursos; ejecutar con python serve.py."""
import argparse

from waitress import serve
from tienda import create_app


def main(application=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8001, help='Puerto local (8001 por defecto)')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('El puerto debe estar entre 1 y 65535')
    app = application if application is not None else create_app()
    serve(app, host='127.0.0.1', port=args.port, threads=4,
          connection_limit=100, channel_timeout=60, cleanup_interval=10,
          max_request_body_size=app.config['MAX_CONTENT_LENGTH'],
          max_request_header_size=8192, expose_tracebacks=False)


if __name__ == '__main__':
    main()
