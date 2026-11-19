import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { Button, FormTextField, InlineAlert, Text } from '../../src/components/ui';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { TextLink } from '../../src/features/auth/TextLink';
import { loginSchema } from '../../src/features/auth/schemas';
import { useLogin } from '../../src/features/auth/hooks';
import { applyFieldErrors } from '../../src/api/client';

export default function LoginScreen() {
  const login = useLogin();
  const { control, handleSubmit, setError } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) =>
    login.mutateAsync(values).catch((err) => {
      applyFieldErrors(err, setError, ['email', 'password']);
    })
  );

  const formError = login.error && login.error.code !== 'VALIDATION_ERROR' ? login.error : null;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage jobs, candidates and AI workflows."
      footer={
        <View className="flex-row items-center gap-1">
          <Text variant="label" tone="muted" className="font-normal">
            New to AgentHire?
          </Text>
          <TextLink href="/signup" testID="go-signup">
            Create an account
          </TextLink>
        </View>
      }
    >
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
        returnKeyType="next"
        testID="login-email"
      />
      <FormTextField
        control={control}
        name="password"
        label="Password"
        placeholder="Your password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        testID="login-password"
      />
      <View className="items-end">
        <TextLink href="/forgot-password" testID="go-forgot">
          Forgot password?
        </TextLink>
      </View>
      <Button title="Sign in" onPress={onSubmit} loading={login.isPending} testID="login-submit" />
    </AuthLayout>
  );
}
