import React from 'react';

// Telas de avaliação (quiz diário e simulado de certificação): reforça a
// proteção contra cópia que o app já tem (index.css + main.jsx) com
// bloqueio direto no componente -- seleção, copiar, recortar, botão
// direito e arrastar. Não impede foto do celular nem digitar a pergunta em
// outro lugar: é uma barreira, não uma garantia. Por isso o simulado também
// registra as saídas da tela e nunca mostra o gabarito.
const bloquear = (e) => e.preventDefault();

const AreaProva = ({ children, className = '', ...resto }) => (
  <div
    className={`area-prova ${className}`}
    onCopy={bloquear}
    onCut={bloquear}
    onContextMenu={bloquear}
    onDragStart={bloquear}
    {...resto}
  >
    {children}
  </div>
);

export default AreaProva;
