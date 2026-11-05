import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { getToken } from '@shared/features/auth/authStorage.js';
import { baseApi } from '@shared/app/api/baseApi.js';
import { getChatConnectionState } from '@shared/features/chat/chatConnectionState.js';
import { prepareExpenseReceipt } from '../../features/worktrack/expenseReceipt.js';
import {
  useDeleteChatMessageMutation,
  useGetChatMessagesQuery,
  useGetChatPresenceQuery,
  useGetChatReadStatesQuery,
  useGetChatSummaryQuery,
  useLazyGetChatMessageContextQuery,
  useLazyGetChatMessagesQuery,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
  useUploadChatAttachmentMutation,
  useDeleteChatAttachmentMutation,
  useSendChatTypingMutation,
  useToggleChatReactionMutation,
} from '@shared/features/chat/chatApi.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './ChatPage.css';

const chatRoomsApi=baseApi.injectEndpoints({endpoints:builder=>({
  getChatRooms:builder.query({query:()=>'/chat/rooms',providesTags:[{type:'Notifications',id:'CHAT_ROOMS'}]}),
  getChatMembers:builder.query({query:()=>'/chat/members'}),
  createChatRoom:builder.mutation({query:body=>({url:'/chat/rooms',method:'POST',body}),invalidatesTags:[{type:'Notifications',id:'CHAT_ROOMS'}]}),
})});
const {useGetChatRoomsQuery,useGetChatMembersQuery,useCreateChatRoomMutation}=chatRoomsApi;

const REACTION_EMOJIS=['👍','👎','❤️','🔥','👏','😂','🤣','😊','😍','🥰','😮','🤯','😢','😭','😡','🤔','🙄','🙏','💪','👌','🤝','🎉','🥳','💯','✅','❌','⭐','🚀','👀','🤦'];
const QUICK_REACTIONS=['👍','❤️','😂','🔥','👏','😮','🙏'];
const ACTION_QUICK_REACTIONS=['👍','❤️','😂','😮','😢','😡'];
const GROUP_WINDOW_MS=5*60*1000;
const RETAINED_OLDER_MESSAGES=200;
const READ_VISIBILITY_RATIO=.6;
const READ_SETTLE_MS=180;
const LONG_PRESS_MOVE_TOLERANCE=10;
const CHAT_CONTEXT_REQUEST_TIMEOUT_MS=10000;
const CHAT_ATTACHMENT_SOURCE_MAX_BYTES=20*1024*1024;
const CHAT_ATTACHMENT_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const COPY={
  uk:{back:'Назад',title:'Чат компанії',subtitle:'Спільний чат для всієї команди',online:'онлайн',placeholder:'Написати повідомлення…',send:'Надіслати',older:'Завантажити старіші',empty:'Поки що повідомлень немає.',linkUnavailable:'Не вдалося відкрити це повідомлення. Можливо, його видалили.',today:'Сьогодні',yesterday:'Вчора',newMessages:'Нові повідомлення',scrollNew:'Нові повідомлення',delete:'Видалити',deleteConfirm:'Видалити повідомлення?',deleteConfirmCopy:'Цю дію неможливо скасувати.',cancel:'Скасувати',typing:'друкує…',delivered:'Доставлено',read:'Прочитано',reply:'Відповісти',replyingTo:'Відповідь',cancelReply:'Скасувати відповідь',deletedMessage:'Повідомлення видалено',reaction:'Поставити реакцію',reactions:'Реакції',reactedBy:'Поставили реакцію',close:'Закрити',actions:'Дії з повідомленням',copy:'Копіювати',sendFailed:'Не вдалося надіслати',retry:'Повторити',connecting:'Підключення…',reconnecting:'Перепідключення…',offline:'Немає мережі',you:'Ви',tapToRemove:'Торкніться, щоб вилучити',attach:'Додати фото',attachmentTooLarge:'Фото має бути менше 20 МБ; не вдалося стиснути його до 2,5 МБ',attachmentType:'Дозволені формати: JPEG, PNG, WebP',attachmentFailed:'Не вдалося завантажити фото',removeAttachment:'Видалити фото',attachmentOnly:'Фото',attachmentLimit:'Можна додати не більше 5 фото до одного повідомлення',uploading:'Завантаження…'},
  cs:{back:'Zpět',title:'Firemní chat',subtitle:'Společný chat pro celý tým',online:'online',placeholder:'Napsat zprávu…',send:'Odeslat',older:'Načíst starší',empty:'Zatím zde nejsou žádné zprávy.',linkUnavailable:'Tuto zprávu se nepodařilo otevřít. Možná byla smazána.',today:'Dnes',yesterday:'Včera',newMessages:'Nové zprávy',scrollNew:'Nové zprávy',delete:'Smazat',deleteConfirm:'Smazat zprávu?',deleteConfirmCopy:'Tuto akci nelze vrátit zpět.',cancel:'Zrušit',typing:'píše…',delivered:'Doručeno',read:'Přečteno',reply:'Odpovědět',replyingTo:'Odpověď',cancelReply:'Zrušit odpověď',deletedMessage:'Zpráva byla smazána',reaction:'Přidat reakci',reactions:'Reakce',reactedBy:'Reagovali',close:'Zavřít',actions:'Akce zprávy',copy:'Kopírovat',sendFailed:'Zprávu se nepodařilo odeslat',retry:'Zkusit znovu',connecting:'Připojování…',reconnecting:'Obnovování spojení…',offline:'Bez připojení',you:'Vy',tapToRemove:'Klepnutím odeberete',attach:'Přidat fotku',attachmentTooLarge:'Fotka musí mít méně než 20 MB; nepodařilo se ji zmenšit pod 2,5 MB',attachmentType:'Povolené formáty: JPEG, PNG, WebP',attachmentFailed:'Fotku se nepodařilo nahrát',removeAttachment:'Odebrat fotku',attachmentOnly:'Fotka',attachmentLimit:'K jedné zprávě lze přidat nejvýše 5 fotek',uploading:'Nahrávání…'},
  en:{back:'Back',title:'Company chat',subtitle:'Shared chat for the whole team',online:'online',placeholder:'Write a message…',send:'Send',older:'Load older',empty:'No messages yet.',linkUnavailable:'Could not open this message. It may have been deleted.',today:'Today',yesterday:'Yesterday',newMessages:'New messages',scrollNew:'New messages',delete:'Delete',deleteConfirm:'Delete message?',deleteConfirmCopy:'This action cannot be undone.',cancel:'Cancel',typing:'is typing…',delivered:'Delivered',read:'Read',reply:'Reply',replyingTo:'Replying to',cancelReply:'Cancel reply',deletedMessage:'Message deleted',reaction:'Add reaction',reactions:'Reactions',reactedBy:'Reacted by',close:'Close',actions:'Message actions',copy:'Copy',sendFailed:'Failed to send',retry:'Retry',connecting:'Connecting…',reconnecting:'Reconnecting…',offline:'Offline',you:'You',tapToRemove:'Tap to remove',attach:'Add photo',attachmentTooLarge:'Photo must be under 20 MB and compress to 2.5 MB or less',attachmentType:'Allowed formats: JPEG, PNG, WebP',attachmentFailed:'Could not upload photo',removeAttachment:'Remove photo',attachmentOnly:'Photo',attachmentLimit:'You can add up to 5 photos per message',uploading:'Uploading…'},
};

function localeFor(language){return language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA'}
function formatTime(value,language){return new Intl.DateTimeFormat(localeFor(language),{hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
function dayKey(value){const date=new Date(value);return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
function formatDay(value,language,c){const date=new Date(value);const today=new Date();const yesterday=new Date();yesterday.setDate(today.getDate()-1);if(dayKey(date)===dayKey(today))return c.today;if(dayKey(date)===dayKey(yesterday))return c.yesterday;return new Intl.DateTimeFormat(localeFor(language),{day:'numeric',month:'long',year:date.getFullYear()===today.getFullYear()?undefined:'numeric'}).format(date)}
function initials(name){return String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()}
function roomSubtitle(room){const message=room?.lastMessage;const preview=typeof message==='string'?message:typeof message?.body==='string'?message.body:'';return preview.trim()||`${Number(room?.memberCount)||0} учасників`}
function isGroupedWith(previous,item){if(!previous||!item)return false;if(previous.authorMembershipId!==item.authorMembershipId)return false;if(dayKey(previous.createdAt)!==dayKey(item.createdAt))return false;return new Date(item.createdAt).getTime()-new Date(previous.createdAt).getTime()<=GROUP_WINDOW_MS}
function fallbackCopy(value){const textarea=document.createElement('textarea');textarea.value=value;textarea.setAttribute('readonly','');textarea.style.position='fixed';textarea.style.opacity='0';document.body.appendChild(textarea);textarea.select();document.execCommand('copy');textarea.remove()}

function AuthenticatedChatAttachment({attachment,label,retryLabel}){
  const [objectUrl,setObjectUrl]=useState('');
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    let nextUrl='';
    setObjectUrl('');
    setFailed(false);
    const headers=new Headers();
    const token=getToken();
    const apiKey=import.meta.env.VITE_API_KEY;
    if(token)headers.set('Authorization',`Bearer ${token}`);
    if(apiKey)headers.set('X-API-KEY',apiKey);
    fetch(attachment.url,{credentials:'include',headers})
      .then(response=>{if(!response.ok)throw new Error('Attachment request failed');return response.blob()})
      .then(blob=>{if(!active)return;nextUrl=URL.createObjectURL(blob);setObjectUrl(nextUrl)})
      .catch(()=>{if(active)setFailed(true)});
    return()=>{active=false;if(nextUrl)URL.revokeObjectURL(nextUrl)};
  },[attachment.url,attempt]);
  if(failed)return <button type="button" className="companyChatAttachmentRetry" onClick={()=>setAttempt(value=>value+1)}>{label} · {retryLabel}</button>;
  return <a href={objectUrl||undefined} target="_blank" rel="noreferrer" className="companyChatAttachment" aria-label={attachment.fileName||label} onClick={event=>{if(!objectUrl)event.preventDefault()}}><img src={objectUrl||undefined} alt={attachment.fileName||label} loading="lazy"/><span>{attachment.fileName||label}</span></a>;
}

export function ChatPage(){
  const navigate=useNavigate();
  const [searchParams,setSearchParams]=useSearchParams();
  const linkedMessageId=searchParams.get('messageId')||'';
  const activeRoomId=searchParams.get('roomId')||'';
  const chatScreen=searchParams.get('chatView')||'';
  const user=useSelector(selectUser);
  const membershipId=user?.activeMembership?.id||'';
  const role=user?.activeMembership?.role||'';
  const {language}=useI18n();
  const c=COPY[language]||COPY.uk;
  const [connectionState,setConnectionState]=useState(()=>getChatConnectionState());
  const fallbackPolling=30000;
  const pollingInterval=connectionState==='connected'?300000:connectionState==='offline'?0:fallbackPolling;
  const {data:roomsData}=useGetChatRoomsQuery();
  const rooms=roomsData?.rooms||roomsData||[];
  const {data:membersData}=useGetChatMembersQuery(undefined,{skip:chatScreen!=='create'||role!=='MANAGER'});
  const [createChatRoom,{isLoading:creatingRoom}]=useCreateChatRoomMutation();
  const {data,isLoading}=useGetChatMessagesQuery({roomId:activeRoomId,limit:50},{pollingInterval,skip:!activeRoomId});
  const {data:summary}=useGetChatSummaryQuery({roomId:activeRoomId},{pollingInterval,skip:!activeRoomId});
  const {data:presence}=useGetChatPresenceQuery({roomId:activeRoomId},{pollingInterval,skip:!activeRoomId});
  const {data:readStateData}=useGetChatReadStatesQuery({roomId:activeRoomId},{pollingInterval,skip:!activeRoomId});
  const [loadOlder,{isFetching:loadingOlder}]=useLazyGetChatMessagesQuery();
  const [loadContext,{isFetching:loadingContext}]=useLazyGetChatMessageContextQuery();
  const [sendMessage]=useSendChatMessageMutation();
  const [uploadAttachment,{isLoading:uploadingAttachment}]=useUploadChatAttachmentMutation();
  const [deleteAttachment]=useDeleteChatAttachmentMutation();
  const [sendTyping]=useSendChatTypingMutation();
  const [markRead]=useMarkChatReadMutation();
  const [deleteMessage,deleteState]=useDeleteChatMessageMutation();
  const [toggleReaction]=useToggleChatReactionMutation();

  const [text,setText]=useState('');
  const [roomName,setRoomName]=useState('');
  const [selectedMembers,setSelectedMembers]=useState([]);
  const [roomError,setRoomError]=useState('');
  const [attachments,setAttachments]=useState([]);
  const [attachmentError,setAttachmentError]=useState('');
  const fileInputRef=useRef(null);
  const [replyTo,setReplyTo]=useState(null);
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [reactionTarget,setReactionTarget]=useState(null);
  const [reactionDetails,setReactionDetails]=useState(null);
  const [actionTarget,setActionTarget]=useState(null);
  const [older,setOlder]=useState([]);
  const [pendingMessages,setPendingMessages]=useState([]);
  const [hasMoreOlder,setHasMoreOlder]=useState(null);
  const [showNewMessages,setShowNewMessages]=useState(false);
  const [linkUnavailable,setLinkUnavailable]=useState(false);
  const [typingUsers,setTypingUsers]=useState({});
  const [liveReadStates,setLiveReadStates]=useState({});
  const listRef=useRef(null);
  const composerRef=useRef(null);
  const initialReadAtRef=useRef(null);
  const initialUnreadCountRef=useRef(0);
  const capturedInitialReadRef=useRef(false);
  const didInitialScrollRef=useRef(false);
  const nearBottomRef=useRef(true);
  const lastMarkedReadIdRef=useRef('');
  const pendingOlderScrollRef=useRef(null);
  const keepBottomAfterPruneRef=useRef(false);
  const typingStopTimerRef=useRef(null);
  const lastTypingSentRef=useRef(0);
  const typingExpiryTimersRef=useRef(new Map());
  const highlightTimerRef=useRef(null);
  const deepLinkAttemptRef=useRef('');
  const deepLinkRequestRef=useRef(0);
  const contextRequestRef=useRef(null);
  const longPressTimerRef=useRef(null);
  const longPressStartRef=useRef(null);
  const viewportRafRef=useRef(null);
  const pendingReactionIdsRef=useRef(new Set());
  const actionDialogRef=useRef(null);
  const actionRestoreFocusRef=useRef(null);

  const latest=data?.messages||[];
  const newestMessageId=latest[latest.length-1]?.id||'';
  const onlineCount=Math.max(0,Number(presence?.onlineCount)||0);
  const typingList=Object.values(typingUsers);
  const typingLabel=typingList.length?`${typingList.slice(0,2).map(item=>item.name).join(', ')} ${c.typing}`:'';
  const connectionLabel=connectionState==='offline'?c.offline:connectionState==='reconnecting'?c.reconnecting:connectionState==='connecting'?c.connecting:'';
  const subtitle=typingLabel||connectionLabel||(onlineCount>0?`${c.subtitle} · ${onlineCount} ${c.online}`:c.subtitle);
  const messages=useMemo(()=>{const map=new Map();[...older,...pendingMessages,...latest].forEach(item=>{const key=item.clientMessageId?`client:${item.clientMessageId}`:item.id;map.set(key,item)});return [...map.values()].sort((a,b)=>{const timeDiff=new Date(a.createdAt)-new Date(b.createdAt);return timeDiff||String(a.id).localeCompare(String(b.id))})},[older,pendingMessages,latest]);
  const readStates=useMemo(()=>{const map={};for(const state of readStateData?.states||[])map[state.membershipId]=state.lastReadAt;return {...map,...liveReadStates}},[readStateData?.states,liveReadStates]);

  if(!capturedInitialReadRef.current&&summary){initialReadAtRef.current=summary.lastReadAt||'';initialUnreadCountRef.current=Number(summary.unreadCount||0);capturedInitialReadRef.current=true}
  const firstUnreadId=useMemo(()=>{if(!capturedInitialReadRef.current||initialUnreadCountRef.current<=0)return '';const lastRead=initialReadAtRef.current?new Date(initialReadAtRef.current).getTime():0;return messages.find(item=>!item.pending&&item.authorMembershipId!==membershipId&&new Date(item.createdAt).getTime()>lastRead)?.id||''},[messages,membershipId]);

  useEffect(()=>{if(data&&hasMoreOlder===null)setHasMoreOlder(Boolean(data.hasMore))},[data,hasMoreOlder]);
  useEffect(()=>{setOlder([]);setPendingMessages([]);setHasMoreOlder(null);setReplyTo(null);setAttachments([]);setText('');setTypingUsers({});setLiveReadStates({});setShowNewMessages(false);didInitialScrollRef.current=false;lastMarkedReadIdRef.current='';nearBottomRef.current=true},[activeRoomId]);
  useLayoutEffect(()=>{const el=listRef.current;if(!el)return;if(keepBottomAfterPruneRef.current){el.scrollTop=el.scrollHeight;keepBottomAfterPruneRef.current=false;return}const pending=pendingOlderScrollRef.current;if(!pending)return;el.scrollTop=pending.previousTop+(el.scrollHeight-pending.previousHeight);pendingOlderScrollRef.current=null},[older.length]);
  useLayoutEffect(()=>{const el=composerRef.current;if(!el)return;el.style.height='auto';const nextHeight=Math.min(el.scrollHeight,108);el.style.height=`${Math.max(42,nextHeight)}px`;el.style.overflowY=el.scrollHeight>108?'auto':'hidden'},[text]);

  useEffect(()=>{function handleConnection(event){const state=event.detail?.state||getChatConnectionState();setConnectionState(state)}window.addEventListener('worktrack:chat-connection',handleConnection);setConnectionState(getChatConnectionState());return()=>window.removeEventListener('worktrack:chat-connection',handleConnection)},[]);
  useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return undefined;const keepBottomVisible=()=>{if(viewportRafRef.current)window.cancelAnimationFrame(viewportRafRef.current);viewportRafRef.current=window.requestAnimationFrame(()=>{viewportRafRef.current=null;if(!nearBottomRef.current)return;const el=listRef.current;if(el)el.scrollTop=el.scrollHeight})};viewport.addEventListener('resize',keepBottomVisible);return()=>{viewport.removeEventListener('resize',keepBottomVisible);if(viewportRafRef.current)window.cancelAnimationFrame(viewportRafRef.current)}},[]);
  useEffect(()=>{const timers=typingExpiryTimersRef.current;function handleLive(event){const detail=event.detail||{};const payload=detail.payload||{};if(payload.roomId&&payload.roomId!==activeRoomId)return;if(detail.event==='typing'&&payload.membershipId&&payload.membershipId!==membershipId){const id=payload.membershipId;const previous=timers.get(id);if(previous)window.clearTimeout(previous);if(payload.typing){setTypingUsers(current=>({...current,[id]:{name:payload.name||'User'}}));timers.set(id,window.setTimeout(()=>{setTypingUsers(current=>{const next={...current};delete next[id];return next});timers.delete(id)},4000))}else{setTypingUsers(current=>{const next={...current};delete next[id];return next});timers.delete(id)}}if(detail.event==='read'&&payload.membershipId&&payload.membershipId!==membershipId&&payload.lastReadAt)setLiveReadStates(current=>({...current,[payload.membershipId]:payload.lastReadAt}))}window.addEventListener('worktrack:chat-live',handleLive);return()=>{window.removeEventListener('worktrack:chat-live',handleLive);for(const timer of timers.values())window.clearTimeout(timer);timers.clear()}},[membershipId,activeRoomId]);
  useEffect(()=>()=>{if(typingStopTimerRef.current)window.clearTimeout(typingStopTimerRef.current);if(highlightTimerRef.current)window.clearTimeout(highlightTimerRef.current);cancelLongPress();void sendTyping({roomId:activeRoomId,typing:false})},[sendTyping,activeRoomId]);
  useEffect(()=>{if(!deleteTarget&&!reactionDetails&&!actionTarget)return undefined;function handleKey(event){if(event.key!=='Escape')return;if(deleteTarget&&!deleteState.isLoading)setDeleteTarget(null);if(reactionDetails)setReactionDetails(null);if(actionTarget)setActionTarget(null)}window.addEventListener('keydown',handleKey);return()=>window.removeEventListener('keydown',handleKey)},[deleteTarget,deleteState.isLoading,reactionDetails,actionTarget]);
  useEffect(()=>{if(!actionTarget)return undefined;const panel=actionDialogRef.current;if(!panel)return undefined;const focusable=()=>[...panel.querySelectorAll('button:not(:disabled),[href],input:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(element=>element instanceof HTMLElement&&element.getClientRects().length>0);focusable()[0]?.focus();function handleActionKeys(event){if(event.key==='Escape'){event.preventDefault();setActionTarget(null);return}if(event.key!=='Tab')return;const items=focusable();if(!items.length){event.preventDefault();panel.focus();return}const first=items[0];const last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus()}}document.addEventListener('keydown',handleActionKeys);return()=>{document.removeEventListener('keydown',handleActionKeys);const trigger=actionRestoreFocusRef.current;actionRestoreFocusRef.current=null;if(trigger?.isConnected)trigger.focus()}},[Boolean(actionTarget)]);
  useEffect(()=>{if(!reactionTarget)return undefined;function handleOutsidePointer(event){const target=event.target;if(target instanceof Element&&target.closest('.companyChatReactionPicker'))return;setReactionTarget(null)}document.addEventListener('pointerdown',handleOutsidePointer,true);return()=>document.removeEventListener('pointerdown',handleOutsidePointer,true)},[reactionTarget]);
  useEffect(()=>{const root=listRef.current;if(!root||Number(summary?.unreadCount||0)<=0)return undefined;const realMessages=messages.filter(item=>!item.pending);if(!realMessages.length)return undefined;const byId=new Map(realMessages.map(item=>[item.id,item]));if(typeof IntersectionObserver==='undefined'){if(!nearBottomRef.current||!newestMessageId||newestMessageId===lastMarkedReadIdRef.current)return undefined;lastMarkedReadIdRef.current=newestMessageId;void markRead({roomId:activeRoomId,messageId:newestMessageId}).unwrap().catch(()=>{if(lastMarkedReadIdRef.current===newestMessageId)lastMarkedReadIdRef.current=''});return undefined}const visible=new Set();let settleTimer=null;const flush=()=>{settleTimer=null;const candidate=[...visible].map(id=>byId.get(id)).filter(item=>item&&item.authorMembershipId!==membershipId).sort((a,b)=>{const timeDiff=new Date(a.createdAt)-new Date(b.createdAt);return timeDiff||String(a.id).localeCompare(String(b.id))}).at(-1);if(!candidate||candidate.id===lastMarkedReadIdRef.current)return;lastMarkedReadIdRef.current=candidate.id;void markRead({roomId:activeRoomId,messageId:candidate.id}).unwrap().catch(()=>{if(lastMarkedReadIdRef.current===candidate.id)lastMarkedReadIdRef.current=''})};const schedule=()=>{if(settleTimer)window.clearTimeout(settleTimer);settleTimer=window.setTimeout(flush,READ_SETTLE_MS)};const observer=new IntersectionObserver(entries=>{for(const entry of entries){const id=entry.target.dataset.chatMessageId||'';if(!id)continue;if(entry.isIntersecting&&entry.intersectionRatio>=READ_VISIBILITY_RATIO)visible.add(id);else visible.delete(id)}schedule()},{root,threshold:[READ_VISIBILITY_RATIO]});root.querySelectorAll('[data-chat-message-id]').forEach(node=>observer.observe(node));return()=>{observer.disconnect();if(settleTimer)window.clearTimeout(settleTimer)}},[messages,membershipId,newestMessageId,summary?.unreadCount,markRead,activeRoomId]);

  function pruneOlderHistory(){if(older.length<=RETAINED_OLDER_MESSAGES)return;keepBottomAfterPruneRef.current=true;setOlder(current=>current.slice(-RETAINED_OLDER_MESSAGES))}
  function scrollToBottom(behavior='smooth'){const el=listRef.current;if(!el)return;el.scrollTo({top:el.scrollHeight,behavior});nearBottomRef.current=true;setShowNewMessages(false);pruneOlderHistory()}
  useEffect(()=>{const el=listRef.current;if(!el||(!latest.length&&!pendingMessages.length))return;if(!didInitialScrollRef.current){didInitialScrollRef.current=true;requestAnimationFrame(()=>scrollToBottom('auto'));return}const newest=latest[latest.length-1];if(nearBottomRef.current||pendingMessages.length)requestAnimationFrame(()=>scrollToBottom('smooth'));else if(newest?.authorMembershipId!==membershipId)setShowNewMessages(true)},[newestMessageId,membershipId,pendingMessages.length]);

  function handleScroll(){const el=listRef.current;if(!el)return;const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<120;const becameNearBottom=nearBottom&&!nearBottomRef.current;nearBottomRef.current=nearBottom;if(nearBottom){setShowNewMessages(false);if(becameNearBottom)pruneOlderHistory()}if(reactionTarget)setReactionTarget(null);cancelLongPress()}
  function handleTextChange(event){const value=event.target.value;setText(value);if(typingStopTimerRef.current)window.clearTimeout(typingStopTimerRef.current);if(!value.trim()){void sendTyping({roomId:activeRoomId,typing:false});lastTypingSentRef.current=0;return}const now=Date.now();if(now-lastTypingSentRef.current>1500){lastTypingSentRef.current=now;void sendTyping({roomId:activeRoomId,typing:true})}typingStopTimerRef.current=window.setTimeout(()=>{void sendTyping({roomId:activeRoomId,typing:false});lastTypingSentRef.current=0},2500)}
  function beginReply(item){if(item.pending)return;setActionTarget(null);setReactionTarget(null);setReplyTo(item);requestAnimationFrame(()=>composerRef.current?.focus())}
  function focusMessage(messageId){const target=document.getElementById(`chat-message-${messageId}`);if(!target)return false;target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('isHighlighted');if(highlightTimerRef.current)window.clearTimeout(highlightTimerRef.current);highlightTimerRef.current=window.setTimeout(()=>target.classList.remove('isHighlighted'),1300);return true}
  async function scrollToMessage(messageId,isCurrent=()=>true){
    if(focusMessage(messageId))return true
    if(contextRequestRef.current?.abort)contextRequestRef.current.abort()
    const contextRequest=loadContext({messageId,radius:20,roomId:activeRoomId})
    contextRequestRef.current=contextRequest
    let requestTimeoutId=0
    let result
    try{result=await Promise.race([contextRequest.unwrap(),new Promise((_,reject)=>{requestTimeoutId=window.setTimeout(()=>reject(new Error('Chat context request timed out')),CHAT_CONTEXT_REQUEST_TIMEOUT_MS)})])}
    catch{contextRequest.abort?.();return false}
    finally{if(requestTimeoutId)window.clearTimeout(requestTimeoutId);if(contextRequestRef.current===contextRequest)contextRequestRef.current=null}
    if(!isCurrent())return false
    const contextMessages=result?.messages||[]
    if(!contextMessages.length)return false
    setOlder(current=>{const map=new Map();[...current,...contextMessages].forEach(item=>map.set(item.id,item));return [...map.values()]})
    if(result?.hasOlder)setHasMoreOlder(true)
    return new Promise(resolve=>{let frameId=0;let timeoutId=0;let settled=false;const finish=focused=>{if(settled)return;settled=true;if(frameId)window.cancelAnimationFrame(frameId);if(timeoutId)window.clearTimeout(timeoutId);resolve(focused)};const tryFocus=()=>{if(!isCurrent()){finish(false);return}if(focusMessage(messageId)){finish(true);return}frameId=window.requestAnimationFrame(tryFocus)};timeoutId=window.setTimeout(()=>finish(false),2500);tryFocus()})
  }
  useEffect(()=>()=>{deepLinkRequestRef.current+=1;deepLinkAttemptRef.current='';contextRequestRef.current?.abort?.()},[])
  useEffect(()=>{
    if(!linkedMessageId){deepLinkRequestRef.current+=1;deepLinkAttemptRef.current='';contextRequestRef.current?.abort?.();return}
    if(isLoading||!data||deepLinkAttemptRef.current===linkedMessageId)return
    deepLinkAttemptRef.current=linkedMessageId
    setLinkUnavailable(false)
    const requestId=++deepLinkRequestRef.current
    const isCurrent=()=>requestId===deepLinkRequestRef.current
    void new Promise(resolve=>requestAnimationFrame(resolve)).then(async()=>{
      if(!isCurrent())return
      const focused=await scrollToMessage(linkedMessageId,isCurrent)
      if(!isCurrent())return
      setLinkUnavailable(!focused)
      const nextParams=new URLSearchParams(searchParams)
      nextParams.delete('messageId')
      setSearchParams(nextParams,{replace:true})
    })
  },[linkedMessageId,isLoading,data,searchParams,setSearchParams])
  function openMessageActions(item,trigger=document.activeElement){actionRestoreFocusRef.current=trigger instanceof HTMLElement&&trigger!==document.body?trigger:null;setActionTarget({...item,actionReactionsExpanded:false})}
  function openReactionPicker(item){setReactionTarget(current=>current?.id===item.id?null:{...item,expanded:false})}
  function startLongPress(item,event){if(item.pending||event.target.closest('button'))return;cancelLongPress();longPressStartRef.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY};longPressTimerRef.current=window.setTimeout(()=>{setReactionTarget(null);openMessageActions(item);longPressTimerRef.current=null;longPressStartRef.current=null},480)}
  function handleLongPressMove(event){const start=longPressStartRef.current;if(!start||start.pointerId!==event.pointerId)return;const distance=Math.hypot(event.clientX-start.x,event.clientY-start.y);if(distance>LONG_PRESS_MOVE_TOLERANCE)cancelLongPress()}
  function cancelLongPress(){if(longPressTimerRef.current){window.clearTimeout(longPressTimerRef.current);longPressTimerRef.current=null}longPressStartRef.current=null}
  async function copyMessage(item){const value=String(item?.body||'');if(!value)return;try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else fallbackCopy(value)}catch{try{fallbackCopy(value)}catch{}}finally{setActionTarget(null)}}

  async function sendPending(pending){
    setPendingMessages(current=>current.map(item=>item.clientMessageId===pending.clientMessageId?{...item,failed:false}:item));
    try{
      await sendMessage({roomId:activeRoomId,body:pending.body,attachmentIds:(pending.attachments||[]).map(item=>item.id),clientMessageId:pending.clientMessageId,...(pending.replyTo?.id?{replyToMessageId:pending.replyTo.id}:{})}).unwrap();
      setPendingMessages(current=>current.filter(item=>item.clientMessageId!==pending.clientMessageId));
    }catch{
      setPendingMessages(current=>current.map(item=>item.clientMessageId===pending.clientMessageId?{...item,failed:true}:item));
    }
  }
  async function chooseAttachments(event){const files=[...event.target.files||[]];event.target.value='';setAttachmentError('');let selectedCount=attachments.length;for(const file of files){if(selectedCount>=5){setAttachmentError(c.attachmentLimit);break}if(!CHAT_ATTACHMENT_TYPES.has(file.type)){setAttachmentError(c.attachmentType);continue}if(file.size>CHAT_ATTACHMENT_SOURCE_MAX_BYTES){setAttachmentError(c.attachmentTooLarge);continue}try{const prepared=await prepareExpenseReceipt(file);if(!prepared?.dataUrl)throw new Error('compression failed');const result=await uploadAttachment({fileName:prepared.fileName||file.name,dataUrl:prepared.dataUrl}).unwrap();const item=result?.attachment;if(!item?.id)throw new Error('missing attachment');setAttachments(current=>[...current,{...item,previewUrl:item.url||prepared.dataUrl}]);selectedCount+=1}catch(error){setAttachmentError(error?.message==='large'?c.attachmentTooLarge:c.attachmentFailed)}}}
  function removeAttachment(id){setAttachments(current=>current.filter(item=>item.id!==id));void deleteAttachment(id).unwrap().catch(()=>{})}
  async function submit(event){event.preventDefault();const body=text.trim();if((!body&&!attachments.length)||uploadingAttachment)return;if(typingStopTimerRef.current)window.clearTimeout(typingStopTimerRef.current);void sendTyping({roomId:activeRoomId,typing:false});lastTypingSentRef.current=0;const activeReply=replyTo;const selectedAttachments=attachments;const clientMessageId=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;const pending={id:`pending-${clientMessageId}`,clientMessageId,body,attachments:selectedAttachments,createdAt:new Date().toISOString(),authorMembershipId:membershipId,author:{membershipId,name:user?.name||user?.email||'User',role,avatarDataUrl:''},replyTo:activeReply?.id?{id:activeReply.id,body:activeReply.body||'',deleted:false,author:{name:activeReply.author?.name||'-'}}:null,reactions:[],pending:true,failed:false};setText('');setAttachments([]);setReplyTo(null);setPendingMessages(current=>[...current,pending]);requestAnimationFrame(()=>scrollToBottom('smooth'));void sendPending(pending)}
  function retryPending(item){if(!item?.pending||!item.failed)return;void sendPending(item)}
  async function loadMore(){const first=messages.find(item=>!item.pending);if(!first?.id||loadingOlder||hasMoreOlder===false)return;const el=listRef.current;if(el)pendingOlderScrollRef.current={previousHeight:el.scrollHeight,previousTop:el.scrollTop};try{const result=await loadOlder({roomId:activeRoomId,beforeId:first.id,limit:50}).unwrap();setHasMoreOlder(Boolean(result?.hasMore));setOlder(current=>[...(result?.messages||[]),...current])}catch{pendingOlderScrollRef.current=null}}
  function remove(item){if(item.pending)return;if(item.authorMembershipId!==membershipId&&role!=='MANAGER')return;setActionTarget(null);setReactionTarget(null);setDeleteTarget(item)}
  async function confirmDelete(){if(!deleteTarget||deleteState.isLoading)return;const target=deleteTarget;try{await deleteMessage({messageId:target.id,roomId:activeRoomId}).unwrap();if(replyTo?.id===target.id)setReplyTo(null);setDeleteTarget(null)}catch{}}
  async function reactToMessage(messageId,emoji){if(String(messageId).startsWith('pending-')||pendingReactionIdsRef.current.has(messageId))return;pendingReactionIdsRef.current.add(messageId);setActionTarget(null);setReactionTarget(null);try{await toggleReaction({roomId:activeRoomId,messageId,emoji,member:{membershipId,name:user?.name||user?.email||c.you,avatarDataUrl:user?.profile?.avatarDataUrl||''}}).unwrap()}catch{}finally{pendingReactionIdsRef.current.delete(messageId)}}
  function showReactionDetails(reaction){setReactionTarget(null);setReactionDetails({...reaction,members:Array.isArray(reaction.members)?reaction.members:[]})}
  async function removeOwnReaction(){const details=reactionDetails;if(!details?.mine||!details.messageId||pendingReactionIdsRef.current.has(details.messageId))return;pendingReactionIdsRef.current.add(details.messageId);try{await toggleReaction({roomId:activeRoomId,messageId:details.messageId,emoji:details.emoji,member:{membershipId,name:user?.name||user?.email||c.you,avatarDataUrl:user?.profile?.avatarDataUrl||''}}).unwrap();setReactionDetails(null)}catch{}finally{pendingReactionIdsRef.current.delete(details.messageId)}}
  function isReadByOther(item){if(item.pending||item.authorMembershipId!==membershipId)return false;const createdAt=new Date(item.createdAt).getTime();return Object.values(readStates).some(value=>new Date(value).getTime()>=createdAt)}

  const reactionMembers=reactionDetails?.members?.length?reactionDetails.members:(reactionDetails?.names||[]).map((name,index)=>({membershipId:`fallback-${index}`,name,mine:reactionDetails.mine&&index===0,avatarDataUrl:''}));

  useEffect(()=>{if(activeRoomId||!rooms.length||chatScreen==='create'||chatScreen==='rooms')return;const room=rooms.find(item=>item.type==='COMPANY')||rooms[0];if(room?.id){const next=new URLSearchParams(searchParams);next.set('roomId',room.id);next.delete('chatView');setSearchParams(next,{replace:true})}},[activeRoomId,rooms,chatScreen,searchParams,setSearchParams]);
  function showRooms(){const next=new URLSearchParams(searchParams);next.delete('roomId');next.delete('messageId');next.set('chatView','rooms');setSearchParams(next)}
  function showCreate(){const next=new URLSearchParams(searchParams);next.set('chatView','create');next.delete('roomId');setRoomError('');setSearchParams(next)}
  function openRoom(room){if(!room?.id)return;const next=new URLSearchParams(searchParams);next.set('roomId',room.id);next.delete('chatView');setSearchParams(next)}
  async function submitRoom(event){event.preventDefault();const name=roomName.trim();if(!name||!selectedMembers.length)return;setRoomError('');try{const result=await createChatRoom({name,memberIds:selectedMembers}).unwrap();const room=result?.room||result;if(!room?.id)throw new Error('Missing room');setRoomName('');setSelectedMembers([]);openRoom(room)}catch(error){setRoomError(error?.data?.message||'Не вдалося створити чат. Спробуйте ще раз.')}}

  if(chatScreen==='create')return <section className="companyChat companyChatRooms"><header className="companyChatHeader"><button type="button" onClick={showRooms} aria-label="Назад">‹</button><div><h1>Новий чат</h1><p>Створіть групу та додайте працівників</p></div></header><form className="companyChatCreateForm" onSubmit={submitRoom}><label className="companyChatFieldLabel">Назва чату<input autoFocus maxLength="60" value={roomName} onChange={event=>setRoomName(event.target.value)} placeholder="Наприклад, Бригада №2" required/></label><div className="companyChatMembersHeading"><strong>Працівники</strong><span>{selectedMembers.length} обрано</span></div><div className="companyChatMemberList">{(membersData?.members||membersData||[]).filter(member=>member.membershipId!==membershipId).map(member=>{const id=member.membershipId||member.id;const checked=selectedMembers.includes(id);return <label key={id} className="companyChatMemberOption"><span className="companyChatMemberAvatar">{member.avatarDataUrl?<img src={member.avatarDataUrl} alt=""/>:initials(member.name)}</span><span><strong>{member.name||member.email}</strong><small>{member.role==='MANAGER'?'Менеджер':'Працівник'}</small></span><input type="checkbox" checked={checked} onChange={()=>setSelectedMembers(current=>checked?current.filter(value=>value!==id):[...current,id])}/></label>})}</div>{roomError?<p className="companyChatRoomError" role="alert">{roomError}</p>:null}<button className="companyChatCreateButton" type="submit" disabled={creatingRoom||!roomName.trim()||!selectedMembers.length}>{creatingRoom?'Створення…':'Створити чат'}</button></form></section>;
  if(!activeRoomId||chatScreen==='rooms')return <section className="companyChat companyChatRooms"><header className="companyChatHeader"><button type="button" onClick={()=>navigate('/dashboard')} aria-label={c.back}>‹</button><div><h1>Чати</h1><p>Робочі розмови вашої команди</p></div>{role==='MANAGER'?<button className="companyChatNewRoom" type="button" onClick={showCreate} aria-label="Створити чат">＋</button>:null}</header><div className="companyChatRoomList">{rooms.map(room=><button type="button" className="companyChatRoomRow" key={room.id} onClick={()=>openRoom(room)}><span className="companyChatRoomAvatar">{initials(room.name||'Чат')}</span><span className="companyChatRoomCopy"><strong>{room.name||'Чат'}</strong><small>{roomSubtitle(room)}</small></span><span className="companyChatRoomMeta">{room.updatedAt?<time>{formatTime(room.updatedAt,language)}</time>:null}{room.unreadCount>0?<b>{room.unreadCount}</b>:null}</span></button>)}{!rooms.length?<p className="companyChatEmpty">Поки що чатів немає.</p>:null}</div></section>;

  return <section className="companyChat">
    <header className="companyChatHeader"><button type="button" onClick={showRooms} aria-label="До списку чатів">‹</button><div><h1>{rooms.find(room=>String(room.id)===String(activeRoomId))?.name||c.title}</h1><p className={typingLabel?'isTyping':connectionLabel?'isConnectionIssue':''}>{subtitle}</p></div><button className="companyChatRoomSwitch" type="button" onClick={showRooms} aria-label="Список чатів">☷</button>{linkUnavailable?<p className="companyChatLinkNotice" role="status">{c.linkUnavailable}</p>:null}</header>
    <div className="companyChatMessages" ref={listRef} onScroll={handleScroll}>
      {hasMoreOlder!==false&&(data?.hasMore||hasMoreOlder)?<button className="companyChatOlder" type="button" onClick={loadMore} disabled={loadingOlder}>{loadingOlder?'…':c.older}</button>:null}
      {isLoading?<p className="companyChatEmpty">…</p>:null}
      {!isLoading&&!messages.length?<p className="companyChatEmpty">{c.empty}</p>:null}
      {messages.map((item,index)=>{const mine=item.authorMembershipId===membershipId;const previous=messages[index-1];const next=messages[index+1];const groupedPrev=isGroupedWith(previous,item);const groupedNext=isGroupedWith(item,next);const showDay=!previous||dayKey(previous.createdAt)!==dayKey(item.createdAt);const read=mine&&isReadByOther(item);const reactions=item.reactions||[];return <Fragment key={item.id}>
        {showDay?<div className="companyChatDay"><span>{formatDay(item.createdAt,language,c)}</span></div>:null}
        {item.id===firstUnreadId?<div className="companyChatUnread"><span>{c.newMessages}</span></div>:null}
        <article id={`chat-message-${item.id}`} data-chat-message-id={item.pending?undefined:item.id} className={`companyChatMessage${mine?' isMine':''}${item.pending?' isPending':''}${item.failed?' isFailed':''}${groupedPrev?' isGroupedPrev':''}${groupedNext?' isGroupedNext':''}`}>
          {!mine?<div className={`companyChatAvatar${groupedNext?' isHidden':''}`}>{item.author?.avatarDataUrl?<img src={item.author.avatarDataUrl} alt=""/>:<span>{initials(item.author?.name)}</span>}</div>:null}
          <div className="companyChatBubble" onPointerDown={event=>startLongPress(item,event)} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerMove={handleLongPressMove} onDoubleClick={event=>{if(item.pending||event.target.closest('button'))return;openReactionPicker(item)}}>
            {!mine&&!groupedPrev?<strong>{item.author?.name||'-'}</strong>:null}
            {item.replyTo?<button className="companyChatReplyQuote" type="button" disabled={loadingContext} onClick={()=>scrollToMessage(item.replyTo.id)}><strong>{item.replyTo.author?.name||c.replyingTo}</strong><span>{item.replyTo.deleted?c.deletedMessage:item.replyTo.body}</span></button>:null}
            {item.attachments?.length?<div className="companyChatAttachments">{item.attachments.map(attachment=><AuthenticatedChatAttachment key={attachment.id} attachment={attachment} label={c.attachmentFailed} retryLabel={c.retry}/>)}</div>:null}
            {item.body?<p>{item.body}</p>:null}
            {item.pending&&item.failed?<button className="companyChatRetry" type="button" onClick={()=>retryPending(item)}>{c.sendFailed} · {c.retry}</button>:null}
            {reactions.length?<div className="companyChatReactions">{reactions.map(reaction=><button key={reaction.emoji} type="button" className={reaction.mine?'isMine':''} title={reaction.names?.join(', ')||''} onClick={()=>reaction.mine?showReactionDetails(reaction):reactToMessage(item.id,reaction.emoji)}><span>{reaction.emoji}</span><small>{reaction.count}</small></button>)}</div>:null}
            <footer><time>{formatTime(item.createdAt,language)}</time>{mine?<span className={`companyChatReceipt${read?' isRead':''}${item.failed?' isFailed':''}`} title={item.pending?(item.failed?c.sendFailed:''):read?c.read:c.delivered} aria-label={item.pending?(item.failed?c.sendFailed:''):read?c.read:c.delivered}>{item.pending?(item.failed?'!':'…'):read?'✓✓':'✓'}</span>:null}{!item.pending?<button type="button" className="companyChatMessageActionsTrigger" aria-label={`${c.actions}: ${item.author?.name||c.you}`} title={`${c.actions}: ${item.author?.name||c.you}`} onClick={event=>openMessageActions(item,event.currentTarget)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button>:null}{!item.pending?<button type="button" className="companyChatReplyAction" onClick={()=>beginReply(item)}>{c.reply}</button>:null}{!item.pending&&(mine||role==='MANAGER')?<button type="button" onClick={()=>remove(item)}>{c.delete}</button>:null}</footer>
          </div>
          {reactionTarget?.id===item.id?<div className={`companyChatReactionPicker${mine?' isMine':''}${reactionTarget.expanded?' isExpanded':''}`} role="menu" aria-label={c.reaction}>{(reactionTarget.expanded?REACTION_EMOJIS:QUICK_REACTIONS).map(emoji=><button key={emoji} type="button" onClick={()=>reactToMessage(item.id,emoji)}>{emoji}</button>)}{!reactionTarget.expanded?<button type="button" className="companyChatReactionMore" aria-label={c.reactions} onClick={()=>setReactionTarget(current=>current?{...current,expanded:true}:current)}>+</button>:null}</div>:null}
        </article>
      </Fragment>})}
    </div>

    {showNewMessages?<button className="companyChatNewButton" type="button" onClick={()=>scrollToBottom('smooth')}>↓ {c.scrollNew}</button>:null}
    <form className="companyChatComposer" onSubmit={submit}>{replyTo?<div className="companyChatComposerReply"><span><strong>{c.replyingTo}: {replyTo.author?.name||'-'}</strong><small>{replyTo.body}</small></span><button type="button" onClick={()=>setReplyTo(null)} aria-label={c.cancelReply}>×</button></div>:null}{attachments.length?<div className="companyChatAttachmentQueue">{attachments.map(item=><div key={item.id} className="companyChatAttachmentPreview"><img src={item.previewUrl} alt={item.fileName||c.attachmentOnly}/><button type="button" onClick={()=>removeAttachment(item.id)} aria-label={c.removeAttachment}>×</button><span>{item.fileName}</span></div>)}</div>:null}{attachmentError?<p className="companyChatAttachmentError" role="status">{attachmentError}</p>:null}<input ref={fileInputRef} className="companyChatFileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseAttachments}/><button className="companyChatAttachButton" type="button" aria-label={c.attach} title={c.attach} onClick={()=>fileInputRef.current?.click()} disabled={uploadingAttachment}>{uploadingAttachment?'…':'+'}</button><textarea ref={composerRef} aria-label={c.placeholder} rows="1" maxLength="4000" value={text} onChange={handleTextChange} placeholder={c.placeholder}/><button className="companyChatSendButton" type="submit" aria-label={uploadingAttachment?c.uploading:c.send} title={uploadingAttachment?c.uploading:c.send} disabled={(!text.trim()&&!attachments.length)||uploadingAttachment}>{uploadingAttachment?<span className="companyChatSendLoading">…</span>:<><span className="companyChatSendLabel">{c.send}</span><svg className="companyChatSendIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></>}</button></form>

    {actionTarget?<div className="companyChatActionBackdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setActionTarget(null)}}><div className="companyChatActionPanel" ref={actionDialogRef} role="dialog" aria-modal="true" aria-label={c.actions} tabIndex="-1"><div className={`companyChatActionReactions${actionTarget.actionReactionsExpanded?' isExpanded':''}`} role="menu" aria-label={c.reactions}>{(actionTarget.actionReactionsExpanded?REACTION_EMOJIS:ACTION_QUICK_REACTIONS).map(emoji=><button key={emoji} type="button" aria-label={`${c.reaction} ${emoji}`} onClick={()=>reactToMessage(actionTarget.id,emoji)}>{emoji}</button>)}{!actionTarget.actionReactionsExpanded?<button type="button" className="companyChatActionReactionMore" aria-label={c.reactions} onClick={()=>setActionTarget(current=>current?{...current,actionReactionsExpanded:true}:current)}>+</button>:null}</div><div className="companyChatActionSheet"><button type="button" onClick={()=>beginReply(actionTarget)}>{c.reply}</button><button type="button" onClick={()=>copyMessage(actionTarget)}>{c.copy}</button>{actionTarget.authorMembershipId===membershipId||role==='MANAGER'?<button type="button" className="isDelete" onClick={()=>remove(actionTarget)}>{c.delete}</button>:null}<button type="button" className="isCancel" onClick={()=>setActionTarget(null)}>{c.cancel}</button></div></div></div>:null}

    {deleteTarget?<div className="companyChatDeleteBackdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!deleteState.isLoading)setDeleteTarget(null)}}><div className="companyChatDeleteDialog" role="alertdialog" aria-modal="true" aria-labelledby="chat-delete-title" aria-describedby="chat-delete-copy"><div className="companyChatDeleteIcon" aria-hidden="true">×</div><h2 id="chat-delete-title">{c.deleteConfirm}</h2><p id="chat-delete-copy">{c.deleteConfirmCopy}</p><div className="companyChatDeleteActions"><button type="button" className="isCancel" disabled={deleteState.isLoading} onClick={()=>setDeleteTarget(null)}>{c.cancel}</button><button type="button" className="isDelete" disabled={deleteState.isLoading} onClick={confirmDelete}>{deleteState.isLoading?'…':c.delete}</button></div></div></div>:null}
    {reactionDetails?<div className="companyChatReactionDetailsBackdrop" role="presentation" onPointerDown={event=>{if(event.target===event.currentTarget)setReactionDetails(null)}}><div className="companyChatReactionDetailsSheet" role="dialog" aria-modal="true" aria-label={`${c.reactions}: ${reactionDetails.count||0}`}><div className="companyChatReactionDetailsHandle" aria-hidden="true"/><h2>{c.reactions}: {reactionDetails.count||0}</h2><div className="companyChatReactionDetailsTabs"><span>{reactionDetails.emoji} <strong>{reactionDetails.count||0}</strong></span></div><div className="companyChatReactionPeople">{reactionMembers.map(member=>member.mine?<button key={member.membershipId} type="button" className="isMine" onClick={removeOwnReaction}><span className="companyChatReactionPersonAvatar">{member.avatarDataUrl?<img src={member.avatarDataUrl} alt=""/>:initials(user?.name||user?.email||c.you)}</span><span className="companyChatReactionPersonCopy"><strong>{c.you}</strong><small>{c.tapToRemove}</small></span><span className="companyChatReactionPersonEmoji">{reactionDetails.emoji}</span></button>:<div key={member.membershipId} className="companyChatReactionPerson"><span className="companyChatReactionPersonAvatar">{member.avatarDataUrl?<img src={member.avatarDataUrl} alt=""/>:initials(member.name)}</span><span className="companyChatReactionPersonCopy"><strong>{member.name}</strong></span><span className="companyChatReactionPersonEmoji">{reactionDetails.emoji}</span></div>)}</div></div></div>:null}
  </section>;
}
