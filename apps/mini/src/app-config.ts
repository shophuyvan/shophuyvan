// ZaUI stylesheet
import "zmp-ui/zaui.css";
// Tailwind stylesheet
import "@/css/tailwind.scss";
// Your stylesheet
import "@/css/app.scss";

// React core
import React from "react";
import { createRoot } from "react-dom/client";
// State management
import { RecoilRoot } from "recoil";

// Root layout
import Layout from "@/components/layout";

// Expose app configuration
import appConfig from "../app-config.json";
if (!(window as any).APP_CONFIG) {
  (window as any).APP_CONFIG = appConfig as any;
}

// ============================
// TẠO CONTAINER #app AN TOÀN
// ============================
function getAppContainer(): HTMLElement {
  let container = document.getElementById("app") as HTMLElement | null;

  if (!container) {
    // Nếu Zalo không tạo sẵn #app thì tự tạo
    container = document.createElement("div");
    container.id = "app";

    // === PHẦN SỬA LỖI ===
    // Vì logic ở dưới cùng của file này đảm bảo initMiniReactRoot()
    // CHỈ chạy sau khi DOMContentLoaded, chúng ta có thể
    // tự tin rằng document.body luôn luôn tồn tại ở thời điểm này.
    // Không cần logic fallback 'else' phức tạp nữa.
    document.body.appendChild(container);
    // === KẾT THÚC SỬA LỖI ===

    console.warn(
      "[SHV MINI] Không tìm thấy #app, đã tự tạo div#app và gắn vào <body>."
    );
  }

  return container;
}

// CHỈ CHO PHÉP ELEMENT / DOCUMENT / FRAGMENT – GIỐNG REACT
function isValidReactContainer(
  node: any
): node is Element | Document | DocumentFragment {
  return (
    !!node &&
    (node.nodeType === 1 || // Element
      node.nodeType === 9 || // Document
      node.nodeType === 11) // DocumentFragment
  );
}

// ============================
// INIT REACT ROOT CHO MINI
// ============================
function initMiniReactRoot() {
  const container = getAppContainer();
  console.log("[SHV MINI] initMiniReactRoot container:", container, {
    nodeType: (container as any)?.nodeType,
    tagName: (container as any)?.tagName,
  });

  // ✅ Container KHÔNG ĐÚNG CHUẨN → KHÔNG GỌI createRoot
  if (!isValidReactContainer(container)) {
    console.error(
      "[SHV MINI] Container KHÔNG HỢP LỆ cho createRoot, bỏ qua init React:",
      container,
      {
        nodeType: (container as any)?.nodeType,
        tagName: (container as any)?.tagName,
      }
    );
    return;
  }

  try {
    const root = createRoot(container);
    // Dùng React.createElement để tránh JSX lỗi trong môi trường đặc biệt
    root.render(
      React.createElement(
        RecoilRoot,
        null,
        React.createElement(Layout)
      )
    );
    console.log("[SHV MINI] Root render xong.");
  } catch (err) {
    console.error("[SHV MINI] LỖI khi createRoot/render:", err.message, err);
  }
}

// Đảm bảo DOM sẵn sàng rồi mới init (Logic này đã đúng)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMiniReactRoot);
} else {
  initMiniReactRoot();
}