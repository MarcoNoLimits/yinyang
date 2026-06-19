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

  const [character, setCharacter] = useState<Character>(location.state?.character || {
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

      const mappedChar: Character = {
        charId: data.char_id,
        charName: data.char_name,
        charImg: data.char_img,
        charDescription: data.char_description,
        charUsage: data.char_usage,
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
    let counter = 0;
    let msgs: Message[] = [];
    for (const msg of allMessages) {
      let Sender = counter % 2 === 0 ? "user" : "ai";
      msgs.push({ text: msg, sender: Sender });
      counter++;
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
          userMsgText += msg.text + "$$";
        });
      }
      userMsgText += message + "$$";

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
        setMessages([...messages, { text: message, sender: "user" }]);
        setTyping(true);

        const stringId = "" + newChatId;
        const stringCharId = "" + character.charId;
        const stringUserId = "" + user.userId;

        const modelBody = { user_id: stringUserId, chat_id: stringId, message: message, char_id: stringCharId };
        const modelResponse = await fetch("https://qt8960e9abdedb851f8101ff2b98.free.beeceptor.com", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "104.28.212.150",
          },
          body: JSON.stringify(modelBody),
        });

        if (modelResponse.ok) {
          const aiData = await modelResponse.json();
          let aiReply = aiData.response.content;

          if (aiReply.includes("role=")) {
            if (aiReply.search('="') === -1) {
              aiReply = aiReply.slice("role='assistant' content=".length, aiReply.length);
            } else {
              aiReply = aiReply.slice(aiReply.search('="') + 2, aiReply.length);
            }
          }

          if (aiReply.includes("images=None")) {
            aiReply = aiReply.slice(0, aiReply.search('images=None') - 2);
          }

          const updatedChatText = userMsgText + aiReply + "$$";
          const { error: aiUpdateError } = await supabase
            .from("chats")
            .update({ chat_text: updatedChatText })
            .eq("chat_id", newChatId);

          if (aiUpdateError) {
            setError("Couldn't send Reply!");
          } else {
            setTimeout(() => {
              setMessages((prev) => [
                ...prev,
                { text: aiReply, sender: "ai" },
              ]);
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
      const updatedUserChatText = currentChatText + message + "$$";

      const { error: userUpdateError } = await supabase
        .from("chats")
        .update({ chat_text: updatedUserChatText })
        .eq("chat_id", chatId);

      if (userUpdateError) {
        setError("Couldn't send message!");
        return;
      }

      setMessages([...messages, { text: message, sender: "user" }]);
      setTyping(true);

      const stringId = "" + chatId;
      const stringCharId = "" + character.charId;
      const stringUserId = "" + user.userId;

      const modelBody = { user_id: stringUserId, chat_id: stringId, message: message, char_id: stringCharId };
      const modelResponse = await fetch("https://qt8960e9abdedb851f8101ff2b98.free.beeceptor.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "104.28.212.150",
        },
        body: JSON.stringify(modelBody),
      });

      if (modelResponse.ok) {
        const data = await modelResponse.json();
        let aiReply: string = data.response.content;

        if (aiReply.includes("role=")) {
          if (aiReply.search('="') === -1) {
            aiReply = aiReply.slice("role='assistant' content=".length, aiReply.length);
          } else {
            aiReply = aiReply.slice(aiReply.search('="') + 2, aiReply.length);
          }
        }

        if (aiReply.includes("images=None")) {
          aiReply = aiReply.slice(0, aiReply.search('images=None') - 2);
        }

        const updatedAIChatText = updatedUserChatText + aiReply + "$$";
        const { error: aiUpdateError } = await supabase
          .from("chats")
          .update({ chat_text: updatedAIChatText })
          .eq("chat_id", chatId);

        if (aiUpdateError) {
          setError("Couldn't send Reply!");
        } else {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              { text: aiReply, sender: "ai" },
            ]);
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

  return (
    <div>
      <div className="flex h-screen bg-[var(--page)]">
        <SideBar chatId={chatId} user={user} updateActive={updateActive} historyList={list} character={activeCharacter} />
        <div className="flex flex-col flex-1 h-full w-full relative p-4 overflow-y-auto space-y-4 items-center">
          {/* Pass username to ChatNav */}
          <ChatNav user={user} />
          <div className="pt-15 mb-20 w-89 md:min-w-[10px] lg:min-w-[850px] items-center">
            { activeCharacter?.charImg ? (messages.map((msg, index) => (
              <MessageBubble key={index} text={msg.text} sender={msg.sender} image={activeCharacter.charImg} anim={!firstRender} />
            ))) :<div>Loading character...</div> }
            <InputBar sendMessage={sendMessage} />
          </div>
          {typing && <Typing />}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
