"use client";

import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    window.location.href = "/fr/auth/login";
  }, []);

  return null;
}