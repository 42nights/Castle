"use client";

import { createContext, useContext, type ReactNode } from "react";

type Role = "operator" | "guest";

const RoleCtx = createContext<Role>("guest");

export function RoleProvider({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  return <RoleCtx.Provider value={role}>{children}</RoleCtx.Provider>;
}

export function useIsOperator(): boolean {
  return useContext(RoleCtx) === "operator";
}
