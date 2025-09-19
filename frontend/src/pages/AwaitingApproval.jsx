import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui';

export default function AwaitingApproval() {
  const { user, logout, booting } = useAuth();
  const navigate = useNavigate();

  if (booting) return null;
  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="max-w-md p-8 text-center">
        <div className="text-5xl">⏳</div>
        <h1 className="mt-3 text-xl font-bold">Awaiting approval</h1>
        <p className="mt-2 text-sm text-slate-500">
          Hi {user.name.split(' ')[0]}, your account is created but needs approval from a warden or
          admin before you can file complaints.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          You'll get access as soon as someone from the hostel office reviews your signup.
        </p>
        <button onClick={logout} className="mt-6 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Sign out
        </button>
      </Card>
    </div>
  );
}
