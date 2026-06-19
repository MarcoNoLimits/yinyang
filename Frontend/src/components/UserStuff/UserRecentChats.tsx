import { useState } from "react";
import { useNavigate } from "react-router-dom";

import YinYang from "../../assets/yinyang.png";
import { Trash2, Menu, X, ArrowDown, User, LogOut } from "lucide-react";

import ProfileImage from "../profileimg";

// Main UserRecentChats component
const UserRecentChats = ({
  chatList,
  handleDelete,
  name,
  user_image,
  user,
  updateActive,
}: {
  chatList: { name: string; image: string; chatId: number; details?: string }[];
  handleDelete: (chatId: number) => void;
  name: string;
  user_image: string;
  user?: { userId: string | number };
  updateActive: (character: any, newChatId: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const changeCharacter = (nameP: string, imageP: string, detailsP: string, chatIdP: number) => {
    const character = {
      charImg: imageP,
      charName: nameP,
      charId: 0,
      charDescription: detailsP,
      charUsage: 0
    };
    updateActive(character, chatIdP);
  };

  return (
    <div className="relative">
      {/* Menu button */}
      <div className="fixed top-4 left-4 text-[var(--white)] px-4 py-2 flex flex-col items-center gap-5">
        <button
          className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-[#3a3a3a] transition-all"
          onClick={() => setIsOpen(true)}
        >
          <Menu size={24} className="text-white hover:text-gray-300" />
        </button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-[var(--gray-black)] border-r border-[var(--gray-medium-dark)] shadow-lg z-50 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-[var(--white)] px-2 py-1 rounded hover:bg-[var(--gray-medium-dark)]"
        >
          <X />
        </button>

        <div className="w-full h-full p-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-2 w-10 h-10 mb-8 mt-10">
            <img
              src={YinYang}
              alt="YinYang Logo"
              className="flex items-center pt-3"
            />
            <h2 className="text-lg font-semibold text-[var(--white)]">
              YinYang
            </h2>
          </div>

          {/* Recent Chats */}
          <h2 className="text-xm mb-5">Recent Chats</h2>
          <div
            className="h-900"
            style={{
              maxHeight: "900px",
              overflowY: "scroll",
              padding: "10px",
              scrollbarWidth: "none",
            }}
          >
            {chatList.map((chat, index) => (
              <ChatCard
                key={index}
                name={chat.name}
                image_path={chat.image}
                onDelete={() => setConfirmDeleteId(chat.chatId)}
                onConfirmDelete={() => {
                  handleDelete(chat.chatId);
                  setConfirmDeleteId(null);
                }}
                onCancelDelete={() => setConfirmDeleteId(null)}
                showConfirm={confirmDeleteId === chat.chatId}
                onClick={changeCharacter}
                details={chat.details}
                chatId={chat.chatId}
              />
            ))}
          </div>

          {/* User Info at bottom */}
          <div className="relative h-full w-full">
            <LoginInfo name={name} image_path={user_image} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Chat card for each recent chat
const ChatCard = ({
  name,
  image_path,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  showConfirm,
  onClick,
  details,
  chatId,
}: {
  name: string;
  image_path: string;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  showConfirm: boolean;
  onClick: (name: string, image: string, details: string, chatId: number) => void;
  details?: string;
  chatId: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button 
        className="w-full text-left p-2 text-[var(--white)] rounded hover:bg-[#3a3a3a] relative flex items-center justify-start gap-2"
        onClick={() => onClick(name, image_path, details || "", chatId)}
      >
        <img
          src={image_path}
          alt="Character"
          className="bg-white rounded-full h-10 w-10 mr-2"
        />
        <span>{name}</span>
      </button>

      {isHovered && !showConfirm && (
        <button
          onClick={onDelete}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-700 p-1 rounded-full hover:bg-red-600 transition-all"
        >
          <Trash2 size={16} className="text-white" />
        </button>
      )}

      {showConfirm && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-950 text-white text-sm p-2 rounded shadow-lg flex gap-2 items-center z-50">
          <span>Delete this chat?</span>
          <button
            className="bg-red-500 px-2 py-1 rounded hover:bg-red-700"
            onClick={onConfirmDelete}
          >
            Yes
          </button>
          <button
            className="bg-gray-500 px-2 py-1 rounded hover:bg-gray-700"
            onClick={onCancelDelete}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
};

// Login Info with popup menu
const LoginInfo = ({
  name,
  image_path,
}: {
  name: string;
  image_path: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-0 left-0 flex flex-col items-center w-55">
      {isOpen && (
        <div className="absolute bottom-full mb-2 w-55 bg-[#212121] rounded-2xl shadow-lg p-3">
          <PopUpMenuItems
            icon={User}
            label="Profile"
            to="/UserDashboard/Profile"
            name={name}
            image_path={image_path}
          />

          <PopUpMenuItems
            icon={LogOut}
            label="Logout"
            to="/Login"
            name=""
            image_path=""
            onClick={() => {
              localStorage.removeItem("jwtToken");
            }}
          />
        </div>
      )}

      {/* Login Info Button */}
      <div
        className="flex items-center gap-20 hover:bg-[#454545] h-15 w-55 rounded-2xl p-3 cursor-pointer "
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {image_path ? (
            <img
              src={image_path}
              alt={name}
              className="h-10 w-10 ml-3 rounded-full"
            />
          ) : (
            <ProfileImage name={name} /> // If image_path is null, show the ProfileImage component
          )}
          <p>{name}</p>
        </div>
        <div
          className={`transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <ArrowDown size={18} className="self-end" />
        </div>
      </div>
    </div>
  );
};

// Menu items inside login info popup
type MenuItemsProps = {
  icon: React.ElementType;
  label: string;
  to: string;
  name?: string;
  image_path: string;
  onClick?: () => void;
};

const PopUpMenuItems = ({
  icon: Icon,
  label,
  to,
  name,
  image_path,
  onClick,
}: MenuItemsProps) => {
  const navigate = useNavigate();

  return (
    <div
      className="flex justify-between hover:bg-[#454545] p-1 rounded-2xl w-full"
      onClick={() => {
        if (onClick) onClick();
        navigate(to, { state: { name, image_path } });
      }}
    >
      <p className="text-xm ml-1">{label}</p>
      <Icon size={20} className="mr-1" />
    </div>
  );
};

export default UserRecentChats;
