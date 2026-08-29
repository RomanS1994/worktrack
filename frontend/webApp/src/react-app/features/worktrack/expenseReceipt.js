import { getToken } from '@shared/features/auth/authStorage.js';

function resolveBaseUrl(){
 if(import.meta.env.DEV){return import.meta.env.VITE_API_BASE_URL_TEST||import.meta.env.VITE_API_BASE_URL||'http://localhost:3001/api'}
 return import.meta.env.VITE_API_BASE_URL||'/api';
}

export async function openExpenseReceipt(expenseId){
 const previewWindow=window.open('about:blank','_blank');
 const headers=new Headers();
 const token=getToken();
 const apiKey=import.meta.env.VITE_API_KEY;
 if(token)headers.set('Authorization',`Bearer ${token}`);
 if(apiKey)headers.set('X-API-KEY',apiKey);
 try{
  const response=await fetch(`${resolveBaseUrl()}/manager/expenses/${encodeURIComponent(expenseId)}/receipt`,{credentials:'include',headers});
  if(!response.ok){
   let message='Receipt could not be opened';
   try{const payload=await response.json();if(payload?.error)message=payload.error}catch{}
   throw new Error(message);
  }
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  if(previewWindow){previewWindow.location.href=url}else{window.location.href=url}
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){
  if(previewWindow)previewWindow.close();
  throw error;
 }
}
