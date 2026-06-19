import CharacterGrid from "./CharacterGrid";
import FavouritesGrid from "./FavouritesGrid";
import SuggestionBanner from "./SuggestionBanner";

interface MainPageProps {
  addChat: (
    characterName: string,
    characterImage: string,
    characterDetails: string
  ) => void;
  chatList: { name: string; image: string; details: string }[];
  username: string;
  userId: string | number;
}

const MainPage: React.FC<MainPageProps> = ({
  addChat,
  chatList,
  username,
  userId,
}) => {
  return (
    <div className="flex flex-col items-center justify-between px-4 bg-[#212121]">
      <SuggestionBanner />
      <CharacterGrid
        onCharacterSelect={addChat}
        list={chatList}
        user={{ username, userId }}
      />
      <FavouritesGrid />
    </div>
  );
};

export default MainPage;
