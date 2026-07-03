import { QueryClient, QueryClientContext, QueryClientProvider } from "@tanstack/react-query";
import { useContext, useState, type ReactNode } from "react";

export type MediaQueryProviderProps = {
  children: ReactNode;
  client?: QueryClient;
};

export function MediaQueryProvider({ children, client }: MediaQueryProviderProps) {
  const parentClient = useContext(QueryClientContext);
  const [ownedClient] = useState(() => client ?? new QueryClient());

  if (parentClient) return <>{children}</>;

  return <QueryClientProvider client={ownedClient}>{children}</QueryClientProvider>;
}
