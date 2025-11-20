// src/pages/Medicines.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Table,
  Form,
  Modal,
  Pagination,
  Badge,
  Card
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

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);

  const [form, setForm] = useState({
    name: "",
    strength: "",
    form: "",
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

  // Filtered list
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return medicines;
    return medicines.filter((m) =>
      m.name.toLowerCase().includes(term)
    );
  }, [search, medicines]);

  // Pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPageData = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => setPage(1), [search]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.strength.trim()) e.strength = "Strength required";
    if (!form.form.trim()) e.form = "Form required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAddModal = () => {
    setEditingMed(null);
    setForm({ name: "", strength: "", form: "" });
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = (med) => {
    setEditingMed(med);
    setForm({
      name: med.name || "",
      strength: med.strength || "",
      form: med.form || "",
    });
    setErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      if (editingMed) {
        await updateDoc(doc(db, "medicines", editingMed.id), {
          name: form.name.trim(),
          strength: form.strength.trim(),
          form: form.form.trim(),
        });
      } else {
        await addDoc(collection(db, "medicines"), {
          name: form.name.trim(),
          strength: form.strength.trim(),
          form: form.form.trim(),
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

  return (
    <div>
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Card.Title>Medicines{" "}
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
            <Table striped bordered={false} hover responsive size="sm" className="clinic-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Strength</th>
                  <th>Form</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {currentPageData.map((m, index) => (
                  <tr key={m.id}>
                    <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td>{m.name}</td>
                    <td>{m.strength}</td>
                    <td>{m.form}</td>
                    <td>
                      <Button size="sm" onClick={() => openEditModal(m)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}

                {currentPageData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center">
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


      {/* Add/Edit modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingMed ? "Edit Medicine" : "New Medicine"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label>Name</Form.Label>
              <Form.Control
                placeholder="Enter medicine name (e.g., Paracetamol)"
                value={form.name}
                isInvalid={!!errors.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.name}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Strength</Form.Label>
              <Form.Control
                placeholder="Enter strength (e.g., 500mg)"
                value={form.strength}
                isInvalid={!!errors.strength}
                onChange={(e) =>
                  setForm({ ...form, strength: e.target.value })
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.strength}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group>
              <Form.Label>Form</Form.Label>
              <Form.Control
                placeholder="Enter form (e.g., Tablet, Syrup)"
                value={form.form}
                isInvalid={!!errors.form}
                onChange={(e) =>
                  setForm({ ...form, form: e.target.value })
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.form}
              </Form.Control.Feedback>
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
