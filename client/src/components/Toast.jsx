import { useEffect } from 'react';

export default function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  return message ? <div className="toast" role="status">{message}</div> : null;
}
