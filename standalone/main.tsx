import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../app/globals.css';
import { ImageComparator } from '../components/image-comparator/ImageComparator';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Picture MultiCompare konnte nicht gestartet werden.');
}

createRoot(root).render(
  <StrictMode>
    <ImageComparator />
  </StrictMode>,
);
