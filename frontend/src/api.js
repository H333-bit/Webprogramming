const API=import.meta.env.VITE_API_URL||'http://localhost:5000/api';
export const getToken=()=>localStorage.getItem('stylehub_token');
export const setToken=t=>localStorage.setItem('stylehub_token',t);
export const clearToken=()=>localStorage.removeItem('stylehub_token');
async function req(path,opt={}){const token=getToken();const headers={'Content-Type':'application/json',...(opt.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;const r=await fetch(API+path,{...opt,headers});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||'Request failed');return d;}
export const api={
register:p=>req('/auth/register',{method:'POST',body:JSON.stringify(p)}),login:p=>req('/auth/login',{method:'POST',body:JSON.stringify(p)}),me:()=>req('/auth/me'),
products:p=>req('/products'+(p?'?'+new URLSearchParams(p):'')),createProduct:p=>req('/products',{method:'POST',body:JSON.stringify(p)}),updateProduct:(id,p)=>req('/products/'+id,{method:'PUT',body:JSON.stringify(p)}),deleteProduct:id=>req('/products/'+id,{method:'DELETE'}),
cart:()=>req('/cart'),addCart:(productId,quantity=1)=>req('/cart',{method:'POST',body:JSON.stringify({productId,quantity})}),updateCart:(id,quantity)=>req('/cart/'+id,{method:'PUT',body:JSON.stringify({quantity})}),removeCart:id=>req('/cart/'+id,{method:'DELETE'}),
wishlist:()=>req('/wishlist'),addWish:id=>req('/wishlist/'+id,{method:'POST'}),removeWish:id=>req('/wishlist/'+id,{method:'DELETE'})};
