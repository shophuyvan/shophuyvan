import React from 'react';
import { Page, Header } from 'zmp-ui';

export default function Profile() {
  return (
    <Page className="bg-gray-50">
      <Header title="Thông tin tài khoản" showBackIcon={true} />
      <div className="p-4 pt-2">
        <div className="bg-white rounded-lg p-6 text-center">
          <div className="text-5xl mb-4">⚙️</div>
          <p className="text-gray-600">Tính năng đang phát triển</p>
        </div>
      </div>
    </Page>
  );
}