import { useLocation, useNavigate } from 'react-router-dom';
import { useGetChatSummaryQuery } from './chatApi.js';
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

  if (hidden) return null;

  const unread = Math.max(0, Number(data?.unreadCount || 0));

  return (
    <button className="chatFab" type="button" onClick={() => navigate('/chat')} aria-label="Chat">
      <svg className="chatFabIcon" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8.2 6.8h15.6A4.2 4.2 0 0 1 28 11v8.2a4.2 4.2 0 0 1-4.2 4.2h-8.1L9 27.6l1.35-4.2H8.2A4.2 4.2 0 0 1 4 19.2V11a4.2 4.2 0 0 1 4.2-4.2Z" fill="currentColor"/>
        <circle cx="11.7" cy="15.3" r="1.35" fill="#fff"/>
        <circle cx="16" cy="15.3" r="1.35" fill="#fff"/>
        <circle cx="20.3" cy="15.3" r="1.35" fill="#fff"/>
      </svg>
      {unread > 0 ? <span>{unread > 99 ? '99+' : unread}</span> : null}
    </button>
  );
}
