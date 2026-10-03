// Pure cart rules. Python recalculates every quote with the authoritative catalog.
export const MAX_QUANTITY = 50;
export const MAX_LINES = 100;

export function stepQuantity(current, step) {
  return Math.max(1, Math.min(MAX_QUANTITY, current + step));
}

export function createCartRules(products) {
 const index = new Map(products.map(product => [product.id, product]));
 const productById = id => index.get(id);
function restoreCart(raw){
 if(!Array.isArray(raw) || raw.length>MAX_LINES) return [];
 const valid = new Map();
 for(const item of raw){
  if(!item || typeof item!=='object') continue;
  const p = index.get(item.productId);
  if(!p || !Number.isInteger(item.variantIndex) || !p.variants[item.variantIndex] || !Number.isInteger(item.qty) || item.qty<1 || item.qty>99) continue;
  const key = `${p.id}__${item.variantIndex}`;
  // Migrate saved quantities from the previous 99-unit limit.
  const qty = Math.min(MAX_QUANTITY,(valid.get(key)?.qty||0)+item.qty);
  valid.set(key,{key,productId:p.id,variantIndex:item.variantIndex,qty});
 }
 return [...valid.values()];
}
function calculateBrothLiters(lines){
 return lines.reduce((total,item)=>{
  const option=productById(item.productId).options[item.variantIndex];
  return total+option.ml*item.qty;
 },0)/1000;
}
function calculateCubeUnits(lines){
 return lines.reduce((total,item)=>{
  const option=productById(item.productId).options[item.variantIndex];
  return total+option.unidades*item.qty;
 },0);
}
function calculateSubtotal(lines){
 return lines.reduce((total,item)=>{
  const option=productById(item.productId).options[item.variantIndex];
  return total+option.precio*item.qty;
 },0);
}
const MIXED_FREE_IDS=new Set(['aguacate','zucchini','cuadro-aloe']);
function hasMixedEligibleProduct(lines){
 return lines.some(item=>{
  const product=productById(item.productId);
  return product.category==='pollo' || MIXED_FREE_IDS.has(product.id);
 });
}
function qualifiesForMixedFreeShipping(lines,liters,subtotal){
 return liters>=1 && subtotal>=200000 && hasMixedEligibleProduct(lines);
}
function calculateGlobalShipping(lines){
 if(!lines.length) return 0;
 const liters=calculateBrothLiters(lines);
 const cubes=calculateCubeUnits(lines);
 const dualCubes=calculateCubeUnits(lines.filter(item=>item.productId==='cuadro-dual'));
 const subtotal=calculateSubtotal(lines);
 const shippingByLiters=liters>=3?0:liters>=2?3000:7000;
 const shippingByCubes=cubes>=48?0:cubes-dualCubes>=24?3000:7000;
 const shippingByMixedOrder=qualifiesForMixedFreeShipping(lines,liters,subtotal)?0:7000;
 return Math.min(shippingByLiters,shippingByCubes,shippingByMixedOrder);
}
function shippingFor(lines){return calculateGlobalShipping(lines);}
function cartBenefits(lines){
 const ml=lines.reduce((n,i)=>n+productById(i.productId).options[i.variantIndex].ml*i.qty,0);
 const cubes=calculateCubeUnits(lines),dualCubes=calculateCubeUnits(lines.filter(item=>item.productId==='cuadro-dual')),subtotal=calculateSubtotal(lines),liters=ml/1000;
 const personalizedMl=lines.reduce((total,item)=>{
  const product=productById(item.productId),option=product.options[item.variantIndex];
  return product.category!=='caldos' || /(^|\s)200\s*ml($|\s)/i.test(option.etiqueta)?total:total+option.ml*item.qty;
 },0);
 const shipping=shippingFor(lines);
 return {ml,liters,cubes,dualCubes,discountCubes:cubes-dualCubes,subtotal,shipping,mixedEligible:hasMixedEligibleProduct(lines),remaining:Math.max(0,3000-ml),free:lines.length>0 && shipping===0,personalizationRemaining:Math.max(0,2000-personalizedMl),personalizationNotice:personalizedMl>=1000,personalize:personalizedMl>=2000};
}
function bestCubeCombination(product, sourceItems){
 const gcd=(a,b)=>b?gcd(b,a%b):a;
 const unit=product.options.reduce((size,option)=>gcd(size,option.unidades),0);
 if(!unit) return null;
 const total=sourceItems.reduce((n,item)=>n+product.options[item.variantIndex].unidades*item.qty,0)/unit;
 let plans=Array(total+1).fill(null);
 plans[0]={cost:0,packages:0,counts:[]};
 product.options.forEach(option=>{
  const size=option.unidades/unit;
  const next=Array(total+1).fill(null);
  for(let amount=0;amount<=total;amount++){
   const plan=plans[amount];if(!plan) continue;
   const maximum=size>0?Math.min(MAX_QUANTITY,Math.floor((total-amount)/size)):0;
   for(let qty=0;qty<=maximum;qty++){
    const target=amount+size*qty,cost=plan.cost+option.precio*qty,packages=plan.packages+qty;
    if(!next[target] || cost<next[target].cost || (cost===next[target].cost && packages<next[target].packages)){
     next[target]={cost,packages,counts:[...plan.counts,qty]};
    }
   }
  }
  plans=next;
 });
 return plans[total]?.counts.map((qty,variantIndex)=>({
  key:`${product.id}__${variantIndex}`,productId:product.id,variantIndex,qty
 })).filter(item=>item.qty>0)||null;
}
function buildRecommendation(product, sourceItems, replacements, lines){
 const converted=lines.filter(item=>!sourceItems.includes(item)).map(item=>({...item}));
 for(const replacement of replacements){
  const existing=converted.find(item=>item.productId===replacement.productId && item.variantIndex===replacement.variantIndex);
  if(existing){
   if(existing.qty+replacement.qty>MAX_QUANTITY) return null;
   existing.qty+=replacement.qty;
  }else converted.push({...replacement});
 }
 const currentTotal=calculateSubtotal(sourceItems),targetTotal=calculateSubtotal(replacements);
 const shippingBefore=shippingFor(lines),shippingAfter=shippingFor(converted);
 const saving=currentTotal-targetTotal+shippingBefore-shippingAfter;
 if(targetTotal>=currentTotal || saving<=0 || converted.length>MAX_LINES) return null;
 return {p:product,sourceItems,replacements,converted,currentTotal,targetTotal,saving,shippingBefore,shippingAfter};
}
function quantityRecommendations(lines){
 const recommendations=[];
 const groups=new Map();
 lines.forEach(item=>{
  if(!groups.has(item.productId)) groups.set(item.productId,[]);
  groups.get(item.productId).push(item);
 });
 for(const [productId,items] of groups){
  const product=productById(productId);
  if(product.category==='cubos'){
   const replacements=bestCubeCombination(product,items);
   const recommendation=replacements && buildRecommendation(product,items,replacements,lines);
   if(recommendation) recommendations.push(recommendation);
  }else if(product.category==='caldos'){
   for(const item of items){
    const option=product.options[item.variantIndex];
    if(option.etiqueta.toLowerCase()!=='1 litro' || item.qty<2 || item.qty>4) continue;
    const targetIndex=product.options.findIndex(target=>target.ml===option.ml*item.qty && target.etiqueta.toLowerCase()===`${item.qty} litros`);
    if(targetIndex<0) continue;
    const replacements=[{key:`${product.id}__${targetIndex}`,productId:product.id,variantIndex:targetIndex,qty:1}];
    const recommendation=buildRecommendation(product,[item],replacements,lines);
    if(recommendation){recommendations.push(recommendation);break;}
   }
  }
 }
 return recommendations;
}

 return Object.freeze({restoreCart, calculateBrothLiters, calculateCubeUnits, calculateSubtotal,
  hasMixedEligibleProduct, qualifiesForMixedFreeShipping, calculateGlobalShipping, shippingFor,
  cartBenefits, quantityRecommendations});
}

