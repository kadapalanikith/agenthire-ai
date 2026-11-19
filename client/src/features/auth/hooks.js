import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { systemApi } from '../../api/system';
import { useAuthStore } from '../../stores/authStore';

export const authKeys = {
  policy: ['meta', 'auth-policy'],
};

/** Password policy from the server spec; forms fall back to "required" until it loads. */
export function useAuthPolicy() {
  return useQuery({ queryKey: authKeys.policy, queryFn: systemApi.authPolicy, staleTime: 60 * 60 * 1000, retry: 1 });
}

export function useLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({ email, password }) => authApi.login({ email, password }),
    onSuccess: (data) => signIn(data),
  });
}

export function useSignup() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({ name, email, password }) => authApi.signup({ name, email, password }),
    onSuccess: (data) => signIn(data),
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: ({ email }) => authApi.forgotPassword({ email }) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: ({ token, password }) => authApi.resetPassword({ token, password }) });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const signOut = useAuthStore((s) => s.signOut);
  return async () => {
    await signOut();
    queryClient.clear();
  };
}
