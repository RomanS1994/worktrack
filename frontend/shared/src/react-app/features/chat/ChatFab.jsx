import { useLocation, useNavigate } from 'react-router-dom';
import { useGetChatSummaryQuery } from './chatApi.js';
import './ChatFab.css';

export function ChatFab() {
  const location = useLocation();
  const navigate = useNavigate();
  const hidden = ['/chat', '/sign-in', '/register'].includes(location.pathname);
  const { data } = useGetChatSummaryQuery(undefined, { skip: hidden, pollingInterval: 15000 });
  if (hidden) return null;
  const unread = Math.max(0, Number(data?.unreadCount || 0));
  return (
    <button className="chatFab" type="button" onClick={() => navigate('/chat')} aria-label="Chat">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2.5 5.5h9M7.5 13h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      {unread > 0 ? <span>{unread > 99 ? '99+' : unread}</span> : null}
    </button>
  );
}
