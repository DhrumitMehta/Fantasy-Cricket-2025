"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function PageLoadingIndicator() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // This effect runs when pathname or searchParams change,
    // indicating a navigation has completed
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (
        link &&
        link.href &&
        !link.href.startsWith("javascript:") &&
        !link.target &&
        link.origin === window.location.origin &&
        link.pathname !== window.location.pathname
      ) {
        setLoading(true);
      }
    };

    window.addEventListener("click", handleAnchorClick);

    return () => {
      window.removeEventListener("click", handleAnchorClick);
    };
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 bg-[#1a1c2e]/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-16 h-16 border-4 border-[#4ade80] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
