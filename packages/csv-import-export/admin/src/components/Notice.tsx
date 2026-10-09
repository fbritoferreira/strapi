import { Alert, type AlertProps } from '@strapi/design-system';
import { useState } from 'react';

/** Design-system Alert whose close button actually hides it. Give it a `key` to show it again when its content changes. */
export const Notice = (props: Omit<AlertProps, 'closeLabel' | 'onClose'>) => {
  const [open, setOpen] = useState(true);
  return open ? <Alert closeLabel="Close" onClose={() => setOpen(false)} {...props} /> : null;
};
