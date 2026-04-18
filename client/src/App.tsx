import AnalysisPage from './pages/analysis';
import FeedbackWidget from './components/FeedbackWidget';
import MagicLinkLogin from './components/MagicLinkLogin';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './hooks/useAuth';

function App() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f6f7fb',
        color: '#6b7280',
        fontFamily: '-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif',
      }}>
        Loading...
      </div>
    );
  }

  if (!auth.user) {
    return <MagicLinkLogin />;
  }

  return (
    <ErrorBoundary>
      <AnalysisPage />
      <FeedbackWidget />
    </ErrorBoundary>
  );
}

export default App;
