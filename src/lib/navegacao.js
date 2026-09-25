// Abas principais por perfil de usuário

export const abasDoPerfil = (role) => {
  if (role === 'fechamento') return [{ key: 'fechamento', label: 'Fechamento' }];
  const isDono = role === 'dono';
  return [
    ...(isDono ? [{ key: 'cadastrar', label: 'Cadastrar' }] : []),
    { key: 'despacho', label: 'Despacho' },
    { key: 'mapa', label: 'Mapa' },
    ...(isDono ? [
      { key: 'painel', label: 'Painel' },
      { key: 'faturamento', label: 'Faturamento' },
      { key: 'fechamento', label: 'Fechamento' },
      { key: 'admin', label: 'Admin' },
    ] : []),
  ];
};

// Mantém a aba salva se o perfil pode vê-la; senão, a primeira aba do perfil
export const abaInicial = (role, salva) => {
  const abas = abasDoPerfil(role);
  return abas.some(a => a.key === salva) ? salva : abas[0].key;
};
