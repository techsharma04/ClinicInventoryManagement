// src/pages/Medicines.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Modal,
  Badge,
  Card,
  Spinner,
} from "react-bootstrap";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import DataTable from "../components/DataTable";

const PAGE_SIZE = 8;

const MEDICINE_CATEGORIES = [
  "Analgesic / Pain Relief",
  "Antibiotic",
  "Antacid",
  "Antihypertensive",
  "Antidiabetic",
  "Vitamin / Supplement",
  "Cough & Cold",
  "Dermatology",
  "Other",
];

const DOSAGE_FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Ointment",
  "Drops",
  "Other",
];

const COMMON_STRENGTHS_BY_FORM = {
  Tablet: ["250mg", "500mg", "650mg"],
  Capsule: ["250mg", "500mg"],
  Syrup: ["5ml", "10ml"],
  Injection: ["1ml", "2ml"],
  Ointment: ["5g", "10g"],
  Drops: ["5 drops", "10 drops"],
  Other: [],
};

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [formFilter, setFormFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editMed, setEditMed] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteMed, setDeleteMed] = useState(null);

  const [form, setForm] = useState({
    name: "",
    strength: "",
    dosageForm: "Tablet",
    category: MEDICINE_CATEGORIES[0],
    openingStock: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Inventory detail modal (per medicine)
  const [showInvModal, setShowInvModal] = useState(false);
  const [invLoading, setInvLoading] = useState(false);
  const [invDetail, setInvDetail] = useState(null);
  const [invBatches, setInvBatches] = useState([]);

  // Load medicines RT
  useEffect(() => {
    const q = query(collection(db, "medicines"), orderBy("name", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMedicines(list);
        setLoading(false);
      },
      (err) => {
        console.error("Medicines error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Load inventory map
  useEffect(() => {
    const loadInventory = async () => {
      const snap = await getDocs(collection(db, "inventory"));
      const map = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.medicineId) {
          map[data.medicineId] = data.currentStock || 0;
        }
      });
      setInventoryMap(map);
    };
    loadInventory();
  }, [medicines]);

  // Filter & search
  const filtered = useMemo(() => {
    let list = medicines;
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((m) =>
        (m.name || "").toLowerCase().includes(term)
      );
    }
    if (categoryFilter) {
      list = list.filter((m) => m.category === categoryFilter);
    }
    if (formFilter) {
      list = list.filter((m) => m.dosageForm === formFilter);
    }
    return list;
  }, [medicines, search, categoryFilter, formFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => setPage(1), [search, categoryFilter, formFilter]);

  // Data with stock merged
  const tableData = pageData.map((m) => ({
    ...m,
    stock: inventoryMap[m.id] ?? 0,
  }));

  // Validation
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.strength.trim()) e.strength = "Strength is required";
    if (!form.dosageForm.trim()) e.dosageForm = "Form is required";
    if (!form.category.trim()) e.category = "Category is required";

    if (!editMed) {
      if (form.openingStock === "") {
        e.openingStock = "Opening stock is required";
      } else {
        const num = Number(form.openingStock);
        if (Number.isNaN(num) || num < 0) {
          e.openingStock = "Opening stock must be a non-negative number";
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Modal handlers
  const openAddModal = () => {
    setEditMed(null);
    setForm({
      name: "",
      strength: "",
      dosageForm: "Tablet",
      category: MEDICINE_CATEGORIES[0],
      openingStock: "",
    });
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = (m) => {
    setEditMed(m);
    setForm({
      name: m.name || "",
      strength: m.strength || "",
      dosageForm: m.dosageForm || "Tablet",
      category: m.category || MEDICINE_CATEGORIES[0],
      openingStock: "",
    });
    setErrors({});
    setShowModal(true);
  };

  const openDeleteModal = (m) => {
    setDeleteMed(m);
    setDeleteModal(true);
  };

  // Save (add/edit)
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const trimmedName = form.name.trim();
      const normalizedName =
        trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);

      const medPayload = {
        name: normalizedName,
        strength: form.strength.trim(),
        dosageForm: form.dosageForm,
        category: form.category,
      };

      if (editMed) {
        await updateDoc(doc(db, "medicines", editMed.id), medPayload);
      } else {
        const openingStockNum = Number(form.openingStock);

        const medRef = await addDoc(collection(db, "medicines"), {
          ...medPayload,
          createdAt: serverTimestamp(),
        });

        const medicineId = medRef.id;

        await addDoc(collection(db, "inventory"), {
          medicineId,
          name: normalizedName,
          strength: form.strength.trim(),
          form: form.dosageForm,
          category: form.category,
          openingStock: openingStockNum,
          currentStock: openingStockNum,
          createdAt: serverTimestamp(),
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Error saving medicine");
    } finally {
      setSaving(false);
    }
  };

  // Delete medicine
  const handleDelete = async () => {
    if (!deleteMed) return;

    const stock = inventoryMap[deleteMed.id] ?? 0;
    if (stock > 0) {
      alert("Cannot delete medicine with existing stock. Reduce stock to 0 first.");
      return;
    }
    try {
      await deleteDoc(doc(db, "medicines", deleteMed.id));
      const invSnap = await getDocs(
        query(collection(db, "inventory"), where("medicineId", "==", deleteMed.id))
      );
      await Promise.all(
        invSnap.docs.map((d) => deleteDoc(doc(db, "inventory", d.id)))
      );
      setDeleteModal(false);
      setDeleteMed(null);
    } catch (err) {
      console.error(err);
      alert("Error deleting medicine");
    }
  };

  // Inventory view modal
  const openInventoryView = async (med) => {
    setInvDetail(null);
    setInvBatches([]);
    setInvLoading(true);
    setShowInvModal(true);
    try {
      const invSnap = await getDocs(
        query(collection(db, "inventory"), where("medicineId", "==", med.id))
      );
      let invDoc = null;
      invSnap.forEach((d) => {
        invDoc = { id: d.id, ...d.data() };
      });
      setInvDetail(invDoc);

      const purSnap = await getDocs(
        query(
          collection(db, "inventoryPurchases"),
          where("medicineId", "==", med.id)
        )
      );
      const batches = purSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const da = a.createdAt?.toMillis?.() || 0;
          const dbb = b.createdAt?.toMillis?.() || 0;
          return dbb - da;
        });

      setInvBatches(batches);
    } catch (err) {
      console.error(err);
      alert("Failed to load inventory details");
    } finally {
      setInvLoading(false);
    }
  };

  const formatDate = (tsOrStr) => {
    if (!tsOrStr) return "-";
    try {
      const d =
        typeof tsOrStr.toDate === "function"
          ? tsOrStr.toDate()
          : new Date(tsOrStr);
      if (!d || Number.isNaN(d.getTime())) return "-";
      return d.toLocaleDateString();
    } catch {
      return "-";
    }
  };

  const expiryStatus = (expiryDate) => {
    if (!expiryDate) return { label: "-", variant: "secondary" };
    let d;
    try {
      d =
        typeof expiryDate.toDate === "function"
          ? expiryDate.toDate()
          : new Date(expiryDate);
    } catch {
      return { label: "-", variant: "secondary" };
    }
    if (!d || Number.isNaN(d.getTime()))
      return { label: "-", variant: "secondary" };

    const today = new Date();
    const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: "Expired", variant: "danger" };
    if (diffDays <= 30)
      return { label: `Expiring in ${diffDays} days`, variant: "warning" };
    return { label: "OK", variant: "success" };
  };

  // CSV export
  const handleExportCSV = () => {
    if (!medicines.length) {
      alert("No medicines to export.");
      return;
    }
    const header = [
      "Name",
      "Strength",
      "Form",
      "Category",
      "CurrentStock",
    ].join(",");
    const rows = medicines.map((m) => {
      const name = `"${(m.name || "").replace(/"/g, '""')}"`;
      const strength = `"${(m.strength || "").replace(/"/g, '""')}"`;
      const form = `"${(m.dosageForm || "").replace(/"/g, '""')}"`;
      const category = `"${(m.category || "").replace(/"/g, '""')}"`;
      const stock = inventoryMap[m.id] ?? 0;
      return [name, strength, form, category, stock].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "medicines_inventory.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const strengthSuggestions = COMMON_STRENGTHS_BY_FORM[form.dosageForm] || [];

  // DataTable columns
  const columns = [
    {
      key: "icon",
      title: "",
      render: () => <div className="row-icon">💊</div>,
    },
    {
      key: "medicine",
      title: "Medicine",
      render: (m) => (
        <>
          <div className="inv-main-title">{m.name}</div>
          <div className="inv-meta">
            <span>{m.strength}</span>
            <span>•</span>
            <span>{m.dosageForm}</span>
          </div>
        </>
      ),
    },
    {
      key: "category",
      title: "Category",
      render: (m) => m.category || "-",
    },
    {
      key: "stock",
      title: "Stock",
      render: (m) => {
        const stock = m.stock ?? 0;
        if (stock <= 0)
          return <span className="badge danger">0 (Out)</span>;
        if (stock <= 5)
          return <span className="badge warning">{stock} Low</span>;
        return <span className="badge success">{stock}</span>;
      },
    },
    {
      key: "actions",
      title: "Actions",
      align: "text-center",
      render: (m) => (
        <>
          <Button
            className="btn-icon"
            // variant="secondary"
            onClick={() => openEditModal(m)}
          >
            <i class="bi bi-pencil"></i>
          </Button>
          <Button
            className="btn-icon"
            // variant="danger"
            onClick={() => openDeleteModal(m)}
          >
            <i class="bi bi-x-lg"></i>
          </Button>
        </>
      ),
    }, {
      key: "Inventory",
      title: "Check Inventory",
      align: "text-center",
      render: (m) => (
        <>
          <Button
            className="btn-icon"
            onClick={() => openInventoryView(m)}
          >
            📦
          </Button>
        </>
      ),
    },
  ];

  return (
    <div>
      <Card className="shadow-sm border-0">
        <Card.Body>
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Card.Title className="mb-0">
              Medicines{" "}
              <Badge bg="secondary" pill>
                {medicines.length}
              </Badge>
            </Card.Title>
            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={handleExportCSV}>
                Export (.csv)
              </Button>
              <Button onClick={openAddModal}>New Medicine</Button>
            </div>
          </div>

          {/* Filters */}
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Form.Control
              placeholder="Search medicine..."
              style={{ maxWidth: 260 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Form.Select
              style={{ maxWidth: 200 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {MEDICINE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Form.Select>
            <Form.Select
              style={{ maxWidth: 200 }}
              value={formFilter}
              onChange={(e) => setFormFilter(e.target.value)}
            >
              <option value="">All Forms</option>
              {DOSAGE_FORMS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Form.Select>
          </div>

          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              emptyMessage="No medicines found"
            />
          )}
        </Card.Body>
      </Card>

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editMed ? "Edit Medicine" : "New Medicine"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Name */}
            <Form.Group className="mb-3">
              <Form.Label>Medicine Name</Form.Label>
              <Form.Control
                placeholder="e.g. Paracetamol"
                value={form.name}
                isInvalid={!!errors.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.name}
              </Form.Control.Feedback>
            </Form.Group>

            {/* Category */}
            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Select
                value={form.category}
                isInvalid={!!errors.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
              >
                {MEDICINE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.category}
              </Form.Control.Feedback>
            </Form.Group>

            {/* Form */}
            <Form.Group className="mb-3">
              <Form.Label>Form</Form.Label>
              <Form.Select
                value={form.dosageForm}
                isInvalid={!!errors.dosageForm}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, dosageForm: e.target.value }))
                }
              >
                {DOSAGE_FORMS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.dosageForm}
              </Form.Control.Feedback>
            </Form.Group>

            {/* Strength */}
            <Form.Group className="mb-3">
              <Form.Label>Strength</Form.Label>
              <Form.Control
                placeholder="e.g. 500mg"
                value={form.strength}
                isInvalid={!!errors.strength}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, strength: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.strength}
              </Form.Control.Feedback>
              {strengthSuggestions.length > 0 && (
                <div className="mt-2 d-flex flex-wrap gap-2">
                  {strengthSuggestions.map((s) => (
                    <Badge
                      key={s}
                      bg="light"
                      text="dark"
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setForm((prev) => ({ ...prev, strength: s }))
                      }
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </Form.Group>

            {/* Opening stock only when adding */}
            {!editMed && (
              <Form.Group className="mb-0">
                <Form.Label>Opening Stock</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  placeholder="e.g. 100"
                  value={form.openingStock}
                  isInvalid={!!errors.openingStock}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      openingStock: e.target.value,
                    }))
                  }
                />
                <Form.Control.Feedback type="invalid">
                  {errors.openingStock}
                </Form.Control.Feedback>
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save Medicine"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Modal */}
      <Modal show={deleteModal} onHide={() => setDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Medicine</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete{" "}
          <strong>{deleteMed?.name}</strong>?<br />
          <span className="text-danger fw-bold">
            This will also remove its inventory record.
          </span>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Inventory Details Modal */}
      <Modal
        show={showInvModal}
        onHide={() => setShowInvModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Inventory Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {invLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : !invDetail ? (
            <div className="text-muted">No inventory found for this medicine.</div>
          ) : (
            <>
              <div className="mb-3">
                <h5 className="mb-1">
                  {invDetail.name}{" "}
                  <small className="text-muted">
                    {invDetail.strength} • {invDetail.form}
                  </small>
                </h5>
                <div className="small text-muted">
                  Category: {invDetail.category || "-"}
                </div>
              </div>

              <div className="d-flex flex-wrap gap-3 mb-4">
                <Card className="flex-grow-1 shadow-sm border-0">
                  <Card.Body>
                    <div className="text-muted small">Current Stock</div>
                    <div className="fs-4 fw-semibold">
                      {invDetail.currentStock ?? 0}
                    </div>
                  </Card.Body>
                </Card>
                <Card className="flex-grow-1 shadow-sm border-0">
                  <Card.Body>
                    <div className="text-muted small">Opening Stock</div>
                    <div className="fs-4 fw-semibold">
                      {invDetail.openingStock ?? 0}
                    </div>
                  </Card.Body>
                </Card>
                <Card className="flex-grow-1 shadow-sm border-0">
                  <Card.Body>
                    <div className="text-muted small">Created On</div>
                    <div className="fs-6 fw-semibold">
                      {formatDate(invDetail.createdAt)}
                    </div>
                  </Card.Body>
                </Card>
              </div>

              <h6 className="mb-2">Batches & Purchases</h6>
              {invBatches.length === 0 ? (
                <div className="text-muted small">
                  No purchase entries recorded yet.
                </div>
              ) : (
                <div className="clinic-table-wrapper">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Batch</th>
                        <th>Qty</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th>Supplier</th>
                        <th>Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invBatches.map((b) => {
                        const status = expiryStatus(b.expiryDate);
                        return (
                          <tr key={b.id}>
                            <td>{formatDate(b.createdAt)}</td>
                            <td>{b.batchNumber || "-"}</td>
                            <td>{b.quantity || 0}</td>
                            <td>{formatDate(b.expiryDate)}</td>
                            <td>
                              <Badge bg={status.variant}>{status.label}</Badge>
                            </td>
                            <td>{b.supplierName || "-"}</td>
                            <td>{b.invoiceNumber || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
