import React from 'react';

interface StatCheck {
  check: string;
  attacker_name: string;
  attacker_stat: number;
  defender_name: string;
  defender_stat: number;
  result: string;
  vitality_damage: number;
  rule: string;
}

interface TechniqueResolution {
  attacker_technique: string;
  defender_technique: string;
  resolution: string;
  rule: string;
}

interface ResourceCosts {
  endurance_spent: number;
  reserve_spent: number;
  vitality_lost: number;
}

interface ArbiterMetadata {
  action_valid?: boolean;
  ruling_summary?: string;
  outcome?: string;
  resource_costs?: ResourceCosts;
  stat_checks?: StatCheck[];
  technique_resolutions?: TechniqueResolution[];
  rule_citation?: string;
  notes?: string;
}

interface CombatConsoleProps {
  metadata: ArbiterMetadata | null;
  onClose: () => void;
}

export const CombatConsole: React.FC<CombatConsoleProps> = ({ metadata, onClose }) => {
  if (!metadata) return null;

  const valid = metadata.action_valid !== false;
  const outcomeColor = 
    metadata.outcome === 'SUCCESS' ? '#22c55e' :
    metadata.outcome === 'BLOCKED' ? '#eab308' :
    metadata.outcome === 'ANNULATION_MUTUELLE' ? '#3b82f6' : '#ef4444';

  return (
    <div style={{
      background: '#090714',
      borderLeft: '2px solid #ef444450',
      width: '320px',
      display: 'flex',
      flexDirection: 'column',
      color: '#e2e0d6',
      fontFamily: 'monospace',
      borderLeftColor: '#3b2f63',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1e1b2e',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#120f26'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#ef4444' }}>⚖️</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#c084fc' }}>ARBITRE DES DUELS</span>
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

      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }} className="fallen-scroll">
        {/* Outcome Card */}
        <div style={{
          background: '#121024',
          border: '1px solid #2e2454',
          borderRadius: '6px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold' }}>STATUT ACTION</span>
            <span style={{
              fontSize: '9px',
              fontWeight: 'bold',
              background: valid ? '#052e16' : '#450a0a',
              color: valid ? '#4ade80' : '#f87171',
              padding: '2px 6px',
              borderRadius: '4px',
              border: `1px solid ${valid ? '#166534' : '#991b1b'}`
            }}>
              {valid ? 'VALIDE' : 'INVALIDE'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold' }}>RÉSULTAT</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: outcomeColor
            }}>
              {metadata.outcome || 'SUCCESS'}
            </span>
          </div>

          <div style={{
            fontSize: '10px',
            color: '#c8c6be',
            lineHeight: '1.4',
            background: '#090815',
            padding: '8px',
            borderRadius: '4px',
            borderLeft: `3px solid ${outcomeColor}`,
            marginTop: '4px'
          }}>
            {metadata.ruling_summary || "L'action a été arbitrée mécaniquement."}
          </div>
        </div>

        {/* Resource changes */}
        {metadata.resource_costs && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold', letterSpacing: '0.05em' }}>COÛTS & IMPACTS DE L'ÉCHANGE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div style={{ background: '#1c1212', border: '1px solid #ef444430', borderRadius: '4px', padding: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#f87171' }}>VITALITÉ</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef4444', marginTop: '2px' }}>
                  -{metadata.resource_costs.vitality_lost || 0}
                </div>
              </div>
              <div style={{ background: '#0e1c12', border: '1px solid #22c55e30', borderRadius: '4px', padding: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#4ade80' }}>ENDURANCE</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#22c55e', marginTop: '2px' }}>
                  -{metadata.resource_costs.endurance_spent || 0}
                </div>
              </div>
              <div style={{ background: '#0d1624', border: '1px solid #3b82f630', borderRadius: '4px', padding: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#60a5fa' }}>RÉSERVE</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#3b82f6', marginTop: '2px' }}>
                  -{metadata.resource_costs.reserve_spent || 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technique clashes */}
        {metadata.technique_resolutions && metadata.technique_resolutions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold', letterSpacing: '0.05em' }}>CONFRONTATIONS DE TECHNIQUES</div>
            {metadata.technique_resolutions.map((tech, idx) => (
              <div key={idx} style={{
                background: '#121024',
                border: '1px solid #2e2454',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '9px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fca5a5', fontWeight: 'bold', marginBottom: '4px' }}>
                  <span>{tech.attacker_technique}</span>
                  <span style={{ color: '#8b84a8' }}>vs</span>
                  <span style={{ color: '#93c5fd' }}>{tech.defender_technique}</span>
                </div>
                <div style={{ color: '#c084fc', margin: '4px 0', borderTop: '1px solid #2a2440', paddingTop: '4px' }}>
                  ⚡ {tech.resolution}
                </div>
                <div style={{ color: '#8b84a8', fontSize: '8px', fontStyle: 'italic' }}>
                  Règle: {tech.rule}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stat checks */}
        {metadata.stat_checks && metadata.stat_checks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold', letterSpacing: '0.05em' }}>TESTS DE CARACTÉRISTIQUES</div>
            {metadata.stat_checks.map((chk, idx) => (
              <div key={idx} style={{
                background: '#121024',
                border: '1px solid #2e2454',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '9px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c8c6be', fontWeight: 'bold' }}>
                  <span>{chk.attacker_name} ({chk.check.split(' vs ')[0]}: {chk.attacker_stat})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b84a8', margin: '2px 0' }}>
                  <span>vs</span>
                  <span>{chk.defender_name} ({chk.check.split(' vs ')[1] || 'Defense'}: {chk.defender_stat})</span>
                </div>
                <div style={{ color: chk.result === 'HIT' ? '#ef4444' : '#eab308', fontWeight: 'bold', marginTop: '4px', borderTop: '1px solid #2a2440', paddingTop: '4px' }}>
                  🎯 {chk.result} (Dégâts: -{chk.vitality_damage} PV)
                </div>
                {chk.rule && (
                  <div style={{ color: '#8b84a8', fontSize: '8px', marginTop: '2px', fontStyle: 'italic' }}>
                    Calcul: {chk.rule}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Referee Commentary */}
        {metadata.notes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '9px', color: '#8b84a8', fontWeight: 'bold', letterSpacing: '0.05em' }}>COMMENTAIRE DE L'ARBITRE</div>
            <div style={{
              background: '#0d0b1d',
              border: '1px solid #261f47',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '10px',
              color: '#a5a1b8',
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }}>
              {metadata.notes}
            </div>
          </div>
        )}
      </div>

      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid #1e1b2e',
        fontSize: '8px',
        color: '#8b84a8',
        textAlign: 'center',
        background: '#090815'
      }}>
        Code Règle: {metadata.rule_citation || 'Système de jeu Fallen v3.0'}
      </div>
    </div>
  );
};
