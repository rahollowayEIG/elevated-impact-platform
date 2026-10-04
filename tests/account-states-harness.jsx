import React from 'react';
import { createRoot } from 'react-dom/client';
import { EigUserManagement } from '../src/PlatformApp.jsx';
import '../src/styles.css';
createRoot(document.getElementById('root')).render(<main className="platform-main-content"><EigUserManagement currentUserId="synthetic-admin" onBack={() => {}} onInviteUser={() => {}} /></main>);
