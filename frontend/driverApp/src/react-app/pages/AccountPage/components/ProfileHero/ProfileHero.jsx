import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { RequestLoader } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useUpdateProfileMutation } from '@shared/features/auth/authApi.js';
import { selectToken, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import './ProfileHero.css';

function getInitial(user) {
  // Беремо першу букву для простої аватарки.
  const value = user?.name || user?.email || 'D';
  return String(value).trim().charAt(0).toUpperCase() || 'D';
}

function getDisplayName(user, t) {
  // Показуємо коротке ім'я для профілю.
  return user?.name || t('common.unknownUser');
}

function getDisplayEmail(user) {
  // Підставляємо email, якщо ім'я ще не заповнене.
  return user?.email || '-';
}

function readFileAsDataUrl(file) {
  // Читаємо файл як data URL без зайвих перетворень.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = dataUrl;
  });
}

function dataUrlLength(dataUrl) {
  return String(dataUrl || '').length;
}

async function compressImageDataUrl(
  dataUrl,
  {
    maxSize = 192,
    quality = 0.78,
    minQuality = 0.56,
    targetLength = 120000,
  } = {},
) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    return dataUrl;
  }

  const scale = Math.min(1, maxSize / Math.max(width, height));
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));

  if (scale === 1 && dataUrlLength(dataUrl) <= targetLength) {
    return dataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = nextWidth;
  canvas.height = nextHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, nextWidth, nextHeight);

  let nextQuality = quality;
  let output = canvas.toDataURL('image/jpeg', nextQuality);

  while (dataUrlLength(output) > targetLength && nextQuality > minQuality) {
    nextQuality = Math.max(minQuality, Number((nextQuality - 0.08).toFixed(2)));
    output = canvas.toDataURL('image/jpeg', nextQuality);
  }

  if (dataUrlLength(output) > targetLength && nextWidth > 160) {
    canvas.width = Math.max(120, Math.round(nextWidth * 0.8));
    canvas.height = Math.max(120, Math.round(nextHeight * 0.8));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    nextQuality = Math.max(minQuality, 0.68);
    output = canvas.toDataURL('image/jpeg', nextQuality);
  }

  return output;
}

export function ProfileHero({ user }) {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const { t } = useI18n();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const avatarUrl = user?.profile?.avatarUrl || '';
  const hasAvatar = Boolean(avatarUrl);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    // Скидаємо помилку картинки після зміни аватара.
    setImageFailed(false);
  }, [avatarUrl]);

  function handlePickPhoto() {
    // Відкриваємо вибір файлу одним натисканням.
    fileInputRef.current?.click();
  }

  function handleImageError() {
    // Якщо картинка не завантажилась, показуємо ініціал.
    setImageFailed(true);
  }

  async function handleAvatarChange(event) {
    // Завантажуємо нове фото профілю.
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setMessage('');
    setError('');

    if (!file.type.startsWith('image/')) {
      setError(t('account.chooseImage'));
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const compressedDataUrl = await compressImageDataUrl(dataUrl);
      const updatedUser = await updateProfile({ avatarUrl: compressedDataUrl }).unwrap();
      saveSession(token, updatedUser);
      dispatch(setSession({ token, user: updatedUser }));
      setImageFailed(false);
      setMessage(t('account.photoSaved'));
    } catch {
      setError(t('account.photoRemoved'));
    }
  }

  async function handleRemovePhoto() {
    // Видаляємо фото й повертаємо просту аватарку.
    setMessage('');
    setError('');

    try {
      const updatedUser = await updateProfile({ avatarUrl: '' }).unwrap();
      saveSession(token, updatedUser);
      dispatch(setSession({ token, user: updatedUser }));
      setImageFailed(false);
      setMessage(t('account.photoRemoved'));
    } catch {
      setError(t('account.photoRemoved'));
    }
  }

  return (
    <section className="screenCard profileHero">
      <div className="profileHero-main">
        <button
          className="profileHero-avatarButton"
          type="button"
          onClick={handlePickPhoto}
          aria-label={t('account.changePhoto')}
        >
          <span className="profileHero-avatarFrame" aria-hidden="true">
            {hasAvatar && !imageFailed ? (
              <img
                className="profileHero-avatarImage"
                src={avatarUrl}
                alt=""
                onError={handleImageError}
              />
            ) : (
              <span className="profileHero-avatarFallback">{getInitial(user)}</span>
            )}
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleAvatarChange}
        />

        <div className="profileHero-copy">
          <strong>{getDisplayName(user, t)}</strong>
          <p>{getDisplayEmail(user)}</p>
          <p className="statusNote">
            {t('account.photoHint')}
          </p>

          <div className="profileHero-actions">
            <button
              className="profileHero-action"
              type="button"
              onClick={handlePickPhoto}
              disabled={isLoading}
            >
              {isLoading ? (
                <RequestLoader inline size="sm" label={t('auth.savingProfile')} />
              ) : (
                t('account.changePhoto')
              )}
            </button>

            {hasAvatar ? (
              <button
                className="profileHero-action"
                type="button"
                onClick={handleRemovePhoto}
                disabled={isLoading}
              >
                {isLoading ? (
                  <RequestLoader inline size="sm" label={t('auth.savingProfile')} />
                ) : (
                  t('account.removePhoto')
                )}
              </button>
            ) : null}
          </div>

          {message ? <p className="profileHero-message">{message}</p> : null}
          {error ? <p className="profileHero-error">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
