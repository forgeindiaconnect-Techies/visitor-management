import { useState } from 'react';
import {
  useNavigate,
  useParams
} from 'react-router-dom';

const EmployeeActivate = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const activateAccount = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      setLoading(true);

      const baseUrl =
        import.meta.env.VITE_API_URL ||
        'http://localhost:5000';

      const response = await fetch(
        `${baseUrl}/api/user-invitations/activate/${token}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            password,
            confirmPassword
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      alert(result.message);
      navigate('/login');
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={activateAccount}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
      >
        <h1 className="text-2xl font-bold">
          Activate Employee Account
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Create your password to access your company dashboard.
        </p>

        <label className="mt-6 block font-medium text-gray-700 text-sm">
          New Password
        </label>

        <input
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          minLength={8}
          required
          className="mt-2 w-full rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <label className="mt-4 block font-medium text-gray-700 text-sm">
          Confirm Password
        </label>

        <input
          type="password"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(event.target.value)
          }
          minLength={8}
          required
          className="mt-2 w-full rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-indigo-700 p-3 font-semibold text-white hover:bg-indigo-800 transition disabled:opacity-50"
        >
          {loading
            ? 'Activating...'
            : 'Create Password'}
        </button>

        <p className="mt-6 text-center text-xs text-gray-500">
          Powered by{' '}
          <a
            href="https://forgeindiaconnect.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-indigo-700"
          >
            ForgeIndiaConnect
          </a>
        </p>
      </form>
    </main>
  );
};

export default EmployeeActivate;
