// src/components/SidebarLayout.jsx
import React, { useState } from "react";
import { Nav, Navbar, Button, Collapse } from "react-bootstrap";
import { NavLink, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutDoctor } from "../features/authSlice";
import "../styles/Layout.css";
import logo from "../assets/images/doctor-sign.png";

export default function SidebarLayout() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [openPatients, setOpenPatients] = useState(false);
  const [openConsultations, setOpenConsultations] = useState(false);
  const [isSidebarOpen, setISidebarOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logoutDoctor());
  };

  const linkClass =
    ({ isActive }) =>
      "sidebar-link" + (isActive ? " active" : "");

  const linkLogoutClass =
    ({ isActive }) =>
      "sidebar-logout-link" + (isActive ? " active" : "");

  const subLinkClass =
    ({ isActive }) =>
      "sidebar-sublink" + (isActive ? " active" : "");

  return (
    <div className="layout-root">
      <aside className={`sidebar d-flex flex-column justify-content-between ${isSidebarOpen ? "open" : "close"}`}>
        <div>
          <div className="sidebar-header">
            <img
              src={logo}
              alt="Hospital Logo"
              style={{
                width: "50px",
                objectFit: "contain",
                filter: "drop-shadow(0 0 4px rgba(255,255,255,0.5))",
              }}
            />
          </div>

          <Nav className="flex-column">
            <NavLink to="/app/dashboard" className={linkClass} onClick={() => setISidebarOpen(!isSidebarOpen)}>
              <i className="bi bi-speedometer2" />
              Dashboard
            </NavLink>

            <NavLink to="/app/medicines" className={linkClass} onClick={() => setISidebarOpen(!isSidebarOpen)}>
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
                <NavLink to="/app/patients/new" className={subLinkClass} onClick={() => setISidebarOpen(!isSidebarOpen)}>
                  <i className="bi bi-person-plus" />
                  New Patient
                </NavLink>
                <NavLink
                  to="/app/patients/registered"
                  className={subLinkClass}
                  onClick={() => setISidebarOpen(!isSidebarOpen)}>
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
                  onClick={() => setISidebarOpen(!isSidebarOpen)}>
                  <i className="bi bi-pencil-square" />
                  New Prescription
                </NavLink>
                <NavLink
                  to="/app/consultations/previous"
                  className={subLinkClass}
                  onClick={() => setISidebarOpen(!isSidebarOpen)}>
                  <i className="bi bi-folder2-open" />
                  Previous Consultations
                </NavLink>
              </div>
            </Collapse>


            <NavLink to="/app/inventory" className={linkClass} onClick={() => setISidebarOpen(!isSidebarOpen)}>
              <i class="bi bi-card-checklist"></i>
              Inventory
            </NavLink>
          </Nav>
        </div>
        <Nav className="flex-column">
          <NavLink to='/' className={linkLogoutClass} onClick={handleLogout}>
            <i class="bi bi-power"></i>
            Logout
          </NavLink>
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
          <Button onClick={() => setISidebarOpen(!isSidebarOpen)} className="navigation-button">
            {isSidebarOpen ?
              <i class="bi bi-x-lg"></i>
              :
              <i class="bi bi-list"></i>
            }
          </Button>
        </Navbar>

        <main className="content-inner">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
