import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useForm } from '../hooks/useForm';
import { ShieldCheck, Mail, Lock } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert } from '../components/UI';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';
import { ConstellationBackground } from '../components/ConstellationBackground';

interface LoginForm {
  username_or_email: string;
  password: string;
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { values, handleChange, handleBlur, errors, setFieldError } = useForm<LoginForm>({
    username_or_email: '',
    password: '',
  });

  const validateField = (name: keyof LoginForm, value: string) => {
    if (name === 'username_or_email' && !value) return 'Username or email is required';
    if (name === 'password' && !value) return 'Password is required';
    if (name === 'password' && value.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    let hasErrors = false;
    (Object.keys(values) as Array<keyof LoginForm>).forEach(key => {
      const err = validateField(key, values[key]);
      if (err) {
        setFieldError(key, err);
        hasErrors = true;
      }
    });

    if (hasErrors) return;

    setIsLoading(true);
    try {
      await login(values.username_or_email, values.password);
      toast.success('Welcome back!');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const message = getErrorMessage(err, 'Invalid credentials. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-950 text-slate-100 px-4 py-12">
      {/* Moving Connected Dots / Constellation Background Canvas */}
      <ConstellationBackground />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 mb-3 shadow-lg shadow-sky-500/30 border border-sky-400/30">
            <ShieldCheck className="w-9 h-9 text-white drop-shadow" />
          </div>
          <div className="text-amber-400 font-extrabold text-2xl tracking-widest font-serif mb-1 drop-shadow-[0_2px_10px_rgba(251,191,36,0.3)]">
            मानक
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">Label Compliance Checker</h1>
          <p className="text-sky-200/80 mt-1 text-sm font-medium">Sign in to your account</p>
        </div>

        <Card className="bg-slate-900/85 backdrop-blur-xl border border-sky-500/20 shadow-[0_0_50px_rgba(0,180,255,0.15)] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">Welcome back</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                id="username_or_email"
                name="username_or_email"
                label="Username or Email"
                type="text"
                autoComplete="username"
                value={values.username_or_email}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.username_or_email}
                placeholder="Enter username or email"
                disabled={isLoading}
                leftIcon={<Mail className="w-5 h-5 text-sky-400" />}
              />

              <Input
                id="password"
                name="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.password}
                placeholder="Enter password"
                disabled={isLoading}
                leftIcon={<Lock className="w-5 h-5 text-sky-400" />}
              />

              <Button type="submit" className="w-full shadow-lg shadow-sky-600/30 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 font-semibold" size="lg" loading={isLoading}>
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-300">
                Don't have an account?{' '}
                <Link to="/register" className="text-sky-400 hover:text-sky-300 font-semibold transition-colors">
                  Create one
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-slate-400">
          <p>Demo credentials: <code className="bg-slate-800/80 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded-md font-mono">inspector</code> / <code className="bg-slate-800/80 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded-md font-mono">password123</code></p>
        </div>
      </div>
    </div>
  );
}