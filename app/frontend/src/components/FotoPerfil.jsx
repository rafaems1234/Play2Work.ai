import React, { useEffect, useRef, useState } from 'react';
import { IconCamera } from './icons';
import { apiFetch } from '../api';

// Foto do perfil do aluno. O navegador recorta no quadrado e reduz pra 400px
// em JPEG antes de enviar (~50 KB em vez dos 3-5 MB da câmera do celular) --
// e, por redesenhar a imagem num canvas, também descarta os metadados EXIF
// (como a localização GPS de onde a foto foi tirada).

const LADO_FOTO = 400;
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

export const prepararFoto = (arquivo) => new Promise((resolve, reject) => {
  if (!arquivo || !TIPOS_ACEITOS.includes(arquivo.type)) {
    reject(new Error('Escolha uma foto JPG, PNG ou WebP.'));
    return;
  }
  if (arquivo.size > 15 * 1024 * 1024) {
    reject(new Error('Essa foto é grande demais (máximo 15 MB).'));
    return;
  }
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  img.onload = () => {
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = LADO_FOTO;
    canvas.height = LADO_FOTO;
    canvas.getContext('2d').drawImage(
      img,
      (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado,
      0, 0, LADO_FOTO, LADO_FOTO,
    );
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL('image/jpeg', 0.85));
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('Não deu pra abrir essa imagem.'));
  };
  img.src = url;
});

// A foto é servida só com o token (é dado pessoal de aluno), então não dá pra
// usar <img src> direto: baixa com apiFetch e guarda um object URL por
// (caminho, versão) -- trocar a foto muda a versão e invalida o cache.
const cacheFotos = new Map();

const baixarFoto = (caminho, versao) => {
  const chave = `${caminho}?v=${versao}`;
  if (!cacheFotos.has(chave)) {
    cacheFotos.set(chave, apiFetch(caminho)
      .then(async (resposta) => (resposta.ok ? URL.createObjectURL(await resposta.blob()) : null))
      .catch(() => null));
  }
  return cacheFotos.get(chave);
};

const iniciais = (nome) => (nome || '?').trim().split(/\s+/).filter(Boolean)
  .filter((_, i, partes) => i === 0 || i === partes.length - 1)
  .map((p) => p[0].toUpperCase()).join('');

// Avatar redondo: foto se houver (carregada só quando aparece na tela), senão iniciais.
// 'versao' = foto_atualizada_em (null = sem foto).
export const Avatar = ({ caminho, versao, nome, tamanho = 36, className = '' }) => {
  const [url, setUrl] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    setUrl(null);
    if (!versao || !caminho || !ref.current) return undefined;
    let ativo = true;
    const observador = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      baixarFoto(caminho, versao).then((obtida) => { if (ativo) setUrl(obtida); });
    }, { rootMargin: '200px' });
    observador.observe(ref.current);
    return () => { ativo = false; observador.disconnect(); };
  }, [caminho, versao]);

  return (
    <span
      ref={ref}
      className={`avatar-aluno ${className}`}
      style={{
        width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38),
        flex: '0 0 auto', borderRadius: '50%', overflow: 'hidden',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong))',
        color: '#fff', fontWeight: 800, letterSpacing: '0.5px',
      }}
      aria-label={versao ? `Foto de ${nome}` : `${nome} (sem foto)`}
      role="img"
    >
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciais(nome)}
    </span>
  );
};

// Botão "Enviar foto" com o <input type=file> escondido. No celular, abre a
// câmera ou a galeria. aoEscolher recebe o data URL já reduzido.
export const SeletorFoto = ({ aoEscolher, aoErro, rotulo = 'Enviar foto', className, style, disabled }) => {
  const entrada = useRef(null);
  const escolher = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      await aoEscolher(await prepararFoto(arquivo));
    } catch (err) {
      aoErro?.(err.message);
    }
  };
  return (
    <>
      <input ref={entrada} type="file" accept={TIPOS_ACEITOS.join(',')} onChange={escolher} hidden />
      <button type="button" className={className} style={style} disabled={disabled} onClick={() => entrada.current?.click()}>
        <IconCamera style={{ verticalAlign: '-2px' }} /> {rotulo}
      </button>
    </>
  );
};
