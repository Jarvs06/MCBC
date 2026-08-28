import { useCallback, useState } from 'react';

/*
 * ==========================================
 * useAppModal
 * ==========================================
 *
 * Every screen so far (Login, Add Admin, Members)
 * repeats the same four pieces of state and a
 * showModal() helper for AppModal. This hook
 * replaces that duplicated block with one call.
 *
 * Usage:
 *
 *   const modal = useAppModal();
 *   modal.show('Title', 'Message');
 *
 *   <AppModal
 *     visible={modal.visible}
 *     title={modal.title}
 *     message={modal.message}
 *     buttonText="OK"
 *     onClose={modal.hide}
 *   />
 */

export function useAppModal() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const show = useCallback((nextTitle: string, nextMessage: string) => {
    setTitle(nextTitle);
    setMessage(nextMessage);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, title, message, show, hide };
}