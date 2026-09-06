import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useDeletePushSubscriptionMutation,
  useGetPushSettingsQuery,
  useSavePushSubscriptionMutation,
} from '../../features/worktrack/worktrackApi.js';
import './NotificationSettingsPage.css';

const STORAGE_KEY = 'worktrack.pushPreferences.v1';
const DEFAULT_PREFERENCES = {
  categories: { hours: true, finance: true, chat: true, team: true, system: true },
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
};

const COPY = {
  uk: {
    title: 'Сповіщення',
    subtitle: 'Керуйте push-сповіщеннями, щоб отримувати лише важливу інформацію.',
    master: 'Сповіщення',
    masterOn: 'Push-сповіщення увімкнено на цьому пристрої.',
    masterOff: 'Отримуйте важливі повідомлення, навіть коли WorkTrack закритий.',
    enable: 'Увімкнути',
    disable: 'Вимкнути',
    types: 'Типи сповіщень',
    hours: 'Робочі години',
    hoursCopy: 'Подання, погодження, відхилення',
    finance: 'Фактури та виплати',
    financeCopy: 'Нові фактури, зміна статусу, виплати',
    chat: 'Повідомлення в чаті',
    chatCopy: 'Нові повідомлення в команді',
    team: 'Команда',
    teamCopy: 'Нові години на погодження та зміни команди',
    system: 'Системні оновлення',
    systemCopy: 'Важливі повідомлення від WorkTrack',
    quiet: 'Тихий режим',
    quietCopy: 'Не надсилати push-сповіщення у вибраний час.',
    start: 'Початок',
    end: 'Кінець',
    test: 'Тестове сповіщення',
    testCopy: 'Надіслати тестове push-сповіщення на цей пристрій.',
    send: 'Надіслати',
    sent: 'Тестове сповіщення надіслано.',
    working: 'Зачекайте…',
    unsupported: 'Цей браузер не підтримує push-сповіщення.',
    install: 'На iPhone відкрийте WorkTrack з ярлика на Початковому екрані, щоб увімкнути push-сповіщення.',
    denied: 'Доступ до сповіщень заблоковано. Дозвольте їх для WorkTrack у налаштуваннях iPhone.',
  },
  cs: {
    title: 'Oznámení',
    subtitle: 'Nastavte si push oznámení tak, abyste dostávali jen důležité informace.',
    master: 'Oznámení',
    masterOn: 'Push oznámení jsou na tomto zařízení zapnutá.',
    masterOff: 'Dostávejte důležité informace, i když je WorkTrack zavřený.',
    enable: 'Zapnout',
    disable: 'Vypnout',
    types: 'Typy oznámení',
    hours: 'Pracovní hodiny',
    hoursCopy: 'Odeslání, schválení a zamítnutí',
    finance: 'Faktury a platby',
    financeCopy: 'Nové faktury, změny stavu a platby',
    chat: 'Zprávy v chatu',
    chatCopy: 'Nové zprávy v týmu',
    team: 'Tým',
    teamCopy: 'Nové výkazy ke schválení a změny týmu',
    system: 'Systémová oznámení',
    systemCopy: 'Důležité zprávy od WorkTrack',
    quiet: 'Tichý režim',
    quietCopy: 'Ve zvoleném čase neposílat push oznámení.',
    start: 'Začátek',
    end: 'Konec',
    test: 'Testovací oznámení',
    testCopy: 'Odeslat testovací push oznámení na toto zařízení.',
    send: 'Odeslat',
    sent: 'Testovací oznámení bylo odesláno.',
    working: 'Čekejte…',
    unsupported: 'Tento prohlížeč nepodporuje push oznámení.',
    install: 'Na iPhonu otevřete WorkTrack z ikony na ploše, abyste mohli zapnout push oznámení.',
    denied: 'Oznámení jsou zablokována. Povolte je pro WorkTrack v nastavení iPhonu.',
  },
  en: {
    title: 'Notifications',
    subtitle: 'Control push notifications so you only receive important updates.',
    master: 'Notifications',
    masterOn: 'Push notifications are enabled on this device.',
    masterOff: 'Receive important updates even when WorkTrack is closed.',
    enable: 'Enable',
    disable: 'Disable',
    types: 'Notification types',
    hours: 'Work hours',
    hoursCopy: 'Submissions, approvals and rejections',
    finance: 'Invoices and payments',
    financeCopy: 'New invoices, status changes and payments',
    chat: 'Chat messages',
    chatCopy: 'New team messages',
    team: 'Team',
    teamCopy: 'New approvals and team changes',
    system: 'System updates',
    systemCopy: 'Important messages from WorkTrack',
    quiet: 'Quiet hours',
    quietCopy: 'Do not show push notifications during the selected time.',
    start: 'Start',
    end: 'End',
    test: 'Test notification',
    testCopy: 'Send a test push notification to this device.',
    send: 'Send',
    sent: 'Test notification sent.',
    working: 'Please wait…',
    unsupported: 'This browser does not support push notifications.',
    install: 'On iPhone, open WorkTrack from its Home Screen icon to enable push notifications.',
    denied: 'Notifications are blocked. Allow them for WorkTrack in iPhone settings.',
  },
};

function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function isIos() {
  return typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
}

function isStandalone() {
  return typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
}

function applicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function readPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFERENCES;
    return {
      categories: { ...DEFAULT_PREFERENCES.categories, ...(parsed.categories || {}) },
      quietHours: { ...DEFAULT_PREFERENCES.quietHours, ...(parsed.quietHours || {}) },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

async function syncPreferencesToWorker(preferences) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const worker = registration?.active || registration?.waiting || registration?.installing;
  worker?.postMessage({ type: 'WORKTRACK_PUSH_PREFERENCES', preferences });
}

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button className={`notificationToggle${checked ? ' is-on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

function CategoryRow({ icon, tone, title, copy, checked, disabled, onChange }) {
  return (
    <div className="notificationCategoryRow">
      <span className={`notificationSettingsIcon notificationSettingsIcon--${tone}`} aria-hidden="true">{icon}</span>
      <span className="notificationCategoryText"><strong>{title}</strong><small>{copy}</small></span>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} label={title} />
    </div>
  );
}

export function NotificationSettingsPage() {
  const navigate = useNavigate();
  const { language } = useI18n();
  const c = COPY[language] || COPY.uk;
  const canPush = pushSupported();
  const pushSettings = useGetPushSettingsQuery(undefined, { skip: !canPush });
  const [savePush, saveState] = useSavePushSubscriptionMutation();
  const [deletePush, deleteState] = useDeletePushSubscriptionMutation();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [preferences, setPreferences] = useState(readPreferences);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = saveState.isLoading || deleteState.isLoading;

  useEffect(() => {
    let active = true;
    if (!canPush) return undefined;
    navigator.serviceWorker.getRegistration('/').then(async registration => {
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (active) setPushEnabled(Boolean(subscription));
    }).catch(() => { if (active) setPushEnabled(false); });
    return () => { active = false; };
  }, [canPush]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    syncPreferencesToWorker(preferences).catch(() => {});
  }, [preferences]);

  const status = useMemo(() => {
    if (!canPush) return c.unsupported;
    if (isIos() && !isStandalone()) return c.install;
    if (Notification.permission === 'denied') return c.denied;
    return pushEnabled ? c.masterOn : c.masterOff;
  }, [c, canPush, pushEnabled]);

  async function enablePush() {
    setError(''); setNotice('');
    if (!canPush) { setError(c.unsupported); return; }
    if (isIos() && !isStandalone()) { setError(c.install); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setError(c.denied); return; }
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const publicKey = pushSettings.data?.publicKey;
        if (!publicKey) throw new Error('Push key unavailable');
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
      }
      await savePush(subscription.toJSON()).unwrap();
      setPushEnabled(true);
      await syncPreferencesToWorker(preferences);
      await pushSettings.refetch();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  async function disablePush() {
    setError(''); setNotice('');
    if (!canPush) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription) {
        await deletePush({ endpoint: subscription.endpoint }).unwrap();
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
      await pushSettings.refetch();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  function updateCategory(key, value) {
    setPreferences(current => ({ ...current, categories: { ...current.categories, [key]: value } }));
  }

  function updateQuiet(patch) {
    setPreferences(current => ({ ...current, quietHours: { ...current.quietHours, ...patch } }));
  }

  async function sendTestNotification() {
    setError(''); setNotice('');
    try {
      if (!canPush || Notification.permission !== 'granted') throw new Error(status);
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) throw new Error(c.unsupported);
      await registration.showNotification('WorkTrack', {
        body: language === 'cs' ? 'Testovací oznámení funguje správně.' : language === 'en' ? 'Test notification is working correctly.' : 'Тестове сповіщення працює правильно.',
        icon: '/shared/assets/worktrack-icon-192.png',
        badge: '/shared/assets/worktrack-icon-192.png',
        tag: 'worktrack-test-notification',
        data: { href: '/more' },
      });
      setNotice(c.sent);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  const categoriesDisabled = !pushEnabled;

  return (
    <section className="notificationSettingsPage pageStack">
      <header className="notificationSettingsHeader appTop">
        <BackButton onClick={() => navigate('/more')} />
        <div className="appTitleBlock"><h1>{c.title}</h1><p>{c.subtitle}</p></div>
      </header>

      <section className="notificationSettingsCard notificationMasterCard">
        <span className="notificationSettingsIcon notificationSettingsIcon--master" aria-hidden="true">♧</span>
        <span className="notificationCategoryText"><strong>{c.master}</strong><small>{status}</small></span>
        <Toggle checked={pushEnabled} disabled={busy || !canPush} onChange={value => value ? enablePush() : disablePush()} label={c.master} />
      </section>

      <div className="notificationSettingsSection">
        <h2>{c.types}</h2>
        <section className="notificationSettingsCard notificationCategoryList">
          <CategoryRow icon="◷" tone="hours" title={c.hours} copy={c.hoursCopy} checked={preferences.categories.hours} disabled={categoriesDisabled} onChange={value => updateCategory('hours', value)} />
          <CategoryRow icon="▤" tone="finance" title={c.finance} copy={c.financeCopy} checked={preferences.categories.finance} disabled={categoriesDisabled} onChange={value => updateCategory('finance', value)} />
          <CategoryRow icon="☵" tone="chat" title={c.chat} copy={c.chatCopy} checked={preferences.categories.chat} disabled={categoriesDisabled} onChange={value => updateCategory('chat', value)} />
          <CategoryRow icon="♧" tone="team" title={c.team} copy={c.teamCopy} checked={preferences.categories.team} disabled={categoriesDisabled} onChange={value => updateCategory('team', value)} />
          <CategoryRow icon="⚙" tone="system" title={c.system} copy={c.systemCopy} checked={preferences.categories.system} disabled={categoriesDisabled} onChange={value => updateCategory('system', value)} />
        </section>
      </div>

      <section className="notificationSettingsCard notificationQuietCard">
        <div className="notificationQuietHeader">
          <span className="notificationSettingsIcon notificationSettingsIcon--quiet" aria-hidden="true">☾</span>
          <span className="notificationCategoryText"><strong>{c.quiet}</strong><small>{c.quietCopy}</small></span>
          <Toggle checked={preferences.quietHours.enabled} disabled={categoriesDisabled} onChange={value => updateQuiet({ enabled: value })} label={c.quiet} />
        </div>
        <div className="notificationQuietTimes">
          <label><span>{c.start}</span><input type="time" value={preferences.quietHours.start} disabled={!pushEnabled || !preferences.quietHours.enabled} onChange={event => updateQuiet({ start: event.target.value })} /></label>
          <label><span>{c.end}</span><input type="time" value={preferences.quietHours.end} disabled={!pushEnabled || !preferences.quietHours.enabled} onChange={event => updateQuiet({ end: event.target.value })} /></label>
        </div>
      </section>

      <section className="notificationSettingsCard notificationTestCard">
        <span className="notificationSettingsIcon notificationSettingsIcon--test" aria-hidden="true">➤</span>
        <span className="notificationCategoryText"><strong>{c.test}</strong><small>{c.testCopy}</small></span>
        <button className="notificationTestButton" type="button" onClick={sendTestNotification} disabled={!pushEnabled}>{c.send}</button>
      </section>

      {notice ? <p className="notificationSettingsNotice is-success">{notice}</p> : null}
      {error ? <p className="notificationSettingsNotice is-error">{error}</p> : null}
    </section>
  );
}
