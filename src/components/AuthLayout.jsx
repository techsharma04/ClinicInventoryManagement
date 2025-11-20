import React from "react";
import { Card, Container, Row, Col } from "react-bootstrap";
import "../styles/Auth.css";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-wrapper">
      <Container>
        <Row className="justify-content-center align-items-center min-vh-100">
          <Col md={8} lg={6}>
            <Card className="auth-card shadow-lg border-0">
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="auth-logo mb-2">🏥</div>
                  <h3 className="mb-1">{title}</h3>
                  {subtitle && (
                    <p className="text-muted small mb-0">{subtitle}</p>
                  )}
                </div>
                {children}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
