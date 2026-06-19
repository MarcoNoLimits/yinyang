import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CharacterInfo from "./CharacterInfo";
import { useCharacterContext } from "./CharacterContext";
import { motion } from "framer-motion";
import { supabase } from "../../config/supabaseClient";

export interface Character {
  charImg: string;
  charName: string;
  charId: number; // Using uppercase "Id" to match your format
  charDescription: string;
  charUsage: number;
}

interface CharacterGridProps {
  onCharacterSelect: (
    characterName: string,
    characterImg: string,
    characterDetails: string,
    chatId: number
  ) => void;
  list: { name: string; image: string; details: string }[];
  user: { username: string; userId: string | number };
}

const CharacterGrid: React.FC<CharacterGridProps> = ({
  onCharacterSelect,
  list,
  user,
}) => {
  const [myList, setMyList] = useState(list);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  //used for simplicity
  const mappingCharacterInfo = (character: Character) => {
    return {
      charImg: character.charImg,
      charName: character.charName,
      charDescription: character.charDescription,
      charUsage: character.charUsage,
      charId: character.charId,
    };
  };
  const goToChat = (
    character: {
      charImg: string;
      charName: string;
      charId: number; // Using uppercase "Id" to match your format
      charDescription: string;
      charUsage: number;
    },
    id: number
  ) => {
    onCharacterSelect(
      character.charName,
      character.charImg,
      character.charDescription,
      id
    );

    if (!myList.some((chat) => chat.name === character.charName)) {
      const temp = myList;
      temp.push({
        name: character.charName,
        image: character.charImg,
        details: character.charDescription,
      });
      setMyList(temp);
    }

    navigate("/Chat", {
      state: {
        character: character,
        historyList: myList,
        user: user, // Pass user data here
        chatId: 0, // Pass chatId data here (if it's 0 then a new chat is created)
      },
      replace: true,
    });
  };

  const [characters, setCharacters] = useState<Character[]>([]);
  const { favourite } = useCharacterContext();

  const [direction, setDirection] = useState(1);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { x: "0%", opacity: 1 },
    exit: (direction: number) => ({
      x: direction > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  };

  const numPerPage = 8;
  const totalPages = Math.ceil(characters.length / numPerPage);

  const [page, setPage] = useState(0);

  function pageIncrease() {
    
    if (page < totalPages - 1) {
      setPage((p) => p + 1);
      setDirection(1);
    }
  }

  function pageDecrease() {
    
    if (page > 0) {
      setPage((p) => p - 1);
      setDirection(-1);
    }
  }

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const { data, error } = await supabase
          .from("characters")
          .select("*")
          .order("char_id", { ascending: true });

        if (error) throw error;

        if (data) {
          const mapped = data.map((item: any) => ({
            charId: item.char_id,
            charName: item.char_name,
            charImg: item.char_img,
            charDescription: item.char_description,
            charUsage: item.char_usage,
          }));
          setCharacters(mapped);
        }
      } catch (error) {
        console.error("Error fetching characters:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCharacters();
    console.log("Start:" + page);
  }, []);

  const checkIfLiked = (character: Character) => {
    return favourite.some(
      (fav) =>
        fav.charName.trim().toLowerCase() ===
        character.charName.trim().toLowerCase()
    );
  };

  const handleUsageUpdate = async (character: Character) => {
    try {
      const { error } = await supabase
        .from("characters")
        .update({ char_usage: (character.charUsage || 0) + 1 })
        .eq("char_id", character.charId);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating usage:", error);
    }
  };

  return (
    <div className="space-y-0 bg-[#212121] px-4 sm:px-0">
      <p className="text-2xl text-white mt-10 relative justify-self-start">
        {"Featured"}
      </p>
      {loading ? (
        <div className="flex justify-center items-center h-[300px] w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      ) : (
        <div className="flex items-center gap-10">
          <button
            className="bg-[#efefef] rounded-full p-[20px] "
            onClick={pageDecrease}
          >
            <img
              src="https://img.icons8.com/?size=100&id=9149&format=png&color=000000"
              className="w-5"
              alt=""
            />
          </button>
          <motion.div
            key={page} // Ensures re-animation on page change
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            custom={direction}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-6 h-fit justify-items-center"
          >
            {characters
              .slice(numPerPage * page, numPerPage * (page + 1))
              .map((character) => (
                <CharacterInfo
                  key={character.charId}
                  character={character}
                  liked={checkIfLiked(character)}
                  onClick={() => {
                    goToChat(mappingCharacterInfo(character), 0);
                    handleUsageUpdate(character);
                  }}
                />
              ))}
          </motion.div>
          <button
            className="bg-[#efefef] rounded-full p-[20px] "
            onClick={pageIncrease}
          >
            <img
              src="https://img.icons8.com/?size=100&id=9149&format=png&color=000000"
              className="w-5 rotate-180"
              alt=""
            />
          </button>
        </div>
      )}
    </div>
  );
};

export default CharacterGrid;
