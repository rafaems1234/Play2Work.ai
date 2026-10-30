import React from 'react';
import { motion } from 'framer-motion';
import { IconClose } from './icons';

// Painel lateral/modal genérico
const Gaveta = ({ titulo, aoFechar, larga = false, children }) => (
  <motion.div className="adm-fundo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={aoFechar}>
    <motion.div
      className={`adm-gaveta ${larga ? 'larga' : ''}`}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.22 }}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={titulo}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--adm-forte)' }}>{titulo}</h2>
        <button className="adm-icone-btn" onClick={aoFechar} aria-label="Fechar"><IconClose /></button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

export default Gaveta;
