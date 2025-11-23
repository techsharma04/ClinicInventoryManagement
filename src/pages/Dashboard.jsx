// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Form,
  Modal,
  Badge,
  Spinner,
} from "react-bootstrap";
import {
  collection,
  getCountFromServer,
  getDocs,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// 🔹 Recharts for charts
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  AreaChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const VISITORS_PAGE_SIZE = 10;

export default function Dashboard() {
  const [counts, setCounts] = useState({
    medicines: 0,
    workorders: 0,
    patients: 0,
    male: 0,
    female: 0,
    others: 0,
    loading: true,
  });

  // 🔹 Daily visitors state
  const [visitors, setVisitors] = useState([]);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [visitorError, setVisitorError] = useState("");

  // Filters / search / pagination
  const [visitorFilterRange, setVisitorFilterRange] = useState("today"); // "all" | "today" | "week" | "month"
  const [visitorSearch, setVisitorSearch] = useState("");
  const [visitorPage, setVisitorPage] = useState(1);

  // Add visitor modal
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [savingVisitor, setSavingVisitor] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    patientName: "",
    age: "",
    phone: "",
    email: "",
    fees: "",
    referredBy: "",
  });

  // ==========================
  //  COUNTS (cards)
  // ==========================
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const medsRef = collection(db, "medicines");
        const woRef = collection(db, "workorders");
        const patientsRef = collection(db, "patients");

        const [medsSnap, woSnap, patientsCountSnap, patientsDocsSnap] =
          await Promise.all([
            getCountFromServer(medsRef),
            getCountFromServer(woRef),
            getCountFromServer(patientsRef),
            getDocs(patientsRef),
          ]);

        let male = 0;
        let female = 0;
        let others = 0;

        patientsDocsSnap.forEach((doc) => {
          const sex = (doc.data().sex || "").toLowerCase();
          if (sex === "male") male++;
          else if (sex === "female") female++;
          else others++;
        });

        setCounts({
          medicines: medsSnap.data().count,
          workorders: woSnap.data().count,
          patients: patientsCountSnap.data().count,
          male,
          female,
          others,
          loading: false,
        });
      } catch (err) {
        console.error(err);
        setCounts((c) => ({ ...c, loading: false }));
      }
    };
    fetchCounts();
  }, []);

  const loadingText = counts.loading ? "..." : null;

  // ==========================
  //  DAILY VISITORS – REALTIME
  // ==========================
  useEffect(() => {
    const q = query(
      collection(db, "dailyVisitorsData"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setVisitors(list);
        setVisitorsLoading(false);
      },
      (err) => {
        console.error("dailyVisitorsData error:", err);
        setVisitorsLoading(false);
        setVisitorError("Failed to load visitors.");
      }
    );

    return () => unsub();
  }, []);

  // ==========================
  //  FEES TOTALS (Today / Week / Month / Year)
  // ==========================
  const {
    todayTotalFees,
    weekTotalFees,
    monthTotalFees,
    yearTotalFees,
  } = useMemo(() => {
    if (!visitors.length) {
      return {
        todayTotalFees: 0,
        weekTotalFees: 0,
        monthTotalFees: 0,
        yearTotalFees: 0,
      };
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // Monday as start of the week
    const day = startOfToday.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1) - day;
    const startOfWeek = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate() + diff
    );

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let today = 0;
    let week = 0;
    let month = 0;
    let year = 0;

    visitors.forEach((v) => {
      const ts = v.createdAt;
      if (!ts) return;

      let d;
      try {
        d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
        if (!d || Number.isNaN(d.getTime())) return;
      } catch {
        return;
      }

      const amount = Number(v.fees) || 0;

      if (d >= startOfYear) {
        year += amount;
        if (d >= startOfMonth) {
          month += amount;
          if (d >= startOfWeek) {
            week += amount;
            if (d >= startOfToday) {
              today += amount;
            }
          }
        }
      }
    });

    return {
      todayTotalFees: today,
      weekTotalFees: week,
      monthTotalFees: month,
      yearTotalFees: year,
    };
  }, [visitors]);

  // ==========================
  //  CHART DATA (Daily / Weekly / Monthly / Yearly)
  // ==========================
  const { dailyChartData, weeklyChartData, monthlyChartData, yearlyChartData } =
    useMemo(() => {
      const normalizeDate = (ts) => {
        if (!ts) return null;
        try {
          const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
          if (!d || Number.isNaN(d.getTime())) return null;
          return d;
        } catch {
          return null;
        }
      };

      const now = new Date();
      const all = visitors
        .map((v) => ({
          date: normalizeDate(v.createdAt),
          fees: Number(v.fees) || 0,
        }))
        .filter((x) => x.date);

      // --- Daily: last 7 days ---
      const daily = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - i
        );
        const dayKey = d.toDateString();
        const total = all
          .filter((item) => item.date.toDateString() === dayKey)
          .reduce((sum, item) => sum + item.fees, 0);
        daily.push({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          fees: total,
        });
      }

      // Helper: start of week (Monday)
      const getWeekStart = (date) => {
        const d = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        );
        const day = d.getDay(); // 0=Sun
        const diff = (day === 0 ? -6 : 1) - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      // --- Weekly: last 8 weeks ---
      const weekly = [];
      const currentWeekStart = getWeekStart(now);
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const total = all
          .filter((item) => item.date >= weekStart && item.date < weekEnd)
          .reduce((sum, item) => sum + item.fees, 0);

        weekly.push({
          label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
          fees: total,
        });
      }

      // --- Monthly: last 6 months ---
      const monthly = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(
          monthDate.getFullYear(),
          monthDate.getMonth(),
          1
        );
        const monthEnd = new Date(
          monthDate.getFullYear(),
          monthDate.getMonth() + 1,
          1
        );

        const total = all
          .filter(
            (item) => item.date >= monthStart && item.date < monthEnd
          )
          .reduce((sum, item) => sum + item.fees, 0);

        monthly.push({
          label: monthStart.toLocaleString("en-US", { month: "short" }),
          fees: total,
        });
      }

      // --- Yearly: last 5 years ---
      const yearly = [];
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year + 1, 0, 1);

        const total = all
          .filter(
            (item) => item.date >= yearStart && item.date < yearEnd
          )
          .reduce((sum, item) => sum + item.fees, 0);

        yearly.push({
          label: String(year),
          fees: total,
        });
      }

      return {
        dailyChartData: daily,
        weeklyChartData: weekly,
        monthlyChartData: monthly,
        yearlyChartData: yearly,
      };
    }, [visitors]);

  // ==========================
  //  FILTER + SEARCH + PAGINATION
  // ==========================

  const filterByDateRange = (v) => {
    const createdAt = v.createdAt;
    if (!createdAt) return false;

    let d;
    try {
      d =
        typeof createdAt.toDate === "function"
          ? createdAt.toDate()
          : new Date(createdAt);
      if (!d || Number.isNaN(d.getTime())) return false;
    } catch {
      return false;
    }

    if (visitorFilterRange === "all") return true;

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    if (visitorFilterRange === "today") {
      return d >= startOfToday;
    }

    if (visitorFilterRange === "week") {
      // Start of current week (Monday)
      const day = startOfToday.getDay(); // 0=Sun
      const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
      const startOfWeek = new Date(
        startOfToday.getFullYear(),
        startOfToday.getMonth(),
        startOfToday.getDate() + diff
      );
      return d >= startOfWeek;
    }

    if (visitorFilterRange === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= startOfMonth;
    }

    return true;
  };

  const filteredVisitors = useMemo(() => {
    let list = visitors;

    // date filters
    if (visitorFilterRange !== "all") {
      list = list.filter(filterByDateRange);
    }

    // search
    const term = visitorSearch.trim().toLowerCase();
    if (term) {
      list = list.filter((v) => {
        const name = (v.patientName || "").toLowerCase();
        const phone = (v.phone || "").toLowerCase();
        const refBy = (v.referredBy || "").toLowerCase();
        return (
          name.includes(term) ||
          phone.includes(term) ||
          refBy.includes(term)
        );
      });
    }

    return list;
  }, [visitors, visitorFilterRange, visitorSearch]);

  const visitorsPageCount = Math.max(
    1,
    Math.ceil(filteredVisitors.length / VISITORS_PAGE_SIZE)
  );

  const visitorsPageData = filteredVisitors.slice(
    (visitorPage - 1) * VISITORS_PAGE_SIZE,
    visitorPage * VISITORS_PAGE_SIZE
  );

  // Reset page when filters/search change
  useEffect(() => {
    setVisitorPage(1);
  }, [visitorFilterRange, visitorSearch]);

  const formatVisitorDateTime = (ts) => {
    if (!ts) return "—";
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
      if (!d || Number.isNaN(d.getTime())) return "—";

      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "—";
    }
  };

  // ==========================
  //  ADD VISITOR MODAL HANDLERS
  // ==========================

  const openVisitorModal = () => {
    setVisitorForm({
      patientName: "",
      age: "",
      phone: "",
      email: "",
      fees: "",
      referredBy: "",
    });
    setVisitorError("");
    setShowVisitorModal(true);
  };

  const validateVisitorForm = () => {
    if (!visitorForm.patientName.trim()) {
      setVisitorError("Patient name is required.");
      return false;
    }
    if (!visitorForm.age.trim()) {
      setVisitorError("Age is required.");
      return false;
    }
    // Fees can be 0 (complimentary) – but field must be present
    if (visitorForm.fees === "" || visitorForm.fees === null) {
      setVisitorError("Please enter consultation fees (0 allowed).");
      return false;
    }
    return true;
  };

  const handleVisitorSubmit = async (e) => {
    e.preventDefault();
    setVisitorError("");

    if (!validateVisitorForm()) return;

    setSavingVisitor(true);
    try {
      const feesValue = Number(visitorForm.fees) || 0;

      await addDoc(collection(db, "dailyVisitorsData"), {
        patientName: visitorForm.patientName.trim(),
        age: visitorForm.age.trim(),
        phone: visitorForm.phone.trim() || null,
        email: visitorForm.email.trim() || null,
        fees: feesValue,
        referredBy: visitorForm.referredBy.trim() || null,
        createdAt: serverTimestamp(),
      });

      setShowVisitorModal(false);
    } catch (err) {
      console.error(err);
      setVisitorError("Failed to save visitor entry.");
    } finally {
      setSavingVisitor(false);
    }
  };

  // ==========================
  //  RENDER
  // ==========================

  return (
    <div>
      <h4 className="mb-4">Dashboard</h4>
      <div className="dashboard-container">
        {/* TOP CARDS */}
        <Row className="g-3">
          <Col md={3}>
            <Card className="dashboard-card" style={{ padding: 0 }}>
              <Card.Body
                className="dashboard-card-body"
                style={{ padding: "10px 20px" }}
              >
                <div className="dashboard-card-title">Medicines</div>
                <div className="dashboard-card-value">
                  {loadingText || counts.medicines}
                </div>
                <div className="dashboard-card-meta">
                  Total medicines in inventory
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="dashboard-card" style={{ padding: 0 }}>
              <Card.Body
                className="dashboard-card-body"
                style={{ padding: "10px 20px" }}
              >
                <div className="dashboard-card-title">Consultations</div>
                <div className="dashboard-card-value">
                  {loadingText || counts.workorders}
                </div>
                <div className="dashboard-card-meta">
                  Total prescriptions created
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="dashboard-card" style={{ padding: 0 }}>
              <Card.Body
                className="dashboard-card-body"
                style={{ padding: "10px 20px" }}
              >
                <div className="dashboard-card-title">Patients</div>
                <div className="dashboard-card-value">
                  {loadingText || counts.patients}
                </div>
                {!counts.loading && (
                  <div className="dashboard-card-meta">
                    Male: <strong>{counts.male}</strong> &nbsp;|&nbsp; Female:{" "}
                    <strong>{counts.female}</strong> &nbsp;|&nbsp; Others:{" "}
                    <strong>{counts.others}</strong>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* FEES CARD */}
          <Col md={3}>
            <Card className="dashboard-card" style={{ padding: 0 }}>
              <Card.Body
                className="dashboard-card-body"
                style={{ padding: "10px 20px" }}
              >
                <div className="dashboard-card-title">Today's Fees</div>
                <div className="dashboard-card-value">
                  {visitorsLoading ? "..." : `₹ ${todayTotalFees}`}
                </div>
                {!visitorsLoading && (
                  <div className="dashboard-card-meta">
                    Week: <strong>₹ {weekTotalFees}</strong> &nbsp;|&nbsp; Month:{" "}
                    <strong>₹ {monthTotalFees}</strong> &nbsp;|&nbsp; Year:{" "}
                    <strong>₹ {yearTotalFees}</strong>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="mt-5 graph-visitor-table">
          <Col md={6}>

            {/* FEES CHARTS ROW (small, 2x2 layout on desktop) */}
            <Row className="g-3 w-100">
              {/* Daily - Bar Chart */}
              <Col md={6}>
                <Card className="shadow-sm border-0">
                  <Card.Body style={{ padding: "10px 16px" }}>
                    <div className="small text-muted mb-1">
                      Daily Fees (Last 7 Days)
                    </div>
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <BarChart data={dailyChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="fees" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Weekly - Bar Chart */}
              <Col md={6}>
                <Card className="shadow-sm border-0">
                  <Card.Body style={{ padding: "10px 16px" }}>
                    <div className="small text-muted mb-1">
                      Weekly Fees (Last 8 Weeks)
                    </div>
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <BarChart data={weeklyChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="fees" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            <Row className="g-3 mt-3">
              {/* Monthly - Line Chart */}
              <Col md={6}>
                <Card className="shadow-sm border-0">
                  <Card.Body style={{ padding: "10px 16px" }}>
                    <div className="small text-muted mb-1">
                      Monthly Fees (Last 6 Months)
                    </div>
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <LineChart data={monthlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="fees"
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Yearly - Area Chart */}
              <Col md={6}>
                <Card className="shadow-sm border-0">
                  <Card.Body style={{ padding: "10px 16px" }}>
                    <div className="small text-muted mb-1">
                      Yearly Fees (Last 5 Years)
                    </div>
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <AreaChart data={yearlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="fees"
                            stroke="#8884d8"
                            fillOpacity={0.3}
                            fill="#8884d8"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Col>
          <Col md={6}>
            {/* DAILY VISITORS SECTION */}

            <Card className="shadow-sm border-0 w-100 h-100">
              <Card.Body>
                {/* Header row: title + button */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                  <div>
                    <h5 className="mb-1">Daily Visitors</h5>
                    <div className="text-muted small">
                      Track patient visits and consultation fees in real time.
                    </div>
                  </div>
                  <Button onClick={openVisitorModal}>+ Add Visitor</Button>
                </div>

                {/* Filters row */}
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
                  {/* Search */}
                  <Form.Control
                    placeholder="Search by name, phone or referred by..."
                    style={{ maxWidth: 320 }}
                    value={visitorSearch}
                    onChange={(e) => setVisitorSearch(e.target.value)}
                  />

                  {/* Range filters */}
                  <div className="d-flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={
                        visitorFilterRange === "today"
                          ? "primary"
                          : "outline-secondary"
                      }
                      onClick={() => setVisitorFilterRange("today")}
                    >
                      Today
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        visitorFilterRange === "week"
                          ? "primary"
                          : "outline-secondary"
                      }
                      onClick={() => setVisitorFilterRange("week")}
                    >
                      This Week
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        visitorFilterRange === "month"
                          ? "primary"
                          : "outline-secondary"
                      }
                      onClick={() => setVisitorFilterRange("month")}
                    >
                      This Month
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        visitorFilterRange === "all"
                          ? "primary"
                          : "outline-secondary"
                      }
                      onClick={() => setVisitorFilterRange("all")}
                    >
                      All
                    </Button>
                  </div>
                </div>

                {/* Table */}
                {visitorsLoading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" />
                  </div>
                ) : visitorError ? (
                  <div className="text-danger small">{visitorError}</div>
                ) : filteredVisitors.length === 0 ? (
                  <div className="text-muted small">
                    No visitors found for selected filters.
                  </div>
                ) : (
                  <div className="table-container">
                    <div className="table-scroll">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th style={{ width: "18%" }}>Date / Time</th>
                            <th style={{ width: "22%" }}>Patient</th>
                            <th style={{ width: "8%" }}>Age</th>
                            <th style={{ width: "16%" }}>Phone</th>
                            <th style={{ width: "16%" }}>Fees</th>
                            <th style={{ width: "20%" }}>Referred By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitorsPageData.map((v) => (
                            <tr key={v.id}>
                              <td className="small">
                                {formatVisitorDateTime(v.createdAt)}
                              </td>
                              <td style={{ textTransform: "capitalize" }}>
                                {v.patientName || "—"}
                              </td>
                              <td>{v.age || "—"}</td>
                              <td>{v.phone || "—"}</td>
                              <td>
                                <Badge bg="success" pill>
                                  ₹ {typeof v.fees === "number" ? v.fees : 0}
                                </Badge>
                              </td>
                              <td style={{ textTransform: "capitalize" }}>
                                {v.referredBy || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {visitorsPageCount > 1 && (
                      <div className="d-flex justify-content-end gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          disabled={visitorPage === 1}
                          onClick={() => setVisitorPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <span className="small align-self-center">
                          Page {visitorPage} of {visitorsPageCount}
                        </span>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          disabled={visitorPage === visitorsPageCount}
                          onClick={() =>
                            setVisitorPage((p) =>
                              Math.min(visitorsPageCount, p + 1)
                            )
                          }
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* ADD VISITOR MODAL */}
        <Modal
          show={showVisitorModal}
          onHide={() => setShowVisitorModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Add Visitor</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleVisitorSubmit}>
            <Modal.Body>
              {visitorError && (
                <div className="alert alert-danger py-2 small">
                  {visitorError}
                </div>
              )}

              <Form.Group className="mb-3">
                <Form.Label>Patient Name</Form.Label>
                <Form.Control
                  value={visitorForm.patientName}
                  onChange={(e) =>
                    setVisitorForm((p) => ({
                      ...p,
                      patientName: e.target.value,
                    }))
                  }
                  placeholder="Enter patient full name"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Age</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={visitorForm.age}
                  onChange={(e) =>
                    setVisitorForm((p) => ({ ...p, age: e.target.value }))
                  }
                  placeholder="e.g. 32"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Phone (optional)</Form.Label>
                <Form.Control
                  value={visitorForm.phone}
                  onChange={(e) =>
                    setVisitorForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="e.g. 9876543210"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email (optional)</Form.Label>
                <Form.Control
                  type="email"
                  value={visitorForm.email}
                  onChange={(e) =>
                    setVisitorForm((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="e.g. patient@example.com"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Consultation Fees</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={visitorForm.fees}
                  onChange={(e) =>
                    setVisitorForm((p) => ({
                      ...p,
                      fees: e.target.value,
                    }))
                  }
                  placeholder="Enter amount (0 allowed)"
                />
              </Form.Group>

              <Form.Group className="mb-0">
                <Form.Label>Referred By</Form.Label>
                <Form.Control
                  value={visitorForm.referredBy}
                  onChange={(e) =>
                    setVisitorForm((p) => ({ ...p, referredBy: e.target.value }))
                  }
                  placeholder="e.g. Self, Dr. Sharma, Google, etc."
                />
              </Form.Group>
            </Modal.Body>

            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowVisitorModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingVisitor}>
                {savingVisitor ? "Saving..." : "Save Visitor"}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
