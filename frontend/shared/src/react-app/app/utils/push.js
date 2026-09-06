export const pushSupported=()=>typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
export const isIos=()=>typeof navigator!=='undefined'&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1));
export const isStandalone=()=>typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true);
export function applicationServerKey(value){const padding='='.repeat((4-(value.length%4))%4),raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,char=>char.charCodeAt(0))}
