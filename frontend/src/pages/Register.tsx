import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useForm } from '../hooks/useForm';
import { ShieldCheck, Mail, Lock, User, UserPlus } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert } from '../components/UI';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  department: string;
  phone: string;
}

export function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { values, handleChange, handleBlur, errors, setFieldError } = useForm<RegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    department: '',
    phone: '',
  });

  const validateField = (name: keyof RegisterForm, value: string) => {
    switch (name) {
      case 'username':
        if (!value) return 'Username is required';
        if (value.length < 3) return 'Username must be at least 3 characters';
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores';
        break;
      case 'email':
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
        break;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        break;
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== values.password) return 'Passwords do not match';
        break;
      case 'full_name':
        if (!value) return 'Full name is required';
        break;
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let hasErrors = false;
    (Object.keys(values) as Array<keyof RegisterForm>).forEach(key => {
      const err = validateField(key, values[key]);
      if (err) {
        setFieldError(key, err);
        hasErrors = true;
      }
    });

    if (hasErrors) return;

    setIsLoading(true);
    try {
      await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        department: values.department || undefined,
        phone: values.phone || undefined,
      });
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err: any) {
      const message = getErrorMessage(err, 'Registration failed. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4 shadow-md">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div className="text-amber-800 dark:text-amber-400 font-extrabold text-2xl tracking-widest font-serif mb-0.5">
            मानक
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Label Compliance Checker</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Create your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Register</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                id="full_name"
                name="full_name"
                label="Full Name"
                type="text"
                autoComplete="name"
                value={values.full_name}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.full_name}
                placeholder="Enter your full name"
                disabled={isLoading}
                leftIcon={<User className="w-5 h-5 text-gray-400" />}
              />

              <Input
                id="username"
                name="username"
                label="Username"
                type="text"
                autoComplete="username"
                value={values.username}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.username}
                placeholder="Choose a username"
                disabled={isLoading}
                leftIcon={<UserPlus className="w-5 h-5 text-gray-400" />}
              />

              <Input
                id="email"
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.email}
                placeholder="Enter your email"
                disabled={isLoading}
                leftIcon={<Mail className="w-5 h-5 text-gray-400" />}
              />

              <Input
                id="department"
                name="department"
                label="Department (Optional)"
                type="text"
                value={values.department}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g., Food Safety Division"
                disabled={isLoading}
              />

              <Input
                id="phone"
                name="phone"
                label="Phone (Optional)"
                type="tel"
                value={values.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="+91 XXXXX XXXXX"
                disabled={isLoading}
              />

              <Input
                id="password"
                name="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.password}
                placeholder="At least 8 characters"
                disabled={isLoading}
                leftIcon={<Lock className="w-5 h-5 text-gray-400" />}
              />

              <Input
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.confirmPassword}
                placeholder="Confirm your password"
                disabled={isLoading}
                leftIcon={<Lock className="w-5 h-5 text-gray-400" />}
              />

              <Button type="submit" className="w-full" size="lg" loading={isLoading}>
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}