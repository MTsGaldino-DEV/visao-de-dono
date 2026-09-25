import { ETAPAS } from '../../lib/espacadores';

const EtapaBadge = ({ etapa }) => {
  const e = ETAPAS[etapa];
  if (!e) return null;
  return (
    <span style={{ background: e.bg, color: e.cor, border: `1px solid ${e.borda}`, fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
      {e.label}
    </span>
  );
};

export default EtapaBadge;
