// ZaUI stylesheet
import "zmp-ui/zaui.css";
// Tailwind stylesheet
import "@/css/tailwind.scss";
// Your stylesheet
import "@/css/app.scss";

// ZMP UI Stylesheet
import "zmp-ui/zaui.css";
// Tailwind Stylesheet
import "@/css/tailwind.scss"; // Giả sử đường dẫn đúng
// Your Stylesheet
import "@/css/app.scss"; // Giả sử đường dẫn đúng

// React core
import React from "react";
import { createRoot } from "react-dom/client";
// THÊM: Import RecoilRoot
import { RecoilRoot } from 'recoil';

// Mount the app
import Layout from "@/components/layout"; // Sử dụng alias @/

// Expose app configuration
import appConfig from "../app-config.json";
if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig as any;
}

const root = createRoot(document.getElementById("app")!);
// SỬA: Dùng React.createElement thay vì JSX
root.render(
  React.createElement(RecoilRoot, null, // Component RecoilRoot, không có props đặc biệt
    React.createElement(Layout) // Component Layout bên trong RecoilRoot
  )
);