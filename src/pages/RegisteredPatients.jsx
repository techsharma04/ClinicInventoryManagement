// src/pages/RegisteredPatients.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import ReactDOM from "react-dom";
import {
  Card,
  Form,
  Spinner,
  Button,
  Modal,
  Row,
  Col,
  Badge,
} from "react-bootstrap";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import "../components/styles/table-wrapper.css";
import ActionMenuPortal from "../components/ActionMenuPortal";

const PAGE_SIZE = 10;

function initialEditForm() {
  return {
    name: "",
    age: "",
    sex: "",
    address: "",
    phone: "",
    email: "",
    bloodGroup: "",
    maritalStatus: "",
    emergencyContact: "",
    medicalHistory: "",
    allergies: "",
    dob: "",
  };
}



export default function RegisteredPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Filters
  const [nameFilter, setNameFilter] = useState("");
  const [addressFilter, setAddressFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [ageFrom, setAgeFrom] = useState("");
  const [ageTo, setAgeTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // View / Edit / Delete
  const [viewPatient, setViewPatient] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const [editPatient, setEditPatient] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(initialEditForm());
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletePatient, setDeletePatient] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Actions dropdown state (portal-based)
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [menuOpenUp, setMenuOpenUp] = useState(false);


  // Load patients (excluding soft-deleted)
  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => !p.deleted); // soft delete filter
        setPatients(list);
        setLoading(false);
      },
      (err) => {
        console.error("Patients error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Helpers
  function calcAgeFromDob(dobValue) {
    if (!dobValue) return null;
    try {
      const d =
        typeof dobValue.toDate === "function"
          ? dobValue.toDate()
          : new Date(dobValue);
      if (!d || Number.isNaN(d.getTime())) return null;

      const today = new Date();
      let age = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  }

  function displayAge(p) {
    if (p.age != null && p.age !== "") return p.age;
    const fromDob = calcAgeFromDob(p.dob);
    return fromDob != null ? fromDob : "—";
  }

  function formatDate(tsOrStr) {
    if (!tsOrStr) return "—";
    try {
      const d =
        typeof tsOrStr.toDate === "function"
          ? tsOrStr.toDate()
          : new Date(tsOrStr);
      if (!d || Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString();
    } catch {
      return "—";
    }
  }

  function formatDobForInput(dobValue) {
    if (!dobValue) return "";
    try {
      const d =
        typeof dobValue.toDate === "function"
          ? dobValue.toDate()
          : new Date(dobValue);
      if (!d || Number.isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return "";
    }
  }

  // Advanced filter logic
  const filtered = useMemo(() => {
    return patients.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const addr = (p.address || "").toLowerCase();
      const sex = (p.sex || "").toLowerCase();

      // Name filter
      if (nameFilter.trim()) {
        const term = nameFilter.trim().toLowerCase();
        if (!name.includes(term)) return false;
      }

      // Address filter
      if (addressFilter.trim()) {
        const term = addressFilter.trim().toLowerCase();
        if (!addr.includes(term)) return false;
      }

      // Gender filter
      if (genderFilter) {
        if (sex !== genderFilter.toLowerCase()) return false;
      }

      // Age range filter
      const ageVal =
        p.age != null && p.age !== ""
          ? Number(p.age)
          : calcAgeFromDob(p.dob);
      if (ageFrom) {
        const from = Number(ageFrom);
        if (!Number.isNaN(from) && ageVal != null && ageVal < from)
          return false;
      }
      if (ageTo) {
        const to = Number(ageTo);
        if (!Number.isNaN(to) && ageVal != null && ageVal > to) return false;
      }

      return true;
    });
  }, [patients, nameFilter, addressFilter, genderFilter, ageFrom, ageTo]);

  // Pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  useEffect(
    () => setPage(1),
    [nameFilter, addressFilter, genderFilter, ageFrom, ageTo]
  );

  // --- Actions dropdown (3 dots) ---

  const closeMenu = useCallback(() => {
    setOpenMenuId(null);
    setMenuAnchorRect(null);
  }, []);

  const handleOpenMenu = (e, p) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    // Decide whether to open up or down (estimate menu height ~200px)
    const estimatedMenuHeight = 200;
    const enoughSpaceBelow = rect.bottom + estimatedMenuHeight < viewportHeight;
    const openUp = !enoughSpaceBelow;

    setOpenMenuId((prev) => (prev === p.id ? null : p.id));
    setMenuAnchorRect(rect);
    setMenuOpenUp(openUp);
  };

  // Close on outside click
  useEffect(() => {
    const handler = () => closeMenu();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [closeMenu]);

  // View modal handlers
  const handleView = (p) => {
    setViewPatient(p);
    setShowViewModal(true);
  };

  // Edit modal handlers
  const handleOpenEdit = (p) => {
    setEditPatient(p);
    setEditErrors({});
    setEditForm({
      name: p.name || "",
      age: p.age || "",
      sex: p.sex || "",
      address: p.address || "",
      phone: p.phone || "",
      email: p.email || "",
      bloodGroup: p.bloodGroup || "",
      maritalStatus: p.maritalStatus || "",
      emergencyContact: p.emergencyContact || "",
      medicalHistory: p.medicalHistory || "",
      allergies: p.allergies || "",
      dob: formatDobForInput(p.dob),
    });
    setShowEditModal(true);
  };

  const validateEdit = () => {
    const e = {};
    if (!editForm.name.trim()) e.name = "Name is required";
    if (!editForm.sex.trim()) e.sex = "Gender is required";
    if (
      editForm.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)
    ) {
      e.email = "Invalid email";
    }
    if (
      editForm.phone &&
      !/^[0-9()+\-\s]{7,20}$/.test(editForm.phone)
    ) {
      e.phone = "Invalid phone number";
    }
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveEdit = async () => {
    if (!editPatient) return;
    if (!validateEdit()) return;

    setSavingEdit(true);
    try {
      const ref = doc(db, "patients", editPatient.id);

      const payload = {
        name: editForm.name.trim(),
        age: editForm.age ? Number(editForm.age) : null,
        sex: editForm.sex,
        address: editForm.address.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        bloodGroup: editForm.bloodGroup.trim(),
        maritalStatus: editForm.maritalStatus.trim(),
        emergencyContact: editForm.emergencyContact.trim(),
        medicalHistory: editForm.medicalHistory.trim(),
        allergies: editForm.allergies.trim(),
      };

      if (editForm.dob) {
        payload.dob = new Date(editForm.dob);
      } else {
        payload.dob = null;
      }

      await updateDoc(ref, payload);
      setShowEditModal(false);
      setEditPatient(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update patient.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateCase = (w) => {
    navigate("/app/consultations/new", {
      state: {
        patientId: w.id
      },
    });
  };

  // Delete (soft)
  const handleOpenDelete = (p) => {
    setDeletePatient(p);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletePatient) return;
    setDeleting(true);
    try {
      const ref = doc(db, "patients", deletePatient.id);
      await updateDoc(ref, {
        deleted: true,
        deletedAt: serverTimestamp(),
      });
      setShowDeleteModal(false);
      setDeletePatient(null);
    } catch (err) {
      console.error(err);
      alert("Failed to delete patient.");
    } finally {
      setDeleting(false);
    }
  };

  // Print patient profile
  const handlePrint = (p) => {
    const ageVal = displayAge(p);
    const dobStr = formatDate(p.dob);
    const createdStr = formatDate(p.createdAt);

    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;

    const html = `
      <html>
        <head>
          <title>Patient Profile - ${p.name || ""}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              margin: 0;
              padding: 20px;
              background: #f5f5f7;
            }
            .sheet {
              max-width: 800px;
              margin: 0 auto;
              background: #fff;
              border-radius: 12px;
              padding: 24px 28px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }
            .clinic-name {
              font-size: 20px;
              font-weight: 600;
            }
            .section-title {
              font-size: 14px;
              font-weight: 600;
              margin-top: 18px;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: #666;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0,1fr));
              gap: 8px 40px;
              font-size: 14px;
            }
            .label {
              font-weight: 500;
              color: #555;
            }
            .value {
              color: #111;
            }
            .row {
              margin-bottom: 4px;
            }
            .row .label {
              display: inline-block;
              min-width: 120px;
            }
            .muted {
              color: #888;
              font-size: 12px;
            }
            .divider {
              margin: 16px 0;
              border-bottom: 1px solid #eee;
            }
            @media print {
              body {
                background: #fff;
              }
              .sheet {
                box-shadow: none;
                border-radius: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>
                <div class="clinic-name">Clinic Patient Profile</div>
                <div class="muted">Generated on ${new Date().toLocaleString()}</div>
              </div>
            </div>

            <div class="section-title">Patient Details</div>
            <div class="grid">
              <div class="row">
                <span class="label">Name:</span>
                <span class="value">${p.name || "—"}</span>
              </div>
              <div class="row">
                <span class="label">Gender:</span>
                <span class="value">${p.sex || "—"}</span>
              </div>
              <div class="row">
                <span class="label">Age:</span>
                <span class="value">${ageVal}</span>
              </div>
              <div class="row">
                <span class="label">Date of Birth:</span>
                <span class="value">${dobStr}</span>
              </div>
              <div class="row">
                <span class="label">Blood Group:</span>
                <span class="value">${p.bloodGroup || "—"}</span>
              </div>
              <div class="row">
                <span class="label">Marital Status:</span>
                <span class="value">${p.maritalStatus || "—"}</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="section-title">Contact & Address</div>
            <div class="grid">
              <div class="row">
                <span class="label">Phone:</span>
                <span class="value">${p.phone || "—"}</span>
              </div>
              <div class="row">
                <span class="label">Email:</span>
                <span class="value">${p.email || "—"}</span>
              </div>
              <div class="row" style="grid-column: span 2;">
                <span class="label">Address:</span>
                <span class="value">${p.address || "—"}</span>
              </div>
              <div class="row">
                <span class="label">Emergency Contact:</span>
                <span class="value">${p.emergencyContact || "—"}</span>
              </div>
              <div class="row">
                <span class="label">Registered On:</span>
                <span class="value">${createdStr}</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="section-title">Medical Information</div>
            <div class="row" style="margin-bottom: 10px;">
              <span class="label">Allergies:</span>
              <span class="value">${p.allergies || "—"}</span>
            </div>
            <div class="row">
              <span class="label">Past History:</span>
            </div>
            <div class="value" style="white-space: pre-wrap; border: 1px solid #eee; border-radius: 6px; padding: 8px 10px; min-height: 60px;">
              ${p.medicalHistory || "—"}
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function(){ window.close(); }, 300);
            }
          </script>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // DataTable columns
  const columns = [
    {
      key: "icon",
      title: "",
      render: () => <div className="row-icon">🧍‍♂️</div>,
    },
    {
      key: "name",
      title: "Patient",
      render: (p) => (
        <>
          <div className="inv-main-title">{p.name}</div>
          <div className="inv-meta">
            <span>{displayAge(p)} yrs</span>
            <span>•</span>
            <span>{p.sex || "—"}</span>
          </div>
        </>
      ),
    },
    {
      key: "address",
      title: "Address",
      render: (p) => (
        <span className="text-muted small">
          {p.address || "—"}
        </span>
      ),
    },
    {
      key: "contact",
      title: "Contact",
      align: "text-center",
      render: (p) => (
        <div className="small">
          {p.email && (
            <div style={{ textTransform: "none" }}>
              <span className="text-muted">Email: </span>
              {p.email}
            </div>
          )}
          {p.phone && (
            <div>
              <span className="text-muted">Phone: </span>
              {p.phone}
            </div>
          )}
          {!p.phone && !p.email && (
            <span className="text-muted">—</span>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      title: "Registered On",
      align: "text-center",
      render: (p) => formatDate(p.createdAt),
    },
    {
      key: "actions",
      title: "",
      align: "text-center",
      render: (p) => {
        const isDeleted = !!p.deleted; // future-proof, list already filters deleted

        return (
          <>
            <div
              className="actions-menu-trigger-wrapper"
              onClick={(e) => handleOpenMenu(e, p)}
            >
              <i className="bi bi-three-dots-vertical actions-trigger-icon"></i>
            </div>

            {openMenuId === p.id && (
              <ActionMenuPortal
                open={openMenuId === p.id}
                anchorRect={menuAnchorRect}
                openUp={menuOpenUp}
              >
                <button
                  className="action-item"
                  onClick={() => {
                    closeMenu();
                    handleView(p);
                  }}
                >
                  <i className="bi bi-eye" />
                  <span>View Details</span>
                </button>

                <button
                  className={`action-item ${isDeleted ? "disabled" : ""
                    }`}
                  disabled={isDeleted}
                  onClick={() => {
                    if (isDeleted) return;
                    closeMenu();
                    handleOpenEdit(p);
                  }}
                >
                  <i className="bi bi-pencil-square" />
                  <span>Edit</span>
                </button>

                <button
                  className="action-item"
                  onClick={() => {
                    closeMenu();
                    handlePrint(p);
                  }}
                >
                  <i className="bi bi-printer" />
                  <span>Print Profile</span>
                </button>

                <hr className="dropdown-divider" />

                <button
                  className="action-item"
                  onClick={() => {
                    closeMenu();
                    handleCreateCase(p);
                  }}
                >
                  <i className="bi bi-eye" />
                  <span>Create New Case</span>
                </button>

                <button
                  className={`action-item delete ${isDeleted ? "disabled" : ""
                    }`}
                  disabled={isDeleted}
                  onClick={() => {
                    if (isDeleted) return;
                    closeMenu();
                    handleOpenDelete(p);
                  }}
                >
                  <i className="bi bi-trash" />
                  <span>Delete</span>
                </button>

              </ActionMenuPortal>
            )}
          </>
        );
      },
    },
  ];

  return (
    <div>
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Card.Title className="mb-3">
            Registered Patients
          </Card.Title>

          {/* ADVANCED FILTERS */}
          <Row className="g-2 mb-3">
            <Col md={3} sm={6}>
              <Form.Label className="small text-muted mb-1">
                Name
              </Form.Label>
              <Form.Control
                size="sm"
                placeholder="Search by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </Col>
            <Col md={3} sm={6}>
              <Form.Label className="small text-muted mb-1">
                Address
              </Form.Label>
              <Form.Control
                size="sm"
                placeholder="Search by address..."
                value={addressFilter}
                onChange={(e) => setAddressFilter(e.target.value)}
              />
            </Col>
            <Col md={2} sm={4}>
              <Form.Label className="small text-muted mb-1">
                Gender
              </Form.Label>
              <Form.Select
                size="sm"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Form.Select>
            </Col>
            <Col md={2} sm={4}>
              <Form.Label className="small text-muted mb-1">
                Age From
              </Form.Label>
              <Form.Control
                size="sm"
                type="number"
                min="0"
                value={ageFrom}
                onChange={(e) => setAgeFrom(e.target.value)}
              />
            </Col>
            <Col md={2} sm={4}>
              <Form.Label className="small text-muted mb-1">
                Age To
              </Form.Label>
              <Form.Control
                size="sm"
                type="number"
                min="0"
                value={ageTo}
                onChange={(e) => setAgeTo(e.target.value)}
              />
            </Col>
          </Row>

          {/* TABLE */}
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={pageData}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              emptyMessage="No patients found"
            />
          )}
        </Card.Body>
      </Card>

      {/* VIEW PATIENT MODAL */}
      <Modal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Patient Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!viewPatient ? (
            <div className="text-muted">No patient selected.</div>
          ) : (
            <>
              <Row className="mb-3">
                <Col md={8}>
                  <h5 className="mb-1">
                    {viewPatient.name}{" "}
                    <Badge bg="light" text="dark">
                      {displayAge(viewPatient)} yrs
                    </Badge>
                  </h5>
                  <div className="text-muted small">
                    {viewPatient.sex || "—"} • Registered on{" "}
                    {formatDate(viewPatient.createdAt)}
                  </div>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <h6 className="small text-uppercase text-muted mb-2">
                    Basic Info
                  </h6>
                  <div className="small mb-1">
                    <strong>Blood Group:</strong>{" "}
                    {viewPatient.bloodGroup || "—"}
                  </div>
                  <div className="small mb-1">
                    <strong>Marital Status:</strong>{" "}
                    {viewPatient.maritalStatus || "—"}
                  </div>
                  <div className="small mb-1">
                    <strong>Date of Birth:</strong>{" "}
                    {formatDate(viewPatient.dob)}
                  </div>
                </Col>
                <Col md={6}>
                  <h6 className="small text-uppercase text-muted mb-2">
                    Contact & Address
                  </h6>
                  <div className="small mb-1">
                    <strong>Phone:</strong>{" "}
                    {viewPatient.phone || "—"}
                  </div>
                  <div className="small mb-1">
                    <strong>Email:</strong>{" "}
                    {viewPatient.email || "—"}
                  </div>
                  <div className="small mb-1">
                    <strong>Address:</strong>{" "}
                    {viewPatient.address || "—"}
                  </div>
                  <div className="small mb-1">
                    <strong>Emergency Contact:</strong>{" "}
                    {viewPatient.emergencyContact || "—"}
                  </div>
                </Col>
              </Row>

              <Row>
                <Col>
                  <h6 className="small text-uppercase text-muted mb-2">
                    Medical History
                  </h6>
                  <div
                    className="small p-2 border rounded"
                    style={{ minHeight: 60, whiteSpace: "pre-wrap" }}
                  >
                    {viewPatient.medicalHistory || "—"}
                  </div>
                </Col>
              </Row>

              <Row className="mt-3">
                <Col>
                  <h6 className="small text-uppercase text-muted mb-2">
                    Allergies
                  </h6>
                  <div className="small p-2 border rounded">
                    {viewPatient.allergies || "—"}
                  </div>
                </Col>
              </Row>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {viewPatient && (
            <>
              <Button
                variant="outline-primary"
                onClick={() => {
                  setShowViewModal(false);
                  handleOpenEdit(viewPatient);
                }}
              >
                Edit
              </Button>
              <Button
                variant="outline-danger"
                onClick={() => {
                  setShowViewModal(false);
                  handleOpenDelete(viewPatient);
                }}
              >
                Delete
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => handlePrint(viewPatient)}
              >
                Print
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            onClick={() => setShowViewModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* EDIT PATIENT MODAL */}
      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Edit Patient</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    value={editForm.name}
                    isInvalid={!!editErrors.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {editErrors.name}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Gender</Form.Label>
                  <Form.Select
                    value={editForm.sex}
                    isInvalid={!!editErrors.sex}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        sex: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {editErrors.sex}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Age</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={editForm.age}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        age: e.target.value,
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Date of Birth</Form.Label>
                  <Form.Control
                    type="date"
                    value={editForm.dob}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        dob: e.target.value,
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Blood Group</Form.Label>
                  <Form.Control
                    value={editForm.bloodGroup}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        bloodGroup: e.target.value,
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Marital Status</Form.Label>
                  <Form.Control
                    value={editForm.maritalStatus}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        maritalStatus: e.target.value,
                      }))
                    }
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={editForm.phone}
                    isInvalid={!!editErrors.phone}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {editErrors.phone}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    value={editForm.email}
                    isInvalid={!!editErrors.email}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {editErrors.email}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Address</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Emergency Contact</Form.Label>
                  <Form.Control
                    value={editForm.emergencyContact}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        emergencyContact: e.target.value,
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Medical History</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={editForm.medicalHistory}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        medicalHistory: e.target.value,
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-0">
                  <Form.Label>Allergies</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={editForm.allergies}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        allergies: e.target.value,
                      }))
                    }
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowEditModal(false)}
          >
            Cancel
          </Button>
          <Button disabled={savingEdit} onClick={handleSaveEdit}>
            {savingEdit ? "Saving..." : "Save Changes"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* DELETE MODAL */}
      <Modal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete Patient</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to <strong>soft delete</strong>{" "}
          patient <strong>{deletePatient?.name}</strong>?<br />
          <span className="text-muted small">
            They will be hidden from this list but remain in the
            database with a deleted flag.
          </span>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
