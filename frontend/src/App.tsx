import React from 'react';
import { DataIngestion } from './DataIngestion';

const App: React.FC = () => {
  return (
    <div className="App" data-testid="app-root">
      <DataIngestion />
    </div>
  );
};

export default App;