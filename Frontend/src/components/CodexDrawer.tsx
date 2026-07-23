import React, { useState } from 'react';

interface CodexDrawerProps {
  onClose: () => void;
  activePnj: any;
  characterState: any;
  divinites: { name: string; domain: string }[];
  factions: string[];
  grandesPuissances: { rank: number; name: string; faction: string; title: string }[];
}

export const CodexDrawer: React.FC<CodexDrawerProps> = ({
  onClose,
  activePnj,
  characterState,
  divinites,
  factions,
  grandesPuissances,
}) => {
  const [activeTab, setActiveTab] = useState<'PNJ' | 'FICHE' | 'CODEX'>('PNJ');
  const [codexSubTab, setCodexSubTab] = useState<'DEITIES' | 'FACTIONS' | 'LEGENDS'>('DEITIES');

  const char = characterState?.character;

  return (
    <div style={{
      background: '#090714',
      borderLeft: '2px solid #3b2f63',
      width: '320px',
      display: 'flex',
      flexDirection: 'column',
      color: '#e2e0d6',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1e1b2e',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#120f26'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#a78bfa' }}>📖</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#c084fc' }}>GRIMOIRE DE LA CONNAISSANCE</span>
        </div>
        <button 
          onClick={onClose} 
          style={{
            background: 'none',
            border: 'none',
            color: '#8b84a8',
            fontSize: '16px',
            cursor: 'pointer',
            padding: 0
          }}
        >
          ×
        </button>
      </div>

      {/* Tabs Row */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #1e1b2e',
        background: '#0d0a1b'
      }}>
        <button
          onClick={() => setActiveTab('PNJ')}
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            background: activeTab === 'PNJ' ? '#120f26' : 'transparent',
            color: activeTab === 'PNJ' ? '#c084fc' : '#8b84a8',
            fontSize: '9px',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            borderBottom: activeTab === 'PNJ' ? '2px solid #c084fc' : 'none'
          }}
        >
          🎯 CIBLE / PNJ
        </button>
        <button
          onClick={() => setActiveTab('FICHE')}
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            background: activeTab === 'FICHE' ? '#120f26' : 'transparent',
            color: activeTab === 'FICHE' ? '#c084fc' : '#8b84a8',
            fontSize: '9px',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            borderBottom: activeTab === 'FICHE' ? '2px solid #c084fc' : 'none'
          }}
        >
          👤 FICHE PERSO
        </button>
        <button
          onClick={() => setActiveTab('CODEX')}
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            background: activeTab === 'CODEX' ? '#120f26' : 'transparent',
            color: activeTab === 'CODEX' ? '#c084fc' : '#8b84a8',
            fontSize: '9px',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            borderBottom: activeTab === 'CODEX' ? '2px solid #c084fc' : 'none'
          }}
        >
          📚 CODEX MONDAL
        </button>
      </div>

      {/* Drawer Content Panel */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }} className="fallen-scroll">
        
        {/* TAB 1: PNJ TARGET */}
        {activeTab === 'PNJ' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {activePnj ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* PNJ Card with Image */}
                <div style={{
                  background: '#121024',
                  border: '1px solid #2e2454',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {/* Portrait Box */}
                  <div style={{
                    width: '100%',
                    height: '180px',
                    background: '#1b1735',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {activePnj.image_url ? (
                      <img 
                        src={activePnj.image_url} 
                        alt={activePnj.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          // Fallback to stylized name box if file doesn't exist
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(9,7,20,1) 0%, rgba(9,7,20,0) 100%)',
                      padding: '20px 12px 10px 12px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
                        {activePnj.name}
                      </span>
                      <span style={{ fontSize: '9px', color: '#c084fc', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {activePnj.npc_type || 'NPC'} • {activePnj.faction || 'Sans Faction'}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: activePnj.is_alive !== false ? '#064e3b' : '#7f1d1d',
                    color: activePnj.is_alive !== false ? '#34d399' : '#f87171',
                    fontSize: '8px',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    border: `1px solid ${activePnj.is_alive !== false ? '#059669' : '#b91c1c'}`
                  }}>
                    {activePnj.is_alive !== false ? 'VIVANT' : 'TERRASSÉ'}
                  </div>

                  {/* Description / Properties */}
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activePnj.properties?.description && (
                      <p style={{ fontSize: '11px', color: '#a5a1b8', margin: 0, lineHeight: '1.4' }}>
                        {activePnj.properties.description}
                      </p>
                    )}
                    {activePnj.properties?.title && (
                      <div style={{ fontSize: '10px', color: '#f59e0b' }}>
                        🛡️ <strong>Titre:</strong> {activePnj.properties.title}
                      </div>
                    )}
                  </div>
                </div>

                {/* NPC Stats Panel */}
                {activePnj.stats && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold', letterSpacing: '0.05em' }}>CARACTÉRISTIQUES DE COMBAT</div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      background: '#121024',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #2e2454'
                    }}>
                      {Object.entries(activePnj.stats).map(([stat, val]: any) => (
                        <div key={stat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', borderBottom: '1px solid #1a1730', paddingBottom: '3px' }}>
                          <span style={{ color: '#8b84a8' }}>{stat}</span>
                          <span style={{ fontWeight: 'bold', color: '#fff' }}>{val} / 60</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                padding: '40px 10px',
                textAlign: 'center',
                color: '#8b84a8',
                fontSize: '11px',
                lineHeight: '1.5'
              }}>
                🔭 Aucun PNJ ou Dieu important ciblé dans l'action en cours.<br/><br/>
                Les personnages légendaires ou divinités que vous rencontrez apparaîtront ici automatiquement avec leur portrait et leurs attributs de combat.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHARACTER SHEET */}
        {activeTab === 'FICHE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {char ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Character Profile Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#121024',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #2e2454'
                }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '6px',
                    background: '#1b1735',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '20px' }}>⚔️</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{char.name}</span>
                    <span style={{ fontSize: '9px', color: '#a78bfa', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {char.faction} • {char.rank || 'Rang 1'}
                    </span>
                  </div>
                </div>

                {/* Resource Bars */}
                {char.resource_pools && (
                  <div style={{
                    background: '#121024',
                    border: '1px solid #2e2454',
                    borderRadius: '6px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {/* Vitality */}
                    {char.resource_pools.vitality && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', color: '#ef4444', marginBottom: '2px' }}>
                          <span>VITALITÉ (PV)</span>
                          <span>{char.resource_pools.vitality.current} / {char.resource_pools.vitality.max}</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: '#1c1212', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${(char.resource_pools.vitality.current / char.resource_pools.vitality.max) * 100}%`, height: '100%', background: '#ef4444', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )}
                    {/* Endurance */}
                    {char.resource_pools.endurance && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', color: '#22c55e', marginBottom: '2px' }}>
                          <span>ENDURANCE</span>
                          <span>{char.resource_pools.endurance.current} / {char.resource_pools.endurance.max}</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: '#0e1c12', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${(char.resource_pools.endurance.current / char.resource_pools.endurance.max) * 100}%`, height: '100%', background: '#22c55e', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )}
                    {/* Reserve */}
                    {char.resource_pools.reserve && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '2px' }}>
                          <span>RÉSERVE MAGIQUE</span>
                          <span>{char.resource_pools.reserve.current} / {char.resource_pools.reserve.max}</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: '#0d1624', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${(char.resource_pools.reserve.current / char.resource_pools.reserve.max) * 100}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats */}
                {char.stats && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold', letterSpacing: '0.05em' }}>CARACTÉRISTIQUES (FICHE)</div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      background: '#121024',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #2e2454'
                    }}>
                      {Object.entries(char.stats).map(([stat, val]: any) => (
                        <div key={stat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', borderBottom: '1px solid #1a1730', paddingBottom: '3px' }}>
                          <span style={{ color: '#8b84a8' }}>{stat}</span>
                          <span style={{ fontWeight: 'bold', color: val.category === 'strong' ? '#34d399' : '#fff' }}>
                            {val.value} / 60
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Techniques */}
                {char.techniques && char.techniques.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold', letterSpacing: '0.05em' }}>TECHNIQUES ET SORTS UNLOCKED</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {char.techniques.map((tech: any, idx: number) => (
                        <div key={idx} style={{
                          background: '#121024',
                          border: '1px solid #2e2454',
                          borderRadius: '6px',
                          padding: '8px',
                          fontSize: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#c084fc', marginBottom: '2px' }}>
                            <span>{tech.name}</span>
                            <span style={{
                              fontSize: '8px',
                              background: '#312e81',
                              color: '#a5b4fc',
                              padding: '1px 4px',
                              borderRadius: '2px'
                            }}>
                              RANG {tech.rank}
                            </span>
                          </div>
                          <div style={{ fontSize: '9px', color: '#a5a1b8', lineHeight: '1.3' }}>
                            {tech.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '40px 10px', textAlign: 'center', color: '#8b84a8', fontSize: '11px' }}>
                Fiche de personnage non disponible.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WORLD CODEX */}
        {activeTab === 'CODEX' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Sub Tabs */}
            <div style={{
              display: 'flex',
              background: '#090815',
              padding: '2px',
              borderRadius: '4px',
              border: '1px solid #2a2440'
            }}>
              <button
                onClick={() => setCodexSubTab('DEITIES')}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  border: 'none',
                  background: codexSubTab === 'DEITIES' ? '#120f26' : 'transparent',
                  color: codexSubTab === 'DEITIES' ? '#c084fc' : '#8b84a8',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '2px'
                }}
              >
                DIVINITÉS
              </button>
              <button
                onClick={() => setCodexSubTab('FACTIONS')}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  border: 'none',
                  background: codexSubTab === 'FACTIONS' ? '#120f26' : 'transparent',
                  color: codexSubTab === 'FACTIONS' ? '#c084fc' : '#8b84a8',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '2px'
                }}
              >
                FACTIONS
              </button>
              <button
                onClick={() => setCodexSubTab('LEGENDS')}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  border: 'none',
                  background: codexSubTab === 'LEGENDS' ? '#120f26' : 'transparent',
                  color: codexSubTab === 'LEGENDS' ? '#c084fc' : '#8b84a8',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '2px'
                }}
              >
                LÉGENDES
              </button>
            </div>

            {/* Sub Tab Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {codexSubTab === 'DEITIES' && divinites.map((div) => (
                <div key={div.name} style={{
                  background: '#121024',
                  border: '1px solid #2e2454',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '10px'
                }}>
                  <strong style={{ color: '#fff' }}>⚡ {div.name}</strong>
                  <div style={{ color: '#8b84a8', fontSize: '9px', marginTop: '2px' }}>{div.domain}</div>
                </div>
              ))}

              {codexSubTab === 'FACTIONS' && factions.map((fac) => (
                <div key={fac} style={{
                  background: '#121024',
                  border: '1px solid #2e2454',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  color: '#e2e0d6'
                }}>
                  ⚔️ {fac}
                </div>
              ))}

              {codexSubTab === 'LEGENDS' && grandesPuissances.map((gp) => (
                <div key={gp.name} style={{
                  background: '#121024',
                  border: '1px solid #2e2454',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#fff' }}>👑 {gp.name}</strong>
                    <span style={{ color: '#c084fc', fontWeight: 'bold' }}># {gp.rank}</span>
                  </div>
                  <div style={{ color: '#8b84a8', fontSize: '9px', marginTop: '2px' }}>
                    {gp.title} ({gp.faction})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
