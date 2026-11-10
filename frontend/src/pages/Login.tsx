/**
 * Login Page - Airtable Inspired Auth Screen with Demo Buttons
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signInDemo, DEMO_USERS } from '../api/supabase';
import { useAuth } from '../hooks/useAuth';
import { CalendarCheck2 } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<keyof typeof DEMO_USERS | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      await refreshUser();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: keyof typeof DEMO_USERS) => {
    setError('');
    setDemoLoading(role);
    try {
      await signInDemo(role);
      await refreshUser();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        {/* Brand Logo Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#181d26] text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
            <CalendarCheck2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-[#181d26] tracking-tight">Smart Roster</h1>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-[#dddddd] shadow-sm p-7">
          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 text-sm border border-[#dddddd] rounded-xl focus:outline-none focus:border-[#181d26] text-[#181d26] transition-colors"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-[#dddddd] rounded-xl focus:outline-none focus:border-[#181d26] text-[#181d26] transition-colors"
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div className="p-3 text-xs text-[#aa2d00] bg-[#fef2f2] border border-[#fecaca] rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#181d26] text-white rounded-xl font-medium text-sm hover:bg-[#0d1218] active:bg-[#000000] focus:outline-none disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? 'Signing in...' : 'Sign in to workspace'}
            </button>
          </form>

          {/* Demo Buttons */}
          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#dddddd]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-[#9297a0] font-medium">Quick Demo Access</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DEMO_USERS).map(([key, user]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDemoLogin(key as keyof typeof DEMO_USERS)}
                  disabled={demoLoading !== null}
                  className="py-2.5 px-2 bg-white border border-[#dddddd] hover:border-[#181d26] rounded-xl text-xs font-medium text-[#181d26] hover:bg-[#f8fafc] focus:outline-none disabled:opacity-50 transition-all text-center truncate shadow-xs"
                >
                  {demoLoading === key ? '...' : `As ${user.role.replace('_', ' ')}`}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-[#9297a0] text-center">
              Self-contained sandbox with seed December 2026 data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
