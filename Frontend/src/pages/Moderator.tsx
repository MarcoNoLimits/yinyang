import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AddCharacter from "../components/AddCharacter";
import EditCharacter from "../components/EditCharacter";
import RemoveCharacter from "../components/RemoveCharacter";
import LoginNav from "../components/LoginNav";
import { supabase } from "../config/supabaseClient";

const ManageCharacters = () => {
  const [activeTab, setActiveTab] = useState("add");
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkModerator = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/Login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("username, role")
          .eq("user_id", session.user.id)
          .single();

        if (profileError || !profile || (profile.role !== "moderator" && profile.role !== "admin")) {
          console.error("Not a moderator/admin:", profileError);
          navigate("/Login");
          return;
        }

        setUsername(profile.username);
        setLoading(false);
      } catch (error) {
        console.error("Error checking moderator status:", error);
        navigate("/Login");
      }
    };

    checkModerator();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#212121] text-white">
        <p>Loading moderator panel...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center bg-[#212121] min-h-screen p-4 sm:p-6">
      <LoginNav username={username} />
      <div className="w-full max-w-[900px] h-full mt-10 sm:mt-20 rounded-lg shadow-lg p-4 sm:p-8 flex flex-col bg-[#212121]">
        {/* Tabs */}
        <div className="flex flex-wrap justify-center border-b mb-6">
          {["add", "edit", "remove"].map((tab) => (
            <button
              key={tab}
              className={`py-2 sm:py-3 px-4 sm:px-8 mx-1 sm:mx-2 text-sm sm:text-base font-semibold transition-all duration-300 rounded-t-lg ${
                activeTab === tab
                  ? "border-b-4 border-white text-[#acacaf]"
                  : "text-[#acacaf] hover:bg-[#2F2F2F]"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-grow flex items-center justify-center w-full p-4 sm:p-6 bg-[#212121]">
          {activeTab === "add" && <AddCharacter />}
          {activeTab === "edit" && <EditCharacter />}
          {activeTab === "remove" && <RemoveCharacter />}
        </div>
      </div>
    </div>
  );
};

export default ManageCharacters;
