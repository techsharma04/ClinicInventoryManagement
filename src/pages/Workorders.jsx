// src/pages/Workorders.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Form,
  Button,
  Card,
  ListGroup,
  Badge,
  Modal,
  Table,
  Pagination,
} from "react-bootstrap";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { useSelector } from "react-redux";
import { db } from "../firebase";

import WorkorderPrint from "../components/WorkorderPrint";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const WORKORDERS_PAGE_SIZE = 8;

export default function Workorders() {
  const { user } = useSelector((s) => s.auth);

  // main form
  const [form, setForm] = useState({
    name: "",
    age: "",
    sex: "",
    address: "",
    instructions: "",
  });
  const [errors, setErrors] = useState({});
  const [medicines, setMedicines] = useState([]);
  const [medSearch, setMedSearch] = useState("");
  const [selectedMeds, setSelectedMeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingWorkorder, setEditingWorkorder] = useState(null);

  // new medicine modal
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    strength: "",
    form: "",
  });
  const [newMedErrors, setNewMedErrors] = useState({});
  const [addingMed, setAddingMed] = useState(false);

  // old workorders
  const [oldWorkorders, setOldWorkorders] = useState([]);

  // filter/search for old workorders
  const [woSearch, setWoSearch] = useState("");
  const [woPatientFilter, setWoPatientFilter] = useState("");
  const [woDoctorFilter, setWoDoctorFilter] = useState("");
  const [woDateFrom, setWoDateFrom] = useState("");
  const [woDateTo, setWoDateTo] = useState("");
  const [woPage, setWoPage] = useState(1);

  // print/export
  const printRef = useRef();
  const [workOrderToPrint, setWorkOrderToPrint] = useState(null);
  const [printAction, setPrintAction] = useState(null); // "print" | "pdf" | null

  // react-to-print handler
  const handlePrintSpecific = useReactToPrint({
    contentRef: printRef,
  });


  // load medicines
  useEffect(() => {
    const q = query(collection(db, "medicines"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMedicines(list);
    });
    return () => unsub();
  }, []);

  // load workorders
  useEffect(() => {
    const q = query(collection(db, "workorders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOldWorkorders(list);
    });
    return () => unsub();
  }, []);

  // medicine autocomplete
  const filteredMedicines = useMemo(() => {
    const term = medSearch.trim().toLowerCase();
    if (!term) return [];
    return medicines
      .filter((m) => m.name.toLowerCase().includes(term))
      .slice(0, 5);
  }, [medSearch, medicines]);

  // doctor options for filter
  const doctorOptions = useMemo(() => {
    const map = new Map();
    oldWorkorders.forEach((w) => {
      const id = w.doctor?.id || w.doctorId;
      const name = w.doctor?.name || w.doctor?.email || "Unknown doctor";
      if (id && !map.has(id)) {
        map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [oldWorkorders]);

  // filter old workorders
  const filteredWorkorders = useMemo(() => {
    const term = woSearch.trim().toLowerCase();
    const patientTerm = woPatientFilter.trim().toLowerCase();
    const fromDate = woDateFrom ? new Date(woDateFrom) : null;
    const toDate = woDateTo ? new Date(woDateTo) : null;
    if (toDate) {
      toDate.setDate(toDate.getDate() + 1);
    }

    return oldWorkorders.filter((w) => {
      const createdAtDate = w.createdAt?.toDate
        ? w.createdAt.toDate()
        : null;

      if (fromDate && createdAtDate && createdAtDate < fromDate) return false;
      if (toDate && createdAtDate && createdAtDate >= toDate) return false;

      if (woDoctorFilter) {
        const docId = w.doctor?.id || w.doctorId || "";
        if (docId !== woDoctorFilter) return false;
      }

      if (patientTerm) {
        const pName = w.patient?.name?.toLowerCase() || "";
        if (!pName.includes(patientTerm)) return false;
      }

      if (term) {
        const orderIdStr = String(w.orderId || "").toLowerCase();
        const patientName = w.patient?.name?.toLowerCase() || "";
        const doctorName =
          w.doctor?.name?.toLowerCase() ||
          w.doctor?.email?.toLowerCase() ||
          "";
        const medsNames = (w.medicines || [])
          .map((m) => m.name?.toLowerCase() || "")
          .join(" ");

        if (
          !orderIdStr.includes(term) &&
          !patientName.includes(term) &&
          !doctorName.includes(term) &&
          !medsNames.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    oldWorkorders,
    woSearch,
    woPatientFilter,
    woDoctorFilter,
    woDateFrom,
    woDateTo,
  ]);

  const woPageCount = Math.max(
    1,
    Math.ceil(filteredWorkorders.length / WORKORDERS_PAGE_SIZE)
  );
  const woPageData = filteredWorkorders.slice(
    (woPage - 1) * WORKORDERS_PAGE_SIZE,
    woPage * WORKORDERS_PAGE_SIZE
  );

  useEffect(() => setWoPage(1), [
    woSearch,
    woPatientFilter,
    woDoctorFilter,
    woDateFrom,
    woDateTo,
  ]);

  // validate main form
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.age.trim()) e.age = "Age required";
    else if (isNaN(Number(form.age))) e.age = "Age must be a number";
    if (!form.sex.trim()) e.sex = "Sex required";
    if (!form.address.trim()) e.address = "Address required";
    if (selectedMeds.length === 0)
      e.medicines = "At least one medicine required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // selected medicines helpers
  const handleAddMed = (med) => {
    if (!selectedMeds.find((m) => m.id === med.id)) {
      setSelectedMeds((prev) => [
        ...prev,
        {
          id: med.id,
          name: med.name,
          strength: med.strength,
          form: med.form,
          dosage: "",
          instructions: "",
        },
      ]);
    }
    setMedSearch("");
  };

  const handleRemoveMed = (id) => {
    setSelectedMeds((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMedField = (id, field, value) => {
    setSelectedMeds((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  // orderId auto-increment
  const getNextOrderId = async () => {
    const ref = doc(db, "counters", "workorders");
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, { current: 1000 });
        return 1000;
      }
      const current = snap.data().current || 1000;
      const next = current + 1;
      tx.update(ref, { current: next });
      return next;
    });
  };

  // submit / update workorder
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    try {
      if (editingWorkorder) {
        const ref = doc(db, "workorders", editingWorkorder.id);
        await updateDoc(ref, {
          patient: {
            name: form.name.trim(),
            age: Number(form.age),
            sex: form.sex,
            address: form.address.trim(),
          },
          medicines: selectedMeds.map((m) => ({
            id: m.id,
            name: m.name,
            strength: m.strength,
            form: m.form,
            dosage: m.dosage || "",
            instructions: m.instructions || "",
          })),
          instructions: form.instructions || "",
          doctor: {
            id: user.uid,
            name: user.name || "",
            email: user.email || "",
          },
          updatedAt: serverTimestamp(),
        });
        setEditingWorkorder(null);
      } else {
        const orderId = await getNextOrderId();
        await addDoc(collection(db, "workorders"), {
          orderId,
          patient: {
            name: form.name.trim(),
            age: Number(form.age),
            sex: form.sex,
            address: form.address.trim(),
          },
          medicines: selectedMeds.map((m) => ({
            id: m.id,
            name: m.name,
            strength: m.strength,
            form: m.form,
            dosage: m.dosage || "",
            instructions: m.instructions || "",
          })),
          instructions: form.instructions || "",
          doctor: {
            id: user.uid,
            name: user.name || "",
            email: user.email || "",
          },
          createdAt: serverTimestamp(),
        });
      }

      setForm({
        name: "",
        age: "",
        sex: "",
        address: "",
        instructions: "",
      });
      setSelectedMeds([]);
      setMedSearch("");
      setErrors({});
    } catch (err) {
      console.error(err);
      alert("Failed to save workorder");
    } finally {
      setSaving(false);
    }
  };

  // start editing existing workorder
  const startEditWorkorder = (w) => {
    setEditingWorkorder(w);
    setForm({
      name: w.patient?.name || "",
      age:
        w.patient?.age !== undefined && w.patient?.age !== null
          ? String(w.patient.age)
          : "",
      sex: w.patient?.sex || "",
      address: w.patient?.address || "",
      instructions: w.instructions || "",
    });
    setSelectedMeds(
      (w.medicines || []).map((m) => ({
        id: m.id,
        name: m.name,
        strength: m.strength,
        form: m.form,
        dosage: m.dosage || "",
        instructions: m.instructions || "",
      }))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // NEW: effect to handle print / PDF AFTER DOM updated
  useEffect(() => {
    if (!printAction || !workOrderToPrint) return;

    const doPrintOrPdf = async () => {
      // tiny delay to ensure WorkorderPrint rendered with new data
      await new Promise((res) => setTimeout(res, 50));

      const element = printRef.current;
      if (!element) {
        setPrintAction(null);
        return;
      }

      if (printAction === "print") {
        handlePrintSpecific();
      }

      if (printAction === "pdf") {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, width, height);
        pdf.save(`Workorder-${workOrderToPrint.orderId}.pdf`);
      }

      setPrintAction(null);
    };

    doPrintOrPdf();
  }, [printAction, workOrderToPrint, handlePrintSpecific]);

  // trigger print button
  const triggerPrint = (w) => {
    setWorkOrderToPrint(w);
    setPrintAction("print");
  };

  // trigger PDF button
  const triggerPdf = (w) => {
    setWorkOrderToPrint(w);
    setPrintAction("pdf");
  };

  // new medicine validation
  const validateNewMed = () => {
    const e = {};
    if (!newMed.name.trim()) e.name = "Name required";
    if (!newMed.strength.trim()) e.strength = "Strength required";
    if (!newMed.form.trim()) e.form = "Form required";
    setNewMedErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveNewMedicine = async () => {
    if (!validateNewMed()) return;
    setAddingMed(true);
    try {
      const docRef = await addDoc(collection(db, "medicines"), {
        name: newMed.name.trim(),
        strength: newMed.strength.trim(),
        form: newMed.form.trim(),
        createdAt: serverTimestamp(),
      });
      const medObj = {
        id: docRef.id,
        name: newMed.name.trim(),
        strength: newMed.strength.trim(),
        form: newMed.form.trim(),
        dosage: "",
        instructions: "",
      };
      setSelectedMeds((prev) => [...prev, medObj]);
      setShowAddMedModal(false);
      setNewMed({ name: "", strength: "", form: "" });
      setNewMedErrors({});
    } catch (err) {
      console.error(err);
      alert("Failed to add medicine");
    } finally {
      setAddingMed(false);
    }
  };

  return (
    <div>
      <h4 className="mb-3">Consultations</h4>

      {/* ===== Workorder Form ===== */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Body>
          <Card.Title>
            {editingWorkorder
              ? `Edit Prescription #${editingWorkorder.orderId}`
              : "New Prescription"}
          </Card.Title>

          {editingWorkorder && (
            <div className="mb-2">
              <Badge bg="warning" text="dark">
                Editing mode
              </Badge>
            </div>
          )}

          <Form onSubmit={handleSubmit} className="mt-3">
            {/* Patient fields */}
            <Form.Group className="mb-3">
              <Form.Label>Patient Name</Form.Label>
              <Form.Control
                placeholder="Enter patient's full name"
                value={form.name}
                isInvalid={!!errors.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.name}
              </Form.Control.Feedback>
            </Form.Group>

            <div className="row">
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Age</Form.Label>
                  <Form.Control
                    placeholder="Enter age in years"
                    value={form.age}
                    isInvalid={!!errors.age}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, age: e.target.value }))
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.age}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>

              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Sex</Form.Label>
                  <Form.Select
                    value={form.sex}
                    isInvalid={!!errors.sex}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sex: e.target.value }))
                    }
                  >
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.sex}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Address</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Enter full address"
                value={form.address}
                isInvalid={!!errors.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.address}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Diagnosis</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Any additional notes or instructions for patient"
                value={form.instructions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, instructions: e.target.value }))
                }
              />
            </Form.Group>

            {/* Medicine search */}
            <Form.Group className="position-relative mb-2">
              <Form.Label>Search Medicine</Form.Label>
              <Form.Control
                placeholder="Type medicine name..."
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
              />
              {errors.medicines && (
                <div className="text-danger small">{errors.medicines}</div>
              )}

              {medSearch.trim() && (
                <ListGroup
                  className="position-absolute w-100"
                  style={{
                    top: "100%",
                    zIndex: 20,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {filteredMedicines.length > 0 ? (
                    filteredMedicines.map((m) => (
                      <ListGroup.Item
                        key={m.id}
                        action
                        onClick={() => handleAddMed(m)}
                      >
                        {m.name}{" "}
                        <span className="text-muted small">
                          {m.strength} | {m.form}
                        </span>
                      </ListGroup.Item>
                    ))
                  ) : (
                    <ListGroup.Item className="d-flex justify-content-between">
                      <span>No medicines found</span>
                      <Button
                        size="sm"
                        onClick={() => setShowAddMedModal(true)}
                      >
                        Add Medicine
                      </Button>
                    </ListGroup.Item>
                  )}
                </ListGroup>
              )}
            </Form.Group>

            {/* Selected medicines with dosage & instructions */}
            {selectedMeds.length > 0 && (
              <ListGroup className="mt-3">
                {selectedMeds.map((m) => (
                  <ListGroup.Item key={m.id}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{m.name}</strong>{" "}
                        <span className="text-muted small">
                          {m.strength} | {m.form}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleRemoveMed(m.id)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="row mt-2">
                      <div className="col-md-4 mb-2">
                        <Form.Control
                          size="sm"
                          placeholder="Dosage (e.g., 1 tablet)"
                          value={m.dosage || ""}
                          onChange={(e) =>
                            updateMedField(m.id, "dosage", e.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-8 mb-2">
                        <Form.Control
                          size="sm"
                          placeholder="Instructions (e.g., after meals, twice daily)"
                          value={m.instructions || ""}
                          onChange={(e) =>
                            updateMedField(
                              m.id,
                              "instructions",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}

            <div className="mt-4 d-flex justify-content-end gap-3">
              {editingWorkorder && (
                <Button
                  size="sm"
                  variant="danger"
                  className="ms-2 p-2"
                  onClick={() => {
                    setEditingWorkorder(null);
                    setForm({
                      name: "",
                      age: "",
                      sex: "",
                      address: "",
                      instructions: "",
                    });
                    setSelectedMeds([]);
                  }}
                >
                  Cancel edit
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingWorkorder
                    ? "Update Case"
                    : "Create Case"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* ===== Old Workorders Table + Filters ===== */}
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Card.Title>Previous Consultations</Card.Title>

          <Form className="row g-2 mt-2 mb-3">
            <div className="col-md-3">
              <Form.Control
                placeholder="Search by order, patient, doctor, medicine"
                value={woSearch}
                onChange={(e) => setWoSearch(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <Form.Control
                placeholder="Filter by patient name"
                value={woPatientFilter}
                onChange={(e) => setWoPatientFilter(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <Form.Select
                value={woDoctorFilter}
                onChange={(e) => setWoDoctorFilter(e.target.value)}
              >
                <option value="">All doctors</option>
                {doctorOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-3 d-flex gap-2">
              <Form.Control
                type="date"
                value={woDateFrom}
                onChange={(e) => setWoDateFrom(e.target.value)}
              />
              <Form.Control
                type="date"
                value={woDateTo}
                onChange={(e) => setWoDateTo(e.target.value)}
              />
            </div>
          </Form>

          <Table striped bordered hover responsive size="sm">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Date</th>
                <th>Medicines</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {woPageData.map((w) => (
                <tr key={w.id}>
                  <td>{w.orderId}</td>
                  <td>{w.patient?.name}</td>
                  <td>{w.doctor?.name || w.doctor?.email || "—"}</td>
                  <td>
                    {w.createdAt?.toDate
                      ? w.createdAt.toDate().toLocaleDateString()
                      : "—"}
                  </td>
                  <td>{(w.medicines || []).length} items</td>
                  <td className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => startEditWorkorder(w)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => triggerPrint(w)}
                    >
                      Print
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => triggerPdf(w)}
                    >
                      PDF
                    </Button>
                  </td>
                </tr>
              ))}
              {woPageData.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">
                    No workorders found
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          {woPageCount > 1 && (
            <Pagination>
              {Array.from({ length: woPageCount }).map((_, i) => (
                <Pagination.Item
                  key={i}
                  active={i + 1 === woPage}
                  onClick={() => setWoPage(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </Card.Body>
      </Card>

      {/* Printable area – MUST be rendered (not display:none) for html2canvas */}
      <div
        style={{
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          height: "auto",
          overflow: "hidden",
        }}
      >
        <WorkorderPrint ref={printRef} data={workOrderToPrint} />
      </div>


      {/* New Medicine Modal */}
      <Modal show={showAddMedModal} onHide={() => setShowAddMedModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Medicine</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label>Medicine Name</Form.Label>
              <Form.Control
                placeholder="Enter medicine name (e.g., Paracetamol)"
                value={newMed.name}
                isInvalid={!!newMedErrors.name}
                onChange={(e) =>
                  setNewMed((m) => ({ ...m, name: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {newMedErrors.name}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Strength</Form.Label>
              <Form.Control
                placeholder="Enter strength (e.g., 500mg)"
                value={newMed.strength}
                isInvalid={!!newMedErrors.strength}
                onChange={(e) =>
                  setNewMed((m) => ({ ...m, strength: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {newMedErrors.strength}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group>
              <Form.Label>Form</Form.Label>
              <Form.Control
                placeholder="Enter form (e.g., Tablet, Syrup)"
                value={newMed.form}
                isInvalid={!!newMedErrors.form}
                onChange={(e) =>
                  setNewMed((m) => ({ ...m, form: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {newMedErrors.form}
              </Form.Control.Feedback>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowAddMedModal(false)}
          >
            Cancel
          </Button>
          <Button onClick={saveNewMedicine} disabled={addingMed}>
            {addingMed ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
