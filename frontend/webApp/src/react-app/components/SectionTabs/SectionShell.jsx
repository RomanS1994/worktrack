import { Outlet } from 'react-router-dom';
import { SectionTabs } from './SectionTabs.jsx';

export function SectionShell({section}){
 return <div className="sectionShell"><SectionTabs section={section}/><Outlet/></div>;
}
