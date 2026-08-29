import { getToken } from '@shared/features/auth/authStorage.js';

const MAX_RECEIPT_BYTES=2.5*1024*1024;
const VALID_RECEIPT_TYPES=new Set(['image/jpeg','image/png','image/webp']);

function resolveBaseUrl(){
 if(import.meta.env.DEV){return import.meta.env.VITE_API_BASE_URL_TEST||import.meta.env.VITE_API_BASE_URL||'http://localhost:3001/api'}
 return import.meta.env.VITE_API_BASE_URL||'/api';
}

function authHeaders(){
 const headers=new Headers();
 const token=getToken();
 const apiKey=import.meta.env.VITE_API_KEY;
 if(token)headers.set('Authorization',`Bearer ${token}`);
 if(apiKey)headers.set('X-API-KEY',apiKey);
 return headers;
}

function readAsDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('File read failed'));reader.readAsDataURL(blob)})}
function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image load failed'))};image.src=url})}
function canvasBlob(canvas,quality){return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality))}

export async function prepareExpenseReceipt(file){
 if(!file||!VALID_RECEIPT_TYPES.has(file.type))throw new Error('invalid');
 if(file.size>20*1024*1024)throw new Error('large');
 const image=await loadImage(file);
 const maxSide=1600;
 const scale=Math.min(1,maxSide/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height));
 const width=Math.max(1,Math.round((image.naturalWidth||image.width)*scale));
 const height=Math.max(1,Math.round((image.naturalHeight||image.height)*scale));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');if(!context)throw new Error('invalid');
 context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
 let blob=null;
 for(const quality of [0.82,0.68,0.54]){blob=await canvasBlob(canvas,quality);if(blob&&blob.size<=MAX_RECEIPT_BYTES)break}
 if(!blob||blob.size>MAX_RECEIPT_BYTES)throw new Error('large');
 const baseName=String(file.name||'receipt').replace(/\.[^.]+$/,'').slice(0,90)||'receipt';
 return {dataUrl:await readAsDataUrl(blob),fileName:`${baseName}.jpg`};
}

export async function uploadExpenseReceipt(expenseId,receipt){
 const headers=authHeaders();headers.set('Content-Type','application/json');
 const response=await fetch(`${resolveBaseUrl()}/manager/expenses/${encodeURIComponent(expenseId)}/receipt`,{method:'PATCH',credentials:'include',headers,body:JSON.stringify({receipt})});
 if(!response.ok){
  let message='Receipt could not be saved';
  try{const payload=await response.json();if(payload?.error)message=payload.error}catch{}
  throw new Error(message);
 }
 return response.json();
}

export async function openExpenseReceipt(expenseId){
 const response=await fetch(`${resolveBaseUrl()}/manager/expenses/${encodeURIComponent(expenseId)}/receipt`,{credentials:'include',headers:authHeaders()});
 if(!response.ok){
  let message='Receipt could not be opened';
  try{const payload=await response.json();if(payload?.error)message=payload.error}catch{}
  throw new Error(message);
 }
 const blob=await response.blob();
 const url=URL.createObjectURL(blob);
 window.open(url,'_blank','noopener,noreferrer');
 window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
