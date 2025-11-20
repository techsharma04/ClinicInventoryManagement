// src/components/SidebarLayout.jsx
import React, { useState } from "react";
import { Nav, Navbar, Button, Collapse } from "react-bootstrap";
import { NavLink, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutDoctor } from "../features/authSlice";
import "../styles/Layout.css";
import logo from "../assets/images/hospital-logo.png";

export default function SidebarLayout() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [openPatients, setOpenPatients] = useState(false);
  const [openConsultations, setOpenConsultations] = useState(false);

  const handleLogout = () => {
    dispatch(logoutDoctor());
  };

  const linkClass =
    ({ isActive }) =>
      "sidebar-link" + (isActive ? " active" : "");

  const subLinkClass =
    ({ isActive }) =>
      "sidebar-sublink" + (isActive ? " active" : "");

  return (
    <div className="layout-root">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img
            src={logo}
            alt="Hospital Logo"
            style={{
              width: "85%",
              objectFit: "contain",
              filter: "drop-shadow(0 0 4px rgba(255,255,255,0.5))",
            }}
          />
        </div>

        <Nav className="flex-column">
          <NavLink to="/app/dashboard" className={linkClass}>
            <i className="bi bi-speedometer2" />
            Dashboard
          </NavLink>

          <NavLink to="/app/medicines" className={linkClass}>
            <i className="bi bi-capsule" />
            Medicines
          </NavLink>

          {/* Patients group */}
          <button
            type="button"
            className="sidebar-link sidebar-group-toggle"
            onClick={() => setOpenPatients((o) => !o)}
          >
            <i className="bi bi-people" />
            Patients
            <span className="ms-auto">{openPatients ? "▾" : "▸"}</span>
          </button>
          <Collapse in={openPatients}>
            <div>
              <NavLink to="/app/patients/new" className={subLinkClass}>
                <i className="bi bi-person-plus" />
                New Patient
              </NavLink>
              <NavLink
                to="/app/patients/registered"
                className={subLinkClass}
              >
                <i className="bi bi-person-badge" />
                Registered Patients
              </NavLink>
            </div>
          </Collapse>

          {/* Consultations group */}
          <button
            type="button"
            className="sidebar-link sidebar-group-toggle"
            onClick={() => setOpenConsultations((o) => !o)}
          >
            <i className="bi bi-journal-medical" />
            Consultations
            <span className="ms-auto">{openConsultations ? "▾" : "▸"}</span>
          </button>
          <Collapse in={openConsultations}>
            <div>
              <NavLink
                to="/app/consultations/new"
                className={subLinkClass}
              >
                <i className="bi bi-pencil-square" />
                New Prescription
              </NavLink>
              <NavLink
                to="/app/consultations/previous"
                className={subLinkClass}
              >
                <i className="bi bi-folder2-open" />
                Previous Consultations
              </NavLink>
            </div>
          </Collapse>
        </Nav>
      </aside>

      <div className="main-content">
        <Navbar
          bg="white"
          className="shadow-sm px-3 main-topbar d-flex justify-content-between"
        >
          <Navbar.Brand className="small">
            Welcome:&nbsp;
            <strong>Dr. {user?.name || user?.email}</strong>
          </Navbar.Brand>
          <Button variant="outline-danger" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </Navbar>

        <main className="content-inner">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
