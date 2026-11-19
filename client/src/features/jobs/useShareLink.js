import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/**
 * Copy or share a public link. Web browsers without the Web Share API fall
 * back to copying. `status` is 'idle' | 'copied' | 'shared' | 'error'.
 */
export function useShareLink() {
  const [status, setStatus] = useState('idle');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback((next) => {
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2000);
  }, []);

  const copy = useCallback(
    async (url) => {
      try {
        await Clipboard.setStringAsync(url);
        flash('copied');
      } catch {
        flash('error');
      }
    },
    [flash]
  );

  const share = useCallback(
    async ({ url, title }) => {
      const canWebShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
      if (!canWebShare) return copy(url);
      try {
        const result = await Share.share(Platform.OS === 'ios' ? { url, message: title } : { message: `${title}\n${url}`, title, url });
        if (result.action === Share.sharedAction) flash('shared');
      } catch {
        await copy(url);
      }
      return undefined;
    },
    [copy, flash]
  );

  return { status, copy, share };
}
