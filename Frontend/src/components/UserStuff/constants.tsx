import { NavigateFunction } from "react-router-dom";
import { Character } from "./CharacterGrid";

export const mappingCharacterInfo = (character: Character) => {
  return {
    img: character.charImg,
    name: character.charName,
    details: character.charDescription,
    usage: character.charUsage,
    Id: character.charId,
  };
};

export const goToChat = (
  character: {
    img: string;
    name: string;
    details: string;
    usage: number;
    Id: number;
  },
  Id: number,
  addChat: (
    name: string,
    image: string,
    details: string,
    chatId: number
  ) => void,
  user: {
    username: string;
    userId: string | number;
  },
  navigate: NavigateFunction,
  chatList: {
    name: string;
    image: string;
    details: string;
  }[]
) => {
  addChat(character.name, character.img, character.details, Id);

  if (!chatList.some((chat) => chat.name === character.name)) {
    const temp = chatList;
    temp.push({
      name: character.name,
      image: character.img,
      details: character.details,
    });
  }

  navigate("/Chat", {
    state: {
      character: character,
      historyList: chatList,
      user: user, // Pass user data here
      chatId: 0, // Pass chatId data here (if it's 0 then a new chat is created)
    },
    replace: true,
  });
};
