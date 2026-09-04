import React, {
  useEffect,
  useState
} from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = String(
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000'
).replace(/\/api\/?$/, '');

const fields = [
  ['price', 'Monthly Price'],
  ['durationDays', 'Validity Days'],
  ['visitorPasses', 'Visitor Passes'],
  ['branches', 'Branches'],
  ['users', 'System Users'],
  ['securityUsers', 'Security Users'],
  ['admins', 'Admins']
];

const SaasPlanManagement = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [savingId, setSavingId] =
    useState(null);
  const [message, setMessage] =
    useState('');

  const getHeaders = () => {
    const token = user?.token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Company-Id': 'SYSTEM',
      'X-User-Role': user?.role || 'SaaS Super Admin',
      'X-User-Id': user?.id || user?._id || ''
    };
  };

  const fetchPlans = async () => {
    if (user && !['SaaS Super Admin', 'Super Admin'].includes(user.role)) {
      setMessage('Forbidden: Admin access required.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/plans/admin`,
        {
          headers: getHeaders()
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || 'Failed to load plans.'
        );
      }

      setPlans(result.data || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [user]);

  const handleChange = (
    planId,
    field,
    value
  ) => {
    setPlans((currentPlans) =>
      currentPlans.map((plan) =>
        plan._id === planId
          ? {
              ...plan,
              [field]:
                field === 'description'
                  ? value
                  : Number(value)
            }
          : plan
      )
    );
  };

  const savePlan = async (plan) => {
    try {
      setSavingId(plan._id);
      setMessage('');

      const response = await fetch(
        `${API_URL}/api/plans/${plan._id}`,
        {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            price: plan.price,
            durationDays: plan.durationDays,
            visitorPasses:
              plan.visitorPasses,
            branches: plan.branches,
            users: plan.users,
            securityUsers:
              plan.securityUsers,
            admins: plan.admins,
            reports: plan.reports,
            description: plan.description,
            features: plan.features,
            isActive: plan.isActive
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          'Failed to update plan.'
        );
      }

      setPlans((currentPlans) =>
        currentPlans.map((item) =>
          item._id === plan._id
            ? result.data
            : item
        )
      );

      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        Loading plans...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Plan Management
        </h1>

        <p className="text-sm text-slate-500">
          Changes will automatically appear on
          tenant upgrade pages.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
          {message}
        </div>
      )}

      {plans.length === 0 && !loading && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-slate-800">No Subscription Plans Found</h3>
          <p className="mt-2 text-sm text-slate-500">
            Initialize default plans (One Day Trial, Basic, Standard, Enterprise) to start managing plan limits.
          </p>
          <button
            type="button"
            onClick={fetchPlans}
            className="mt-5 rounded-xl bg-[#1E1B6E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900 transition-colors shadow-md"
          >
            Reload & Fetch Plans
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan._id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {plan.name}
              </h2>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  plan.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {plan.isActive
                  ? 'Active'
                  : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    {label}
                  </label>

                  <input
                    type="number"
                    value={plan[field]}
                    min={
                      field === 'durationDays'
                        ? 1
                        : -1
                    }
                    onChange={(event) =>
                      handleChange(
                        plan._id,
                        field,
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                  />
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Use -1 for unlimited limits.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Description
              </label>

              <textarea
                value={plan.description || ''}
                onChange={(event) =>
                  handleChange(
                    plan._id,
                    'description',
                    event.target.value
                  )
                }
                rows="3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={plan.isActive}
                onChange={(event) =>
                  setPlans((current) =>
                    current.map((item) =>
                      item._id === plan._id
                        ? {
                            ...item,
                            isActive:
                              event.target.checked
                          }
                        : item
                    )
                  )
                }
              />

              <span className="text-sm text-slate-700">
                Plan active
              </span>
            </div>

            <button
              type="button"
              disabled={savingId === plan._id}
              onClick={() => savePlan(plan)}
              className="mt-5 w-full rounded-lg bg-[#1E1B6E] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingId === plan._id
                ? 'Saving...'
                : 'Save Plan Changes'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SaasPlanManagement;
