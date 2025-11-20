// src/pages/auth/Signup.jsx
import React, { useState, useEffect } from "react";
import { Form, Button, Alert } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AuthLayout from "../../components/AuthLayout";
import { clearAuthError, signupDoctor } from "../../features/authSlice";

export default function Signup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading, error } = useSelector((s) => s.auth);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (user) navigate("/app/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const validate = () => {
    const errors = {};

    if (!form.name.trim()) errors.name = "Name is required";

    if (!form.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = "Enter a valid email";

    if (!form.password) errors.password = "Password is required";
    else if (form.password.length < 6)
      errors.password = "Minimum 6 characters";

    if (!form.confirmPassword)
      errors.confirmPassword = "Confirm your password";
    else if (form.password !== form.confirmPassword)
      errors.confirmPassword = "Passwords do not match";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    dispatch(
      signupDoctor({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
    );
  };

  return (
    <AuthLayout
      title="Doctor Registration"
      subtitle="Create your secure access for clinic platform"
    >
      {error && (
        <Alert variant="danger" className="small">
          {error}
        </Alert>
      )}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label>Full Name</Form.Label>
          <Form.Control
            type="text"
            name="name"
            placeholder="Dr. John Doe"
            value={form.name}
            onChange={handleChange}
            isInvalid={!!formErrors.name}
          />
          <Form.Control.Feedback type="invalid">
            {formErrors.name}
          </Form.Control.Feedback>
        </Form.Group>

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
            placeholder="Create a password"
            value={form.password}
            onChange={handleChange}
            isInvalid={!!formErrors.password}
          />
          <Form.Control.Feedback type="invalid">
            {formErrors.password}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Confirm Password</Form.Label>
          <Form.Control
            type="password"
            name="confirmPassword"
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={handleChange}
            isInvalid={!!formErrors.confirmPassword}
          />
          <Form.Control.Feedback type="invalid">
            {formErrors.confirmPassword}
          </Form.Control.Feedback>
        </Form.Group>

        <Button
          type="submit"
          className="w-100"
          disabled={loading}
          variant="primary"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </Button>

        <div className="text-center mt-3 small">
          Already have an account? <Link to="/auth/login">Sign in</Link>
        </div>
      </Form>
    </AuthLayout>
  );
}
