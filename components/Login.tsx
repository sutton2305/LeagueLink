
import React, { useState } from 'react';
import TrophyIcon from './icons/TrophyIcon';
import { User, SignUpData } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  onSignUp: (user: SignUpData) => boolean;
  users: User[];
}

const Login: React.FC<LoginProps> = ({ onLogin, onSignUp, users }) => {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSigningUp) {
        const success = onSignUp({ email, password });
        if (success) {
            setIsSigningUp(false);
            setEmail('');
            setPassword('');
        }
    } else {
        const normalizedEmail = email.toLowerCase();
        const user = users.find(u => u.email === normalizedEmail && u.password === password);
        if (user) {
            onLogin(user);
        } else {
            alert('Invalid email or password.');
        }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-8 bg-brand-surface rounded-2xl shadow-2xl">
        <div className="text-center">
          <TrophyIcon className="w-16 h-16 mx-auto text-brand-primary" />
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-brand-text">
            League Link
          </h1>
          <p className="mt-2 text-brand-text-secondary">
            {isSigningUp ? "Create an account to manage your leagues" : "Sign in to manage your league"}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-brand-bg text-brand-text placeholder-gray-400 rounded-t-md focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-brand-bg text-brand-text placeholder-gray-400 rounded-b-md focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-brand-bg bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-bg focus:ring-brand-secondary transition-colors"
            >
              {isSigningUp ? "Sign up" : "Sign in"}
            </button>
          </div>
        </form>
        <div className="text-center">
            <button onClick={() => setIsSigningUp(!isSigningUp)} className="text-sm text-brand-primary hover:underline">
                {isSigningUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
        </div>
        <div className="text-center text-xs text-brand-text-secondary pt-4 border-t border-gray-700">
            <p>For easy access, you can sign in with:</p>
            <p>Email: <strong className="text-brand-text">admin@leaguelink.com</strong></p>
            <p>Password: <strong className="text-brand-text">leaguelink</strong></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
