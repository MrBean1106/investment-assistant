import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import IndustryChain from './pages/IndustryChain';
import EnterpriseList from './pages/EnterpriseList';
import EnterpriseDetail from './pages/EnterpriseDetail';
import PolicyList from './pages/PolicyList';
import PropertyList from './pages/PropertyList';
import ReportList from './pages/ReportList';
import Workflow from './pages/Workflow';
import AIChat from './pages/AIChat';
import Documents from './pages/Documents';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="chain" element={<IndustryChain />} />
          <Route path="enterprises" element={<EnterpriseList />} />
          <Route path="enterprises/:id" element={<EnterpriseDetail />} />
          <Route path="policies" element={<PolicyList />} />
          <Route path="properties" element={<PropertyList />} />
          <Route path="reports" element={<ReportList />} />
          <Route path="workflow/:enterpriseId" element={<Workflow />} />
          <Route path="documents" element={<Documents />} />
          <Route path="ai" element={<AIChat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
