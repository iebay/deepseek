import fs from 'fs';
import path from 'path';

export interface TemplateFile {
  path: string;
  content: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  gradient: string;
  files: TemplateFile[];
}

const templates: Template[] = [
  {
    id: 'react-fullstack',
    name: 'React 全栈应用',
    description: 'React + Express + TypeScript，含基本路由和 API 示例',
    icon: '🌐',
    tags: ['React', 'Express', 'TypeScript'],
    gradient: 'from-[#388bfd]/30 to-[#58a6ff]/10',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'react-fullstack-app',
          version: '1.0.0',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            'react-router-dom': '^6.11.0',
          },
          devDependencies: {
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            typescript: '^5.0.0',
            vite: '^4.3.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        }, null, 2),
      },
      {
        path: 'src/App.tsx',
        content: `import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}
`,
      },
      {
        path: 'src/pages/Home.tsx',
        content: `export default function Home() {
  return (
    <div className="container">
      <h1>React 全栈应用</h1>
      <p>欢迎使用 React 全栈应用模板！</p>
    </div>
  );
}
`,
      },
      {
        path: 'src/pages/About.tsx',
        content: `export default function About() {
  return (
    <div className="container">
      <h1>关于</h1>
      <p>这是一个 React + Express + TypeScript 全栈应用。</p>
    </div>
  );
}
`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
      },
      {
        path: 'src/index.css',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #fff; color: #333; }
.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
`,
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
          },
          include: ['src'],
        }, null, 2),
      },
    ],
  },
  {
    id: 'admin-dashboard',
    name: '管理后台 Dashboard',
    description: '侧边栏导航 + 数据卡片 + 表格 + 图表占位',
    icon: '📊',
    tags: ['React', 'TypeScript', 'Dashboard'],
    gradient: 'from-[#238636]/30 to-[#2ea043]/10',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'admin-dashboard',
          version: '1.0.0',
          scripts: { dev: 'vite', build: 'tsc && vite build' },
          dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
          devDependencies: {
            '@types/react': '^18.2.0',
            typescript: '^5.0.0',
            vite: '^4.3.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        }, null, 2),
      },
      {
        path: 'src/App.tsx',
        content: `import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '2rem' }}>
        <Dashboard />
      </main>
    </div>
  );
}
`,
      },
      {
        path: 'src/components/Sidebar.tsx',
        content: `const navItems = ['仪表盘', '用户管理', '数据分析', '系统设置'];

export default function Sidebar() {
  return (
    <nav style={{ width: 220, background: '#1a1a2e', color: '#fff', padding: '1rem' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>管理后台</h2>
      {navItems.map(item => (
        <div key={item} style={{ padding: '0.75rem 1rem', borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}>
          {item}
        </div>
      ))}
    </nav>
  );
}
`,
      },
      {
        path: 'src/pages/Dashboard.tsx',
        content: `const stats = [
  { label: '总用户数', value: '12,450', change: '+12%' },
  { label: '今日订单', value: '386', change: '+5%' },
  { label: '月收入', value: '¥92,800', change: '+8%' },
  { label: '活跃用户', value: '3,241', change: '+3%' },
];

export default function Dashboard() {
  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>仪表盘</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#f5f5f5', borderRadius: 12, padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: 'green', fontSize: '0.85rem' }}>{s.change}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3>图表占位</h3>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
          图表区域
        </div>
      </div>
    </div>
  );
}
`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
`,
      },
    ],
  },
  {
    id: 'ecommerce',
    name: '电商平台',
    description: '商品列表 + 购物车 + 结算页面',
    icon: '🛒',
    tags: ['React', 'TypeScript', 'E-commerce'],
    gradient: 'from-[#d29922]/30 to-[#e3b341]/10',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'ecommerce-app',
          version: '1.0.0',
          scripts: { dev: 'vite', build: 'tsc && vite build' },
          dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
          devDependencies: {
            '@types/react': '^18.2.0',
            typescript: '^5.0.0',
            vite: '^4.3.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        }, null, 2),
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react';
import ProductList from './components/ProductList';
import Cart from './components/Cart';

export interface Product { id: number; name: string; price: number; image: string; }
export interface CartItem extends Product { qty: number; }

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);

  function addToCart(p: Product) {
    setCart(prev => {
      const exists = prev.find(i => i.id === p.id);
      if (exists) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...p, qty: 1 }];
    });
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '2rem' }}>
      <ProductList onAddToCart={addToCart} />
      <Cart items={cart} />
    </div>
  );
}
`,
      },
      {
        path: 'src/components/ProductList.tsx',
        content: `import type { Product } from '../App';

const products: Product[] = [
  { id: 1, name: '商品 A', price: 99, image: '' },
  { id: 2, name: '商品 B', price: 199, image: '' },
  { id: 3, name: '商品 C', price: 299, image: '' },
];

export default function ProductList({ onAddToCart }: { onAddToCart: (p: Product) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <h2>商品列表</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
        {products.map(p => (
          <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: '1rem' }}>
            <div style={{ height: 120, background: '#f5f5f5', borderRadius: 8, marginBottom: '0.75rem' }} />
            <h3>{p.name}</h3>
            <p style={{ color: '#666' }}>¥{p.price}</p>
            <button onClick={() => onAddToCart(p)} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              加入购物车
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
`,
      },
      {
        path: 'src/components/Cart.tsx',
        content: `import type { CartItem } from '../App';

export default function Cart({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return (
    <div style={{ width: 300, border: '1px solid #eee', borderRadius: 12, padding: '1rem', alignSelf: 'flex-start' }}>
      <h2>购物车</h2>
      {items.length === 0 ? <p style={{ color: '#999', marginTop: '0.5rem' }}>购物车为空</p> : (
        <>
          {items.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5' }}>
              <span>{i.name} x{i.qty}</span>
              <span>¥{i.price * i.qty}</span>
            </div>
          ))}
          <div style={{ marginTop: '1rem', fontWeight: 700 }}>合计：¥{total}</div>
          <button style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            立即结算
          </button>
        </>
      )}
    </div>
  );
}
`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
`,
      },
    ],
  },
  {
    id: 'mobile-h5',
    name: '移动端 H5',
    description: '响应式布局 + 底部 Tab 导航',
    icon: '📱',
    tags: ['React', 'H5', '响应式'],
    gradient: 'from-[#8957e5]/30 to-[#a371f7]/10',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'mobile-h5',
          version: '1.0.0',
          scripts: { dev: 'vite', build: 'tsc && vite build' },
          dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
          devDependencies: {
            '@types/react': '^18.2.0',
            typescript: '^5.0.0',
            vite: '^4.3.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        }, null, 2),
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react';
import TabBar from './components/TabBar';
import Home from './pages/Home';
import Profile from './pages/Profile';

const pages: Record<string, React.ReactNode> = {
  home: <Home />,
  profile: <Profile />,
};

export default function App() {
  const [tab, setTab] = useState('home');
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8f8f8' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 60 }}>{pages[tab]}</div>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
`,
      },
      {
        path: 'src/components/TabBar.tsx',
        content: `const tabs = [
  { id: 'home', label: '首页', icon: '🏠' },
  { id: 'discover', label: '发现', icon: '🔍' },
  { id: 'message', label: '消息', icon: '💬' },
  { id: 'profile', label: '我的', icon: '👤' },
];

export default function TabBar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #eee', display: 'flex' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ flex: 1, padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: active === t.id ? '#4f46e5' : '#999', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
`,
      },
      {
        path: 'src/pages/Home.tsx',
        content: `export default function Home() {
  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>首页</h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
        <p>欢迎使用移动端 H5 模板</p>
      </div>
    </div>
  );
}
`,
      },
      {
        path: 'src/pages/Profile.tsx',
        content: `export default function Profile() {
  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>个人中心</h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e5e7eb', margin: '0 auto 1rem' }} />
        <p style={{ fontWeight: 600 }}>用户名</p>
        <p style={{ color: '#999', fontSize: '0.85rem' }}>user@example.com</p>
      </div>
    </div>
  );
}
`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
`,
      },
    ],
  },
  {
    id: 'blog-cms',
    name: '博客/CMS',
    description: 'Markdown 文章列表 + 详情页 + 分类',
    icon: '📝',
    tags: ['React', 'Markdown', 'CMS'],
    gradient: 'from-[#f85149]/30 to-[#ff7b72]/10',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'blog-cms',
          version: '1.0.0',
          scripts: { dev: 'vite', build: 'tsc && vite build' },
          dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
          devDependencies: {
            '@types/react': '^18.2.0',
            typescript: '^5.0.0',
            vite: '^4.3.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        }, null, 2),
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react';
import PostList from './components/PostList';
import PostDetail from './components/PostDetail';

export interface Post { id: number; title: string; category: string; date: string; content: string; }

export const posts: Post[] = [
  { id: 1, title: 'React 18 新特性解析', category: '前端', date: '2024-01-15', content: '# React 18 新特性\\n\\nReact 18 带来了并发模式...' },
  { id: 2, title: 'TypeScript 最佳实践', category: '前端', date: '2024-01-10', content: '# TypeScript 最佳实践\\n\\n类型安全是...' },
  { id: 3, title: 'Node.js 性能优化', category: '后端', date: '2024-01-05', content: '# Node.js 性能优化\\n\\n事件循环...' },
];

export default function App() {
  const [selected, setSelected] = useState<Post | null>(null);
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>我的博客</h1>
      {selected ? <PostDetail post={selected} onBack={() => setSelected(null)} /> : <PostList onSelect={setSelected} />}
    </div>
  );
}
`,
      },
      {
        path: 'src/components/PostList.tsx',
        content: `import { posts } from '../App';
import type { Post } from '../App';

export default function PostList({ onSelect }: { onSelect: (p: Post) => void }) {
  return (
    <div>
      {posts.map(p => (
        <div key={p.id} onClick={() => onSelect(p)} style={{ border: '1px solid #eee', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem', cursor: 'pointer' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ background: '#eff6ff', color: '#3b82f6', borderRadius: 6, padding: '2px 10px', fontSize: '0.8rem' }}>{p.category}</span>
            <span style={{ color: '#999', fontSize: '0.85rem' }}>{p.date}</span>
          </div>
          <h2 style={{ fontSize: '1.1rem' }}>{p.title}</h2>
        </div>
      ))}
    </div>
  );
}
`,
      },
      {
        path: 'src/components/PostDetail.tsx',
        content: `import type { Post } from '../App';

export default function PostDetail({ post, onBack }: { post: Post; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: '1.5rem', background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer' }}>← 返回列表</button>
      <h1>{post.title}</h1>
      <div style={{ color: '#999', marginBottom: '1.5rem' }}>{post.date} · {post.category}</div>
      <div style={{ lineHeight: 1.8 }}>{post.content}</div>
    </div>
  );
}
`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
`,
      },
    ],
  },
  {
    id: 'auth-pages',
    name: '登录注册页',
    description: '表单验证 + 多种登录方式 UI',
    icon: '🔐',
    tags: ['React', 'TypeScript', '表单'],
    gradient: 'from-[#388bfd]/30 to-[#238636]/10',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'auth-pages',
          version: '1.0.0',
          scripts: { dev: 'vite', build: 'tsc && vite build' },
          dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
          devDependencies: {
            '@types/react': '^18.2.0',
            typescript: '^5.0.0',
            vite: '^4.3.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        }, null, 2),
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  const [page, setPage] = useState<'login' | 'register'>('login');
  return page === 'login'
    ? <Login onSwitch={() => setPage('register')} />
    : <Register onSwitch={() => setPage('login')} />;
}
`,
      },
      {
        path: 'src/pages/Login.tsx',
        content: `import { useState } from 'react';

export default function Login({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!email) e.email = '请输入邮箱';
    else if (!/^[^@]+@[^@]+$/.test(email)) e.email = '邮箱格式不正确';
    if (!password) e.password = '请输入密码';
    else if (password.length < 6) e.password = '密码至少 6 位';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) alert('登录成功');
  }

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.95rem', outline: 'none' };
  const labelStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 16, padding: '2.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>登录</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>邮箱</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            {errors.email && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: 4 }}>{errors.email}</p>}
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>密码</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" />
            {errors.password && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: 4 }}>{errors.password}</p>}
          </div>
          <button type="submit" style={{ width: '100%', padding: '0.85rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}>登录</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#666', fontSize: '0.9rem' }}>
          没有账号？<button onClick={onSwitch} style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: 600 }}>立即注册</button>
        </div>
      </div>
    </div>
  );
}
`,
      },
      {
        path: 'src/pages/Register.tsx',
        content: `import { useState } from 'react';

export default function Register({ onSwitch }: { onSwitch: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) { alert('请填写所有字段'); return; }
    alert('注册成功');
  }

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.95rem', outline: 'none' };
  const labelStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 16, padding: '2.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>注册</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>用户名</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="请输入用户名" />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>邮箱</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>密码</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" />
          </div>
          <button type="submit" style={{ width: '100%', padding: '0.85rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}>注册</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#666', fontSize: '0.9rem' }}>
          已有账号？<button onClick={onSwitch} style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: 600 }}>立即登录</button>
        </div>
      </div>
    </div>
  );
}
`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
`,
      },
    ],
  },
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: '营销着陆页，Hero + 功能介绍 + CTA',
    icon: '🎨',
    tags: ['React', 'TypeScript', 'Landing'],
    gradient: 'from-[#d29922]/30 to-[#8957e5]/10',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'landing-page',
          version: '1.0.0',
          scripts: { dev: 'vite', build: 'tsc && vite build' },
          dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
          devDependencies: {
            '@types/react': '^18.2.0',
            typescript: '^5.0.0',
            vite: '^4.3.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        }, null, 2),
      },
      {
        path: 'src/App.tsx',
        content: `import Hero from './sections/Hero';
import Features from './sections/Features';
import CTA from './sections/CTA';

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <Hero />
      <Features />
      <CTA />
    </div>
  );
}
`,
      },
      {
        path: 'src/sections/Hero.tsx',
        content: `export default function Hero() {
  return (
    <section style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', padding: '6rem 2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>
        构建你的下一个<br />伟大产品
      </h1>
      <p style={{ fontSize: '1.2rem', opacity: 0.9, marginBottom: '2.5rem', maxWidth: 600, margin: '0 auto 2.5rem' }}>
        使用我们的平台，快速将你的想法转化为现实。简单、高效、强大。
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button style={{ padding: '0.875rem 2rem', background: '#fff', color: '#7c3aed', border: 'none', borderRadius: 50, fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>免费开始</button>
        <button style={{ padding: '0.875rem 2rem', background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.5)', borderRadius: 50, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>了解更多</button>
      </div>
    </section>
  );
}
`,
      },
      {
        path: 'src/sections/Features.tsx',
        content: `const features = [
  { icon: '⚡', title: '极速部署', desc: '一键部署，秒级上线，无需复杂配置' },
  { icon: '🔒', title: '安全可靠', desc: '企业级安全保障，数据加密存储' },
  { icon: '📈', title: '弹性扩展', desc: '自动扩容，轻松应对流量高峰' },
  { icon: '🛠️', title: '开发者友好', desc: '完善的 API 文档和 SDK 支持' },
  { icon: '🌍', title: '全球加速', desc: '全球 CDN 节点，毫秒级响应' },
  { icon: '💬', title: '7×24 支持', desc: '专业团队全天候技术支持' },
];

export default function Features() {
  return (
    <section style={{ padding: '5rem 2rem', background: '#f9fafb' }}>
      <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 700, marginBottom: '3rem' }}>核心功能</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        {features.map(f => (
          <div key={f.title} style={{ background: '#fff', borderRadius: 16, padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{f.icon}</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{f.title}</h3>
            <p style={{ color: '#666', lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`,
      },
      {
        path: 'src/sections/CTA.tsx',
        content: `export default function CTA() {
  return (
    <section style={{ background: '#1e1b4b', color: '#fff', padding: '5rem 2rem', textAlign: 'center' }}>
      <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>准备好开始了吗？</h2>
      <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', fontSize: '1.1rem' }}>加入数千名开发者，立即体验。</p>
      <button style={{ padding: '1rem 3rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 50, fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' }}>
        立即免费注册
      </button>
    </section>
  );
}
`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
`,
      },
    ],
  },
  {
    id: 'api-service',
    name: 'API 服务',
    description: 'Express + RESTful API + Swagger 文档',
    icon: '⚡',
    tags: ['Express', 'Node.js', 'REST API'],
    gradient: 'from-[#238636]/30 to-[#388bfd]/10',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'api-service',
          version: '1.0.0',
          main: 'dist/index.js',
          scripts: {
            dev: 'ts-node src/index.ts',
            build: 'tsc',
            start: 'node dist/index.js',
          },
          dependencies: {
            express: '^4.18.2',
            cors: '^2.8.5',
          },
          devDependencies: {
            '@types/express': '^4.17.17',
            '@types/cors': '^2.8.13',
            '@types/node': '^20.0.0',
            typescript: '^5.0.0',
            'ts-node': '^10.9.1',
          },
        }, null, 2),
      },
      {
        path: 'src/index.ts',
        content: `import express from 'express';
import cors from 'cors';
import usersRouter from './routes/users';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/users', usersRouter);

app.listen(PORT, () => {
  console.log(\`API server running on http://localhost:\${PORT}\`);
});

export default app;
`,
      },
      {
        path: 'src/routes/users.ts',
        content: `import { Router } from 'express';

const router = Router();

interface User { id: number; name: string; email: string; }
const users: User[] = [
  { id: 1, name: '张三', email: 'zhangsan@example.com' },
  { id: 2, name: '李四', email: 'lisi@example.com' },
];

// GET /api/users
router.get('/', (_, res) => {
  res.json({ data: users, total: users.length });
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ data: user });
});

// POST /api/users
router.post('/', (req, res) => {
  const { name, email } = req.body as { name: string; email: string };
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  const user = { id: users.length + 1, name, email };
  users.push(user);
  res.status(201).json({ data: user });
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const idx = users.findIndex(u => u.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '用户不存在' });
  users.splice(idx, 1);
  res.json({ success: true });
});

export default router;
`,
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            lib: ['ES2020'],
            outDir: 'dist',
            rootDir: 'src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
          include: ['src'],
        }, null, 2),
      },
      {
        path: 'README.md',
        content: `# API 服务

基于 Express + TypeScript 的 RESTful API。

## 启动

\`\`\`bash
npm install
npm run dev
\`\`\`

## 接口

- \`GET /health\` — 健康检查
- \`GET /api/users\` — 获取用户列表
- \`GET /api/users/:id\` — 获取用户详情
- \`POST /api/users\` — 创建用户
- \`DELETE /api/users/:id\` — 删除用户
`,
      },
    ],
  },
];

export function getTemplates(): Omit<Template, 'files'>[] {
  return templates.map(({ files: _files, ...rest }) => rest);
}

export function getTemplateById(id: string): Template | undefined {
  return templates.find(t => t.id === id);
}

export function createProjectFromTemplate(
  templateId: string,
  projectName: string,
  targetPath: string
): { projectPath: string; filesCreated: number } {
  const template = getTemplateById(templateId);
  if (!template) throw new Error(`模板 "${templateId}" 不存在`);

  const projectPath = path.join(targetPath, projectName);

  if (fs.existsSync(projectPath)) {
    throw new Error(`目录已存在: ${projectPath}`);
  }

  fs.mkdirSync(projectPath, { recursive: true });

  for (const file of template.files) {
    const filePath = path.join(projectPath, file.path);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, file.content, 'utf-8');
  }

  return { projectPath, filesCreated: template.files.length };
}
