import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useI18n } from '../../i18n/useI18n.js';
import { SvgIcon } from '../SvgIcon/SvgIcon.jsx';
import { selectUser } from '../../../features/auth/authSlice.js';
import { useCabinetMode } from '../../../features/auth/cabinetMode.js';
import './BottomTabs.css';

const COPY={
 uk:{home:'Головна',time:'Години',payroll:'Фінанси',profile:'Профіль',team:'Команда',approvals:'Погодження',more:'Налаштування'},
 cs:{home:'Domů',time:'Hodiny',payroll:'Finance',profile:'Profil',team:'Tým',approvals:'Schválení',more:'Nastavení'},
 en:{home:'Home',time:'Hours',payroll:'Finances',profile:'Profile',team:'Team',approvals:'Approvals',more:'Settings'}
};

function TaskTab({to,label,icon,activePaths=[],primary=false}){
 const {pathname}=useLocation();
 const active=pathname===to||activePaths.some(path=>pathname===path||pathname.startsWith(`${path}/`));
 return <Link className={`bottomTab${primary?' bottomTab-primary':''}${active?' is-active':''}`} to={to}>
  <span className="bottomTab-icon" aria-hidden="true"><SvgIcon name={icon}/></span>
  <span className="bottomTab-label">{label}</span>
 </Link>;
}

export function BottomTabs(){
 const {language,t}=useI18n();
 const user=useSelector(selectUser);
 const cabinetMode=useCabinetMode(user);
 const isManager=cabinetMode==='manager';
 const c=COPY[language]||COPY.uk;
 return <nav className="bottomTabs" aria-label={t('bottomTabs.navLabel')}>
  <TaskTab to="/" label={c.home} icon="dashboard" />
  {!isManager?<>
   <TaskTab to="/hours" label={c.time} icon="clock" activePaths={['/hours','/calendar','/hours-table']}/>
   <TaskTab to="/payroll-report" label={c.payroll} icon="wallet" activePaths={['/payroll-report','/invoices','/tax-information']}/>
   <TaskTab to="/more" label={c.more} icon="settings" activePaths={['/more','/profile']}/>
  </>:<>
   <TaskTab to="/employees" label={c.team} icon="accounts" activePaths={['/employees','/projects']}/>
   <TaskTab to="/manager/timesheet" label={c.time} icon="clock" primary activePaths={['/manager/timesheet','/approvals','/approval-history']}/>
   <TaskTab to="/payroll-report" label={c.payroll} icon="wallet" activePaths={['/payroll-report','/manager/advances','/manager/expenses','/manager/invoices']}/>
   <TaskTab to="/more" label={c.more} icon="settings" activePaths={['/more','/company-settings','/profile']}/>
  </>}
 </nav>;
}
