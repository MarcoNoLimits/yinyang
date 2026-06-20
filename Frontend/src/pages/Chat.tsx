import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseClient";
import { 
  Terminal, 
  Database, 
  Activity, 
  Cpu, 
  LogOut, 
  Plus, 
  Trash2, 
  BookOpen, 
  Compass, 
  Sword,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";

export interface Message {
  text: string;
  sender: string;
}

export interface Universe {
  universe_id: string;
  name: string;
  description: string;
}

export interface LorebookEntry {
  entry_id: string;
  universe_id: string;
  title: string;
  keywords: string[];
  content: string;
}

export interface Entity {
  entity_id: string;
  universe_id: string;
  entity_type: string;
  name: string;
  properties: any;
  is_alive: boolean;
}

export interface Quest {
  quest_id: string;
  title: string;
  description: string;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  reward: string;
}

export default function Chat() {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth / Session States
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string; userId: string } | null>(null);

  // Chat Session States
  const [chatId, setChatId] = useState<number>(0);
  const [sessionsList, setSessionsList] = useState<{ chatId: number; name: string }[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [typing, setTyping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Universe States
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [selectedUniverseId, setSelectedUniverseId] = useState<string>('f0000000-0000-0000-0000-000000000001'); // Defaults to Fallen
  const [newUnivName, setNewUnivName] = useState<string>('');
  const [newUnivDesc, setNewUnivDesc] = useState<string>('');

  // Default character state to satisfy DB foreign keys in chats table
  const [defaultCharId, setDefaultCharId] = useState<number>(1);
  const [defaultCharName, setDefaultCharName] = useState<string>("Swarm Oracle");
  const [defaultCharPrompt, setDefaultCharPrompt] = useState<string>("You are the guiding consciousness of the swarm terminal.");

  // Right-Panel Ledger Tabs
  const [activeTab, setActiveTab] = useState<'lorebook' | 'entities' | 'quests'>('lorebook');

  // Lorebook States
  const [lorebookEntries, setLorebookEntries] = useState<LorebookEntry[]>([]);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [loreTitle, setLoreTitle] = useState<string>('');
  const [loreKeywords, setLoreKeywords] = useState<string>('');
  const [loreContent, setLoreContent] = useState<string>('');

  // Entity States
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityName, setEntityName] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('NPC');
  const [entityProps, setEntityProps] = useState<string>(
    JSON.stringify({ role: "Sentinel", faction: "Sentinels", threat: "High" }, null, 2)
  );
  const [entityIsAlive, setEntityIsAlive] = useState<boolean>(true);

  // Active Quests States (Persisted in localStorage per universe)
  const [quests, setQuests] = useState<Quest[]>([]);
  const [questTitle, setQuestTitle] = useState<string>('');
  const [questDesc, setQuestDesc] = useState<string>('');
  const [questReward, setQuestReward] = useState<string>('');

  // Check user session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/Login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("username, user_id, role")
          .eq("user_id", session.user.id)
          .single();

        if (profileError || !profile) {
          console.error("Profile not found:", profileError);
          navigate("/Login");
          return;
        }

        if (profile.role !== "user" && profile.role !== "admin" && profile.role !== "moderator") {
          navigate("/Login");
          return;
        }

        setUser({
          username: profile.username,
          userId: profile.user_id,
        });
        setLoading(false);
      } catch (err) {
        console.error("Error loading session:", err);
        navigate("/Login");
      }
    };

    checkSession();
  }, [navigate]);

  // Fetch characters on mount to pick a default to satisfy foreign keys
  useEffect(() => {
    const fetchDefaultChar = async () => {
      try {
        const { data, error } = await supabase.from("characters").select("*").limit(1);
        if (data && data.length > 0 && !error) {
          setDefaultCharId(data[0].char_id);
          setDefaultCharName(data[0].char_name);
          setDefaultCharPrompt(data[0].char_prompt || data[0].char_description);
        }
      } catch (err) {
        console.error("Error fetching default character for database linkage:", err);
      }
    };
    fetchDefaultChar();
  }, []);

  // Fetch universes and initial settings
  useEffect(() => {
    fetchUniverses();
  }, []);

  // Sync session chats list
  useEffect(() => {
    if (user) {
      fetchUserChats();
    }
  }, [user]);

  // Sync universe databases and active quests
  useEffect(() => {
    if (selectedUniverseId) {
      fetchLorebook(selectedUniverseId);
      fetchEntities(selectedUniverseId);
      loadActiveQuests(selectedUniverseId);
    }
  }, [selectedUniverseId]);

  // Scroll to bottom of terminal log on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const fetchUniverses = async () => {
    try {
      const { data, error } = await supabase.from('universes').select('*').order('name');
      if (error) {
        console.error("Error fetching universes:", error);
      } else if (data) {
        setUniverses(data);
        // If Fallen universe is in the list, keep selectedUniverseId. Otherwise select first.
        const hasFallen = data.some(u => u.universe_id === 'f0000000-0000-0000-0000-000000000001');
        if (!hasFallen && data.length > 0) {
          setSelectedUniverseId(data[0].universe_id);
        }
      }
    } catch (err) {
      console.error("Error in fetchUniverses:", err);
    }
  };

  const handleCreateUniverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnivName.trim()) return;
    try {
      const { data, error } = await supabase.from('universes').insert({
        name: newUnivName.trim(),
        description: newUnivDesc.trim()
      }).select().single();

      if (error) {
        alert("Error creating universe: " + error.message);
      } else if (data) {
        setNewUnivName('');
        setNewUnivDesc('');
        await fetchUniverses();
        setSelectedUniverseId(data.universe_id);
      }
    } catch (err) {
      console.error("Error in handleCreateUniverse:", err);
    }
  };

  const fetchUserChats = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("chat_id")
        .eq("user_id", user.userId)
        .order("chat_id", { ascending: false });

      if (error) {
        console.error("Error fetching chats:", error);
        setSessionsList([]);
        return;
      }

      if (data) {
        const chats = data.map((c: any) => ({
          chatId: c.chat_id,
          name: `Log Session #${c.chat_id}`
        }));
        setSessionsList(chats);
      }
    } catch (err) {
      console.error("Error in fetchUserChats:", err);
    }
  };

  const loadSessionChat = async (sId: number) => {
    setChatId(sId);
    if (sId === 0) {
      setMessages([{ text: "Swarm command prompt initialized. Direct simulation interface online.", sender: "system" }]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("chat_text")
        .eq("chat_id", sId)
        .single();

      if (error || !data) {
        setError("Console session load failed.");
        return;
      }

      const allMessages = (data.chat_text || "").split("$$").filter((msg: string) => msg.trim() !== "");
      let msgs: Message[] = [];
      for (const msg of allMessages) {
        if (msg.startsWith("[System]: ")) {
          msgs.push({ text: msg.replace("[System]: ", ""), sender: "system" });
        } else if (msg.startsWith("[User]: ")) {
          msgs.push({ text: msg.replace("[User]: ", ""), sender: "user" });
        } else if (msg.startsWith("[AI]: ")) {
          msgs.push({ text: msg.replace("[AI]: ", ""), sender: "ai" });
        } else {
          let Sender = msgs.length % 2 === 0 ? "user" : "ai";
          msgs.push({ text: msg, sender: Sender });
        }
      }
      setMessages(msgs);
    } catch (err) {
      console.error("Error loading chat session:", err);
    }
  };

  const handleCreateSession = () => {
    setChatId(0);
    setMessages([{ text: "New Terminal console ready. Send a command to establish link.", sender: "system" }]);
  };

  const handleDeleteSession = async (sId: number) => {
    try {
      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("chat_id", sId);
      if (!error) {
        await fetchUserChats();
        if (chatId === sId) {
          handleCreateSession();
        }
      } else {
        console.error("Error deleting session:", error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;
    const currentMsg = inputText;
    setInputText("");
    setError(null);

    let userMsgText = "";
    if (chatId === 0) {
      userMsgText += "[User]: " + currentMsg + "$$";
      try {
        setTyping(true);
        const { data: newChat, error: insertError } = await supabase
          .from("chats")
          .insert({
            user_id: user.userId,
            char_id: defaultCharId,
            chat_text: userMsgText
          })
          .select("chat_id")
          .single();

        if (insertError || !newChat) {
          setError("Failed to initialize console session.");
          setTyping(false);
          return;
        }

        const newChatId = newChat.chat_id;
        setChatId(newChatId);

        const newMessages = [...messages, { text: currentMsg, sender: "user" }];
        setMessages(newMessages);

        const response = await fetch("http://localhost:8000/chat/swarm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: "" + newChatId,
            universe_id: selectedUniverseId,
            char_id: defaultCharId,
            char_name: defaultCharName,
            char_personality: defaultCharPrompt,
            message: currentMsg
          })
        });

        if (response.ok) {
          const apiRes = await response.json();
          const aiReply = apiRes.response.content;
          const worldEvent = apiRes.response.world_event;

          let updatedChatText = userMsgText;
          const finalMessages = [...newMessages];

          if (worldEvent) {
            updatedChatText += "[System]: " + worldEvent + "$$";
            finalMessages.push({ text: worldEvent, sender: "system" });
          }
          updatedChatText += "[AI]: " + aiReply + "$$";
          finalMessages.push({ text: aiReply, sender: "ai" });

          await supabase
            .from("chats")
            .update({ chat_text: updatedChatText })
            .eq("chat_id", newChatId);

          setMessages(finalMessages);
          setTyping(false);
          await fetchUserChats();
        } else {
          setError("Failed to fetch swarm matrix response.");
          setTyping(false);
        }
      } catch (err) {
        console.error("Error creating session:", err);
        setError("Network failure.");
        setTyping(false);
      }
    } else {
      try {
        setTyping(true);
        const { data: existingChat, error: fetchError } = await supabase
          .from("chats")
          .select("chat_text")
          .eq("chat_id", chatId)
          .single();

        if (fetchError || !existingChat) {
          setError("Session lost.");
          setTyping(false);
          return;
        }

        const currentChatText = existingChat.chat_text || "";
        const updatedUserChatText = currentChatText + "[User]: " + currentMsg + "$$";

        await supabase
          .from("chats")
          .update({ chat_text: updatedUserChatText })
          .eq("chat_id", chatId);

        const newMessages = [...messages, { text: currentMsg, sender: "user" }];
        setMessages(newMessages);

        const response = await fetch("http://localhost:8000/chat/swarm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: "" + chatId,
            universe_id: selectedUniverseId,
            char_id: defaultCharId,
            char_name: defaultCharName,
            char_personality: defaultCharPrompt,
            message: currentMsg
          })
        });

        if (response.ok) {
          const apiRes = await response.json();
          const aiReply = apiRes.response.content;
          const worldEvent = apiRes.response.world_event;

          let updatedAIChatText = updatedUserChatText;
          const finalMessages = [...newMessages];

          if (worldEvent) {
            updatedAIChatText += "[System]: " + worldEvent + "$$";
            finalMessages.push({ text: worldEvent, sender: "system" });
          }
          updatedAIChatText += "[AI]: " + aiReply + "$$";
          finalMessages.push({ text: aiReply, sender: "ai" });

          await supabase
            .from("chats")
            .update({ chat_text: updatedAIChatText })
            .eq("chat_id", chatId);

          setMessages(finalMessages);
          setTyping(false);
        } else {
          setError("Model failed to process directive.");
          setTyping(false);
        }
      } catch (err) {
        console.error("Error updating session:", err);
        setError("Network connection timeout.");
        setTyping(false);
      }
    }
  };

  // Lorebook Database Handlers
  const fetchLorebook = async (univId: string) => {
    try {
      const { data, error } = await supabase
        .from('lorebook_entries')
        .select('*')
        .eq('universe_id', univId)
        .order('created_at', { ascending: false });
      if (error) console.error("Error fetching lorebook:", error);
      else if (data) setLorebookEntries(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLorebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loreTitle.trim() || !loreContent.trim()) return;
    const keywordArray = loreKeywords.split(',').map(k => k.trim()).filter(Boolean);

    try {
      if (editingEntryId) {
        const { error } = await supabase
          .from('lorebook_entries')
          .update({
            title: loreTitle.trim(),
            keywords: keywordArray,
            content: loreContent.trim()
          })
          .eq('entry_id', editingEntryId);

        if (error) {
          alert("Error: " + error.message);
        } else {
          setEditingEntryId(null);
          setLoreTitle('');
          setLoreKeywords('');
          setLoreContent('');
          fetchLorebook(selectedUniverseId);
        }
      } else {
        const { error } = await supabase
          .from('lorebook_entries')
          .insert({
            universe_id: selectedUniverseId,
            title: loreTitle.trim(),
            keywords: keywordArray,
            content: loreContent.trim()
          });

        if (error) {
          alert("Error: " + error.message);
        } else {
          setLoreTitle('');
          setLoreKeywords('');
          setLoreContent('');
          fetchLorebook(selectedUniverseId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Entities Ledger Handlers
  const fetchEntities = async (univId: string) => {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('universe_id', univId)
        .order('name');
      if (error) console.error("Error fetching entities:", error);
      else if (data) setEntities(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName.trim()) return;
    let parsedProps = {};
    try {
      parsedProps = JSON.parse(entityProps || '{}');
    } catch (err) {
      alert("Invalid JSON format in Properties editor.");
      return;
    }

    try {
      const { error } = await supabase.from('entities').insert({
        universe_id: selectedUniverseId,
        name: entityName.trim(),
        entity_type: entityType,
        properties: parsedProps,
        is_alive: entityIsAlive
      });

      if (error) {
        alert("Error: " + error.message);
      } else {
        setEntityName('');
        setEntityProps(JSON.stringify({ role: "Sentinel", faction: "Sentinels", threat: "High" }, null, 2));
        fetchEntities(selectedUniverseId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Active Quests Handlers
  const loadActiveQuests = (univId: string) => {
    const stored = localStorage.getItem(`quests_${univId}`);
    if (stored) {
      try {
        setQuests(JSON.parse(stored));
      } catch (e) {
        setQuests([]);
      }
    } else {
      if (univId === 'f0000000-0000-0000-0000-000000000001') {
        const defaultFallenQuests: Quest[] = [
          {
            quest_id: 'q1',
            title: 'Contain Crimson Waste Void Leak',
            description: 'Seal the expanding cosmic rift in the wastes before the obsidian structures collapse.',
            status: 'ACTIVE',
            reward: '500 Cryptic Residues'
          },
          {
            quest_id: 'q2',
            title: 'Deconstruct the Crimson Keep Sentinel',
            description: 'Extract volatile engine modules from deactivated keepers.',
            status: 'ACTIVE',
            reward: 'Prime Obsidian Core'
          }
        ];
        setQuests(defaultFallenQuests);
        localStorage.setItem(`quests_${univId}`, JSON.stringify(defaultFallenQuests));
      } else {
        setQuests([]);
      }
    }
  };

  const saveQuests = (updatedQuests: Quest[]) => {
    setQuests(updatedQuests);
    localStorage.setItem(`quests_${selectedUniverseId}`, JSON.stringify(updatedQuests));
  };

  const handleCreateQuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questTitle.trim() || !questDesc.trim()) return;

    const newQuest: Quest = {
      quest_id: Math.random().toString(36).substring(2, 9),
      title: questTitle.trim(),
      description: questDesc.trim(),
      status: 'ACTIVE',
      reward: questReward.trim() || 'Unspecified Artifact'
    };

    const list = [newQuest, ...quests];
    saveQuests(list);
    setQuestTitle("");
    setQuestDesc("");
    setQuestReward("");
  };

  const handleToggleQuestStatus = (qId: string, status: 'ACTIVE' | 'COMPLETED' | 'FAILED') => {
    const list = quests.map(q => q.quest_id === qId ? { ...q, status } : q);
    saveQuests(list);
  };

  const handleDeleteQuest = (qId: string) => {
    const list = quests.filter(q => q.quest_id !== qId);
    saveQuests(list);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/Login");
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#05070a] text-cyan-500 font-mono text-sm">
        <div className="flex flex-col items-center space-y-4">
          <Activity className="h-10 w-10 animate-spin" />
          <span className="tracking-widest font-bold">BOOTING COGNITIVE SWARM SYSTEM...</span>
        </div>
      </div>
    );
  }

  const selectedUniverse = universes.find(u => u.universe_id === selectedUniverseId);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#05070d] text-[#c8d3f5] font-mono overflow-hidden select-none relative scanline">
      {/* Glow effects stylesheet */}
      <style dangerouslySetInnerHTML={{__html: `
        .terminal-glow {
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.1);
        }
        .terminal-glow-active {
          box-shadow: 0 0 25px rgba(6, 182, 212, 0.2);
        }
        .terminal-glow-purple {
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.1);
        }
        .custom-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: #020308;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #111827;
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: #0891b2;
        }
        .scanline::after {
          content: " ";
          display: block;
          position: absolute;
          top: 0; left: 0; bottom: 0; right: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
          z-index: 99999;
          background-size: 100% 3px, 3px 100%;
          pointer-events: none;
        }
      `}} />

      {/* Atmospheric Sci-Fi Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-cyan-950 bg-[#070a14] z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#00f0ff]" />
          <span className="text-xs text-cyan-400 font-bold tracking-widest uppercase">SWARM_UNIVERSE_LINK v4.10.8</span>
        </div>
        <div className="text-sm font-black text-cyan-200 tracking-wider flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span>{selectedUniverse ? selectedUniverse.name.toUpperCase() : "COSMIC CORE LINK"}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
            OPERATOR: <span className="text-cyan-400 font-semibold">{user.username.toUpperCase()}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-1 text-xs text-red-400 hover:text-red-300 transition-colors border border-red-950/40 hover:border-red-800/80 px-2.5 py-1 rounded bg-red-950/10 cursor-pointer"
          >
            <LogOut className="h-3 w-3" />
            <span>EXIT_LINK</span>
          </button>
        </div>
      </header>

      {/* Main Console Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT COLUMN: Sessions & Status (20% width) */}
        <aside className="w-1/5 bg-[#070a14]/90 border-r border-cyan-950/50 p-4 flex flex-col space-y-6 overflow-y-auto custom-scroll shrink-0">
          
          {/* Active Universe Selector */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-cyan-500 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Compass className="h-3.5 w-3.5" />
              Universe Setting
            </h3>
            <select
              value={selectedUniverseId}
              onChange={(e) => setSelectedUniverseId(e.target.value)}
              className="w-full bg-[#02040a] border border-cyan-950 rounded p-2 text-cyan-300 text-xs focus:outline-none focus:border-cyan-400 transition-all font-mono"
            >
              {universes.map((u) => (
                <option key={u.universe_id} value={u.universe_id}>
                  {u.name}
                </option>
              ))}
            </select>
            {selectedUniverse && (
              <div className="bg-[#02040a] border border-cyan-950/40 p-2.5 rounded text-[11px] text-slate-400 leading-relaxed text-justify">
                {selectedUniverse.description}
              </div>
            )}
          </div>

          {/* Session Registry */}
          <div className="flex flex-col flex-1 min-h-[200px] space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-cyan-500 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                Console Logs
              </h3>
              <button 
                onClick={handleCreateSession}
                className="text-[10px] text-cyan-400 border border-cyan-950 hover:border-cyan-500/50 px-1.5 py-0.5 rounded bg-cyan-950/15 cursor-pointer flex items-center gap-0.5 transition-colors"
                title="Initialize New link"
              >
                <Plus className="h-3 w-3" />
                <span>NEW</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scroll space-y-1 bg-[#02040a]/40 border border-cyan-950/20 p-1.5 rounded">
              {sessionsList.length === 0 ? (
                <div className="text-[11px] text-slate-600 italic p-2 font-mono">No logs found.</div>
              ) : (
                sessionsList.map((session) => (
                  <div 
                    key={session.chatId}
                    onClick={() => loadSessionChat(session.chatId)}
                    className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-all ${
                      chatId === session.chatId 
                        ? "bg-cyan-950/20 border-cyan-500/60 text-cyan-200" 
                        : "bg-transparent border-transparent hover:bg-slate-900/40 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="truncate">{session.name}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.chatId);
                      }}
                      className="text-red-900 hover:text-red-400 p-0.5 rounded hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Diagnostics HUD */}
          <div className="bg-[#02040a] border border-cyan-950/50 rounded p-3 space-y-2 shrink-0">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-cyan-950/30 pb-1">CONSOLE DIAGNOSTIC</h4>
            <div className="grid grid-cols-2 gap-y-1 text-[9px] text-slate-400">
              <span>SWARM SYNC</span>
              <span className="text-green-500 text-right">SECURED</span>
              <span>COGNITIVE LINK</span>
              <span className="text-green-500 text-right">ONLINE</span>
              <span>LORE INDEXER</span>
              <span className="text-cyan-500 text-right">READY</span>
              <span>QUEST ENGINE</span>
              <span className="text-cyan-500 text-right">STANDBY</span>
            </div>
          </div>

        </aside>

        {/* CENTER COLUMN: Swarm Terminal Chrono-Logs (45% width) */}
        <section className="w-9/20 border-r border-cyan-950/50 flex flex-col h-full bg-[#03050a] relative shrink-0">
          
          {/* Terminal Screen Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#060913] border-b border-cyan-950/40 text-xs text-slate-500 shrink-0">
            <span>STATION: TERMINAL_ALPHA</span>
            <span>SIMULATOR CONSOLE</span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll terminal-glow">
            {messages.map((msg, index) => {
              if (msg.sender === "system") {
                return (
                  <div key={index} className="border-l-2 border-purple-500 bg-purple-950/10 p-3 rounded-r text-purple-300 text-xs space-y-1">
                    <div className="text-[10px] font-black text-purple-400 tracking-wider flex items-center gap-1">
                      <Activity className="h-3 w-3 animate-pulse" />
                      <span>[WORLD SYSTEM DYNAMICS WARNING]</span>
                    </div>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                );
              }

              const isUser = msg.sender === "user";
              return (
                <div key={index} className={`flex flex-col space-y-1 ${isUser ? "items-end" : "items-start"}`}>
                  <span className="text-[9px] text-slate-500">
                    {isUser ? "OP@CONSOLE:~#" : "SWARM_SIMULATOR_CORE_V4"}
                  </span>
                  <div 
                    className={`px-3.5 py-2.5 rounded-lg text-xs leading-relaxed max-w-[85%] border shadow-sm ${
                      isUser 
                        ? "bg-[#0b1329] border-cyan-900/60 text-cyan-200" 
                        : "bg-[#03060f] border-slate-900 text-slate-300"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {typing && (
              <div className="flex flex-col space-y-1 items-start">
                <span className="text-[9px] text-slate-500">SWARM_SIMULATOR_CORE_V4</span>
                <div className="px-3.5 py-2 bg-[#03060f] border border-cyan-950/40 rounded text-cyan-400 text-xs flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="animate-pulse tracking-widest text-[10px]">PARSING DIRECTIVES...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="border border-red-950/60 bg-red-950/10 p-2.5 rounded text-red-400 text-xs flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span>{error}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Terminal Command Input Area */}
          <form onSubmit={sendMessage} className="p-3 bg-[#060913] border-t border-cyan-950/50 flex items-center gap-2 shrink-0">
            <span className="text-cyan-600 font-black text-xs shrink-0 select-none">OP@CONSOLE:~#</span>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter directive code / message..."
              className="flex-1 bg-transparent text-cyan-100 text-xs focus:outline-none focus:ring-0 placeholder-cyan-900 border-none px-1 font-mono"
            />
            <button 
              type="submit" 
              className="text-[10px] text-cyan-400 border border-cyan-700/50 hover:bg-cyan-500 hover:text-black hover:border-cyan-300 font-bold px-3 py-1.5 rounded transition-all shrink-0 cursor-pointer uppercase tracking-wider"
            >
              EXECUTE
            </button>
          </form>

        </section>

        {/* RIGHT COLUMN: Universe Database Ledger & Quests Hub (35% width) */}
        <section className="flex-1 flex flex-col h-full bg-[#04060b] overflow-hidden">
          
          {/* Navigation Ledger Tabs */}
          <div className="flex border-b border-cyan-950/60 bg-[#070a14] shrink-0 text-xs">
            <button 
              onClick={() => setActiveTab('lorebook')}
              className={`flex-1 py-3 text-center font-bold tracking-widest uppercase border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'lorebook' 
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-950/5' 
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/20'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Lorebook
            </button>
            <button 
              onClick={() => setActiveTab('entities')}
              className={`flex-1 py-3 text-center font-bold tracking-widest uppercase border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'entities' 
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-950/5' 
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/20'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Entities
            </button>
            <button 
              onClick={() => setActiveTab('quests')}
              className={`flex-1 py-3 text-center font-bold tracking-widest uppercase border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'quests' 
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-950/5' 
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/20'
              }`}
            >
              <Sword className="h-3.5 w-3.5" />
              Active Quests
            </button>
          </div>

          {/* Content Pane */}
          <div className="flex-1 overflow-y-auto p-4 custom-scroll">
            
            {/* LOREBOOK TAB */}
            {activeTab === 'lorebook' && (
              <div className="space-y-6">
                
                {/* Save/Add Lorebook form */}
                <form onSubmit={handleSaveLorebook} className="bg-[#020408] border border-cyan-950/70 p-3 rounded space-y-3">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    {editingEntryId ? "Modify Lore Record" : "Append Lore Record"}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">RECORD TITLE</label>
                      <input
                        type="text"
                        required
                        value={loreTitle}
                        onChange={(e) => setLoreTitle(e.target.value)}
                        placeholder="e.g., The Void Swarm"
                        className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">KEYWORDS (comma-separated)</label>
                      <input
                        type="text"
                        required
                        value={loreKeywords}
                        onChange={(e) => setLoreKeywords(e.target.value)}
                        placeholder="void, corruption, leak"
                        className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">LORE CORE DATA</label>
                    <textarea
                      required
                      value={loreContent}
                      onChange={(e) => setLoreContent(e.target.value)}
                      placeholder="Input chronological logs or world information..."
                      rows={3}
                      className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500 resize-none font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-cyan-950 hover:bg-cyan-800 text-cyan-300 text-[10px] font-bold py-1.5 rounded transition-colors cursor-pointer border border-cyan-700/40"
                    >
                      {editingEntryId ? "SAVE RECORD" : "ADD TO DATABASE"}
                    </button>
                    {editingEntryId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntryId(null);
                          setLoreTitle("");
                          setLoreKeywords("");
                          setLoreContent("");
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] font-bold py-1.5 px-3 rounded transition-colors border border-slate-700/40"
                      >
                        CANCEL
                      </button>
                    )}
                  </div>
                </form>

                {/* Lore Entries Display */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-cyan-950/20 pb-1">
                    INDEXED RECORDS ({lorebookEntries.length})
                  </h4>
                  {lorebookEntries.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No logs indexed for this universe.</p>
                  ) : (
                    <div className="space-y-3">
                      {lorebookEntries.map((entry) => (
                        <div 
                          key={entry.entry_id}
                          className="bg-[#020408] border border-cyan-950/40 hover:border-cyan-800/40 p-3 rounded transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-xs text-cyan-300">{entry.title}</span>
                            <button
                              onClick={() => {
                                setEditingEntryId(entry.entry_id);
                                setLoreTitle(entry.title);
                                setLoreKeywords(entry.keywords.join(', '));
                                setLoreContent(entry.content);
                              }}
                              className="text-[10px] text-cyan-500 hover:text-cyan-400 font-bold cursor-pointer"
                            >
                              [EDIT]
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {entry.keywords.map((kw, i) => (
                              <span 
                                key={i} 
                                className="bg-cyan-950/30 text-cyan-400 border border-cyan-900/60 rounded px-1.5 py-0.5 text-[9px] font-semibold"
                              >
                                #{kw}
                              </span>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-2 whitespace-pre-wrap leading-relaxed">
                            {entry.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ENTITIES LEDGER TAB */}
            {activeTab === 'entities' && (
              <div className="space-y-6">
                
                {/* Add Entity Form */}
                <form onSubmit={handleCreateEntity} className="bg-[#020408] border border-cyan-950/70 p-3 rounded space-y-3">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Register Entity Ledger
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">ENTITY NAME</label>
                      <input
                        type="text"
                        required
                        value={entityName}
                        onChange={(e) => setEntityName(e.target.value)}
                        placeholder="e.g., Sentinel Vael"
                        className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">ENTITY TYPE</label>
                      <select
                        value={entityType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEntityType(val);
                          if (val === 'NPC') {
                            setEntityProps(JSON.stringify({ role: "Sentinel", faction: "Sentinels", threat: "High" }, null, 2));
                          } else if (val === 'ITEM') {
                            setEntityProps(JSON.stringify({ description: "Ancient obsidian shard.", power: "Volatile" }, null, 2));
                          } else if (val === 'LOCATION') {
                            setEntityProps(JSON.stringify({ safety: "Critical Hazard", anomalies: "Void Rifts" }, null, 2));
                          } else {
                            setEntityProps(JSON.stringify({ status: "Hostile", population: "Vast" }, null, 2));
                          }
                        }}
                        className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                      >
                        <option value="NPC">NPC (Individual)</option>
                        <option value="ITEM">Item (Artifact)</option>
                        <option value="LOCATION">Location (Region)</option>
                        <option value="FACTION">Faction (Group)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">SPECIFIC PROPERTIES (JSON)</label>
                    <textarea
                      value={entityProps}
                      onChange={(e) => setEntityProps(e.target.value)}
                      placeholder='{ "role": "Sentinel" }'
                      rows={3}
                      className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-[10px] focus:outline-none focus:border-cyan-500 font-mono resize-none"
                    />
                  </div>
                  <div className="flex items-center space-x-2 py-1 select-none">
                    <input
                      type="checkbox"
                      id="entityIsAliveCheck"
                      checked={entityIsAlive}
                      onChange={(e) => setEntityIsAlive(e.target.checked)}
                      className="rounded bg-black border-cyan-950 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="entityIsAliveCheck" className="text-[10px] text-slate-400 cursor-pointer">
                      ACTIVE / ALIVE / OPERATIONAL STATUS
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyan-950 hover:bg-cyan-800 text-cyan-300 text-[10px] font-bold py-1.5 rounded transition-colors cursor-pointer border border-cyan-700/40"
                  >
                    ADD TO REGISTRY
                  </button>
                </form>

                {/* Entities List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-cyan-950/20 pb-1">
                    REGISTERED ENTITIES ({entities.length})
                  </h4>
                  {entities.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No entities registered in this universe ledger.</p>
                  ) : (
                    <div className="space-y-3">
                      {entities.map((entity) => (
                        <div 
                          key={entity.entity_id}
                          className="bg-[#020408] border border-cyan-950/40 hover:border-cyan-800/40 p-3 rounded transition-colors"
                        >
                          <div className="flex justify-between items-center pb-1.5 border-b border-cyan-950/30">
                            <span className="font-bold text-xs text-slate-200">{entity.name}</span>
                            <span className="bg-cyan-950/40 text-cyan-400 border border-cyan-900/60 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider font-mono">
                              {entity.entity_type}
                            </span>
                          </div>
                          
                          <div className="flex justify-between text-[10px] mt-2">
                            <span className="text-slate-500">OPERATIONAL STATUS:</span>
                            <span className={entity.is_alive ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                              {entity.is_alive ? "OPERATIONAL / ALIVE" : "DEACTIVATED / SHATTERED"}
                            </span>
                          </div>

                          {entity.properties && Object.keys(entity.properties).length > 0 && (
                            <div className="mt-2 bg-[#010204] p-2 rounded border border-cyan-950/40 text-[10px] font-mono text-cyan-300/80 space-y-0.5">
                              {Object.entries(entity.properties).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                  <span className="text-slate-500">{k}:</span>
                                  <span className="text-cyan-400">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ACTIVE QUESTS TAB */}
            {activeTab === 'quests' && (
              <div className="space-y-6">
                
                {/* Add Quest Form */}
                <form onSubmit={handleCreateQuest} className="bg-[#020408] border border-cyan-950/70 p-3 rounded space-y-3">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Forge Quest Objective
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">OBJECTIVE NAME</label>
                      <input
                        type="text"
                        required
                        value={questTitle}
                        onChange={(e) => setQuestTitle(e.target.value)}
                        placeholder="e.g., Contain Void leak"
                        className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">REWARD SIGNAL</label>
                      <input
                        type="text"
                        value={questReward}
                        onChange={(e) => setQuestReward(e.target.value)}
                        placeholder="500 Residues"
                        className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">OBJECTIVE DISPATCH</label>
                    <textarea
                      required
                      value={questDesc}
                      onChange={(e) => setQuestDesc(e.target.value)}
                      placeholder="Detail the universe parameters for mission execution..."
                      rows={3}
                      className="w-full bg-[#060913] border border-cyan-950 rounded p-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-500 resize-none font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyan-950 hover:bg-cyan-800 text-cyan-300 text-[10px] font-bold py-1.5 rounded transition-colors cursor-pointer border border-cyan-700/40"
                  >
                    FORGE DIRECTIVE
                  </button>
                </form>

                {/* Quests List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-cyan-950/20 pb-1">
                    CURRENT MISSION LEDGER ({quests.length})
                  </h4>
                  {quests.length === 0 ? (
                    <p className="text-xs text-slate-600 italic font-mono">No mission profiles active.</p>
                  ) : (
                    <div className="space-y-3">
                      {quests.map((quest) => (
                        <div 
                          key={quest.quest_id}
                          className={`bg-[#020408] border p-3 rounded transition-colors flex flex-col space-y-2 ${
                            quest.status === 'COMPLETED' 
                              ? 'border-green-950/60 hover:border-green-800/40' 
                              : quest.status === 'FAILED' 
                              ? 'border-red-950/60 hover:border-red-800/40' 
                              : 'border-cyan-950/40 hover:border-cyan-800/40'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`font-bold text-xs ${
                              quest.status === 'COMPLETED' 
                                ? 'text-green-400' 
                                : quest.status === 'FAILED' 
                                ? 'text-red-400' 
                                : 'text-cyan-300'
                            }`}>
                              {quest.title}
                            </span>
                            <button
                              onClick={() => handleDeleteQuest(quest.quest_id)}
                              className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete objective"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                            {quest.description}
                          </p>

                          <div className="flex items-center justify-between text-[10px] bg-[#010204] p-1.5 rounded border border-cyan-950/20">
                            <span className="text-slate-500">REWARD: <span className="text-cyan-400">{quest.reward}</span></span>
                            
                            {/* Toggle Options */}
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleToggleQuestStatus(quest.quest_id, 'COMPLETED')}
                                className={`p-0.5 rounded cursor-pointer ${quest.status === 'COMPLETED' ? 'text-green-400 bg-green-950/20' : 'text-slate-600 hover:text-green-500'}`}
                                title="Set Completed"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleToggleQuestStatus(quest.quest_id, 'FAILED')}
                                className={`p-0.5 rounded cursor-pointer ${quest.status === 'FAILED' ? 'text-red-400 bg-red-950/20' : 'text-slate-600 hover:text-red-500'}`}
                                title="Set Failed"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleToggleQuestStatus(quest.quest_id, 'ACTIVE')}
                                className={`p-0.5 rounded cursor-pointer ${quest.status === 'ACTIVE' ? 'text-cyan-400 bg-cyan-950/20' : 'text-slate-600 hover:text-cyan-500'}`}
                                title="Reactivate"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>

        </section>

      </div>
    </div>
  );
}
