import { useQuery } from '@tanstack/react-query';
import { systemApi } from '../../api/system';

export const systemKeys = { health: ['system', 'health'] };

export function useSystemHealth() {
  return useQuery({ queryKey: systemKeys.health, queryFn: systemApi.health, staleTime: 15 * 1000 });
}
