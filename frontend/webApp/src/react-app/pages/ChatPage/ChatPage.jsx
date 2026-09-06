import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser } from '@shared/features/auth/authSlice.js';
import {
  useDeleteChatMessageMutation,
  useGetChatMessagesQuery,
  useLazyGetChatMessagesQuery,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
} from '@shared/features/chat/chatApi.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './ChatPage.css';

const COPY = {
  uk:{title:'Чат компанії',subtitle:'Спільний чат для всієї команди',placeholder:'Написати повідомлення…',send:'Надіслати',older:'Завантажити старіші',empty:'Поки що повідомлень немає.',today:'Сьогодні',delete:'Видалити'},
  cs:{title:'Firemní chat',subtitle:'Společný chat pro celý tým',placeholder:'Napsat zprávu…',send:'Odeslat',older:'Načíst starší',empty:'Zatím zde nejsou žádné zprávy.',today:'Dnes',delete:'Smazat'},
  en:{title:'Company chat',subtitle:'Shared chat for the whole team',placeholder:'Write a message…',send:'Send',older:'Load older',empty:'No messages yet.',today:'Today',delete:'Delete'},
};

function formatTime(value, language){
  const locale=language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA';
  return new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

function initials(name){return String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()}

export function ChatPage(){
  const navigate=useNavigate();
  const user=useSelector(selectUser);
  const membershipId=user?.activeMembership?.id||'';
  const role=user?.activeMembership?.role||'';
  const {language}=useI18n();
  const c=COPY[language]||COPY.uk;
  const {data,isLoading}=useGetChatMessagesQuery({limit:50},{pollingInterval:15000});
  const [loadOlder,{isFetching:loadingOlder}]=useLazyGetChatMessagesQuery();
  const [sendMessage,sendState]=useSendChatMessageMutation();
  const [markRead]=useMarkChatReadMutation();
  const [deleteMessage]=useDeleteChatMessageMutation();
  const [text,setText]=useState('');
  const [older,setOlder]=useState([]);
  const listRef=useRef(null);
  const latest=data?.messages||[];
  const messages=useMemo(()=>{
    const map=new Map();
    [...older,...latest].forEach(item=>map.set(item.id,item));
    return [...map.values()].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  },[older,latest]);

  useEffect(()=>{
    const newest=latest[latest.length-1];
    if(newest?.createdAt) markRead({readAt:newest.createdAt});
  },[latest,markRead]);

  useEffect(()=>{
    const el=listRef.current;
    if(!el||!latest.length)return;
    const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<180;
    if(nearBottom||older.length===0) requestAnimationFrame(()=>el.scrollTo({top:el.scrollHeight,behavior:older.length?'smooth':'auto'}));
  },[latest.length,older.length]);

  async function submit(event){
    event.preventDefault();
    const body=text.trim();
    if(!body||sendState.isLoading)return;
    setText('');
    try{await sendMessage({body,clientMessageId:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`}).unwrap();}
    catch{setText(body)}
  }

  async function loadMore(){
    const first=messages[0];
    if(!first?.createdAt)return;
    const result=await loadOlder({before:first.createdAt,limit:50}).unwrap();
    setOlder(current=>[...(result?.messages||[]),...current]);
  }

  async function remove(item){
    if(item.authorMembershipId!==membershipId&&role!=='MANAGER')return;
    await deleteMessage(item.id).unwrap();
  }

  return <section className="companyChat">
    <header className="companyChatHeader"><button type="button" onClick={()=>navigate(-1)} aria-label="Back">‹</button><div><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>
    <div className="companyChatMessages" ref={listRef}>
      {data?.hasMore||older.length?<button className="companyChatOlder" type="button" onClick={loadMore} disabled={loadingOlder}>{loadingOlder?'…':c.older}</button>:null}
      {isLoading?<p className="companyChatEmpty">…</p>:null}
      {!isLoading&&!messages.length?<p className="companyChatEmpty">{c.empty}</p>:null}
      {messages.map(item=>{const mine=item.authorMembershipId===membershipId;return <article key={item.id} className={`companyChatMessage${mine?' isMine':''}`}>
        {!mine?<div className="companyChatAvatar">{item.author?.avatarDataUrl?<img src={item.author.avatarDataUrl} alt=""/>:<span>{initials(item.author?.name)}</span>}</div>:null}
        <div className="companyChatBubble">
          {!mine?<strong>{item.author?.name||'-'}</strong>:null}
          <p>{item.body}</p>
          <footer><time>{formatTime(item.createdAt,language)}</time>{mine||role==='MANAGER'?<button type="button" onClick={()=>remove(item)}>{c.delete}</button>:null}</footer>
        </div>
      </article>})}
    </div>
    <form className="companyChatComposer" onSubmit={submit}><textarea rows="1" maxLength="4000" value={text} onChange={e=>setText(e.target.value)} placeholder={c.placeholder}/><button type="submit" disabled={!text.trim()||sendState.isLoading}>{sendState.isLoading?'…':c.send}</button></form>
  </section>;
}
