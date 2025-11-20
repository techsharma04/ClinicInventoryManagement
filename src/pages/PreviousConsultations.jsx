// src/pages/PreviousConsultations.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Form,
  Table,
  Pagination,
  Dropdown,
  ButtonGroup,
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

const PAGE_SIZE = 8;

export default function PreviousConsultations() {
  const navigate = useNavigate();

  const [workorders, setWorkorders] = useState([]);
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
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setWorkorders(list);
    });
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

  useEffect(() => setWoPage(1), [
    woSearch,
    woPatientFilter,
    woDoctorFilter,
    woDateFrom,
    woDateTo,
  ]);

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
            backgroundColor: "#ffffff"
          });

          // Convert to JPEG instead of PNG (fixes wrong PNG signature error)
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
            height: pdfHeight
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

  return (
    <div>
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
          <div className="clinic-table-wrapper previous-consultations-table-wrapper">
            <Table striped bordered={false} hover size="sm" className="clinic-table no-responsive-table">
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
                {pageData.map((w) => (
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
                    <td style={{ textAlign: 'center', position: "relative", overflow: "visible" }}>
                      <Dropdown
                        // drop="up"
                        as={ButtonGroup}
                        align="end"
                      >
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
                            Print
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


                    </td>
                  </tr>
                ))}
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No consultations found
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
