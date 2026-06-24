import { Outlet } from 'react-router-dom';
import Footer from './Footer';
import Header from './Header';
import  './Layout.scss';

const Layout = () => {
  return (
    <div className="layout">
      <Header />
      <main className="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
