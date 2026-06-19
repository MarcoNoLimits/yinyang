import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Character } from "./CharacterGrid";
import { ArrowLeft } from "lucide-react";
import UserNavBar, { UserNavBarProps } from "./UserNavBar";
import { useEffect, useState } from "react";
import CharacterInfo from "./CharacterInfo";
import { useCharacterContext } from "./CharacterContext";
import { supabase } from "../../config/supabaseClient";
import { goToChat, mappingCharacterInfo } from "./constants";

interface FilterListProps {
  chatList: { name: string; image: string; details: string }[];
  handleDelete?: (buttonName: string) => void;
}

const FilterList: React.FC<FilterListProps> = ({ }) => {
  const { chatList, addChat, favourite } = useCharacterContext();
  const location = useLocation();
  const { icon, title, bgColor } = location.state;

  const navigate = useNavigate();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [userMetadata, setUserMetadata] = useState<any>(null);

  useEffect(() => {
    const checkUserAndFetch = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/Login");
          return;
        }
        const authUser = session.user;
        const role = authUser.user_metadata?.role || "user";
        if (role !== "user") {
          navigate("/Login");
          return;
        }
        setUsername(authUser.user_metadata?.username || authUser.email || "User");
        setUserMetadata({
          username: authUser.user_metadata?.username || authUser.email || "User",
          userId: authUser.id,
        });

        const { data, error } = await supabase
          .from("characters")
          .select("*")
          .eq("char_personality", title);

        if (error) throw error;

        if (data) {
          const mapped = data.map((item: any) => ({
            charId: item.char_id,
            charName: item.char_name,
            charImg: item.char_img,
            charDescription: item.char_description,
            charUsage: item.char_usage,
            charPersonality: item.char_personality,
            charPrompt: item.char_prompt,
            charLiked: item.char_liked,
          }));
          setCharacters(mapped);
        }
      } catch (error) {
        console.error("Error in FilterList:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndFetch();
  }, [title]);

  if (loading) {
    return (
      <div className="bg-[#212121] min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  const checkIfLiked = (character: Character) => {
    return favourite.some(
      (fav) =>
        fav.charName.trim().toLowerCase() ===
        character.charName.trim().toLowerCase()
    );
  };
  return (
    <div className="bg-[#212121] min-h-screen pt-5 px-4 sm:px-6 md:px-10 lg:px-40">
      <UserNavBar
        chatList={chatList}
        username={username}
      />
      <div
        className={`bg-gradient-to-b from-[#yourColor] to-black rounded-t-4xl w-full h-45 md:h-90 relative overflow-hidden mt-25`}
      style={{backgroundColor: bgColor}}
      >
        <div
          className="absolute top-6 left-6 md:top-10 md:left-10 text-white text-4xl rounded-full h-10 w-10 cursor-pointer flex items-center justify-center hover:bg-[#818181]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft />
        </div>

        <h1 className=" text-4xl md:text-6xl text-white absolute bottom-4 left-10">
          {title}
        </h1>

        <img
          src={icon}
          alt={title}
          className="w-20 h-20 md:w-30 md:h-30 rounded-xl transform rotate-45 absolute right-10 bottom-4 translate-x-4 translate-y-4"
        />
      </div>

      <div className="pt-6 h-fit">
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full text-white py-10">
            <p className="text-lg">No new characters added</p>
            {/* You can add an icon or illustration here if you want */}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center">
            {characters.map((character) => (
              <CharacterInfo
                character={character}
                liked={checkIfLiked(character)}
                onClick={() =>
                  goToChat(
                    mappingCharacterInfo(character),
                    0,
                    addChat,
                    userMetadata,
                    navigate,
                    chatList
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterList;
