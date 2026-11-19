import { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme, View } from 'react-native';
import { vars } from 'nativewind';
import { COLOR_TOKENS, toCssVariables } from './tokens';
import { useThemeStore } from '../stores/themeStore';

const ThemeContext = createContext({ scheme: 'light', colors: COLOR_TOKENS.light });

const CSS_VARS = { light: vars(toCssVariables('light')), dark: vars(toCssVariables('dark')) };

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const hydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const scheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(() => ({ scheme, colors: COLOR_TOKENS[scheme] }), [scheme]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, CSS_VARS[scheme]]} className="bg-background">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/** Raw theme values for places classes cannot reach (icons, navigators). */
export function useTheme() {
  return useContext(ThemeContext);
}
