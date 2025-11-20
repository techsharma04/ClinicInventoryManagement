// src/components/ProtectedRoute.jsx
import React from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute() {
  const { user, initialized } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!initialized) {
    return <div className="text-center text-light mt-5">Loading...</div>;
  }

  if (!user) {
    return (
      <Navigate
        to="/auth/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return <Outlet />;
}
