import { useState, useRef } from "react";
import { motion } from "framer-motion"; // Import Framer Motion
import { personalityTraits } from "./personalityTraits";
import { supabase } from "../config/supabaseClient";

const AddCharacter = () => {
  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [characteristics, setCharacteristics] = useState<string>("");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle trait selection
  const handleTraitToggle = (trait: string) => {
    setSelectedTraits([trait]); // Only allow one trait to be selected
    setCharacteristics(trait);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("Image size should be less than 5MB");
        setIsError(true);
        return;
      }
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMessage("Please upload a valid image file");
        setIsError(true);
        return;
      }
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setIsError(false);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");

    if (!image) {
      setErrorMessage("Please upload an image");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      // 1. Upload to Supabase Storage
      const fileExt = image.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `characters/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(filePath, image, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("profiles")
        .getPublicUrl(filePath);

      // 2. Insert character into characters table
      const { error: insertError } = await supabase
        .from("characters")
        .insert({
          char_name: name,
          char_img: publicUrl,
          char_description: details,
          char_personality: characteristics,
          char_prompt: `I want you to respond to my prompts considering that you are the character ${name} with the following description ${details}. Your responses should also be ${characteristics} towards me. Okay?`,
          char_usage: 0
        });

      if (insertError) {
        throw insertError;
      }

      // Show success message
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);

      // Reset form
      setName("");
      setImage(null);
      setPreview(null);
      setDetails("");
      setCharacteristics("");
      setSelectedTraits([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error('Error:', error);
      setErrorMessage(error.message || 'An error occurred while adding the character');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-lg shadow-md w-full h-full mt-20 bg-[#212121] flex flex-col items-center relative">
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
            <p className="text-sm opacity-90">Character added successfully</p>
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
            <p className="text-gray-400 text-sm">Please wait while we add the character</p>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        {/* Character Name & Image Row */}
        <div className="flex gap-6 items-start mb-6">
          <div className="w-1/2">
            <label className="block text-[#acacaf] font-semibold mb-2">Character Name</label>
            <input
              type="text"
              placeholder="Enter Character Name"
              className="border p-2 w-full rounded-md bg-[#2F2F2F] text-[#acacaf]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="w-1/2 flex flex-col items-center">
            <label className="block text-[#acacaf] font-semibold mb-2">Character Image</label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="fileInput"
              onChange={handleImageChange}
              ref={fileInputRef}
              required
            />
            <label
              htmlFor="fileInput"
              className="bg-[#2F2F2F] text-[#acacaf] px-4 py-3 rounded-md cursor-pointer hover:bg-[#3A3A3A] transition font-semibold"
            >
              Select Image
            </label>
            {preview && (
              <div className="mt-4 flex flex-col items-center">
                <img src={preview} alt="Character Preview" className="w-24 h-24 object-cover rounded-md shadow-md" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="mt-2 text-red-400 hover:text-red-500 font-semibold"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Details & Characteristics */}
        <div>
          <label className="block text-[#acacaf] font-semibold">Character Details</label>
          <textarea
            placeholder="Enter details about the character..."
            className="border p-2 w-full rounded-md h-24 resize-none bg-[#2F2F2F] text-[#acacaf]"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-[#acacaf] font-semibold mt-4">Character Personality</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
            {personalityTraits.map((trait) => (
              <label
                key={trait}
                className="flex items-center space-x-2 p-2 rounded-md bg-[#2F2F2F] hover:bg-[#3A3A3A] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTraits.includes(trait)}
                  onChange={() => handleTraitToggle(trait)}
                  className="form-checkbox h-4 w-4 text-[#4CAF50] rounded border-[#3A3A3A]"
                />
                <span className="text-[#acacaf]">{trait}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          className="mt-4 bg-[#2F2F2F] text-[#acacaf] px-4 py-2 rounded-md cursor-pointer hover:bg-[#3A3A3A] transition font-semibold w-full disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Adding Character...' : 'Add Character'}
        </button>
      </form>

      {/* Character Preview Card */}
      {name && preview && (
        <div className="mt-6 p-4 rounded-lg shadow-md bg-[#2F2F2F] w-full max-w-md text-[#acacaf]">
          <h2 className="font-bold text-xl mb-2">Character Preview</h2>
          <div className="flex items-center gap-4 overflow-hidden">
            <img src={preview} alt="Character Preview" className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
            <div className="overflow-hidden">
              <h3 className="text-lg font-semibold truncate">{name}</h3>
              <p className="text-sm break-words line-clamp-3">{details}</p>
              <p className="text-xs text-gray-400 mt-1 break-words line-clamp-2">{characteristics}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddCharacter;
