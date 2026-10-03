// Pure logic tests, without browser or third-party dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
(async()=>{
const {createCartRules,stepQuantity}=await import('./static/cart-core.mjs');
const {readApiResponse,createRequestGate,validateQuoteLinks}=await import('./static/api.mjs');
const root=__dirname;
const source=fs.readFileSync(path.join(root,'static/app.js'),'utf8');
const categories=JSON.parse(fs.readFileSync(path.join(root,'catalogo.json'),'utf8'));
const products=Object.values(categories).flatMap(c=>c.productos).map(p=>({id:p.id,category:p.categoriaVisual,options:p.opciones,variants:p.opciones.map(o=>[o.etiqueta,o.precio])}));
const enabledProduct={id:'enabled-test',category:'pollo',options:[{ml:0,unidades:0,precio:162999}],variants:[['Prueba',162999]]};
const shippingProduct={id:'shipping-test',category:'pollo',options:[{ml:0,unidades:0,precio:113000,etiqueta:'Prueba'}],variants:[['Prueba',113000]]};
products.push(enabledProduct,shippingProduct);
const rules=createCartRules(products);
const context={...rules,index:new Map(products.map(p=>[p.id,p])),productById:id=>products.find(p=>p.id===id),Map,Number,Array,Math,
 restore:rules.restoreCart,shipping:rules.shippingFor,benefits:rules.cartBenefits,recommend:rules.quantityRecommendations,step:stepQuantity};
for(const malformed of [null,{},'bad',new Array(101).fill({})]) assert.equal(context.restore(malformed).length,0);
assert.equal(context.restore([{productId:'missing',variantIndex:0,qty:1},{productId:'broth-pollo',variantIndex:-1,qty:1},{productId:'broth-pollo',variantIndex:0,qty:'1'}]).length,0);
assert.equal(context.restore([{productId:'broth-pollo',variantIndex:0,qty:60},{productId:'broth-pollo',variantIndex:0,qty:60}])[0].qty,50);
const line=(productId='broth-pollo',variantIndex=0,qty=1)=>({productId,variantIndex,qty});
for(const [lines,expected] of [[[],0],[[line()],7000],[[line('broth-pollo',0,2)],3000],[[line('broth-pollo',0,3)],0],[[line('broth-pollo',5,10)],3000],[[line('broth-pollo',5,15)],0],[[line('cuadro-chicken',1)],3000],[[line('cuadro-chicken',2)],0],[[line(),line('cuadro-chicken',2)],0],[[line('aguacate',0,24)],7000],[[line('aguacate',0,25)],7000]]) assert.equal(context.shipping(lines),expected);
for(const [variantIndex,price,shipping] of [[0,27000,7000],[1,53000,7000],[2,100000,0]]){
 const dual=products.find(p=>p.id==='cuadro-dual');
 assert.equal(dual.options[variantIndex].precio,price);
 assert.equal(context.shipping([line('cuadro-dual',variantIndex)]),shipping);
}
assert.equal(context.shipping([line('cuadro-dual',0,2)]),7000);
assert.equal(context.shipping([line('cuadro-dual',0,4)]),0);
assert.equal(context.shipping([line('cuadro-dual',0),line('cuadro-chicken',0)]),7000);
assert.equal(context.shipping([line('cuadro-dual',0),line('cuadro-chicken',1)]),3000);
assert.equal(context.shipping([line('cuadro-dual',1),line('cuadro-chicken',1)]),0);
assert.equal(context.shipping([line(),line('enabled-test')]),7000);
enabledProduct.options[0].precio=163000;
assert.equal(context.shipping([line(),line('enabled-test')]),0);
enabledProduct.category='marinados';
assert.equal(context.shipping([line(),line('enabled-test')]),7000);
console.log('PASS: restored cart validation, duplicate caps, shipping boundaries and mixed cart.');

const add=source.slice(source.indexOf('function addToCart('),source.indexOf('function cartSubtotal('));
const address=source.slice(source.indexOf('function addressQuery('),source.indexOf('let mapTimer'));
const cityConfig=source.slice(source.indexOf('const CITY_NAMES='),source.indexOf('function formatMoney('));
Object.assign(context,{cart:[],saveCart:()=>{},showToast:()=>{},URLSearchParams,Intl});
vm.runInNewContext(cityConfig+'\n'+add+'\n'+address+'\nthis.add=addToCart;this.address=addressQuery;this.maps=mapsSearchUrl;this.embed=mapsEmbedUrl;',context);
for(const [lines,ml,remaining,free,notice,personalize] of [
 [[],0,3000,false,false,false],[[line()],1000,2000,false,true,false],
 [[line('broth-pollo',0,2)],2000,1000,false,true,true],[[line('broth-pollo',0,3)],3000,0,true,true,true],
 [[line('broth-pollo',4)],500,2500,false,false,false],[[line('broth-pollo',4,2)],1000,2000,false,true,false],
 [[line('broth-pollo',4,4)],2000,1000,false,true,true],[[line('broth-pollo',5,10)],2000,1000,false,false,false],
 [[line(),line('cuadro-chicken',2)],1000,2000,true,true,false]
]){
 const b=context.benefits(lines);
 assert.deepEqual([b.ml,b.remaining,b.free,b.personalizationNotice,b.personalize],[ml,remaining,free,notice,personalize]);
}
for(const qty of [0,51,-1,1.5,'2',true]) assert.equal(context.add('broth-pollo',0,qty),false);
assert.equal(context.cart.length,0);
assert.equal(context.add('broth-pollo',0,49),true);
assert.equal(context.cart[0].qty,49);
assert.equal(context.add('broth-pollo',0,1),true);
assert.equal(context.cart[0].qty,50);
context.cart[0].qty=49;
assert.equal(context.add('broth-pollo',0,2),false);
assert.equal(context.cart[0].qty,49);
assert.equal(context.address('','','bogota',''),'Bogotá, Colombia');
assert.equal(context.address('Calle 1','Centro','otra',''),'');
const q=context.address('Carrera 7 # 11-10 & esquina','Centro','soacha');
const map=new URL(context.maps(q));
assert.equal(map.origin,'https://www.google.com');
assert.equal(map.searchParams.get('query'),q);
assert.equal(map.hash,'');
console.log('PASS: quantity selector limits, cart benefits, personalization threshold and encoded Maps URLs.');

assert.equal(context.step(1,-1),1);
assert.equal(context.step(1,1),2);
assert.equal(context.step(49,1),50);
assert.equal(context.step(50,1),50);
assert.equal(context.step(50,-1),49);
assert.equal(context.address('Calle 1','','bogota',''),'Calle 1, Bogotá, Colombia');
assert.equal(context.address('','Centro','chia',''),'Centro, Chía, Colombia');
assert.equal(new URL(context.embed(q)).searchParams.get('q'),q);
assert.equal(new URL(context.embed(q)).searchParams.get('output'),'embed');
assert.equal(new URL(context.embed(q,'test')).searchParams.get('key'),'test');
console.log('PASS: plus/minus boundaries 1–50 and automatic map URLs.');

// Regression: invalidating a quote must also discard the copyable message.
const invalidation=source.slice(source.indexOf('function invalidateQuote('),source.indexOf('function updateFinalConsent('));
const followup={hidden:false};
Object.assign(context,{quoteRequests:{cancel(){}},quoteRevision:1,pendingQuoteUrl:'old',pendingOrderText:'old message',orderState:null,document:{getElementById:()=>followup},updateFinalConsent:()=>{}});
vm.runInNewContext(invalidation+'\ninvalidateQuote();',context);
assert.equal(context.pendingOrderText,'');
assert.equal(context.pendingQuoteUrl,'');
assert.equal(followup.hidden,true);

// Regression: clearing an address must remove the iframe URL, even with an empty cached query.
const updateMap=source.slice(source.indexOf('function updateAddressMap('),source.indexOf('function updatePropertyType('));
const frame={hidden:false,src:'old private address',removeAttribute(name){delete this[name];}};
const nodes={addressMapFrame:frame,addressMaps:{setAttribute(){},removeAttribute(){}},mapAddress:{},mapPlaceholder:{}};
Object.assign(context,{mappedQuery:'',mapTimer:null,clearTimeout(){},value:()=>'',document:{getElementById:id=>nodes[id]}});
vm.runInNewContext(updateMap+'\nupdateAddressMap();',context);
assert.equal(frame.hidden,true);
assert.equal(frame.src,undefined);

const stateReader=source.slice(source.indexOf('function readOrderState('),source.indexOf('function writeOrderState('));
Object.assign(context,{ORDER_STATE_KEY:'test',Date,sessionStorage:{getItem:()=>JSON.stringify({reference:'<unsafe>',orderStatus:'awaiting_confirmation',createdAt:'bad'})}});
vm.runInNewContext(stateReader+'\nthis.readState=readOrderState;',context);
assert.equal(context.readState(),null);
context.sessionStorage.getItem=()=>JSON.stringify({reference:'CC-20260914-ABCDEF01',orderStatus:'awaiting_confirmation',createdAt:'2026-09-14T12:00:00Z'});
assert.equal(context.readState().reference,'CC-20260914-ABCDEF01');
console.log('PASS: stale copied quotes, private Maps cleanup and saved order validation.');

const reveal=source.slice(source.indexOf('function visibleProductCount('),source.indexOf('function renderProducts('));
vm.runInNewContext(reveal+'\nthis.visible=visibleProductCount;',context);
assert.deepEqual([0,1,2].map(n=>context.visible(39,n)),[20,30,39]);
console.log('PASS: all products revealed in two clicks.');

// Summing separate 200 ml lines must match the integer server thresholds.
for(const count of [10,15]) {
 const lines=Array.from({length:count},()=>line('broth-pollo',5));
 assert.equal(context.calculateBrothLiters(lines),count*200/1000);
 assert.equal(context.shipping(lines),count===10?3000:0);
}
assert.equal(context.benefits([line(),line('broth-pollo',4)]).personalizationRemaining,500);
// Copy and send share the final-review gate, including after invalidation.
const consentNodes={confirmFinal:{checked:false},copyOrder:{},quoteWhatsApp:{setAttribute(){},removeAttribute(name){delete this[name];}},finalReviewStatus:{}};
Object.assign(context,{pendingQuoteUrl:'https://wa.me/573132046536',document:{getElementById:id=>consentNodes[id]}});
const consent=source.slice(source.indexOf('function updateFinalConsent('),source.indexOf('function addressQuery('));
vm.runInNewContext(consent+'\nupdateFinalConsent();',context);
assert.equal(consentNodes.copyOrder.disabled,true);
assert.equal(consentNodes.quoteWhatsApp.href,undefined);
consentNodes.confirmFinal.checked=true;
context.updateFinalConsent();
assert.equal(consentNodes.copyOrder.disabled,false);
assert.equal(consentNodes.quoteWhatsApp.href,context.pendingQuoteUrl);
context.pendingQuoteUrl='';context.updateFinalConsent();
assert.equal(consentNodes.copyOrder.disabled,true);
console.log('PASS: integer volume thresholds, exact personalization remainder and copy/send consent.');

// Recommendations keep product, exact volume/units, quantity caps and the cheapest final order.
const recommendationSource=source.slice(source.indexOf('function applyQuantityRecommendation('),source.indexOf('function updateRecommendation('));
vm.runInNewContext(recommendationSource+'\nthis.applyRecommendation=applyQuantityRecommendation;',context);
const recFor=(lines,id)=>context.recommend(lines).find(rec=>rec.p.id===id);
for(const [lines,id,price,saving] of [
 [[line('cuadro-chicken',0,2)],'cuadro-chicken',48000,2000],
 [[line('cuadro-chicken',0,3)],'cuadro-chicken',73000,2000],
 [[line('cuadro-chicken',0,4)],'cuadro-chicken',90000,10000],
 [[line('cuadro-chicken',1,2)],'cuadro-chicken',90000,6000],
 [[line('cuadro-chicken',0,2),line('cuadro-chicken',1)],'cuadro-chicken',90000,8000],
 [[line('cuadro-beef',0,2)],'cuadro-beef',58000,2000],
 [[line('cuadro-aloe',0,2)],'cuadro-aloe',50000,6000],
 [[line('broth-pollo',0,2)],'broth-pollo',72000,2000],
 [[line('broth-pollo',0,3)],'broth-pollo',110000,1000],
 [[line('broth-pollo',0,4)],'broth-pollo',140000,8000]
]){
 const before=JSON.stringify(lines),rec=recFor(lines,id);
 assert.ok(rec);
 assert.equal(rec.targetTotal,price);assert.equal(rec.saving,saving);
 assert.equal(context.calculateCubeUnits(lines),context.calculateCubeUnits(rec.converted));
 assert.equal(context.calculateBrothLiters(lines),context.calculateBrothLiters(rec.converted));
 assert.equal(JSON.stringify(lines),before);
 assert.ok(rec.replacements.every(item=>item.productId===id && item.qty<=50));
}
assert.equal(context.recommend([line('cuadro-chicken',0),line('cuadro-beef',0)]).length,0);
assert.equal(context.recommend([line('cuadro-chicken',2)]).length,0);
assert.equal(context.recommend([line('broth-pollo',0,2),line('cuadro-chicken',0,2)]).length,2);
assert.equal(context.recommend([line('broth-pollo',0,2),line('broth-pollo',1,50)]).length,0);
// Compare optimized cube packs with an exhaustive search, including the 50-pack cap.
for(const product of products.filter(p=>p.category==='cubos')){
 for(const qty of [2,3,4,5,11,49,50]){
  const lines=[line(product.id,0,qty),line(product.id,1,qty),line(product.id,2,qty)];
  const units=context.calculateCubeUnits(lines);
  let expected=Infinity;
  for(let small=0;small<=50;small++)for(let medium=0;medium<=50;medium++){
   const large=(units-small*12-medium*24)/48;
   if(large<0 || large>50 || !Number.isInteger(large)) continue;
   expected=Math.min(expected,small*product.options[0].precio+medium*product.options[1].precio+large*product.options[2].precio);
  }
  const rec=recFor(lines,product.id);
  assert.equal(rec?.targetTotal??context.calculateSubtotal(lines),expected);
  if(rec)assert.equal(context.calculateCubeUnits(rec.converted),units);
 }
}
// Saving $2,000 in products cannot be recommended if it adds $3,000 in shipping.
assert.equal(context.recommend([line(),line('cuadro-chicken',0,2),line('shipping-test')]).length,0);
context.cart=[line('cuadro-chicken',0,3),line('cuadro-beef',0)];
let recommendationSaves=0;
context.saveCart=()=>recommendationSaves++;
assert.equal(context.applyRecommendation('cuadro-chicken'),true);
assert.equal(recommendationSaves,1);
assert.equal(context.calculateCubeUnits(context.cart),48);
assert.equal(context.cart.filter(item=>item.productId==='cuadro-beef').length,1);
assert.equal(context.applyRecommendation('cuadro-chicken'),false);
console.log('PASS: cube/broth pack savings, exact quantities, separate flavors, shipping and safe conversion.');

// An unavailable server or proxy must produce a readable error, not raw HTML/JSON parser errors.
const apiContext={read:readApiResponse};
 const response=(type,ok,data)=>({headers:{get:()=>type},ok,json:async()=>data});
 await assert.rejects(apiContext.read(response('text/html',false,'')),/servidor no está disponible/);
 await assert.rejects(apiContext.read(response('application/json',false,{error:'Revisa el teléfono'})),/Revisa el teléfono/);
 await assert.rejects(apiContext.read(response('application/json',false,null)),/No pudimos procesar/);
 await assert.rejects(apiContext.read({headers:{get:()=> 'application/json'},ok:true,json:async()=>{throw new SyntaxError('broken')}}),/respuesta del servidor no es válida/);
 const result={total:44000};
 assert.equal(await apiContext.read(response('application/json',true,result)),result);
 console.log('PASS: readable API errors and successful JSON responses.');
const gate=createRequestGate();
const first=gate.begin();
const lateResponse=Promise.resolve({total:1000});
gate.cancel();
await lateResponse;
assert.equal(first.signal.aborted,true);
assert.equal(first.isCurrent(),false,'a closed/changed checkout must ignore a late response');
const second=gate.begin(), third=gate.begin();
assert.equal(second.signal.aborted,true);
second.finish();
assert.equal(third.isCurrent(),true,'finishing an old request must not invalidate the next one');
third.finish();
assert.equal(third.isCurrent(),false);
const timed=gate.begin(1);
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(timed.signal.aborted,true);
assert.equal(timed.isCurrent(),true,'timeout stays current so the UI can show the timeout message');
timed.finish();
const validLinks={whatsapp:'https://wa.me/573132046536?text=pedido',maps:'https://www.google.com/maps/search/?api=1&query=Bogota'};
assert.equal(validateQuoteLinks(validLinks,'https://wa.me/573132046536').whatsappUrl.hostname,'wa.me');
for(const url of ['javascript:alert(1)','https://wa.me.evil.example/573132046536','https://wa.me/570000000000','https://user@wa.me/573132046536','https://wa.me:444/573132046536']){
 assert.throws(()=>validateQuoteLinks({...validLinks,whatsapp:url},'https://wa.me/573132046536'));
}
assert.throws(()=>validateQuoteLinks({...validLinks,maps:'https://evil.example/'},'https://wa.me/573132046536'));
console.log('PASS: canceled and superseded quotes, timeout cleanup and trusted outbound links.');
})().catch(error=>{console.error(error);process.exitCode=1;});
