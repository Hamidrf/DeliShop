import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, api } from './api';
import { queryClient } from './queryClient';

interface Me {
  username: string;
}

/** `null` means logged out; `undefined` means still loading. */
export function useMe() {
  return useQuery<Me | null>({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/auth/me').catch(err => {
      if (err instanceof ApiError && err.code === 'not_logged_in') return null;
      throw err;
    }),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: { username: string; password: string }) => api.post<Me>('/auth/login', input),
    onSuccess: me => queryClient.setQueryData(['me'], me),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => queryClient.setQueryData(['me'], null),
  });
}
