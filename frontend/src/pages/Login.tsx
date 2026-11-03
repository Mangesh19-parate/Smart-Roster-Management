/**
 * Login Page - Supabase Auth with Demo Buttons
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, signInDemo, DEMO_USERS } from '../api/supabase';
import { useAuth } from '../hooks/useAuth';

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
      await supabase.auth.signInWithPassword({ email, password });
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Smart Roster</h1>
          <p className="text-slate-500 mt-1">Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo Buttons */}
          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Demo Mode</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DEMO_USERS).map(([key, user]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDemoLogin(key as keyof typeof DEMO_USERS)}
                  disabled={demoLoading !== null}
                  className="py-2 px-3 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-colors"
                >
                  {demoLoading === key ? '...' : `Continue as ${user.role.replace('_', ' ')}`}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-slate-500 text-center">
              Demo data resets daily.
            </p>
          </div>
        </div>

        {/* Cold Start Notice */}
        <div className="mt-4 text-center text-xs text-slate-500">
          <p>Waking up the server, this can take up to 50 seconds on first request.</p>
        </div>
      </div>
    </div>
  );
}