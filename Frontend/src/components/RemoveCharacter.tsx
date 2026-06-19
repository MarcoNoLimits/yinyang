import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "../config/supabaseClient";

interface Character {
  charId: number;
  charName: string;
  charImg: string;
  charDescription: string;
  charPersonality: string;
  charPrompt: string;
  charUsage: number;
}

const RemoveCharacter = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
            charPersonality: item.char_personality,
            charPrompt: item.char_prompt,
            charUsage: item.char_usage,
          }));
          setCharacters(mapped);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching characters');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharacters();
  }, []);

  const handleDelete = async () => {
    if (!selectedCharacter) return;

    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("characters")
        .delete()
        .eq("char_id", selectedCharacter.charId);

      if (error) throw error;

      // Update local state
      setCharacters(prevCharacters =>
        prevCharacters.filter(char => char.charId !== selectedCharacter.charId)
      );

      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
      setIsPopupOpen(false);
      setSelectedCharacter(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred while deleting the character');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-white text-center">Loading characters...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-red-500 text-center">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-3xl font-semibold text-white mb-6">Remove Characters</h2>

      {/* Success Message */}
      {isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
          className="fixed top-6 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50"
        >
          <div className="bg-white rounded-full p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="font-semibold">Success!</p>
            <p className="text-sm opacity-90">Character deleted successfully</p>
          </div>
        </motion.div>
      )}

      {/* Error Message */}
      {isError && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
          className="fixed top-6 right-6 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50"
        >
          <div className="bg-white rounded-full p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="font-semibold">Error</p>
            <p className="text-sm opacity-90">{errorMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div className="bg-[#1A1A1A] p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#4CAF50]"></div>
            <p className="text-white font-semibold">Processing...</p>
            <p className="text-gray-400 text-sm">Please wait while we delete the character</p>
          </div>
        </motion.div>
      )}

      {/* Character List - Grid Layout */}
      <div className="grid grid-cols-2 gap-6">
        {characters.map((character) => (
          <div
            key={character.charId}
            className="bg-[#2F2F2F] text-[#acacaf] p-6 rounded-xl shadow-md cursor-pointer hover:bg-[#3A3A3A] transition flex flex-col items-center"
            onClick={() => {
              setSelectedCharacter(character);
              setIsPopupOpen(true);
            }}
          >
            <div className="w-[112px] h-[112px] rounded-full overflow-hidden mb-4">
              <img 
                src={character.charImg} 
                alt={character.charName} 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-xl font-bold">{character.charName}</h3>
            <p className="text-sm text-gray-400">ID: {character.charId}</p>
          </div>
        ))}
      </div>

      {/* Confirmation Popup */}
      {isPopupOpen && selectedCharacter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-[#1A1A1A] p-6 rounded-lg shadow-lg w-96 text-center">
            <div className="w-[96px] h-[96px] rounded-full overflow-hidden mx-auto mb-4">
              <img 
                src={selectedCharacter.charImg} 
                alt={selectedCharacter.charName} 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Delete Character: {selectedCharacter.charName}?
            </h3>
            <p className="text-gray-400 mb-4">
              This action cannot be undone. Are you sure you want to delete this character?
            </p>
            <div className="flex justify-between">
              <button
                onClick={() => setIsPopupOpen(false)}
                className="bg-[#2F2F2F] text-[#acacaf] px-4 py-2 rounded-md hover:bg-[#3A3A3A] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition"
                disabled={isLoading}
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoveCharacter;
