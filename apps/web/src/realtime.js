import { createContext, useContext } from 'react';

export const RealtimeContext = createContext({ all: 0, campaigns: {} });
export function useCampaignRefresh(id) {
  const refresh = useContext(RealtimeContext);
  return `${refresh.all}:${refresh.campaigns[id] ?? 0}`;
}
