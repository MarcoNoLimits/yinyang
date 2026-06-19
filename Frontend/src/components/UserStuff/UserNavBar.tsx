import UserAvatar from "../UserStuff/UserAvatar";
import UserRecentChats from "../UserStuff/UserRecentChats";
import UserSearchBar from "./UserSearch";
import { useEffect, useState } from "react";
import { useCharacterContext } from "./CharacterContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabaseClient";

export interface UserNavBarProps {
  chatList: { name: string; image: string; details?: string; chatId?: number }[];
  username: string;
  handleDelete?: (buttonName: string) => void;
}

const UserNavBar: React.FC<Omit<UserNavBarProps, 'handleDelete'>> = ({
  chatList,
  username,
}) => {
  const { avatar, setAvatar, user } = useCharacterContext();
  const [userChats, setUserChats] = useState<{ name: string; image: string; chatId: number; details?: string }[]>([]);
  const navigate = useNavigate();
  
  const updateActive = (character: any, newChatId: number) => {
    navigate("/Chat", {
      state: {
        character: character,
        chatId: newChatId,
        user: user
      },
      replace: true,
    });
  };

  const getUserChats = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      
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
        .eq("user_id", authUser.id);

      if (data) {
        const chats = data
          .map((chatItem: any) => {
            const char = chatItem.characters;
            if (!char) return null;
            return {
              name: char.char_name,
              image: char.char_img ?? "No Image",
              details: char.char_description ?? "N/A",
              chatId: chatItem.chat_id,
            };
          })
          .filter(chat => chat !== null) as { name: string; image: string; details: string; chatId: number }[];
        setUserChats(chats);
      }
    } catch (error) {
      console.error("Error fetching user chats:", error);
    }
  };

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const { data: userData, error } = await supabase
          .from("users")
          .select("user_img")
          .eq("username", username)
          .single();
        if (userData && userData.user_img) {
          setAvatar(userData.user_img);
        }
      } catch (error) {
        console.error('Error fetching avatar:', error);
      }
    };
  
    if (username) {
      fetchAvatar();
    }
  }, [username]);

  useEffect(() => {
    getUserChats();
  }, []);

  // Delete handler that refreshes the chat list
  const handleDelete = async (chatId: number) => {
    try {
      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("chat_id", chatId);
      if (!error) {
        getUserChats();
      } else {
        alert("Failed to delete chat");
      }
    } catch (e) {
      alert("Error deleting chat");
    }
  };

  return (
    <div className="mt-5 flex flex-col md:flex-row items-center justify-between bg-[#212121] ml-5 h-auto w-full">
      <div className="self-start">
        <UserRecentChats
          chatList={userChats}
          handleDelete={handleDelete}
          name={username}
          user_image={avatar}
          user={user}
          updateActive={updateActive}
        />
        <div className="ml-5 md:ml-2">
          {/* Provide a default value if username is not given */}
          <UserAvatar name={username || "Guest"} image_path={avatar} />
        </div>
      </div>

      {/* Right section - Search + Filter */}
      <div className="w-full md:w-[400px] order-2 ">
        <UserSearchBar />
      </div>
    </div>
  );
};

export default UserNavBar;
