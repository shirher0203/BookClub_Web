import { useEffect, useState } from 'react';

export function useImageFallback(src: string | undefined | null): {
  show: boolean;
  onError: () => void;
} {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  return {
    show: Boolean(src) && !broken,
    onError: () => setBroken(true),
  };
}
