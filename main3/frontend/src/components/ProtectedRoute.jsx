import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../auth';

export default function ProtectedRoute({ children }) {
  const auth = useContext(AuthContext);
  if (auth.loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">Загрузка...</div>
        </div>
      </div>
    );
  }
  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}
