import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiItem } from '../lib/searchData';

interface UseSearchKeyboardProps {
  isOpen: boolean;
  filteredApis: ApiItem[];
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
}

export function useSearchKeyboard({
  isOpen,
  filteredApis,
  selectedIndex,
  setSelectedIndex,
  onClose,
}: UseSearchKeyboardProps) {
  const navigate = useNavigate();

  const handleApiSelect = useCallback(
    (api: ApiItem) => {
      navigate(api.path);
      onClose();
    },
    [navigate, onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredApis.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && filteredApis.length > 0) {
        e.preventDefault();
        const selectedApi = filteredApis[selectedIndex];
        if (selectedApi) {
          handleApiSelect(selectedApi);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredApis, selectedIndex, setSelectedIndex, onClose, handleApiSelect]);

  return { handleApiSelect };
}
