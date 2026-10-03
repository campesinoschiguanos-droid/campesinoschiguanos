# Campesinos Chiguanos — diseño integrado

Esta versión une la base Python de la primera entrega con el diseño y las fotografías de la segunda página. Usa **los precios y las presentaciones de la segunda página**, según la indicación del usuario. Los archivos originales y la primera entrega se conservaron.

## Abrir la tienda

Requiere Python 3.10 o posterior. Desde esta carpeta:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-lock.txt
python scripts/start.py
```

Abrir **http://127.0.0.1:8001**. En Windows se activa el entorno con `.venv\Scripts\activate`.

El archivo de `templates/` requiere el servidor Python; no se debe abrir directamente con doble clic. La vista local compartida durante la entrega funciona mientras el servidor de esta sesión permanezca activo. No se publicó en Internet.

## Publicar desde GitHub con alojamiento Python

El repositorio de GitHub guarda el código. La tienda necesita un servicio Python porque `/api/catalogo` y `/api/cotizar` calculan el catálogo, los precios y el domicilio; GitHub Pages por sí solo no ejecuta estas rutas.

1. Descomprime el ZIP de entrega y sube **el contenido de la carpeta** `campesinos-chiguanos-integrado` a la raíz de un repositorio nuevo en GitHub. `app.py`, `render.yaml`, `catalogo.json`, `static/`, `templates/` y `tienda/` deben quedar en la raíz. No subas el ZIP como único archivo.
2. En Render, crea un **Blueprint** desde ese repositorio. El archivo `render.yaml` instala `requirements.txt`, arranca el servicio web con Waitress y configura el dominio permitido de Render. El plan indicado es `free`; revisa las condiciones y limitaciones actuales antes de activarlo.
3. Cuando el despliegue termine, abre el enlace `https://...onrender.com` que entregue Render. Comprueba `/healthz`, abre Cuadros Dual y verifica el cálculo del domicilio. Ese enlace público es el que puedes compartir; `http://127.0.0.1:8001` solo funciona en este computador.

Si usas un dominio propio, añádelo en Render > servicio > Settings > Custom Domains, configura los registros DNS que Render indique y verifica el dominio. En Render > Environment agrega `CUSTOM_DOMAINS` con el dominio raíz y `www`, por ejemplo `micampo.com,www.micampo.com`, sin `https://`. La aplicación conserva automáticamente el dominio temporal de Render definido por `render.yaml`. Para otro alojamiento Python, usa el punto de entrada WSGI `app:app`, instala `requirements.txt`, configura `TRUSTED_HOSTS` y arranca Waitress escuchando en el puerto que indique la plataforma.

Referencias: [despliegue Flask en Render](https://render.com/docs/deploy-flask) y [configuración de Blueprints](https://render.com/docs/blueprint-spec).

## Diseño y marca

- Paleta corporativa: verde `#6E8B60`, amarillo `#FFDC00`, salmón `#F5A380`, gris `#808080`. Se añadieron neutros claros y un verde oscuro de apoyo para legibilidad.
- Se conservó el logo circular de la web. No se utilizó el logo del manual.
- Voz cercana y cálida; referencia a Choachí, a la herencia familiar y al campo.
- Cabecera flotante, superficies translúcidas, desenfoque moderado, sombras suaves y curvas, como detalles de la referencia visual indicada por el usuario.
- Se mantuvieron fotografías, destacados, sabores, historia, buscador, filtros, ordenamiento y detalles de producto de la segunda página.
- Carrito lateral y formularios con gestión de foco, cierre con Escape y fondo inactivo mientras hay un diálogo abierto.
- Se respetan las preferencias de movimiento reducido; donde el navegador lo admite, también transparencia reducida.

**Fuente pendiente:** el manual especifica Visby Round CF. No se aportaron archivos web de esa fuente. El CSS prioriza su nombre si está instalada y usa Fredoka de Google Fonts como alternativa. Para una coincidencia tipográfica exacta y consistente entre equipos, incorporar los archivos WOFF2 autorizados mediante `@font-face` en `static/refinements.css`. No se extrajo una fuente del PDF ni se compró una licencia.

## Catálogo y pedidos

Hay 39 productos. `catalogo.json` es la fuente de precios, presentaciones, volumen y unidades. Las fotos y los precios se actualizan al recargar la página: el servidor detecta los cambios, valida el archivo y publica una versión completa. Los identificadores internos de la primera entrega se conservaron para productos equivalentes; se agregó el combo de cinco sabores.

Se conservaron los precios de la segunda página. El pollo entero muestra su tarifa por kilo, pero la cantidad seleccionada corresponde a pollos completos: 1 equivale a un pollo, 2 a dos pollos. La ficha, el carrito y la presentación incluida en la cotización explican esta diferencia; el valor final depende del peso real y se confirma por WhatsApp. Los productos por kilo se identifican como de precio sujeto al peso final.

El domicilio se calcula según la primera versión:

- Caldos: menos de 2 litros, $7.000; desde 2 litros, $3.000; desde 3 litros, gratis.
- Cuadros: menos de 24 unidades, $7.000; desde 24, $3.000; desde 48, gratis. Cuadros Dual conserva $7.000 con 12 o 24 unidades y llega a domicilio gratis con 48; en pedidos combinados se aplica la mejor tarifa alcanzada.
- En mezclas de caldos y cuadros se usa la tarifa más favorable.
- El pedido mixto alcanza envío gratis desde $200.000 cuando incluye mínimo 1 L de caldo y al menos un producto habilitado: cortes de pollo, aguacate, zucchini o aloe vera.

**Supuesto del combo:** “Combo 1 litro”, “Combo 500 ml” y “Combo 200 ml” contienen cinco sabores, cada uno en el tamaño indicado (volúmenes totales de 5 L, 2,5 L y 1 L). Así se reproducen las tres tarifas de envío indicadas por la segunda página para una unidad del combo. Confirmar esta interpretación comercial si el contenido real del combo es distinto; `ml` en `catalogo.json` permite ajustarlo.

Las ciudades habilitadas son Bogotá, Chía, Cota, Cajicá y Soacha, también validadas en el servidor. Bogotá tiene entrega estimada de 1 a 2 días entre 10 a. m. y 4 p. m.; las demás, el jueves entre 11 a. m. y 5 p. m. Las tarifas no varían por ciudad.

## Cantidades y beneficios del carrito

Todos los productos tienen controles − y + de 1 a 50, junto a Agregar al carrito y Ver, sin lista desplegable. El detalle del producto usa los mismos controles. El límite acumulado de 50 unidades por presentación también se valida en el carrito y en Python. Los carritos guardados con el antiguo límite de 99 se ajustan a 50 al restaurarlos.

Los avisos suman el volumen real de caldos, entre sabores y presentaciones: con 1 L faltan 2 L para envío gratis; con 2 L falta 1 L. Al alcanzar 3 L se muestra el beneficio y domicilio $0. Si otro producto ya obtiene envío gratis según las reglas existentes, se reconoce ese beneficio. Desde 1 L elegible aparece el anticipo “Tu caldo, a tu medida”; la personalización en bolsitas de 250 ml se habilita al alcanzar 2 L elegibles. Las presentaciones de 200 ml quedan excluidas aunque varias acumulen uno o más litros. Dos presentaciones de 500 ml muestran el anticipo, mientras que cuatro presentaciones de 500 ml habilitan la personalización. La tienda confirma los detalles por WhatsApp.

En “Todos”, el catálogo prioriza Chicken Bone Broth, Beef Bone Broth, Dual Broth y Chicken Bone Broth Neutro; siguen sabores, cuadros, productos de pollo y, al final, aguacate y zucchini. Aloe vera se encuentra únicamente en el filtro Cuadros.

El carrito usa el estilo de la referencia entregada: encabezado “Mi pedido”, productos amplios con precio total y unitario, controles circulares, un panel suave con las rutas Caldos, Cubos y Pedido mixto, barras de progreso, valor de domicilio destacado y botón amarillo. Los valores y textos se actualizan inmediatamente al modificar cantidades. En móvil, todo el carrito se desplaza como una sola vista y el encabezado permanece visible.

## Google Maps

La dirección y la ciudad actualizan automáticamente un mapa de Google dentro de los datos de entrega; el barrio se incorpora cuando está disponible. Se esperan 600 ms tras la última edición para evitar recargar en cada pulsación. Si se borra la dirección o la ciudad, se retira la ubicación anterior. El formulario informa que la dirección se comparte con Google al escribir. El mapa no verifica que la dirección sea válida; el cliente debe comprobar el lugar señalado.

Sin clave, se utiliza la vista pública incrustada de Google Maps (`/maps?q=…&output=embed`), comprobada en el navegador con una dirección de prueba. Este formato depende del servicio público de Google y no es el contrato de Maps Embed API. También se conserva el enlace de apertura en Maps como alternativa.

Si se configura `GOOGLE_MAPS_EMBED_API_KEY`, la aplicación utiliza la [API oficial de Maps Embed](https://developers.google.com/maps/documentation/embed/embedding-map), que requiere una clave propia restringida a esa API y a los dominios autorizados. Reiniciar el servidor tras configurar la variable. No se ha probado con una clave real. No incluye autocompletado ni geocodificación almacenada.

## Tipo de vivienda

El formulario permite elegir Casa o Conjunto/Edificio. Casa muestra número de casa/interior y piso opcionales. Conjunto/Edificio exige su nombre y permite añadir torre, apartamento/interior y piso. Las indicaciones se pueden completar en ambos casos. Los campos que no correspondan al tipo elegido no se envían; Python también los descarta. El resumen y el borrador de WhatsApp incluyen el tipo de vivienda y sus detalles.

## Qué ocurre al confirmar

1. El navegador guarda solo identificadores, presentaciones y cantidades del carrito en `localStorage`; al restaurarlos valida tipos, existencia y límites. No guarda datos personales del formulario.
2. El usuario completa sus datos, puede consultar la dirección en Google Maps, marca la primera revisión y solicita el resumen.
3. Python valida los campos, recalcula con precios del servidor y devuelve la cotización.
4. El resumen presenta tarjetas separadas para productos, valores, entrega y pago. Todos los datos se insertan como texto seguro. El cliente debe marcar una segunda casilla para confirmar que productos, cantidades, pago y entrega son correctos. Solo entonces se habilitan Copiar y Enviar por WhatsApp. Puede volver a corregir sus datos; cualquier cambio en datos o carrito invalida la aceptación anterior. El borrador incluye el enlace de la dirección en Google Maps.
5. El usuario debe pulsar Enviar dentro de WhatsApp. La tienda confirma disponibilidad, pago y entrega.

La aplicación **no registra órdenes en una base de datos, no procesa pagos y no verifica mensajes enviados**. El mensaje de WhatsApp es editable; sus importes deben verificarse antes de cobrar. El carrito se conserva después de cotizar y al recargar la página hasta que el usuario confirma su finalización o cancelación. Al finalizar se eliminan las claves del carrito y del estado temporal; el formulario y el mapa se limpian. Solo se guardan referencia, estado y fecha/hora en sessionStorage; no se guardan datos personales del formulario.

El formulario ofrece Nequi, Daviplata, Llave, efectivo y link de pago. El número de transferencia visible es 314 2839419; los pagos se coordinan por WhatsApp.

## Pruebas

```sh
python -m unittest -v
node test_frontend.cjs
```

- 40 pruebas Python superadas: precios, presentaciones, cálculo global del domicilio, anticipo de personalización desde 1 L, habilitación desde 2 L, exclusión de formatos de 200 ml, caldos, cuadros, combinaciones, combos, cantidades inválidas, duplicados, tamaño de solicitudes, campos del cliente, datos de dirección, rutas, assets, catálogo, cabeceras, dominios de confianza, JSON ambiguo, archivos privados, módulos JavaScript, codificación de direcciones para Maps, configuración opcional del iframe y contenido del paquete de publicación.
- Pruebas JavaScript de lógica pura superadas: restauración de carritos dañados o manipulados, máximos por línea, controles − y + de 1 a 50, umbrales de envío y de personalización, y direcciones para Maps.
- Sintaxis JavaScript comprobada con Node.
- Recorrido interactivo en el navegador integrado: agregar 1 L, aumentar a dos unidades, convertir a la presentación de 2 L con ahorro de $2.000, completar datos ficticios y generar cotización de $75.000 incluyendo $3.000 de domicilio.
- Entrada `<img src=x onerror=alert(1)>` mostrada literalmente en el resumen; no se ejecutó HTML.
- Revisión visual de portada, carrito y resumen; comprobación de pantalla móvil de 390 px sin desbordamiento horizontal, buscador con y sin resultados.
- Recorrido verificado: avisos con 1, 2 y 3 L; controles − y +; resumen con WhatsApp deshabilitado hasta aceptar; deshabilitado de nuevo al desmarcar o corregir datos. Mapa incrustado visible y dirección actualizada al editar; cambio entre Casa y Apartamento y resumen de Casa sin datos residuales de apartamento. Controles revisados en escritorio y móvil.
- No se enviaron mensajes ni se realizaron pagos durante las pruebas.

## Seguridad y publicación

Se mantiene la validación del servidor, precios enteros, límite de 50 unidades por presentación y 100 líneas, máximo de cuerpo JSON de 16 KiB, cabeceras CSP y `nosniff`, bloqueo de frames y cotizaciones sin caché. El catálogo público se valida y serializa al arrancar y después de cada cambio del archivo; usa ETag para revalidarse. Las solicitudes sin cambios reutilizan la versión en memoria y pueden responder sin reenviar el contenido. La CSP no permite CSS ni JavaScript inline. También se rechazan solicitudes con origen externo y caracteres de control o de reordenación bidireccional en los datos ingresados.

La API es una operación de cálculo sin autenticación ni escritura de pedidos. El catálogo se valida al iniciar y la aplicación acepta por defecto solo `127.0.0.1` y `localhost`; `TRUSTED_HOSTS` permite configurar los dominios de producción. No tiene un limitador distribuido de tráfico. Al publicar, usar HTTPS y los límites del alojamiento. `WHATSAPP_NUMBER` configura el número comercial (por defecto 573132046536). Revisar también el texto visible del número si se cambia esta variable.

Una futura función de pedidos persistentes, administración o cobro requiere autenticación, autorización y protección adicional acorde con sus operaciones. Esta revisión no certifica ausencia de vulnerabilidades ni sustituye una auditoría del alojamiento.

## Estructura

- `app.py`: punto de entrada WSGI.
- `serve.py`: arranque local con límites de conexiones y solicitudes.
- `tienda/__init__.py`: creación de instancias y rutas HTTP.
- `tienda/security.py`: lectura estricta de JSON, cabeceras de seguridad y respuestas de error.
- `tienda/config.py`: configuración y validación de dominios, número comercial y límites.
- `tienda/catalog.py`: carga e índice del catálogo.
- `tienda/orders.py`: precios, validación del cliente, domicilio y mensajes.
- `scripts/package.py`: creación del ZIP de entrega sin archivos temporales ni copias anteriores.
- `catalogo.json`: datos y precios.
- `templates/index.html`: página.
- `static/styles.css`: estructura visual de la segunda referencia.
- `static/refinements.css`: ajustes de marca, transparencias, curvas y adaptación móvil.
- `static/app.js`: interfaz del catálogo, filtros, carrito y formulario.
- `static/cart-core.mjs`: reglas puras de cantidades, domicilios, beneficios y recomendaciones de ahorro.
- `static/api.mjs`: respuestas de red, cancelación de solicitudes y validación de enlaces de la cotización.
- `static/`: imágenes extraídas y deduplicadas del HTML original.
- `test_app.py`, `test_infrastructure.py`, `test_frontend.cjs`: pruebas reproducibles.

## Revisión del 17 de septiembre

El volumen se acumula en mililitros antes de convertirlo a litros para evitar errores de redondeo en las tarifas. Copiar exige la misma confirmación final que WhatsApp. Se retiró la opción interna de otras ciudades y código sin uso. El catálogo tiene un tiempo máximo de carga de 15 segundos; la navegación funciona independientemente de su carga. La página se revalida en cada visita y las imágenes estáticas reservan sus dimensiones para reducir desplazamientos.

## Infraestructura revisada el 18 de septiembre

`serve.py` arranca Waitress en la interfaz local, con 4 hilos, máximo de 100 conexiones, cuerpo de solicitud de 16 KiB, cabeceras de 8 KiB y cierre de conexiones inactivas después de 60 segundos. Para otro puerto: `python serve.py --port 8002`. `python app.py` usa el mismo arranque. Para alojamientos WSGI se conserva el punto de entrada `app:app`.

Comprobar el servidor: `curl http://127.0.0.1:8001/healthz`. Devuelve únicamente `{"status":"ok"}`. El arranque no instala un servicio permanente: si se cierra el proceso o se apaga el equipo, hay que ejecutarlo nuevamente.

La función `create_app()` crea una aplicación con su propio catálogo y configuración; los tests pueden probar instancias independientes. Se rechazan dominios vacíos, URLs completas, puertos y comodines en `TRUSTED_HOSTS`. Se admiten dominios, direcciones IPv4 y dominios con prefijo de punto para incluir subdominios. Las reglas no confían en cabeceras de proxy reenviadas por clientes.

Se corrigió un error 500 reproducible causado por caracteres Unicode inválidos en la dirección. Los errores de API, incluidos 404, 405 y 500, tienen respuestas JSON controladas; las respuestas no exponen detalles internos. Se conservan las cabeceras HTTP pertinentes, como `Allow`. Los emojis, las tildes y los saltos de línea permitidos en notas siguen funcionando.

El número utilizado por el botón flotante de WhatsApp llega a través de un atributo explícito de configuración. Los estilos y scripts llevan una versión calculada a partir de su contenido al arrancar el servidor. Después de editar código, plantillas o estilos, reiniciar el proceso para activar las versiones nuevas. Los cambios de catálogo se aplican al recargar la página.

Validación de esta reorganización: 37 pruebas Python, pruebas de lógica JavaScript y comparación de 315 cotizaciones completas con los resultados previos. Las versiones instaladas son compatibles según `pip check`; los avisos oficiales de [Flask](https://github.com/pallets/flask/security/advisories), [Werkzeug](https://github.com/pallets/werkzeug/security/advisories) y la [documentación de Waitress](https://docs.pylonsproject.org/projects/waitress/en/stable/) son las referencias para revisar futuras actualizaciones. Esto no equivale a un escaneo exhaustivo de dependencias.

Generar el paquete actualizado con `python scripts/package.py`. El ZIP se guarda junto a esta carpeta. Incluye código, pruebas, documentación y archivos públicos; excluye entornos virtuales, configuración privada, cachés, temporales y ZIP anteriores. `requirements.txt` remite al único archivo de versiones fijadas, `requirements-lock.txt`.

Los tres PDF de `static/docs/` se conservan en el proyecto como referencia, pero no se incluyen en el ZIP: las páginas de recetario y noticias enlazan a Google Drive y la sección de preguntas no enlaza a ese PDF. Esto evita publicar archivos sin uso y reduce el tamaño de la entrega.

## Cambios del 21 de septiembre

La portada recorre las fotografías de los 35 productos en tres columnas con movimiento descendente, sin botón de reproducción. Las fotos se cargan y decodifican antes de iniciar el movimiento. Cada tarjeta se anima por separado, sin duplicar imágenes ni mover una capa gigante que pueda perder partes de las fotos en WebKit. La animación se detiene fuera de pantalla y respeta el movimiento reducido. Se eliminó la pregunta frecuente sobre el costo del domicilio y se añadió el uso en batidos a los detalles de los cuadros de caldo; aloe vera ya incluía ese uso.

Las recomendaciones del carrito también comparan las presentaciones de 12, 24 y 48 cuadros. Conservan exactamente las unidades y el sabor, buscan la combinación de menor precio y respetan el máximo de 50 paquetes por presentación. Solo se muestran si el total con domicilio también disminuye. Se actualizan al cambiar cantidades y se vuelven a calcular al aplicar la sugerencia. Las recomendaciones de caldo y de cuadros pueden aparecer juntas.

Verificación: 37 pruebas Python y las pruebas JavaScript, incluidos búsqueda exhaustiva de combinaciones, límites, sabores separados y pérdida del beneficio de envío mixto. En el navegador se comprobó que 3 paquetes de 12 cuadros Green sugieren 12 + 24 con ahorro de $2.000, y 4 paquetes de 12 se convierten en uno de 48 con ahorro de $10.000. Los demás productos permanecieron intactos. Portada revisada en escritorio y a 390 px, sin desbordamiento horizontal.

## Revisión del 22 de septiembre

Se separaron las reglas del carrito de la interfaz en módulos ES nativos, sin añadir un compilador ni dependencias. Las pruebas importan directamente las reglas de precios, domicilios y ahorro. En Python, la protección HTTP quedó separada de las rutas y del cálculo comercial.

La revisión pendiente se cancela al cerrar el formulario o cambiar el pedido. Una respuesta antigua ya no puede reabrir el resumen. Los enlaces recibidos solo se habilitan si corresponden al número comercial de WhatsApp configurado y a la búsqueda de Google Maps. El servidor rechaza claves JSON duplicadas y números no finitos; los errores no se guardan en caché.

Se retiraron 55 reglas o grupos de selectores obsoletos de portadas anteriores y clases sin efecto, reduciendo aproximadamente 4 KB de CSS. Catálogo, cantidades del carrito y recomendaciones usan eventos delegados: los controles no vuelven a registrar manejadores cada vez que se redibujan. Al aumentar o disminuir una cantidad se conserva el foco del teclado. Ampliar el catálogo mantiene la presentación y cantidad seleccionadas con una búsqueda directa de las tarjetas.

Validación: 39 pruebas Python, 9 grupos de pruebas JavaScript y 315 cotizaciones completas idénticas antes y después. El recorrido en navegador verificó los dos clics de «Ver más», la selección de presentaciones, cantidades, ahorro de cuadros, cotización, aceptación final e invalidación al editar. Una etiqueta HTML ingresada en el nombre se mostró como texto. El pedido ficticio se limpió al terminar; no se enviaron mensajes ni se hicieron pagos.

Las dependencias instaladas superaron `pip check`. Se consultaron los avisos oficiales de [Flask](https://github.com/pallets/flask/security/advisories), [Werkzeug](https://github.com/pallets/werkzeug/security/advisories), [Jinja](https://github.com/pallets/jinja/security/advisories) y [Waitress](https://github.com/Pylons/waitress/security/advisories). Esta comprobación y las pruebas locales no constituyen una certificación de seguridad del futuro alojamiento.

## Revisión del 23 de septiembre

Se reunieron los nombres de las ciudades y los textos de entrega repetidos en el JavaScript para que el mapa, el aviso y la revisión del pedido usen una sola lista. El paquete de publicación excluye los tres PDF de referencia de `static/docs/`, que no se enlazan desde la tienda; los archivos originales permanecen en el proyecto. El ZIP íntegro pasó de unos 44 MB a 3,6 MB y conserva el catálogo, los estilos, las imágenes y los módulos necesarios.

Se comprobaron 40 pruebas Python, los 9 grupos de pruebas JavaScript, la sintaxis del módulo principal y el estado de salud del servidor. El recorrido en navegador incluyó filtros, búsqueda, orden, los dos clics de «Ver más», cantidades, ahorro por presentación, carrito, mapa, tipos de vivienda, cotización, revisión doble, edición, temas día/noche, ficha de producto y preguntas frecuentes. No se envió ningún pedido real.

## Revisión del 1 de octubre

El servidor detecta los cambios de `catalogo.json` en las solicitudes de página, catálogo, cotización y salud. Una sola versión validada alimenta cada solicitud; la lectura está protegida entre hilos. Si el archivo está incompleto o es inválido, la tienda devuelve un error 503 controlado y no cotiza con precios anteriores. Al corregirlo vuelve a funcionar sin reiniciar. La portada, los destacados y las fichas consultan las imágenes del catálogo.

Para iniciar con el entorno correcto desde esta carpeta:

```sh
python3 scripts/start.py
```

El lanzador busca `.venv`, `venv` y el entorno existente de esta entrega, y comprueba Flask y Waitress antes de iniciar. Acepta el mismo argumento `--port` que `serve.py`. No instala dependencias automáticamente.

Para comprobar dependencias, las pruebas Python, las reglas JavaScript y la sintaxis de los módulos:

```sh
python scripts/check.py
# Si Node no está en PATH:
python scripts/check.py --node /ruta/al/ejecutable/node
```

Para reemplazar una foto sin cambiar su calidad ni su contenido:

```sh
python scripts/replace_image.py cp-entero "/ruta/a/la/foto.png"
python scripts/replace_image.py cp-alaentera "/ruta/a/la/foto.png"
```

La herramienta copia la imagen con un nombre calculado a partir de su contenido, valida el catálogo y lo guarda mediante reemplazo atómico. Conserva las fotos anteriores. La página debe recargarse para mostrar el cambio.

Al abrir o recargar, la página vuelve a Inicio sin restaurar el desplazamiento anterior. Los enlaces de sección siguen funcionando dentro de la página.

Validación: 45 pruebas Python, 9 grupos JavaScript, sintaxis de JavaScript y dependencias compatibles. Las regresiones cubren actualización de fotos y precios sin reiniciar, ETag nuevo, recuperación de catálogo inválido, reutilización sin cambios y archivos que cambian durante su lectura.

## Fotos de cuadros

Las siete fichas de Cuadros muestran solo la foto principal. La vista de detalle no presenta controles de galería cuando hay una sola foto.
