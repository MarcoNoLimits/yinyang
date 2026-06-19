import React, { useEffect, useState } from "react";
import SideBar from "../assets/SideBar.svg";
import Search from "../assets/Search.svg";
import NewChat from "../assets/NewChat.svg";
import History from "../assets/History.svg";
import SendIcon from "../assets/SendIcon.svg";
import Cross from "../assets/Cross.svg";
import Info from "../assets/info.svg";
import Trash from "../assets/Delete.svg"
import { useNavigate } from "react-router-dom";
import { Character } from "./UserStuff/CharacterGrid";
import ShareWindow from "./ShareWindow";
import { supabase } from "../config/supabaseClient";
import { encryptId } from "../utils/crypto";


interface SidebarProps {
  character:Character,
  historyList:{ name: string; image: string,details:string,chatId:number }[],
  updateActive:any,
  user:{username:string, userId:string | number},
  chatId:Promise<number> | number
}

const Sidebar: React.FC<SidebarProps> = (props: {user:{username:string, userId:string | number}, character:Character ,historyList:{ name: string; image: string,details:string,chatId:number }[],updateActive:any,chatId:Promise<number> | number }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [activeCharacter,setActiveCharacter] = useState(props.character);

  const [activeChat,setActiveChat] = useState(props.chatId);

  const [user,setUser] = useState(props.user);
  const [shareWindow, setShareWindow] = useState(false);
  const [showInfoBarDeleteConfirm, setShowInfoBarDeleteConfirm] = useState(false);
  
  useEffect(() => {
  setActiveCharacter(props.character);
}, [props.character])

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  const toggleInfoBar = () => {
    setIsInfoCollapsed((prev) => !prev);
  };

  const changeCharacter = (nameP:string, imageP:string,detailsP:string,chatIdP:number) =>
  {
    const character:Character = {
      charImg: imageP,
      charName: nameP,
      charId: 0,
      charDescription: detailsP,
      charUsage: 0

    }
    setActiveCharacter(character);
    setActiveChat(chatIdP);
    props.updateActive(character,chatIdP);
  }

  const navigate = useNavigate();
  
  const goToDashboard = () =>
  {
    navigate("/", { state: { user } });
  }

  const [chatList,setChatList] = useState<{ name: string, image:string ,details:string, chatId:number }[]>([]);

  const getUserChats = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const userId = authUser.id;

      const { data, error } = await supabase
        .from("chats")
        .select(`
          chat_id,
          char_id,
          characters (
            char_name,
            char_img,
            char_description
          )
        `)
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching chats:", error);
        setChatList([]);
        return;
      }

      if (data) {
        const chats = data
          .map((chatItem: any) => {
            const char = chatItem.characters;
            if (!char) return null;
            return {
              name: chatItem.chat_id.toString() + ". " + char.char_name,
              chatId: chatItem.chat_id,
              image: char.char_img ?? "No Image",
              details: char.char_description ?? "N/A",
            };
          })
          .filter((chat) => chat !== null) as { name: string; image: string; details: string; chatId: number }[];

        setChatList(chats);
      } else {
        setChatList([]);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const filteredChats = chatList.filter((chat) =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(()=>
    {
      getUserChats();
      
    },[props.chatId]);
  
  async function encrypt(toEncrypt:string)
  {
    return encryptId(toEncrypt);
  }
  const [shareUrl,setShareUrl] = useState("");
  async function generateShareUrl()
  {
    setShareUrl("http://localhost:5173/Chat/Share/"+ await encrypt(props.chatId.toString()));
    console.log(shareUrl);

  } 

  const handleDeleteChat = async (chatId: number) => {
    try {
      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("chat_id", chatId);
      if (!error) {
        getUserChats();
      } else {
        console.error("Error deleting chat:", error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex relative h-screen">
      {isCollapsed && (
        <button
        className="fixed z-30 lg:h-15 md:h-15 h-14 rounded-lg px-1 text-token-text-secondary transition-all duration-1000 ease-in-out cursor-pointer"          
          aria-label="Toggle SideBar"
          data-testid="toggle-sidebar-button"
          onClick={toggleCollapse}
        >
          <img src={SideBar} alt="SideBar icon" className="w-5 h-5 cursor-pointer " />
        </button>
      )}

      
      {!isCollapsed && (
        <div className={`z-21 flex-shrink-0 w-40 md:w-45 lg:w-60 bg-[var(--black)] bg-token-sidebar-surface-primary transition-all`}>
          <div className="h-full flex flex-col">
            <div className="flex h-full min-h-0 flex-col">                
              <nav className="flex h-full w-full flex-col px-3" aria-label="Chat History">
                <div className="flex justify-between h-[60px] items-center md:h-header-height">
                  <button
                    className="h-9 rounded-lg cursor-pointer"
                    aria-label="Close SideBar"
                    onClick={toggleCollapse}
                  >
                    <img src={SideBar} alt="SideBar icon" className="w-5 h-5 cursor-pointer"  />
                  </button>
                  <div className="flex">
                    {searchOpen ? (
                    <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="h-8 px-2 bg-[var(--gray-light)] text-[var(--gray-black)] rounded-xl w-[105px]"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                      aria-label="Close Search"
                      className="h-8 cursor-pointer"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchTerm("");
                      }}
                    >
                      <img src={Cross} alt="Close icon" className="w-5 h-5 cursor-pointer"  />
                    </button>
                  </div>
                  ) : (
                  <button
                    aria-label="Search"
                    className="h-10 px-2 cursor-pointer"
                    onClick={() => setSearchOpen(!searchOpen)}
                  >
                    <img src={Search} alt="Search icon" className="w-5 h-5" />
                  </button>
                  )}
                  <button
                    aria-label="New chat"
                    data-testid="create-new-chat-button"
                    className="h-10 rounded-lg px-2 text-token-text-secondary focus-visible:bg-token-surface-hover focus-visible:outline-0 enabled:hover:bg-token-surface-hover disabled:text-token-text-quaternary cursor-pointer"
                    onClick={goToDashboard}
                  >
                    <img src={NewChat} alt="NewChat icon" className="w-5 h-5 cursor-pointer"  />
                  </button>
                </div>
              </div>

              <div className="flex-col flex-1 overflow-y-auto">
                <div className="flex h-9 items-center">
                  <h3 className="px-2 text-xs font-semibold text-ellipsis overflow-hidden break-all pt-3 pb-2 text-token-text-primary">
                    Chat History
                  </h3>
                </div>
                  <ol>
                    {filteredChats.map((chat, index) => (
                    <li onClick={() => changeCharacter(chatList[index].name,chatList[index].image,chatList[index].details,chatList[index].chatId)} key={index} className="p-2 hover:bg-[var(--gray-almost-black)] rounded-xl cursor-pointer">
                      {chat.name}
                    </li>
                    ))}
                  </ol>
                </div>
              </nav>
            </div>
          </div>
        </div>
      )}

      <button
        className={`fixed z-50 transition-all duration-300 rounded-lg px-1 text-token-text-secondary cursor-pointer ${isInfoCollapsed ? 'right-2' : 'right-[calc(220px+10px)]'} top-16`}
        aria-label="Toggle info Bar"
        data-testid="toggle-infoBar-button"
        onClick={toggleInfoBar}
      >
        <img src={Info} alt="info icon" className="lg:w-5 lg:h-5 w-4 h-4 cursor-pointer" />
      </button>

      <div
        className={`fixed z-10 top-0 right-0 transition-all duration-300 bg-[var(--page)] text-[var(--white)] border border-[var(--gray-black)] h-screen ${
          isInfoCollapsed ? "w-0 md:w-0 lg:w-0" : "w-100 md:w-100 lg:w-[230px]"
        } flex flex-col`}
      >
        {!isInfoCollapsed && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="p-4 z-0 border-b border-[var(--gray-black)] flex flex-col items-center mt-12">
              <img
                src={activeCharacter.charImg}
                alt="Avatar"
                className="w-38 h-38 rounded-full border-2 border-[var(--gray-black)]"
              />
              <h2 className="text-xl font-semibold mt-2 text-center">{activeCharacter.charName}</h2>
            </div>
            <div className="px-4 py-3">
              <h3 className="text-xl font-semibold">Bio</h3>
              <p className="text-xm mt-1 text-justify">
                {activeCharacter.charDescription}
              </p>
            </div>
            <nav className="mt-4 space-y-2 font-semibold px-4 z-100">
              <button onClick={goToDashboard} className=" flex items-center gap-3 w-full px-4 py-2 hover:bg-[var(--gray-almost-black)] rounded-xl cursor-pointer">
                <img
                  src={NewChat}
                  alt="New Chat icon"
                  className="w-6 h-6 transition-transform duration-200 group-hover:scale-110 "
                />
                <span>New chat</span>
              </button>
              <button className="flex items-center gap-3 w-full px-4 py-2 hover:bg-[var(--gray-almost-black)] rounded-xl cursor-pointer">
                <img
                  src={History}
                  alt="History icon"
                  className="w-6 h-6 transition-transform duration-200 group-hover:scale-110"
                />
                <span>History</span>
              </button>
              <button
                className="flex items-center gap-3 w-full px-4 py-2 hover:bg-[var(--gray-almost-black)] rounded-xl cursor-pointer relative"
                onClick={() => setShowInfoBarDeleteConfirm(true)}
              >
                <img
                  src={Trash}
                  alt="Delete Icon"
                  className="w-6 h-6 transition-transform duration-200 group-hover:scale-110"
                />
                <span>Delete Chat</span>
                {showInfoBarDeleteConfirm && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-950 text-white text-sm p-2 rounded shadow-lg flex gap-2 items-center z-50">
                    <span>Delete this chat?</span>
                    <button
                      className="bg-red-500 px-2 py-1 rounded hover:bg-red-700"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteChat(props.chatId as number);
                        setShowInfoBarDeleteConfirm(false);
                        navigate("/");
                        window.location.reload();
                      }}
                    >
                      Yes
                    </button>
                    <button
                      className="bg-gray-500 px-2 py-1 rounded hover:bg-gray-700"
                      onClick={e => {
                        e.stopPropagation();
                        setShowInfoBarDeleteConfirm(false);
                      }}
                    >
                      No
                    </button>
                  </div>
                )}
              </button>
              <button className="flex items-center gap-3 w-full px-4 py-2 hover:bg-[var(--gray-almost-black)] rounded-xl cursor-pointer" onClick={()=>{
                    props.chatId==0 ? "" : setShareWindow(!shareWindow)
                    generateShareUrl();
                  }}>
                <img
                  src={SendIcon}
                  alt="Send chat icon"
                  className="w-6 h-6 transition-transform duration-200 group-hover:scale-110 invert"
                ></img>
                <span>Share Chat</span>
              </button>
              <div className="rounded-xl self-center items-center z-22">
                {shareWindow ? <ShareWindow url={shareUrl}/>:''}
              </div>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
