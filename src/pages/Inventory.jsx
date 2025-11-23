// src/pages/Inventory.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
  Form,
  Spinner,
  Row,
  Col,
  Modal,
  Badge,
} from "react-bootstrap";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  addDoc,
  getDoc,
  getDocs,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { useSelector } from "react-redux";
import { db } from "../firebase";
import DataTable from "../components/DataTable";
import "../components/styles/table-wrapper.css";
import Swal from "sweetalert2";
import ActionMenuPortal from "../components/ActionMenuPortal";

const PAGE_SIZE = 8;

export default function Inventory() {
  const { user } = useSelector((s) => s.auth);

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Advanced filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [formFilter, setFormFilter] = useState("");
  const [stockFilter, setStockFilter] = useState(""); // "", "low", "out"
  const [expiryFilter, setExpiryFilter] = useState(""); // "", "near", "expired"

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

  // Detail modal (dashboard-style)
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailPurchases, setDetailPurchases] = useState([]);
  const [detailLogs, setDetailLogs] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Metadata edit in detail modal
  const [metadataForm, setMetadataForm] = useState({
    name: "",
    strength: "",
    form: "",
    category: "",
  });
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Row dropdown menu (3 dots)
  const [rowMenu, setRowMenu] = useState({
    open: false,
    item: null,
    anchorRect: null,
    openUp: false,
  });



  // Load inventory real-time
  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((i) => !i.deleted); // ignore soft-deleted
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

  const getExpiryLabel = (item) => {
    if (!item.nextExpiryDate) return "-";
    try {
      const d =
        typeof item.nextExpiryDate.toDate === "function"
          ? item.nextExpiryDate.toDate()
          : new Date(item.nextExpiryDate);
      if (!d || Number.isNaN(d.getTime())) return "-";
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "-";
    }
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

  const isExpired = (item) => {
    if (!item.nextExpiryDate) return false;
    try {
      const d =
        typeof item.nextExpiryDate.toDate === "function"
          ? item.nextExpiryDate.toDate()
          : new Date(item.nextExpiryDate);
      const today = new Date();
      return d < today;
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
        userEmail: user?.email || "",
        createdAt: serverTimestamp(),
        ...extra,
      });
    } catch (err) {
      console.error("Failed to write inventory log:", err);
    }
  };

  // Manual adjust stock (SweetAlert quantity)
  const handleAdjustStock = async (item, type) => {
    const { value: qtyStr } = await Swal.fire({
      title: type === "increase" ? "Increase Stock" : "Decrease Stock",
      input: "number",
      inputLabel: "Enter quantity",
      inputPlaceholder: "Enter quantity (e.g., 5)",
      inputAttributes: {
        min: 1,
        step: 1,
      },
      showCancelButton: true,
      confirmButtonText: "Apply",
    });

    if (!qtyStr) return;

    const qty = Number(qtyStr);
    if (!qty || qty <= 0) {
      Swal.fire("Invalid quantity", "Please enter a valid number.", "error");
      return;
    }

    const change = type === "increase" ? qty : -qty;
    const oldStock = item.currentStock ?? 0;
    const newStock = oldStock + change;

    if (newStock < 0) {
      Swal.fire("Invalid", "Stock cannot go below zero.", "error");
      return;
    }

    try {
      await updateDoc(doc(db, "inventory", item.id), {
        currentStock: newStock,
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

      Swal.fire("Updated!", "Stock adjusted successfully.", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to update stock.", "error");
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

  // ----- DETAIL VIEW (dashboard style) -----

  const openDetailsModal = async (item) => {
    setDetailItem(item);
    setMetadataForm({
      name: item.name || "",
      strength: item.strength || "",
      form: item.form || "",
      category: item.category || "",
    });
    setDetailPurchases([]);
    setDetailLogs([]);
    setShowDetailsModal(true);
    setDetailLoading(true);

    try {
      const purQ = query(
        collection(db, "inventoryPurchases"),
        where("inventoryId", "==", item.id),
        orderBy("createdAt", "desc")
      );
      const purSnap = await getDocs(purQ);
      const purchases = purSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const logQ = query(
        collection(db, "inventoryLogs"),
        where("inventoryId", "==", item.id),
        orderBy("createdAt", "desc")
      );
      const logSnap = await getDocs(logQ);
      const logs = logSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setDetailPurchases(purchases);
      setDetailLogs(logs);
    } catch (err) {
      console.error(err);
      alert("Failed to load inventory details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleMetadataChange = (field, value) => {
    setMetadataForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveMetadata = async () => {
    if (!detailItem) return;

    const trimmedName = metadataForm.name.trim();
    if (!trimmedName) {
      alert("Name is required.");
      return;
    }

    const normalizedName =
      trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);

    const newVals = {
      name: normalizedName,
      strength: metadataForm.strength.trim(),
      form: metadataForm.form.trim(),
      category: metadataForm.category.trim(),
    };

    const hasChanged =
      newVals.name !== (detailItem.name || "") ||
      newVals.strength !== (detailItem.strength || "") ||
      newVals.form !== (detailItem.form || "") ||
      newVals.category !== (detailItem.category || "");

    if (!hasChanged) {
      alert("No changes to save.");
      return;
    }

    setMetadataSaving(true);
    try {
      const invRef = doc(db, "inventory", detailItem.id);
      const oldVals = {
        name: detailItem.name || "",
        strength: detailItem.strength || "",
        form: detailItem.form || "",
        category: detailItem.category || "",
      };

      await updateDoc(invRef, newVals);

      if (detailItem.medicineId) {
        const medRef = doc(db, "medicines", detailItem.medicineId);
        await updateDoc(medRef, {
          name: newVals.name,
          strength: newVals.strength,
          dosageForm: newVals.form,
          category: newVals.category,
          nameLower: newVals.name.toLowerCase(),
        });
      }

      await addDoc(collection(db, "inventoryLogs"), {
        inventoryId: detailItem.id,
        medicineId: detailItem.medicineId || null,
        name: newVals.name,
        reason: "metadata_update",
        oldValues: oldVals,
        newValues: newVals,
        userId: user?.uid || null,
        userName: user?.name || "",
        userEmail: user?.email || "",
        createdAt: serverTimestamp(),
      });

      setDetailItem((prev) => (prev ? { ...prev, ...newVals } : prev));
      Swal.fire("Saved", "Inventory metadata updated.", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to save metadata.", "error");
    } finally {
      setMetadataSaving(false);
    }
  };

  const handleSoftDeleteInventory = async () => {
    if (!detailItem) return;
    const confirm = await Swal.fire({
      title: "Delete Inventory Item?",
      text: "This will hide this item from the inventory list (soft delete).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
    });
    if (!confirm.isConfirmed) return;

    setDeleting(true);
    try {
      const invRef = doc(db, "inventory", detailItem.id);
      await updateDoc(invRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "inventoryLogs"), {
        inventoryId: detailItem.id,
        medicineId: detailItem.medicineId || null,
        name: detailItem.name,
        reason: "inventory_soft_delete",
        userId: user?.uid || null,
        userName: user?.name || "",
        userEmail: user?.email || "",
        createdAt: serverTimestamp(),
      });

      setShowDetailsModal(false);
      Swal.fire("Deleted", "Inventory item deleted (soft).", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to delete inventory item.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    try {
      const d =
        typeof ts.toDate === "function"
          ? ts.toDate()
          : new Date(ts);
      if (!d || Number.isNaN(d.getTime())) return "—";

      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const formatDateTime = (ts) => {
    if (!ts) return "—";
    try {
      const d =
        typeof ts.toDate === "function"
          ? ts.toDate()
          : new Date(ts);
      if (!d || Number.isNaN(d.getTime())) return "—";

      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return "—";
    }
  };

  const handlePrintDetail = () => {
    if (!detailItem) return;

    const purchases = detailPurchases || [];
    const logs = detailLogs || [];

    const expiryLabel = getExpiryLabel(detailItem);
    const currentStock = detailItem.currentStock ?? 0;
    const openingStock = detailItem.openingStock ?? 0;

    const html = `
      <html>
        <head>
          <title>Inventory Sheet - ${detailItem.name || ""}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              margin: 0;
              padding: 20px;
              background: #f5f5f7;
            }
            .sheet {
              max-width: 900px;
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
              margin-bottom: 16px;
            }
            .title {
              font-weight: 600;
              font-size: 20px;
            }
            .subtitle {
              color: #666;
              font-size: 13px;
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
            .table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-top: 4px;
            }
            .table th, .table td {
              border: 1px solid #eee;
              padding: 4px 6px;
              text-align: left;
            }
            .table th {
              background: #fafafa;
              font-weight: 600;
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
                <div class="title">Inventory Sheet</div>
                <div class="subtitle">
                  Generated on ${new Date().toLocaleString()}
                </div>
              </div>
            </div>

            <div class="section-title">Medicine Details</div>
            <div class="grid">
              <div>
                <div class="label">Name</div>
                <div class="value">${detailItem.name || "—"}</div>
              </div>
              <div>
                <div class="label">Strength</div>
                <div class="value">${detailItem.strength || "—"}</div>
              </div>
              <div>
                <div class="label">Form</div>
                <div class="value">${detailItem.form || "—"}</div>
              </div>
              <div>
                <div class="label">Category</div>
                <div class="value">${detailItem.category || "—"}</div>
              </div>
            </div>

            <div class="section-title">Stock Summary</div>
            <div class="grid">
              <div>
                <div class="label">Opening Stock</div>
                <div class="value">${openingStock}</div>
              </div>
              <div>
                <div class="label">Current Stock</div>
                <div class="value">${currentStock}</div>
              </div>
              <div>
                <div class="label">Nearest Expiry</div>
                <div class="value">${expiryLabel}</div>
              </div>
              <div>
                <div class="label">Inventory ID</div>
                <div class="value">${detailItem.id}</div>
              </div>
            </div>

            <div class="section-title">Purchase Batches</div>
            ${purchases.length === 0
        ? '<div class="value">No purchase entries.</div>'
        : `
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Batch</th>
                    <th>Qty</th>
                    <th>Expiry</th>
                    <th>Supplier</th>
                    <th>Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  ${purchases
          .map((p) => {
            const exp =
              p.expiryDate && p.expiryDate.toDate
                ? p.expiryDate.toDate().toLocaleDateString()
                : "—";
            const dt =
              p.createdAt && p.createdAt.toDate
                ? p.createdAt.toDate().toLocaleString()
                : "—";
            return `
                        <tr>
                          <td>${dt}</td>
                          <td>${p.batchNumber || "—"}</td>
                          <td>${p.quantity || 0}</td>
                          <td>${exp}</td>
                          <td>${p.supplierName || "—"}</td>
                          <td>${p.invoiceNumber || "—"}</td>
                        </tr>
                      `;
          })
          .join("")}
                </tbody>
              </table>
            `
      }

            <div class="section-title">Stock Logs</div>
            ${logs.length === 0
        ? '<div class="value">No logs recorded.</div>'
        : `
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Change</th>
                    <th>Old</th>
                    <th>New</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody> 
                  ${logs
          .map((l) => {
            const dt =
              l.createdAt && l.createdAt.toDate
                ? l.createdAt.toDate().toLocaleString()
                : "—";
            return `
                        <tr>
                          <td>${dt}</td>
                          <td>${l.reason || "—"}</td>
                          <td>${l.change || 0}</td>
                          <td>${l.oldStock ?? "—"}</td>
                          <td>${l.newStock ?? "—"}</td>
                          <td>${l.userName || l.userEmail || "—"}</td>
                        </tr>
                      `;
          })
          .join("")}
                </tbody>
              </table>
            `
      }
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

    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // ----- FILTERING & STATS -----

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(items.map((i) => i.category).filter((c) => !!c))
      ),
    [items]
  );

  const formOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.form).filter((f) => !!f))),
    [items]
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      if (term) {
        const name = (item.name || "").toLowerCase();
        if (!name.includes(term)) return false;
      }
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (formFilter && item.form !== formFilter) return false;

      const current = item.currentStock ?? 0;
      if (stockFilter === "low") {
        if (!(current > 0 && current <= 5)) return false;
      } else if (stockFilter === "out") {
        if (!(current <= 0)) return false;
      }

      if (expiryFilter === "near") {
        if (!isNearExpiry(item)) return false;
      } else if (expiryFilter === "expired") {
        if (!isExpired(item)) return false;
      }

      return true;
    });
  }, [items, search, categoryFilter, formFilter, stockFilter, expiryFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageData = filteredItems.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  useEffect(
    () => setPage(1),
    [search, categoryFilter, formFilter, stockFilter, expiryFilter]
  );

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

  // --- Row menu helpers ---

  const openRowMenu = (event, item) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 220; // rough height
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight;

    setRowMenu({
      open: true,
      item,
      anchorRect: rect,
      openUp,
    });
  };


  const closeRowMenu = () => {
    setRowMenu({
      open: false,
      item: null,
      anchorRect: null,
      openUp: false,
    });
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
      title: "Actions",
      align: "text-center",
      render: (item) => (
        <div
          className="actions-menu-trigger-wrapper"
          onClick={(e) => {
            e.stopPropagation();
            openRowMenu(e, item);
          }}
        >
          <i className="bi bi-three-dots-vertical actions-trigger-icon"></i>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h4 className="mb-4">Inventory Management</h4>

      {/* DASHBOARD CARDS */}
      <Row className="mb-3 g-3">
        <Col md={3} sm={6}>
          <Card
            className="shadow-sm border-0 dashboard-card"
            style={{ padding: 0 }}
          >
            <Card.Body style={{ padding: "10px 20px" }}>
              <div className="text-muted small">Total Items</div>
              <div className="fs-4 fw-semibold">{totalItems}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card
            className="shadow-sm border-0 dashboard-card"
            style={{ padding: 0 }}
          >
            <Card.Body style={{ padding: "10px 20px" }}>
              <div className="text-muted small">Low Stock (≤ 5)</div>
              <div className="fs-4 fw-semibold text-warning">
                {lowStockCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card
            className="shadow-sm border-0 dashboard-card"
            style={{ padding: 0 }}
          >
            <Card.Body style={{ padding: "10px 20px" }}>
              <div className="text-muted small">Out of Stock</div>
              <div className="fs-4 fw-semibold text-danger">
                {outOfStockCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card
            className="shadow-sm border-0 dashboard-card"
            style={{ padding: 0 }}
          >
            <Card.Body style={{ padding: "10px 20px" }}>
              <div className="text-muted small">Near Expiry (≤ 30 days)</div>
              <div className="fs-4 fw-semibold text-primary">
                {nearExpiryCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* FILTERS + TABLE */}
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Row className="align-items-end g-2 pb-3">
            <Col md={3}>
              <Form.Label className="small text-muted mb-1">Search</Form.Label>
              <Form.Control
                placeholder="Search medicine by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Label className="small text-muted mb-1">
                Category
              </Form.Label>
              <Form.Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1">Form</Form.Label>
              <Form.Select
                value={formFilter}
                onChange={(e) => setFormFilter(e.target.value)}
              >
                <option value="">All</option>
                {formOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1">Stock</Form.Label>
              <Form.Select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="low">Low (≤ 5)</option>
                <option value="out">Out of stock</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1">Expiry</Form.Label>
              <Form.Select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="near">Near expiry</option>
                <option value="expired">Expired</option>
              </Form.Select>
            </Col>
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

      {/* ROW DROPDOWN MENU */}
      <ActionMenuPortal
        open={rowMenu.open}
        anchorRect={rowMenu.anchorRect}
        openUp={rowMenu.openUp}
        onClose={closeRowMenu}
      >
        <button className="dt-row-menu-item" onClick={() => {
          openDetailsModal(rowMenu.item);
          closeRowMenu();
        }}>
          <i className="bi bi-eye" /> View Details
        </button>

        <button className="dt-row-menu-item" onClick={() => {
          handleAdjustStock(rowMenu.item, "increase");
          closeRowMenu();
        }}>
          <i className="bi bi-plus-circle" /> Increase Stock
        </button>

        <button className="dt-row-menu-item"
          disabled={(rowMenu.item?.currentStock ?? 0) <= 0}
          onClick={() => {
            handleAdjustStock(rowMenu.item, "decrease");
            closeRowMenu();
          }}>
          <i className="bi bi-dash-circle" /> Decrease Stock
        </button>

        <button className="dt-row-menu-item" onClick={() => {
          openPurchaseModalForItem(rowMenu.item);
          closeRowMenu();
        }}>
          <i className="bi bi-receipt" /> Add Purchase
        </button>

        <button className="dt-row-menu-item" onClick={() => {
          handlePrintDetail(rowMenu.item);
          closeRowMenu();
        }}>
          <i className="bi bi-printer" /> Print Sheet
        </button>
      </ActionMenuPortal>



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

      {/* DETAIL MODAL (dashboard-style) */}
      <Modal
        show={showDetailsModal}
        onHide={() => setShowDetailsModal(false)}
        size="xl"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Inventory Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!detailItem ? (
            <div className="text-muted small">No item selected.</div>
          ) : detailLoading ? (
            <div className="py-4 text-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              {/* Header summary */}
              <Row className="mb-3">
                <Col md={8}>
                  <h5 className="mb-1">
                    {detailItem.name}{" "}
                    <span className="text-muted small">
                      {detailItem.strength}
                    </span>
                  </h5>
                  <div className="text-muted small">
                    {detailItem.form || "—"} • {detailItem.category || "—"}
                  </div>
                  <div className="text-muted small">
                    Inventory ID: {detailItem.id}
                  </div>
                </Col>
                <Col
                  md={4}
                  className="d-flex flex-column align-items-md-end mt-2 mt-md-0 gap-2"
                >
                  <Button
                    className="visibility-hidden"
                    size="sm"
                    variant="outline-secondary"
                    onClick={handlePrintDetail}
                  >
                    Print Sheet
                  </Button>
                  <Button
                    className="visibility-hidden"
                    size="sm"
                    variant="outline-danger"
                    onClick={handleSoftDeleteInventory}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete Inventory"}
                  </Button>
                </Col>
              </Row>

              {/* Top metrics */}
              <Row className="mb-3 g-3">
                <Col md={4}>
                  <Card className="border-0 shadow-sm">
                    <Card.Body style={{ padding: "10px 14px" }}>
                      <div className="text-muted small">Opening Stock</div>
                      <div className="fs-5 fw-semibold">
                        {detailItem.openingStock ?? 0}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-0 shadow-sm">
                    <Card.Body style={{ padding: "10px 14px" }}>
                      <div className="text-muted small">Current Stock</div>
                      <div className="fs-5 fw-semibold">
                        {detailItem.currentStock ?? 0}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-0 shadow-sm">
                    <Card.Body style={{ padding: "10px 14px" }}>
                      <div className="text-muted small">Nearest Expiry</div>
                      <div className="fs-5 fw-semibold">
                        {getExpiryLabel(detailItem)}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Metadata edit & summary */}
              <Row className="mb-3">
                <Col md={6} className="display-none">
                  <h6 className="small text-uppercase text-muted mb-2">
                    Edit Metadata
                  </h6>
                  <Form>
                    <Form.Group className="mb-2">
                      <Form.Label>Name</Form.Label>
                      <Form.Control
                        size="sm"
                        value={metadataForm.name}
                        onChange={(e) =>
                          handleMetadataChange("name", e.target.value)
                        }
                      />
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label>Strength</Form.Label>
                      <Form.Control
                        size="sm"
                        value={metadataForm.strength}
                        onChange={(e) =>
                          handleMetadataChange("strength", e.target.value)
                        }
                      />
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label>Form</Form.Label>
                      <Form.Control
                        size="sm"
                        value={metadataForm.form}
                        onChange={(e) =>
                          handleMetadataChange("form", e.target.value)
                        }
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Category</Form.Label>
                      <Form.Control
                        size="sm"
                        value={metadataForm.category}
                        onChange={(e) =>
                          handleMetadataChange("category", e.target.value)
                        }
                      />
                    </Form.Group>
                    <Button
                      size="sm"
                      onClick={handleSaveMetadata}
                      disabled={metadataSaving}
                    >
                      {metadataSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </Form>
                </Col>
                <Col md={12}>
                  <h6 className="small text-uppercase text-muted mb-2">
                    Latest Purchase Batches
                  </h6>
                  {detailPurchases.length === 0 ? (
                    <div className="small text-muted">
                      No purchase entries.
                    </div>
                  ) : (
                    <div className="clinic-table-wrapper">
                      <table className="table table-sm mb-0">
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
                          {detailPurchases.slice(0, 5).map((p) => {
                            const status = expiryStatus(p.expiryDate);
                            return (
                              <tr key={p.id}>
                                <td>{formatDateTime(p.createdAt)}</td>
                                <td>{p.batchNumber || "—"}</td>
                                <td>{p.quantity || 0}</td>
                                <td>
                                  {p.expiryDate?.toDate
                                    ? p.expiryDate
                                      .toDate()
                                      .toLocaleDateString()
                                    : "—"}
                                </td>
                                <td>
                                  <Badge bg={status.variant}>
                                    {status.label}
                                  </Badge>
                                </td>
                                <td>{p.supplierName}</td>
                                <td>{p.invoiceNumber}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {detailPurchases.length > 5 && (
                        <div className="small text-muted">
                          + {detailPurchases.length - 5} more...
                        </div>
                      )}
                    </div>
                  )}
                </Col>
              </Row>

              {/* Logs table */}
              <Row className="display-none">
                <Col>
                  <h6 className="small text-uppercase text-muted mb-2">
                    Stock Logs
                  </h6>
                  {detailLogs.length === 0 ? (
                    <div className="small text-muted">No logs recorded.</div>
                  ) : (
                    <div className="clinic-table-wrapper">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Reason</th>
                            <th>Change</th>
                            <th>Done By</th>
                            <th>Old</th>
                            <th>New</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailLogs.map((l) => (
                            <tr key={l.id}>
                              <td>{formatDateTime(l.createdAt)}</td>
                              <td>{l.reason || "—"}</td>
                              <td>{l.change ?? "—"}</td>
                              <td>{l.userName || l.userEmail || "—"}</td>
                              <td>{l.oldStock ?? "—"}</td>
                              <td>{l.newStock ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Col>
              </Row>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
