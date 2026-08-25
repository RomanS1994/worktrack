import { Link } from 'react-router-dom';
import { baseApi } from '../../api/baseApi.js';
import { SvgIcon } from '../SvgIcon/SvgIcon.jsx';
import './NotificationBell.css';

const notificationBellApi=baseApi.injectEndpoints({
 endpoints:builder=>({getNotificationBellSummary:builder.query({query:()=>'/notifications',providesTags:[{type:'Notifications',id:'LIST'}]})})
});
const {useGetNotificationBellSummaryQuery}=notificationBellApi;

export function NotificationBell(){
 const {data}=useGetNotificationBellSummaryQuery(undefined,{pollingInterval:60000});
 const unread=Number(data?.unreadCount||0);
 return <Link className="notificationBell" to="/notifications" aria-label="Notifications">
  <SvgIcon name="check-circle" />
  {unread?<b>{unread>99?'99+':unread}</b>:null}
 </Link>;
}
