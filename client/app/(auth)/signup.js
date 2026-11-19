import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { Button, FormTextField, InlineAlert, Text } from '../../src/components/ui';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { TextLink } from '../../src/features/auth/TextLink';
import { describePasswordPolicy, signupSchema } from '../../src/features/auth/schemas';
import { useAuthPolicy, useSignup } from '../../src/features/auth/hooks';
import { applyFieldErrors } from '../../src/api/client';

export default function SignupScreen() {
  const signup = useSignup();
  const policy = useAuthPolicy();
  const passwordPolicy = policy.data?.password;
  const schema = useMemo(() => signupSchema(passwordPolicy), [passwordPolicy]);

  const { control, handleSubmit, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit((values) =>
    signup.mutateAsync(values).catch((err) => {
      if (err.code === 'EMAIL_IN_USE') {
        setError('email', { type: 'server', message: err.message });
        return;
      }
      applyFieldErrors(err, setError, ['name', 'email', 'password']);
    })
  );

  const formError =
    signup.error && !['VALIDATION_ERROR', 'EMAIL_IN_USE'].includes(signup.error.code) ? signup.error : null;

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Set up a recruiter account to publish jobs and review AI-screened candidates."
      footer={
        <View className="flex-row items-center gap-1">
          <Text variant="label" tone="muted" className="font-normal">
            Already have an account?
          </Text>
          <TextLink href="/login" testID="go-login">
            Sign in
          </TextLink>
        </View>
      }
    >
      {formError ? <InlineAlert tone="error" message={formError.message} /> : null}
      <FormTextField control={control} name="name" label="Full name" placeholder="Riley Morgan" autoComplete="name" textContentType="name" testID="signup-name" />
      <FormTextField
        control={control}
        name="email"
        label="Work email"
        placeholder="you@company.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        testID="signup-email"
      />
      <FormTextField
        control={control}
        name="password"
        label="Password"
        placeholder="Create a password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={describePasswordPolicy(passwordPolicy)}
        testID="signup-password"
      />
      <FormTextField
        control={control}
        name="confirmPassword"
        label="Confirm password"
        placeholder="Repeat your password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={onSubmit}
        testID="signup-confirm"
      />
      <Button title="Create account" onPress={onSubmit} loading={signup.isPending} testID="signup-submit" />
    </AuthLayout>
  );
}
