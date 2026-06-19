import { createContext, useContext } from "react";
import { Character } from "./CharacterGrid";


export interface CharacterContextType {
  user: { username: string; userId: string | number };
  chatList: { name: string; image: string; details: string }[];
  addChat: (
    name: string,
    image: string,
    details: string,
    chatId: number
  ) => void;
  avatar: string;
  setAvatar: (newImage: string) => void;
  favourite: Character[];
  setFavourite: React.Dispatch<React.SetStateAction<Character[]>>;
  refreshFav: boolean;
  toggleRefreshFav: () => void;
}

export const CharacterContext = createContext<CharacterContextType | null>(null);

export const useCharacterContext = () => {
  const context = useContext(CharacterContext);
  if (!context) throw new Error("useCharacterContext must be inside provider");
  return context;
};
