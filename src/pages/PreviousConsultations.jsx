// src/pages/PreviousConsultations.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Form,
  Dropdown,
  ButtonGroup,
  Spinner,
} from "react-bootstrap";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";

import WorkorderPrint from "../components/WorkorderPrint";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import DataTable from "../components/DataTable";
import "../components/styles/table-wrapper.css";

const PAGE_SIZE = 8;

export default function PreviousConsultations() {
  const navigate = useNavigate();

  const [workorders, setWorkorders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [woSearch, setWoSearch] = useState("");
  const [woPatientFilter, setWoPatientFilter] = useState("");
  const [woDoctorFilter, setWoDoctorFilter] = useState("");
  const [woDateFrom, setWoDateFrom] = useState("");
  const [woDateTo, setWoDateTo] = useState("");
  const [woPage, setWoPage] = useState(1);

  const printRef = useRef();
  const [workOrderToPrint, setWorkOrderToPrint] = useState(null);
  const [printAction, setPrintAction] = useState(null); // "print" | "pdf" | null

  const handlePrintSpecific = useReactToPrint({
    contentRef: printRef,
  });

  // Load workorders
  useEffect(() => {
    const q = query(collection(db, "workorders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setWorkorders(list);
        setLoading(false);
      },
      (err) => {
        console.error("Workorders error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const doctorOptions = useMemo(() => {
    const map = new Map();
    workorders.forEach((w) => {
      const id = w.doctor?.id || w.doctorId;
      const name = w.doctor?.name || w.doctor?.email || "Unknown doctor";
      if (id && !map.has(id)) {
        map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [workorders]);

  const filteredWorkorders = useMemo(() => {
    const term = woSearch.trim().toLowerCase();
    const patientTerm = woPatientFilter.trim().toLowerCase();
    const fromDate = woDateFrom ? new Date(woDateFrom) : null;
    const toDate = woDateTo ? new Date(woDateTo) : null;
    if (toDate) toDate.setDate(toDate.getDate() + 1);

    return workorders.filter((w) => {
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
    workorders,
    woSearch,
    woPatientFilter,
    woDoctorFilter,
    woDateFrom,
    woDateTo,
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredWorkorders.length / PAGE_SIZE));
  const pageData = filteredWorkorders.slice(
    (woPage - 1) * PAGE_SIZE,
    woPage * PAGE_SIZE
  );

  useEffect(
    () =>
      setWoPage(1),
    [woSearch, woPatientFilter, woDoctorFilter, woDateFrom, woDateTo]
  );

  // Print / PDF effect
  useEffect(() => {
    if (!printAction || !workOrderToPrint) return;

    const doPrintOrPdf = async () => {
      await new Promise((res) => setTimeout(res, 80));

      const element = printRef.current;
      if (!element) {
        setPrintAction(null);
        return;
      }

      if (printAction === "print") {
        handlePrintSpecific();
      }

      if (printAction === "pdf") {
        try {
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
          });

          const imgData = canvas.toDataURL("image/jpeg", 1.0);

          const pdf = new jsPDF("p", "mm", "a4");
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

          pdf.addImage({
            imageData: imgData,
            format: "JPEG",
            x: 0,
            y: 0,
            width: pdfWidth,
            height: pdfHeight,
          });
          pdf.save(`Workorder-${workOrderToPrint.orderId}.pdf`);
        } catch (err) {
          console.error("PDF generation failed:", err);
          alert("Failed to generate PDF");
        }
      }

      setPrintAction(null);
    };

    doPrintOrPdf();
  }, [printAction, workOrderToPrint, handlePrintSpecific]);

  const handlePrintView = (w) => {
    navigate(`/app/consultations/print/${w.id}`);
  };

  const triggerPdf = (w) => {
    setWorkOrderToPrint(w);
    setPrintAction("pdf");
  };

  const handleEdit = (w) => {
    navigate("/app/consultations/new", {
      state: { workorderId: w.id },
    });
  };

  const handleDelete = async (w) => {
    if (!window.confirm(`Delete consultation #${w.orderId}?`)) return;
    try {
      await deleteDoc(doc(db, "workorders", w.id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  const handlePrintDirect = (w) => {
    setWorkOrderToPrint(w);
    setPrintAction("print");
  };

  // Helpers
  const formatDate = (tsOrStr) => {
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
  };

  const shortMedicinesPreview = (w) => {
    const meds = w.medicines || [];
    if (!meds.length) return "No medicines added";
    const names = meds.map((m) => m.name).filter(Boolean);
    if (!names.length) return `${meds.length} items`;
    const firstTwo = names.slice(0, 2).join(", ");
    if (names.length > 2) {
      return `${firstTwo} + ${names.length - 2} more`;
    }
    return firstTwo;
  };

  // DataTable columns – card-style row
  const columns = [
    {
      key: "info",
      title: "Consultation",
      render: (w) => (
        <div className="consultation-row">
          <div className="d-flex align-items-start gap-2">
            <div className="row-icon">🩺</div>
            <div>
              <div className="inv-main-title">
                #{w.orderId || "—"} &mdash;{" "}
                {w.patient?.name || "Unknown patient"}
              </div>
              <div className="inv-meta">
                <span>
                  {w.doctor?.name || w.doctor?.email || "Unknown doctor"}
                </span>
                <span>•</span>
                <span>{w.doctor.role}</span>
                <span>•</span>
                <span>{formatDate(w.createdAt)}</span>
              </div>
              <div className="small text-muted mt-1">
                <strong>Medicines:</strong> {shortMedicinesPreview(w)}{" "}
                <span className="text-muted">
                  ({(w.medicines || []).length} item
                  {(w.medicines || []).length === 1 ? "" : "s"})
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      render: (w) => (
        <Dropdown as={ButtonGroup} align="end">
          <Dropdown.Toggle
            size="sm"
            variant="outline-secondary"
            className="custom-dropup-toggle"
          >
            <i className="bi bi-plus-circle-dotted"></i>
          </Dropdown.Toggle>

          <Dropdown.Menu className="custom-dropup-menu">
            <Dropdown.Item onClick={() => handleEdit(w)}>
              <i className="bi bi-pencil-square me-2"></i>
              Edit
            </Dropdown.Item>

            <Dropdown.Item onClick={() => handlePrintView(w)}>
              <i className="bi bi-printer me-2"></i>
              Print View
            </Dropdown.Item>

            <Dropdown.Item onClick={() => handlePrintDirect(w)}>
              <i className="bi bi-printer-fill me-2"></i>
              Direct Print
            </Dropdown.Item>

            <Dropdown.Item onClick={() => triggerPdf(w)}>
              <i className="bi bi-file-earmark-pdf me-2"></i>
              PDF
            </Dropdown.Item>

            <Dropdown.Divider />

            <Dropdown.Item
              className="text-danger"
              onClick={() => handleDelete(w)}
            >
              <i className="bi bi-trash me-2"></i>
              Delete
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      ),
    },
  ];

  return (
    <div>
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Card.Title>Previous Consultations</Card.Title>

          {/* FILTERS */}
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

          {/* TABLE */}
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={pageData}
              page={woPage}
              pageCount={pageCount}
              onPageChange={setWoPage}
              emptyMessage="No consultations found"
            />
          )}
        </Card.Body>
      </Card>

      {/* Printable area */}
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
    </div>
  );
}
