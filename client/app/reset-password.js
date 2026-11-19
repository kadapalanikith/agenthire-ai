import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button, FormTextField, InlineAlert } from '../src/components/ui';
import { AuthLayout } from '../src/features/auth/AuthLayout';
import { describePasswordPolicy, resetPasswordSchema } from '../src/features/auth/schemas';
import { useAuthPolicy, useResetPassword } from '../src/features/auth/hooks';
import { applyFieldErrors } from '../src/api/client';
import { useAuthStore } from '../src/stores/authStore';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** Public route opened from the password reset email (web link or agenthire:// deep link). */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams();
  const tokenValue = typeof token === 'string' ? token : '';
  const validToken = TOKEN_PATTERN.test(tokenValue);
  const reset = useResetPassword();
  const signOut = useAuthStore((s) => s.signOut);
  const policy = useAuthPolicy();
  const passwordPolicy = policy.data?.password;
  const schema = useMemo(() => resetPasswordSchema(passwordPolicy), [passwordPolicy]);

  const { control, handleSubmit, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(({ password }) =>
    reset
      .mutateAsync({ token: tokenValue, password })
      .then(() => signOut()) // existing sessions are revoked server-side
      .catch((err) => {
        applyFieldErrors(err, setError, ['password']);
      })
  );

  const goToLogin = () => router.replace('/login');
  const formError = reset.error && reset.error.code !== 'VALIDATION_ERROR' ? reset.error : null;

  if (!validToken) {
    return (
      <AuthLayout title="Reset link not valid" subtitle="This link is incomplete. Request a new reset email to continue.">
        <Button title="Request a new link" onPress={() => router.replace('/forgot-password')} testID="reset-request-new" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Signing in again will be required on all devices.">
      {reset.isSuccess ? (
        <View className="gap-4">
          <InlineAlert tone="success" title="Password updated" message={reset.data.message} />
          <Button title="Go to sign in" onPress={goToLogin} testID="reset-go-login" />
        </View>
      ) : (
        <View className="gap-4">
          {formError ? <InlineAlert tone="error" message={formError.message} /> : null}
          <FormTextField
            control={control}
            name="password"
            label="New password"
            placeholder="Create a password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            hint={describePasswordPolicy(passwordPolicy)}
            testID="reset-password"
          />
          <FormTextField
            control={control}
            name="confirmPassword"
            label="Confirm new password"
            placeholder="Repeat your password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={onSubmit}
            testID="reset-confirm"
          />
          <Button title="Update password" onPress={onSubmit} loading={reset.isPending} testID="reset-submit" />
        </View>
      )}
    </AuthLayout>
  );
}
