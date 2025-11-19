// apps/fe/src/lib/product-tour.js
// Product Tour - Hướng dẫn đặt hàng từng bước

const TOUR_CONFIG = {
  storageKey: 'shv_tour_status',
  steps: {
    'product-add-cart': {
      target: '#btn-add-cart',
      title: '🛒 Bước 1: Thêm vào giỏ hàng',
      message: 'Chọn số lượng sản phẩm và bấm nút này để thêm vào giỏ hàng',
      position: 'top',
      page: 'product',
      nextTrigger: 'wait-click',
    },
    'product-view-cart': {
      target: '#btn-cart', // Đã sửa từ #header-cart-btn để khớp với ID thực tế trong product.html
      title: '✅ Bước 2: Xem giỏ hàng',
      message: 'Tuyệt vời! Sản phẩm đã được thêm. Bấm vào đây để xem giỏ hàng',
      position: 'bottom-left',
      page: 'product',
      autoNext: 5000, // Tự động sau 5s
    },
    'cart-checkout': {
      target: '.checkout-btn, [href*="checkout"], button:contains("Thanh toán")',
      title: '💳 Bước 3: Thanh toán',
      message: 'Kiểm tra lại đơn hàng và số lượng, sau đó bấm vào đây để đặt hàng',
      position: 'top',
      page: 'cart',
    },
    'checkout-complete': {
      target: 'form, .checkout-form, #customer-info',
      title: '📝 Bước 4: Hoàn tất đơn hàng',
      message: 'Điền đầy đủ thông tin giao hàng. Chúng tôi sẽ liên hệ xác nhận đơn hàng!',
      position: 'right',
      page: 'checkout',
    }
  }
};

export class ProductTour {
  constructor() {
    this.currentStep = null;
    this.overlay = null;
    this.tooltip = null;
    this.status = this.loadStatus();
  }

  loadStatus() {
    try {
      const stored = localStorage.getItem(TOUR_CONFIG.storageKey);
      return stored ? JSON.parse(stored) : { completed: false, currentStep: null };
    } catch {
      return { completed: false, currentStep: null };
    }
  }

  saveStatus() {
    try {
      localStorage.setItem(TOUR_CONFIG.storageKey, JSON.stringify(this.status));
    } catch (e) {
      console.warn('[Tour] Cannot save status:', e);
    }
  }

  shouldAutoStart() {
    // Tự động chạy nếu:
    // 1. Chưa hoàn thành tour
    // 2. Đang ở trang product
    // 3. Chưa có đơn hàng nào (optional check)
    return !this.status.completed && this.isProductPage();
  }

  isProductPage() {
    return window.location.pathname.includes('product.html');
  }

  start(stepId) {
    const step = TOUR_CONFIG.steps[stepId || 'product-add-cart'];
    if (!step) return;

    this.currentStep = stepId || 'product-add-cart';
    this.status.currentStep = this.currentStep;
    this.saveStatus();

    this.showStep(step);
  }

  showStep(step) {
    // Tìm target element
    const target = document.querySelector(step.target);
    if (!target) {
      console.warn('[Tour] Target not found:', step.target);
      return;
    }

    // Tạo overlay + spotlight
    this.createOverlay(target);
    
    // Tạo tooltip
    this.createTooltip(target, step);

    // Setup event listeners
    this.setupStepEvents(step, target);
  }

  createOverlay(target) {
    // Remove existing
    if (this.overlay) this.overlay.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'tour-overlay';
    this.overlay.innerHTML = `
      <style>
        #tour-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 99998;
          animation: fadeIn 0.3s;
          backdrop-filter: blur(2px);
        }
        
        .tour-spotlight {
          position: fixed;
          pointer-events: none;
          border-radius: 12px;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.85),
                      0 0 30px 10px rgba(59, 130, 246, 0.8),
                      0 0 60px 20px rgba(59, 130, 246, 0.4);
          z-index: 99999;
          transition: all 0.3s ease;
          border: 3px solid #3b82f6;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { 
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.85), 
                        0 0 30px 10px rgba(59, 130, 246, 0.8),
                        0 0 60px 20px rgba(59, 130, 246, 0.4);
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.85), 
                        0 0 40px 15px rgba(59, 130, 246, 1),
                        0 0 80px 30px rgba(59, 130, 246, 0.6);
            transform: scale(1.02);
          }
        }
        
        .tour-spotlight {
          animation: pulse 2s infinite;
        }
      </style>
    `;
    
    document.body.appendChild(this.overlay);

    // Tạo spotlight cho target
    const rect = target.getBoundingClientRect();
    const spotlight = document.createElement('div');
    spotlight.className = 'tour-spotlight';
    spotlight.style.cssText = `
      top: ${rect.top - 8}px;
      left: ${rect.left - 8}px;
      width: ${rect.width + 16}px;
      height: ${rect.height + 16}px;
    `;
    
    document.body.appendChild(spotlight);

    // Allow click on target
    target.style.position = 'relative';
    target.style.zIndex = '100000';
    target.style.pointerEvents = 'auto';
  }

  createTooltip(target, step) {
    if (this.tooltip) this.tooltip.remove();

    const rect = target.getBoundingClientRect();
    
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'tour-tooltip';
    this.tooltip.innerHTML = `
      <!-- ✅ ARROW CHỈ VÀO TARGET -->
      <div class="tour-arrow"></div>
      
      <div class="tour-tooltip-content">
        <div class="tour-tooltip-header">
          <h3>${step.title}</h3>
          <button class="tour-close" onclick="window.__productTour?.skip()">✕</button>
        </div>
        <p>${step.message}</p>
        <div class="tour-tooltip-actions">
          <button class="tour-btn-secondary" onclick="window.__productTour?.skip()">
            Bỏ qua
          </button>
          ${step.nextTrigger !== 'wait-click' ? `
            <button class="tour-btn-primary" onclick="window.__productTour?.next()">
              Tiếp theo →
            </button>
          ` : ''}
        </div>
      </div>
      
      <style>
        #tour-tooltip {
          position: fixed;
          z-index: 100001;
          max-width: 360px;
          animation: slideIn 0.3s ease-out;
        }
        
        .tour-arrow {
          position: absolute;
          width: 0;
          height: 0;
          border: 20px solid transparent;
        }
        
        .tour-arrow.arrow-bottom {
          bottom: -40px;
          left: 50%;
          transform: translateX(-50%);
          border-top-color: white;
        }
        
        .tour-arrow.arrow-top {
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          border-bottom-color: white;
        }
        
        .tour-arrow.arrow-left {
          left: -40px;
          top: 50%;
          transform: translateY(-50%);
          border-right-color: white;
        }
        
        .tour-arrow.arrow-right {
          right: -40px;
          top: 50%;
          transform: translateY(-50%);
          border-left-color: white;
        }
        
        .tour-tooltip-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
        
        .tour-tooltip-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        
        .tour-tooltip-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }
        
        .tour-close {
          background: transparent;
          border: none;
          font-size: 24px;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .tour-close:hover {
          color: #111827;
        }
        
        .tour-tooltip-content p {
          margin: 0 0 20px 0;
          color: #374151;
          font-size: 15px;
          line-height: 1.6;
        }
        
        .tour-tooltip-actions {
          display: flex;
          gap: 8px;
        }
        
        .tour-btn-primary, .tour-btn-secondary {
          flex: 1;
          padding: 12px 20px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        
        .tour-btn-primary {
          background: #007bff;
          color: white;
        }
        
        .tour-btn-primary:hover {
          background: #0056b3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
        }
        
        .tour-btn-secondary {
          background: #f3f4f6;
          color: #6b7280;
        }
        
        .tour-btn-secondary:hover {
          background: #e5e7eb;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (max-width: 640px) {
          #tour-tooltip {
            max-width: calc(100vw - 32px);
            left: 16px !important;
            right: 16px !important;
          }
        }
      </style>
    `;
    
    document.body.appendChild(this.tooltip);

    // Position tooltip
    this.positionTooltip(target, step.position);
  }

  positionTooltip(target, position) {
    const rect = target.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    
    let top, left, arrowClass;
    
    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - 20;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        arrowClass = 'arrow-bottom';
        break;
      case 'bottom':
        top = rect.bottom + 20;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom-left':
        top = rect.bottom + 20;
        left = rect.left;
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - 20;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + 20;
        break;
      default:
        top = rect.bottom + 20;
        left = rect.left;
    }
    
    // Boundary check
    if (top < 10) top = 10;
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    
    this.tooltip.style.top = top + 'px';
    this.tooltip.style.left = left + 'px';
    
    // Set arrow direction
    const arrow = this.tooltip.querySelector('.tour-arrow');
    if (arrow && arrowClass) {
      arrow.className = 'tour-arrow ' + arrowClass;
    }
  }

  setupStepEvents(step, target) {
    if (step.nextTrigger === 'wait-click') {
      // Đợi user click vào target
      target.addEventListener('click', () => {
        setTimeout(() => this.next(), 500);
      }, { once: true });
    } else if (step.autoNext) {
      // Auto next sau X ms
      setTimeout(() => this.next(), step.autoNext);
    }
  }

  next() {
    const stepKeys = Object.keys(TOUR_CONFIG.steps);
    const currentIndex = stepKeys.indexOf(this.currentStep);
    
    if (currentIndex < stepKeys.length - 1) {
      const nextStepKey = stepKeys[currentIndex + 1];
      const nextStep = TOUR_CONFIG.steps[nextStepKey];
      
      // Check if need to navigate to another page
      if (nextStep.page !== TOUR_CONFIG.steps[this.currentStep].page) {
        // Save next step and navigate
        this.status.currentStep = nextStepKey;
        this.saveStatus();
        
        // Navigate based on page
        if (nextStep.page === 'cart') {
          window.location.href = '/cart.html';
        } else if (nextStep.page === 'checkout') {
          window.location.href = '/checkout.html';
        }
      } else {
        // Same page, continue tour
        this.cleanup();
        this.start(nextStepKey);
      }
    } else {
      // Tour completed
      this.complete();
    }
  }

  skip() {
    this.status.completed = true;
    this.status.currentStep = null;
    this.saveStatus();
    this.cleanup();
  }

  complete() {
    this.status.completed = true;
    this.status.currentStep = null;
    this.saveStatus();
    this.cleanup();
    
    // Show completion message
    this.showCompletionMessage();
  }

  showCompletionMessage() {
    const msg = document.createElement('div');
    msg.innerHTML = `
      <div style="position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:16px 24px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:100002;animation:slideInRight 0.3s;">
        ✅ Hoàn thành hướng dẫn! Chúc bạn mua sắm vui vẻ!
      </div>
      <style>
        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    document.body.appendChild(msg);
    
    setTimeout(() => msg.remove(), 3000);
  }

  cleanup() {
    if (this.overlay) this.overlay.remove();
    if (this.tooltip) this.tooltip.remove();
    
    // Reset z-index of target
    const step = TOUR_CONFIG.steps[this.currentStep];
    if (step) {
      const target = document.querySelector(step.target);
      if (target) {
        target.style.zIndex = '';
        target.style.position = '';
      }
    }
    
    // Remove spotlight
    document.querySelectorAll('.tour-spotlight').forEach(el => el.remove());
  }

  // Resume tour khi navigate
  resumeIfNeeded() {
    if (this.status.currentStep && !this.status.completed) {
      const step = TOUR_CONFIG.steps[this.status.currentStep];
      if (step && this.isCurrentPage(step.page)) {
        setTimeout(() => this.start(this.status.currentStep), 1000);
      }
    }
  }

  isCurrentPage(pageName) {
    if (pageName === 'product') return window.location.pathname.includes('product.html');
    if (pageName === 'cart') return window.location.pathname.includes('cart.html');
    if (pageName === 'checkout') return window.location.pathname.includes('checkout.html');
    return false;
  }
}

// Export singleton
export const productTour = new ProductTour();

// Global access
if (typeof window !== 'undefined') {
  window.__productTour = productTour;
}

// Auto-init
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // FORCE START - Luôn chạy khi vào product page lần đầu
    if (productTour.isProductPage() && !productTour.status.completed) {
      setTimeout(() => {
        console.log('[Tour] Starting tour...');
        productTour.start();
      }, 2000); // Delay 2s để DOM load đầy đủ
    } else {
      // Resume if in middle of tour
      productTour.resumeIfNeeded();
    }
  });
}