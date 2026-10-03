"""Punto de entrada WSGI compatible con waitress-serve app:app."""
from tienda import create_app

app = create_app()

if __name__ == '__main__':
    from serve import main
    main(app)
