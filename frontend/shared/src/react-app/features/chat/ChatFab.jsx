import { useLocation, useNavigate } from 'react-router-dom';
import { useGetChatSummaryQuery, useMarkChatReadMutation } from './chatApi.js';
import './ChatFab.css';

export function ChatFab() {
  const location = useLocation();
  const navigate = useNavigate();
  const hidden = ['/chat', '/sign-in', '/register'].includes(location.pathname);
  const { data } = useGetChatSummaryQuery(undefined, {
    skip: hidden,
    pollingInterval: 15000,
    refetchOnMountOrArgChange: true,
  });
  const [markRead] = useMarkChatReadMutation();

  if (hidden) return null;

  const unread = Math.max(0, Number(data?.unreadCount || 0));

  function openChat() {
    if (unread > 0) {
      void markRead({});
    }
    navigate('/chat');
  }

  return (
    <button className="chatFab" type="button" onClick={openChat} aria-label="Chat">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.8 5.25h10.4A2.55 2.55 0 0 1 19.75 7.8v6.35a2.55 2.55 0 0 1-2.55 2.55h-5.55l-4.4 3.05.85-3.05H6.8a2.55 2.55 0 0 1-2.55-2.55V7.8A2.55 2.55 0 0 1 6.8 5.25Z" fill="none" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {unread > 0 ? <span>{unread > 99 ? '99+' : unread}</span> : null}
    </button>
  );
}
