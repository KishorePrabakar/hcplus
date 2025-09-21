import { useAuth } from '../context/AuthContext';
import StudentDashboard from './StudentDashboard';
import StaffQueue from './StaffQueue';

export default function DashboardRouter() {
  const { user } = useAuth();
  return user.role === 'STUDENT' ? <StudentDashboard /> : <StaffQueue embedded />;
}
