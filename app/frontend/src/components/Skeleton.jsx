import React from 'react';

export const SkeletonStyles = () => (
  <style>{`
    .p2w-skeleton {
      position: relative;
      overflow: hidden;
      background: rgba(255,255,255,0.045);
      border-radius: 8px;
    }
    .p2w-skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(167,139,250,0.16), transparent);
      animation: p2wShimmer 1.6s ease-in-out infinite;
    }
    @keyframes p2wShimmer {
      100% { transform: translateX(100%); }
    }
  `}</style>
);

export const Skeleton = ({ style, className = '' }) => (
  <div className={`p2w-skeleton ${className}`} style={style} />
);

export const JobCardSkeleton = () => (
  <div style={{
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(167,139,250,0.1)',
    borderRadius: '20px',
    padding: '24px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
      <div style={{ flex: 1 }}>
        <Skeleton style={{ height: '16px', width: '75%', marginBottom: '10px' }} />
        <Skeleton style={{ height: '12px', width: '45%', marginBottom: '8px' }} />
        <Skeleton style={{ height: '10px', width: '60%' }} />
      </div>
      <Skeleton style={{ height: '44px', width: '56px', borderRadius: '10px', flexShrink: 0 }} />
    </div>
    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
      <Skeleton style={{ height: '12px', width: '90px' }} />
      <Skeleton style={{ height: '12px', width: '70px' }} />
    </div>
    <Skeleton style={{ height: '42px', width: '100%', borderRadius: '12px' }} />
  </div>
);

export const RowSkeleton = () => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(167,139,250,0.06)', borderRadius: '14px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <Skeleton style={{ height: '18px', width: '28px' }} />
      <Skeleton style={{ height: '14px', width: '120px' }} />
      <Skeleton style={{ height: '18px', width: '60px', borderRadius: '6px' }} />
    </div>
    <Skeleton style={{ height: '14px', width: '70px' }} />
  </div>
);
