import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { ThemeProvider } from '@/hooks/useTheme';

import CommandCenterPage   from '@/pages/CommandCenter';
import UploadJobPage       from '@/pages/UploadJob';
import RankingsPage        from '@/pages/Rankings';
import CandidatesPage      from '@/pages/Candidates';
import WorkforcePage       from '@/pages/Workforce';
import AnalyticsPage       from '@/pages/Analytics';
import ExecutiveReportPage from '@/pages/ExecutiveReport';
import CopilotPage         from '@/pages/Copilot';
import SimulatorPage       from '@/pages/Simulator';
import EvaluationPage      from '@/pages/Evaluation';
import GpuBenchmarkPage    from '@/pages/GpuBenchmark';
import SettingsPage        from '@/pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"                 element={<CommandCenterPage />} />
            <Route path="/upload-job"       element={<UploadJobPage />} />
            <Route path="/rankings"         element={<RankingsPage />} />
            <Route path="/candidates"       element={<CandidatesPage />} />
            <Route path="/workforce"        element={<WorkforcePage />} />
            <Route path="/analytics"        element={<AnalyticsPage />} />
            <Route path="/executive-report" element={<ExecutiveReportPage />} />
            <Route path="/copilot"          element={<CopilotPage />} />
            <Route path="/simulator"        element={<SimulatorPage />} />
            <Route path="/evaluation"       element={<EvaluationPage />} />
            <Route path="/gpu-benchmark"    element={<GpuBenchmarkPage />} />
            <Route path="/settings"         element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
