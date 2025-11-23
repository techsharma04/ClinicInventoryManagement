// src/components/SidebarLayout.jsx
import React, { useState, useEffect } from "react";
import {
  Nav,
  Navbar,
  Button,
  Collapse,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { NavLink, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import { logoutDoctor } from "../features/authSlice";
import "../styles/Layout.css";
import logo from "../assets/images/doctor-sign.png";
import collapse from "../assets/icons/collapse.png";
import expand from "../assets/icons/expand.png";

export default function SidebarLayout() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  // true = expanded (full), false = collapsed (icon-only on desktop / hidden on mobile)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [openPatients, setOpenPatients] = useState(false);
  const [openConsultations, setOpenConsultations] = useState(false);

  useEffect(() => {
    // On first load: expanded on desktop, hidden on mobile
    if (typeof window !== "undefined") {
      const isMobileView = window.innerWidth < 992;
      setIsSidebarExpanded(!isMobileView);
    }
  }, []);

  const handleLogout = () => {
    dispatch(logoutDoctor());
  };

  const isMobile = () =>
    typeof window !== "undefined" && window.innerWidth < 992;

  // When a nav item is clicked: auto-close on mobile only
  const handleNavClick = () => {
    if (isMobile()) {
      setIsSidebarExpanded(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarExpanded((prev) => !prev);
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

  const collapsed = !isSidebarExpanded;

  // Helper: tooltip wrapper when collapsed
  const withTooltip = (label, children) => {
    if (!collapsed) return children;
    return (
      <OverlayTrigger
        placement="right"
        overlay={<Tooltip id={`tooltip-${label.replace(/\s+/g, "-")}`}>{label}</Tooltip>}
      >
        <div className="sidebar-tooltip-wrapper">{children}</div>
      </OverlayTrigger>
    );
  };

  return (
    <div className="layout-root image-background">
      {/* Animated sidebar */}
      <motion.aside
        className={`sidebar d-flex flex-column justify-content-between ${isSidebarExpanded ? "expanded" : "collapsed"
          }`}
        animate={{
          width: isSidebarExpanded ? 275 : 72,
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
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
            {/* Dashboard */}
            {withTooltip(
              "Dashboard",
              <NavLink to="/app/dashboard" className={linkClass} onClick={handleNavClick}>
                <i className="bi bi-speedometer2" />
                <span className="link-text">Dashboard</span>
              </NavLink>
            )}

            {/* Medicines */}
            {withTooltip(
              "Medicines",
              <NavLink to="/app/medicines" className={linkClass} onClick={handleNavClick}>
                <i className="bi bi-capsule" />
                <span className="link-text">Medicines</span>
              </NavLink>
            )}

            {/* Patients group */}
            {withTooltip(
              "Patients",
              <button
                type="button"
                className="sidebar-link sidebar-group-toggle"
                onClick={() => setOpenPatients((o) => !o)}
              >
                <i className="bi bi-people" />
                <span className="link-text">Patients</span>
                <span className="ms-auto group-arrow">
                  {openPatients ? "▾" : "▸"}
                </span>
              </button>
            )}

            {/* When sidebar is collapsed, we hide the collapse content via CSS,
                but keeping it here keeps behavior consistent on desktop expanded */}
            <Collapse in={openPatients}>
              <div>
                {withTooltip(
                  "New Patient",
                  <NavLink
                    to="/app/patients/new"
                    className={subLinkClass}
                    onClick={handleNavClick}
                  >
                    <i className="bi bi-person-plus" />
                    <span className="link-text">New Patient</span>
                  </NavLink>
                )}
                {withTooltip(
                  "Registered Patients",
                  <NavLink
                    to="/app/patients/registered"
                    className={subLinkClass}
                    onClick={handleNavClick}
                  >
                    <i className="bi bi-person-badge" />
                    <span className="link-text">Registered Patients</span>
                  </NavLink>
                )}
              </div>
            </Collapse>
            <div className={`${isSidebarExpanded && "display-none"}`}>
              {withTooltip(
                "New Patient",
                <NavLink
                  to="/app/patients/new"
                  className={subLinkClass}
                  onClick={handleNavClick}
                >
                  <i className="bi bi-person-plus" />
                  <span className="link-text">New Patient</span>
                </NavLink>
              )}
              {withTooltip(
                "Registered Patients",
                <NavLink
                  to="/app/patients/registered"
                  className={subLinkClass}
                  onClick={handleNavClick}
                >
                  <i className="bi bi-person-badge" />
                  <span className="link-text">Registered Patients</span>
                </NavLink>
              )}
            </div>
            {/* Consultations group */}
            {withTooltip(
              "Consultations",
              <button
                type="button"
                className="sidebar-link sidebar-group-toggle"
                onClick={() => setOpenConsultations((o) => !o)}
              >
                <i className="bi bi-journal-medical" />
                <span className="link-text">Consultations</span>
                <span className="ms-auto group-arrow">
                  {openConsultations ? "▾" : "▸"}
                </span>
              </button>
            )}

            <Collapse in={openConsultations}>
              <div>
                {withTooltip(
                  "New Prescription",
                  <NavLink
                    to="/app/consultations/new"
                    className={subLinkClass}
                    onClick={handleNavClick}
                  >
                    <i className="bi bi-pencil-square" />
                    <span className="link-text">New Prescription</span>
                  </NavLink>
                )}
                {withTooltip(
                  "Previous Consultations",
                  <NavLink
                    to="/app/consultations/previous"
                    className={subLinkClass}
                    onClick={handleNavClick}
                  >
                    <i className="bi bi-folder2-open" />
                    <span className="link-text">Previous Consultations</span>
                  </NavLink>
                )}
              </div>
            </Collapse>

            <div className={`${isSidebarExpanded && "display-none"}`}>
              {withTooltip(
                "New Prescription",
                <NavLink
                  to="/app/consultations/new"
                  className={subLinkClass}
                  onClick={handleNavClick}
                >
                  <i className="bi bi-pencil-square" />
                  <span className="link-text">New Prescription</span>
                </NavLink>
              )}
              {withTooltip(
                "Previous Consultations",
                <NavLink
                  to="/app/consultations/previous"
                  className={subLinkClass}
                  onClick={handleNavClick}
                >
                  <i className="bi bi-folder2-open" />
                  <span className="link-text">Previous Consultations</span>
                </NavLink>
              )}
            </div>

            {/* Inventory */}
            {withTooltip(
              "Inventory",
              <NavLink
                to="/app/inventory"
                className={linkClass}
                onClick={handleNavClick}
              >
                <i className="bi bi-card-checklist" />
                <span className="link-text">Inventory</span>
              </NavLink>
            )}
          </Nav>
        </div>

        {/* Logout */}
        <Nav className="flex-column">
          {withTooltip(
            "Logout",
            <NavLink to="/" className={linkLogoutClass} onClick={handleLogout}>
              <i className="bi bi-power" />
              <span className="link-text">Logout</span>
            </NavLink>
          )}
        </Nav>
      </motion.aside >

      {/* Main content */}
      < div className="main-content" >
        <Navbar
          bg="white"
          className="shadow-sm px-3 main-topbar d-flex justify-content-between"
        >
          <span
            onClick={toggleSidebar}
            className="layout-sidebar-btn"
            aria-label="Toggle navigation"
          >
            {isSidebarExpanded ? (
              <i class="bi bi-layout-sidebar-inset-reverse"></i>
            ) : (
              <i class="bi bi-layout-sidebar-inset"></i>
            )}
          </span>
          <Navbar.Brand className="small">
            Welcome:&nbsp;
            <strong>Dr. {user?.name || user?.email}</strong>
          </Navbar.Brand>

          <Button
            onClick={toggleSidebar}
            className="navigation-button"
            aria-label="Toggle navigation"
          >
            {isSidebarExpanded ? (
              <i className="bi bi-x-lg" />
            ) : (
              <i className="bi bi-list" />
            )}
          </Button>
        </Navbar>

        <main className="content-inner">
          <Outlet />
        </main>
      </div >
    </div >
  );
}
