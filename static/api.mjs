// Network boundaries and cancellation, independent of the checkout DOM.
export async function readApiResponse(response) {
 if (!response.headers.get('content-type')?.includes('application/json')) {
  throw new Error('El servidor no está disponible. Inténtalo de nuevo.');
 }
 let result;
 try { result = await response.json(); }
 catch { throw new Error('La respuesta del servidor no es válida. Inténtalo de nuevo.'); }
 if (!response.ok) {
  throw new Error(typeof result?.error === 'string' ? result.error.slice(0, 300) : 'No pudimos procesar la solicitud');
 }
 return result;
}

export function createRequestGate() {
 let active = null;
 function cancel() {
  if (!active) return;
  const request = active;
  active = null;
  request.controller.abort();
  clearTimeout(request.timer);
 }
 function begin(timeout = 15000) {
  cancel();
  const controller = new AbortController();
  const request = {controller, timer:setTimeout(() => controller.abort(), timeout)};
  active = request;
  return {
   signal:controller.signal,
   isCurrent:() => active === request,
   finish() {
    clearTimeout(request.timer);
    if (active === request) active = null;
   }
  };
 }
 return {begin, cancel};
}

export function validateQuoteLinks(result, whatsappBase) {
 const whatsappUrl = new URL(result.whatsapp);
 const allowed = new URL(whatsappBase);
 const mapsUrl = new URL(result.maps);
 if (whatsappUrl.origin !== 'https://wa.me' || whatsappUrl.pathname !== allowed.pathname ||
     whatsappUrl.username || whatsappUrl.password || whatsappUrl.hash ||
     mapsUrl.origin !== 'https://www.google.com' || mapsUrl.pathname !== '/maps/search/' ||
     mapsUrl.username || mapsUrl.password || mapsUrl.hash) {
  throw new Error('No pudimos verificar los enlaces del pedido. Inténtalo de nuevo.');
 }
 return {whatsappUrl, mapsUrl};
}

