// apps/mini/src/components/layout/PageLayout.tsx
import React from 'react';
import Footer from '../Footer';

interface PageLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

const PageLayout: React.FC<PageLayoutProps> = ({ 
  children, 
  showFooter = true 
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="flex-1 min-h-0 pb-16">
        {children}
      </div>
      {showFooter && <Footer />}
    </div>
  );
};

export default PageLayout;