import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useI18n } from '../../i18n/useI18n.js';
import { SvgIcon } from '../SvgIcon/SvgIcon.jsx';
import { selectUser } from '../../../features/auth/authSlice.js';
import { hasManagerAccess } from '../../../features/auth/authAccess.js';
import './BottomTabs.css';

const COPY={
 uk:{home:'Головна',time:'Час',finance:'Фінанси',profile:'Профіль',team:'Команда',approvals:'Погодження',more:'Ще'},
 cs:{home:'Domů',time:'Čas',finance:'Finance',profile:'Profil',team:'Tým',approvals:'Schválení',more:'Více'},
 en:{home:'Home',time:'Time',finance:'Finance',profile:'Profile',team:'Team',approvals:'Approvals',more:'More'}
};

function TaskTab({to,label,icon,activePaths=[]}){
 const {pathname}=useLocation();
 const active=pathname===to||activePaths.some(path=>pathname===path||pathname.startsWith(`${path}/`));
 return <Link className={`bottomTab${active?' is-active':''}`} to={to}>
  <span className="bottomTab-icon" aria-hidden="true"><SvgIcon name={icon}/></span>
  <span className="bottomTab-label">{label}</span>
 </Link>;
}

export function BottomTabs(){
 const {language,t}=useI18n();
 const user=useSelector(selectUser);
 const isManager=hasManagerAccess(user);
 const c=COPY[language]||COPY.uk;
 return <nav className="bottomTabs" aria-label={t('bottomTabs.navLabel')}>
  <TaskTab to="/" label={c.home} icon="dashboard" />
  {!isManager?<>
   <TaskTab to="/hours" label={c.time} icon="clock" activePaths={['/hours','/calendar','/hours-table']}/>
   <TaskTab to="/finance" label={c.finance} icon="wallet" activePaths={['/finance','/payroll-report','/invoices','/tax-information']}/>
   <TaskTab to="/profile" label={c.profile} icon="profile" />
  </>:<>
   <TaskTab to="/employees" label={c.team} icon="accounts" activePaths={['/employees','/projects']}/>
   <TaskTab to="/approvals" label={c.approvals} icon="check-circle" />
   <TaskTab to="/finance" label={c.finance} icon="wallet" activePaths={['/finance','/payroll-report','/manager/invoices']}/>
   <TaskTab to="/more" label={c.more} icon="profile" activePaths={['/more','/company-settings','/profile']}/>
  </>}
 </nav>;
}
