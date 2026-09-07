import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useForm } from '../hooks/useForm';
import { ShieldCheck, Mail, Lock } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert } from '../components/UI';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 px-4 py-12 transition-colors duration-200">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4 shadow-md">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div className="text-amber-800 dark:text-amber-400 font-extrabold text-2xl tracking-widest font-serif mb-0.5">
            मानक
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Label Compliance Checker</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Welcome back</CardTitle>
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
                leftIcon={<Mail className="w-5 h-5 text-gray-400" />}
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
                leftIcon={<Lock className="w-5 h-5 text-gray-400" />}
              />

              <Button type="submit" className="w-full" size="lg" loading={isLoading}>
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                  Create one
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Demo credentials: <code className="bg-gray-100 px-1.5 py-0.5 rounded">inspector</code> / <code className="bg-gray-100 px-1.5 py-0.5 rounded">password123</code></p>
        </div>
      </div>
    </div>
  );
}