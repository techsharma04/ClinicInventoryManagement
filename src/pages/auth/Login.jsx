// src/pages/auth/Login.jsx
import React, { useState, useEffect } from "react";
import { Form, Button, Alert } from "react-bootstrap";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AuthLayout from "../../components/AuthLayout";
import { clearAuthError, loginDoctor } from "../../features/authSlice";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, error } = useSelector((state) => state.auth);

  const [form, setForm] = useState({ email: "", password: "" });
  const [formErrors, setFormErrors] = useState({});

  const from = location.state?.from?.pathname || "/app/dashboard";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const validate = () => {
    const errors = {};
    if (!form.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = "Enter a valid email";

    if (!form.password) errors.password = "Password is required";
    else if (form.password.length < 6)
      errors.password = "Minimum 6 characters";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    dispatch(loginDoctor(form));
  };

  return (
    <AuthLayout
      title="Doctor Login"
      subtitle="Secure access to your clinic dashboard"
    >
      {error && (
        <Alert variant="danger" className="small">
          {error}
        </Alert>
      )}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            name="email"
            placeholder="doctor@example.com"
            value={form.email}
            onChange={handleChange}
            isInvalid={!!formErrors.email}
          />
          <Form.Control.Feedback type="invalid">
            {formErrors.email}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            name="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
            isInvalid={!!formErrors.password}
          />
          <Form.Control.Feedback type="invalid">
            {formErrors.password}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link to="/auth/forgot" className="small">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-100"
          disabled={loading}
          variant="primary"
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>

        <div className="text-center mt-3 small">
          New doctor? <Link to="/auth/signup">Create an account</Link>
        </div>
      </Form>
    </AuthLayout>
  );
}
