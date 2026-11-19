import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { Button, FormTextField, InlineAlert } from '../../src/components/ui';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { TextLink } from '../../src/features/auth/TextLink';
import { forgotPasswordSchema } from '../../src/features/auth/schemas';
import { useForgotPassword } from '../../src/features/auth/hooks';
import { applyFieldErrors } from '../../src/api/client';

export default function ForgotPasswordScreen() {
  const forgot = useForgotPassword();
  const { control, handleSubmit, setError } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit((values) =>
    forgot.mutateAsync(values).catch((err) => {
      applyFieldErrors(err, setError, ['email']);
    })
  );

  const formError = forgot.error && forgot.error.code !== 'VALIDATION_ERROR' ? forgot.error : null;

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email for your recruiter account and we'll send you a reset link."
      footer={
        <TextLink href="/login" testID="back-login">
          Back to sign in
        </TextLink>
      }
    >
      {forgot.isSuccess ? (
        <InlineAlert tone="success" title="Check your inbox" message={forgot.data.message} />
      ) : (
        <View className="gap-4">
          {formError ? <InlineAlert tone="error" message={formError.message} /> : null}
          <FormTextField
            control={control}
            name="email"
            label="Work email"
            placeholder="you@company.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={onSubmit}
            testID="forgot-email"
          />
          <Button title="Send reset link" onPress={onSubmit} loading={forgot.isPending} testID="forgot-submit" />
        </View>
      )}
    </AuthLayout>
  );
}
