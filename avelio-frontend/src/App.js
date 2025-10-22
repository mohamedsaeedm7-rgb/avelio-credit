 import React from 'react';
 import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewReceipt from './pages/NewReceipt';
import ReceiptSuccess from './pages/ReceiptSuccess';
import Account from './pages/Account';
import Receipts from './pages/Receipts';          
import TravelAgencies from './pages/TravelAgencies';
import ExportData from './pages/ExportData';
import Analytics from './pages/Analytics';      
import AppHeader from './pages/AppHeader';      

 function App() {
   const isAuthed = !!localStorage.getItem('token');

   return (
     <Router>
       <AppHeader />
       <Routes>
         <Route path="/login" element={<Login />} />
         <Route path="/dashboard" element={isAuthed ? <Dashboard /> : <Navigate to="/login" />} />
         <Route path="/new-receipt" element={isAuthed ? <NewReceipt /> : <Navigate to="/login" />} />
         <Route path="/receipt-success" element={isAuthed ? <ReceiptSuccess /> : <Navigate to="/login" />} />
         <Route path="/account" element={isAuthed ? <Account /> : <Navigate to="/login" />} />
         <Route path="/receipts" element={isAuthed ? <Receipts /> : <Navigate to="/login" />} />
         <Route path="/agencies" element={isAuthed ? <TravelAgencies /> : <Navigate to="/login" />} />
         <Route path="/export" element={isAuthed ? <ExportData /> : <Navigate to="/login" />} />
         <Route path="/analytics" element={isAuthed ? <Analytics /> : <Navigate to="/login" />} />
         <Route path="*" element={<Navigate to={isAuthed ? '/dashboard' : '/login'} />} />

       </Routes>
     </Router>
   );
 }

 export default App;