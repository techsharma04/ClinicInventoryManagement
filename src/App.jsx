// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { listenToAuth } from "./features/authSlice";

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import SidebarLayout from "./components/SidebarLayout";
import Dashboard from "./pages/Dashboard";
import Medicines from "./pages/Medicines";
import NewPatient from "./pages/NewPatient";
import RegisteredPatients from "./pages/RegisteredPatients";
import NewPrescription from "./pages/NewPrescription";
import PreviousConsultations from "./pages/PreviousConsultations";
import PrintPrescription from "./pages/PrintPriscription";
import Inventory from "./pages/Inventory";

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(listenToAuth());
  }, [dispatch]);

  return (
    <Routes>
      {/* auth */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/signup" element={<Signup />} />
      <Route path="/auth/forgot" element={<ForgotPassword />} />

      {/* protected app */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<SidebarLayout />}>
          <Route path="/app/inventory" element={<Inventory />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="medicines" element={<Medicines />} />
          <Route path="patients/new" element={<NewPatient />} />
          <Route path="patients/registered" element={<RegisteredPatients />} />
          <Route path="consultations/new" element={<NewPrescription />} />
          <Route path="consultations/previous" element={<PreviousConsultations />} />
          <Route path="consultations/print/:id" element={<PrintPrescription />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>

      {/* default */}
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}
