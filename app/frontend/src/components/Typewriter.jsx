import { useEffect, useState } from 'react';

const Typewriter = ({ text = '', speed = 16, onDone }) => {
  const [shown, setShown] = useState('');

  useEffect(() => {
    setShown('');
    if (!text) return undefined;

    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        onDone?.();
      }
    }, speed);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return <>{shown}</>;
};

export default Typewriter;
