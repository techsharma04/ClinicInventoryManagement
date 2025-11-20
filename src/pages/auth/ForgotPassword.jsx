// src/pages/auth/ForgotPassword.jsx
import React, { useState, useEffect } from "react";
import { Form, Button, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AuthLayout from "../../components/AuthLayout";
import { clearAuthError, resetPassword } from "../../features/authSlice";

export default function ForgotPassword() {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const validate = () => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitted(false);
    const resultAction = await dispatch(resetPassword(email.trim()));
    if (resetPassword.fulfilled.match(resultAction)) {
      setSubmitted(true);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="We will send a reset link to your email"
    >
      {error && (
        <Alert variant="danger" className="small">
          {error}
        </Alert>
      )}
      {submitted && (
        <Alert variant="success" className="small">
          Password reset link sent to your email.
        </Alert>
      )}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            placeholder="doctor@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            isInvalid={!!emailError}
          />
          <Form.Control.Feedback type="invalid">
            {emailError}
          </Form.Control.Feedback>
        </Form.Group>

        <Button
          type="submit"
          className="w-100"
          disabled={loading}
          variant="primary"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </Button>

        <div className="text-center mt-3 small">
          <Link to="/auth/login">Back to login</Link>
        </div>
      </Form>
    </AuthLayout>
  );
}
