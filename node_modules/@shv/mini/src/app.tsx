import React, { useEffect, useState } from 'react';
import Home from './pages/Home';
import Category from './pages/Category';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';

/**
 * Minimal router: uses location.pathname (or hash) to choose a page component.
 * This avoids relying on zmp-react router APIs that vary by version.
 */
function usePath() {
  const get = () => (location.hash?.startsWith('#') ? location.hash.slice(1) : location.pathname) || '/';
  const [path, setPath] = useState(get());
  useEffect(() => {
    const onChange = () => setPath(get());
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return path;
}

export default function App() {
  const path = usePath();
  let Page: React.FC = Home;

  if (path.startsWith('/category') || path.startsWith('category')) Page = Category;
  else if (path.startsWith('/product') || path.startsWith('product')) Page = Product;
  else if (path.startsWith('/cart') || path.startsWith('cart')) Page = Cart;
  else if (path.startsWith('/checkout') || path.startsWith('checkout')) Page = Checkout;
  else Page = Home;

  return <Page />;
}
