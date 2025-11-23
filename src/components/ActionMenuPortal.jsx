// src/components/ActionMenuPortal.jsx
import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";

export default function ActionMenuPortal({
  open,
  anchorRect,
  openUp,
  onClose,
  children
}) {
  const [el] = useState(() => document.createElement("div"));
  const menuRef = useRef(null);

  useEffect(() => {
    document.body.appendChild(el);
    return () => document.body.removeChild(el);
  }, [el]);

  // -------------------------------
  // CLICK OUTSIDE + SCROLL + RESIZE
  // -------------------------------
  useEffect(() => {
    if (!open) return;

    const handleClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const handler = () => onClose?.();

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  const WIDTH = 200;
  const ARROW = 10;
  const MARGIN = 8;

  // -------------------------------
  // SMART POSITIONING
  // -------------------------------
  const top = openUp
    ? anchorRect.top + window.scrollY - MARGIN
    : anchorRect.bottom + window.scrollY + MARGIN;

  const left = anchorRect.right + window.scrollX - WIDTH;

  const menuStyle = {
    position: "absolute",
    top,
    left,
    width: WIDTH,
    zIndex: 99999
  };

  // -------------------------------
  // ARROW STYLE
  // -------------------------------
  const arrowStyle = {
    position: "absolute",
    right: "16px",
    width: 0,
    height: 0,
    borderLeft: `${ARROW}px solid transparent`,
    borderRight: `${ARROW}px solid transparent`,
    ...(openUp
      ? { bottom: "-8px", borderTop: `${ARROW}px solid white` }
      : { top: "-8px", borderBottom: `${ARROW}px solid white` }),
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className={`actions-menu-portal ${openUp ? "up" : "down"} open`}
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="menu-arrow" style={arrowStyle} />
      {children}
    </div>,
    el
  );
}
