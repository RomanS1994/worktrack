import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser } from '@shared/features/auth/authSlice.js';
import {
  useDeleteChatMessageMutation,
  useGetChatMessagesQuery,
  useGetChatPresenceQuery,
  useGetChatReadStatesQuery,
  useGetChatSummaryQuery,
  useLazyGetChatMessagesQuery,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
  useSendChatTypingMutation,
} from '@shared/features/chat/chatApi.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './ChatPage.css';

const COPY = {
  uk:{title:'Чат компанії',subtitle:'Спільний чат для всієї команди',online:'онлайн',placeholder:'Написати повідомлення…',send:'Надіслати',older:'Завантажити старіші',empty:'Поки що повідомлень немає.',today:'Сьогодні',yesterday:'Вчора',newMessages:'Нові повідомлення',scrollNew:'Нові повідомлення',delete:'Видалити',typing:'друкує…',delivered:'Доставлено',read:'Прочитано'},
  cs:{title:'Firemní chat',subtitle:'Společný chat pro celý tým',online:'online',placeholder:'Napsat zprávu…',send:'Odeslat',older:'Načíst starší',empty:'Zatím zde nejsou žádné zprávy.',today:'Dnes',yesterday:'Včera',newMessages:'Nové zprávy',scrollNew:'Nové zprávy',delete:'Smazat',typing:'píše…',delivered:'Doručeno',read:'Přečteno'},
  en:{title:'Company chat',subtitle:'Shared chat for the whole team',online:'online',placeholder:'Write a message…',send:'Send',older:'Load older',empty:'No messages yet.',today:'Today',yesterday:'Yesterday',newMessages:'New messages',scrollNew:'New messages',delete:'Delete',typing:'is typing…',delivered:'Delivered',read:'Read'},
};

function localeFor(language){return language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA'}
function formatTime(value, language){return new Intl.DateTimeFormat(localeFor(language),{hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
function dayKey(value){const date=new Date(value);return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
function formatDay(value, language, c){
  const date=new Date(value);const today=new Date();const yesterday=new Date();yesterday.setDate(today.getDate()-1);
  if(dayKey(date)===dayKey(today))return c.today;
  if(dayKey(date)===dayKey(yesterday))return c.yesterday;
  return new Intl.DateTimeFormat(localeFor(language),{day:'numeric',month:'long',year:date.getFullYear()===today.getFullYear()?undefined:'numeric'}).format(date);
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
  const {data:summary}=useGetChatSummaryQuery(undefined,{pollingInterval:30000});
  const {data:presence}=useGetChatPresenceQuery(undefined,{pollingInterval:30000});
  const {data:readStateData}=useGetChatReadStatesQuery(undefined,{pollingInterval:30000});
  const [loadOlder,{isFetching:loadingOlder}]=useLazyGetChatMessagesQuery();
  const [sendMessage,sendState]=useSendChatMessageMutation();
  const [sendTyping]=useSendChatTypingMutation();
  const [markRead]=useMarkChatReadMutation();
  const [deleteMessage]=useDeleteChatMessageMutation();
  const [text,setText]=useState('');
  const [older,setOlder]=useState([]);
  const [showNewMessages,setShowNewMessages]=useState(false);
  const [typingUsers,setTypingUsers]=useState({});
  const [liveReadStates,setLiveReadStates]=useState({});
  const listRef=useRef(null);
  const initialReadAtRef=useRef(null);
  const capturedInitialReadRef=useRef(false);
  const didInitialScrollRef=useRef(false);
  const nearBottomRef=useRef(true);
  const typingStopTimerRef=useRef(null);
  const lastTypingSentRef=useRef(0);
  const typingExpiryTimersRef=useRef(new Map());
  const latest=data?.messages||[];
  const onlineCount=Math.max(0,Number(presence?.onlineCount)||0);
  const typingList=Object.values(typingUsers);
  const typingLabel=typingList.length?`${typingList.slice(0,2).map(item=>item.name).join(', ')} ${c.typing}`:'';
  const subtitle=typingLabel||(?:onlineCount>0?`${c.subtitle} · ${onlineCount} ${c.online}`:c.subtitle);
  const messages=useMemo(()=>{
    const map=new Map();
    [...older,...latest].forEach(item=>map.set(item.id,item));
    return [...map.values()].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  },[older,latest]);

  const readStates=useMemo(()=>{
    const map={};
    for(const state of readStateData?.states||[])map[state.membershipId]=state.lastReadAt;
    return {...map,...liveReadStates};
  },[readStateData?.states,liveReadStates]);

  if(!capturedInitialReadRef.current&&summary){
    initialReadAtRef.current=summary.lastReadAt||'';
    capturedInitialReadRef.current=true;
  }

  const firstUnreadId=useMemo(()=>{
    if(!capturedInitialReadRef.current||!Number(summary?.unreadCount||0))return '';
    const lastRead=initialReadAtRef.current?new Date(initialReadAtRef.current).getTime():0;
    return messages.find(item=>item.authorMembershipId!==membershipId&&new Date(item.createdAt).getTime()>lastRead)?.id||'';
  },[messages,membershipId,summary?.unreadCount]);

  useEffect(()=>{
    const timers=typingExpiryTimersRef.current;
    function handleLive(event){
      const detail=event.detail||{};
      const payload=detail.payload||{};
      if(detail.event==='typing'&&payload.membershipId&&payload.membershipId!==membershipId){
        const id=payload.membershipId;
        const previous=timers.get(id);if(previous)window.clearTimeout(previous);
        if(payload.typing){
          setTypingUsers(current=>({...current,[id]:{name:payload.name||'User'}}));
          timers.set(id,window.setTimeout(()=>{
            setTypingUsers(current=>{const next={...current};delete next[id];return next;});
            timers.delete(id);
          },4000));
        }else{
          setTypingUsers(current=>{const next={...current};delete next[id];return next;});
          timers.delete(id);
        }
      }
      if(detail.event==='read'&&payload.membershipId&&payload.membershipId!==membershipId&&payload.lastReadAt){
        setLiveReadStates(current=>({...current,[payload.membershipId]:payload.lastReadAt}));
      }
    }
    window.addEventListener('worktrack:chat-live',handleLive);
    return()=>{
      window.removeEventListener('worktrack:chat-live',handleLive);
      for(const timer of timers.values())window.clearTimeout(timer);
      timers.clear();
    };
  },[membershipId]);

  useEffect(()=>()=>{
    if(typingStopTimerRef.current)window.clearTimeout(typingStopTimerRef.current);
    void sendTyping({typing:false});
  },[sendTyping]);

  function markLatestRead(){
    const newest=latest[latest.length-1];
    if(newest?.createdAt)void markRead({readAt:newest.createdAt});
  }

  function scrollToBottom(behavior='smooth'){
    const el=listRef.current;if(!el)return;
    el.scrollTo({top:el.scrollHeight,behavior});
    nearBottomRef.current=true;
    setShowNewMessages(false);
    markLatestRead();
  }

  useEffect(()=>{
    const el=listRef.current;if(!el||!latest.length)return;
    if(!didInitialScrollRef.current){
      didInitialScrollRef.current=true;
      requestAnimationFrame(()=>scrollToBottom('auto'));
      return;
    }
    const newest=latest[latest.length-1];
    if(nearBottomRef.current){requestAnimationFrame(()=>scrollToBottom('smooth'));}
    else if(newest?.authorMembershipId!==membershipId){setShowNewMessages(true);}
  },[latest.length,membershipId]);

  function handleScroll(){
    const el=listRef.current;if(!el)return;
    const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<120;
    nearBottomRef.current=nearBottom;
    if(nearBottom){setShowNewMessages(false);markLatestRead();}
  }

  function handleTextChange(event){
    const value=event.target.value;
    setText(value);
    if(typingStopTimerRef.current)window.clearTimeout(typingStopTimerRef.current);
    const now=Date.now();
    if(value.trim()&&now-lastTypingSentRef.current>1500){
      lastTypingSentRef.current=now;
      void sendTyping({typing:true});
    }
    typingStopTimerRef.current=window.setTimeout(()=>{
      void sendTyping({typing:false});
      lastTypingSentRef.current=0;
    },2500);
  }

  async function submit(event){
    event.preventDefault();
    const body=text.trim();
    if(!body||sendState.isLoading)return;
    if(typingStopTimerRef.current)window.clearTimeout(typingStopTimerRef.current);
    void sendTyping({typing:false});
    lastTypingSentRef.current=0;
    setText('');
    try{await sendMessage({body,clientMessageId:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`}).unwrap();requestAnimationFrame(()=>scrollToBottom('smooth'));}
    catch{setText(body)}
  }

  async function loadMore(){
    const first=messages[0];
    if(!first?.createdAt)return;
    const el=listRef.current;const previousHeight=el?.scrollHeight||0;
    const result=await loadOlder({before:first.createdAt,limit:50}).unwrap();
    setOlder(current=>[...(result?.messages||[]),...current]);
    requestAnimationFrame(()=>{if(el)el.scrollTop+=el.scrollHeight-previousHeight;});
  }

  async function remove(item){
    if(item.authorMembershipId!==membershipId&&role!=='MANAGER')return;
    await deleteMessage(item.id).unwrap();
  }

  function isReadByOther(item){
    if(item.authorMembershipId!==membershipId)return false;
    const createdAt=new Date(item.createdAt).getTime();
    return Object.values(readStates).some(value=>new Date(value).getTime()>=createdAt);
  }

  return <section className="companyChat">
    <header className="companyChatHeader"><button type="button" onClick={()=>navigate(-1)} aria-label="Back">‹</button><div><h1>{c.title}</h1><p className={typingLabel?'isTyping':''}>{subtitle}</p></div></header>
    <div className="companyChatMessages" ref={listRef} onScroll={handleScroll}>
      {data?.hasMore||older.length?<button className="companyChatOlder" type="button" onClick={loadMore} disabled={loadingOlder}>{loadingOlder?'…':c.older}</button>:null}
      {isLoading?<p className="companyChatEmpty">…</p>:null}
      {!isLoading&&!messages.length?<p className="companyChatEmpty">{c.empty}</p>:null}
      {messages.map((item,index)=>{const mine=item.authorMembershipId===membershipId;const previous=messages[index-1];const showDay=!previous||dayKey(previous.createdAt)!==dayKey(item.createdAt);const read=mine&&isReadByOther(item);return <Fragment key={item.id}>
        {showDay?<div className="companyChatDay"><span>{formatDay(item.createdAt,language,c)}</span></div>:null}
        {item.id===firstUnreadId?<div className="companyChatUnread"><span>{c.newMessages}</span></div>:null}
        <article className={`companyChatMessage${mine?' isMine':''}`}>
          {!mine?<div className="companyChatAvatar">{item.author?.avatarDataUrl?<img src={item.author.avatarDataUrl} alt=""/>:<span>{initials(item.author?.name)}</span>}</div>:null}
          <div className="companyChatBubble">
            {!mine?<strong>{item.author?.name||'-'}</strong>:null}
            <p>{item.body}</p>
            <footer><time>{formatTime(item.createdAt,language)}</time>{mine?<span className={`companyChatReceipt${read?' isRead':''}`} title={read?c.read:c.delivered} aria-label={read?c.read:c.delivered}>{read?'✓✓':'✓'}</span>:null}{mine||role==='MANAGER'?<button type="button" onClick={()=>remove(item)}>{c.delete}</button>:null}</footer>
          </div>
        </article>
      </Fragment>})}
    </div>
    {showNewMessages?<button className="companyChatNewButton" type="button" onClick={()=>scrollToBottom('smooth')}>↓ {c.scrollNew}</button>:null}
    <form className="companyChatComposer" onSubmit={submit}><textarea rows="1" maxLength="4000" value={text} onChange={handleTextChange} placeholder={c.placeholder}/><button type="submit" disabled={!text.trim()||sendState.isLoading}>{sendState.isLoading?'…':c.send}</button></form>
  </section>;
}
