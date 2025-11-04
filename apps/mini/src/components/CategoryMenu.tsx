// CategoryMenu.tsx - Menu danh mục đồng bộ với Admin
// Đường dẫn: apps/mini/src/components/CategoryMenu.tsx

import React, { useEffect, useState } from 'react';
import { api } from '@shared/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  parent?: string;
  order?: number;
  children?: Category[];
}

/**
 * ✅ Build cây danh mục giống Admin
 */
function buildCategoryTree(items: Category[]): Category[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  
  // Nếu đã có children thì return
  if (items.some(it => Array.isArray(it.children) && it.children.length > 0)) {
    return items;
  }
  
  const byId = new Map<string, Category>();
  items.forEach(item => {
    byId.set(item.id || item.slug, { 
      ...item, 
      children: [] 
    });
  });
  
  const roots: Category[] = [];
  
  items.forEach(item => {
    const id = item.id || item.slug;
    const parentId = item.parent;
    
    const node = byId.get(id);
    if (!node) return;
    
    if (parentId && byId.has(parentId)) {
      // Có parent -> thêm vào children
      const parent = byId.get(parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    } else {
      // Không có parent -> root
      roots.push(node);
    }
  });
  
  // ✅ Sắp xếp theo order
  const sortByOrder = (nodes: Category[]) => {
    nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortByOrder(node.children);
      }
    });
  };
  
  sortByOrder(roots);
  
  return roots;
}

/**
 * ✅ Component hiển thị 1 category node
 */
const CategoryNode: React.FC<{ 
  category: Category; 
  depth?: number; 
  onSelect?: () => void;
}> = ({ category, depth = 0, onSelect }) => {
  // ✅ Giới hạn độ sâu tối đa để tránh infinite loop
  if (depth > 10) {
    console.warn('⚠️ Category tree quá sâu, dừng render tại depth:', depth);
    return null;
  }
  
  const [expanded, setExpanded] = useState(depth === 0); // Root mở mặc định
  
  const hasChildren = Array.isArray(category.children) && category.children.length > 0;
  const icon = hasChildren ? (expanded ? '📂' : '📁') : '📄';
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasChildren) {
      setExpanded(!expanded);
    } else {
      // Navigate
      if (onSelect) onSelect();
      // Delay navigation để onSelect có thể thực thi
      setTimeout(() => {
        window.location.href = `/category?c=${encodeURIComponent(category.slug)}`;
      }, 100);
    }
  };
  
  return (
    <div className="category-node">
      <a
        href={`/category?c=${encodeURIComponent(category.slug)}`}
        onClick={handleClick}
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100 transition-colors"
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <span className="text-lg">{icon}</span>
        <span className="flex-1 text-sm font-medium text-gray-800">
          {category.name}
        </span>
        {hasChildren && (
          <span className="text-xs text-gray-400">
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </a>
      
      {hasChildren && expanded && (
        <div className="ml-2 border-l-2 border-gray-200">
          {category.children!.map((child, idx) => (
            <CategoryNode 
              key={`${child.id || child.slug}-${idx}`} 
              category={child} 
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * ✅ Main CategoryMenu Component
 */
export default function CategoryMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    loadCategories();
  }, []);
  
  /**
   * ✅ Load categories từ API
   */
  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.categories.list();
      
      if (Array.isArray(response) && response.length > 0) {
        // Sắp xếp và build tree
        const sorted = response.sort((a: any, b: any) => 
          (a.order || 0) - (b.order || 0)
        );
        const tree = buildCategoryTree(sorted as Category[]);
        setCategories(tree);
        console.log('✅ Loaded categories:', tree.length);
      } else {
        setCategories([]);
      }
    } catch (err: any) {
      console.error('❌ Error loading categories:', err);
      setError(err?.message || 'Lỗi tải danh mục');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggle = () => {
    setIsOpen(!isOpen);
  };
  
  const handleClose = () => {
    setIsOpen(false);
  };
  
  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          className="w-5 h-5"
        >
          <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
        </svg>
        <span className="text-sm font-medium">Danh mục</span>
      </button>
      
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40"
          onClick={handleClose}
        />
      )}
      
      {/* Drawer Panel */}
      <div 
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-white z-50 shadow-xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Danh mục sản phẩm</h2>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="w-5 h-5"
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-73px)]">
          {loading && (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <div className="mt-2">Đang tải...</div>
            </div>
          )}
          
          {!loading && error && (
            <div className="p-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                ⚠️ {error}
              </div>
              <button 
                onClick={loadCategories}
                className="mt-3 w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                🔄 Thử lại
              </button>
            </div>
          )}
          
          {!loading && !error && categories.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              <div className="text-4xl mb-2">📦</div>
              <div>Chưa có danh mục</div>
            </div>
          )}
          
          {!loading && !error && categories.length > 0 && (
            <div className="py-2">
              {(categories || []).map((category, idx) => (
                <CategoryNode 
                  key={`${category.id || category.slug}-root-${idx}`} 
                  category={category}
                  onSelect={handleClose}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

console.log('✅ CategoryMenu.tsx loaded - Synced with Admin');