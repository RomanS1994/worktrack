import { Outlet } from 'react-router-dom';

import { AdminLayout } from './layouts/AdminLayout/AdminLayout.jsx';
import './App.css';

export function App() {
  return (
    <div className="adminAppRoot">
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </div>
  );
}
