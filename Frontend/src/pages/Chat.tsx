import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

// ─── Lorebook Data ───────────────────────────────────────────────────────────

const DIVINITES = [
  { name: 'Conrak', domain: 'Fortune & Chance' },
  { name: 'Malakath', domain: 'Sorcellerie & Fourberie' },
  { name: 'Anubis', domain: 'La Mort' },
  { name: 'Ézéchiel', domain: 'Gloire & Pureté' },
  { name: 'Khālian', domain: 'Lune & Métamorphose' },
  { name: 'Drahen', domain: 'Courage & Sagesse' },
  { name: 'Nergal', domain: 'Corruption & Pouvoir' },
  { name: 'Zeita', domain: 'Raison & Jugement' },
  { name: 'Élisa', domain: 'La Nature' },
  { name: 'Vanyr', domain: 'Volonté & Limites' },
  { name: 'Zëphyr', domain: 'Arts & Adaptation' },
  { name: 'Elsa', domain: 'Mers & Océans' },
];

const FACTIONS = [
  'Sainteté',
  'Occulte',
  'Honneur',
  'Ange',
  'Sang-pur',
  'Esprit',
  'Astre',
  'Viking',
  'Démon',
  'Elder',
  'Hybride',
  'Hors-la-loi',
];

const GRANDES_PUISSANCES = [
  { rank: 1, name: 'Drafhorz Lazuli Varn Emreis', faction: 'Elder', title: 'Empereur de Rezvenia' },
  { rank: 2, name: 'Kaars Agius', faction: 'Hybride', title: 'Vainqueur de Thars' },
  { rank: 3, name: "Avall'arh", faction: 'Esprit', title: 'Gardien Suprême de Noah' },
  { rank: 4, name: 'Gabriella', faction: 'Ange', title: "L'Arme Ultime de Céleste" },
  { rank: 5, name: 'Cécilia Varn Emreis', faction: 'Elder', title: 'Princesse de Rezvenia' },
];

const CURRENT_EVENTS = [
  '📜 Des navires de Kaos disparaissent mystérieusement en mer',
  '🏜️ Une cité de pyramides émerge du sable en Baraen',
  "❄️ Silhouette draconique aperçue dans les mers gelées d'Icetoon",
  '⚔️ Rasmus lance des raids de pillage sur Al-Far',
  '🌙 Pleine lune en Ithis — la forêt de Vianum est interdite',
];

const WELCOME_MESSAGE = `Les portes d'Eudenia frémissent dans l'obscurité des temps.\n\nVous vous réveillez dans le monde de **Fallen** — une terre façonnée par des mains divines, traversée par six siècles de guerres, de héros et de prophéties. L'arc actuel, *La Renaissance*, bat à son comble. Des murmures courent sur toutes les places de marché : les sceaux de Lucas Saviore s'affaiblissent.\n\nOù vous trouvez-vous ? Qui êtes-vous dans ce vaste monde ?`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'player' | 'director' | 'npc';
  content: string;
  npcName?: string;
  timestamp: Date;
}

interface Entity {
  name: string;
  type: string;
  status: string;
}

interface Quest {
  id: string;
  title: string;
  status: 'active' | 'completed' | 'failed';
}

interface SessionStats {
  PE: number;
  XP: number;
  PR: number;
}

interface LorebookOpen {
  divinites: boolean;
  factions: boolean;
  puissances: boolean;
}

// ─── Utility: Render narrative markdown ──────────────────────────────────────

function parseNarrative(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');

  lines.forEach((line, li) => {
    if (li > 0) nodes.push(<br key={`br-${li}`} />);

    // Parse **bold** and *italic* inline
    const segments: React.ReactNode[] = [];
    const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(line)) !== null) {
      if (match.index > lastIdx) {
        segments.push(line.slice(lastIdx, match.index));
      }
      if (match[2] !== undefined) {
        segments.push(<strong key={`b-${li}-${match.index}`}>{match[2]}</strong>);
      } else if (match[3] !== undefined) {
        segments.push(<em key={`i-${li}-${match.index}`}>{match[3]}</em>);
      }
      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < line.length) {
      segments.push(line.slice(lastIdx));
    }

    nodes.push(<span key={`line-${li}`}>{segments}</span>);
  });

  return nodes;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FallenLogo() {
  return (
    <div style={styles.logoContainer}>
      <div style={styles.fallenTitle}>FALLEN</div>
      <div style={styles.arcSubtitle}>Arc IV : La Renaissance</div>
      <div style={styles.logoDivider} />
    </div>
  );
}

function WorldEventTicker({ events }: { events: string[] }) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % events.length);
        setFading(false);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [events.length]);

  return (
    <div style={styles.tickerWrapper}>
      <div style={styles.tickerLabel}>ÉVÈNEMENTS DU MONDE</div>
      <div
        style={{
          ...styles.tickerText,
          opacity: fading ? 0 : 1,
          transition: 'opacity 0.4s ease',
        }}
      >
        {events[idx]}
      </div>
      <div style={styles.tickerDots}>
        {events.map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.tickerDot,
              background: i === idx ? '#c9a84c' : '#2a2440',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statBadge}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  );
}

function FactionBadge({
  name,
  selected,
  onClick,
}: {
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.factionBadge,
        background: selected ? '#6b21a8' : '#12102a',
        borderColor: selected ? '#c9a84c' : '#2a2440',
        color: selected ? '#c9a84c' : '#8b84a8',
        boxShadow: selected ? '0 0 8px #6b21a840' : 'none',
      }}
      title={name}
    >
      {name}
    </button>
  );
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.accordionSection}>
      <button onClick={onToggle} style={styles.accordionHeader}>
        <span style={styles.accordionTitle}>{title}</span>
        <span style={{ color: '#c9a84c', fontSize: '12px', transition: 'transform 0.3s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>
      {open && <div style={styles.accordionBody}>{children}</div>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={styles.spinnerWrapper}>
      <div style={styles.spinner} />
      <span style={styles.spinnerText}>Le destin se forge...</span>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isPlayer = message.role === 'player';
  const isDirector = message.role === 'director';

  if (isDirector) {
    return (
      <div style={styles.directorMessage}>
        <div style={styles.directorHeader}>
          <span style={styles.directorIcon}>✦</span>
          <span style={styles.directorLabel}>DIRECTEUR NARRATIF</span>
          <span style={styles.messageTime}>
            {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div style={styles.directorContent}>{parseNarrative(message.content)}</div>
      </div>
    );
  }

  if (isPlayer) {
    return (
      <div style={styles.playerMessageWrapper}>
        <div style={styles.playerMessage}>
          <div style={styles.playerContent}>{message.content}</div>
          <div style={styles.playerMeta}>
            <span style={styles.playerLabel}>VOUS</span>
            <span style={styles.messageTimePlayer}>
              {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // NPC
  return (
    <div style={styles.npcMessage}>
      <div style={styles.npcHeader}>
        <span style={styles.npcIcon}>◈</span>
        <span style={styles.npcName}>{message.npcName ?? 'Entité Inconnue'}</span>
        <span style={styles.messageTime}>
          {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div style={styles.npcContent}>{parseNarrative(message.content)}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const Chat: React.FC = () => {
  const [sessionId] = useState<string>(() => crypto.randomUUID());

  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: 'director',
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeLocation, setActiveLocation] = useState('Atlantica');
  const [activeNPC, setActiveNPC] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ PE: 0, XP: 0, PR: 0 });
  const [entities, setEntities] = useState<Entity[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [lorebookOpen, setLorebookOpen] = useState<LorebookOpen>({
    divinites: true,
    factions: false,
    puissances: false,
  });
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const toggleLorebook = useCallback(
    (key: keyof LorebookOpen) => {
      setLorebookOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  const sendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const playerMsg: Message = {
      id: crypto.randomUUID(),
      role: 'player',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, playerMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          player_input: trimmed,
          universe_id: 'f0000000-0000-0000-0000-000000000001',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: {
        character_output?: string;
        world_event?: string;
        session_id?: string;
        npc_name?: string;
        location?: string;
      } = await response.json();

      const newMessages: Message[] = [];

      if (data.world_event) {
        newMessages.push({
          id: crypto.randomUUID(),
          role: 'director',
          content: data.world_event,
          timestamp: new Date(),
        });
      }

      if (data.character_output) {
        const npcName = data.npc_name ?? activeNPC ?? 'Le Monde';
        newMessages.push({
          id: crypto.randomUUID(),
          role: 'npc',
          content: data.character_output,
          npcName,
          timestamp: new Date(),
        });

        if (data.npc_name) {
          setActiveNPC(data.npc_name);
          setEntities((prev) => {
            const exists = prev.find((e) => e.name === data.npc_name);
            if (!exists) {
              return [...prev, { name: data.npc_name!, type: 'PNJ', status: 'Actif' }];
            }
            return prev;
          });
        }
      }

      if (data.location) {
        setActiveLocation(data.location);
      }

      setMessages((prev) => [...prev, ...newMessages]);
    } catch (err) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'director',
        content:
          '**[ERREUR DE CONNEXION]** Les fils du destin sont rompus. Vérifiez la connexion au serveur Fallen.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, sessionId, activeNPC]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div style={styles.root}>
        {/* ── LEFT SIDEBAR ── */}
        <aside style={styles.leftSidebar}>
          <FallenLogo />

          <WorldEventTicker events={CURRENT_EVENTS} />

          <div style={styles.sideSection}>
            <div style={styles.sideSectionLabel}>LOCALISATION ACTIVE</div>
            <div style={styles.locationBox}>
              <span style={styles.locationIcon}>⚑</span>
              <span style={styles.locationName}>{activeLocation}</span>
            </div>
          </div>

          <div style={styles.sideSection}>
            <div style={styles.sideSectionLabel}>STATISTIQUES DE SESSION</div>
            <div style={styles.statsRow}>
              <StatBadge label="PE" value={sessionStats.PE} />
              <StatBadge label="XP" value={sessionStats.XP} />
              <StatBadge label="PR" value={sessionStats.PR} />
            </div>
          </div>

          <div style={styles.sideSection}>
            <div style={styles.sideSectionLabel}>SESSION</div>
            <div style={styles.sessionIdText}>
              {sessionId.slice(0, 8).toUpperCase()}...
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={styles.sideFooter}>
            <span style={styles.footerGlyph}>⚕</span> Fallen Universe v4.0
          </div>
        </aside>

        {/* ── CENTER PANEL ── */}
        <main style={styles.centerPanel}>
          {/* Context banner */}
          <div style={styles.contextBanner}>
            <span style={styles.contextIcon}>◉</span>
            <span style={styles.contextText}>
              {activeNPC
                ? `Parlant avec ${activeNPC} — ${activeLocation}`
                : `Explorant ${activeLocation} — Aucun PNJ actif`}
            </span>
            <div style={styles.contextDot} />
          </div>

          {/* Message stream */}
          <div style={styles.messageStream} className="fallen-scroll">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <LoadingSpinner />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={styles.inputArea}>
            <div style={styles.inputWrapper}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Que faites-vous dans le monde de Fallen?"
                style={styles.textInput}
                className="fallen-textarea"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputValue.trim()}
                style={{
                  ...styles.sendButton,
                  opacity: isLoading || !inputValue.trim() ? 0.5 : 1,
                  cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                }}
                className="fallen-send-btn"
              >
                <span style={styles.sendIcon}>⚔</span>
                <span>ENVOYER</span>
              </button>
            </div>
            <div style={styles.inputHint}>
              ↵ Entrée pour envoyer · Shift+↵ pour une nouvelle ligne
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside style={styles.rightSidebar}>
          {/* Faction badges */}
          <div style={styles.sideSection}>
            <div style={styles.sideSectionLabel}>CHOISIR UNE FACTION</div>
            <div style={styles.factionGrid}>
              {FACTIONS.map((f) => (
                <FactionBadge
                  key={f}
                  name={f}
                  selected={selectedFaction === f}
                  onClick={() => setSelectedFaction((prev) => (prev === f ? null : f))}
                />
              ))}
            </div>
          </div>

          <div style={styles.lorebookDivider} />

          {/* Lorebook */}
          <div style={styles.lorebookSection}>
            <div style={styles.lorebookHeader}>
              <span style={styles.lorebookIcon}>📖</span> GRIMOIRE
            </div>

            <AccordionSection
              title="Les 12 Divinités"
              open={lorebookOpen.divinites}
              onToggle={() => toggleLorebook('divinites')}
            >
              {DIVINITES.map((d) => (
                <div key={d.name} style={styles.diviniteRow}>
                  <span style={styles.diviniteName}>{d.name}</span>
                  <span style={styles.diviniteDomain}>{d.domain}</span>
                </div>
              ))}
            </AccordionSection>

            <AccordionSection
              title="Les Factions"
              open={lorebookOpen.factions}
              onToggle={() => toggleLorebook('factions')}
            >
              <div style={styles.factionList}>
                {FACTIONS.map((f) => (
                  <span key={f} style={styles.factionListItem}>
                    {f}
                  </span>
                ))}
              </div>
            </AccordionSection>

            <AccordionSection
              title="Grandes Puissances"
              open={lorebookOpen.puissances}
              onToggle={() => toggleLorebook('puissances')}
            >
              {GRANDES_PUISSANCES.map((p) => (
                <div key={p.rank} style={styles.puissanceRow}>
                  <span style={styles.puissanceRank}>#{p.rank}</span>
                  <div style={styles.puissanceInfo}>
                    <span style={styles.puissanceName}>{p.name}</span>
                    <span style={styles.puissanceTitle}>{p.title}</span>
                    <span style={styles.puissanceFaction}>{p.faction}</span>
                  </div>
                </div>
              ))}
            </AccordionSection>
          </div>

          <div style={styles.lorebookDivider} />

          {/* Entity Ledger */}
          <div style={styles.sideSection}>
            <div style={styles.sideSectionLabel}>ENTITÉS RENCONTRÉES</div>
            {entities.length === 0 ? (
              <div style={styles.emptyState}>Aucune entité rencontrée</div>
            ) : (
              entities.map((e, i) => (
                <div key={i} style={styles.entityRow}>
                  <span style={styles.entityDot} />
                  <span style={styles.entityName}>{e.name}</span>
                  <span style={styles.entityType}>{e.type}</span>
                  <span
                    style={{
                      ...styles.entityStatus,
                      color: e.status === 'Actif' ? '#c9a84c' : '#6b21a8',
                    }}
                  >
                    {e.status}
                  </span>
                </div>
              ))
            )}
          </div>

          <div style={styles.lorebookDivider} />

          {/* Quest Log */}
          <div style={styles.sideSection}>
            <div style={styles.sideSectionLabel}>JOURNAL DE QUÊTES</div>
            {quests.length === 0 ? (
              <div style={styles.emptyState}>Aucune quête active</div>
            ) : (
              quests.map((q) => (
                <div key={q.id} style={styles.questRow}>
                  <span
                    style={{
                      ...styles.questStatusDot,
                      background:
                        q.status === 'active'
                          ? '#c9a84c'
                          : q.status === 'completed'
                          ? '#22c55e'
                          : '#dc2626',
                    }}
                  />
                  <span style={styles.questTitle}>{q.title}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    background: '#0a0a0f',
    color: '#e2e0d6',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
  },

  // ── Left Sidebar
  leftSidebar: {
    width: '25%',
    minWidth: 220,
    maxWidth: 320,
    background: '#0d0b18',
    borderRight: '1px solid #1e1b2e',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    overflowY: 'auto',
    overflowX: 'hidden',
    boxShadow: '2px 0 20px #00000060',
    flexShrink: 0,
  },

  logoContainer: {
    padding: '28px 20px 16px',
    borderBottom: '1px solid #1e1b2e',
    textAlign: 'center',
  },

  fallenTitle: {
    fontSize: '42px',
    fontWeight: 900,
    letterSpacing: '0.35em',
    color: '#c9a84c',
    textShadow: '0 0 30px #c9a84c80, 0 0 60px #c9a84c30',
    lineHeight: 1,
    animation: 'fallenPulse 3s ease-in-out infinite',
  },

  arcSubtitle: {
    fontSize: '10px',
    letterSpacing: '0.2em',
    color: '#6b21a8',
    textTransform: 'uppercase',
    marginTop: '6px',
    fontWeight: 500,
  },

  logoDivider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #c9a84c60, transparent)',
    marginTop: '16px',
  },

  tickerWrapper: {
    padding: '16px 20px',
    borderBottom: '1px solid #1e1b2e',
    minHeight: '90px',
  },

  tickerLabel: {
    fontSize: '9px',
    letterSpacing: '0.2em',
    color: '#4a4570',
    marginBottom: '8px',
    textTransform: 'uppercase',
    fontWeight: 600,
  },

  tickerText: {
    fontSize: '12px',
    color: '#b8b0d0',
    lineHeight: 1.5,
    minHeight: '36px',
  },

  tickerDots: {
    display: 'flex',
    gap: '5px',
    marginTop: '10px',
  },

  tickerDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    transition: 'background 0.4s ease',
  },

  sideSection: {
    padding: '16px 20px',
    borderBottom: '1px solid #1e1b2e',
  },

  sideSectionLabel: {
    fontSize: '9px',
    letterSpacing: '0.2em',
    color: '#4a4570',
    marginBottom: '10px',
    textTransform: 'uppercase',
    fontWeight: 600,
  },

  locationBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#12102a',
    border: '1px solid #2a2440',
    borderRadius: '6px',
    padding: '8px 12px',
  },

  locationIcon: {
    color: '#c9a84c',
    fontSize: '14px',
  },

  locationName: {
    color: '#e2e0d6',
    fontSize: '13px',
    fontWeight: 500,
  },

  statsRow: {
    display: 'flex',
    gap: '8px',
  },

  statBadge: {
    flex: 1,
    background: '#12102a',
    border: '1px solid #2a2440',
    borderRadius: '6px',
    padding: '8px 6px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
  },

  statLabel: {
    fontSize: '9px',
    color: '#6b21a8',
    letterSpacing: '0.1em',
    fontWeight: 700,
    textTransform: 'uppercase',
  },

  statValue: {
    fontSize: '18px',
    color: '#c9a84c',
    fontWeight: 700,
    lineHeight: 1,
  },

  sessionIdText: {
    fontSize: '11px',
    color: '#4a4570',
    fontFamily: 'monospace',
    letterSpacing: '0.1em',
  },

  sideFooter: {
    padding: '14px 20px',
    fontSize: '10px',
    color: '#2a2440',
    textAlign: 'center',
    letterSpacing: '0.1em',
    borderTop: '1px solid #1e1b2e',
  },

  footerGlyph: {
    color: '#c9a84c50',
  },

  // ── Center Panel
  centerPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0f',
    position: 'relative',
    minWidth: 0,
  },

  contextBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 20px',
    background: '#0d0b18',
    borderBottom: '1px solid #1e1b2e',
    flexShrink: 0,
  },

  contextIcon: {
    color: '#6b21a8',
    fontSize: '14px',
  },

  contextText: {
    fontSize: '12px',
    color: '#8b84a8',
    flex: 1,
    letterSpacing: '0.05em',
  },

  contextDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 8px #22c55e',
    animation: 'contextPulse 2s ease-in-out infinite',
  },

  messageStream: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  // Director message
  directorMessage: {
    background: 'linear-gradient(135deg, #0f0d24 0%, #12102a 100%)',
    border: '1px solid #2a2440',
    borderLeft: '3px solid #6b21a8',
    borderRadius: '8px',
    padding: '16px 18px',
    boxShadow: '0 4px 20px #00000040, inset 0 1px 0 #ffffff08',
  },

  directorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },

  directorIcon: {
    color: '#6b21a8',
    fontSize: '12px',
  },

  directorLabel: {
    fontSize: '9px',
    letterSpacing: '0.25em',
    color: '#6b21a8',
    fontWeight: 700,
    textTransform: 'uppercase',
  },

  messageTime: {
    marginLeft: 'auto',
    fontSize: '10px',
    color: '#3a3558',
  },

  directorContent: {
    fontSize: '14px',
    color: '#c8c3dc',
    lineHeight: 1.8,
    fontStyle: 'italic',
  },

  // Player message
  playerMessageWrapper: {
    display: 'flex',
    justifyContent: 'flex-end',
  },

  playerMessage: {
    maxWidth: '65%',
    background: 'linear-gradient(135deg, #1a120a 0%, #221700 100%)',
    border: '1px solid #3a2800',
    borderRight: '3px solid #c9a84c',
    borderRadius: '8px',
    padding: '12px 16px',
    boxShadow: '0 4px 20px #00000040',
  },

  playerContent: {
    fontSize: '14px',
    color: '#e8d5a3',
    lineHeight: 1.6,
    fontWeight: 500,
  },

  playerMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '8px',
  },

  playerLabel: {
    fontSize: '9px',
    letterSpacing: '0.2em',
    color: '#c9a84c80',
    fontWeight: 700,
  },

  messageTimePlayer: {
    fontSize: '10px',
    color: '#3a2800',
  },

  // NPC message
  npcMessage: {
    background: 'linear-gradient(135deg, #080d0f 0%, #0a1012 100%)',
    border: '1px solid #1a2a2e',
    borderLeft: '3px solid #38bdf8',
    borderRadius: '8px',
    padding: '16px 18px',
    maxWidth: '80%',
    boxShadow: '0 4px 20px #00000040',
  },

  npcHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },

  npcIcon: {
    color: '#38bdf8',
    fontSize: '12px',
  },

  npcName: {
    fontSize: '11px',
    letterSpacing: '0.15em',
    color: '#38bdf8',
    fontWeight: 600,
    textTransform: 'uppercase',
  },

  npcContent: {
    fontSize: '14px',
    color: '#d4d0dc',
    lineHeight: 1.75,
  },

  // Spinner
  spinnerWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 20px',
    background: '#0d0b18',
    border: '1px solid #2a2440',
    borderRadius: '8px',
    borderLeft: '3px solid #dc2626',
  },

  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #2a2440',
    borderTop: '2px solid #c9a84c',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    flexShrink: 0,
  },

  spinnerText: {
    fontSize: '13px',
    color: '#8b84a8',
    fontStyle: 'italic',
    letterSpacing: '0.05em',
  },

  // Input area
  inputArea: {
    padding: '16px 20px 20px',
    background: '#0d0b18',
    borderTop: '1px solid #1e1b2e',
    flexShrink: 0,
  },

  inputWrapper: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  },

  textInput: {
    flex: 1,
    background: '#12102a',
    border: '1px solid #2a2440',
    borderRadius: '8px',
    color: '#e2e0d6',
    fontSize: '14px',
    padding: '12px 16px',
    resize: 'none',
    outline: 'none',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    lineHeight: 1.5,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },

  sendButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'linear-gradient(135deg, #7c3aed, #6b21a8)',
    border: '1px solid #7c3aed',
    borderRadius: '8px',
    color: '#e2e0d6',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    padding: '12px 18px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
    minWidth: '80px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },

  sendIcon: {
    fontSize: '18px',
  },

  inputHint: {
    fontSize: '10px',
    color: '#2a2440',
    marginTop: '8px',
    textAlign: 'right',
    letterSpacing: '0.05em',
  },

  // ── Right Sidebar
  rightSidebar: {
    width: '25%',
    minWidth: 220,
    maxWidth: 340,
    background: '#0d0b18',
    borderLeft: '1px solid #1e1b2e',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    overflowX: 'hidden',
    boxShadow: '-2px 0 20px #00000060',
    flexShrink: 0,
  },

  factionGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
  },

  factionBadge: {
    fontSize: '10px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid',
    cursor: 'pointer',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontWeight: 500,
    letterSpacing: '0.05em',
    transition: 'all 0.2s',
  },

  lorebookDivider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #2a2440, transparent)',
    margin: '0 20px',
  },

  lorebookSection: {
    padding: '12px 0',
  },

  lorebookHeader: {
    padding: '6px 20px 10px',
    fontSize: '10px',
    color: '#c9a84c',
    letterSpacing: '0.2em',
    fontWeight: 700,
    textTransform: 'uppercase',
  },

  lorebookIcon: {
    marginRight: '4px',
  },

  accordionSection: {
    borderBottom: '1px solid #1a1830',
  },

  accordionHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#8b84a8',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    transition: 'background 0.2s',
  },

  accordionTitle: {
    fontSize: '11px',
    letterSpacing: '0.1em',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#8b84a8',
  },

  accordionBody: {
    padding: '0 20px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  diviniteRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '5px 0',
    borderBottom: '1px solid #12102a',
  },

  diviniteName: {
    fontSize: '12px',
    color: '#c9a84c',
    fontWeight: 600,
  },

  diviniteDomain: {
    fontSize: '10px',
    color: '#4a4570',
    textAlign: 'right',
    maxWidth: '55%',
    lineHeight: 1.3,
  },

  factionList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
  },

  factionListItem: {
    fontSize: '11px',
    color: '#8b84a8',
    background: '#12102a',
    padding: '3px 8px',
    borderRadius: '3px',
    border: '1px solid #2a2440',
  },

  puissanceRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    padding: '6px 0',
    borderBottom: '1px solid #12102a',
  },

  puissanceRank: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#c9a84c40',
    minWidth: '24px',
    lineHeight: 1.2,
  },

  puissanceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },

  puissanceName: {
    fontSize: '11px',
    color: '#e2e0d6',
    fontWeight: 600,
    lineHeight: 1.3,
  },

  puissanceTitle: {
    fontSize: '10px',
    color: '#6b21a8',
    lineHeight: 1.3,
    fontStyle: 'italic',
  },

  puissanceFaction: {
    fontSize: '9px',
    color: '#4a4570',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },

  entityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '5px 0',
    borderBottom: '1px solid #12102a',
  },

  entityDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#c9a84c',
    flexShrink: 0,
    boxShadow: '0 0 6px #c9a84c',
  },

  entityName: {
    fontSize: '12px',
    color: '#e2e0d6',
    flex: 1,
    fontWeight: 500,
  },

  entityType: {
    fontSize: '10px',
    color: '#4a4570',
    letterSpacing: '0.05em',
  },

  entityStatus: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },

  questRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 0',
    borderBottom: '1px solid #12102a',
  },

  questStatusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },

  questTitle: {
    fontSize: '12px',
    color: '#b8b0d0',
  },

  emptyState: {
    fontSize: '11px',
    color: '#2a2440',
    fontStyle: 'italic',
    padding: '4px 0',
  },
};

// ─── Global CSS (keyframes + scrollbar + focus styles) ──────────────────────

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background: #0a0a0f;
    overflow: hidden;
  }

  @keyframes fallenPulse {
    0%, 100% {
      text-shadow: 0 0 30px #c9a84c80, 0 0 60px #c9a84c30;
    }
    50% {
      text-shadow: 0 0 50px #c9a84ccc, 0 0 100px #c9a84c60, 0 0 140px #c9a84c20;
    }
  }

  @keyframes spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes contextPulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px #22c55e; }
    50%       { opacity: 0.4; box-shadow: 0 0 3px #22c55e; }
  }

  .fallen-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .fallen-scroll::-webkit-scrollbar-track {
    background: #0a0a0f;
  }
  .fallen-scroll::-webkit-scrollbar-thumb {
    background: #2a2440;
    border-radius: 2px;
  }
  .fallen-scroll::-webkit-scrollbar-thumb:hover {
    background: #6b21a8;
  }

  .fallen-textarea:focus {
    border-color: #6b21a8 !important;
    box-shadow: 0 0 0 2px #6b21a820 !important;
  }
  .fallen-textarea::placeholder {
    color: #3a3558;
  }

  .fallen-send-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed) !important;
    box-shadow: 0 0 20px #7c3aed60 !important;
    transform: translateY(-1px);
  }
  .fallen-send-btn:active:not(:disabled) {
    transform: translateY(0);
  }
`;

export default Chat;
