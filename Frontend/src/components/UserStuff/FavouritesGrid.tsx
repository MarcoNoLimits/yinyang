import { useEffect, useState } from "react";
import { useCharacterContext } from "./CharacterContext";
import { motion } from "framer-motion";
import CharacterInfo from "./CharacterInfo";
import { goToChat, mappingCharacterInfo } from "./constants";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabaseClient";
import { Character } from "./CharacterGrid";

const FavouritesGrid = () => {
  const { favourite, setFavourite, user, refreshFav, chatList, addChat } =
    useCharacterContext();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFavourites = async () => {
      if (!user?.userId) return;
      try {
        const { data, error } = await supabase
          .from("favourites")
          .select(`
            character_id,
            characters (
              char_id,
              char_name,
              char_img,
              char_description,
              char_usage
            )
          `)
          .eq("user_id", user.userId);

        if (error) throw error;

        if (data) {
          const favs = data
            .map((item: any) => {
              const char = item.characters;
              if (!char) return null;
              return {
                charId: char.char_id,
                charName: char.char_name,
                charImg: char.char_img,
                charDescription: char.char_description,
                charUsage: char.char_usage,
              };
            })
            .filter(Boolean) as Character[];
          setFavourite(favs);
        }
      } catch (error) {
        console.error("Error fetching favourites:", error);
      }
    };

    fetchFavourites();
  }, [user.userId, refreshFav]);

  useEffect(() => {
    if (favourite.length <= numPerPage) {
      // console.log(favourite.length);
      setPage(0);
    }
  }, [favourite]);

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
  const totalPages = Math.ceil(favourite.length / numPerPage);
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


  return (
    <div className="space-y-0 bg-[#212121]  px-4 sm:px-0 w-full">
      <p className="text-2xl text-white mt-10 relative justify-self-start">
        Favourites
      </p>
      

      {favourite.length === 0 ? (
        
        <div className="flex justify-center items-center h-60">
          <p className="text-white text-lg">
            You haven't liked any characters yet.
          </p>
        </div>
      ) : (
        <div>
          {favourite.length > numPerPage ? (
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
                className=" grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 h-fit justify-items-center"
              >
                {favourite
                  .slice(numPerPage * page, numPerPage * (page + 1))
                  .map((character) => (
                    <CharacterInfo
                      key={character.charId}
                      character={character}
                      liked={true}
                      onClick={() =>
                        goToChat(
                          mappingCharacterInfo(character),
                          0,
                          addChat,
                          user,
                          navigate,
                          chatList
                        )
                      }
                    />
                  ))}
              </motion.div>
              <button
                className="bg-[#efefef] rounded-full p-[20px]"
                onClick={pageIncrease}
              >
                <img
                  src="https://img.icons8.com/?size=100&id=9149&format=png&color=000000"
                  className="w-5 rotate-180"
                  alt=""
                />
              </button>
            </div>
          ) : (
            <div className=" items-center flex gap-10">
              <button
                className="bg-[#efefef] rounded-full p-[20px] opacity-0"
                onClick={() => {}}
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
                {favourite
                  .slice(numPerPage * page, numPerPage * (page + 1))
                  .map((character) => (
                    <CharacterInfo
                      key={character.charId}
                      character={character}
                      liked={true}
                      onClick={() =>
                        goToChat(
                          mappingCharacterInfo(character),
                          0,
                          addChat,
                          user,
                          navigate,
                          chatList
                        )
                      }
                    />
                  ))}
              </motion.div>
              <button
                className="bg-[#efefef] rounded-full p-[20px] opacity-0"
                onClick={() => {}}
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
      )}
    </div>
  );
};

export default FavouritesGrid;
