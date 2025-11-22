// src/pages/Inventory.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
  Table,
  Form,
  Badge,
  Spinner,
  Row,
  Col,
  Modal,
} from "react-bootstrap";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  increment,
  addDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useSelector } from "react-redux";
import { db } from "../firebase";

export default function Inventory() {
  const { user } = useSelector((s) => s.auth);

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Purchase modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    inventoryId: "",
    quantity: "",
    batchNumber: "",
    expiryDate: "",
    supplierName: "",
    invoiceNumber: "",
  });

  // Load inventory real-time
  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        console.error("Inventory error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      item.name.toLowerCase().includes(term)
    );
  }, [items, search]);

  // Dashboard stats
  const totalItems = items.length;
  const lowStockCount = items.filter(
    (i) => (i.currentStock ?? 0) > 0 && (i.currentStock ?? 0) <= 5
  ).length;
  const outOfStockCount = items.filter(
    (i) => !i.currentStock || i.currentStock <= 0
  ).length;

  const nearExpiryCount = useMemo(() => {
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 30); // next 30 days

    return items.filter((i) => {
      if (!i.nextExpiryDate) return false;
      try {
        const d =
          typeof i.nextExpiryDate.toDate === "function"
            ? i.nextExpiryDate.toDate()
            : new Date(i.nextExpiryDate);
        return d >= today && d <= limit;
      } catch {
        return false;
      }
    }).length;
  }, [items]);

  const getExpiryLabel = (item) => {
    if (!item.nextExpiryDate) return "-";
    let d;
    try {
      d =
        typeof item.nextExpiryDate.toDate === "function"
          ? item.nextExpiryDate.toDate()
          : new Date(item.nextExpiryDate);
    } catch {
      return "-";
    }
    return d.toLocaleDateString();
  };

  const isNearExpiry = (item) => {
    if (!item.nextExpiryDate) return false;
    try {
      const d =
        typeof item.nextExpiryDate.toDate === "function"
          ? item.nextExpiryDate.toDate()
          : new Date(item.nextExpiryDate);
      const today = new Date();
      const limit = new Date();
      limit.setDate(today.getDate() + 30);
      return d >= today && d <= limit;
    } catch {
      return false;
    }
  };

  // Log helper
  const writeInventoryLog = async ({
    inventoryId,
    medicineId,
    name,
    change,
    oldStock,
    newStock,
    reason,
    extra = {},
  }) => {
    try {
      await addDoc(collection(db, "inventoryLogs"), {
        inventoryId,
        medicineId,
        name,
        change,
        oldStock,
        newStock,
        reason, // "manual_adjust" or "purchase"
        userId: user?.uid || null,
        userName: user?.name || "",
        createdAt: serverTimestamp(),
        ...extra,
      });
    } catch (err) {
      console.error("Failed to write inventory log:", err);
    }
  };

  // Manual adjust stock
  const handleAdjustStock = async (item, change) => {
    if (!change) return;

    const oldStock = item.currentStock ?? 0;
    const newStock = oldStock + change;

    if (newStock < 0) {
      alert("Stock cannot go below zero.");
      return;
    }

    try {
      await updateDoc(doc(db, "inventory", item.id), {
        currentStock: increment(change),
      });

      await writeInventoryLog({
        inventoryId: item.id,
        medicineId: item.medicineId,
        name: item.name,
        change,
        oldStock,
        newStock,
        reason: "manual_adjust",
      });
    } catch (err) {
      console.error(err);
      alert("Failed to adjust stock (permission or network issue).");
    }
  };

  // PURCHASE MODAL HANDLERS
  const openPurchaseModalForItem = (item) => {
    setPurchaseForm({
      inventoryId: item.id,
      quantity: "",
      batchNumber: "",
      expiryDate: "",
      supplierName: "",
      invoiceNumber: "",
    });
    setShowPurchaseModal(true);
  };

  const handlePurchaseChange = (field, value) => {
    setPurchaseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSavePurchase = async () => {
    const {
      inventoryId,
      quantity,
      batchNumber,
      expiryDate,
      supplierName,
      invoiceNumber,
    } = purchaseForm;

    if (!inventoryId) {
      alert("Please select a medicine.");
      return;
    }
    const qtyNum = Number(quantity);
    if (!qtyNum || qtyNum <= 0) {
      alert("Quantity must be a positive number.");
      return;
    }
    if (!batchNumber.trim()) {
      alert("Batch / Lot number is required.");
      return;
    }
    if (!expiryDate) {
      alert("Expiry date is required.");
      return;
    }

    const selectedItem = items.find((i) => i.id === inventoryId);
    if (!selectedItem) {
      alert("Invalid inventory item selected.");
      return;
    }

    setSavingPurchase(true);

    try {
      const invRef = doc(db, "inventory", inventoryId);
      const invSnap = await getDoc(invRef);
      const invData = invSnap.data() || {};

      const currentStock = invData.currentStock ?? 0;
      const newStock = currentStock + qtyNum;

      const expDate = new Date(expiryDate);
      let updates = { currentStock: newStock };

      // Update nextExpiryDate to the earliest batch expiry
      if (expDate instanceof Date && !isNaN(expDate.getTime())) {
        if (!invData.nextExpiryDate) {
          updates.nextExpiryDate = expDate;
        } else {
          let existingDate;
          try {
            existingDate =
              typeof invData.nextExpiryDate.toDate === "function"
                ? invData.nextExpiryDate.toDate()
                : new Date(invData.nextExpiryDate);
          } catch {
            existingDate = null;
          }
          if (!existingDate || expDate < existingDate) {
            updates.nextExpiryDate = expDate;
          }
        }
      }

      await updateDoc(invRef, updates);

      const purchaseRef = await addDoc(collection(db, "inventoryPurchases"), {
        inventoryId,
        medicineId: selectedItem.medicineId,
        name: selectedItem.name,
        strength: selectedItem.strength,
        form: selectedItem.form || selectedItem.form || "",
        category: selectedItem.category || "",
        quantity: qtyNum,
        batchNumber: batchNumber.trim(),
        expiryDate: expDate,
        supplierName: supplierName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        createdAt: serverTimestamp(),
        createdBy: {
          userId: user?.uid || null,
          userName: user?.name || "",
        },
      });

      // Log
      await writeInventoryLog({
        inventoryId,
        medicineId: selectedItem.medicineId,
        name: selectedItem.name,
        change: qtyNum,
        oldStock: currentStock,
        newStock,
        reason: "purchase",
        extra: { purchaseId: purchaseRef.id },
      });

      setShowPurchaseModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save purchase entry.");
    } finally {
      setSavingPurchase(false);
    }
  };

  return (
    <div>
      <h4 className="mb-4">Inventory Management</h4>

      {/* DASHBOARD CARDS */}
      <Row className="mb-3 g-3">
        <Col md={3} sm={6}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <div className="text-muted small">Total Items</div>
              <div className="fs-4 fw-semibold">{totalItems}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <div className="text-muted small">Low Stock (&le; 5)</div>
              <div className="fs-4 fw-semibold text-warning">
                {lowStockCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <div className="text-muted small">Out of Stock</div>
              <div className="fs-4 fw-semibold text-danger">
                {outOfStockCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <div className="text-muted small">Near Expiry (&lt;= 30 days)</div>
              <div className="fs-4 fw-semibold text-primary">
                {nearExpiryCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* SEARCH */}
      <Card className="p-3 shadow-sm border-0 mb-3">
        <Row className="align-items-center g-2">
          <Col md={6}>
            <Form.Control
              placeholder="Search medicine by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Col>
          <Col className="text-md-end text-start">
            {/* Optional: a generic button to open purchase modal and then pick medicine from dropdown there */}
          </Col>
        </Row>
      </Card>

      {/* TABLE */}
      <Card className="shadow-sm border-0">
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-4 text-center text-muted">
              No inventory records found.
            </div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Medicine</th>
                  <th>Strength</th>
                  <th>Form</th>
                  <th>Category</th>
                  <th>Opening Stock</th>
                  <th>Current Stock</th>
                  <th>Nearest Expiry</th>
                  <th>Adjust / Purchase</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const current = item.currentStock ?? 0;
                  const isLow = current > 0 && current <= 5;
                  const isOut = current <= 0;
                  const nearExp = isNearExpiry(item);

                  return (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.strength}</td>
                      <td>{item.form || "-"}</td>
                      <td>{item.category || "-"}</td>
                      <td>{item.openingStock ?? "-"}</td>
                      <td>
                        {isOut ? (
                          <Badge bg="danger">0 (Out)</Badge>
                        ) : isLow ? (
                          <Badge bg="warning" text="dark">
                            {current} Low
                          </Badge>
                        ) : (
                          <Badge bg="success">{current}</Badge>
                        )}
                      </td>
                      <td>
                        {nearExp ? (
                          <Badge bg="warning" text="dark">
                            {getExpiryLabel(item)}
                          </Badge>
                        ) : (
                          getExpiryLabel(item)
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleAdjustStock(item, -1)}
                            disabled={current <= 0}
                          >
                            -1
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleAdjustStock(item, +1)}
                          >
                            +1
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-success"
                            onClick={() => openPurchaseModalForItem(item)}
                          >
                            Purchase
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* PURCHASE MODAL */}
      <Modal
        show={showPurchaseModal}
        onHide={() => setShowPurchaseModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Purchase Entry</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Medicine</Form.Label>
            <Form.Select
              value={purchaseForm.inventoryId}
              onChange={(e) =>
                handlePurchaseChange("inventoryId", e.target.value)
              }
            >
              <option value="">Select medicine</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.strength})
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Quantity</Form.Label>
            <Form.Control
              type="number"
              min="1"
              value={purchaseForm.quantity}
              onChange={(e) =>
                handlePurchaseChange("quantity", e.target.value)
              }
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Batch / Lot Number</Form.Label>
            <Form.Control
              value={purchaseForm.batchNumber}
              onChange={(e) =>
                handlePurchaseChange("batchNumber", e.target.value)
              }
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Expiry Date</Form.Label>
            <Form.Control
              type="date"
              value={purchaseForm.expiryDate}
              onChange={(e) =>
                handlePurchaseChange("expiryDate", e.target.value)
              }
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Supplier Name</Form.Label>
            <Form.Control
              value={purchaseForm.supplierName}
              onChange={(e) =>
                handlePurchaseChange("supplierName", e.target.value)
              }
            />
          </Form.Group>

          <Form.Group className="mb-0">
            <Form.Label>Invoice Number</Form.Label>
            <Form.Control
              value={purchaseForm.invoiceNumber}
              onChange={(e) =>
                handlePurchaseChange("invoiceNumber", e.target.value)
              }
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowPurchaseModal(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSavePurchase} disabled={savingPurchase}>
            {savingPurchase ? "Saving..." : "Save Purchase"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
