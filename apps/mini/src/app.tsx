// apps/mini/src/app.tsx
import React, { useEffect } from 'react';
import { App, ZMPRouter, AnimationRoutes, Route } from 'zmp-ui';
import { RecoilRoot } from 'recoil';
import { appRoutes } from './routes';
import { initMiniCartSync } from './lib/cart-sync-init';
import MiniAppGuard from './components/layout/MiniAppGuard';
import 'zmp-ui/zaui.css';



const MyApp: React.FC = () => {
  console.log('[MyApp] Rendering...', { appRoutes });
  
  // Đồng bộ giỏ mini
    // Đồng bộ giỏ mini
  useEffect(() => {
    console.log('[MyApp] Mounted');
    initMiniCartSync();
  }, []);

    return (
    <RecoilRoot>
      <App>
        <MiniAppGuard>
          <ZMPRouter>
            <AnimationRoutes>
              {appRoutes.map(({ path, component: Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}
            </AnimationRoutes>
          </ZMPRouter>
        </MiniAppGuard>
      </App>
    </RecoilRoot>
  );

};

export default MyApp;