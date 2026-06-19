import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { Character } from "./CharacterGrid";
import { useCharacterContext } from "./CharacterContext";
import { supabase } from "../../config/supabaseClient";

function truncateText(text: string, maxCharsPerLine = 13, maxLines = 3) {
  const maxTotalChars = maxCharsPerLine * maxLines; // 10 * 3 = 30 characters max
  return text.length > maxTotalChars
    ? text.slice(0, maxTotalChars) + "..."
    : text;
}
const unlikeCharacter = async (userId: string | number, charId: number) => {
  const { error } = await supabase
    .from("favourites")
    .delete()
    .eq("user_id", userId)
    .eq("character_id", charId);
  if (error) throw error;
};

const likeCharacter = async (userId: string | number, charId: number) => {
  const { error } = await supabase
    .from("favourites")
    .insert({ user_id: userId, character_id: charId });
  if (error) throw error;
};

const CharacterInfo = ({
  character,
  liked,
  onClick,
}: {
  character: Character;
  liked:boolean;
  onClick: () => void;
}) => {
  const [isLiked, setIsLiked] = useState<boolean>();

  const {user, setFavourite} = useCharacterContext();
  
  useEffect(() => {
    setIsLiked(liked);
  }, [liked]);
  

  const toggleLike = async () => {
    if (!user?.userId) return;
    try {
      if (!isLiked) {
        await likeCharacter(user.userId, character.charId);
        setIsLiked(true);
  
        // ✅ Add character to global favourite array
        setFavourite((prev) => [...prev, character]);
  
      } else {
        await unlikeCharacter(user.userId, character.charId);
        setIsLiked(false);
  
        // ✅ Remove character from global favourite array
        setFavourite((prev) =>
          prev.filter((favChar) => favChar.charName !== character.charName)
        );
      }
  
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };
  

  return (
    <div
      className="relative flex w-70 sm:w-fit  h-30  items-center p-4 rounded-lg bg-[#303030] hover:bg-[#454545] overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <button
        className={`absolute top-2 right-2 hover:text-red-500 ${
          isLiked ? "text-red-500" : "text-gray-500"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          toggleLike();
        }}
      >
        <Heart size={18} fill={isLiked ? "red " : "none"} />
      </button>

      <img src={character.charImg} alt={character.charName} className="w-20 h-25 rounded-2xl " />

      <div className="ml-4 flex-1">
        <h2 className="text-sm font-bold mb-1 text-white text-left">{character.charName}</h2>
        <p className="mb-2 text-white text-left text-xs">
          {truncateText(character.charDescription)}
        </p>
        <span className="text-gray-500 text-xs flex items-center gap-1">
          <MessageCircle size={14} className="text-gray-500" />
          Usage: {character.charUsage}
        </span>
      </div>
    </div>
  );
};

export default CharacterInfo;
