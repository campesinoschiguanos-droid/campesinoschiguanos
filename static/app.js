import {createCartRules, stepQuantity} from './cart-core.mjs';
import {readApiResponse, createRequestGate, validateQuoteLinks} from './api.mjs';
(async()=>{

// Navigation
const menuToggle=document.getElementById('menuToggle'); const mainNav=document.getElementById('mainNav');
function moveLiquidIndicator(container,target,animate=true){
 if(!container||!target||!target.offsetWidth||!target.offsetHeight)return;
 let marker=container.querySelector(':scope > .liquid-indicator');
 if(!marker){marker=document.createElement('span');marker.className='liquid-indicator';marker.setAttribute('aria-hidden','true');container.prepend(marker);}
 const targetKey=target.id||target.dataset.filter||target.getAttribute('href')||'';
 if(animate&&marker.dataset.target===targetKey&&marker.getAnimations().length)return;
 const end={left:target.offsetLeft,top:target.offsetTop,width:target.offsetWidth,height:target.offsetHeight};
 const positioned=marker.dataset.positioned==='true',markerRect=positioned?marker.getBoundingClientRect():null,containerRect=positioned?container.getBoundingClientRect():null;
 const start=markerRect?{left:markerRect.left-containerRect.left+container.scrollLeft-container.clientLeft,top:markerRect.top-containerRect.top+container.scrollTop-container.clientTop,width:markerRect.width,height:markerRect.height}:end;
 marker.style.opacity='1';
 marker.getAnimations().forEach(animation=>animation.cancel());
 if(!animate||!marker.dataset.positioned||matchMedia('(prefers-reduced-motion: reduce)').matches){
  Object.assign(marker.style,{left:`${end.left}px`,top:`${end.top}px`,width:`${end.width}px`,height:`${end.height}px`,transform:'none',borderRadius:'999px'});
  marker.dataset.positioned='true';marker.dataset.target=targetKey;return;
 }
 const dx=end.left-start.left,dy=end.top-start.top,distance=Math.hypot(dx,dy);
 if(distance<2&&Math.abs(end.width-start.width)<2&&Math.abs(end.height-start.height)<2)return;
 const mobileFilter=container.classList.contains('filter-row')&&container.scrollWidth>container.clientWidth;
 const horizontal=Math.abs(dx)>=Math.abs(dy),stretch=mobileFilter?Math.min(1.15,1.02+distance/1200):Math.min(1.72,1.06+distance/360);
 const mid={left:start.left+dx*.45,top:start.top+dy*.45,width:start.width+(end.width-start.width)*.45,height:start.height+(end.height-start.height)*.45};
 const finish={left:end.left,top:end.top,width:end.width,height:end.height};
 Object.assign(marker.style,{left:`${end.left}px`,top:`${end.top}px`,width:`${end.width}px`,height:`${end.height}px`});
 const animation=marker.animate([
  {left:`${start.left}px`,top:`${start.top}px`,width:`${start.width}px`,height:`${start.height}px`,transform:'scale(1,1)',borderRadius:'999px'},
  {offset:.46,left:`${mid.left}px`,top:`${mid.top}px`,width:`${mid.width}px`,height:`${mid.height}px`,transform:horizontal?`scale(${stretch},.92)`:`scale(.92,${stretch})`,borderRadius:'46% 54% 48% 52%'},
  {offset:.78,left:`${finish.left}px`,top:`${finish.top}px`,width:`${finish.width}px`,height:`${finish.height}px`,transform:horizontal?'scale(.97,1.04)':'scale(1.04,.97)',borderRadius:'52% 48% 51% 49%'},
  {left:`${finish.left}px`,top:`${finish.top}px`,width:`${finish.width}px`,height:`${finish.height}px`,transform:'scale(1,1)',borderRadius:'999px'}
 ],{duration:mobileFilter?320:Math.min(1450,820+distance*.55),easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
 animation.onfinish=()=>animation.cancel();marker.dataset.positioned='true';marker.dataset.target=targetKey;
}
function revealFilterChip(target){
 const row=target?.closest('.filter-row');if(!row||row.scrollWidth<=row.clientWidth)return;
 const left=target.offsetLeft,right=left+target.offsetWidth;
 if(left>=row.scrollLeft&&right<=row.scrollLeft+row.clientWidth)return;
 row.scrollTo({left:left-(row.clientWidth-target.offsetWidth)/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function activateNavLink(link,animate=true){
 mainNav.querySelectorAll('a').forEach(item=>{const active=item===link;item.classList.toggle('is-nav-active',active);if(active)item.setAttribute('aria-current','location');else item.removeAttribute('aria-current');});
 moveLiquidIndicator(mainNav,link,animate);
}
menuToggle.addEventListener('click',()=>{const open=mainNav.classList.toggle('is-open');menuToggle.setAttribute('aria-expanded',String(open));if(open)requestAnimationFrame(()=>moveLiquidIndicator(mainNav,mainNav.querySelector('.is-nav-active')||mainNav.querySelector('a'),false));});
let navScrollLockUntil=0;
mainNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{navScrollLockUntil=performance.now()+1800;activateNavLink(a,true);mainNav.classList.remove('is-open');menuToggle.setAttribute('aria-expanded','false');}));
const navSections=[...mainNav.querySelectorAll('a')].map(link=>({link,section:document.querySelector(link.getAttribute('href'))})).filter(item=>item.section);
if('IntersectionObserver' in window){
 const navObserver=new IntersectionObserver(entries=>{
  if(performance.now()<navScrollLockUntil)return;
  const current=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
  if(current){const item=navSections.find(candidate=>candidate.section===current.target);if(item&& !item.link.classList.contains('is-nav-active'))activateNavLink(item.link,true);}
 },{rootMargin:'-18% 0px -62% 0px',threshold:[0,.2,.45]});
 navSections.forEach(item=>navObserver.observe(item.section));
}
const tapTimers=new WeakMap();
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 clearTimeout(tapTimers.get(button));button.classList.remove('tap-bounce');void button.offsetWidth;button.classList.add('tap-bounce');
 tapTimers.set(button,setTimeout(()=>{button.classList.remove('tap-bounce');tapTimers.delete(button);},520));
},true);
window.addEventListener('resize',()=>requestAnimationFrame(()=>{
 moveLiquidIndicator(mainNav,mainNav.querySelector('.is-nav-active')||mainNav.querySelector('a'),false);
 moveLiquidIndicator(document.querySelector('.filter-row'),document.querySelector('.filter-chip.is-active'),false);
}));
if('ResizeObserver' in window){
 let frame=0;
 const layoutObserver=new ResizeObserver(()=>{
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   moveLiquidIndicator(mainNav,mainNav.querySelector('.is-nav-active')||mainNav.querySelector('a'),false);
   moveLiquidIndicator(document.querySelector('.filter-row'),document.querySelector('.filter-chip.is-active'),false);
  });
 });
 document.querySelectorAll('.nav a,.filter-chip').forEach(item=>layoutObserver.observe(item));
}

document.getElementById('year').textContent=new Date().getFullYear();

const heroCascade=document.getElementById('heroCascade');
// Decode before moving: offscreen lazy images can remain blank in a CSS loop.
Promise.allSettled([...heroCascade.querySelectorAll('img')].map(image=>image.decode()))
 .then(()=>heroCascade.classList.add('is-ready'));
if('IntersectionObserver' in window){
 const heroObserver=new IntersectionObserver(([entry])=>heroCascade.classList.toggle('is-offscreen',!entry.isIntersecting));
 heroObserver.observe(heroCascade);
}

const WHATSAPP_URL = document.body.dataset.whatsappUrl;
const MONEY = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const catalogController = new AbortController();
const catalogTimeout = setTimeout(()=>catalogController.abort(),15000);
let catalog;
try {
 const response = await fetch('/api/catalogo',{signal:catalogController.signal});
 catalog = await readApiResponse(response);
} finally { clearTimeout(catalogTimeout); }
const products = Object.values(catalog).flatMap(c => c.productos).map(p => ({
  id:p.id, name:p.nombre, category:p.categoriaVisual, badge:p.etiqueta,
  image:p.imagen, short:p.desc, detail:p.detalle, facts:p.hechos,
  gallery:p.galeria||[],
  variable:p.pesoVariable, options:p.opciones,
  variants:p.opciones.map(o=>[o.etiqueta,o.precio])
}));
products.forEach(p=>{
 p.searchText=[p.name,p.badge,p.short,p.detail,p.category].join(' ').toLocaleLowerCase('es');
 p.minPrice=Math.min(...p.variants.map(v=>v[1]));
 p.maxPrice=Math.max(...p.variants.map(v=>v[1]));
});
const index = new Map(products.map(p=>[p.id,p]));
const esc = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage = {
 get(){try{return JSON.parse(localStorage.getItem('cc_cart_integrado_v1') || '[]');}catch{return [];}},
 set(value){try{localStorage.setItem('cc_cart_integrado_v1',JSON.stringify(value));}catch{}},
 remove(){try{localStorage.removeItem('cc_cart_integrado_v1');sessionStorage.removeItem('cc_cart_integrado_v1');}catch{}}
};
const ORDER_STATE_KEY='cc_order_state_v1';
function readOrderState(){
 try{
  const state=JSON.parse(sessionStorage.getItem(ORDER_STATE_KEY)||'null');
  return state && !Array.isArray(state) && /^CC-\d{8}-(?:\d{4}|[A-F0-9]{8})$/.test(state.reference)
   && ['checkout_started','quote_ready','awaiting_confirmation'].includes(state.orderStatus)
   && typeof state.createdAt==='string' && Number.isFinite(Date.parse(state.createdAt)) ? state : null;
 }catch{return null;}
}
function writeOrderState(state){try{sessionStorage.setItem(ORDER_STATE_KEY,JSON.stringify(state));}catch{}}
function removeOrderState(){try{sessionStorage.removeItem(ORDER_STATE_KEY);localStorage.removeItem(ORDER_STATE_KEY);}catch{}}
function newOrderReference(now=new Date()){
 const stamp=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('');
 const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
 return `CC-${stamp}-${bytes[0].toString(16).toUpperCase().padStart(8,'0')}`;
}
let orderState=readOrderState();
let currentReference=orderState?.reference||'';
let pendingOrderText='';
const {restoreCart, calculateSubtotal,
 qualifiesForMixedFreeShipping, shippingFor, cartBenefits, quantityRecommendations} = createCartRules(products);
let cart = restoreCart(storage.get());
let activeFilter = 'caldos';
let activeSearch = '';
let activeSort = 'featured';
let revealClicks=0;
const FEATURED_ORDER=['broth-pollo','broth-beef','broth-dual','broth-pollo-neutro','combo-sabores','sabor-green','sabor-turmeric','sabor-mexican','cuadro-chicken','cuadro-beef','cuadro-dual','cuadro-green','cuadro-turmeric','cuadro-mexican','cuadro-aloe','cp-pechuga','cp-pechugasp','cp-filete','cp-alaentera','cp-alasinpunta','cp-pierna','cp-pierna-sin-piel','cp-muslo','cp-muslo-sin-piel','cp-contramuslo','cp-contramuslo-sin-piel','cp-churrasco','cp-entero','corte-anillos','corte-cubos','corte-julianas','corte-molida','mar-alas','mar-filete','mar-churrasco','mar-muslo','hamburguesa','aguacate','zucchini'];
const featuredRank=new Map(FEATURED_ORDER.map((id,position)=>[id,position]));

const grid = document.getElementById('productGrid');
const resultCount = document.getElementById('resultCount');
const cartDrawer = document.getElementById('cartDrawer');
const cartBackdrop = document.getElementById('drawerBackdrop');
const cartItems = document.getElementById('cartItems');
const toast = document.getElementById('toast');
const recommendationNode = document.getElementById('cartRecommendation');

const CITY_NAMES={bogota:'Bogotá',chia:'Chía',cajica:'Cajicá',cota:'Cota',soacha:'Soacha'};
const BOGOTA_DELIVERY='1 a 2 días, en la franja horaria de 10 a. m. a 4 p. m.';
const THURSDAY_DELIVERY='el jueves, en la franja horaria de 11 a. m. a 5 p. m.';
function formatMoney(value) {
  return MONEY.format(value).replace(',00','');
}
function productById(id) { return index.get(id); }
function selectedVariant(product,index) {
  const v = product.variants[index];
  return { label:v[0], price:v[1] };
}
function filteredProducts() {
  let list = products.filter(p => activeFilter === 'todos' ? true : p.category === activeFilter);
  if(activeSearch) {
    const q = activeSearch.toLocaleLowerCase('es');
    list = list.filter(p => p.searchText.includes(q));
  }
  if(activeSort === 'price-asc') list = [...list].sort((a,b)=>a.minPrice-b.minPrice);
  else if(activeSort === 'price-desc') list = [...list].sort((a,b)=>b.maxPrice-a.maxPrice);
  else if(activeSort === 'name-asc') list = [...list].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  else list = [...list].sort((a,b)=>(featuredRank.get(a.id)??999)-(featuredRank.get(b.id)??999));
  return list;
}

function variantOptions(p){
 const indices=p.variants.map((_,i)=>i);
 if(p.id==='broth-pollo-neutro'){
  const volumes=[1000,2000,3000,4000,500,200];
  // Keep option values stable for saved carts and server quotes.
  indices.sort((a,b)=>volumes.indexOf(p.options[a].ml)-volumes.indexOf(p.options[b].ml));
 }
 return indices.map(i=>`<option value="${i}">${esc(p.variants[i][0])} · ${formatMoney(p.variants[i][1])}</option>`).join('');
}

function quantityControl(id,label){
 return `<div class="quantity-picker" role="group" aria-label="Cantidad de ${esc(label)}"><button type="button" data-quantity-step="-1" aria-label="Disminuir cantidad de ${esc(label)}" disabled>−</button><output id="${id}" class="quantity-value" aria-live="polite" aria-label="Cantidad seleccionada">1</output><button type="button" data-quantity-step="1" aria-label="Aumentar cantidad de ${esc(label)}">+</button></div>`;
}

function visibleProductCount(total,clicks){
 const initial=Math.ceil(total/2);
 return Math.min(total,initial+Math.ceil((total-initial)/2)*clicks);
}
function renderProducts(preserve=false) {
  const selections=preserve?[...grid.querySelectorAll('.product-card')].map(card=>({id:card.dataset.productId,variant:card.querySelector('select.variant-select')?.value||'0',qty:Number(card.querySelector('.quantity-value').value)})):[];
  const list = filteredProducts();
  const shown=activeFilter==='todos'?visibleProductCount(list.length,revealClicks):list.length;
  resultCount.textContent = shown<list.length?`${shown} de ${list.length} productos`:`${list.length} producto${list.length === 1 ? '' : 's'}`;
  document.getElementById('resetFilters').hidden = activeFilter === 'caldos' && !activeSearch && activeSort === 'featured';

  if(!list.length) {
    grid.innerHTML = `<div class="no-results"><strong>No encontramos productos con ese criterio.</strong><p>Prueba otro nombre o vuelve a la categoría de caldos.</p></div>`;
    return;
  }

  grid.innerHTML = list.slice(0,shown).map(p => {
    const v0 = selectedVariant(p,0);
    const multi = p.variants.length > 1;
    return `<article class="product-card" data-product-id="${p.id}" data-category="${p.category}">
      <div class="product-card__media">
        <img src="${esc(p.image)}" loading="lazy" alt="${esc(p.name)}">
        <span class="product-card__badge">${esc(p.badge)}</span>
      </div>
      <div class="product-card__body">
        <div class="product-card__head">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.short)}</p>${p.variable ? '<span class="weight-note">Precio sujeto al peso final</span>' : ''}
        </div>
        <div class="product-card__price-row">
          <div class="product-card__price"><small>${p.id==='cp-entero'?'Precio por kilo':multi ? 'Presentación seleccionada' : 'Precio'}</small><strong>${formatMoney(v0.price)}</strong></div>
        </div>
        ${multi
          ? `<select class="variant-select" aria-label="Presentación de ${esc(p.name)}">${variantOptions(p)}</select>`
          : `<div class="variant-select variant-select--static">${esc(v0.label)} · ${formatMoney(v0.price)}</div>`}
        <div class="product-card__actions">
          ${quantityControl('qty-'+p.id,p.name)}
          <button class="add-btn" data-add="${p.id}">Agregar al carrito</button>
          <button class="details-btn" data-details="${p.id}" aria-label="Ver detalles de ${esc(p.name)}">Ver</button>
        </div>
      </div>
    </article>`;
  }).join('');
  if(shown<list.length){
    const more=document.createElement('div');more.className='load-more-products';
    const button=document.createElement('button');button.type='button';button.className='btn btn--green';button.textContent='Ver más productos';
    button.dataset.moreProducts='';
    more.append(button);grid.append(more);
  }

  const cards=new Map([...grid.querySelectorAll('.product-card')].map(card=>[card.dataset.productId,card]));
  for(const saved of selections){
    const card=cards.get(saved.id);if(!card)continue;
    const select=card.querySelector('select.variant-select');if(select){select.value=saved.variant;updateProductPrice(select);}
    const picker=card.querySelector('.quantity-picker');picker.querySelector('.quantity-value').value=String(saved.qty);
    picker.querySelector('[data-quantity-step="-1"]').disabled=saved.qty===1;picker.querySelector('[data-quantity-step="1"]').disabled=saved.qty===50;
  }
}

function updateProductPrice(select){
 const card=select.closest('.product-card');
 const product=productById(card.dataset.productId);
 const variant=selectedVariant(product,Number(select.value));
 card.querySelector('.product-card__price small').textContent='Precio seleccionado';
 card.querySelector('.product-card__price strong').textContent=formatMoney(variant.price);
}
// Register once: rebuilding product cards never creates more event handlers.
grid.addEventListener('change',event=>{
 if(event.target.matches('select.variant-select')) updateProductPrice(event.target);
});
grid.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(!button || !grid.contains(button)) return;
 if(button.hasAttribute('data-more-products')){revealClicks++;renderProducts(true);return;}
 if(button.dataset.details){openProductModal(button.dataset.details);return;}
 if(!button.dataset.add) return;
 const card=button.closest('.product-card');
 const select=card.querySelector('select.variant-select');
 if(addToCart(button.dataset.add,select?Number(select.value):0,Number(card.querySelector('.quantity-value').value))) showAddedButton(button);
});

function showAddedButton(button){
  clearTimeout(button.addedTimer);
  button.textContent='✓ Agregado';
  button.classList.add('is-added');
  button.addedTimer=setTimeout(()=>{button.textContent='Agregar al carrito';button.classList.remove('is-added');},1600);
}
function saveCart() { invalidateQuote(); storage.set(cart); updateCartUI(); }
function addToCart(productId,variantIndex,quantity=1) {
  if(!Number.isInteger(quantity) || quantity<1 || quantity>50){showToast('Elige una cantidad entre 1 y 50');return false;}
  if(!index.has(productId) || !Number.isInteger(variantIndex) || !index.get(productId).variants[variantIndex]) return;
  const key=`${productId}__${variantIndex}`;
  const found=cart.find(i=>i.key===key);
  if((found?.qty||0)+quantity>50){showToast('Máximo 50 unidades por presentación');return false;}
  if(found) found.qty += quantity;
  else cart.push({key,productId,variantIndex,qty:quantity});
  saveCart();
  showToast(quantity===1?'Producto agregado al carrito':`${quantity} unidades agregadas al carrito`);
  return true;
}
function cartSubtotal() {
  return calculateSubtotal(cart);
}
function shippingInfo(){const value=shippingFor(cart);return {value,label:value===0?'Gratis':formatMoney(value)};}
function volumeLabel(ml){
 if(ml<1000) return `${ml} ml`;
 const n=ml/1000;
 return `${new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(n)} ${n===1?'litro':'litros'}`;
}
function updateBenefits(){
 const container=document.getElementById('cartBenefits');
 const b=cartBenefits(cart);
 if(!cart.length){container.replaceChildren();return;}
 const litersText=new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(b.liters);
 const literMessage=b.liters>=3?'Envío gratis alcanzado por caldos.':b.liters>=2?`Te faltan ${volumeLabel(3000-b.ml)} para el envío gratis.`:`Te faltan ${volumeLabel(2000-b.ml)} para bajar el domicilio a $3.000.`;
 const cubeMessage=b.cubes>=48?'Envío gratis alcanzado por cubos.':b.discountCubes>=24?`Te faltan ${48-b.cubes} cubos para el envío gratis.`:b.dualCubes>0?'Cuadros Dual: $7.000 de domicilio hasta completar 48 cuadros; desde 48, gratis. Los demás sabores bajan a $3.000 desde 24 cuadros.':`Te faltan ${24-b.cubes} cubos para bajar el domicilio a $3.000.`;
 const mixedMessage=qualifiesForMixedFreeShipping(cart,b.liters,b.subtotal)?'Tu pedido mixto ya tiene envío gratis.':b.liters<1?'Agrega mínimo 1 L de caldo para habilitar esta opción.':!b.mixedEligible?'Agrega cortes de pollo, aguacate, zucchini o aloe vera.':`Te faltan ${formatMoney(Math.max(0,200000-b.subtotal))} para el envío gratis.`;
 const shippingText=b.shipping===0?'GRATIS':formatMoney(b.shipping);
 container.innerHTML=`<section class="shipping-guide">
  <div class="shipping-guide__head"><div><strong>Domicilio de todo tu pedido</strong><p>Tienes tres caminos para mejorar el domicilio de toda tu compra: caldos, cubos o pedido mixto.</p></div><span>${shippingText}</span></div>
  <div class="shipping-path"><div class="shipping-path__line"><span>Caldos</span><progress max="3" value="${Math.min(b.liters,3)}" aria-label="Progreso de caldos hacia 3 litros"></progress><b>${litersText} L / 3 L</b></div><p>${literMessage}</p></div>
  <div class="shipping-path"><div class="shipping-path__line"><span>Cubos</span><progress max="48" value="${Math.min(b.cubes,48)}" aria-label="Progreso de cubos hacia 48 unidades"></progress><b>${b.cubes} / 48</b></div><p>${cubeMessage}</p></div>
  <div class="shipping-path"><div class="shipping-path__line"><span>Pedido mixto</span><progress max="200000" value="${Math.min(b.subtotal,200000)}" aria-label="Progreso del pedido mixto hacia doscientos mil pesos"></progress><b>${formatMoney(b.subtotal)} / $200.000</b></div><p>${mixedMessage}</p></div>
  <div class="shipping-guide__result"><span>Toda tu compra tiene domicilio de</span><strong>${shippingText}</strong></div>
  ${b.personalize?'<div class="shipping-guide__portion shipping-guide__portion--enabled"><strong>¡Personalización habilitada!</strong> Ya puedes solicitar personalizar tu caldo de hueso gratis en bolsitas de 250 ml para facilitar el manejo en congelación.</div>':b.personalizationNotice?'<div class="shipping-guide__portion"><strong>Tu caldo, a tu medida.</strong> Con 2 litros elegibles puedes solicitar personalización gratis en bolsitas de 250 ml para facilitar el manejo en congelación. Agrega '+volumeLabel(b.personalizationRemaining)+' más para habilitar esta opción.</div>':''}
  <p class="shipping-guide__note"><strong>Se cobra un solo domicilio por compra.</strong> Si caldos o cubos alcanzan $3.000 o envío gratis, ese beneficio aplica a todo el pedido. El pedido mixto obtiene envío gratis desde $200.000.</p>
 </section>`;
}
function applyQuantityRecommendation(productId){
 // Recalculate at click time so a previous suggestion cannot replace a changed cart.
 const recommendation=quantityRecommendations(cart).find(item=>item.p.id===productId);
 if(!recommendation) return false;
 cart=recommendation.converted;
 saveCart();
 showToast('Presentación actualizada');
 return true;
}
function updateRecommendation(){
 const recommendations=quantityRecommendations(cart);
 recommendationNode.innerHTML=recommendations.map(rec=>{
  const describe=items=>items.map(item=>`${item.qty} × ${esc(rec.p.options[item.variantIndex].etiqueta)}`).join(' + ');
  const target=rec.replacements.length===1 && rec.replacements[0].qty===1
   ? `La presentación de ${esc(rec.p.options[rec.replacements[0].variantIndex].etiqueta)} cuesta`
   : `La combinación ${describe(rec.replacements)} cuesta`;
  const button=rec.replacements.length===1 && rec.replacements[0].qty===1
   ? `Cambiar a ${esc(rec.p.options[rec.replacements[0].variantIndex].etiqueta)}`:'Cambiar a esta combinación';
  const shipping=rec.shippingAfter!==rec.shippingBefore
   ? ` El domicilio cambia de ${formatMoney(rec.shippingBefore)} a ${formatMoney(rec.shippingAfter)}; el ahorro indicado ya incluye ese cambio.`:'';
  return `<div class="savings-card">
   <strong>Hay una presentación que te conviene más.</strong>
   <p>${describe(rec.sourceItems)} de ${esc(rec.p.name)} suman ${formatMoney(rec.currentTotal)}. ${target} ${formatMoney(rec.targetTotal)} y ahorras ${formatMoney(rec.saving)}.${shipping}</p>
   <button type="button" data-convert="${rec.p.id}">${button}</button>
  </div>`;
 }).join('');
}
function updateCartUI() {
  const count=cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('cartCount').textContent=count;
  document.getElementById('mobileCartCount').textContent=count;

  if(!cart.length) {
    cartItems.innerHTML='<div class="empty-cart"><strong>Tu carrito está vacío</strong><span>Elige un producto de la tienda para empezar.</span></div>';
  } else {
    cartItems.innerHTML=cart.map(item=>{
      const p=productById(item.productId); const v=selectedVariant(p,item.variantIndex);
      return `<div class="cart-item" data-key="${item.key}" data-category="${esc(p.category)}">
        <img src="${esc(p.image)}" alt="">
        <div><h4>${esc(p.name)}</h4><p>${esc(v.label)}</p><div class="cart-item__qty"><button class="qty-btn" data-qty="-1" aria-label="Disminuir cantidad">−</button><span>${item.qty}</span><button class="qty-btn" data-qty="1" aria-label="Aumentar cantidad">+</button></div></div>
        <div class="cart-item__side"><strong>${formatMoney(v.price*item.qty)}</strong><span>${formatMoney(v.price)} ${p.id==='cp-entero'?'/kg':'c/u'}</span><button class="remove-btn" data-remove>Quitar</button></div>
      </div>`;
    }).join('');
  }

  const subtotal=cartSubtotal(); const shipping=shippingInfo();
  document.getElementById('cartSubtotal').textContent=formatMoney(subtotal);
  document.getElementById('cartShipping').textContent=shipping.label;
  document.getElementById('cartTotal').textContent=formatMoney(subtotal+shipping.value);
  const note=document.getElementById('shippingNote');note.replaceChildren();
  if(cart.some(i=>productById(i.productId).variable)){const warning=document.createElement('strong');warning.textContent='El valor de los productos por kilo puede variar según su peso final.';note.append(warning,document.createTextNode(' Confirmaremos precio y entrega por WhatsApp.'));}
  else note.textContent='Confirmaremos precio y entrega por WhatsApp.';
  document.getElementById('goCheckout').disabled=!cart.length;
  updateRecommendation();
  updateBenefits();

}

cartItems.addEventListener('click',event=>{
 const button=event.target.closest('[data-qty],[data-remove]');
 if(!button || !cartItems.contains(button)) return;
 const key=button.closest('.cart-item').dataset.key;
 const item=cart.find(line=>line.key===key);if(!item) return;
 if(button.hasAttribute('data-remove')) cart=cart.filter(line=>line.key!==key);
 else{
  const next=item.qty+Number(button.dataset.qty);
  if(next>50){showToast('Máximo 50 unidades por presentación');return;}
  item.qty=next;
  if(next<=0) cart=cart.filter(line=>line.key!==key);
 }
 saveCart();
 const row=[...cartItems.querySelectorAll('.cart-item')].find(node=>node.dataset.key===key);
 const control=row && [...row.querySelectorAll('[data-qty]')].find(node=>node.dataset.qty===button.dataset.qty);
 (control||document.getElementById('closeCart')).focus({preventScroll:true});
});
recommendationNode.addEventListener('click',event=>{
 const button=event.target.closest('[data-convert]');
 if(button && recommendationNode.contains(button)) applyQuantityRecommendation(button.dataset.convert);
});

let returnFocus=null;
function syncOverlay(){
 const modal=document.querySelector('.modal.is-open');
 const drawer=cartDrawer.classList.contains('is-open')?cartDrawer:null;
 const active=modal||drawer;
 document.querySelectorAll('body > header,body > main,body > footer,.mobile-actions,#whatsappFloat,.skip-link').forEach(el=>{el.inert=Boolean(active);});
 document.body.classList.toggle('no-scroll',Boolean(active));
 cartDrawer.inert=active!==cartDrawer;
 document.querySelectorAll('.modal').forEach(m=>{m.inert=m!==active;});
 return active;
}
function focusOverlay(el){
 const target=el.querySelector('button,input,select,a[href]');
 target?.focus({preventScroll:true});
}
function openCart(){
 returnFocus=document.activeElement;
 cartDrawer.classList.add('is-open'); cartDrawer.setAttribute('aria-hidden','false');cartBackdrop.hidden=false;
 syncOverlay();focusOverlay(cartDrawer);
}
function closeCart(){
 const wasOpen=cartDrawer.classList.contains('is-open');
 cartDrawer.classList.remove('is-open');cartDrawer.setAttribute('aria-hidden','true');cartBackdrop.hidden=true;
 syncOverlay();if(wasOpen && returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
}
function openModal(id){
 returnFocus=document.activeElement;
 const modal=document.getElementById(id);modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');
 syncOverlay();focusOverlay(modal);
}
function closeModal(id){
 if(id==='checkoutModal') quoteRequests.cancel();
 const modal=document.getElementById(id);modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');
 syncOverlay();if(returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
}
function openProductModal(id) {
  const p=productById(id);
  const gallery=[p.image,...p.gallery];
  const content=document.getElementById('productModalContent');
  content.innerHTML=`<div class="product-modal__content">
    <div class="product-modal__media" data-category="${esc(p.category)}"><img id="modalGalleryImage" src="${esc(p.image)}" alt="${esc(p.name)}">
      ${gallery.length>1?`<div class="product-modal__gallery" role="group" aria-label="Fotos de ${esc(p.name)}">
        <button type="button" data-gallery-step="-1" aria-label="Imagen anterior de ${esc(p.name)}">‹</button>
        <span id="modalGalleryStatus" aria-live="polite">Imagen 1 de ${gallery.length}</span>
        <button type="button" data-gallery-step="1" aria-label="Imagen siguiente de ${esc(p.name)}">›</button>
      </div>`:''}</div>
    <div class="product-modal__copy">
      <span class="kicker">${esc(p.badge)}</span>
      <h2 id="modalProductName">${esc(p.name)}</h2>
      <p>${esc(p.detail)}</p>
      ${p.facts.length?`<div class="product-facts">${p.facts.map(f=>`<div>${esc(f)}</div>`).join('')}</div>`:''}
      <div class="product-modal__buy">
        ${p.variants.length>1
          ? `<select id="modalVariant" class="variant-select" aria-label="Presentación">${variantOptions(p)}</select>`
          : `<div class="variant-select variant-select--static">${esc(p.variants[0][0])} · ${formatMoney(p.variants[0][1])}</div>`}
        <div class="modal-quantity-row">${quantityControl('modalQuantity',p.name)}<button class="add-btn" id="modalAdd">Agregar al carrito</button></div>
      </div>
    </div>
  </div>`;
  if(gallery.length>1){
    let position=0;
    content.querySelectorAll('[data-gallery-step]').forEach(button=>button.addEventListener('click',()=>{
      position=(position+Number(button.dataset.galleryStep)+gallery.length)%gallery.length;
      const image=document.getElementById('modalGalleryImage');
      image.src=gallery[position];
      image.alt=`${p.name} · imagen ${position+1} de ${gallery.length}`;
      document.getElementById('modalGalleryStatus').textContent=`Imagen ${position+1} de ${gallery.length}`;
    }));
  }
  document.getElementById('modalAdd').addEventListener('click',e=>{
    const select=document.getElementById('modalVariant');
    if(!addToCart(p.id,select?Number(select.value):0,Number(document.getElementById('modalQuantity').value))) return;
    const button=e.currentTarget;showAddedButton(button);button.disabled=true;
    setTimeout(()=>{
      button.disabled=false;
      if(document.getElementById('productModal').classList.contains('is-open') && button.isConnected){closeModal('productModal');openCart();}
    },900);
  });
  openModal('productModal');
}

function checkoutRecap() {
  const subtotal=cartSubtotal(); const shipping=shippingInfo();
  return `<div><span>${cart.reduce((s,i)=>s+i.qty,0)} producto(s)</span><strong>${formatMoney(subtotal)}</strong></div>
  <div><span>Domicilio</span><strong>${shipping.label}</strong></div>
  <div class="recap-total"><span>Total estimado</span><strong>${formatMoney(subtotal+shipping.value)}</strong></div>`;
}
function openCheckout() {
  if(!cart.length) { showToast('Tu carrito está vacío'); return; }
  if(!currentReference){
    currentReference=newOrderReference();
    orderState={orderStatus:'checkout_started',reference:currentReference,createdAt:new Date().toISOString()};
    writeOrderState(orderState);
  }
  closeCart();
  invalidateQuote();
  updateAddressMap();
  document.getElementById('checkoutRecap').innerHTML=checkoutRecap();
  openModal('checkoutModal');
}
function value(id){return document.getElementById(id)?.value.trim()||'';}
function updateDelivery(){
 const city=value('city');
 document.getElementById('deliveryEstimate').textContent=city?'Entrega estimada: '+(city==='bogota'?BOGOTA_DELIVERY:THURSDAY_DELIVERY):'Selecciona tu ciudad para ver la entrega estimada.';
 const notice=document.getElementById('deliveryCityNotice');
 const thursday=Boolean(CITY_NAMES[city])&&city!=='bogota';
 notice.hidden=!thursday;
 notice.textContent=thursday?'Entrega programada para el próximo jueves.':'';
}
let quoteRevision=0;
let pendingQuoteUrl='';
const quoteRequests=createRequestGate();
function invalidateQuote(){
 quoteRequests.cancel();
 quoteRevision++;
 pendingQuoteUrl='';
 pendingOrderText='';
 document.getElementById('copyFollowup').hidden=true;
 if(orderState && orderState.orderStatus!=='checkout_started'){
  orderState={orderStatus:'checkout_started',reference:currentReference,createdAt:orderState.createdAt||new Date().toISOString()};
  writeOrderState(orderState);
 }
 document.getElementById('confirmFinal').checked=false;
 document.getElementById('confirmData').checked=false;
 updateFinalConsent();
}
function updateFinalConsent(){
 const approved=document.getElementById('confirmFinal').checked && Boolean(pendingQuoteUrl);
 const link=document.getElementById('quoteWhatsApp');
 link.setAttribute('aria-disabled',String(!approved));
 link.tabIndex=approved?0:-1;
 if(approved) link.href=pendingQuoteUrl;else link.removeAttribute('href');
 document.getElementById('copyOrder').disabled=!approved;
 document.getElementById('finalReviewStatus').textContent=approved?'Todo listo. Abre WhatsApp y pulsa Enviar para compartir tu pedido.':'Marca la casilla para habilitar Copiar y Enviar por WhatsApp.';
}
function addressQuery(address,neighborhood,city){
 const place=CITY_NAMES[city];
 return place ? [address,neighborhood,place,'Colombia'].filter(Boolean).join(', ') : '';
}
function mapsSearchUrl(query){return 'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query});}
function mapsEmbedUrl(query,key=''){
 return key ? 'https://www.google.com/maps/embed/v1/place?'+new URLSearchParams({key,q:query,language:'es'})
 : 'https://www.google.com/maps?'+new URLSearchParams({q:query,output:'embed',hl:'es',z:'17'});
}
let mapTimer;
let mappedQuery='';
function updateAddressMap(immediate=false){
 clearTimeout(mapTimer);
 const query=addressQuery(value('address'),value('neighborhood'),value('city'));
 const link=document.getElementById('addressMaps');
 link.setAttribute('aria-disabled',String(!query));link.tabIndex=query?0:-1;
 if(query) link.href=mapsSearchUrl(query);else link.removeAttribute('href');
 document.getElementById('mapAddress').textContent=query||'Escribe la dirección y selecciona la ciudad. El mapa aparecerá aquí.';
 if(query && query===mappedQuery) return;
 const frame=document.getElementById('addressMapFrame');
 frame.hidden=true;frame.removeAttribute('src');
 document.getElementById('mapPlaceholder').hidden=false;
 document.getElementById('mapPlaceholder').textContent=query?'Actualizando la ubicación…':'Tu ubicación de entrega aparecerá aquí.';
 mappedQuery='';
 if(!query) return;
 // Wait briefly for typing to pause; never reload once per keystroke.
 const loadMap=()=>{
  const key=document.querySelector('.address-map').dataset.embedKey;
  frame.src=mapsEmbedUrl(query,key);frame.hidden=false;mappedQuery=query;
  document.getElementById('mapPlaceholder').hidden=true;
 };
 if(immediate)loadMap();else mapTimer=setTimeout(loadMap,600);
}
function updatePropertyType(){
 const isHouse=value('propertyType')==='casa';
 const isApartment=value('propertyType')==='apartamento';
 document.getElementById('houseField').hidden=!isHouse;
 document.querySelectorAll('[data-apartment-field]').forEach(label=>{label.hidden=!isApartment;label.querySelector('input').disabled=!isApartment;});
 document.getElementById('building').required=isApartment;
 document.getElementById('houseNumber').disabled=!isHouse;
 document.getElementById('floorField').hidden=!(isHouse||isApartment);
 document.getElementById('floor').disabled=!(isHouse||isApartment);
}
function reviewRow(label,value,accent=false){
 const row=document.createElement('div');row.className='quote-detail-row'+(accent?' quote-detail-row--accent':'');
 const name=document.createElement('span');name.textContent=label;
 const content=document.createElement('strong');content.textContent=value;
 row.append(name,content);return row;
}
function reviewCard(title){
 const card=document.createElement('section');card.className='quote-card';
 const heading=document.createElement('h3');heading.textContent=title;card.append(heading);return card;
}
function renderQuoteDetails(result,cliente,paymentLabel){
 const root=document.getElementById('quoteDetails');root.replaceChildren();
 const productsCard=reviewCard('Productos');
 for(const line of result.lineas){
  const product=document.createElement('div');product.className='quote-product';
  const description=document.createElement('div');
  const name=document.createElement('strong');name.textContent=line.nombre;
  const option=document.createElement('span');option.textContent=`${line.opcion} · Cantidad: ${line.cantidad}${line.variable?' · Precio sujeto al peso final':''}`;
  const amount=document.createElement('b');amount.textContent=formatMoney(line.importe);
  description.append(name,option);product.append(description,amount);productsCard.append(product);
 }
 const totals=reviewCard('Resumen');
 totals.append(reviewRow('Subtotal',formatMoney(result.subtotal)),reviewRow('Domicilio',result.domicilio===0?'GRATIS':formatMoney(result.domicilio)),reviewRow('Total estimado',formatMoney(result.total),true));
 const shippingResult=document.createElement('div');shippingResult.className='quote-shipping-result';
 const shippingStrong=document.createElement('strong');shippingStrong.textContent=result.domicilio===0?'✓ Tu compra completa tiene ENVÍO GRATIS':`Domicilio: ${formatMoney(result.domicilio)}`;
 const shippingNote=document.createElement('span');shippingNote.textContent='Se cobra un solo domicilio por compra y se aplica siempre la mejor condición alcanzada por el pedido.';
 shippingResult.append(shippingStrong,shippingNote);totals.append(shippingResult);
 const delivery=reviewCard('Entrega');
 delivery.append(reviewRow('Cliente',`${cliente.nombres} ${cliente.apellidos}`),reviewRow('Teléfono',cliente.telefono),reviewRow('Dirección',[cliente.direccion,cliente.barrio,CITY_NAMES[cliente.ciudad]].filter(Boolean).join(', ')),reviewRow('Tipo de vivienda',cliente['tipo-vivienda']==='casa'?'Casa':'Conjunto/Edificio'),reviewRow('Entrega estimada',result.entrega));
 const locationDetails=[cliente.casa&&`Casa/interior: ${cliente.casa}`,cliente.edificio&&`Conjunto/edificio: ${cliente.edificio}`,cliente.torre&&`Torre: ${cliente.torre}`,cliente.apartamento&&`Apartamento/interior: ${cliente.apartamento}`,cliente.piso&&`Piso: ${cliente.piso}`,cliente.indicaciones&&`Indicaciones: ${cliente.indicaciones}`].filter(Boolean);
 if(locationDetails.length) delivery.append(reviewRow('Detalles',locationDetails.join(' · ')));
 const preferences=reviewCard('Medio de pago');
 preferences.append(reviewRow('Medio de pago',paymentLabel));
 root.append(productsCard,totals,delivery,preferences);
}
async function submitQuote(form){
 const button=document.getElementById('submitQuote');
 if(button.disabled) return;
 if(!cart.length){showToast('Agrega un producto antes de continuar');return;}
 if(!form.reportValidity()) return;
 const payment=form.querySelector('input[name="payment"]:checked').value;
 const paymentLabel=form.querySelector('input[name="payment"]:checked').closest('label').querySelector('strong').textContent;
 const fields={nombres:'firstNames',apellidos:'lastNames',telefono:'contactPhone',direccion:'address',barrio:'neighborhood',ciudad:'city',edificio:'building',torre:'tower',apartamento:'apartment',piso:'floor',indicaciones:'deliveryNotes','tipo-vivienda':'propertyType',casa:'houseNumber'};
 const cliente=Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,document.getElementById(id)?.disabled?'':value(id)]));
 const requestedRevision=quoteRevision;
 button.disabled=true;button.textContent='Revisando tu pedido…';
 const request=quoteRequests.begin();
 try{
  const response=await fetch('/api/cotizar',{method:'POST',headers:{'Content-Type':'application/json'},signal:request.signal,
   body:JSON.stringify({cliente,items:cart.map(i=>({id:i.productId,opcion:i.variantIndex,cantidad:i.qty})),pago:['efectivo','tarjeta'].includes(payment)?payment:'online',online:['nequi','daviplata','llave','link'].includes(payment)?payment:'llave'})});
  const result=await readApiResponse(response);
  if(!request.isCurrent() || requestedRevision!==quoteRevision) return;
  const {whatsappUrl,mapsUrl}=validateQuoteLinks(result,WHATSAPP_URL);
  renderQuoteDetails(result,cliente,paymentLabel);
  document.getElementById('quoteMaps').href=mapsUrl.toString();
  if(!currentReference) currentReference=newOrderReference();
  const baseText=whatsappUrl.searchParams.get('text')||result.detalle;
  pendingOrderText=`*PEDIDO ${currentReference}*\n\n${baseText}`;
  whatsappUrl.searchParams.set('text',pendingOrderText);
  pendingQuoteUrl=whatsappUrl.toString();
  orderState={orderStatus:'quote_ready',reference:currentReference,createdAt:orderState?.createdAt||new Date().toISOString()};
  writeOrderState(orderState);
  document.getElementById('confirmFinal').checked=false;
  document.getElementById('copyFollowup').hidden=true;
  updateFinalConsent();
  request.finish();
  closeModal('checkoutModal');openModal('quoteModal');
 }catch(error){if(request.isCurrent()) showToast(error.name==='AbortError'?'La conexión tardó demasiado. Tu carrito sigue guardado.':error.message);}
 finally{request.finish();button.disabled=false;button.textContent='Revisar pedido';}
}
function markAwaitingConfirmation(){
 const now=new Date();
 orderState={orderStatus:'awaiting_confirmation',reference:currentReference,date:now.toLocaleDateString('es-CO'),time:now.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),createdAt:orderState?.createdAt||now.toISOString()};
 writeOrderState(orderState);
}
function clearOrderData(){
 waitingForWhatsAppReturn=false;storeLostFocus=false;
 cart=[];storage.remove();removeOrderState();orderState=null;currentReference='';pendingQuoteUrl='';pendingOrderText='';quoteRevision++;
 const form=document.getElementById('checkoutForm');form.reset();
 document.getElementById('quoteDetails').replaceChildren();
 document.getElementById('quoteMaps').removeAttribute('href');
 document.getElementById('copyFollowup').hidden=true;
 document.getElementById('confirmFinal').checked=false;
 document.getElementById('confirmData').checked=false;
 mappedQuery='';clearTimeout(mapTimer);updatePropertyType();updateDelivery();updateAddressMap();updateFinalConsent();updateCartUI();
}
function closeAllOrderModals(){
 ['checkoutModal','quoteModal','sentConfirmationModal','finishOrderModal','cancelOrderModal'].forEach(id=>closeModal(id));
}
function showSentConfirmation(){
 closeCart();closeAllOrderModals();
 openModal('sentConfirmationModal');
}
let finishReturnModal='quoteModal';
function requestFinish(returnModal='quoteModal'){
 finishReturnModal=returnModal;
 closeModal(returnModal);
 openModal('finishOrderModal');
}
let cancelReturnView='quoteModal';
function requestCancellation(returnView='quoteModal'){
 cancelReturnView=returnView;
 if(returnView==='cartDrawer') closeCart();else closeModal(returnView);
 openModal('cancelOrderModal');
}
function showToast(message) {
  toast.textContent=message; toast.classList.add('is-visible');
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove('is-visible'),2300);
}
function setFilter(filter,scroll=true) {
  revealClicks=0;
  activeFilter=filter; activeSearch='';
  document.getElementById('productSearch').value='';
  document.querySelectorAll('[data-filter]').forEach(btn=>{btn.classList.toggle('is-active',btn.dataset.filter===filter);btn.setAttribute('aria-pressed',String(btn.dataset.filter===filter));});
  const activeChip=document.querySelector('.filter-chip.is-active');
  moveLiquidIndicator(document.querySelector('.filter-row'),activeChip,true);
  revealFilterChip(activeChip);
  renderProducts();
  if(scroll) document.getElementById('tienda').scrollIntoView({behavior:'smooth',block:'start'});
}

// One delegated listener handles quantity controls in both cards and product details.
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-quantity-step]');if(!button) return;
 const group=button.closest('.quantity-picker');const output=group.querySelector('.quantity-value');
 const qty=stepQuantity(Number(output.value),Number(button.dataset.quantityStep));
 output.value=String(qty);
 group.querySelector('[data-quantity-step="-1"]').disabled=qty===1;
 group.querySelector('[data-quantity-step="1"]').disabled=qty===50;
});
// Cart & checkout
['openCart','mobileCart'].forEach(id=>document.getElementById(id)?.addEventListener('click',openCart));
document.getElementById('closeCart').addEventListener('click',closeCart);
cartBackdrop.addEventListener('click',closeCart);
document.getElementById('goCheckout').addEventListener('click',openCheckout);
document.getElementById('clearCart').addEventListener('click',()=>requestCancellation('cartDrawer'));
document.getElementById('whatsappFloat').addEventListener('click',()=>window.open(WHATSAPP_URL,'_blank','noopener'));

document.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>closeModal(el.dataset.closeModal)));
document.querySelectorAll('[data-feature-product]').forEach(btn=>btn.addEventListener('click',()=>openProductModal(btn.dataset.featureProduct)));
document.querySelectorAll('[data-jump-filter]').forEach(btn=>btn.addEventListener('click',()=>setFilter(btn.dataset.jumpFilter,true)));
document.querySelectorAll('[data-footer-filter]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();setFilter(a.dataset.footerFilter,true);}));
document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>setFilter(btn.dataset.filter,false)));

document.getElementById('productSearch').addEventListener('input',e=>{revealClicks=0;activeSearch=e.currentTarget.value.trim();renderProducts();});
document.getElementById('productSort').addEventListener('change',e=>{revealClicks=0;activeSort=e.currentTarget.value;renderProducts();});
document.getElementById('resetFilters').addEventListener('click',()=>{activeFilter='caldos';activeSearch='';activeSort='featured';document.getElementById('productSearch').value='';document.getElementById('productSort').value='featured';document.querySelectorAll('[data-filter]').forEach(btn=>{btn.classList.toggle('is-active',btn.dataset.filter==='caldos');btn.setAttribute('aria-pressed',String(btn.dataset.filter==='caldos'));});const activeChip=document.querySelector('.filter-chip.is-active');moveLiquidIndicator(document.querySelector('.filter-row'),activeChip,true);revealFilterChip(activeChip);renderProducts();});

document.getElementById('checkoutForm').addEventListener('submit',e=>{e.preventDefault();submitQuote(e.currentTarget);});
document.getElementById('city').addEventListener('change',updateDelivery);
const addressFields=new Set(['address','neighborhood','city']);
for(const event of ['input','change']) document.getElementById('checkoutForm').addEventListener(event,e=>{
 if(e.target.id!=='confirmData') invalidateQuote();
 if(addressFields.has(e.target.id)) updateAddressMap(event==='change' || e.target.id==='city');
});
document.getElementById('confirmFinal').addEventListener('change',updateFinalConsent);
let waitingForWhatsAppReturn=false;
let storeLostFocus=false;
document.getElementById('quoteWhatsApp').addEventListener('click',e=>{
 if(!document.getElementById('confirmFinal').checked || !pendingQuoteUrl){e.preventDefault();showToast('Confirma que el resumen es correcto antes de continuar');return;}
 markAwaitingConfirmation();waitingForWhatsAppReturn=true;storeLostFocus=false;
});
document.getElementById('editQuote').addEventListener('click',()=>{closeModal('quoteModal');openCheckout();});
document.getElementById('copyOrder').addEventListener('click',async()=>{
 if(!pendingOrderText || !document.getElementById('confirmFinal').checked){showToast('Confirma que el resumen es correcto antes de copiar');return;}
 const copiedRevision=quoteRevision;
 try{
  await navigator.clipboard.writeText(pendingOrderText);
  if(copiedRevision!==quoteRevision) return;
  document.getElementById('copyFollowup').hidden=false;
  showToast('✓ Pedido copiado');
 }catch{showToast('No fue posible copiar. Inténtalo de nuevo.');}
});
document.getElementById('finishCopiedOrder').addEventListener('click',()=>requestFinish('quoteModal'));
document.getElementById('cancelOrder').addEventListener('click',()=>requestCancellation('quoteModal'));
document.getElementById('returnToOrder').addEventListener('click',()=>{
 closeModal('sentConfirmationModal');
 if(pendingQuoteUrl) openModal('quoteModal');else openCart();
});
document.getElementById('confirmSentOrder').addEventListener('click',()=>requestFinish('sentConfirmationModal'));
document.getElementById('cancelFinish').addEventListener('click',()=>{closeModal('finishOrderModal');if(finishReturnModal==='sentConfirmationModal')openModal('sentConfirmationModal');else if(pendingQuoteUrl)openModal('quoteModal');else openCart();});
document.getElementById('finishOrder').addEventListener('click',()=>{closeModal('finishOrderModal');clearOrderData();openModal('orderSuccessModal');});
document.getElementById('keepOrder').addEventListener('click',()=>{closeModal('cancelOrderModal');if(cancelReturnView==='cartDrawer')openCart();else if(pendingQuoteUrl)openModal('quoteModal');else openCart();});
document.getElementById('emptyOrder').addEventListener('click',()=>{closeModal('cancelOrderModal');clearOrderData();document.getElementById('tienda').scrollIntoView({behavior:'smooth',block:'start'});showToast('Pedido eliminado');});
document.getElementById('newOrder').addEventListener('click',()=>{closeModal('orderSuccessModal');setFilter('caldos',true);});
window.addEventListener('blur',()=>{if(waitingForWhatsAppReturn)storeLostFocus=true;});
function checkWhatsAppReturn(){
 if(waitingForWhatsAppReturn && storeLostFocus && orderState?.orderStatus==='awaiting_confirmation'){
  waitingForWhatsAppReturn=false;storeLostFocus=false;showSentConfirmation();
 }
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){if(waitingForWhatsAppReturn)storeLostFocus=true;}
 else checkWhatsAppReturn();
});
window.addEventListener('focus',checkWhatsAppReturn);
document.getElementById('propertyType').addEventListener('change',updatePropertyType);
updatePropertyType();
updateAddressMap();
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab' && e.key!=='Escape') return;
  const active=document.querySelector('.modal.is-open') || (cartDrawer.classList.contains('is-open')?cartDrawer:null);
  if(e.key==='Tab' && active){
    const items=[...active.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
  }

  if(e.key==='Escape'){ if(cartDrawer.classList.contains('is-open')) closeCart(); document.querySelectorAll('.modal.is-open').forEach(m=>closeModal(m.id)); mainNav.classList.remove('is-open');menuToggle.setAttribute('aria-expanded','false'); }
});

renderProducts();
updateCartUI();


syncOverlay();
document.querySelectorAll('[data-filter]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.filter===activeFilter)));
activateNavLink(mainNav.querySelector('a[href="#tienda"]'),false);
moveLiquidIndicator(document.querySelector('.filter-row'),document.querySelector('.filter-chip.is-active'),false);
document.fonts?.ready.then(()=>{
 moveLiquidIndicator(mainNav,mainNav.querySelector('.is-nav-active')||mainNav.querySelector('a'),false);
 moveLiquidIndicator(document.querySelector('.filter-row'),document.querySelector('.filter-chip.is-active'),false);
});
if(orderState?.orderStatus==='awaiting_confirmation' && cart.length) setTimeout(showSentConfirmation,0);

})().catch(error=>{document.getElementById('productGrid').textContent='No pudimos cargar la tienda. Recarga la página para intentarlo de nuevo.';console.error(error);});
