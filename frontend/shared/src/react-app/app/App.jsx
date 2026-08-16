import { Outlet } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout/AppLayout.jsx';
import './App.css';

export function App() {
  return (
    <div className="appRoot">
      <AppLayout>
        <Outlet />
      </AppLayout>
    </div>
  );
}
