import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetOrderQuery } from '../../features/orders/ordersApi.js';
import { HistoryDisplayScreen } from './components/HistoryDisplayScreen/HistoryDisplayScreen.jsx';
import './HistoryDisplayPage.css';

const THEME_PRESETS = [
  {
    id: 'clean',
    label: 'Clean',
    swatch: '#eef3ff',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,246,255,0.96))',
    text: '#0f172a',
    secondary: 'rgba(15, 23, 42, 0.58)',
    accent: '#0f62fe',
  },
  {
    id: 'warm',
    label: 'Warm',
    swatch: '#f8e9d1',
    background: 'linear-gradient(180deg, rgba(255,248,239,0.99), rgba(255,241,218,0.96))',
    text: '#1f2937',
    secondary: 'rgba(82, 84, 90, 0.72)',
    accent: '#c77a00',
  },
  {
    id: 'cool',
    label: 'Cool',
    swatch: '#dfe8ff',
    background: 'linear-gradient(180deg, rgba(241,247,255,0.99), rgba(226,236,255,0.96))',
    text: '#0f172a',
    secondary: 'rgba(15, 23, 42, 0.58)',
    accent: '#1e6bff',
  },
  {
    id: 'night',
    label: 'Night',
    swatch: '#d9defd',
    background: 'linear-gradient(180deg, rgba(18,22,35,0.98), rgba(34,42,69,0.96))',
    text: '#f8fbff',
    secondary: 'rgba(226, 232, 240, 0.72)',
    accent: '#7ea2ff',
  },
  {
    id: 'mint',
    label: 'Mint',
    swatch: '#dff5eb',
    background: 'linear-gradient(180deg, rgba(245,255,251,0.99), rgba(224,246,236,0.96))',
    text: '#102a22',
    secondary: 'rgba(16, 42, 34, 0.58)',
    accent: '#1a8f67',
  },
];

const TEXT_SIZES = {
  compact: 'compact',
  small: 'small',
  medium: 'medium',
  large: 'large',
  huge: 'huge',
};

export function HistoryDisplayPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { t } = useI18n();
  const [themeId, setThemeId] = useState('clean');
  const [textSize, setTextSize] = useState('large');
  const { data, isLoading, isError } = useGetOrderQuery(orderId, {
    skip: !orderId,
  });

  const order = data?.order || data || {};
  const customerName = order?.contractData?.customer?.name || order?.customer?.name || t('history.guest');

  const theme = useMemo(() => {
    return THEME_PRESETS.find(item => item.id === themeId) || THEME_PRESETS[0];
  }, [themeId]);

  if (!orderId) {
    return <Navigate to="/history" replace />;
  }

  function handleBack() {
    navigate('/history', { replace: true });
  }

  return (
    <section className="historyDisplayPage" style={{ '--display-bg': theme.background, '--display-text': theme.text, '--display-secondary': theme.secondary, '--display-accent': theme.accent }}>
      <HistoryDisplayScreen
        customerName={customerName}
        isLoading={isLoading}
        isError={isError}
        themeId={theme.id}
        themeOptions={THEME_PRESETS}
        textSize={TEXT_SIZES[textSize]}
        textSizeOptions={[
          { id: 'compact', label: t('history.compact') },
          { id: 'small', label: t('history.small') },
          { id: 'medium', label: t('history.medium') },
          { id: 'large', label: t('history.large') },
          { id: 'huge', label: t('history.huge') },
        ]}
        onThemeChange={setThemeId}
        onTextSizeChange={setTextSize}
        onBack={handleBack}
      />
    </section>
  );
}
