// src/pages/Medicies.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Table,
  Form,
  Modal,
  Pagination,
  Badge,
  Card,
} from "react-bootstrap";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

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
  "Inhaler",
  "Other",
];

const COMMON_STRENGTHS_BY_FORM = {
  Tablet: ["250mg", "500mg", "650mg"],
  Capsule: ["250mg", "500mg"],
  Syrup: ["5ml", "10ml"],
  Injection: ["1ml", "2ml"],
  Ointment: ["5g", "10g"],
  Drops: ["5 drops", "10 drops"],
  Inhaler: ["40ug", "50ug", "60ug", "70ug", "80ug", "90ug", "100ug"],
  Other: [],
};

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);

  const [form, setForm] = useState({
    name: "",
    strength: "",
    dosageForm: "Tablet",
    category: "Analgesic / Pain Relief",
    openingStock: "",
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // 🔄 Realtime medicines
  useEffect(() => {
    const q = query(collection(db, "medicines"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMedicines(list);
    });
    return () => unsub();
  }, []);

  // 🔍 Filtered list
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return medicines;
    return medicines.filter((m) => (m.name || "").toLowerCase().includes(term));
  }, [search, medicines]);

  // 📄 Pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPageData = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => setPage(1), [search]);

  const validate = () => {
    const e = {};

    if (!form.name.trim()) e.name = "Name is required";
    if (!form.strength.trim()) e.strength = "Strength is required";
    if (!form.dosageForm.trim()) e.dosageForm = "Form is required";
    if (!form.category.trim()) e.category = "Category is required";

    // Opening stock is ONLY required when adding new medicine
    if (!editingMed) {
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

  const openAddModal = () => {
    setEditingMed(null);
    setForm({
      name: "",
      strength: "",
      dosageForm: "Tablet",
      category: "Analgesic / Pain Relief",
      openingStock: "",
    });
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = (med) => {
    setEditingMed(med);
    setForm({
      name: med.name || "",
      strength: med.strength || "",
      dosageForm: med.dosageForm || "Tablet",
      category: med.category || "Analgesic / Pain Relief",
      openingStock: "", // not used in edit mode
    });
    setErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      // Capitalize first letter like in NewPrescription add-med
      const trimmedName = form.name.trim();
      const normalizedName =
        trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);

      const payload = {
        name: normalizedName,
        strength: form.strength.trim(),
        dosageForm: form.dosageForm,
        category: form.category,
      };

      if (editingMed) {
        // ✏️ Edit medicine only (no stock changes)
        await updateDoc(doc(db, "medicines", editingMed.id), payload);
      } else {
        // ➕ New medicine: create in medicines + inventory (with opening stock)
        const openingStockNum = Number(form.openingStock);

        // 1️⃣ Create medicine
        const medRef = await addDoc(collection(db, "medicines"), {
          ...payload,
          stock: openingStockNum, // optional mirror, as you had earlier
          createdAt: serverTimestamp(),
        });

        const medicineId = medRef.id;

        // 2️⃣ Create matching inventory record
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

  const strengthSuggestions = COMMON_STRENGTHS_BY_FORM[form.dosageForm] || [];

  return (
    <div>
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Card.Title>
            Medicines{" "}
            <Badge bg="secondary" pill>
              {medicines.length}
            </Badge>
          </Card.Title>

          <div className="d-flex justify-content-between mb-3">
            <Form.Control
              placeholder="Search medicines by name..."
              style={{ maxWidth: 280 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button onClick={openAddModal}>New Medicine</Button>
          </div>

          <div className="clinic-table-wrapper">
            <Table
              striped
              bordered={false}
              hover
              responsive
              size="sm"
              className="clinic-table"
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Strength</th>
                  <th>Form</th>
                  <th>Category</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {currentPageData.map((m, index) => (
                  <tr key={m.id}>
                    <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td>{m.name}</td>
                    <td>{m.strength}</td>
                    <td>{m.dosageForm}</td>
                    <td>{m.category}</td>
                    <td>
                      <Button size="sm" onClick={() => openEditModal(m)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}

                {currentPageData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No medicines found
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          {pageCount > 1 && (
            <Pagination>
              {Array.from({ length: pageCount }).map((_, i) => (
                <Pagination.Item
                  key={i}
                  active={i + 1 === page}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </Card.Body>
      </Card>

      {/* ➕ Add/Edit modal — same style as NewPrescription add-med modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingMed ? "Edit Medicine" : "New Medicine"}
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
                  <option key={c} value={c}>
                    {c}
                  </option>
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
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.dosageForm}
              </Form.Control.Feedback>
            </Form.Group>

            {/* Strength + suggestions */}
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

            {/* Opening Stock – ONLY when adding new medicine */}
            {!editingMed && (
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
    </div>
  );
}
