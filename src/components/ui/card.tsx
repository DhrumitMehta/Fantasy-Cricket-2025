import React, { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => (
  <div className={`bg-gray-900 shadow-lg rounded-lg p-4 border border-gray-800 ${className || ""}`}>
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ children }) => (
  <div className="border-b border-gray-800 pb-3 mb-3">{children}</div>
);

export const CardTitle: React.FC<CardProps> = ({ children }) => (
  <h2 className="text-xl font-bold text-gray-200">{children}</h2>
);

export const CardContent: React.FC<CardProps> = ({ children }) => (
  <div className="text-gray-300">{children}</div>
);