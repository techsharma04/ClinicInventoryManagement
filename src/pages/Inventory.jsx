// src/pages/Inventory.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
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
import DataTable from "../components/DataTable";
import "../components/styles/table-wrapper.css";

const PAGE_SIZE = 8;

export default function Inventory() {
  const { user } = useSelector((s) => s.auth);

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

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
      (item.name || "").toLowerCase().includes(term)
    );
  }, [items, search]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageData = filteredItems.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  useEffect(() => setPage(1), [search]);

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
    limit.setDate(today.getDate() + 30);
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
        reason,
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

  // PURCHASE MODAL
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
        form: selectedItem.form || "",
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

  // DataTable columns
  const columns = [
    {
      key: "icon",
      title: "",
      render: () => <div className="row-icon">📦</div>,
    },
    {
      key: "medicine",
      title: "Medicine",
      render: (item) => (
        <>
          <div className="inv-main-title">
            {item.name}{" "}
            <span className="inv-main-strength">{item.strength}</span>
          </div>
          <div className="inv-meta">
            <span>{item.form || "-"}</span>
            <span>•</span>
            <span>{item.category || "-"}</span>
          </div>
        </>
      ),
    },
    {
      key: "opening",
      title: "Opening",
      render: (item) => (
        <>
          <div className="inv-label">Opening</div>
          <div className="inv-value">{item.openingStock ?? "-"}</div>
        </>
      ),
    },
    {
      key: "current",
      title: "Current",
      align: "text-center",
      render: (item) => {
        const current = item.currentStock ?? 0;
        const isLow = current > 0 && current <= 5;
        const isOut = current <= 0;
        return (
          <>
            <div className="inv-label">Current</div>
            <div className="inv-value">
              {isOut ? (
                <span className="badge danger">0 (Out)</span>
              ) : isLow ? (
                <span className="badge warning">{current} Low</span>
              ) : (
                <span className="badge success">{current}</span>
              )}
            </div>
          </>
        );
      },
    },
    {
      key: "expiry",
      title: "Nearest Expiry",
      align: "text-center",
      render: (item) => {
        const label = getExpiryLabel(item);
        const near = isNearExpiry(item);
        if (label === "-") return "-";
        return (
          <>
            <div className="inv-label">Expiry</div>
            <div className="inv-value">
              {near ? (
                <span className="badge warning">{label}</span>
              ) : (
                <span className="badge success">{label}</span>
              )}
            </div>
          </>
        );
      },
    },
    {
      key: "actions",
      title: "Adjust / Purchase",
      align: "text-center",
      render: (item) => {
        const current = item.currentStock ?? 0;
        return (
          <>
            <button
              className="btn-icon"
              disabled={current <= 0}
              onClick={() => handleAdjustStock(item, -1)}
            >
              -1
            </button>
            <button
              className="btn-icon"
              onClick={() => handleAdjustStock(item, +1)}
            >
              +1
            </button>
            <button
              className="btn-icon"
              onClick={() => openPurchaseModalForItem(item)}
            >
              Purchase
            </button>
          </>
        );
      },
    },
  ];

  return (
    <div>
      <h4 className="mb-4">Inventory Management</h4>

      {/* DASHBOARD CARDS */}
      <Row className="mb-3 g-3">
        <Col md={3} sm={6}>
          <Card className="shadow-sm border-0 dashboard-card">
            <Card.Body>
              <div className="text-muted small">Total Items</div>
              <div className="fs-4 fw-semibold">{totalItems}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm border-0 dashboard-card">
            <Card.Body>
              <div className="text-muted small">Low Stock (≤ 5)</div>
              <div className="fs-4 fw-semibold text-warning">
                {lowStockCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm border-0 dashboard-card">
            <Card.Body>
              <div className="text-muted small">Out of Stock</div>
              <div className="fs-4 fw-semibold text-danger">
                {outOfStockCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm border-0 dashboard-card">
            <Card.Body>
              <div className="text-muted small">Near Expiry (≤ 30 days)</div>
              <div className="fs-4 fw-semibold text-primary">
                {nearExpiryCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* TABLE */}
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Row className="align-items-center g-2 pb-3">
            <Col md={6}>
              <Form.Control
                placeholder="Search medicine by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col className="text-md-end text-start" />
          </Row>
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
              emptyMessage="No inventory records found."
            />
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
