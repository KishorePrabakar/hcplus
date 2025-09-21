import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Profile</h1>
      <Card className="space-y-2 text-sm">
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Role" value={user.role.toLowerCase()} />
        {user.hostel && <Row label="Hostel" value={user.hostel} />}
        {user.roomNumber && <Row label="Room" value={user.roomNumber} />}
        <Row label="Member since" value={new Date(user.createdAt).toLocaleDateString()} />
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-none">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
