import React, { useState } from 'react';

// ─── Types mirroring the SCENARIO_ARCHITECT metadata schema ──────────────────

interface QuestObjective {
  faction: string;
  goal: string;
  success_condition?: string;
  failure_condition?: string;
}

interface QuestRewards {
  xp?: number;
  pe?: number;
  fortune?: number;
  items?: { name: string; effect?: string }[];
  faction_impact?: Record<string, string>;
}

interface QuestMeta {
  content_type: 'QUÊTE' | 'ÉVÉNEMENT' | 'MURMURE' | 'DONJON';
  // QUÊTE
  quest_id?: string;
  title?: string;
  danger_level?: string;
  zone?: string;
  participants?: { count?: number; roles?: string[] };
  objectives?: QuestObjective[];
  gm_notes?: string;
  rewards?: QuestRewards;
  special_rules?: string[];
  // ÉVÉNEMENT
  event_id?: string;
  scope?: string;
  phases?: { phase: number; name: string; description: string; player_notes?: string }[];
  possible_outcomes?: { outcome: string; condition: string; world_impact: string }[];
  participating_guilds?: string[];
  participation_rules?: string[];
  // MURMURE
  edition?: string;
  faits_divers?: { region: string; headline: string; body: string }[];
  enquetes?: { headline: string; body: string; quest_hook?: boolean }[];
  // DONJON
  donjon_id?: string;
  recommended_participants?: number;
  floors?: {
    floor: number; name: string; description: string;
    environmental_hazard?: string;
    rooms?: { id: string; name: string; threats?: string; loot?: string; trap?: string | null; stat_check?: string | null }[];
  }[];
  boss?: {
    name: string; faction?: string; rank?: string;
    stats?: Record<string, number>;
    vitality?: number;
    techniques?: { name: string; rank?: string; description?: string }[];
    weakness?: string;
    loot_table?: string[];
  };
  completion_rewards?: QuestRewards;
}

interface QuestCardProps {
  prose: string;
  meta: QuestMeta;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const Section: React.FC<{ title: string; icon: string; children: React.ReactNode; accent?: string }> = ({
  title, icon, children, accent = '#c9a84c'
}) => (
  <div style={{ marginBottom: '18px' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      borderBottom: `1px solid ${accent}40`, paddingBottom: '4px', marginBottom: '10px'
    }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '10px', fontWeight: 'bold', color: accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {title}
      </span>
    </div>
    {children}
  </div>
);

const Prose: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <p style={{ fontSize: '13px', lineHeight: '1.75', color: '#d4d0c8', whiteSpace: 'pre-wrap', margin: 0 }}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} style={{ color: '#e8e4d6' }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('*') && p.endsWith('*')) return <em key={i} style={{ color: '#c9a84c' }}>{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
};

// ─── QUÊTE Card ───────────────────────────────────────────────────────────────

const QueteCard: React.FC<{ prose: string; meta: QuestMeta }> = ({ prose, meta }) => {
  const [gmOpen, setGmOpen] = useState(false);

  return (
    <>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(90deg, #1a1030 0%, #0f0d1f 100%)',
        borderBottom: '1px solid #c9a84c30', padding: '10px 16px',
        borderRadius: '8px 8px 0 0', marginBottom: '14px'
      }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#8b84a8', letterSpacing: '0.12em', marginBottom: '2px' }}>
            ⚔️ QUÊTE GÉNÉRÉE — {meta.zone?.toUpperCase()}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#e8e4d6' }}>{meta.title}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '16px', letterSpacing: '1px' }}>{meta.danger_level}</div>
          <div style={{ fontSize: '9px', color: '#8b84a8', marginTop: '2px' }}>
            {meta.participants?.count ?? '?'} joueurs • {meta.participants?.roles?.join(' / ')}
          </div>
        </div>
      </div>

      {/* Narrative Prose */}
      <Section title="Contexte Narratif" icon="📜">
        <Prose text={prose} />
      </Section>

      {/* Objectives */}
      {meta.objectives && meta.objectives.length > 0 && (
        <Section title="Objectifs" icon="🎯" accent="#7dd3a8">
          {meta.objectives.map((obj, i) => (
            <div key={i} style={{
              background: '#0d0b1e', border: '1px solid #2a2440',
              borderLeft: '3px solid #7dd3a8', borderRadius: '4px',
              padding: '10px 12px', marginBottom: '8px'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#7dd3a8', marginBottom: '4px' }}>
                [{obj.faction}]
              </div>
              <div style={{ fontSize: '12px', color: '#d4d0c8', marginBottom: '6px' }}>{obj.goal}</div>
              {obj.success_condition && (
                <div style={{ fontSize: '11px', color: '#86efac', marginBottom: '2px' }}>
                  ✅ Succès : {obj.success_condition}
                </div>
              )}
              {obj.failure_condition && (
                <div style={{ fontSize: '11px', color: '#fca5a5' }}>
                  ❌ Échec : {obj.failure_condition}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Special Rules */}
      {meta.special_rules && meta.special_rules.length > 0 && (
        <Section title="Règles Spéciales" icon="⚠️" accent="#f59e0b">
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {meta.special_rules.map((rule, i) => (
              <li key={i} style={{ fontSize: '12px', color: '#d4d0c8', marginBottom: '4px' }}>{rule}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* GM Notes (collapsible, gold border) */}
      {meta.gm_notes && (
        <Section title="Notes Maître de Jeu" icon="🔐" accent="#c9a84c">
          <div
            onClick={() => setGmOpen(o => !o)}
            style={{
              background: '#12102a', border: '1px solid #c9a84c40',
              borderLeft: '3px solid #c9a84c', borderRadius: '4px',
              padding: '8px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            <span style={{ fontSize: '11px', color: '#c9a84c', fontStyle: 'italic' }}>
              {gmOpen ? 'Masquer les instructions MJ' : '🔓 Révéler les instructions MJ (privé)'}
            </span>
            <span style={{ color: '#c9a84c', fontSize: '14px' }}>{gmOpen ? '▲' : '▼'}</span>
          </div>
          {gmOpen && (
            <div style={{
              background: '#0d0b1e', border: '1px solid #c9a84c30',
              borderTop: 'none', borderRadius: '0 0 4px 4px',
              padding: '12px', marginTop: '0'
            }}>
              <Prose text={meta.gm_notes} />
            </div>
          )}
        </Section>
      )}

      {/* Rewards */}
      {meta.rewards && (
        <Section title="Récompenses" icon="💰" accent="#a78bfa">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {meta.rewards.xp && (
              <span style={rewardChip('#a78bfa')}>{meta.rewards.xp.toLocaleString()} XP</span>
            )}
            {meta.rewards.pe && (
              <span style={rewardChip('#60a5fa')}>{meta.rewards.pe} PE</span>
            )}
            {meta.rewards.fortune && (
              <span style={rewardChip('#c9a84c')}>{meta.rewards.fortune.toLocaleString()} ₲</span>
            )}
          </div>
          {meta.rewards.items && meta.rewards.items.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              {meta.rewards.items.map((item, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#d4d0c8', marginBottom: '2px' }}>
                  <span style={{ color: '#fbbf24' }}>🏺 {item.name}</span>
                  {item.effect && <span style={{ color: '#9ca3af' }}> — {item.effect}</span>}
                </div>
              ))}
            </div>
          )}
          {meta.rewards.faction_impact && Object.keys(meta.rewards.faction_impact).length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.entries(meta.rewards.faction_impact).map(([faction, delta]) => (
                <span key={faction} style={{
                  fontSize: '10px', fontWeight: 'bold',
                  color: delta.startsWith('+') ? '#86efac' : '#fca5a5',
                  background: delta.startsWith('+') ? '#14532d30' : '#7f1d1d30',
                  border: `1px solid ${delta.startsWith('+') ? '#16a34a40' : '#dc262640'}`,
                  borderRadius: '3px', padding: '1px 6px'
                }}>
                  {faction} {delta}
                </span>
              ))}
            </div>
          )}
        </Section>
      )}
    </>
  );
};

const rewardChip = (color: string): React.CSSProperties => ({
  fontSize: '11px', fontWeight: 'bold', color,
  background: `${color}15`, border: `1px solid ${color}40`,
  borderRadius: '4px', padding: '2px 10px'
});

// ─── ÉVÉNEMENT Card ───────────────────────────────────────────────────────────

const EvenementCard: React.FC<{ prose: string; meta: QuestMeta }> = ({ prose, meta }) => {
  const [gmOpen, setGmOpen] = useState(false);
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(90deg, #1a1030 0%, #0f0d1f 100%)',
        borderBottom: '1px solid #f472b640', padding: '10px 16px',
        borderRadius: '8px 8px 0 0', marginBottom: '14px'
      }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#f472b6', letterSpacing: '0.12em', marginBottom: '2px' }}>
            🌍 ÉVÉNEMENT — {meta.scope}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#e8e4d6' }}>{meta.title}</div>
        </div>
        {meta.participating_guilds && (
          <div style={{ fontSize: '10px', color: '#8b84a8', textAlign: 'right' }}>
            {meta.participating_guilds.join(' · ')}
          </div>
        )}
      </div>
      <Section title="Annonce" icon="📣"><Prose text={prose} /></Section>
      {meta.phases && (
        <Section title="Phases" icon="📅" accent="#f472b6">
          {meta.phases.map(ph => (
            <div key={ph.phase} style={{
              background: '#0d0b1e', border: '1px solid #2a2440',
              borderLeft: '3px solid #f472b6', borderRadius: '4px',
              padding: '10px 12px', marginBottom: '8px'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#f472b6', marginBottom: '4px' }}>
                Phase {ph.phase} — {ph.name}
              </div>
              <div style={{ fontSize: '12px', color: '#d4d0c8' }}>{ph.description}</div>
              {ph.player_notes && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', fontStyle: 'italic' }}>ℹ️ {ph.player_notes}</div>}
            </div>
          ))}
        </Section>
      )}
      {meta.possible_outcomes && (
        <Section title="Issues Possibles" icon="⚖️" accent="#c9a84c">
          {meta.possible_outcomes.map((o, i) => (
            <div key={i} style={{
              fontSize: '12px', color: '#d4d0c8',
              borderLeft: `3px solid ${o.outcome.includes('Succ') ? '#86efac' : '#fca5a5'}`,
              paddingLeft: '8px', marginBottom: '6px'
            }}>
              <strong style={{ color: o.outcome.includes('Succ') ? '#86efac' : '#fca5a5' }}>{o.outcome}</strong> — {o.condition}
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Impact : {o.world_impact}</div>
            </div>
          ))}
        </Section>
      )}
      {meta.gm_notes && (
        <Section title="Notes MJ" icon="🔐" accent="#c9a84c">
          <div onClick={() => setGmOpen(o => !o)} style={{ background: '#12102a', border: '1px solid #c9a84c40', borderLeft: '3px solid #c9a84c', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#c9a84c', fontStyle: 'italic' }}>{gmOpen ? 'Masquer' : '🔓 Révéler les instructions MJ'}</span>
            <span style={{ color: '#c9a84c' }}>{gmOpen ? '▲' : '▼'}</span>
          </div>
          {gmOpen && <div style={{ background: '#0d0b1e', border: '1px solid #c9a84c30', borderRadius: '0 0 4px 4px', padding: '12px' }}><Prose text={meta.gm_notes} /></div>}
        </Section>
      )}
    </>
  );
};

// ─── MURMURE Card ─────────────────────────────────────────────────────────────

const MurmureCard: React.FC<{ prose: string; meta: QuestMeta }> = ({ prose, meta }) => (
  <>
    <div style={{ textAlign: 'center', padding: '10px 16px 14px', borderBottom: '1px solid #c9a84c30', marginBottom: '14px' }}>
      <div style={{ fontSize: '10px', color: '#8b84a8', letterSpacing: '0.15em', fontWeight: 'bold' }}>📰 LES MURMURES DE FALLEN</div>
      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#c9a84c', marginTop: '2px' }}>{meta.edition}</div>
    </div>
    <Section title="Intro" icon="✍️"><Prose text={prose} /></Section>
    {meta.faits_divers && (
      <Section title="Faits Divers" icon="📋" accent="#60a5fa">
        {meta.faits_divers.map((f, i) => (
          <div key={i} style={{ background: '#0d0b1e', border: '1px solid #2a2440', borderRadius: '4px', padding: '10px 12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '2px' }}>[{f.region.toUpperCase()}]</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e8e4d6', marginBottom: '4px' }}>{f.headline}</div>
            <div style={{ fontSize: '11px', color: '#d4d0c8' }}>{f.body}</div>
          </div>
        ))}
      </Section>
    )}
    {meta.enquetes && (
      <Section title="Enquêtes" icon="🔍" accent="#f472b6">
        {meta.enquetes.map((e, i) => (
          <div key={i} style={{ background: '#0d0b1e', border: '1px solid #2a2440', borderLeft: '3px solid #f472b6', borderRadius: '4px', padding: '10px 12px', marginBottom: '8px' }}>
            {e.quest_hook && <span style={{ fontSize: '9px', background: '#7c3aed30', color: '#a78bfa', border: '1px solid #7c3aed40', borderRadius: '3px', padding: '1px 5px', marginBottom: '4px', display: 'inline-block' }}>ACCRO À QUÊTE</span>}
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e8e4d6', marginBottom: '4px' }}>{e.headline}</div>
            <div style={{ fontSize: '11px', color: '#d4d0c8' }}>{e.body}</div>
          </div>
        ))}
      </Section>
    )}
  </>
);

// ─── DONJON Card ──────────────────────────────────────────────────────────────

const DonjonCard: React.FC<{ prose: string; meta: QuestMeta }> = ({ prose, meta }) => {
  const [gmOpen, setGmOpen] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(90deg, #1a1030 0%, #0f0d1f 100%)', borderBottom: '1px solid #ef444440', padding: '10px 16px', borderRadius: '8px 8px 0 0', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#f87171', letterSpacing: '0.12em', marginBottom: '2px' }}>⚰️ DONJON — {meta.zone?.toUpperCase()}</div>
          <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#e8e4d6' }}>{meta.title}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '16px', letterSpacing: '1px' }}>{meta.danger_level}</div>
          <div style={{ fontSize: '9px', color: '#8b84a8', marginTop: '2px' }}>{meta.recommended_participants} joueurs recommandés</div>
        </div>
      </div>
      <Section title="Ambiance" icon="🕯️"><Prose text={prose} /></Section>
      {meta.floors && (
        <Section title="Étages" icon="🗺️" accent="#f87171">
          {meta.floors.map(fl => (
            <div key={fl.floor} style={{ background: '#0d0b1e', border: '1px solid #2a2440', borderRadius: '4px', padding: '10px 12px', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#f87171', marginBottom: '4px' }}>Étage {fl.floor} — {fl.name}</div>
              <div style={{ fontSize: '12px', color: '#d4d0c8', marginBottom: '6px' }}>{fl.description}</div>
              {fl.environmental_hazard && <div style={{ fontSize: '11px', color: '#fbbf24', marginBottom: '6px' }}>⚠️ {fl.environmental_hazard}</div>}
              {fl.rooms && fl.rooms.map(room => (
                <div key={room.id} style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px', paddingLeft: '8px', borderLeft: '2px solid #2a2440' }}>
                  <span style={{ color: '#d4d0c8' }}>{room.id} — {room.name}</span>
                  {room.threats && <span style={{ color: '#fca5a5' }}> | ⚔️ {room.threats}</span>}
                  {room.trap && <span style={{ color: '#fbbf24' }}> | 🪤 {room.trap}</span>}
                  {room.loot && <span style={{ color: '#86efac' }}> | 💎 {room.loot}</span>}
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}
      {meta.boss && (
        <Section title="Boss Final" icon="💀" accent="#ef4444">
          <div style={{ background: '#1a0d0d', border: '1px solid #ef444440', borderLeft: '3px solid #ef4444', borderRadius: '4px', padding: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fca5a5', marginBottom: '4px' }}>{meta.boss.name}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>{meta.boss.faction} · {meta.boss.rank} · Vitalité : {meta.boss.vitality}</div>
            {meta.boss.techniques && (
              <div style={{ marginBottom: '8px' }}>
                {meta.boss.techniques.map((t, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#d4d0c8', marginBottom: '2px' }}>
                    <span style={{ color: '#f87171', fontWeight: 'bold' }}>[{t.rank}] {t.name}</span> — {t.description}
                  </div>
                ))}
              </div>
            )}
            {meta.boss.weakness && <div style={{ fontSize: '11px', color: '#86efac' }}>🎯 Faiblesse : {meta.boss.weakness}</div>}
          </div>
        </Section>
      )}
      {/* GM Notes */}
      <Section title="Notes MJ" icon="🔐" accent="#c9a84c">
        <div onClick={() => setGmOpen(o => !o)} style={{ background: '#12102a', border: '1px solid #c9a84c40', borderLeft: '3px solid #c9a84c', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#c9a84c', fontStyle: 'italic' }}>{gmOpen ? 'Masquer' : '🔓 Révéler les notes MJ'}</span>
          <span style={{ color: '#c9a84c' }}>{gmOpen ? '▲' : '▼'}</span>
        </div>
        {gmOpen && meta.completion_rewards && (
          <div style={{ background: '#0d0b1e', border: '1px solid #c9a84c30', borderRadius: '0 0 4px 4px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#c9a84c', marginBottom: '6px', fontWeight: 'bold' }}>Récompenses de complétion</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {meta.completion_rewards.xp && <span style={rewardChip('#a78bfa')}>{meta.completion_rewards.xp.toLocaleString()} XP</span>}
              {meta.completion_rewards.pe && <span style={rewardChip('#60a5fa')}>{meta.completion_rewards.pe} PE</span>}
              {meta.completion_rewards.fortune && <span style={rewardChip('#c9a84c')}>{meta.completion_rewards.fortune.toLocaleString()} ₲</span>}
            </div>
          </div>
        )}
      </Section>
    </>
  );
};

// ─── Master QuestCard dispatcher ─────────────────────────────────────────────

const QuestCard: React.FC<QuestCardProps> = ({ prose, meta }) => {
  const accentColor = {
    'QUÊTE': '#c9a84c',
    'ÉVÉNEMENT': '#f472b6',
    'MURMURE': '#60a5fa',
    'DONJON': '#ef4444',
  }[meta.content_type] ?? '#c9a84c';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f0d1f 0%, #12102a 100%)',
      border: `1px solid ${accentColor}30`,
      borderRadius: '8px',
      padding: '0 16px 16px',
      maxWidth: '720px',
      width: '100%',
      marginBottom: '8px',
      boxShadow: `0 4px 24px ${accentColor}10`,
      fontFamily: 'inherit',
    }}>
      {meta.content_type === 'QUÊTE'     && <QueteCard    prose={prose} meta={meta} />}
      {meta.content_type === 'ÉVÉNEMENT' && <EvenementCard prose={prose} meta={meta} />}
      {meta.content_type === 'MURMURE'   && <MurmureCard  prose={prose} meta={meta} />}
      {meta.content_type === 'DONJON'    && <DonjonCard   prose={prose} meta={meta} />}
    </div>
  );
};

export default QuestCard;
export type { QuestMeta };
