import React, { useEffect, useRef, useState } from "react";
import InputBar from "../components/InputBar";
import Typing from "../components/Typing";
import MessageBubble from "../components/MessageBubble";
import SideBar from "../components/SideBar";
import ChatNav from "../components/ChatNav";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseClient";
import { decryptId } from "../utils/crypto";
import { Character } from "../components/UserStuff/CharacterGrid";

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

export interface ChatCharacter extends Character {
  charPrompt?: string;
  char_prompt?: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string; userId: string } | null>(null);

  const [character, setCharacter] = useState<ChatCharacter>(location.state?.character || {
    charImg: "",
    charName: "",
    charId: 0,
    charDescription: "",
    charUsage: 0
  });

  const [list, setList] = useState<
    { name: string; image: string; details: string; chatId: number }[]
  >([]);
  const [chatId, setChatId] = useState<number>(
    location.state?.chatId || id ? -1 : 0
  );
  const [firstRender, setFirstRender] = useState(true);

  // New States for Universe Control Panel
  const [showControlPanel, setShowControlPanel] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'universe' | 'lorebook' | 'entities'>('universe');
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [selectedUniverseId, setSelectedUniverseId] = useState<string>('00000000-0000-0000-0000-000000000001');

  // Universe creation states
  const [newUnivName, setNewUnivName] = useState<string>('');
  const [newUnivDesc, setNewUnivDesc] = useState<string>('');

  // Lorebook states
  const [lorebookEntries, setLorebookEntries] = useState<LorebookEntry[]>([]);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [loreTitle, setLoreTitle] = useState<string>('');
  const [loreKeywords, setLoreKeywords] = useState<string>('');
  const [loreContent, setLoreContent] = useState<string>('');

  // Entity states
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityName, setEntityName] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('NPC');
  const [entityProps, setEntityProps] = useState<string>(JSON.stringify({ role: "Guard", description: "A local city guard.", faction: "Demacia" }, null, 2));
  const [entityIsAlive, setEntityIsAlive] = useState<boolean>(true);

  // Check user session on mount
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

  // Load universes when components mounts
  useEffect(() => {
    fetchUniverses();
  }, []);

  // Load lorebook and entities when universe changes
  useEffect(() => {
    if (selectedUniverseId) {
      fetchLorebook(selectedUniverseId);
      fetchEntities(selectedUniverseId);
    }
  }, [selectedUniverseId]);

  const fetchUniverses = async () => {
    try {
      const { data, error } = await supabase.from('universes').select('*').order('name');
      if (error) {
        console.error("Error fetching universes:", error);
      } else if (data) {
        setUniverses(data);
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

  const fetchLorebook = async (univId: string) => {
    try {
      const { data, error } = await supabase.from('lorebook_entries').select('*').eq('universe_id', univId).order('created_at', { ascending: false });
      if (error) {
        console.error("Error fetching lorebook:", error);
      } else if (data) {
        setLorebookEntries(data);
      }
    } catch (err) {
      console.error("Error in fetchLorebook:", err);
    }
  };

  const handleSaveLorebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loreTitle.trim() || !loreContent.trim()) return;
    const keywordArray = loreKeywords.split(',').map(k => k.trim()).filter(Boolean);

    try {
      if (editingEntryId) {
        const { error } = await supabase.from('lorebook_entries').update({
          title: loreTitle.trim(),
          keywords: keywordArray,
          content: loreContent.trim()
        }).eq('entry_id', editingEntryId);

        if (error) {
          alert("Error updating lorebook entry: " + error.message);
        } else {
          setEditingEntryId(null);
          setLoreTitle('');
          setLoreKeywords('');
          setLoreContent('');
          fetchLorebook(selectedUniverseId);
        }
      } else {
        const { error } = await supabase.from('lorebook_entries').insert({
          universe_id: selectedUniverseId,
          title: loreTitle.trim(),
          keywords: keywordArray,
          content: loreContent.trim()
        });

        if (error) {
          alert("Error creating lorebook entry: " + error.message);
        } else {
          setLoreTitle('');
          setLoreKeywords('');
          setLoreContent('');
          fetchLorebook(selectedUniverseId);
        }
      }
    } catch (err) {
      console.error("Error in handleSaveLorebook:", err);
    }
  };

  const fetchEntities = async (univId: string) => {
    try {
      const { data, error } = await supabase.from('entities').select('*').eq('universe_id', univId).order('name');
      if (error) {
        console.error("Error fetching entities:", error);
      } else if (data) {
        setEntities(data);
      }
    } catch (err) {
      console.error("Error in fetchEntities:", err);
    }
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName.trim()) return;
    let parsedProps = {};
    try {
      parsedProps = JSON.parse(entityProps || '{}');
    } catch (err) {
      alert("Invalid JSON in properties. Please correct it.");
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
        alert("Error creating entity: " + error.message);
      } else {
        setEntityName('');
        // Reset properties template
        if (entityType === 'NPC') {
          setEntityProps(JSON.stringify({ role: "Guard", description: "A local city guard.", faction: "Demacia" }, null, 2));
        } else if (entityType === 'ITEM') {
          setEntityProps(JSON.stringify({ description: "A mystical artifact.", rarity: "Rare" }, null, 2));
        } else if (entityType === 'LOCATION') {
          setEntityProps(JSON.stringify({ region: "Demacia", safety: "High" }, null, 2));
        } else {
          setEntityProps(JSON.stringify({ alliance: "Neutral", size: "Medium" }, null, 2));
        }
        setEntityIsAlive(true);
        fetchEntities(selectedUniverseId);
      }
    } catch (err) {
      console.error("Error in handleCreateEntity:", err);
    }
  };

  const getCharFromId = async (charId: number) => {
    try {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .eq("char_id", charId)
        .single();

      if (error || !data) {
        setError("Char Not Found!");
        return null;
      }

      const mappedChar: ChatCharacter = {
        charId: data.char_id,
        charName: data.char_name,
        charImg: data.char_img,
        charDescription: data.char_description,
        charUsage: data.char_usage,
        charPrompt: data.char_prompt
      };

      return mappedChar;
    } catch (err) {
      console.error("Error fetching character:", err);
      setError("Couldn't get character!");
      return null;
    }
  };

  const fetchCharId = async () => {
    const charId = await retrieveMessages(chatId, true);
    if (charId) {
      const sharedChar = await getCharFromId(charId);
      if (sharedChar) {
        setCharacter(sharedChar);
      }
    }
  };

  //Checks Shared Id
  useEffect(() => {
    if (id) {
      const decryptedID = decryptId(id);
      setChatId(parseInt(decryptedID, 10));
    } else {
      setCharacter(location.state?.character);
    }
  }, [id, location.state?.character]);

  useEffect(() => {
    if (chatId > 0) {
      if (!character.charName)
        fetchCharId();
    }
  }, [chatId]);

  useEffect(() => {
    setActiveCharacter(character);
  }, [character]);

  function separateMessages(chatText: string): void {
    const allMessages = chatText.split("$$").filter((msg) => msg.trim() !== "");
    let msgs: Message[] = [];
    for (const msg of allMessages) {
      if (msg.startsWith("[System]: ")) {
        msgs.push({ text: msg.replace("[System]: ", ""), sender: "system" });
      } else if (msg.startsWith("[User]: ")) {
        msgs.push({ text: msg.replace("[User]: ", ""), sender: "user" });
      } else if (msg.startsWith("[AI]: ")) {
        msgs.push({ text: msg.replace("[AI]: ", ""), sender: "ai" });
      } else {
        // Fallback: alternating user and ai (starting with user)
        let Sender = msgs.length % 2 === 0 ? "user" : "ai";
        msgs.push({ text: msg, sender: Sender });
      }
    }
    setMessages(msgs);
  }

  const retrieveMessages = async (chatId: number, gettingCharId?: boolean) => {
    if (chatId === 0) {
      setMessages([{ text: "Hello! How can I help you today?", sender: "ai" }]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chats")
        .select("chat_id, char_id, user_id, chat_text")
        .eq("chat_id", chatId)
        .single();

      if (error || !data) {
        setError("Chat Not Found!");
        return;
      }

      if (id) {
        if (gettingCharId) {
          return data.char_id;
        } else {
          separateMessages(data.chat_text || "");
          return data.char_id;
        }
      } else {
        separateMessages(data.chat_text || "");
      }
    } catch (error) {
      console.error("Error:", error);
      setError("Couldn't get messages!");
    }
  };

  const sendMessage = async (message: string) => {
    if (!user) return;

    if (chatId === 0 || id) {
      let userMsgText = "";
      if (id) {
        messages.forEach((msg) => {
          if (msg.sender === "system") {
            userMsgText += "[System]: " + msg.text + "$$";
          } else if (msg.sender === "user") {
            userMsgText += "[User]: " + msg.text + "$$";
          } else {
            userMsgText += "[AI]: " + msg.text + "$$";
          }
        });
      }
      userMsgText += "[User]: " + message + "$$";

      try {
        // Create new chat in the chats table
        const { data: newChat, error: insertError } = await supabase
          .from("chats")
          .insert({
            user_id: user.userId,
            char_id: character.charId,
            chat_text: userMsgText
          })
          .select("chat_id")
          .single();

        if (insertError || !newChat) {
          setError("Failed to create chat");
          console.error("Error inserting chat:", insertError);
          return;
        }

        const newChatId = newChat.chat_id;
        setChatId(newChatId);

        const newMessages = [...messages, { text: message, sender: "user" }];
        setMessages(newMessages);
        setTyping(true);

        const modelBody = {
          session_id: "" + newChatId,
          universe_id: selectedUniverseId,
          char_id: character.charId,
          char_name: character.charName,
          char_personality: character.charPrompt || character.char_prompt || character.charDescription,
          message: message
        };
        const modelResponse = await fetch("http://localhost:8000/chat/swarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(modelBody),
        });

        if (modelResponse.ok) {
          const apiRes = await modelResponse.json();
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

          const { error: aiUpdateError } = await supabase
            .from("chats")
            .update({ chat_text: updatedChatText })
            .eq("chat_id", newChatId);

          if (aiUpdateError) {
            setError("Couldn't send Reply!");
          } else {
            setTimeout(() => {
              setMessages(finalMessages);
              setTyping(false);
            }, 1000);
            navigate("/Chat", {
              state: {
                character: character,
                historyList: list,
                user: user,
                chatId: newChatId,
              },
              replace: true,
            });
          }
        } else {
          setError("Couldn't reach the model!");
          setTyping(false);
        }
      } catch (error) {
        console.error("Error:", error);
        setError("Chat Not Found!");
        setTyping(false);
      }
      return;
    }

    try {
      const { data: existingChat, error: fetchError } = await supabase
        .from("chats")
        .select("chat_text")
        .eq("chat_id", chatId)
        .single();

      if (fetchError || !existingChat) {
        setError("Chat not found!");
        return;
      }

      const currentChatText = existingChat.chat_text || "";
      const updatedUserChatText = currentChatText + "[User]: " + message + "$$";

      const { error: userUpdateError } = await supabase
        .from("chats")
        .update({ chat_text: updatedUserChatText })
        .eq("chat_id", chatId);

      if (userUpdateError) {
        setError("Couldn't send message!");
        return;
      }

      const newMessages = [...messages, { text: message, sender: "user" }];
      setMessages(newMessages);
      setTyping(true);

      const modelBody = {
        session_id: "" + chatId,
        universe_id: selectedUniverseId,
        char_id: character.charId,
        char_name: character.charName,
        char_personality: character.charPrompt || character.char_prompt || character.charDescription,
        message: message
      };
      const modelResponse = await fetch("http://localhost:8000/chat/swarm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(modelBody),
      });

      if (modelResponse.ok) {
        const apiRes = await modelResponse.json();
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

        const { error: aiUpdateError } = await supabase
          .from("chats")
          .update({ chat_text: updatedAIChatText })
          .eq("chat_id", chatId);

        if (aiUpdateError) {
          setError("Couldn't send Reply!");
        } else {
          setTimeout(() => {
            setMessages(finalMessages);
            setTyping(false);
          }, 1000);
          setFirstRender(true);
        }
      } else {
        setError("Couldn't reach the model!");
        setTyping(false);
      }
    } catch (error) {
      console.error("Error:", error);
      setError("Chat Not Found!");
      setTyping(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) 
  }, [messages, typing]);

  const [activeCharacter,setActiveCharacter] = useState(character);
  const updateActive:any = (character:any,newChatId:number) =>
  {
    setActiveCharacter(character);
    console.log(newChatId);
    setChatId(newChatId);
  }

  useEffect(()=>
    {
      setMessages([])
      if(chatId!=0)
      {
        setFirstRender(false);
      }
      retrieveMessages(chatId);
      console.log(activeCharacter);
      
    },[activeCharacter]);

  if (loading || !user) {
    return <div className="text-white text-center mt-10">Loading session...</div>;
  }

  const selectedUniverse = universes.find(u => u.universe_id === selectedUniverseId);

  return (
    <div>
      <div className="flex h-screen bg-[var(--page)] overflow-hidden">
        {/* Left SideBar */}
        <SideBar chatId={chatId} user={user} updateActive={updateActive} historyList={list} character={activeCharacter} />
        
        {/* Chat Area */}
        <div className="flex flex-col flex-1 h-full w-full relative p-4 overflow-y-auto space-y-4 items-center">
          <ChatNav user={user} />
          
          {/* Toggle Control Panel Button */}
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={() => setShowControlPanel(!showControlPanel)} 
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg shadow-md transition-colors text-sm font-semibold flex items-center space-x-1"
            >
              <span>{showControlPanel ? "Hide Control Panel" : "Show Control Panel"}</span>
            </button>
          </div>

          <div className="pt-15 mb-20 w-89 md:min-w-[10px] lg:min-w-[850px] items-center">
            { activeCharacter?.charImg ? (messages.map((msg, index) => (
              <MessageBubble key={index} text={msg.text} sender={msg.sender} image={activeCharacter.charImg} anim={!firstRender} />
            ))) :<div>Loading character...</div> }
            <InputBar sendMessage={sendMessage} />
          </div>
          {typing && <Typing />}
          <div ref={messagesEndRef} />
        </div>

        {/* Right Control Panel */}
        {showControlPanel && (
          <div className="w-96 h-full border-l border-gray-800 bg-gray-950 text-gray-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
              <h2 className="text-lg font-bold text-purple-400">Universe Control Panel</h2>
              <button 
                onClick={() => setShowControlPanel(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-900 text-sm">
              <button 
                onClick={() => setActiveTab('universe')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-colors ${
                  activeTab === 'universe' 
                    ? 'border-purple-500 text-purple-400 bg-gray-900' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Universe
              </button>
              <button 
                onClick={() => setActiveTab('lorebook')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-colors ${
                  activeTab === 'lorebook' 
                    ? 'border-purple-500 text-purple-400 bg-gray-900' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Lorebook
              </button>
              <button 
                onClick={() => setActiveTab('entities')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-colors ${
                  activeTab === 'entities' 
                    ? 'border-purple-500 text-purple-400 bg-gray-900' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Entities
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {activeTab === 'universe' && (
                <div className="space-y-6">
                  {/* Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Active Universe
                    </label>
                    <select
                      value={selectedUniverseId}
                      onChange={(e) => setSelectedUniverseId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                      {universes.map((u) => (
                        <option key={u.universe_id} value={u.universe_id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    {selectedUniverse && (
                      <p className="text-xs text-gray-405 italic mt-1 bg-gray-900 p-2.5 rounded border border-gray-850">
                        {selectedUniverse.description}
                      </p>
                    )}
                  </div>

                  {/* Create Form */}
                  <div className="border-t border-gray-850 pt-4 space-y-4">
                    <h3 className="text-sm font-semibold text-purple-400">Create New Universe</h3>
                    <form onSubmit={handleCreateUniverse} className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-450 mb-1">Name</label>
                        <input
                          type="text"
                          required
                          value={newUnivName}
                          onChange={(e) => setNewUnivName(e.target.value)}
                          placeholder="e.g. Cyberpunk Neo-Tokyo"
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-450 mb-1">Description</label>
                        <textarea
                          required
                          value={newUnivDesc}
                          onChange={(e) => setNewUnivDesc(e.target.value)}
                          placeholder="Brief description of the universe setting..."
                          rows={3}
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors shadow-md animate-duration-300"
                      >
                        Create Universe
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'lorebook' && (
                <div className="space-y-6">
                  {/* Form */}
                  <div className="bg-gray-900 border border-gray-850 p-3 rounded-lg space-y-3">
                    <h3 className="text-sm font-semibold text-purple-400">
                      {editingEntryId ? "Edit Lorebook Entry" : "Create Lorebook Entry"}
                    </h3>
                    <form onSubmit={handleSaveLorebook} className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-450 mb-1">Title</label>
                        <input
                          type="text"
                          required
                          value={loreTitle}
                          onChange={(e) => setLoreTitle(e.target.value)}
                          placeholder="e.g. The Ruined King"
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-450 mb-1">
                          Keywords (comma-separated)
                        </label>
                        <input
                          type="text"
                          required
                          value={loreKeywords}
                          onChange={(e) => setLoreKeywords(e.target.value)}
                          placeholder="e.g. king, blade, shadow"
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-450 mb-1">Content</label>
                        <textarea
                          required
                          value={loreContent}
                          onChange={(e) => setLoreContent(e.target.value)}
                          placeholder="Lore details..."
                          rows={4}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-md"
                        >
                          {editingEntryId ? "Save Changes" : "Add Entry"}
                        </button>
                        {editingEntryId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEntryId(null);
                              setLoreTitle('');
                              setLoreKeywords('');
                              setLoreContent('');
                            }}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold py-2 px-3 rounded-lg transition-colors border border-gray-700"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* List */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Lorebook Entries ({lorebookEntries.length})
                    </label>
                    {lorebookEntries.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No entries in this universe yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {lorebookEntries.map((entry) => (
                          <div 
                            key={entry.entry_id}
                            className="bg-gray-900 border border-gray-850 p-3 rounded-lg flex flex-col space-y-2 hover:border-purple-800 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold text-sm text-white">{entry.title}</h4>
                              <button
                                onClick={() => {
                                  setEditingEntryId(entry.entry_id);
                                  setLoreTitle(entry.title);
                                  setLoreKeywords(entry.keywords.join(', '));
                                  setLoreContent(entry.content);
                                }}
                                className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                              >
                                Edit
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {entry.keywords.map((kw, i) => (
                                <span 
                                  key={i} 
                                  className="bg-purple-900/40 text-purple-300 border border-purple-800/50 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-3 whitespace-pre-wrap">
                              {entry.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'entities' && (
                <div className="space-y-6">
                  {/* Form */}
                  <div className="bg-gray-900 border border-gray-850 p-3 rounded-lg space-y-3">
                    <h3 className="text-sm font-semibold text-purple-400">Add Entity</h3>
                    <form onSubmit={handleCreateEntity} className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-450 mb-1">Name</label>
                        <input
                          type="text"
                          required
                          value={entityName}
                          onChange={(e) => setEntityName(e.target.value)}
                          placeholder="e.g. Lord Barrett"
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-450 mb-1">Type</label>
                        <select
                          value={entityType}
                          onChange={(e) => {
                            const selectedType = e.target.value;
                            setEntityType(selectedType);
                            // Auto-populate template props depending on type
                            if (selectedType === 'NPC') {
                              setEntityProps(JSON.stringify({ role: "Guard", description: "A local city guard.", faction: "Demacia" }, null, 2));
                            } else if (selectedType === 'ITEM') {
                              setEntityProps(JSON.stringify({ description: "A mystical artifact.", rarity: "Rare" }, null, 2));
                            } else if (selectedType === 'LOCATION') {
                              setEntityProps(JSON.stringify({ region: "Demacia", safety: "High" }, null, 2));
                            } else {
                              setEntityProps(JSON.stringify({ alliance: "Neutral", size: "Medium" }, null, 2));
                            }
                          }}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        >
                          <option value="NPC">NPC (Character)</option>
                          <option value="ITEM">Item</option>
                          <option value="LOCATION">Location</option>
                          <option value="FACTION">Faction</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-450 mb-1">Properties (JSON)</label>
                        <textarea
                          value={entityProps}
                          onChange={(e) => setEntityProps(e.target.value)}
                          placeholder='{ "role": "Warrior" }'
                          rows={4}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 font-mono text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          id="entityIsAlive"
                          checked={entityIsAlive}
                          onChange={(e) => setEntityIsAlive(e.target.checked)}
                          className="rounded bg-gray-950 border-gray-800 text-purple-600 focus:ring-0 focus:ring-offset-0"
                        />
                        <label htmlFor="entityIsAlive" className="text-xs text-gray-300 select-none cursor-pointer">
                          Active / Alive / Intact
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-md"
                      >
                        Add Entity
                      </button>
                    </form>
                  </div>

                  {/* List */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Entities ({entities.length})
                    </label>
                    {entities.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No entities in this universe yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {entities.map((entity) => (
                          <div 
                            key={entity.entity_id}
                            className="bg-gray-900 border border-gray-850 p-3 rounded-lg flex flex-col space-y-2 hover:border-purple-800 transition-colors"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-sm text-white">{entity.name}</span>
                              <span className="bg-gray-850 text-purple-300 border border-purple-900/40 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
                                {entity.entity_type}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Status:</span>
                              <span className={entity.is_alive ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                                {entity.is_alive ? "Alive / Active" : "Dead / Inactive"}
                              </span>
                            </div>
                            {entity.properties && Object.keys(entity.properties).length > 0 && (
                              <div className="mt-1 bg-gray-950 p-2 rounded border border-gray-850 text-[11px] font-mono text-gray-300 overflow-x-auto">
                                {Object.entries(entity.properties).map(([k, v]) => (
                                  <div key={k}>
                                    <span className="text-purple-400">{k}:</span> {String(v)}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
