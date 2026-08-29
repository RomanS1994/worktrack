import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { baseApi } from '@shared/app/api/baseApi.js';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useChangePasswordMutation, useDeleteMeMutation, useLogoutMutation, useUpdateProfileMutation } from '@shared/features/auth/authApi.js';
import { clearSession as clearAuthSession, selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { clearSession as clearStoredSession, saveSession } from '@shared/features/auth/authStorage.js';
import './ProfilePage.css';

const LANGUAGES = [{ code: 'cs', flag: '🇨🇿' }, { code: 'uk', flag: '🇺🇦' }, { code: 'en', flag: '🇬🇧' }];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 512;

function getName(user) { return user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '-'; }
function initials(user) { return [user?.firstName, user?.lastName].filter(Boolean).map(v => v[0]).join('').slice(0, 2).toUpperCase() || getName(user).slice(0, 1).toUpperCase(); }

function CameraIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 5.5 9.4 3.8h5.2l1.2 1.7H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2h3.2Z"/><circle cx="12" cy="12.5" r="3.4"/></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>;
}

function resizeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('Canvas is unavailable')); return; }
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
        const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const dispatch = useDispatch(); const navigate = useNavigate(); const user = useSelector(selectUser); const token = useSelector(selectToken); const { language, setLanguage, t } = useI18n();
  const membership = user?.activeMembership || null; const isEmployee = membership?.role === 'EMPLOYEE'; const roleLabel = membership?.role === 'MANAGER' ? t('profile.manager') : isEmployee ? t('profile.employee') : '-'; const rate = membership?.hourlyRateCzk || '';
  const [modal, setModal] = useState('');
  const photoInputRef = useRef(null);
  const [updateProfile, profileState] = useUpdateProfileMutation(); const [firstName, setFirstName] = useState(user?.firstName || ''); const [lastName, setLastName] = useState(user?.lastName || ''); const [phone, setPhone] = useState(user?.phone || ''); const [avatarDraft, setAvatarDraft] = useState(user?.profile?.avatarDataUrl || ''); const [profileError, setProfileError] = useState('');
  const [changePassword, changeState] = useChangePasswordMutation(); const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [passwordError, setPasswordError] = useState('');
  const [logout, logoutState] = useLogoutMutation(); const [deleteMe, deleteState] = useDeleteMeMutation(); const [deleteConfirmation, setDeleteConfirmation] = useState(''); const [accountError, setAccountError] = useState('');

  useEffect(() => { setFirstName(user?.firstName || ''); setLastName(user?.lastName || ''); setPhone(user?.phone || ''); setAvatarDraft(user?.profile?.avatarDataUrl || ''); }, [user?.firstName, user?.lastName, user?.phone, user?.profile?.avatarDataUrl]);
  useEffect(() => { const section = new URLSearchParams(window.location.search).get('section'); if (['personal', 'work', 'language', 'password', 'account'].includes(section)) setModal(section); }, []);

  function applyUpdatedUser(updatedUser) { saveSession(token, updatedUser); dispatch(setSession({ token, user: updatedUser })); }
  function clearClientSession() { clearStoredSession(); dispatch(clearAuthSession()); dispatch(baseApi.util.resetApiState()); }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProfileError('');
    if (file.size > MAX_PHOTO_BYTES) { setProfileError(t('profileUi.photoTooLarge')); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setProfileError(t('profileUi.photoInvalid')); return; }
    try { setAvatarDraft(await resizeProfilePhoto(file)); } catch { setProfileError(t('profileUi.photoInvalid')); }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault(); setProfileError('');
    const normalizedFirstName = firstName.trim();
    if (!normalizedFirstName) { setProfileError(t('profile.firstNameRequired')); return; }
    try {
      const updatedUser = await updateProfile({ firstName: normalizedFirstName, lastName: lastName.trim(), name: [normalizedFirstName, lastName.trim()].filter(Boolean).join(' '), phone: phone.trim(), profile: { ...(user?.profile || {}), avatarDataUrl: avatarDraft || '' } }).unwrap();
      applyUpdatedUser(updatedUser); setModal('');
    } catch (error) { setProfileError(getApiErrorMessage(error)); }
  }

  async function handlePasswordSubmit(event) { event.preventDefault(); setPasswordError(''); if (newPassword !== confirmPassword) { setPasswordError(t('profile.passwordsDoNotMatch')); return; } try { const updatedUser = await changePassword({ currentPassword, newPassword }).unwrap(); applyUpdatedUser(updatedUser); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setModal(''); } catch (error) { setPasswordError(getApiErrorMessage(error)); } }
  async function handleLogout() { setAccountError(''); try { await logout().unwrap(); clearClientSession(); navigate('/sign-in', { replace: true }); } catch (error) { setAccountError(getApiErrorMessage(error)); } }
  async function handleDeleteAccount() { if (deleteConfirmation.trim() !== 'DELETE') return; setAccountError(''); try { await deleteMe().unwrap(); clearClientSession(); navigate('/sign-in', { replace: true }); } catch (error) { setAccountError(getApiErrorMessage(error)); } }
  const languageName = t(`settings.languageCard.${language}`);
  const avatar = user?.profile?.avatarDataUrl || '';

  return <section className="profilePage pageStack">
    <header className="profileHero screenCard"><div className={`profileAvatar${avatar ? ' has-photo' : ''}`}>{avatar ? <img src={avatar} alt="" /> : initials(user)}</div><div><p className="sectionEyebrow">{t('profileUi.account')}</p><h1>{getName(user)}</h1><p>{roleLabel} · {user?.activeCompany?.name || '-'}</p></div></header>
    {user?.mustChangePassword ? <button className="profileNotice" type="button" onClick={() => setModal('password')}><strong>{t('profile.changeTemporaryPassword')}</strong><span>{t('profile.temporaryPasswordCopy')}</span><b>›</b></button> : null}

    <div className="profileGroups">
      <section><h2>{t('profileUi.account')}</h2><div className="profileMenu screenCard">
        <button type="button" onClick={() => setModal('personal')}><span className="profileMenuIcon">👤</span><span><strong>{t('profileUi.personal')}</strong><small>{t('profileUi.personalCopy')}</small></span><b>›</b></button>
        <button type="button" onClick={() => setModal('work')}><span className="profileMenuIcon">💼</span><span><strong>{t('profileUi.work')}</strong><small>{t('profileUi.workCopy')}</small></span><b>›</b></button>
      </div></section>
      <section><h2>{t('profileUi.preferences')}</h2><div className="profileMenu screenCard">
        <button type="button" onClick={() => setModal('language')}><span className="profileMenuIcon">🌐</span><span><strong>{t('profileUi.language')}</strong><small>{languageName}</small></span><b>›</b></button>
        <button type="button" onClick={() => setModal('password')}><span className="profileMenuIcon">🔒</span><span><strong>{t('profileUi.security')}</strong><small>{t('profileUi.securityCopy')}</small></span><b>›</b></button>
        {isEmployee ? <button type="button" onClick={() => navigate('/tax-information')}><span className="profileMenuIcon">🧾</span><span><strong>{t('profileUi.tax')}</strong><small>{t('profileUi.taxCopy')}</small></span><b>›</b></button> : null}
      </div></section>
    </div>

    {accountError ? <p className="statusNote is-error">{accountError}</p> : null}
    <button className="profileSignOut" type="button" disabled={logoutState.isLoading} onClick={handleLogout}>{logoutState.isLoading ? t('profile.signingOut') : t('profileUi.signOut')}</button>
    <button className="profileAccountLink" type="button" onClick={() => setModal('account')}>{t('profileUi.danger')}</button>

    {modal ? <div className="profileModalBackdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setModal(''); }}><section className="profileModal" role="dialog" aria-modal="true"><header><h2>{modal === 'personal' ? t('profileUi.editPersonal') : modal === 'work' ? t('profileUi.work') : modal === 'language' ? t('profileUi.language') : modal === 'password' ? t('profileUi.changePassword') : t('profileUi.danger')}</h2><button className="profileModalClose" type="button" aria-label={t('profileUi.close')} onClick={() => setModal('')}><CloseIcon /></button></header>
      {modal === 'personal' ? <form onSubmit={handleProfileSubmit} className="profileModalBody">
        <div className="profilePhotoEditor">
          <button className={`profilePhotoButton${avatarDraft ? ' has-photo' : ''}`} type="button" onClick={() => photoInputRef.current?.click()} aria-label={t('profileUi.photoHint')}>{avatarDraft ? <img src={avatarDraft} alt="" /> : <span>{initials(user)}</span>}<i aria-hidden="true"><CameraIcon /></i></button>
          <input ref={photoInputRef} className="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          <p>{t('profileUi.photoHint')}</p><small>{t('profileUi.photoRules')}</small>
        </div>
        <div className="profileFieldGrid"><label className="profileField"><span>{t('profile.firstName')}</span><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required /></label><label className="profileField"><span>{t('profile.lastName')}</span><input type="text" value={lastName} onChange={e => setLastName(e.target.value)} /></label></div><label className="profileField"><span>{t('profile.phone')}</span><input type="tel" autoComplete="tel" placeholder="+420 777 123 456" value={phone} onChange={e => setPhone(e.target.value)} /></label>{profileError ? <p className="statusNote is-error">{profileError}</p> : null}<button className="profilePrimaryButton" disabled={profileState.isLoading}>{profileState.isLoading ? t('profile.saving') : t('profileUi.save')}</button></form> : null}
      {modal === 'work' ? <div className="profileModalBody profileInfoList"><div><span>{t('profileUi.email')}</span><strong>{user?.email || '-'}</strong></div><div><span>{t('profileUi.role')}</span><strong>{roleLabel}</strong></div><div><span>{t('profileUi.company')}</span><strong>{user?.activeCompany?.name || '-'}</strong></div><div><span>{t('profileUi.hourlyRate')}</span><strong>{rate ? `${rate} CZK` : '-'}</strong></div></div> : null}
      {modal === 'language' ? <div className="profileModalBody languagePicker">{LANGUAGES.map(item => <button key={item.code} className={`languageOption${language === item.code ? ' is-active' : ''}`} type="button" onClick={() => { setLanguage(item.code); setModal(''); }}><span>{item.flag}</span><span>{t(`settings.languageCard.${item.code}`)}</span><b>{language === item.code ? '✓' : ''}</b></button>)}</div> : null}
      {modal === 'password' ? <form onSubmit={handlePasswordSubmit} className="profileModalBody"><label className="profileField"><span>{t('profile.currentPassword')}</span><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label><label className="profileField"><span>{t('profile.newPassword')}</span><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></label><label className="profileField"><span>{t('profile.confirmPassword')}</span><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>{passwordError ? <p className="statusNote is-error">{passwordError}</p> : null}<button className="profilePrimaryButton" disabled={changeState.isLoading}>{changeState.isLoading ? t('profile.saving') : t('profile.updatePassword')}</button></form> : null}
      {modal === 'account' ? <div className="profileModalBody"><button className="profilePrimaryButton" type="button" disabled={logoutState.isLoading} onClick={handleLogout}>{logoutState.isLoading ? t('profile.signingOut') : t('profileUi.signOut')}</button><p className="profileDangerCopy">{t('profileUi.deleteCopy')}</p><label className="profileField"><span>{t('profileUi.deleteHint')}</span><input value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} placeholder="DELETE" /></label><button className="profileDangerButton" type="button" disabled={deleteState.isLoading || deleteConfirmation.trim() !== 'DELETE'} onClick={handleDeleteAccount}>{deleteState.isLoading ? t('profile.deleting') : t('profileUi.deleteAccount')}</button></div> : null}
    </section></div> : null}
  </section>;
}
