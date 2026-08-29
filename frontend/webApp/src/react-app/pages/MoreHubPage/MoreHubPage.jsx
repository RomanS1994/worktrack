import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { baseApi } from '@shared/app/api/baseApi.js';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useLogoutMutation, useUpdateProfileMutation } from '@shared/features/auth/authApi.js';
import { clearSession as clearAuthSession, selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { clearSession as clearStoredSession, saveSession } from '@shared/features/auth/authStorage.js';
import './MoreHubPage.css';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 512;

const COPY = {
  uk: { title:'Налаштування',copy:'Керуйте параметрами компанії та акаунта.',changePhoto:'Змінити фото',photoError:'Не вдалося змінити фото.',photoTooLarge:'Фото має бути до 5 МБ.',companyGroup:'Компанія',identity:'Дані компанії',identityCopy:'Назва, адреса та системні дані',billing:'Реквізити',billingCopy:'IČO, DIČ, адреса та email для рахунків',workGroup:'Робочі правила',work:'Робочий час',workCopy:'Обід, денна норма та графік роботи',accountGroup:'Особисті налаштування',personal:'Особисті дані',personalCopy:'Імʼя, телефон та фото профілю',language:'Мова',languageCopy:'Мова інтерфейсу додатку',securityGroup:'Безпека й акаунт',security:'Змінити пароль',securityCopy:'Оновіть пароль для входу в акаунт',accountManagement:'Керування акаунтом',accountManagementCopy:'Видалення акаунта',signOut:'Вийти з акаунта',signingOut:'Вихід…' },
  cs: { title:'Nastavení',copy:'Spravujte nastavení společnosti a účtu.',changePhoto:'Změnit fotografii',photoError:'Fotografii se nepodařilo změnit.',photoTooLarge:'Fotografie může mít nejvýše 5 MB.',companyGroup:'Společnost',identity:'Údaje společnosti',identityCopy:'Název, adresa a systémové údaje',billing:'Fakturační údaje',billingCopy:'IČO, DIČ, adresa a e-mail pro faktury',workGroup:'Pracovní pravidla',work:'Pracovní doba',workCopy:'Přestávka, denní norma a pracovní plán',accountGroup:'Osobní nastavení',personal:'Osobní údaje',personalCopy:'Jméno, telefon a profilová fotografie',language:'Jazyk',languageCopy:'Jazyk rozhraní aplikace',securityGroup:'Zabezpečení a účet',security:'Změnit heslo',securityCopy:'Aktualizujte heslo pro přihlášení',accountManagement:'Správa účtu',accountManagementCopy:'Odstranění účtu',signOut:'Odhlásit se',signingOut:'Odhlašování…' },
  en: { title:'Settings',copy:'Manage company and account settings.',changePhoto:'Change photo',photoError:'Could not change photo.',photoTooLarge:'Photo must be under 5 MB.',companyGroup:'Company',identity:'Company details',identityCopy:'Name, address and system details',billing:'Billing details',billingCopy:'Company ID, VAT ID, address and invoice email',workGroup:'Work rules',work:'Working time',workCopy:'Lunch, daily standard and work schedule',accountGroup:'Personal settings',personal:'Personal details',personalCopy:'Name, phone and profile photo',language:'Language',languageCopy:'Application interface language',securityGroup:'Security and account',security:'Change password',securityCopy:'Update your account sign-in password',accountManagement:'Account management',accountManagementCopy:'Delete account',signOut:'Sign out',signingOut:'Signing out…' },
};

function getName(user){return user?.name||[user?.firstName,user?.lastName].filter(Boolean).join(' ')||user?.email||'-'}
function initials(user){return [user?.firstName,user?.lastName].filter(Boolean).map(value=>value[0]).join('').slice(0,2).toUpperCase()||getName(user).slice(0,1).toUpperCase()}
function resizeProfilePhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=AVATAR_SIZE;canvas.height=AVATAR_SIZE;const context=canvas.getContext('2d');if(!context)return reject(new Error('Canvas unavailable'));const size=Math.min(image.naturalWidth,image.naturalHeight);const x=Math.max(0,(image.naturalWidth-size)/2);const y=Math.max(0,(image.naturalHeight-size)/2);context.drawImage(image,x,y,size,size,0,0,AVATAR_SIZE,AVATAR_SIZE);resolve(canvas.toDataURL('image/jpeg',.82))};image.src=String(reader.result||'')};reader.readAsDataURL(file)})}
function SettingsRow({to,icon,title,copy,tone='default'}){return <Link to={to} className={`moreHubRow moreHubRow--${tone}`}><span className="moreHubIcon"><SvgIcon name={icon}/></span><span className="moreHubRowText"><strong>{title}</strong><small>{copy}</small></span><span className="moreHubChevron" aria-hidden="true">›</span></Link>}
function SettingsGroup({title,children}){return <section className="moreHubGroup"><h2>{title}</h2><div className="moreHubMenu screenCard">{children}</div></section>}

export function MoreHubPage(){
 const dispatch=useDispatch();const navigate=useNavigate();const user=useSelector(selectUser);const token=useSelector(selectToken);const {language}=useI18n();const c=COPY[language]||COPY.uk;const photoInputRef=useRef(null);const [updateProfile,updateState]=useUpdateProfileMutation();const [logout,logoutState]=useLogoutMutation();const [photoError,setPhotoError]=useState('');const [logoutError,setLogoutError]=useState('');const avatar=user?.profile?.avatarDataUrl||'';
 async function handlePhotoChange(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;setPhotoError('');if(file.size>MAX_PHOTO_BYTES){setPhotoError(c.photoTooLarge);return}if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setPhotoError(c.photoError);return}try{const avatarDataUrl=await resizeProfilePhoto(file);const updatedUser=await updateProfile({firstName:user?.firstName||'',lastName:user?.lastName||'',name:getName(user),phone:user?.phone||'',profile:{...(user?.profile||{}),avatarDataUrl}}).unwrap();saveSession(token,updatedUser);dispatch(setSession({token,user:updatedUser}))}catch{setPhotoError(c.photoError)}}
 async function handleLogout(){setLogoutError('');try{await logout().unwrap();clearStoredSession();dispatch(clearAuthSession());dispatch(baseApi.util.resetApiState());navigate('/sign-in',{replace:true})}catch(error){setLogoutError(getApiErrorMessage(error))}}
 return <section className="moreHub pageStack">
  <header className="moreHubHeader appTop"><div className="appTitleBlock"><h1>{c.title}</h1><p>{c.copy}</p></div></header>

  <section className="moreHubProfile screenCard">
   <button className={`moreHubAvatar${avatar?' has-photo':''}`} type="button" onClick={()=>photoInputRef.current?.click()} disabled={updateState.isLoading} aria-label={c.changePhoto}>{avatar?<img src={avatar} alt=""/>:<span>{initials(user)}</span>}<i aria-hidden="true"><SvgIcon name="edit"/></i></button>
   <div className="moreHubProfileText"><strong>{getName(user)}</strong><small>{user?.email||''}</small><button type="button" onClick={()=>photoInputRef.current?.click()} disabled={updateState.isLoading}>{updateState.isLoading?'…':c.changePhoto}</button></div>
   <Link className="moreHubProfileLink" to="/profile?section=personal&from=settings" aria-label={c.personal}><span aria-hidden="true">›</span></Link>
   <input ref={photoInputRef} className="moreHubPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange}/>
  </section>
  {photoError?<p className="moreHubPhotoError">{photoError}</p>:null}

  <SettingsGroup title={c.companyGroup}><SettingsRow to="/company-settings?section=identity&from=settings" icon="location" tone="company" title={c.identity} copy={c.identityCopy}/><SettingsRow to="/company-settings?section=billing&from=settings" icon="file" tone="billing" title={c.billing} copy={c.billingCopy}/></SettingsGroup>
  <SettingsGroup title={c.workGroup}><SettingsRow to="/company-settings?section=work&from=settings" icon="clock" tone="work" title={c.work} copy={c.workCopy}/></SettingsGroup>
  <SettingsGroup title={c.accountGroup}><SettingsRow to="/profile?section=personal&from=settings" icon="user" tone="personal" title={c.personal} copy={c.personalCopy}/><SettingsRow to="/profile?section=language&from=settings" icon="monitor" tone="language" title={c.language} copy={c.languageCopy}/></SettingsGroup>
  <SettingsGroup title={c.securityGroup}><SettingsRow to="/profile?section=password&from=settings" icon="settings" tone="security" title={c.security} copy={c.securityCopy}/><SettingsRow to="/profile?section=account&from=settings" icon="logout" tone="danger" title={c.accountManagement} copy={c.accountManagementCopy}/></SettingsGroup>
  {logoutError?<p className="moreHubLogoutError">{logoutError}</p>:null}
  <button className="moreHubSignOut" type="button" onClick={handleLogout} disabled={logoutState.isLoading}><SvgIcon name="logout"/><span>{logoutState.isLoading?c.signingOut:c.signOut}</span></button>
 </section>;
}
